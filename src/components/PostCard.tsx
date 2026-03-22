import { useState, useEffect, useCallback } from 'react';
import type { Post, User, Like, Comment } from '../lib/supabase';
import { timeAgo, supabase } from '../lib/supabase';
import { ImageLightbox } from './ImageLightbox';

type Props = {
  post: Post;
  currentUser: User;
  onLike: (postId: string) => void;
  onComment: (postId: string, content: string) => void;
  onDeletePost: (postId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onViewProfile?: (user: User) => void;
  onEditPost?: (post: Post) => void;
};

export function PostCard({ post, currentUser, onLike, onComment, onDeletePost, onDeleteComment, onViewProfile, onEditPost }: Props) {
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const [likerUsers, setLikerUsers] = useState<User[]>([]);
  const [likersLoading, setLikersLoading] = useState(false);

  const isLiked = post.likes?.some((l: Like) => l.user_id === currentUser.id) || false;
  const likeCount = post.likes?.length || 0;
  const commentCount = post.comments?.length || 0;
  const isOwner = post.user_id === currentUser.id;

  const authorName = post.users?.display_name || 'Unknown';
  const authorUsername = post.users?.username || 'unknown';
  const authorAvatar = post.users?.avatar_url;
  const isVideo = post.video_url && post.video_url.length > 0;
  const isEdited = post.updated_at && post.updated_at !== post.created_at;

  // ✅ Fetch liker users with profile info
  const fetchLikerUsers = useCallback(async () => {
    if (!post.likes || post.likes.length === 0) return;
    setLikersLoading(true);
    try {
      const ids = post.likes.map((l: Like) => l.user_id);
      const { data } = await supabase.from('users').select('*').in('id', ids);
      setLikerUsers(data || []);
    } catch {
      setLikerUsers([]);
    }
    setLikersLoading(false);
  }, [post.likes]);

  useEffect(() => {
    if (showLikers) fetchLikerUsers();
  }, [showLikers, fetchLikerUsers]);

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.trim()) {
      onComment(post.id, commentText);
      setCommentText('');
    }
  };

  const handleAuthorClick = () => {
    if (onViewProfile && post.users) onViewProfile(post.users);
  };

  return (
    <div className="bg-white border-b border-gray-100">
      {/* ══════════ Header ══════════ */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          onClick={handleAuthorClick}
          className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-blue-300 transition"
        >
          {authorAvatar ? (
            <img src={authorAvatar} alt="" className="h-full w-full object-cover" />
          ) : (
            authorName.charAt(0).toUpperCase()
          )}
        </button>
        <button onClick={handleAuthorClick} className="flex-1 min-w-0 text-left hover:opacity-80 transition">
          <p className="text-sm font-semibold text-gray-900 truncate">{authorName}</p>
          <p className="text-xs text-gray-400">
            @{authorUsername} · {timeAgo(post.created_at)}
            {isEdited && (
              <span className="ml-1 text-gray-300" title={`Diedit ${timeAgo(post.updated_at!)}`}>
                · <span className="italic">diedit</span>
              </span>
            )}
          </p>
        </button>
        {isOwner && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-8 z-20 w-44 rounded-2xl bg-white shadow-xl border border-gray-100 py-1.5 overflow-hidden">
                  {onEditPost && (
                    <>
                      <button
                        onClick={() => { onEditPost(post); setShowMenu(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-600 flex items-center gap-2.5 transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      <div className="mx-3 my-0.5 border-t border-gray-100" />
                    </>
                  )}
                  <button
                    onClick={() => {
                      if (confirm('Hapus postingan ini?')) onDeletePost(post.id);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2.5 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Hapus
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ══════════ Content ══════════ */}
      {post.content && (
        <div className="px-4 py-2">
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{post.content}</p>
        </div>
      )}

      {/* ══════════ Image ══════════ */}
      {post.image_url && !isVideo && (
        <div className="mt-1 relative group">
          <img
            src={post.image_url}
            alt="Post"
            className="w-full max-h-[80vh] object-contain cursor-pointer hover:brightness-[0.92] transition-all duration-200"
            loading="lazy"
            onClick={() => setShowLightbox(true)}
          />
        </div>
      )}

      {/* ══════════ Video ══════════ */}
      {isVideo && (
        <div className="mt-1">
          <video src={post.video_url} controls className="w-full max-h-[500px] bg-black" preload="metadata" />
        </div>
      )}

      {showLightbox && post.image_url && (
        <ImageLightbox src={post.image_url} alt={`Foto dari ${authorName}`} onClose={() => setShowLightbox(false)} />
      )}

      {/* ══════════ Stats bar ══════════ */}
      {(likeCount > 0 || commentCount > 0) && (
        <div className="flex items-center gap-4 px-4 py-2.5 text-xs text-gray-400">
          {likeCount > 0 && (
            <button
              onClick={() => setShowLikers(!showLikers)}
              className="hover:text-gray-600 transition flex items-center gap-1.5"
            >
              <span className="flex -space-x-1">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-red-400 to-pink-500 ring-1 ring-white">
                  <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                </span>
              </span>
              <span>{likeCount} suka</span>
            </button>
          )}
          {commentCount > 0 && (
            <button onClick={() => setShowComments(!showComments)} className="hover:text-gray-600 transition">
              {commentCount} komentar
            </button>
          )}
        </div>
      )}

      {/* ══════════ Likers Panel ══════════ */}
      {showLikers && (
        <div className="mx-4 mb-3">
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(249,250,251,0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(0,0,0,0.05)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center">
                  <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                </div>
                <p className="text-xs font-semibold text-gray-600">Disukai oleh {likeCount} orang</p>
              </div>
              <button
                onClick={() => setShowLikers(false)}
                className="h-6 w-6 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-black/5 transition"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* List */}
            <div className="max-h-48 overflow-y-auto p-2" style={{ scrollbarWidth: 'thin' }}>
              {likersLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" />
                </div>
              ) : likerUsers.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-4">Tidak ada data</p>
              ) : (
                <div className="space-y-0.5">
                  {likerUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => {
                        if (onViewProfile) onViewProfile(user);
                        setShowLikers(false);
                      }}
                      className="flex w-full items-center gap-3 p-2.5 hover:bg-white/70 rounded-xl transition group text-left"
                    >
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs overflow-hidden flex-shrink-0 ring-1 ring-white/50 shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          user.display_name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate leading-tight">
                          {user.display_name}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate leading-tight">@{user.username}</p>
                      </div>
                      {user.id === currentUser.id && (
                        <span className="text-[10px] bg-gradient-to-r from-pink-500 to-red-500 text-white px-2 py-0.5 rounded-full font-medium shadow-sm flex-shrink-0">
                          Kamu
                        </span>
                      )}
                      <svg className="h-3.5 w-3.5 text-gray-300 group-hover:text-pink-400 group-hover:translate-x-0.5 transition-all duration-200 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ Actions ══════════ */}
      <div className="flex border-t border-gray-50">
        <button
          onClick={() => onLike(post.id)}
          className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-all active:scale-95 ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}
        >
          {isLiked ? (
            <svg className="h-5 w-5 animate-[bounce_0.3s_ease-in-out]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
          )}
          <span>{isLiked ? 'Disukai' : 'Suka'}</span>
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium text-gray-400 hover:text-blue-500 transition-all active:scale-95"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          <span>Komentar</span>
        </button>
      </div>

      {/* ══════════ Comments Section ══════════ */}
      {showComments && (
        <div className="border-t border-gray-50 bg-gray-50/50">
          {/* Comments list */}
          {post.comments && post.comments.length > 0 && (
            <div className="max-h-72 overflow-y-auto px-4 pt-3 pb-1 space-y-3" style={{ scrollbarWidth: 'thin' }}>
              {post.comments.map((comment: Comment) => {
                const commenterName = comment.users?.display_name || 'Unknown';
                const commenterAvatar = comment.users?.avatar_url;
                const isCommentOwner = comment.user_id === currentUser.id;

                return (
                  <div key={comment.id} className="flex items-start gap-2.5">
                    {/* Avatar - aligned to top with name */}
                    <button
                      onClick={() => { if (onViewProfile && comment.users) onViewProfile(comment.users); }}
                      className="h-8 w-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 overflow-hidden hover:ring-2 hover:ring-blue-200 transition shadow-sm"
                    >
                      {commenterAvatar ? (
                        <img src={commenterAvatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        commenterName.charAt(0).toUpperCase()
                      )}
                    </button>

                    {/* Content bubble */}
                    <div className="flex-1 min-w-0">
                      <div className="rounded-2xl bg-white px-3.5 py-2.5 shadow-sm border border-gray-100/50">
                        {/* Name row */}
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <button
                            onClick={() => { if (onViewProfile && comment.users) onViewProfile(comment.users); }}
                            className="text-[13px] font-semibold text-gray-800 hover:text-blue-600 transition leading-tight"
                          >
                            {commenterName}
                          </button>
                          {isCommentOwner && (
                            <span className="text-[9px] bg-blue-100 text-blue-500 px-1.5 py-0.5 rounded-full font-medium leading-none">
                              kamu
                            </span>
                          )}
                        </div>
                        {/* Comment text */}
                        <p className="text-[13px] text-gray-600 leading-relaxed break-words">{comment.content}</p>
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-3 mt-1.5 px-2">
                        <span className="text-[11px] text-gray-400">{timeAgo(comment.created_at)}</span>
                        {isCommentOwner && (
                          <button
                            onClick={() => {
                              if (confirm('Hapus komentar ini?')) onDeleteComment(comment.id);
                            }}
                            className="text-[11px] text-gray-400 hover:text-red-500 font-medium transition"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty comments */}
          {(!post.comments || post.comments.length === 0) && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <p className="text-xs text-gray-400">Belum ada komentar</p>
              <p className="text-[11px] text-gray-300 mt-0.5">Jadilah yang pertama berkomentar</p>
            </div>
          )}

          {/* Comment input */}
          <form onSubmit={handleSubmitComment} className="flex items-center gap-2.5 p-3 border-t border-gray-100/50">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 overflow-hidden shadow-sm">
              {currentUser.avatar_url ? (
                <img src={currentUser.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                currentUser.display_name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1 relative">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Tulis komentar..."
                className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 pr-10 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-50 transition"
              />
            </div>
            <button
              type="submit"
              disabled={!commentText.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-30 disabled:hover:scale-100 disabled:hover:shadow-md flex-shrink-0"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
