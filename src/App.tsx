// App.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './lib/supabase';
import type { User, Post, Like } from './lib/supabase';
import { HomePage } from './components/HomePage';
import { ProfilePage } from './components/ProfilePage';
import { SearchPage } from './components/SearchPage';
import { MessagesPage } from './components/MessagesPage';
import { GroupsPage } from './components/GroupsPage';
import { LoginPage } from './components/LoginPage';

export type Page = 'home' | 'messages' | 'groups' | 'search' | 'profile';

// Helper: Extract storage path from Supabase public URL
const extractStoragePath = (url: string): { bucket: string; path: string } | null => {
  try {
    const storagePattern = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)/;
    const match = url.match(storagePattern);
    if (match) {
      return {
        bucket: match[1],
        path: decodeURIComponent(match[2]),
      };
    }

    const signedPattern = /\/storage\/v1\/object\/sign\/([^/]+)\/(.+)/;
    const signedMatch = url.match(signedPattern);
    if (signedMatch) {
      return {
        bucket: signedMatch[1],
        path: decodeURIComponent(signedMatch[2].split('?')[0]),
      };
    }

    return null;
  } catch {
    return null;
  }
};

// Helper: Delete file from Supabase Storage
const deleteFileFromStorage = async (fileUrl: string): Promise<boolean> => {
  const storageInfo = extractStoragePath(fileUrl);
  if (!storageInfo) {
    console.warn('Could not extract storage path from URL:', fileUrl);
    return false;
  }

  const { error } = await supabase.storage
    .from(storageInfo.bucket)
    .remove([storageInfo.path]);

  if (error) {
    console.error('Failed to delete file from storage:', error.message);
    return false;
  }

  console.log('Successfully deleted from storage:', storageInfo.path);
  return true;
};

// Helper: Delete multiple files from storage
const deleteFilesFromStorage = async (fileUrls: string[]): Promise<void> => {
  const bucketFiles: Record<string, string[]> = {};

  for (const url of fileUrls) {
    if (!url) continue;
    const storageInfo = extractStoragePath(url);
    if (storageInfo) {
      if (!bucketFiles[storageInfo.bucket]) {
        bucketFiles[storageInfo.bucket] = [];
      }
      bucketFiles[storageInfo.bucket].push(storageInfo.path);
    }
  }

  for (const [bucket, paths] of Object.entries(bucketFiles)) {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) {
      console.error(`Failed to delete files from bucket "${bucket}":`, error.message);
    } else {
      console.log(`Deleted ${paths.length} file(s) from bucket "${bucket}"`);
    }
  }
};

// ✅ Helper: Get/Set last time user opened groups page
const getGroupsLastRead = (userId: string): string => {
  const key = `sosmedku_groups_last_read_${userId}`;
  return localStorage.getItem(key) || new Date(0).toISOString();
};

const setGroupsLastRead = (userId: string): void => {
  const key = `sosmedku_groups_last_read_${userId}`;
  localStorage.setItem(key, new Date().toISOString());
};

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [chatTarget, setChatTarget] = useState<User | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadGroups, setUnreadGroups] = useState(0);
  const mainContentRef = useRef<HTMLElement>(null);
  // ✅ Ref untuk track apakah user sedang di halaman groups
  const isOnGroupsPageRef = useRef(false);

  useEffect(() => {
    const savedUserId = localStorage.getItem('sosmedku_user_id');
    if (savedUserId) {
      loadUser(savedUserId);
    } else {
      setLoading(false);
    }
  }, []);

  const loadUser = async (userId: string) => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) {
      setCurrentUser(data);
    } else {
      localStorage.removeItem('sosmedku_user_id');
    }
    setLoading(false);
  };

  const fetchFollowingIds = useCallback(async () => {
    if (!currentUser) return;
    const { data } = await supabase
      .from('followers')
      .select('following_id')
      .eq('follower_id', currentUser.id);
    if (data) {
      setFollowingIds(data.map((f: { following_id: string }) => f.following_id));
    }
  }, [currentUser]);

  const fetchPosts = useCallback(async () => {
    const { data: postsData } = await supabase
      .from('posts')
      .select('*, users(*)')
      .order('created_at', { ascending: false });

    if (postsData) {
      const postsWithDetails = await Promise.all(
        postsData.map(async (post: Post) => {
          const { data: likesData } = await supabase
            .from('likes')
            .select('*')
            .eq('post_id', post.id);

          const { data: commentsData } = await supabase
            .from('comments')
            .select('*, users(*)')
            .eq('post_id', post.id)
            .order('created_at', { ascending: true });

          return {
            ...post,
            likes: likesData || [],
            comments: commentsData || [],
          };
        })
      );
      setPosts(postsWithDetails);
    }
  }, []);

  const fetchUnreadMessages = useCallback(async () => {
    if (!currentUser) return;
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', currentUser.id)
      .eq('is_read', false);
    setUnreadMessages(count || 0);
  }, [currentUser]);

  // ✅ FIXED: Fetch unread groups berdasarkan last_read timestamp
  const fetchUnreadGroups = useCallback(async () => {
    if (!currentUser) return;

    // Jika user sedang di halaman groups, selalu 0 dan update last_read
    if (isOnGroupsPageRef.current) {
      setUnreadGroups(0);
      return;
    }

    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', currentUser.id);

    if (!memberships || memberships.length === 0) {
      setUnreadGroups(0);
      return;
    }

    const groupIds = memberships.map((m: { group_id: string }) => m.group_id);

    // ✅ Gunakan last_read dari localStorage, bukan 24 jam
    const lastRead = getGroupsLastRead(currentUser.id);

    const { count } = await supabase
      .from('group_messages')
      .select('*', { count: 'exact', head: true })
      .in('group_id', groupIds)
      .neq('user_id', currentUser.id)
      .gt('created_at', lastRead);

    setUnreadGroups(count || 0);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchPosts();
      fetchFollowingIds();
      fetchUnreadMessages();
      fetchUnreadGroups();
    }
  }, [currentUser, fetchPosts, fetchFollowingIds, fetchUnreadMessages, fetchUnreadGroups]);

  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(() => {
      fetchUnreadMessages();
      // ✅ Hanya fetch jika TIDAK di halaman groups
      if (!isOnGroupsPageRef.current) {
        fetchUnreadGroups();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [currentUser, fetchUnreadMessages, fetchUnreadGroups]);

  useEffect(() => {
    if (!currentUser) return;

    const messageChannel = supabase
      .channel('messages-notification')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${currentUser.id}`,
        },
        () => {
          fetchUnreadMessages();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${currentUser.id}`,
        },
        () => {
          fetchUnreadMessages();
        }
      )
      .subscribe();

    const groupChannel = supabase
      .channel('groups-notification')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
        },
        (payload) => {
          // ✅ Abaikan pesan dari diri sendiri
          if (payload.new && (payload.new as any).user_id === currentUser.id) {
            return;
          }

          // ✅ Jika sedang di halaman groups, update last_read dan tetap 0
          if (isOnGroupsPageRef.current) {
            setGroupsLastRead(currentUser.id);
            setUnreadGroups(0);
            return;
          }

          fetchUnreadGroups();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(groupChannel);
    };
  }, [currentUser, fetchUnreadMessages, fetchUnreadGroups]);

  // ✅ FIXED: Handle masuk/keluar halaman groups
  useEffect(() => {
    if (!currentUser) return;

    if (currentPage === 'messages') {
      setUnreadMessages(0);
    }

    if (currentPage === 'groups') {
      // Masuk halaman groups
      isOnGroupsPageRef.current = true;
      // Simpan waktu sekarang sebagai last_read
      setGroupsLastRead(currentUser.id);
      // Langsung set 0
      setUnreadGroups(0);
    } else {
      // Keluar dari halaman groups
      if (isOnGroupsPageRef.current) {
        // Update last_read saat keluar juga
        setGroupsLastRead(currentUser.id);
      }
      isOnGroupsPageRef.current = false;
    }
  }, [currentPage, currentUser]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    const scrollableElements = document.querySelectorAll('[data-scroll-container]');
    scrollableElements.forEach((el) => {
      el.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const handleNavClick = (page: Page) => {
    if (currentPage === page) {
      scrollToTop();
      if (page === 'profile') {
        setViewingUser(null);
      }
      if (page === 'messages') {
        setChatTarget(null);
      }
      // ✅ Klik grup lagi saat sudah di halaman grup = refresh last_read
      if (page === 'groups' && currentUser) {
        setGroupsLastRead(currentUser.id);
        setUnreadGroups(0);
      }
    } else {
      setCurrentPage(page);
      if (page === 'profile') setViewingUser(null);
      if (page !== 'messages') setChatTarget(null);
    }
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('sosmedku_user_id', user.id);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('sosmedku_user_id');
    setCurrentPage('home');
    setViewingUser(null);
    isOnGroupsPageRef.current = false;
  };

  const handleLike = async (postId: string) => {
    if (!currentUser) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const existingLike = post.likes?.find((l: Like) => l.user_id === currentUser.id);

    if (existingLike) {
      await supabase
        .from('likes')
        .delete()
        .match({ post_id: postId, user_id: currentUser.id });
    } else {
      await supabase
        .from('likes')
        .insert({ post_id: postId, user_id: currentUser.id });
    }
    await fetchPosts();
  };

  const handleComment = async (postId: string, content: string) => {
    if (!currentUser || !content.trim()) return;
    await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: currentUser.id, content: content.trim() });
    await fetchPosts();
  };

  const handleDeletePost = async (postId: string) => {
    const post = posts.find((p) => p.id === postId);

    if (post) {
      const imageUrlsToDelete: string[] = [];

      if (post.image_url) {
        if (Array.isArray(post.image_url)) {
          imageUrlsToDelete.push(...post.image_url.filter(Boolean));
        } else if (typeof post.image_url === 'string') {
          imageUrlsToDelete.push(post.image_url);
        }
      }

      if ((post as any).images && Array.isArray((post as any).images)) {
        imageUrlsToDelete.push(...(post as any).images.filter(Boolean));
      }

      if ((post as any).media_url) {
        if (Array.isArray((post as any).media_url)) {
          imageUrlsToDelete.push(...(post as any).media_url.filter(Boolean));
        } else if (typeof (post as any).media_url === 'string') {
          imageUrlsToDelete.push((post as any).media_url);
        }
      }

      if (imageUrlsToDelete.length > 0) {
        console.log(`Deleting ${imageUrlsToDelete.length} image(s) from storage...`);
        await deleteFilesFromStorage(imageUrlsToDelete);
      }

      const commentsWithImages = (post.comments || []).filter(
        (c: any) => c.image_url || c.media_url
      );
      if (commentsWithImages.length > 0) {
        const commentImageUrls = commentsWithImages
          .map((c: any) => c.image_url || c.media_url)
          .filter(Boolean);
        if (commentImageUrls.length > 0) {
          await deleteFilesFromStorage(commentImageUrls);
        }
      }
    }

    await supabase.from('posts').delete().eq('id', postId);
    await fetchPosts();
  };

  const handleDeleteComment = async (commentId: string) => {
    const { data: comment } = await supabase
      .from('comments')
      .select('*')
      .eq('id', commentId)
      .single();

    if (comment) {
      const commentImageUrl = comment.image_url || comment.media_url;
      if (commentImageUrl) {
        await deleteFileFromStorage(commentImageUrl);
      }
    }

    await supabase.from('comments').delete().eq('id', commentId);
    await fetchPosts();
  };

  const handleViewProfile = (user: User) => {
    setViewingUser(user);
    setCurrentPage('profile');
  };

  const handleNavigateMessages = (user: User) => {
    setChatTarget(user);
    setCurrentPage('messages');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-gray-500">Memuat...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const NotificationBadge = ({ count }: { count: number }) => {
    if (count <= 0) return null;
    return (
      <span className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-lg shadow-red-500/30 ring-2 ring-white">
        {count > 99 ? '99+' : count}
      </span>
    );
  };

  const navItemsBase: { page: Page; label: string; badge: number; icon: React.ReactNode }[] = [
    {
      page: 'home',
      label: 'Beranda',
      badge: 0,
      icon: (
        <svg className="h-6 w-6 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      page: 'messages',
      label: 'Pesan',
      badge: unreadMessages,
      icon: (
        <svg className="h-6 w-6 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      page: 'groups',
      label: 'Grup',
      badge: unreadGroups,
      icon: (
        <svg className="h-6 w-6 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      page: 'search',
      label: 'Cari',
      badge: 0,
      icon: (
        <svg className="h-6 w-6 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
  ];

  const profileNavItem = {
    page: 'profile' as Page,
    label: 'Profil',
    badge: 0,
    icon: (
      <svg className="h-6 w-6 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed bottom-0 left-0 right-0 z-50 md:top-0 md:right-auto md:h-screen md:w-56 lg:w-64 md:border-r md:border-gray-200 md:bg-white">
        {/* Glass effect - Mobile */}
        <div
          className="md:hidden border-t border-white/20 bg-white/60 backdrop-blur-2xl backdrop-saturate-150"
          style={{
            WebkitBackdropFilter: 'blur(40px) saturate(1.5)',
            backdropFilter: 'blur(40px) saturate(1.5)',
          }}
        >
          <nav className="flex justify-around px-2 py-1">
            {[...navItemsBase, profileNavItem].map((item) => (
              <button
                key={item.page}
                onClick={() => handleNavClick(item.page)}
                className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl text-[10px] font-medium transition-all duration-300 ${
                  currentPage === item.page
                    ? 'text-blue-600'
                    : 'text-gray-400 active:text-gray-600 active:scale-95'
                }`}
              >
                {currentPage === item.page && (
                  <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-1 w-6 rounded-full bg-blue-500 shadow-lg shadow-blue-500/40" />
                )}
                <span className={`relative transition-transform duration-300 ${currentPage === item.page ? 'scale-110' : ''}`}>
                  {item.icon}
                  <NotificationBadge count={item.badge} />
                </span>
                <span className={`transition-all duration-300 ${currentPage === item.page ? 'opacity-100' : 'opacity-70'}`}>
                  {item.label}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Desktop Sidebar */}
        <div className="hidden md:flex md:flex-col md:h-full">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-md flex-shrink-0">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">SosmedKu</span>
          </div>

          <nav className="flex flex-col gap-0.5 p-2 px-3 mt-1 flex-1">
            {navItemsBase.map((item) => (
              <button
                key={item.page}
                onClick={() => handleNavClick(item.page)}
                className={`relative flex flex-row items-center gap-3 py-2.5 px-3 rounded-xl text-sm font-medium transition-all w-full ${
                  currentPage === item.page
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="relative flex-shrink-0">
                  {item.icon}
                  <NotificationBadge count={item.badge} />
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="border-t border-gray-100">
            <button
              onClick={() => handleNavClick('profile')}
              className={`flex items-center gap-3 w-full px-4 py-3.5 transition-all duration-200 hover:bg-gray-50 ${
                currentPage === 'profile' ? 'bg-blue-50' : ''
              }`}
            >
              <div
                className={`relative h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden flex-shrink-0 ring-2 transition-all duration-200 ${
                  currentPage === 'profile'
                    ? 'ring-blue-500 ring-offset-2'
                    : 'ring-transparent hover:ring-gray-200'
                }`}
              >
                {currentUser.avatar_url ? (
                  <img src={currentUser.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white">
                    {currentUser.display_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p
                  className={`text-sm font-semibold truncate leading-tight ${
                    currentPage === 'profile' ? 'text-blue-700' : 'text-gray-800'
                  }`}
                >
                  {currentUser.display_name}
                </p>
                <p className="text-xs text-gray-400 truncate leading-tight">@{currentUser.username}</p>
              </div>
              <svg
                className={`h-4 w-4 flex-shrink-0 transition-colors ${
                  currentPage === 'profile' ? 'text-blue-500' : 'text-gray-300'
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main ref={mainContentRef} className="pb-20 md:pb-0 md:ml-56 lg:ml-64 min-h-screen">
        <div className="h-full w-full">
          {currentPage === 'home' && (
            <HomePage
              posts={posts}
              currentUser={currentUser}
              onLike={handleLike}
              onComment={handleComment}
              onDeletePost={handleDeletePost}
              onDeleteComment={handleDeleteComment}
              onViewProfile={handleViewProfile}
              followingIds={followingIds}
            />
          )}
          {currentPage === 'messages' && (
            <MessagesPage
              currentUser={currentUser}
              chatTarget={chatTarget}
              onClearTarget={() => setChatTarget(null)}
            />
          )}
          {currentPage === 'groups' && (
            <GroupsPage currentUser={currentUser} />
          )}
          {currentPage === 'search' && (
            <SearchPage
              currentUser={currentUser}
              onViewProfile={handleViewProfile}
            />
          )}
          {currentPage === 'profile' && (
            <ProfilePage
              currentUser={currentUser}
              posts={posts}
              onLogout={handleLogout}
              onUserUpdate={(user: User) => setCurrentUser(user)}
              onLike={handleLike}
              onComment={handleComment}
              onDeletePost={handleDeletePost}
              onDeleteComment={handleDeleteComment}
              viewingUser={viewingUser}
              onSetViewingUser={setViewingUser}
              onNavigateMessages={handleNavigateMessages}
              onRefreshPosts={() => {
                fetchPosts();
                fetchFollowingIds();
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}
