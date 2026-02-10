import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, timeAgo } from '../lib/supabase';
import type { User, Group, GroupMember, GroupMessage } from '../lib/supabase';

type Props = {
  currentUser: User;
};

export function GroupsPage({ currentUser }: Props) {
  const [groups, setGroups] = useState<(Group & { member_count: number })[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchUser, setSearchUser] = useState('');
  const [searchGroup, setSearchGroup] = useState('');
  const [sending, setSending] = useState(false);
  const msgEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef<number>(0);
  const isNearBottomRef = useRef<boolean>(true);
  const isInitialLoadRef = useRef<boolean>(true);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const threshold = 150;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    isNearBottomRef.current = distanceFromBottom <= threshold;
  }, []);

  const fetchGroups = useCallback(async () => {
    const { data: memberOf } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', currentUser.id);

    if (memberOf && memberOf.length > 0) {
      const gids = memberOf.map((m: { group_id: string }) => m.group_id);
      const { data } = await supabase
        .from('groups')
        .select('*')
        .in('id', gids)
        .order('created_at', { ascending: false });

      if (data) {
        const withCount = await Promise.all(
          data.map(async (g: Group) => {
            const { count } = await supabase
              .from('group_members')
              .select('*', { count: 'exact', head: true })
              .eq('group_id', g.id);
            return { ...g, member_count: count || 0 };
          })
        );
        setGroups(withCount);
      } else {
        setGroups([]);
      }
    } else {
      setGroups([]);
    }
    setLoading(false);
  }, [currentUser.id]);

  const fetchMessages = useCallback(async () => {
    if (!selectedGroup) return;
    const { data } = await supabase
      .from('group_messages')
      .select('*, users(*)')
      .eq('group_id', selectedGroup.id)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  }, [selectedGroup]);

  const fetchMembers = useCallback(async () => {
    if (!selectedGroup) return;
    const { data } = await supabase
      .from('group_members')
      .select('*, users(*)')
      .eq('group_id', selectedGroup.id);
    if (data) setMembers(data);
  }, [selectedGroup]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  // Reset scroll state when selecting a new group
  useEffect(() => {
    if (selectedGroup) {
      isInitialLoadRef.current = true;
      prevMessageCountRef.current = 0;
      isNearBottomRef.current = true;
      fetchMessages();
      fetchMembers();
    }
  }, [selectedGroup, fetchMessages, fetchMembers]);

  // Polling for new messages
  useEffect(() => {
    if (!selectedGroup) return;
    const interval = setInterval(() => {
      fetchMessages();
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedGroup, fetchMessages]);

  // Smart auto-scroll
  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    const currentCount = messages.length;

    if (currentCount === 0) {
      prevMessageCountRef.current = 0;
      return;
    }

    const hasNewMessages = currentCount > prevCount;
    const lastMessage = messages[messages.length - 1];
    const isMyLastMessage = lastMessage?.user_id === currentUser.id;

    if (isInitialLoadRef.current && currentCount > 0) {
      // Initial load — scroll immediately
      msgEndRef.current?.scrollIntoView({ behavior: 'auto' });
      isInitialLoadRef.current = false;
    } else if (hasNewMessages && isMyLastMessage) {
      // User just sent a message — always scroll down
      msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (hasNewMessages && isNearBottomRef.current) {
      // New message from others, user is near bottom
      msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    // If user scrolled up — do NOT scroll

    prevMessageCountRef.current = currentCount;
  }, [messages, currentUser.id]);

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('groups')
      .insert({
        name: groupName.trim(),
        description: groupDesc.trim(),
        creator_id: currentUser.id,
      })
      .select()
      .single();

    if (!error && data) {
      await supabase.from('group_members').insert({
        group_id: data.id,
        user_id: currentUser.id,
        role: 'admin',
      });
      setGroupName('');
      setGroupDesc('');
      setShowCreate(false);
      await fetchGroups();
    } else {
      alert('Gagal membuat grup: ' + (error?.message || 'Unknown error'));
    }
    setCreating(false);
  };

  const handleSend = async () => {
    if (!newMsg.trim() || !selectedGroup) return;
    setSending(true);
    isNearBottomRef.current = true;

    await supabase.from('group_messages').insert({
      group_id: selectedGroup.id,
      user_id: currentUser.id,
      content: newMsg.trim(),
    });
    setNewMsg('');
    setSending(false);
    await fetchMessages();
  };

  const handleAddMember = async (userId: string) => {
    if (!selectedGroup) return;
    const exists = members.find((m) => m.user_id === userId);
    if (exists) return;
    await supabase.from('group_members').insert({
      group_id: selectedGroup.id,
      user_id: userId,
      role: 'member',
    });
    await fetchMembers();
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedGroup || userId === selectedGroup.creator_id) return;
    await supabase
      .from('group_members')
      .delete()
      .match({ group_id: selectedGroup.id, user_id: userId });
    await fetchMembers();
  };

  const handleLeaveGroup = async () => {
    if (!selectedGroup || !confirm('Keluar dari grup ini?')) return;
    await supabase
      .from('group_members')
      .delete()
      .match({ group_id: selectedGroup.id, user_id: currentUser.id });
    setSelectedGroup(null);
    setShowMembers(false);
    await fetchGroups();
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup || !confirm('Hapus grup ini? Semua pesan akan hilang.')) return;
    await supabase.from('groups').delete().eq('id', selectedGroup.id);
    setSelectedGroup(null);
    setShowMembers(false);
    await fetchGroups();
  };

  const fetchAllUsers = useCallback(async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .neq('id', currentUser.id)
      .order('display_name');
    if (data) setAllUsers(data);
  }, [currentUser.id]);

  useEffect(() => {
    if (showAddMember) fetchAllUsers();
  }, [showAddMember, fetchAllUsers]);

  const filteredUsers = searchUser.trim()
    ? allUsers.filter((u) =>
        u.display_name.toLowerCase().includes(searchUser.toLowerCase()) ||
        u.username.toLowerCase().includes(searchUser.toLowerCase())
      )
    : allUsers;

  const filteredGroups = searchGroup.trim()
    ? groups.filter((g) =>
        g.name.toLowerCase().includes(searchGroup.toLowerCase())
      )
    : groups;

  const memberIds = members.map((m) => m.user_id);
  const isAdmin = selectedGroup?.creator_id === currentUser.id;

  const gradients = [
    'from-emerald-400 to-teal-500',
    'from-blue-400 to-indigo-500',
    'from-purple-400 to-pink-500',
    'from-orange-400 to-red-500',
    'from-cyan-400 to-blue-500',
    'from-rose-400 to-pink-500',
    'from-amber-400 to-orange-500',
    'from-violet-400 to-purple-500',
    'from-lime-400 to-green-500',
    'from-fuchsia-400 to-purple-600',
  ];

  const getGradient = (index: number) => gradients[index % gradients.length];

  // Group chat view - Full fixed layout
  if (selectedGroup) {
    return (
      <div className="fixed inset-0 flex flex-col bg-white md:left-56 lg:left-64">
        {/* Header - Fixed top */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white z-10 shadow-sm flex-shrink-0">
          <button
            onClick={() => { setSelectedGroup(null); setShowMembers(false); }}
            className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ring-2 ring-white shadow">
            {selectedGroup.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate leading-tight">{selectedGroup.name}</p>
            <p className="text-xs text-gray-400 leading-tight">{members.length} anggota</p>
          </div>
          <button
            onClick={() => setShowMembers(!showMembers)}
            className={`flex items-center justify-center h-8 w-8 rounded-full transition-colors ${showMembers ? 'bg-blue-50 text-blue-500' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'}`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </button>
        </div>

        {/* Members panel */}
        {showMembers && (
          <div className="bg-white border-b border-gray-200 overflow-hidden flex-shrink-0">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Anggota ({members.length})</p>
                {isAdmin && (
                  <button
                    onClick={() => setShowAddMember(true)}
                    className="flex items-center gap-1 text-xs text-blue-500 font-semibold hover:text-blue-600 transition-colors bg-blue-50 px-2.5 py-1 rounded-full"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Tambah
                  </button>
                )}
              </div>
              <div className="space-y-1 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5 py-1.5 px-2 rounded-xl hover:bg-gray-50 transition-colors group">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[11px] font-bold overflow-hidden flex-shrink-0 ring-1 ring-white">
                      {m.users?.avatar_url ? (
                        <img src={m.users.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (m.users?.display_name || 'U').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-gray-700 truncate block">
                        {m.users?.display_name}
                        {m.user_id === currentUser.id && (
                          <span className="text-gray-400 font-normal"> (kamu)</span>
                        )}
                      </span>
                    </div>
                    {m.role === 'admin' && (
                      <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-semibold border border-amber-100">
                        Admin
                      </span>
                    )}
                    {isAdmin && m.user_id !== currentUser.id && (
                      <button
                        onClick={() => handleRemoveMember(m.user_id)}
                        className="text-[10px] text-red-400 hover:text-red-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 px-2 py-0.5 rounded-full"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100">
                {!isAdmin && (
                  <button
                    onClick={handleLeaveGroup}
                    className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-semibold transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Keluar Grup
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={handleDeleteGroup}
                    className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-semibold transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Hapus Grup
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add member modal */}
        {showAddMember && (
          <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowAddMember(false)}>
            <div
              className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Tambah Anggota</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Pilih pengguna untuk ditambahkan</p>
                </div>
                <button
                  onClick={() => setShowAddMember(false)}
                  className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4">
                <div className="relative mb-3">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    placeholder="Cari pengguna..."
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
                  />
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {filteredUsers.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold overflow-hidden flex-shrink-0 ring-1 ring-white shadow-sm">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          u.display_name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{u.display_name}</p>
                        <p className="text-[11px] text-gray-400">@{u.username}</p>
                      </div>
                      {memberIds.includes(u.id) ? (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Anggota
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAddMember(u.id)}
                          className="text-xs bg-blue-500 text-white px-3.5 py-1.5 rounded-full hover:bg-blue-600 transition-colors font-semibold shadow-sm active:scale-95"
                        >
                          Tambah
                        </button>
                      )}
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <div className="flex flex-col items-center py-8 text-center">
                      <svg className="h-8 w-8 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <p className="text-sm text-gray-400">Tidak ada pengguna ditemukan</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Messages area - Scrollable middle */}
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
          style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)' }}
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                <svg className="h-8 w-8 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500">Belum ada pesan di grup ini</p>
              <p className="text-xs text-gray-400 mt-1">Mulai percakapan dengan anggota grup</p>
            </div>
          )}
          {messages.map((msg, idx) => {
            const isMine = msg.user_id === currentUser.id;
            const showTime = idx === 0 ||
              new Date(msg.created_at).getTime() - new Date(messages[idx - 1].created_at).getTime() > 300000;
            const showAvatar = !isMine && (idx === 0 || messages[idx - 1].user_id !== msg.user_id);

            return (
              <div key={msg.id}>
                {showTime && (
                  <div className="flex justify-center my-3">
                    <span className="text-[10px] text-gray-400 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
                      {timeAgo(msg.created_at)}
                    </span>
                  </div>
                )}
                <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} gap-2`}>
                  {!isMine && (
                    <div className="flex-shrink-0 mt-auto">
                      {showAvatar ? (
                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold overflow-hidden ring-1 ring-white">
                          {msg.users?.avatar_url ? (
                            <img src={msg.users.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            (msg.users?.display_name || 'U').charAt(0).toUpperCase()
                          )}
                        </div>
                      ) : (
                        <div className="w-7" />
                      )}
                    </div>
                  )}
                  <div className="max-w-[72%]">
                    {!isMine && showAvatar && (
                      <p className="text-[10px] text-gray-400 mb-1 ml-1 font-medium">{msg.users?.display_name}</p>
                    )}
                    <div
                      className={`px-3.5 py-2.5 shadow-sm ${
                        isMine
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-br-lg'
                          : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-bl-lg'
                      }`}
                    >
                      {msg.content && (
                        <p className="text-[13px] leading-relaxed break-words whitespace-pre-wrap">{msg.content}</p>
                      )}
                      <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <span className={`text-[10px] ${isMine ? 'text-blue-200' : 'text-gray-400'}`}>
                          {timeAgo(msg.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={msgEndRef} />
        </div>

        {/* Input area - Fixed bottom, above mobile sidebar */}
        <div className="bg-white border-t border-gray-200 px-3 py-3 flex-shrink-0"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <div className="pb-14 md:pb-0">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Tulis pesan..."
                  className="w-full rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
                />
              </div>
              <button
                onClick={handleSend}
                disabled={sending || !newMsg.trim()}
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

  // Group list view — GRID LAYOUT
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Grup</h1>
            <p className="text-xs text-gray-400 mt-0.5">Grup percakapan kamu</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-blue-600 hover:to-blue-700 transition-all active:scale-95"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Buat
          </button>
        </div>

        {groups.length > 0 && (
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchGroup}
              onChange={(e) => setSearchGroup(e.target.value)}
              placeholder="Cari grup..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
            />
          </div>
        )}
      </div>

      {/* Create group modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div
            className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">Buat Grup Baru</h3>
                <p className="text-xs text-gray-400 mt-0.5">Buat grup untuk mengobrol bersama</p>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex justify-center mb-2">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white shadow-lg">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wider">Nama Grup</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Masukkan nama grup"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wider">Deskripsi <span className="font-normal text-gray-400">(opsional)</span></label>
                <textarea
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="Tambahkan deskripsi grup"
                  rows={2}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
                />
              </div>
              <button
                onClick={handleCreateGroup}
                disabled={creating || !groupName.trim()}
                className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 py-3 text-sm font-bold text-white hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm active:scale-[0.98]"
              >
                {creating ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Membuat...
                  </div>
                ) : (
                  'Buat Grup'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-xs text-gray-400 mt-3">Memuat grup...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-50 to-teal-50">
            <svg className="h-10 w-10 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-gray-700">Belum ada grup</p>
          <p className="mt-1.5 text-sm text-gray-400 max-w-[240px]">Buat grup baru untuk mulai percakapan dengan teman-temanmu</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-5 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition-all active:scale-95"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Buat Grup Pertama
          </button>
        </div>
      ) : (
        <div className="p-4 pb-20 md:pb-4">
          {filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg className="h-10 w-10 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm text-gray-400">Tidak ada grup ditemukan</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredGroups.map((g, idx) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroup(g)}
                  className="group relative flex flex-col items-center bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-lg hover:border-gray-200 hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.97] overflow-hidden text-center"
                >
                  <div className={`absolute top-0 left-0 right-0 h-16 bg-gradient-to-br ${getGradient(idx)} opacity-10 rounded-t-2xl`} />
                  <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl ${getGradient(idx)} opacity-5 rounded-bl-full`} />

                  <div className={`relative h-14 w-14 rounded-2xl bg-gradient-to-br ${getGradient(idx)} flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-lg mb-3 ring-4 ring-white`}>
                    {g.name.charAt(0).toUpperCase()}
                    <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-400 border-[2.5px] border-white" />
                  </div>

                  <p className="text-sm font-bold text-gray-900 truncate w-full leading-tight mb-1">
                    {g.name}
                  </p>

                  {g.description && (
                    <p className="text-[11px] text-gray-400 truncate w-full mb-2 px-1 leading-tight">
                      {g.description}
                    </p>
                  )}

                  <div className="flex items-center gap-1 bg-gray-50 rounded-full px-2.5 py-1 mt-auto">
                    <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-[11px] font-semibold text-gray-500">
                      {g.member_count}
                    </span>
                  </div>

                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className={`h-6 w-6 rounded-full bg-gradient-to-br ${getGradient(idx)} flex items-center justify-center shadow-sm`}>
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
