import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '../lib/supabase';

type Props = {
  currentUser: User;
  onViewProfile: (user: User) => void;
};

export function SearchPage({ currentUser, onViewProfile }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followerIds, setFollowerIds] = useState<Set<string>>(new Set());
  const [followLoading, setFollowLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'following' | 'followers'>('all');

  const fetchFollowing = useCallback(async () => {
    const { data } = await supabase
      .from('followers')
      .select('following_id')
      .eq('follower_id', currentUser.id);
    if (data) {
      setFollowingIds(new Set(data.map((f: { following_id: string }) => f.following_id)));
    }
  }, [currentUser.id]);

  const fetchFollowers = useCallback(async () => {
    const { data } = await supabase
      .from('followers')
      .select('follower_id')
      .eq('following_id', currentUser.id);
    if (data) {
      setFollowerIds(new Set(data.map((f: { follower_id: string }) => f.follower_id)));
    }
  }, [currentUser.id]);

  const fetchSuggested = useCallback(async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .neq('id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setSuggestedUsers(data);
  }, [currentUser.id]);

  useEffect(() => {
    fetchFollowing();
    fetchFollowers();
    fetchSuggested();
  }, [fetchFollowing, fetchFollowers, fetchSuggested]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length === 0) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      const searchTerm = query.trim().toLowerCase();
      const { data } = await supabase
        .from('users')
        .select('*')
        .or(`username.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%`)
        .neq('id', currentUser.id)
        .limit(30);
      setResults(data || []);
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, currentUser.id]);

  const handleFollow = async (userId: string) => {
    setFollowLoading(userId);
    try {
      if (followingIds.has(userId)) {
        await supabase
          .from('followers')
          .delete()
          .match({ follower_id: currentUser.id, following_id: userId });
      } else {
        await supabase
          .from('followers')
          .insert({ follower_id: currentUser.id, following_id: userId });
      }
      await fetchFollowing();
      await fetchFollowers();
    } catch (err) {
      console.error('Follow error:', err);
    }
    setFollowLoading(null);
  };

  // Build display list based on active tab
  const getDisplayList = useCallback((): User[] => {
    const baseList = query.trim() ? results : suggestedUsers;

    if (activeTab === 'following') {
      return baseList.filter((u) => followingIds.has(u.id));
    }
    if (activeTab === 'followers') {
      return baseList.filter((u) => followerIds.has(u.id));
    }
    return baseList;
  }, [query, results, suggestedUsers, activeTab, followingIds, followerIds]);

  const displayList = getDisplayList();

  // Fetch follower/following users that might not be in suggestedUsers
  const [followingUsers, setFollowingUsers] = useState<User[]>([]);
  const [followerUsers, setFollowerUsers] = useState<User[]>([]);

  const fetchFollowingUsers = useCallback(async () => {
    if (followingIds.size === 0) {
      setFollowingUsers([]);
      return;
    }
    const { data } = await supabase
      .from('users')
      .select('*')
      .in('id', Array.from(followingIds));
    if (data) setFollowingUsers(data);
  }, [followingIds]);

  const fetchFollowerUsers = useCallback(async () => {
    if (followerIds.size === 0) {
      setFollowerUsers([]);
      return;
    }
    const { data } = await supabase
      .from('users')
      .select('*')
      .in('id', Array.from(followerIds));
    if (data) setFollowerUsers(data);
  }, [followerIds]);

  useEffect(() => {
    fetchFollowingUsers();
    fetchFollowerUsers();
  }, [fetchFollowingUsers, fetchFollowerUsers]);

  // Final display list with proper data for tabs
  const getFinalList = useCallback((): User[] => {
    if (query.trim()) {
      const baseList = results;
      if (activeTab === 'following') return baseList.filter((u) => followingIds.has(u.id));
      if (activeTab === 'followers') return baseList.filter((u) => followerIds.has(u.id));
      return baseList;
    }

    if (activeTab === 'following') return followingUsers;
    if (activeTab === 'followers') return followerUsers;
    return suggestedUsers;
  }, [query, results, suggestedUsers, activeTab, followingIds, followerIds, followingUsers, followerUsers]);

  const finalList = getFinalList();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3 border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-900">Pencarian</h1>
        <p className="text-xs text-gray-400 mt-0.5">Temukan & ikuti pengguna lain</p>

        {/* Search input */}
        <div className="relative mt-3">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari username atau nama..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-10 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-300 text-white hover:bg-gray-400 transition"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'all'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setActiveTab('following')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'following'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Diikuti ({followingIds.size})
          </button>
          <button
            onClick={() => setActiveTab('followers')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'followers'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Pengikut ({followerIds.size})
          </button>
        </div>
      </div>

      {/* Section label */}
      <div className="px-4 py-3 flex items-center gap-2">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
          {query.trim()
            ? `Hasil untuk "${query}"`
            : activeTab === 'following'
            ? 'Pengguna yang kamu ikuti'
            : activeTab === 'followers'
            ? 'Pengguna yang mengikutimu'
            : 'Disarankan untukmu'}
        </span>
        {searching && (
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        )}
        {!searching && query.trim() && (
          <span className="text-[11px] text-gray-400">· {finalList.length} hasil</span>
        )}
      </div>

      {/* Results */}
      {finalList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-purple-50">
            {activeTab === 'followers' ? (
              <svg className="h-10 w-10 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : activeTab === 'following' ? (
              <svg className="h-10 w-10 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ) : (
              <svg className="h-10 w-10 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>
          <p className="text-base font-semibold text-gray-700">
            {query.trim()
              ? 'Tidak ada pengguna ditemukan'
              : activeTab === 'following'
              ? 'Belum mengikuti siapa pun'
              : activeTab === 'followers'
              ? 'Belum ada pengikut'
              : 'Belum ada pengguna lain'}
          </p>
          <p className="mt-1.5 text-sm text-gray-400 max-w-[260px]">
            {query.trim()
              ? 'Coba kata kunci yang berbeda'
              : activeTab === 'following'
              ? 'Ikuti pengguna lain untuk melihat mereka di sini'
              : activeTab === 'followers'
              ? 'Bagikan profilmu agar orang lain bisa mengikutimu'
              : 'Ajak teman untuk bergabung!'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {finalList.map((user) => {
            const isFollowing = followingIds.has(user.id);
            const isFollower = followerIds.has(user.id);
            return (
              <div
                key={user.id}
                className="flex items-center gap-3 bg-white px-4 py-3 hover:bg-blue-50/30 active:bg-blue-50 transition-colors"
              >
                <button
                  onClick={() => onViewProfile(user)}
                  className="flex flex-1 items-center gap-3 text-left min-w-0"
                >
                  <div className="relative flex-shrink-0">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden ring-2 ring-white shadow-sm">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        user.display_name.charAt(0).toUpperCase()
                      )}
                    </div>
                    {isFollowing && (
                      <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center">
                        <svg className="h-2 w-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-gray-900 truncate">{user.display_name}</p>
                      {isFollower && !isFollowing && (
                        <span className="text-[9px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                          Mengikutimu
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">@{user.username}</p>
                    {user.bio && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate leading-tight">{user.bio}</p>
                    )}
                    {/* Mutual indicator */}
                    {isFollowing && isFollower && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <svg className="h-3 w-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        <span className="text-[10px] text-emerald-500 font-medium">Saling mengikuti</span>
                      </div>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => handleFollow(user.id)}
                  disabled={followLoading === user.id}
                  className={`flex-shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-all active:scale-95 ${
                    isFollowing
                      ? 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500 border border-gray-200'
                      : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-sm'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {followLoading === user.id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : isFollowing ? (
                    <span className="flex items-center gap-1">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Mengikuti
                    </span>
                  ) : isFollower ? (
                    <span className="flex items-center gap-1">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Ikuti Balik
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Ikuti
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}