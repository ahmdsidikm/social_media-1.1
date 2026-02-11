import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, timeAgo } from '../lib/supabase';
import type { User, Message } from '../lib/supabase';

type Props = {
  currentUser: User;
  chatTarget?: User | null;
  onClearTarget?: () => void;
};

type ConvoUser = User & { lastMessage?: string; lastTime?: string; unread?: number };

export function MessagesPage({ currentUser, chatTarget, onClearTarget }: Props) {
  const [contacts, setContacts] = useState<ConvoUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(chatTarget || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const prevMessageCountRef = useRef<number>(0);
  const isNearBottomRef = useRef<boolean>(true);
  const isInitialLoadRef = useRef<boolean>(true);

  // === STATE BARU UNTUK LONG PRESS & POPUP ===
  const [longPressUser, setLongPressUser] = useState<ConvoUser | null>(null);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  // State untuk menyimpan daftar percakapan yang dihapus (user_id + deleted_at)
  // Format: { [other_user_id]: timestamp_string }
  const [deletedConvos, setDeletedConvos] = useState<Record<string, string>>({});

  useEffect(() => {
    if (chatTarget) setSelectedUser(chatTarget);
  }, [chatTarget]);

  // Load deleted conversations dari localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`deleted_convos_${currentUser.id}`);
    if (stored) {
      try {
        setDeletedConvos(JSON.parse(stored));
      } catch {
        setDeletedConvos({});
      }
    }
  }, [currentUser.id]);

  // Save deleted conversations ke localStorage
  const saveDeletedConvos = useCallback((convos: Record<string, string>) => {
    setDeletedConvos(convos);
    localStorage.setItem(`deleted_convos_${currentUser.id}`, JSON.stringify(convos));
  }, [currentUser.id]);

  const handleScroll = useCallback(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const threshold = 150;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    isNearBottomRef.current = distanceFromBottom <= threshold;
  }, []);

  // === LONG PRESS HANDLERS ===
  const handleLongPressStart = useCallback((user: ConvoUser) => {
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setLongPressUser(user);
      setShowDeletePopup(true);
      // Haptic feedback jika tersedia
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600); // 600ms long press
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleLongPressMove = useCallback(() => {
    // Cancel long press jika user move (scroll)
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleDeleteConversation = useCallback(async () => {
    if (!longPressUser) return;
    setDeleting(true);

    try {
      // Simpan timestamp sekarang - semua pesan sebelum ini dianggap "dihapus" untuk user ini
      const newDeletedConvos = {
        ...deletedConvos,
        [longPressUser.id]: new Date().toISOString(),
      };
      saveDeletedConvos(newDeletedConvos);

      // Hapus dari daftar kontak secara visual
      setContacts(prev => prev.filter(c => c.id !== longPressUser.id));
    } finally {
      setDeleting(false);
      setShowDeletePopup(false);
      setLongPressUser(null);
    }
  }, [longPressUser, deletedConvos, saveDeletedConvos]);

  const fetchContacts = useCallback(async () => {
    const { data: following } = await supabase
      .from('followers')
      .select('following_id')
      .eq('follower_id', currentUser.id);

    const followingIds = following?.map((f: { following_id: string }) => f.following_id) || [];

    const { data: incomingMsgs } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('receiver_id', currentUser.id);

    const { data: outgoingMsgs } = await supabase
      .from('messages')
      .select('receiver_id')
      .eq('sender_id', currentUser.id);

    const allIds = new Set<string>();
    followingIds.forEach((id: string) => allIds.add(id));
    incomingMsgs?.forEach((m: { sender_id: string }) => allIds.add(m.sender_id));
    outgoingMsgs?.forEach((m: { receiver_id: string }) => allIds.add(m.receiver_id));
    allIds.delete(currentUser.id);

    if (allIds.size === 0) {
      setContacts([]);
      setLoading(false);
      return;
    }

    const { data: users } = await supabase
      .from('users')
      .select('*')
      .in('id', Array.from(allIds));

    if (users) {
      // Ambil deleted convos terbaru dari state
      const currentDeletedConvos = JSON.parse(
        localStorage.getItem(`deleted_convos_${currentUser.id}`) || '{}'
      );

      const contactsWithLast: ConvoUser[] = await Promise.all(
        users.map(async (u: User) => {
          const deletedAt = currentDeletedConvos[u.id];

          // Query sent messages (filter by deleted_at jika ada)
          let sentQuery = supabase
            .from('messages')
            .select('*')
            .eq('sender_id', currentUser.id)
            .eq('receiver_id', u.id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (deletedAt) {
            sentQuery = sentQuery.gt('created_at', deletedAt);
          }

          const { data: sentMsgs } = await sentQuery;

          // Query received messages (filter by deleted_at jika ada)
          let recvQuery = supabase
            .from('messages')
            .select('*')
            .eq('sender_id', u.id)
            .eq('receiver_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (deletedAt) {
            recvQuery = recvQuery.gt('created_at', deletedAt);
          }

          const { data: recvMsgs } = await recvQuery;

          const allLast = [...(sentMsgs || []), ...(recvMsgs || [])];
          allLast.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const lastMsg = allLast[0] || null;

          // Hitung unread (hanya pesan setelah deleted_at)
          let unreadQuery = supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_id', u.id)
            .eq('receiver_id', currentUser.id)
            .eq('is_read', false);

          if (deletedAt) {
            unreadQuery = unreadQuery.gt('created_at', deletedAt);
          }

          const { count: unread } = await unreadQuery;

          return {
            ...u,
            lastMessage: lastMsg?.content || (lastMsg?.image_url ? '📷 Foto' : ''),
            lastTime: lastMsg?.created_at || '',
            unread: unread || 0,
          };
        })
      );

      // Filter: jangan tampilkan kontak yang dihapus DAN tidak punya pesan baru setelah dihapus
      const filteredContacts = contactsWithLast.filter(c => {
        const deletedAt = currentDeletedConvos[c.id];
        if (!deletedAt) return true; // Tidak pernah dihapus, tampilkan

        // Jika dihapus tapi ada pesan baru setelahnya, tampilkan
        if (c.lastTime && new Date(c.lastTime) > new Date(deletedAt)) return true;

        // Jika di-follow dan belum pernah chat, tampilkan
        if (!c.lastTime && followingIds.includes(c.id)) return true;

        return false; // Sembunyikan
      });

      filteredContacts.sort((a, b) => {
        if (!a.lastTime && !b.lastTime) return 0;
        if (!a.lastTime) return 1;
        if (!b.lastTime) return -1;
        return new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime();
      });

      setContacts(filteredContacts);
    }
    setLoading(false);
  }, [currentUser.id]);

  const fetchMessages = useCallback(async () => {
    if (!selectedUser) return;

    const deletedAt = deletedConvos[selectedUser.id];

    let sentQuery = supabase
      .from('messages')
      .select('*')
      .eq('sender_id', currentUser.id)
      .eq('receiver_id', selectedUser.id);

    let recvQuery = supabase
      .from('messages')
      .select('*')
      .eq('sender_id', selectedUser.id)
      .eq('receiver_id', currentUser.id);

    // Filter pesan setelah deleted_at
    if (deletedAt) {
      sentQuery = sentQuery.gt('created_at', deletedAt);
      recvQuery = recvQuery.gt('created_at', deletedAt);
    }

    const { data: sent } = await sentQuery;
    const { data: received } = await recvQuery;

    const all = [...(sent || []), ...(received || [])];
    all.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    setMessages(all);

    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', selectedUser.id)
      .eq('receiver_id', currentUser.id)
      .eq('is_read', false);
  }, [selectedUser, currentUser.id, deletedConvos]);

  useEffect(() => {
    if (selectedUser) {
      isInitialLoadRef.current = true;
      prevMessageCountRef.current = 0;
      isNearBottomRef.current = true;
    }
  }, [selectedUser]);

  useEffect(() => {
    fetchContacts();
    const contactInterval = setInterval(fetchContacts, 5000);
    return () => clearInterval(contactInterval);
  }, [fetchContacts]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    const currentCount = messages.length;

    if (currentCount === 0) {
      prevMessageCountRef.current = 0;
      return;
    }

    const hasNewMessages = currentCount > prevCount;
    const lastMessage = messages[messages.length - 1];
    const isMyLastMessage = lastMessage?.sender_id === currentUser.id;

    if (isInitialLoadRef.current && currentCount > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      isInitialLoadRef.current = false;
    } else if (hasNewMessages && isMyLastMessage) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (hasNewMessages && isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }

    prevMessageCountRef.current = currentCount;
  }, [messages, currentUser.id]);

  const handleSend = async () => {
    if ((!newMsg.trim() && !imgFile) || !selectedUser) return;
    setSending(true);
    isNearBottomRef.current = true;

    let imageUrl = '';
    if (imgFile) {
      const ext = imgFile.name.split('.').pop();
      const name = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('messages').upload(name, imgFile);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('messages').getPublicUrl(name);
        imageUrl = urlData.publicUrl;
      }
    }

    await supabase.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: selectedUser.id,
      content: newMsg.trim(),
      image_url: imageUrl,
    });

    setNewMsg('');
    setImgFile(null);
    setImgPreview(null);
    setSending(false);
    await fetchMessages();
    await fetchContacts();
  };

  const handleImgSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImgFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImgPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const filteredContacts = contacts.filter((u) =>
    u.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Chat view
  if (selectedUser) {
    return (
      <div className="fixed inset-0 flex flex-col bg-white md:left-56 lg:left-64">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white z-10 shadow-sm flex-shrink-0">
          <button
            onClick={() => { setSelectedUser(null); onClearTarget?.(); }}
            className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0 ring-2 ring-white shadow">
            {selectedUser.avatar_url ? (
              <img src={selectedUser.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              selectedUser.display_name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate leading-tight">{selectedUser.display_name}</p>
            <p className="text-xs text-gray-400 leading-tight">@{selectedUser.username}</p>
          </div>
        </div>

        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
          style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)' }}
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                <svg className="h-8 w-8 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500">Belum ada pesan</p>
              <p className="text-xs text-gray-400 mt-1">Mulai percakapan dengan {selectedUser.display_name}</p>
            </div>
          )}
          {messages.map((msg, idx) => {
            const isMine = msg.sender_id === currentUser.id;
            const showTime = idx === 0 ||
              new Date(msg.created_at).getTime() - new Date(messages[idx - 1].created_at).getTime() > 300000;

            return (
              <div key={msg.id}>
                {showTime && (
                  <div className="flex justify-center my-3">
                    <span className="text-[10px] text-gray-400 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
                      {timeAgo(msg.created_at)}
                    </span>
                  </div>
                )}
                <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[72%] px-3.5 py-2.5 shadow-sm ${
                      isMine
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-br-lg'
                        : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-bl-lg'
                    }`}
                  >
                    {msg.image_url && (
                      <img
                        src={msg.image_url}
                        alt=""
                        className="rounded-xl mb-2 max-h-52 object-cover w-full cursor-pointer hover:opacity-90 transition"
                        onClick={() => window.open(msg.image_url, '_blank')}
                      />
                    )}
                    {msg.content && (
                      <p className="text-[13px] leading-relaxed break-words whitespace-pre-wrap">{msg.content}</p>
                    )}
                    <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <span className={`text-[10px] ${isMine ? 'text-blue-200' : 'text-gray-400'}`}>
                        {timeAgo(msg.created_at)}
                      </span>
                      {isMine && msg.is_read && (
                        <svg className="h-3 w-3 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {imgPreview && (
          <div className="bg-white px-4 py-3 border-t border-gray-100 flex-shrink-0">
            <div className="relative inline-block">
              <img src={imgPreview} alt="" className="h-24 rounded-xl object-cover shadow-sm" />
              <button
                onClick={() => { setImgFile(null); setImgPreview(null); }}
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs shadow-lg hover:bg-red-600 transition"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="bg-white border-t border-gray-200 px-3 py-3 flex-shrink-0 mb-[env(safe-area-inset-bottom,0px)] md:mb-0"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <div className="pb-14 md:pb-0">
            <div className="flex items-end gap-2">
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImgSelect} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center h-10 w-10 rounded-full text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors flex-shrink-0 mb-0.5"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Tulis pesan..."
                  className="w-full rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 pr-4 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
                />
              </div>
              <button
                onClick={handleSend}
                disabled={sending || (!newMsg.trim() && !imgFile)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 shadow-sm mb-0.5 active:scale-95"
              >
                {sending ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <svg className="h-4 w-4 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Contacts list
  return (
    <div className="min-h-screen bg-gray-50">
      {/* === DELETE POPUP WITH BLUR === */}
      {showDeletePopup && longPressUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          onClick={() => { setShowDeletePopup(false); setLongPressUser(null); }}
        >
          <div
            className="absolute inset-0 bg-black/40 transition-opacity"
            style={{ animation: 'fadeIn 0.2s ease-out' }}
          />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            style={{ animation: 'popIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header dengan info user */}
            <div className="px-5 pt-5 pb-4 text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg overflow-hidden ring-4 ring-white shadow-lg mb-3">
                {longPressUser.avatar_url ? (
                  <img src={longPressUser.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  longPressUser.display_name.charAt(0).toUpperCase()
                )}
              </div>
              <h3 className="text-base font-bold text-gray-900">{longPressUser.display_name}</h3>
              <p className="text-xs text-gray-400 mt-0.5">@{longPressUser.username}</p>
            </div>

            {/* Divider */}
            <div className="h-px bg-gray-100" />

            {/* Opsi Hapus */}
            <button
              onClick={handleDeleteConversation}
              disabled={deleting}
              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-red-50 active:bg-red-100 transition-colors text-left group"
            >
              <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 group-hover:bg-red-200 transition-colors">
                <svg className="h-4.5 w-4.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-600">Hapus percakapan</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Pesan dihapus hanya dari akunmu</p>
              </div>
              {deleting && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent flex-shrink-0" />
              )}
            </button>

            {/* Divider */}
            <div className="h-px bg-gray-100" />

            {/* Tombol Batal */}
            <button
              onClick={() => { setShowDeletePopup(false); setLongPressUser(null); }}
              className="w-full px-5 py-3.5 text-center hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <span className="text-sm font-medium text-gray-500">Batal</span>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.9) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      <div className="bg-white px-4 pt-4 pb-3 border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-900">Pesan</h1>
        <p className="text-xs text-gray-400 mt-0.5">Semua percakapan kamu</p>
        <div className="mt-3 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kontak..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-xs text-gray-400 mt-3">Memuat kontak...</p>
        </div>
      ) : filteredContacts.length === 0 && contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-purple-50">
            <svg className="h-10 w-10 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-gray-700">Belum ada percakapan</p>
          <p className="mt-1.5 text-sm text-gray-400 max-w-[240px]">Pesan dari siapapun akan muncul di sini</p>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-gray-400">Tidak ada kontak ditemukan</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50 pb-20 md:pb-0">
          {filteredContacts.map((user) => (
            <button
              key={user.id}
              onClick={() => {
                // Jangan buka chat jika long press baru saja terjadi
                if (longPressTriggeredRef.current) {
                  longPressTriggeredRef.current = false;
                  return;
                }
                setSelectedUser(user);
              }}
              onMouseDown={() => handleLongPressStart(user)}
              onMouseUp={handleLongPressEnd}
              onMouseLeave={handleLongPressEnd}
              onTouchStart={() => handleLongPressStart(user)}
              onTouchEnd={handleLongPressEnd}
              onTouchMove={handleLongPressMove}
              onContextMenu={(e) => e.preventDefault()}
              className="flex w-full items-center gap-3 bg-white px-4 py-3.5 hover:bg-blue-50/40 active:bg-blue-50 transition-colors text-left group select-none"
            >
              <div className="relative flex-shrink-0">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden ring-2 ring-white shadow-sm">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    user.display_name.charAt(0).toUpperCase()
                  )}
                </div>
                {(user.unread || 0) > 0 && (
                  <div className="absolute -top-0.5 -right-0.5 h-5 min-w-[20px] px-1 rounded-full bg-red-500 flex items-center justify-center shadow-sm">
                    <span className="text-[10px] text-white font-bold">{user.unread}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm truncate leading-tight ${(user.unread || 0) > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
                    {user.display_name}
                  </p>
                  {user.lastTime && (
                    <span className={`text-[10px] flex-shrink-0 ${(user.unread || 0) > 0 ? 'text-blue-500 font-medium' : 'text-gray-400'}`}>
                      {timeAgo(user.lastTime)}
                    </span>
                  )}
                </div>
                <p className={`text-xs truncate mt-0.5 leading-tight ${(user.unread || 0) > 0 ? 'text-gray-600 font-medium' : 'text-gray-400'}`}>
                  {user.lastMessage || 'Belum ada pesan'}
                </p>
              </div>
              <svg className="h-4 w-4 text-gray-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
