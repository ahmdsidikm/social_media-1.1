import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Post, User } from '../lib/supabase';
import { PostCard } from './PostCard';

type NotificationItem = {
  id: string;
  type: 'like' | 'follow' | 'message';
  from_user: User;
  post_content?: string;
  message_content?: string;
  created_at: string;
};

type Props = {
  posts: Post[];
  currentUser: User;
  onLike: (postId: string) => void;
  onComment: (postId: string, content: string) => void;
  onDeletePost: (postId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onViewProfile: (user: User) => void;
  followingIds: string[];
};

export function HomePage({
  posts,
  currentUser,
  onLike,
  onComment,
  onDeletePost,
  onDeleteComment,
  onViewProfile,
  followingIds,
}: Props) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'like' | 'follow' | 'message'>('all');
  const panelRef = useRef<HTMLDivElement>(null);
  const lastSeenRef = useRef<string | null>(null);

  const filteredPosts = posts.filter(
    (p) => followingIds.includes(p.user_id) || p.user_id === currentUser.id
  );

  const getLastSeen = useCallback(() => {
    if (!lastSeenRef.current) {
      lastSeenRef.current = localStorage.getItem(`notif_last_seen_${currentUser.id}`);
    }
    return lastSeenRef.current;
  }, [currentUser.id]);

  const fetchNotifications = useCallback(async () => {
    if (!currentUser) return;
    setLoadingNotifs(true);

    try {
      const myPostIds = posts
        .filter((p) => p.user_id === currentUser.id)
        .map((p) => p.id);

      let likeNotifs: NotificationItem[] = [];
      if (myPostIds.length > 0) {
        const { data: likesData } = await supabase
          .from('likes')
          .select('*, users(*), posts(content, image_url)')
          .in('post_id', myPostIds)
          .neq('user_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (likesData) {
          likeNotifs = likesData.map((like: any) => ({
            id: `like-${like.id}`,
            type: 'like' as const,
            from_user: like.users,
            post_content: like.posts?.content || '',
            created_at: like.created_at,
          }));
        }
      }

      const { data: followersData } = await supabase
        .from('followers')
        .select('*, users!followers_follower_id_fkey(*)')
        .eq('following_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(50);

      let followNotifs: NotificationItem[] = [];
      if (followersData) {
        followNotifs = followersData.map((f: any) => ({
          id: `follow-${f.id}`,
          type: 'follow' as const,
          from_user: f.users,
          created_at: f.created_at,
        }));
      }

      const { data: messagesData } = await supabase
        .from('messages')
        .select('*, users!messages_sender_id_fkey(*)')
        .eq('receiver_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(50);

      let messageNotifs: NotificationItem[] = [];
      if (messagesData) {
        messageNotifs = messagesData.map((m: any) => ({
          id: `msg-${m.id}`,
          type: 'message' as const,
          from_user: m.users,
          message_content: m.content,
          created_at: m.created_at,
        }));
      }

      const allNotifs = [...likeNotifs, ...followNotifs, ...messageNotifs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(allNotifs);

      // Hitung unread berdasarkan last seen
      const lastSeen = getLastSeen();
      if (lastSeen) {
        const lastSeenTime = new Date(lastSeen).getTime();
        const unread = allNotifs.filter(
          (n) => new Date(n.created_at).getTime() > lastSeenTime
        ).length;
        setUnreadCount(unread);
      } else {
        setUnreadCount(allNotifs.length);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoadingNotifs(false);
    }
  }, [currentUser, posts, getLastSeen]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  // === FUNGSI UTAMA: Tekan love → badge langsung hilang ===
  const handleOpenNotifications = () => {
    const willOpen = !showNotifications;
    setShowNotifications(willOpen);

    if (willOpen) {
      // Simpan waktu sekarang sebagai "terakhir dilihat"
      const now = new Date().toISOString();
      localStorage.setItem(`notif_last_seen_${currentUser.id}`, now);
      lastSeenRef.current = now;
      // Langsung set 0, tidak akan muncul lagi sampai ada notif baru
      setUnreadCount(0);
    }
  };

  const timeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'baru saja';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}j`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}h`;
    return `${Math.floor(diff / 604800)}mg`;
  };

  const filteredNotifications =
    activeTab === 'all'
      ? notifications
      : notifications.filter((n) => n.type === activeTab);

  const tabCounts = {
    all: notifications.length,
    like: notifications.filter((n) => n.type === 'like').length,
    follow: notifications.filter((n) => n.type === 'follow').length,
    message: notifications.filter((n) => n.type === 'message').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3 border-b border-gray-100 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Beranda</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Postingan dari yang kamu ikuti
            </p>
          </div>
          <div className="relative" ref={panelRef}>
            {/* Love Button */}
            <button
              onClick={handleOpenNotifications}
              className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 ${
                showNotifications
                  ? 'bg-red-50 scale-110'
                  : 'bg-gray-50 hover:bg-red-50 active:scale-95'
              }`}
            >
              {showNotifications ? (
                <svg
                  className="h-6 w-6 text-red-500 transition-all duration-300"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                </svg>
              ) : (
                <svg
                  className="h-6 w-6 text-gray-500 transition-all duration-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                  />
                </svg>
              )}

              {/* Badge — hilang saat ditekan */}
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-lg shadow-red-500/30 ring-2 ring-white animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Panel */}
            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
                  onClick={() => setShowNotifications(false)}
                />

                <div className="fixed inset-x-0 top-0 bottom-0 z-50 md:absolute md:inset-auto md:right-0 md:top-full md:mt-2 md:w-[420px] md:max-h-[80vh] md:rounded-2xl md:shadow-2xl md:border md:border-gray-200 bg-white flex flex-col overflow-hidden">
                  {/* Panel Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <svg className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                      </svg>
                      <h2 className="text-lg font-bold text-gray-900">Notifikasi</h2>
                      {notifications.length > 0 && (
                        <span className="text-xs text-gray-400 font-medium">
                          ({notifications.length})
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-gray-100 px-2 bg-white sticky top-[57px] z-10 flex-shrink-0">
                    {(
                      [
                        { key: 'all', label: 'Semua', icon: null },
                        {
                          key: 'like',
                          label: 'Suka',
                          icon: (
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                            </svg>
                          ),
                        },
                        {
                          key: 'follow',
                          label: 'Ikuti',
                          icon: (
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                          ),
                        },
                        {
                          key: 'message',
                          label: 'Pesan',
                          icon: (
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          ),
                        },
                      ] as {
                        key: 'all' | 'like' | 'follow' | 'message';
                        label: string;
                        icon: React.ReactNode;
                      }[]
                    ).map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-all ${
                          activeTab === tab.key
                            ? 'text-blue-600'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        {tab.icon}
                        {tab.label}
                        {tabCounts[tab.key] > 0 && (
                          <span
                            className={`ml-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
                              activeTab === tab.key
                                ? 'bg-blue-100 text-blue-600'
                                : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            {tabCounts[tab.key]}
                          </span>
                        )}
                        {activeTab === tab.key && (
                          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-blue-500" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Notification List */}
                  <div className="flex-1 overflow-y-auto overscroll-contain">
                    {loadingNotifs ? (
                      <div className="flex flex-col items-center justify-center py-16">
                        <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />
                        <p className="mt-3 text-xs text-gray-400">Memuat notifikasi...</p>
                      </div>
                    ) : filteredNotifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 px-6">
                        <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                          <svg className="h-8 w-8 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                        </div>
                        <p className="text-sm font-semibold text-gray-600">Belum ada notifikasi</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {activeTab === 'like' && 'Belum ada yang menyukai postinganmu'}
                          {activeTab === 'follow' && 'Belum ada yang mengikutimu'}
                          {activeTab === 'message' && 'Belum ada pesan masuk'}
                          {activeTab === 'all' && 'Notifikasi akan muncul di sini'}
                        </p>
                      </div>
                    ) : (
                      <div>
                        {filteredNotifications.map((notif, index) => {
                          // Cek apakah notifikasi ini "baru" (muncul setelah terakhir dilihat)
                          const savedLastSeen = localStorage.getItem(`notif_last_seen_${currentUser.id}`);
                          const isNew = savedLastSeen
                            ? new Date(notif.created_at).getTime() > new Date(savedLastSeen).getTime()
                            : false;

                          return (
                            <button
                              key={notif.id}
                              onClick={() => {
                                if (notif.from_user) {
                                  onViewProfile(notif.from_user);
                                  setShowNotifications(false);
                                }
                              }}
                              className={`flex w-full items-start gap-3 px-4 py-3 transition-all duration-200 hover:bg-gray-50 active:bg-gray-100 text-left ${
                                index !== filteredNotifications.length - 1
                                  ? 'border-b border-gray-50'
                                  : ''
                              } ${isNew ? 'bg-blue-50/40' : ''}`}
                            >
                              {/* Avatar */}
                              <div className="relative flex-shrink-0">
                                <div className="h-11 w-11 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                                  {notif.from_user?.avatar_url ? (
                                    <img src={notif.from_user.avatar_url} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    notif.from_user?.display_name?.charAt(0).toUpperCase() || '?'
                                  )}
                                </div>
                                <div
                                  className={`absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full flex items-center justify-center ring-2 ring-white ${
                                    notif.type === 'like'
                                      ? 'bg-red-500'
                                      : notif.type === 'follow'
                                      ? 'bg-blue-500'
                                      : 'bg-green-500'
                                  }`}
                                >
                                  {notif.type === 'like' && (
                                    <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                                    </svg>
                                  )}
                                  {notif.type === 'follow' && (
                                    <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                  )}
                                  {notif.type === 'message' && (
                                    <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01" />
                                    </svg>
                                  )}
                                </div>
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-800 leading-snug">
                                  <span className="font-bold">
                                    {notif.from_user?.display_name || 'Pengguna'}
                                  </span>{' '}
                                  {notif.type === 'like' && <span className="text-gray-600">menyukai postinganmu</span>}
                                  {notif.type === 'follow' && <span className="text-gray-600">mulai mengikutimu</span>}
                                  {notif.type === 'message' && <span className="text-gray-600">mengirim pesan</span>}
                                </p>

                                {notif.type === 'like' && notif.post_content && (
                                  <p className="text-xs text-gray-400 mt-1 truncate leading-relaxed bg-gray-50 rounded-lg px-2.5 py-1.5 border border-gray-100">
                                    &ldquo;{notif.post_content.length > 60
                                      ? notif.post_content.slice(0, 60) + '...'
                                      : notif.post_content}&rdquo;
                                  </p>
                                )}

                                {notif.type === 'message' && notif.message_content && (
                                  <p className="text-xs text-gray-400 mt-1 truncate leading-relaxed bg-green-50 rounded-lg px-2.5 py-1.5 border border-green-100">
                                    &ldquo;{notif.message_content.length > 60
                                      ? notif.message_content.slice(0, 60) + '...'
                                      : notif.message_content}&rdquo;
                                  </p>
                                )}

                                <p className="text-[11px] text-gray-300 mt-1.5 flex items-center gap-1">
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {timeAgo(notif.created_at)}
                                </p>
                              </div>

                              {isNew && (
                                <div className="flex-shrink-0 mt-1.5">
                                  <div className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-lg shadow-blue-500/40" />
                                </div>
                              )}
                            </button>
                          );
                        })}

                        <div className="flex flex-col items-center py-6 text-center border-t border-gray-50">
                          <div className="h-8 w-8 rounded-full bg-gray-50 flex items-center justify-center mb-2">
                            <svg className="h-4 w-4 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <p className="text-[11px] text-gray-300 font-medium">
                            Semua notifikasi ditampilkan
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stories-like following bar */}
      {followingIds.length > 0 && (
        <div className="bg-white border-b border-gray-100 px-4 py-3">
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 p-[2px]">
                <div className="h-full w-full rounded-full bg-white p-[2px]">
                  <div className="h-full w-full rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                    {currentUser.avatar_url ? (
                      <img src={currentUser.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      currentUser.display_name.charAt(0).toUpperCase()
                    )}
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-gray-500 font-medium truncate w-14 text-center">Kamu</span>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {filteredPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-purple-50">
            <svg className="h-12 w-12 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-800">Belum ada postingan</h3>
          <p className="mt-2 text-sm text-gray-400 max-w-[280px] leading-relaxed">
            Ikuti pengguna lain untuk melihat postingan mereka di beranda, atau buat postingan pertamamu!
          </p>
          <div className="mt-6 flex gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              Cari pengguna
            </div>
            <div className="text-gray-300">·</div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              Buat postingan
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="px-4 py-2.5 flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Terbaru</span>
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-[11px] text-gray-400">{filteredPosts.length} postingan</span>
          </div>

          <div className="divide-y divide-gray-100">
            {filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUser={currentUser}
                onLike={onLike}
                onComment={onComment}
                onDeletePost={onDeletePost}
                onDeleteComment={onDeleteComment}
                onViewProfile={onViewProfile}
              />
            ))}
          </div>

          <div className="flex flex-col items-center py-8 text-center">
            <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
              <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-xs text-gray-400 font-medium">Kamu sudah melihat semua postingan</p>
            <p className="text-[11px] text-gray-300 mt-0.5">Ikuti lebih banyak orang untuk konten baru</p>
          </div>
        </div>
      )}
    </div>
  );
}