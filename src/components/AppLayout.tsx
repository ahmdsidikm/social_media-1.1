// components/AppLayout.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar, useScrollPreservation } from './Sidebar';
import { HomePage } from './HomePage';
import type { Post, User } from '../lib/supabase';

type Props = {
  currentUser: User;
  posts: Post[];
  followingIds: string[];
  onLike: (postId: string) => void;
  onComment: (postId: string, content: string) => void;
  onDeletePost: (postId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onViewProfile: (user: User) => void;
  unreadNotifications: number;
  unreadMessages: number;
  onClearNotificationBadge: () => void;
};

// Komponen wrapper untuk setiap halaman dengan scroll preservation
function PageWrapper({
  pageKey,
  isActive,
  children,
}: {
  pageKey: string;
  isActive: boolean;
  children: (containerRef: React.RefObject<HTMLDivElement>) => React.ReactNode;
}) {
  const { containerRef } = useScrollPreservation(pageKey);

  return (
    <div
      className={`absolute inset-0 transition-opacity duration-200 ${
        isActive ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
      }`}
    >
      <div
        ref={containerRef}
        className="h-full overflow-y-auto overscroll-contain"
      >
        {children(containerRef)}
      </div>
    </div>
  );
}

export function AppLayout({
  currentUser,
  posts,
  followingIds,
  onLike,
  onComment,
  onDeletePost,
  onDeleteComment,
  onViewProfile,
  unreadNotifications,
  unreadMessages,
  onClearNotificationBadge,
}: Props) {
  const [activePage, setActivePage] = useState('home');
  const [localUnreadNotifs, setLocalUnreadNotifs] = useState(unreadNotifications);
  const [localUnreadMsgs, setLocalUnreadMsgs] = useState(unreadMessages);

  // Sync external unread counts
  useEffect(() => {
    setLocalUnreadNotifs(unreadNotifications);
  }, [unreadNotifications]);

  useEffect(() => {
    setLocalUnreadMsgs(unreadMessages);
  }, [unreadMessages]);

  const handleNavigate = useCallback((page: string) => {
    setActivePage(page);
  }, []);

  const handleClearNotificationBadge = useCallback(() => {
    setLocalUnreadNotifs(0);
    onClearNotificationBadge();
  }, [onClearNotificationBadge]);

  const handleClearMessageBadge = useCallback(() => {
    setLocalUnreadMsgs(0);
  }, []);

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        currentUser={currentUser}
        activePage={activePage}
        onNavigate={(page) => {
          // Clear badge saat navigasi ke halaman terkait
          if (page === 'notifications') {
            handleClearNotificationBadge();
          }
          if (page === 'messages') {
            handleClearMessageBadge();
          }
          handleNavigate(page);
        }}
        unreadNotifications={localUnreadNotifs}
        unreadMessages={localUnreadMsgs}
        onClearNotificationBadge={handleClearNotificationBadge}
      />

      {/* Main Content Area */}
      <main className="flex-1 relative lg:ml-[72px] pb-16 lg:pb-0">
        <div className="h-full max-w-2xl mx-auto relative">
          {/* Home Page */}
          <PageWrapper pageKey="home" isActive={activePage === 'home'}>
            {() => (
              <HomePage
                posts={posts}
                currentUser={currentUser}
                onLike={onLike}
                onComment={onComment}
                onDeletePost={onDeletePost}
                onDeleteComment={onDeleteComment}
                onViewProfile={onViewProfile}
                followingIds={followingIds}
              />
            )}
          </PageWrapper>

          {/* Search Page */}
          <PageWrapper pageKey="search" isActive={activePage === 'search'}>
            {() => (
              <div className="p-4">
                <h1 className="text-xl font-bold text-gray-900 mb-4">Pencarian</h1>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Cari pengguna, postingan..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                  />
                </div>
              </div>
            )}
          </PageWrapper>

          {/* Notifications Page */}
          <PageWrapper pageKey="notifications" isActive={activePage === 'notifications'}>
            {() => (
              <div className="p-4">
                <h1 className="text-xl font-bold text-gray-900 mb-4">Notifikasi</h1>
                <p className="text-gray-500 text-sm">Semua notifikasi akan muncul di sini.</p>
              </div>
            )}
          </PageWrapper>

          {/* Messages Page */}
          <PageWrapper pageKey="messages" isActive={activePage === 'messages'}>
            {() => (
              <div className="p-4">
                <h1 className="text-xl font-bold text-gray-900 mb-4">Pesan</h1>
                <p className="text-gray-500 text-sm">Belum ada pesan.</p>
              </div>
            )}
          </PageWrapper>

          {/* Create Post Page */}
          <PageWrapper pageKey="create" isActive={activePage === 'create'}>
            {() => (
              <div className="p-4">
                <h1 className="text-xl font-bold text-gray-900 mb-4">Buat Postingan</h1>
                <textarea
                  placeholder="Apa yang kamu pikirkan?"
                  className="w-full p-4 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all min-h-[120px] resize-none"
                />
              </div>
            )}
          </PageWrapper>

          {/* Explore Page */}
          <PageWrapper pageKey="explore" isActive={activePage === 'explore'}>
            {() => (
              <div className="p-4">
                <h1 className="text-xl font-bold text-gray-900 mb-4">Jelajahi</h1>
                <p className="text-gray-500 text-sm">Temukan konten menarik.</p>
              </div>
            )}
          </PageWrapper>

          {/* Profile Page */}
          <PageWrapper pageKey="profile" isActive={activePage === 'profile'}>
            {() => (
              <div className="p-4">
                <h1 className="text-xl font-bold text-gray-900 mb-4">Profil</h1>
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                    {currentUser.avatar_url ? (
                      <img src={currentUser.avatar_url} alt="" className="h-full w-full object-cover rounded-full" />
                    ) : (
                      currentUser.display_name?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900">{currentUser.display_name}</h2>
                    <p className="text-sm text-gray-500">@{currentUser.username}</p>
                  </div>
                </div>
              </div>
            )}
          </PageWrapper>
        </div>
      </main>
    </div>
  );
}
