import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase, timeAgo } from '../lib/supabase';
import type { Post, User, Story } from '../lib/supabase';
import { PostCard } from './PostCard';
import { ImageCropper } from './ImageCropper';
import { ImageLightbox } from './ImageLightbox';

type Props = {
  currentUser: User;
  posts: Post[];
  onLogout: () => void;
  onUserUpdate: (user: User) => void;
  onLike: (postId: string) => void;
  onComment: (postId: string, content: string) => void;
  onDeletePost: (postId: string) => void;
  onDeleteComment: (commentId: string) => void;
  viewingUser: User | null;
  onSetViewingUser: (user: User | null) => void;
  onNavigateMessages: (user: User) => void;
  onRefreshPosts: () => void;
};

export function ProfilePage({
  currentUser, posts, onLogout, onUserUpdate, onLike, onComment, onDeletePost, onDeleteComment,
  viewingUser, onSetViewingUser, onNavigateMessages, onRefreshPosts,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser.display_name);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'photos'>('posts');
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showFollowersPopup, setShowFollowersPopup] = useState(false);
  const [showFollowingPopup, setShowFollowingPopup] = useState(false);
  const [followersList, setFollowersList] = useState<User[]>([]);
  const [followingList, setFollowingList] = useState<User[]>([]);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postImgFile, setPostImgFile] = useState<File | null>(null);
  const [postImgPreview, setPostImgPreview] = useState<string | null>(null);
  const [postVideoFile, setPostVideoFile] = useState<File | null>(null);
  const [postVideoPreview, setPostVideoPreview] = useState<string | null>(null);
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [stories, setStories] = useState<Story[]>([]);
  const [coverUploading, setCoverUploading] = useState(false);
  const [selectedPhotoPost, setSelectedPhotoPost] = useState<Post | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const postFileRef = useRef<HTMLInputElement>(null);
  const postVideoRef = useRef<HTMLInputElement>(null);

  const displayUser = viewingUser || currentUser;
  const myPosts = posts.filter((p) => p.user_id === displayUser.id);
  const isOwnProfile = !viewingUser || viewingUser.id === currentUser.id;
  const photoPosts = myPosts.filter((p) => p.image_url && p.image_url.length > 0);

  const fetchFollowData = useCallback(async () => {
    const { count: fCount } = await supabase
      .from('followers')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', displayUser.id);
    setFollowerCount(fCount || 0);

    const { count: fgCount } = await supabase
      .from('followers')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', displayUser.id);
    setFollowingCount(fgCount || 0);

    if (!isOwnProfile) {
      const { data } = await supabase
        .from('followers')
        .select('id')
        .match({ follower_id: currentUser.id, following_id: displayUser.id });
      setIsFollowing(!!(data && data.length > 0));
    }
  }, [displayUser.id, currentUser.id, isOwnProfile]);

  const fetchFollowersList = useCallback(async () => {
    const { data } = await supabase.from('followers').select('follower_id').eq('following_id', displayUser.id);
    if (data && data.length > 0) {
      const ids = data.map((f: { follower_id: string }) => f.follower_id);
      const { data: users } = await supabase.from('users').select('*').in('id', ids);
      setFollowersList(users || []);
    } else {
      setFollowersList([]);
    }
  }, [displayUser.id]);

  const fetchFollowingList = useCallback(async () => {
    const { data } = await supabase.from('followers').select('following_id').eq('follower_id', displayUser.id);
    if (data && data.length > 0) {
      const ids = data.map((f: { following_id: string }) => f.following_id);
      const { data: users } = await supabase.from('users').select('*').in('id', ids);
      setFollowingList(users || []);
    } else {
      setFollowingList([]);
    }
  }, [displayUser.id]);

  const fetchStories = useCallback(async () => {
    const { data } = await supabase
      .from('stories')
      .select('*')
      .eq('user_id', displayUser.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    setStories(data || []);
  }, [displayUser.id]);

  useEffect(() => { fetchFollowData(); fetchStories(); }, [fetchFollowData, fetchStories]);
  useEffect(() => { setActiveTab('posts'); setSelectedPhotoPost(null); }, [viewingUser]);

  useEffect(() => {
    if (showFollowersPopup) fetchFollowersList();
  }, [showFollowersPopup, fetchFollowersList]);

  useEffect(() => {
    if (showFollowingPopup) fetchFollowingList();
  }, [showFollowingPopup, fetchFollowingList]);

  const handleFollow = async () => {
    if (!viewingUser) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await supabase.from('followers').delete().match({ follower_id: currentUser.id, following_id: viewingUser.id });
      } else {
        await supabase.from('followers').insert({ follower_id: currentUser.id, following_id: viewingUser.id });
      }
      await fetchFollowData();
      onRefreshPosts();
    } catch (err) {
      console.error('Follow error:', err);
    }
    setFollowLoading(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from('users')
      .update({ display_name: displayName.trim(), bio: bio.trim() })
      .eq('id', currentUser.id)
      .select()
      .single();
    if (!error && data) { onUserUpdate(data); setEditing(false); }
    setSaving(false);
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Max 5MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => setCropImage(reader.result as string);
    reader.readAsDataURL(file);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleCroppedAvatar = async (blob: Blob) => {
    setCropImage(null);
    const fileName = `${currentUser.id}_${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(fileName, blob, { upsert: true });
    if (upErr) { alert('Gagal upload: ' + upErr.message); return; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
    const { data, error } = await supabase.from('users').update({ avatar_url: urlData.publicUrl }).eq('id', currentUser.id).select().single();
    if (!error && data) onUserUpdate(data);
  };

  const handleDeleteAvatar = async () => {
    if (!confirm('Hapus foto profil?')) return;
    const { data, error } = await supabase.from('users').update({ avatar_url: '' }).eq('id', currentUser.id).select().single();
    if (!error && data) onUserUpdate(data);
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Hanya file gambar'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Max 5MB'); return; }
    setCoverUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `cover_${currentUser.id}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('covers').upload(fileName, file, { upsert: true });
      if (upErr) { alert('Gagal upload cover: ' + upErr.message); setCoverUploading(false); return; }
      const { data: urlData } = supabase.storage.from('covers').getPublicUrl(fileName);
      const { data, error } = await supabase.from('users').update({ cover_url: urlData.publicUrl }).eq('id', currentUser.id).select().single();
      if (!error && data) onUserUpdate(data);
    } catch {
      alert('Gagal mengunggah cover');
    }
    setCoverUploading(false);
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const handleDeleteCover = async () => {
    if (!confirm('Hapus foto cover?')) return;
    const { data, error } = await supabase.from('users').update({ cover_url: '' }).eq('id', currentUser.id).select().single();
    if (!error && data) onUserUpdate(data);
  };

  const handleCreatePost = async () => {
    if (!postContent.trim() && !postImgFile && !postVideoFile) return;
    setPostSubmitting(true);
    let imageUrl = '';
    let videoUrl = '';

    if (postImgFile) {
      const ext = postImgFile.name.split('.').pop();
      const name = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('posts').upload(name, postImgFile);
      if (!upErr) { const { data: u } = supabase.storage.from('posts').getPublicUrl(name); imageUrl = u.publicUrl; }
    }

    if (postVideoFile) {
      const ext = postVideoFile.name.split('.').pop();
      const name = `vid_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('videos').upload(name, postVideoFile);
      if (!upErr) { const { data: u } = supabase.storage.from('videos').getPublicUrl(name); videoUrl = u.publicUrl; }
    }

    await supabase.from('posts').insert({
      user_id: currentUser.id,
      content: postContent.trim(),
      image_url: imageUrl,
      video_url: videoUrl,
    });

    setPostContent('');
    setPostImgFile(null);
    setPostImgPreview(null);
    setPostVideoFile(null);
    setPostVideoPreview(null);
    setShowCreatePost(false);
    setPostSubmitting(false);
    onRefreshPosts();
  };

  const handlePostImg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPostImgFile(file);
      const r = new FileReader();
      r.onloadend = () => setPostImgPreview(r.result as string);
      r.readAsDataURL(file);
      setPostVideoFile(null);
      setPostVideoPreview(null);
    }
  };

  const handlePostVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) { alert('Ukuran video max 50MB'); return; }
      setPostVideoFile(file);
      setPostVideoPreview(URL.createObjectURL(file));
      setPostImgFile(null);
      setPostImgPreview(null);
    }
  };

  const hasStory = stories.length > 0;

  const UserPopupItem = ({ user }: { user: User }) => (
    <button
      onClick={() => {
        if (user.id === currentUser.id) { onSetViewingUser(null); }
        else { onSetViewingUser(user); }
        setShowFollowersPopup(false);
        setShowFollowingPopup(false);
      }}
      className="flex w-full items-center gap-3 p-3 hover:bg-white/60 transition text-left rounded-2xl group"
    >
      <div className="h-11 w-11 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0 ring-2 ring-white/50 shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-200">
        {user.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" /> : user.display_name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{user.display_name}</p>
        <p className="text-xs text-gray-400 truncate">@{user.username}</p>
      </div>
      {user.id === currentUser.id && (
        <span className="text-[10px] bg-gradient-to-r from-blue-500 to-purple-500 text-white px-2.5 py-1 rounded-full font-medium shadow-sm">Kamu</span>
      )}
      <svg className="h-4 w-4 text-gray-300 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all duration-200 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
    </button>
  );

  return (
    <div>
      {/* Profile Header */}
      <div className="mb-0 bg-white overflow-hidden">
        {/* Cover */}
        <div className="h-36 sm:h-44 relative bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 overflow-hidden group">
          {displayUser.cover_url && (
            <img src={displayUser.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          {isOwnProfile && (
            <>
              <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <button
                    onClick={() => coverInputRef.current?.click()}
                    disabled={coverUploading}
                    className="flex items-center gap-1.5 rounded-xl bg-white/90 backdrop-blur-sm px-4 py-2.5 text-sm font-medium text-gray-800 shadow-lg hover:bg-white transition disabled:opacity-50"
                  >
                    {coverUploading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    )}
                    {coverUploading ? 'Mengunggah...' : displayUser.cover_url ? 'Ganti Cover' : 'Tambah Cover'}
                  </button>
                  {displayUser.cover_url && (
                    <button
                      onClick={handleDeleteCover}
                      className="flex items-center gap-1.5 rounded-xl bg-red-500/90 backdrop-blur-sm px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-red-600 transition"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => coverInputRef.current?.click()}
                disabled={coverUploading}
                className="md:hidden absolute bottom-2 right-2 flex items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-1.5 text-xs text-white backdrop-blur-sm hover:bg-black/60 transition disabled:opacity-50"
              >
                {coverUploading ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                )}
                Cover
              </button>
            </>
          )}
          {viewingUser && (
            <button
              onClick={() => onSetViewingUser(null)}
              className="absolute top-3 left-3 flex items-center gap-1 rounded-lg bg-black/30 px-3 py-1.5 text-xs text-white backdrop-blur-sm hover:bg-black/50 transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              Kembali
            </button>
          )}
        </div>

        {/* Avatar */}
        <div className="px-5 -mt-12 relative z-10">
          <div className="relative inline-block">
            <div className={`h-20 w-20 rounded-full border-4 border-white bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg overflow-hidden ${hasStory ? 'ring-2 ring-pink-500 ring-offset-2' : ''}`}>
              {displayUser.avatar_url ? (
                <img
                  src={displayUser.avatar_url}
                  alt=""
                  className="h-full w-full object-cover cursor-pointer"
                  onClick={() => setLightboxImg(displayUser.avatar_url)}
                />
              ) : (
                displayUser.display_name.charAt(0).toUpperCase()
              )}
            </div>
            {isOwnProfile && (
              <div className="absolute -bottom-1 -right-1 flex gap-0.5">
                <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-white shadow-md hover:bg-blue-600 transition"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
                {currentUser.avatar_url && (
                  <button
                    onClick={handleDeleteAvatar}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 transition"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="px-5 pt-3 pb-5">
          {editing && isOwnProfile ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Nama Tampilan</label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Bio</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="Tulis bio kamu..." />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveProfile} disabled={saving} className="rounded-xl bg-blue-500 px-5 py-2 text-sm font-medium text-white hover:bg-blue-600 transition disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan'}</button>
                <button onClick={() => { setEditing(false); setDisplayName(currentUser.display_name); setBio(currentUser.bio || ''); }} className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">Batal</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{displayUser.display_name}</h2>
                  <p className="text-sm text-gray-400">@{displayUser.username}</p>
                </div>
                <div className="flex gap-2">
                  {!isOwnProfile && (
                    <>
                      <button
                        onClick={() => onNavigateMessages(displayUser)}
                        className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 hover:text-blue-500 transition"
                        title="Kirim pesan"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      </button>
                      <button
                        onClick={handleFollow}
                        disabled={followLoading}
                        className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${isFollowing ? 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500 border border-gray-200' : 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm'} disabled:opacity-50`}
                      >
                        {followLoading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : isFollowing ? 'Mengikuti' : 'Ikuti'}
                      </button>
                    </>
                  )}
                </div>
              </div>
              {displayUser.bio && <p className="mt-2 text-sm text-gray-600">{displayUser.bio}</p>}

              <div className="mt-3 flex items-center gap-5 text-sm">
                <span><span className="font-bold text-gray-900">{myPosts.length}</span><span className="ml-1 text-gray-400">postingan</span></span>
                <button onClick={() => setShowFollowersPopup(true)} className="hover:text-blue-500 transition">
                  <span className="font-bold text-gray-900">{followerCount}</span><span className="ml-1 text-gray-400">pengikut</span>
                </button>
                <button onClick={() => setShowFollowingPopup(true)} className="hover:text-blue-500 transition">
                  <span className="font-bold text-gray-900">{followingCount}</span><span className="ml-1 text-gray-400">mengikuti</span>
                </button>
              </div>

              {isOwnProfile && (
                <div className="mt-4 flex gap-2 flex-wrap">
                  <button onClick={() => setEditing(true)} className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Edit Profil</button>
                  <button onClick={() => setShowCreatePost(true)} className="rounded-xl bg-blue-500 px-5 py-2 text-sm font-medium text-white hover:bg-blue-600 transition shadow-sm">Buat Status</button>
                  <button onClick={onLogout} className="rounded-xl border border-red-100 px-5 py-2 text-sm font-medium text-red-500 hover:bg-red-50 transition">Keluar</button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Stories row */}
        {stories.length > 0 && (
          <div className="px-5 pb-4 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {stories.map((s) => (
              <button key={s.id} onClick={() => setLightboxImg(s.image_url)} className="flex-shrink-0">
                <div className="h-16 w-16 rounded-xl overflow-hidden border border-gray-200 hover:border-blue-300 transition">
                  <img src={s.image_url} alt="" className="h-full w-full object-cover" />
                </div>
                <p className="text-[9px] text-gray-400 mt-0.5 text-center">{timeAgo(s.created_at)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-100">
        <button
          onClick={() => { setActiveTab('posts'); setSelectedPhotoPost(null); }}
          className={`flex-1 py-3 text-sm font-medium transition flex items-center justify-center gap-2 ${activeTab === 'posts' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
          Postingan
        </button>
        <button
          onClick={() => { setActiveTab('photos'); setSelectedPhotoPost(null); }}
          className={`flex-1 py-3 text-sm font-medium transition flex items-center justify-center gap-2 ${activeTab === 'photos' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          Foto
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'posts' && (
        myPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
            </div>
            <p className="text-sm text-gray-400">Belum ada postingan</p>
          </div>
        ) : (
          <div className="space-y-0">
            {myPosts.map((post) => (
              <PostCard key={post.id} post={post} currentUser={currentUser} onLike={onLike} onComment={onComment} onDeletePost={onDeletePost} onDeleteComment={onDeleteComment} onViewProfile={(u) => { if (u.id !== displayUser.id) onSetViewingUser(u); }} />
            ))}
          </div>
        )
      )}

      {activeTab === 'photos' && (
        <>
          {selectedPhotoPost ? (
            <div>
              <button
                onClick={() => setSelectedPhotoPost(null)}
                className="mb-3 mt-3 ml-4 flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-700 font-medium transition"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                Kembali ke galeri
              </button>
              <PostCard
                post={selectedPhotoPost}
                currentUser={currentUser}
                onLike={onLike}
                onComment={onComment}
                onDeletePost={(id) => { onDeletePost(id); setSelectedPhotoPost(null); }}
                onDeleteComment={onDeleteComment}
                onViewProfile={(u) => { if (u.id !== displayUser.id) onSetViewingUser(u); }}
              />
            </div>
          ) : photoPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <p className="text-sm text-gray-400">Belum ada foto</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              {photoPosts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => setSelectedPhotoPost(post)}
                  className="aspect-square overflow-hidden bg-gray-100 hover:opacity-80 transition relative group"
                >
                  <img src={post.image_url} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center">
                    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {post.likes && (
                        <span className="flex items-center gap-1 text-white text-xs font-semibold">
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                          {post.likes.length}
                        </span>
                      )}
                      {post.comments && (
                        <span className="flex items-center gap-1 text-white text-xs font-semibold">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                          {post.comments.length}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Followers Popup - Glassmorphism */}
      {showFollowersPopup && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowFollowersPopup(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden shadow-2xl max-h-[70vh] flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
            style={{
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              borderRadius: '24px',
              border: '1px solid rgba(255,255,255,0.6)',
              boxShadow: '0 25px 60px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.1) inset',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md">
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">Pengikut</h3>
                  <p className="text-[11px] text-gray-400">{followerCount} orang</p>
                </div>
              </div>
              <button
                onClick={() => setShowFollowersPopup(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-all duration-200"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-2.5" style={{ scrollbarWidth: 'thin' }}>
              {followersList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="h-14 w-14 rounded-full bg-gray-100/80 flex items-center justify-center mb-3">
                    <svg className="h-7 w-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                  <p className="text-sm text-gray-400 font-medium">Belum ada pengikut</p>
                  <p className="text-xs text-gray-300 mt-1">Pengikut akan muncul di sini</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {followersList.map((u) => <UserPopupItem key={u.id} user={u} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Following Popup - Glassmorphism */}
      {showFollowingPopup && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowFollowingPopup(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden shadow-2xl max-h-[70vh] flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
            style={{
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              borderRadius: '24px',
              border: '1px solid rgba(255,255,255,0.6)',
              boxShadow: '0 25px 60px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.1) inset',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-md">
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">Mengikuti</h3>
                  <p className="text-[11px] text-gray-400">{followingCount} orang</p>
                </div>
              </div>
              <button
                onClick={() => setShowFollowingPopup(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-all duration-200"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-2.5" style={{ scrollbarWidth: 'thin' }}>
              {followingList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="h-14 w-14 rounded-full bg-gray-100/80 flex items-center justify-center mb-3">
                    <svg className="h-7 w-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  </div>
                  <p className="text-sm text-gray-400 font-medium">Belum mengikuti siapapun</p>
                  <p className="text-xs text-gray-300 mt-1">Orang yang diikuti akan muncul di sini</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {followingList.map((u) => <UserPopupItem key={u.id} user={u} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Post Modal - Glassmorphism */}
      {showCreatePost && (
        <div
          className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowCreatePost(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-6 duration-300"
            style={{
              background: 'rgba(255,255,255,0.9)',
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              borderRadius: '24px 24px 0 0',
              border: '1px solid rgba(255,255,255,0.6)',
              boxShadow: '0 -25px 60px -12px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle for mobile */}
            <div className="flex justify-center pt-3 pb-0 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-gray-300/60" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md">
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
                <h3 className="text-sm font-bold text-gray-800">Buat Status</h3>
              </div>
              <button
                onClick={() => setShowCreatePost(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-all duration-200"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-11 w-11 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0 ring-2 ring-white/50 shadow-md">
                  {currentUser.avatar_url ? <img src={currentUser.avatar_url} alt="" className="h-full w-full object-cover" /> : currentUser.display_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{currentUser.display_name}</p>
                  <p className="text-xs text-gray-400">@{currentUser.username}</p>
                </div>
              </div>
              <textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="Apa yang kamu pikirkan?"
                rows={4}
                className="w-full resize-none text-sm text-gray-800 placeholder-gray-400 focus:outline-none leading-relaxed mb-3 bg-transparent"
                autoFocus
              />
              {postImgPreview && (
                <div className="relative mb-3 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                  <img src={postImgPreview} alt="" className="w-full max-h-60 object-cover" />
                  <button onClick={() => { setPostImgFile(null); setPostImgPreview(null); }} className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition text-lg">×</button>
                </div>
              )}
              {postVideoPreview && (
                <div className="relative mb-3 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                  <video src={postVideoPreview} controls className="w-full max-h-60" />
                  <button onClick={() => { setPostVideoFile(null); setPostVideoPreview(null); }} className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition text-lg">×</button>
                </div>
              )}
            </div>
            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3.5" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="flex gap-1">
                <input ref={postFileRef} type="file" accept="image/*" onChange={handlePostImg} className="hidden" />
                <input ref={postVideoRef} type="file" accept="video/*" onChange={handlePostVideo} className="hidden" />
                <button onClick={() => postFileRef.current?.click()} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-gray-500 hover:bg-white/60 hover:text-blue-500 transition-all duration-200">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Foto
                </button>
                <button onClick={() => postVideoRef.current?.click()} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-gray-500 hover:bg-white/60 hover:text-purple-500 transition-all duration-200">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  Video
                </button>
              </div>
              <button
                onClick={handleCreatePost}
                disabled={postSubmitting || (!postContent.trim() && !postImgFile && !postVideoFile)}
                className="rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-lg"
              >
                {postSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Memposting...
                  </div>
                ) : 'Posting'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Cropper */}
      {cropImage && <ImageCropper imageSrc={cropImage} onCrop={handleCroppedAvatar} onCancel={() => setCropImage(null)} />}

      {/* Lightbox */}
      {lightboxImg && <ImageLightbox src={lightboxImg} alt="Foto" onClose={() => setLightboxImg(null)} />}
    </div>
  );
}