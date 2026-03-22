// components/Sidebar.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import type { User } from '../lib/supabase';

type NavItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
  badge?: number;
};

type Props = {
  currentUser: User;
  activePage: string;
  onNavigate: (page: string) => void;
  unreadNotifications: number;
  unreadMessages: number;
  onClearNotificationBadge?: () => void;
};

// Hook untuk menyimpan dan memulihkan posisi scroll
const scrollPositions = new Map<string, number>();

export function useScrollPreservation(pageKey: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isRestoringRef = useRef(false);

  // Simpan posisi scroll saat ini
  const saveScrollPosition = useCallback(() => {
    if (containerRef.current) {
      scrollPositions.set(pageKey, containerRef.current.scrollTop);
    }
  }, [pageKey]);

  // Pulihkan posisi scroll
  const restoreScrollPosition = useCallback(() => {
    const saved = scrollPositions.get(pageKey);
    if (containerRef.current && saved !== undefined) {
      isRestoringRef.current = true;
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = saved;
        }
        isRestoringRef.current = false;
      });
    }
  }, [pageKey]);

  // Simpan scroll saat user scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (!isRestoringRef.current) {
        scrollPositions.set(pageKey, container.scrollTop);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [pageKey]);

  // Restore saat mount
  useEffect(() => {
    restoreScrollPosition();
  }, [restoreScrollPosition]);

  // Save saat unmount
  useEffect(() => {
    return () => {
      saveScrollPosition();
    };
  }, [saveScrollPosition]);

  return { containerRef, saveScrollPosition, restoreScrollPosition };
}

export function Sidebar({
  currentUser,
  activePage,
  onNavigate,
  unreadNotifications,
  unreadMessages,
  onClearNotificationBadge,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hover handlers dengan delay untuk UX yang smooth
  const handleMouseEnter = useCallback(() => {
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsExpanded(true);
    }, 150);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (!isPinned) {
      collapseTimeoutRef.current = setTimeout(() => {
        setIsExpanded(false);
      }, 300);
    }
  }, [isPinned]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
    };
  }, []);

  const handleNavigate = (page: string) => {
    // Simpan scroll position halaman saat ini sebelum pindah
    const event = new CustomEvent('save-scroll-position', { detail: activePage });
    window.dispatchEvent(event);

    if (page === 'notifications' && onClearNotificationBadge) {
      onClearNotificationBadge();
    }

    onNavigate(page);

    if (!isPinned) {
      setIsExpanded(false);
    }
  };

  const navItems: NavItem[] = [
    {
      key: 'home',
      label: 'Beranda',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      activeIcon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 01-.53 1.28h-1.44v7.44a.75.75 0 01-.75.75h-3a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-2.5a.75.75 0 00-.75.75v4.5a.75.75 0 01-.75.75h-3a.75.75 0 01-.75-.75v-7.44H5.31a.75.75 0 01-.53-1.28l8.69-8.69z" />
        </svg>
      ),
    },
    {
      key: 'search',
      label: 'Pencarian',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      ),
      activeIcon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      ),
    },
    {
      key: 'notifications',
      label: 'Notifikasi',
      badge: unreadNotifications,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
      ),
      activeIcon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
        </svg>
      ),
    },
    {
      key: 'messages',
      label: 'Pesan',
      badge: unreadMessages,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      activeIcon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97zM6.75 8.25a.75.75 0 01.75-.75h9a.75.75 0 010 1.5h-9a.75.75 0 01-.75-.75zm.75 3.75a.75.75 0 000 1.5H12a.75.75 0 000-1.5H7.5z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      key: 'create',
      label: 'Buat Postingan',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      activeIcon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 9a.75.75 0 00-1.5 0v2.25H9a.75.75 0 000 1.5h2.25V15a.75.75 0 001.5 0v-2.25H15a.75.75 0 000-1.5h-2.25V9z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      key: 'explore',
      label: 'Jelajahi',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
        </svg>
      ),
      activeIcon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21.721 12.752a9.711 9.711 0 00-.945-5.003 12.754 12.754 0 01-4.339 2.708 18.991 18.991 0 01-.214 4.772 17.165 17.165 0 005.498-2.477zM14.634 15.55a17.324 17.324 0 00.332-4.647c-.952.227-1.945.347-2.966.347-1.021 0-2.014-.12-2.966-.347a17.515 17.515 0 00.332 4.647 17.385 17.385 0 005.268 0zM9.772 17.119a18.963 18.963 0 004.456 0A17.182 17.182 0 0112 21.724a17.18 17.18 0 01-2.228-4.605zM7.777 15.23a18.87 18.87 0 01-.214-4.774 12.753 12.753 0 01-4.34-2.708 9.711 9.711 0 00-.944 5.004 17.165 17.165 0 005.498 2.477zM21.356 14.752a9.765 9.765 0 01-7.478 6.817 18.64 18.64 0 001.988-4.718 18.627 18.627 0 005.49-2.098zM2.644 14.752c1.682.971 3.53 1.688 5.49 2.099a18.64 18.64 0 001.988 4.718 9.765 9.765 0 01-7.478-6.816zM13.878 2.43a9.755 9.755 0 016.116 3.986 11.267 11.267 0 01-3.746 2.504 18.63 18.63 0 00-2.37-6.49zM12 2.276a17.152 17.152 0 012.805 7.121c-.897.23-1.837.353-2.805.353-.968 0-1.908-.122-2.805-.353A17.151 17.151 0 0112 2.276zM10.122 2.43a18.629 18.629 0 00-2.37 6.49 11.266 11.266 0 01-3.746-2.504 9.754 9.754 0 016.116-3.985z" />
        </svg>
      ),
    },
  ];

  const isActive = (key: string) => activePage === key;

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 h-full z-40">
        <div
          ref={sidebarRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={`h-full flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            isExpanded ? 'w-64' : 'w-[72px]'
          }`}
          style={{
            background: isExpanded
              ? 'rgba(255, 255, 255, 0.85)'
              : 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderRight: '1px solid rgba(0, 0, 0, 0.06)',
          }}
        >
          {/* Logo Area */}
          <div className="flex items-center h-16 px-4 flex-shrink-0">
            <div className={`flex items-center gap-3 transition-all duration-300 ${isExpanded ? 'px-1' : 'justify-center w-full'}`}>
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                </svg>
              </div>
              <span
                className={`text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent whitespace-nowrap transition-all duration-300 ${
                  isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 absolute pointer-events-none'
                }`}
              >
                SocialApp
              </span>
            </div>
          </div>

          {/* Pin Button - hanya muncul saat expanded */}
          <div className={`px-3 mb-2 transition-all duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none h-0 overflow-hidden'}`}>
            <button
              onClick={() => setIsPinned(!isPinned)}
              className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isPinned
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
              }`}
            >
              <svg
                className={`h-3.5 w-3.5 transition-transform duration-300 ${isPinned ? 'rotate-45' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              {isPinned ? 'Lepas pin' : 'Pin sidebar'}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => handleNavigate(item.key)}
                className={`group relative flex items-center w-full rounded-xl transition-all duration-200 ${
                  isExpanded ? 'px-3 py-2.5 gap-3' : 'justify-center p-3'
                } ${
                  isActive(item.key)
                    ? 'bg-gradient-to-r from-blue-50 to-purple-50 text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:bg-white/80 hover:text-gray-800 hover:shadow-sm'
                }`}
              >
                {/* Icon */}
                <div className="relative flex-shrink-0">
                  <div className={`transition-transform duration-200 ${isActive(item.key) ? 'scale-110' : 'group-hover:scale-105'}`}>
                    {isActive(item.key) ? item.activeIcon : item.icon}
                  </div>

                  {/* Badge on icon */}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-lg shadow-red-500/30 ring-2 ring-white animate-pulse">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>

                {/* Label */}
                <span
                  className={`text-sm font-semibold whitespace-nowrap transition-all duration-300 ${
                    isExpanded
                      ? 'opacity-100 translate-x-0'
                      : 'opacity-0 -translate-x-4 absolute pointer-events-none w-0 overflow-hidden'
                  }`}
                >
                  {item.label}
                </span>

                {/* Badge di samping label */}
                {isExpanded && item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}

                {/* Tooltip saat collapsed */}
                {!isExpanded && (
                  <div className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-xl z-50">
                    {item.label}
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold">
                        {item.badge}
                      </span>
                    )}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-900" />
                  </div>
                )}
              </button>
            ))}
          </nav>

          {/* Divider */}
          <div className="mx-4 my-2 h-px bg-black/5" />

          {/* User Profile */}
          <div className="px-3 pb-4 flex-shrink-0">
            <button
              onClick={() => handleNavigate('profile')}
              className={`group relative flex items-center w-full rounded-xl transition-all duration-200 ${
                isExpanded ? 'px-3 py-2.5 gap-3' : 'justify-center p-3'
              } ${
                isActive('profile')
                  ? 'bg-gradient-to-r from-blue-50 to-purple-50 shadow-sm'
                  : 'hover:bg-white/80 hover:shadow-sm'
              }`}
            >
              <div className={`relative flex-shrink-0 h-9 w-9 rounded-full overflow-hidden ring-2 transition-all duration-200 ${
                isActive('profile') ? 'ring-blue-400 ring-offset-2' : 'ring-transparent group-hover:ring-gray-200'
              }`}>
                <div className="h-full w-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                  {currentUser.avatar_url ? (
                    <img src={currentUser.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    currentUser.display_name?.charAt(0).toUpperCase() || '?'
                  )}
                </div>
              </div>

              <div
                className={`flex flex-col items-start min-w-0 transition-all duration-300 ${
                  isExpanded
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 -translate-x-4 absolute pointer-events-none w-0 overflow-hidden'
                }`}
              >
                <span className="text-sm font-bold text-gray-900 truncate max-w-[140px]">
                  {currentUser.display_name}
                </span>
                <span className="text-[11px] text-gray-400 truncate max-w-[140px]">
                  @{currentUser.username}
                </span>
              </div>

              {isExpanded && (
                <svg className="ml-auto h-4 w-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
              )}

              {/* Tooltip */}
              {!isExpanded && (
                <div className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-xl z-50">
                  {currentUser.display_name}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-900" />
                </div>
              )}
            </button>

            {/* Settings & Logout saat expanded */}
            <div className={`mt-1 space-y-0.5 transition-all duration-300 ${isExpanded ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0 overflow-hidden'}`}>
              <button
                onClick={() => handleNavigate('settings')}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-gray-500 hover:bg-white/80 hover:text-gray-800 transition-all duration-200"
              >
                <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm font-medium">Pengaturan</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40">
        <div
          className="flex items-center justify-around px-2 py-1"
          style={{
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderTop: '1px solid rgba(0, 0, 0, 0.06)',
          }}
        >
          {navItems.slice(0, 5).map((item) => (
            <button
              key={item.key}
              onClick={() => handleNavigate(item.key)}
              className={`relative flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all duration-200 ${
                isActive(item.key)
                  ? 'text-blue-600'
                  : 'text-gray-400 active:scale-90'
              }`}
            >
              <div className="relative">
                <div className={`transition-transform duration-200 ${isActive(item.key) ? 'scale-110' : ''}`}>
                  {isActive(item.key) ? item.activeIcon : item.icon}
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-lg shadow-red-500/30 ring-2 ring-white animate-pulse">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-semibold mt-0.5 ${isActive(item.key) ? 'text-blue-600' : 'text-gray-400'}`}>
                {item.label}
              </span>
              {isActive(item.key) && (
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-blue-500" />
              )}
            </button>
          ))}
        </div>

        {/* Safe area for iPhone */}
        <div
          className="h-safe-bottom"
          style={{
            background: 'rgba(255, 255, 255, 0.85)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        />
      </div>
    </>
  );
}
