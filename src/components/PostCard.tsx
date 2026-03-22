// components/PostCard.tsx

import { useState, useEffect, useCallback } from 'react';
import type { Post, User, Like } from '../lib/supabase';
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

export function PostCard({
  post,
  currentUser,
  onLike,
  onComment,
  onDeletePost,
  onDeleteComment,
  onViewProfile,
  onEditPost,
}: Props) {
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [showAllLikers, setShowAllLikers] = useState(false);
  const [likerUsers, setLikerUsers] = useState<User[]>([]);
  const [likersLoading, setLikersLoading] = useState(false);
  const [likersFetched, setLikersFetched] = useState(false);

  const COMMENTS_PER_PAGE = 5;
  const [visibleCommentsCount, setVisibleCommentsCount] = useState(COMMENTS_PER_PAGE);

  const isLiked = post.likes?.some((l: Like) => l.user_id === currentUser.id) || false;
  const likeCount = post.likes?.length || 0;
  const isOwner = post.user_id === currentUser.id;

  const authorName = post.users?.display_name || 'Unknown';
  const authorUsername = post.users?.username || 'unknown';
  const authorAvatar = post.users?.avatar_url;
  const isVideo = post.video_url && post.video_url.length > 0;
  const isEdited = post.updated_at && post.updated_at !== post.created_at;

  const MAX_VISIBLE_LIKERS = 5;

  const allComments = post.comments || [];
  const commentCount = allComments.length;

  const sortedComments = [...allComments].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const visibleComments = sortedComments.slice(0, visibleCommentsCount);
  const hasMoreComments = sortedComments.length > visibleCommentsCount;
  const hiddenCount = sortedComments.length - visibleCommentsCount;

  const fetchLikerUsers = useCallback(async () => {
    if (!post.likes || post.likes.length === 0 || likersFetched) return;
    setLikersLoading(true);
    try {
      const ids = post.likes.map((l: Like) => l.user_id);
      const { data } = await supabase.from('users').select('*').in('id', ids);
      setLikerUsers(data || []);
      setLikersFetched(true);
    } catch {
      setLikerUsers([]);
    }
    setLikersLoading(false);
  }, [post.likes, likersFetched]);

  useEffect(() => {
    if (likeCount > 0 && !likersFetched) fetchLikerUsers();
  }, [likeCount, likersFetched, fetchLikerUsers]);

  useEffect(() => {
    setLikersFetched(false);
  }, [likeCount]);

  useEffect(() => {
    if (!showComments) setVisibleCommentsCount(COMMENTS_PER_PAGE);
  }, [showComments]);

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.trim()) {
      onComment(post.id, commentText.trim());
      setCommentText('');
    }
  };

  const visibleLikers = likerUsers.slice(0, MAX_VISIBLE_LIKERS);
  const remainingLikersCount = likerUsers.length - MAX_VISIBLE_LIKERS;

  return (
    <div className="bg-white border-b border-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          onClick={() => {
            if (onViewProfile && post.users) onViewProfile(post.users);
          }}
          className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-blue-300 transition"
        >
          {authorAvatar ? (
            <img src={authorAvatar} alt="" className="h-full w-full object-cover" />
          ) : (
            authorName.charAt(0).toUpperCase()
          )}
        </button>
        <button
          onClick={() => {
            if (onViewProfile && post.users) onViewProfile(post.users);
          }}
          className="flex-1 min-w-0 text-left hover:opacity-80 transition"
        >
          <p className="text-sm font-semibold text-gray-900 truncate">{authorName}</p>
          <p className="text-xs text-gray-400">
            @{authorUsername} · {timeAgo(post.created_at)}
            {isEdited && (
              <span className="ml-1 text-gray-300">
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
                <div className="absolute right-0 top-8 z-20 w-44 rounded-2xl bg-white shadow-xl border border-gray-100 py-1.5">
                  {onEditPost && (
                    <>
                      <button
                        onClick={() => {
                          onEditPost(post);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-600 flex items-center gap-2.5 transition-colors"
                      >
                        ✏️ Edit
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
                    🗑️ Hapus
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {post.content && (
        <div className="px-4 py-2">
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{post.content}</p>
        </div>
      )}

      {/* Image */}
      {post.image_url && !isVideo && (
        <div className="mt-1">
          <img
            src={post.image_url}
            alt="Post"
            className="w-full max-h-[80vh] object-contain cursor-pointer hover:brightness-[0.92] transition"
            loading="lazy"
            onClick={() => setShowLightbox(true)}
          />
        </div>
      )}

      {/* Video */}
      {isVideo && (
        <div className="mt-1">
          <video src={post.video_url} controls className="w-full max-h-[500px] bg-black" preload="metadata" />
        </div>
      )}

      {showLightbox && post.image_url && (
        <ImageLightbox
          src={post.image_url}
          alt={`Foto dari ${authorName}`}
          onClose={() => setShowLightbox(false)}
        />
      )}

      {/* Like & Comment Buttons */}
      <div className="flex border-t border-gray-50">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLike(post.id);
          }}
          className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-all active:scale-95 ${
            isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
          }`}
        >
          {isLiked ? (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          )}
          <span>{isLiked ? 'Disukai' : 'Suka'}</span>
          {likeCount > 0 && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                isLiked ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {likeCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-all active:scale-95 ${
            showComments ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500'
          }`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span>Komentar</span>
          {commentCount > 0 && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                showComments ? 'bg-blue-50 text-blue-500' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {commentCount}
            </span>
          )}
        </button>
      </div>

      {/* Likers */}
      {likeCount > 0 && (
        <div className="px-4 py-2.5 border-t border-gray-50">
          <div className="flex items-center gap-2">
            {likersLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" />
                <span className="text-xs text-gray-400">Memuat...</span>
              </div>
            ) : (
              <>
                <div className="flex -space-x-2">
                  {visibleLikers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => {
                        if (onViewProfile) onViewProfile(user);
                      }}
                      className="relative h-7 w-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold overflow-hidden flex-shrink-0 ring-2 ring-white hover:ring-pink-200 hover:z-10 hover:scale-110 transition-all shadow-sm"
                      title={user.display_name}
                    >
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        user.display_name.charAt(0).toUpperCase()
                      )}
                    </button>
                  ))}
                </div>
                <div className="ml-2.5 flex-1 min-w-0">
                  <p className="text-xs text-gray-500 truncate">
                    <span className="font-semibold text-gray-700">
                      {visibleLikers
                        .slice(0, 2)
                        .map((u) => (u.id === currentUser.id ? 'Kamu' : u.display_name))
                        .join(', ')}
                    </span>
                    {likerUsers.length > 2 && (
                      <span>
                        {' '}
                        dan{' '}
                        <span className="font-semibold text-gray-700">{likerUsers.length - 2} lainnya</span>
                      </span>
                    )}
                    {likerUsers.length <= 2 && <span className="text-gray-400"> menyukai ini</span>}
                  </p>
                </div>
                {remainingLikersCount > 0 && (
                  <button
                    onClick={() => setShowAllLikers(!showAllLikers)}
                    className="ml-2 flex items-center gap-1 text-xs font-medium text-pink-500 bg-pink-50 hover:bg-pink-100 px-2.5 py-1 rounded-full transition flex-shrink-0"
                  >
                    <span>+{remainingLikersCount}</span>
                  </button>
                )}
              </>
            )}
          </div>

          {showAllLikers && remainingLikersCount > 0 && (
            <div className="mt-3 rounded-2xl bg-gray-50/80 border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-600">❤️ Disukai oleh {likeCount} orang</p>
                <button onClick={() => setShowAllLikers(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto p-2" style={{ scrollbarWidth: 'thin' }}>
                {likerUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      if (onViewProfile) onViewProfile(user);
                      setShowAllLikers(false);
                    }}
                    className="flex w-full items-center gap-3 p-2.5 hover:bg-white rounded-xl transition text-left"
                  >
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs overflow-hidden flex-shrink-0 shadow-sm">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        user.display_name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{user.display_name}</p>
                      <p className="text-[11px] text-gray-400 truncate">@{user.username}</p>
                    </div>
                    {user.id === currentUser.id && (
                      <span className="text-[10px] bg-pink-500 text-white px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                        Kamu
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Comments Section */}
      {showComments && (
        <div className="border-t border-gray-50 bg-gray-50/30">
          {hasMoreComments && (
            <button
              onClick={() => setVisibleCommentsCount((prev) => prev + COMMENTS_PER_PAGE)}
              className="w-full py-2.5 text-xs font-medium text-blue-500 hover:bg-blue-50/50 transition flex items-center justify-center gap-1.5"
            >
              ▲ Lihat {hiddenCount} komentar lainnya
            </button>
          )}

          {sortedComments.length > 0 ? (
            <div
              className="overflow-y-auto px-4 pt-3 pb-2 space-y-3"
              style={{ maxHeight: '500px', scrollbarWidth: 'thin' }}
            >
              {visibleComments.map((comment) => {
                const commenterName = comment.users?.display_name || 'Unknown';
                const commenterAvatar = comment.users?.avatar_url;
                const isCommentOwner = comment.user_id === currentUser.id;

                return (
                  <div key={comment.id} className="flex items-start gap-2 group/comment">
                    {/* Avatar */}
                    <button
                      onClick={() => {
                        if (onViewProfile && comment.users) onViewProfile(comment.users);
                      }}
                      className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 overflow-hidden hover:ring-2 hover:ring-blue-200 transition shadow-sm"
                    >
                      {commenterAvatar ? (
                        <img src={commenterAvatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        commenterName.charAt(0).toUpperCase()
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="rounded-2xl bg-gray-50 px-3 py-2 shadow-sm border border-gray-100/50 relative inline-block max-w-full">
                        <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                          <button
                            onClick={() => {
                              if (onViewProfile && comment.users) onViewProfile(comment.users);
                            }}
                            className="text-[12px] font-semibold text-gray-800 hover:text-blue-600 transition"
                          >
                            {commenterName}
                          </button>
                          {isCommentOwner && (
                            <span className="text-[7px] bg-blue-100 text-blue-500 px-1 py-0.5 rounded-full font-medium">
                              kamu
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-gray-600 leading-relaxed break-words whitespace-pre-wrap">
                          {comment.content}
                        </p>

                        {/* Delete button (owner only) */}
                        {isCommentOwner && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('Hapus komentar ini?')) onDeleteComment(comment.id);
                            }}
                            className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/comment:opacity-100 transition-all"
                            title="Hapus komentar"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Time */}
                      <div className="px-1.5 mt-0.5">
                        <span className="text-[10px] text-gray-400">{timeAgo(comment.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <svg
                  className="h-6 w-6 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <p className="text-sm text-gray-400 font-medium">Belum ada komentar</p>
              <p className="text-xs text-gray-300 mt-1">Jadilah yang pertama berkomentar 💬</p>
            </div>
          )}

          {/* Comment input */}
          <form
            onSubmit={handleSubmitComment}
            className="flex items-center gap-2.5 p-3 border-t border-gray-100/50 bg-white"
          >
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 overflow-hidden shadow-sm">
              {currentUser.avatar_url ? (
                <img src={currentUser.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                currentUser.display_name.charAt(0).toUpperCase()
              )}
            </div>
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Tulis komentar..."
              className="flex-1 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-50 transition"
            />
            <button
              type="submit"
              disabled={!commentText.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-md hover:shadow-lg hover:scale-105 transition-all disabled:opacity-30 flex-shrink-0 active:scale-95"
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
