import { useState } from 'react';
import type { Post, User, Like, Comment } from '../lib/supabase';
import { timeAgo } from '../lib/supabase';
import { ImageLightbox } from './ImageLightbox';

type Props = {
  post: Post;
  currentUser: User;
  onLike: (postId: string) => void;
  onComment: (postId: string, content: string) => void;
  onDeletePost: (postId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onViewProfile?: (user: User) => void;
};

export function PostCard({ post, currentUser, onLike, onComment, onDeletePost, onDeleteComment, onViewProfile }: Props) {
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [showLikers, setShowLikers] = useState(false);

  const isLiked = post.likes?.some((l: Like) => l.user_id === currentUser.id) || false;
  const likeCount = post.likes?.length || 0;
  const commentCount = post.comments?.length || 0;
  const isOwner = post.user_id === currentUser.id;

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.trim()) {
      onComment(post.id, commentText);
      setCommentText('');
    }
  };

  const authorName = post.users?.display_name || 'Unknown';
  const authorUsername = post.users?.username || 'unknown';
  const authorAvatar = post.users?.avatar_url;

  const handleAuthorClick = () => {
    if (onViewProfile && post.users) onViewProfile(post.users);
  };

  const isVideo = post.video_url && post.video_url.length > 0;

  return (
    <div className="bg-white border-b border-gray-100">
      {/* Header */}
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
          <p className="text-xs text-gray-400">@{authorUsername} · {timeAgo(post.created_at)}</p>
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
                <div className="absolute right-0 top-8 z-20 w-36 rounded-xl bg-white shadow-xl border border-gray-100 py-1">
                  <button
                    onClick={() => { onDeletePost(post.id); setShowMenu(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
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

      {/* Content */}
      {post.content && (
        <div className="px-4 py-2">
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{post.content}</p>
        </div>
      )}

      {/* Image */}
      {post.image_url && !isVideo && (
        <div className="mt-1 relative group">
          <img
            src={post.image_url}
            alt="Post"
            className="w-full max-h-[500px] object-cover cursor-pointer hover:brightness-[0.92] transition-all duration-200"
            loading="lazy"
            onClick={() => setShowLightbox(true)}
          />
        </div>
      )}

      {/* Video */}
      {isVideo && (
        <div className="mt-1">
          <video
            src={post.video_url}
            controls
            className="w-full max-h-[500px] bg-black"
            preload="metadata"
          />
        </div>
      )}

      {showLightbox && post.image_url && (
        <ImageLightbox src={post.image_url} alt={`Foto dari ${authorName}`} onClose={() => setShowLightbox(false)} />
      )}

      {/* Stats */}
      {(likeCount > 0 || commentCount > 0) && (
        <div className="flex items-center gap-4 px-4 py-2 text-xs text-gray-400">
          {likeCount > 0 && (
            <button onClick={() => setShowLikers(!showLikers)} className="hover:text-gray-600 transition flex items-center gap-1">
              <span className="text-red-400">❤️</span> {likeCount} suka
            </button>
          )}
          {commentCount > 0 && (
            <button onClick={() => setShowComments(!showComments)} className="hover:text-gray-600">{commentCount} komentar</button>
          )}
        </div>
      )}

      {/* Likers */}
      {showLikers && post.likes && post.likes.length > 0 && (
        <div className="mx-4 mb-2 rounded-xl bg-gray-50 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500">Disukai oleh:</p>
            <button onClick={() => setShowLikers(false)} className="text-gray-400 hover:text-gray-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {post.likes.map((like: Like) => (
              <div key={like.id} className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center">
                  <span className="text-[8px] text-white">❤</span>
                </div>
                <span className="text-xs text-gray-600">
                  {like.user_id === currentUser.id ? 'Kamu' : like.user_id.slice(0, 8) + '...'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex border-t border-gray-50">
        <button
          onClick={() => onLike(post.id)}
          className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-all ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}
        >
          {isLiked ? (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
          )}
          <span>{isLiked ? 'Disukai' : 'Suka'}</span>
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium text-gray-400 hover:text-blue-500 transition-all"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          <span>Komentar</span>
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="border-t border-gray-50 bg-gray-50/50">
          {post.comments && post.comments.length > 0 && (
            <div className="max-h-60 overflow-y-auto px-4 pt-3 space-y-3">
              {post.comments.map((comment: Comment) => (
                <div key={comment.id} className="flex gap-2.5">
                  <button
                    onClick={() => { if (onViewProfile && comment.users) onViewProfile(comment.users); }}
                    className="h-7 w-7 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5 overflow-hidden hover:ring-2 hover:ring-blue-200 transition"
                  >
                    {comment.users?.avatar_url ? (
                      <img src={comment.users.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (comment.users?.display_name || 'U').charAt(0).toUpperCase()
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="rounded-xl bg-white px-3 py-2">
                      <button
                        onClick={() => { if (onViewProfile && comment.users) onViewProfile(comment.users); }}
                        className="text-xs font-semibold text-gray-800 hover:text-blue-600 transition"
                      >
                        {comment.users?.display_name || 'Unknown'}
                        {comment.user_id === currentUser.id && (
                          <span className="ml-1 text-[10px] font-normal text-blue-400">(kamu)</span>
                        )}
                      </button>
                      <p className="text-sm text-gray-600 mt-0.5 break-words">{comment.content}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1 px-1">
                      <span className="text-[10px] text-gray-400">{timeAgo(comment.created_at)}</span>
                      {comment.user_id === currentUser.id && (
                        <button
                          onClick={() => onDeleteComment(comment.id)}
                          className="text-[10px] text-red-400 hover:text-red-600 font-medium"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmitComment} className="flex items-center gap-2 p-3">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 overflow-hidden">
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
              className="flex-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-100"
            />
            <button
              type="submit"
              disabled={!commentText.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white shadow hover:bg-blue-600 transition disabled:opacity-30 flex-shrink-0"
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
