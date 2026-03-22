// components/PostCard.tsx

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Post, User, Like, Comment, CommentLike } from '../lib/supabase';
import { timeAgo, supabase } from '../lib/supabase';
import { ImageLightbox } from './ImageLightbox';

type Props = {
  post: Post;
  currentUser: User;
  onLike: (postId: string) => void;
  onComment: (postId: string, content: string, parentId?: string) => void;
  onDeletePost: (postId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onEditComment?: (commentId: string, newContent: string) => void;
  onLikeComment?: (commentId: string) => void;
  onViewProfile?: (user: User) => void;
  onEditPost?: (post: Post) => void;
};

// ── Single Comment Component ──
function CommentItem({
  comment,
  currentUser,
  depth,
  allComments,
  onViewProfile,
  onDeleteComment,
  onEditComment,
  onLikeComment,
  onReply,
  replyingTo,
  replyText,
  setReplyText,
  onSubmitReply,
  onCancelReply,
}: {
  comment: Comment;
  currentUser: User;
  depth: number;
  allComments: Comment[];
  onViewProfile?: (user: User) => void;
  onDeleteComment: (commentId: string) => void;
  onEditComment?: (commentId: string, newContent: string) => void;
  onLikeComment?: (commentId: string) => void;
  onReply: (commentId: string) => void;
  replyingTo: string | null;
  replyText: string;
  setReplyText: (text: string) => void;
  onSubmitReply: () => void;
  onCancelReply: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [showReplies, setShowReplies] = useState(depth < 1);
  const [showLikersList, setShowLikersList] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const commenterName = comment.users?.display_name || 'Unknown';
  const commenterAvatar = comment.users?.avatar_url;
  const isCommentOwner = comment.user_id === currentUser.id;
  const isCommentEdited = comment.updated_at && comment.updated_at !== comment.created_at;

  const commentLikes = comment.comment_likes || [];
  const isCommentLiked = commentLikes.some(
    (cl: CommentLike) => cl.user_id === currentUser.id
  );
  const commentLikeCount = commentLikes.length;

  // Get replies for this comment
  const replies = allComments.filter(c => c.parent_id === comment.id);
  const isReplying = replyingTo === comment.id;
  const maxDepth = 3;

  // Indentation berdasarkan depth - makin dalam makin kekanan
  const indentClass = depth > 0 ? 'ml-8 mt-2' : '';
  const borderLeftClass = depth > 0 ? 'border-l-2 border-blue-100 pl-3' : '';

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.selectionStart = editRef.current.value.length;
    }
  }, [isEditing]);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleSaveEdit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== comment.content && onEditComment) {
      onEditComment(comment.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(comment.content);
    setIsEditing(false);
  };

  const gradients = [
    'from-green-400 to-blue-500',
    'from-purple-400 to-pink-500',
    'from-amber-400 to-orange-500',
    'from-cyan-400 to-teal-500',
    'from-rose-400 to-red-500',
  ];
  const avatarGradient = gradients[depth % gradients.length];

  // Find parent comment author name for reply mention
  const parentComment = comment.parent_id
    ? allComments.find(c => c.id === comment.parent_id)
    : null;
  const parentAuthorName = parentComment?.users?.display_name;

  return (
    <div className={indentClass}>
      <div className={`${borderLeftClass} group/comment`}>
        <div className="flex items-start gap-2">
          {/* Avatar */}
          <button
            onClick={() => {
              if (onViewProfile && comment.users) onViewProfile(comment.users);
            }}
            className={`rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden hover:ring-2 hover:ring-blue-200 transition shadow-sm ${
              depth > 0 ? 'h-6 w-6 text-[9px]' : 'h-7 w-7 text-[10px]'
            }`}
          >
            {commenterAvatar ? (
              <img
                src={commenterAvatar}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              commenterName.charAt(0).toUpperCase()
            )}
          </button>

          <div className="flex-1 min-w-0">
            {isEditing ? (
              /* ── Edit Mode ── */
              <div className="rounded-2xl bg-white px-3 py-2 shadow-sm border-2 border-blue-200">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[12px] font-semibold text-gray-800">
                    {commenterName}
                  </span>
                  <span className="text-[9px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">
                    mengedit
                  </span>
                </div>
                <textarea
                  ref={editRef}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full text-[12px] text-gray-700 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-50 resize-none transition"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveEdit();
                    }
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                />
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[9px] text-gray-400">
                    Enter simpan · Esc batal
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={handleCancelEdit}
                      className="px-2 py-0.5 text-[10px] font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={!editText.trim() || editText.trim() === comment.content}
                      className="px-2 py-0.5 text-[10px] font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition disabled:opacity-40"
                    >
                      Simpan
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Display Mode ── */
              <>
                <div className="rounded-2xl bg-white px-3 py-2 shadow-sm border border-gray-100/50 relative inline-block max-w-full">
                  <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                    <button
                      onClick={() => {
                        if (onViewProfile && comment.users)
                          onViewProfile(comment.users);
                      }}
                      className="text-[12px] font-semibold text-gray-800 hover:text-blue-600 transition leading-tight"
                    >
                      {commenterName}
                    </button>
                    {isCommentOwner && (
                      <span className="text-[8px] bg-blue-100 text-blue-500 px-1 py-0.5 rounded-full font-medium leading-none">
                        kamu
                      </span>
                    )}
                    {isCommentEdited && (
                      <span
                        className="text-[8px] text-gray-300 italic"
                        title={`Diedit ${timeAgo(comment.updated_at!)}`}
                      >
                        · diedit
                      </span>
                    )}
                  </div>

                  {/* Reply mention - show who this is replying to */}
                  {comment.parent_id && parentAuthorName && (
                    <p className="text-[10px] text-blue-400 mb-0.5 flex items-center gap-1">
                      <svg
                        className="h-2.5 w-2.5 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                        />
                      </svg>
                      <span>
                        membalas{' '}
                        <span className="font-semibold">{parentAuthorName}</span>
                      </span>
                    </p>
                  )}

                  <p className="text-[12px] text-gray-600 leading-relaxed break-words whitespace-pre-wrap">
                    {comment.content}
                  </p>

                  {/* Like badge on comment bubble */}
                  {commentLikeCount > 0 && (
                    <button
                      onClick={() => setShowLikersList(!showLikersList)}
                      className="absolute -bottom-2.5 right-2 flex items-center gap-0.5 bg-white rounded-full px-1.5 py-0.5 shadow-md border border-gray-100 hover:shadow-lg transition-all hover:scale-105"
                    >
                      <svg
                        className="h-2.5 w-2.5 text-red-500"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                      <span className="text-[9px] font-semibold text-gray-600">
                        {commentLikeCount}
                      </span>
                    </button>
                  )}

                  {/* Menu button - only for comment owner */}
                  {isCommentOwner && (
                    <div className="absolute top-1.5 right-1.5" ref={menuRef}>
                      <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="h-5 w-5 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 opacity-0 group-hover/comment:opacity-100 transition-all"
                      >
                        <svg
                          className="h-3 w-3"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <circle cx="6" cy="12" r="1.5" />
                          <circle cx="12" cy="12" r="1.5" />
                          <circle cx="18" cy="12" r="1.5" />
                        </svg>
                      </button>
                      {showMenu && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setShowMenu(false)}
                          />
                          <div className="absolute right-0 top-6 z-20 w-36 rounded-xl bg-white shadow-xl border border-gray-100 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                            {onEditComment && (
                              <button
                                onClick={() => {
                                  setEditText(comment.content);
                                  setIsEditing(true);
                                  setShowMenu(false);
                                }}
                                className="w-full px-3 py-2 text-left text-[11px] text-gray-700 hover:bg-amber-50 hover:text-amber-600 flex items-center gap-2 transition-colors"
                              >
                                <svg
                                  className="h-3.5 w-3.5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                                Edit komentar
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (confirm('Hapus komentar ini?'))
                                  onDeleteComment(comment.id);
                                setShowMenu(false);
                              }}
                              className="w-full px-3 py-2 text-left text-[11px] text-red-500 hover:bg-red-50 flex items-center gap-2 transition-colors"
                            >
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                              Hapus
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Action row: time, like, reply */}
                <div className="flex items-center gap-3 mt-1 px-1.5">
                  <span className="text-[10px] text-gray-400">
                    {timeAgo(comment.created_at)}
                  </span>

                  {/* Like comment button */}
                  {onLikeComment && (
                    <button
                      onClick={() => onLikeComment(comment.id)}
                      className={`text-[10px] font-semibold transition-all active:scale-90 ${
                        isCommentLiked
                          ? 'text-red-500 hover:text-red-600'
                          : 'text-gray-400 hover:text-red-400'
                      }`}
                    >
                      {isCommentLiked ? '❤️ Disukai' : 'Suka'}
                    </button>
                  )}

                  {/* Reply button */}
                  {depth < maxDepth && (
                    <button
                      onClick={() => onReply(comment.id)}
                      className="text-[10px] font-semibold text-gray-400 hover:text-blue-500 transition"
                    >
                      Balas
                    </button>
                  )}

                  {/* Like count text */}
                  {commentLikeCount > 0 && (
                    <span className="text-[9px] text-gray-300">
                      {commentLikeCount} suka
                    </span>
                  )}
                </div>

                {/* Comment likers mini-list */}
                {showLikersList && commentLikeCount > 0 && (
                  <CommentLikersList
                    commentLikes={commentLikes}
                    currentUser={currentUser}
                    onViewProfile={onViewProfile}
                    onClose={() => setShowLikersList(false)}
                  />
                )}
              </>
            )}

            {/* Reply input */}
            {isReplying && (
              <div className="mt-2 ml-1 flex items-center gap-2 animate-in slide-in-from-top-1 fade-in duration-200">
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 overflow-hidden">
                  {currentUser.avatar_url ? (
                    <img
                      src={currentUser.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    currentUser.display_name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Balas ${commenterName}...`}
                    className="w-full rounded-full border border-blue-200 bg-white px-3 py-1.5 pr-8 text-[12px] text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        onSubmitReply();
                      }
                      if (e.key === 'Escape') onCancelReply();
                    }}
                  />
                </div>
                <button
                  onClick={onCancelReply}
                  className="text-[10px] text-gray-400 hover:text-gray-600 transition flex-shrink-0"
                >
                  ✕
                </button>
                <button
                  onClick={onSubmitReply}
                  disabled={!replyText.trim()}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600 transition disabled:opacity-30 flex-shrink-0 active:scale-90"
                >
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </button>
              </div>
            )}

            {/* Replies - nested & indented */}
            {replies.length > 0 && (
              <div className="mt-1">
                {!showReplies ? (
                  <button
                    onClick={() => setShowReplies(true)}
                    className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-500 hover:text-blue-600 transition ml-1 mt-1"
                  >
                    <div className="w-6 h-px bg-blue-300" />
                    <span>
                      Lihat {replies.length} balasan
                      {replies.length > 1 ? '' : ''}
                    </span>
                    <svg
                      className="h-2.5 w-2.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                ) : (
                  <>
                    {replies.length > 0 && (
                      <button
                        onClick={() => setShowReplies(false)}
                        className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 hover:text-gray-600 transition ml-1 mt-1"
                      >
                        <div className="w-6 h-px bg-gray-300" />
                        <span>Sembunyikan balasan</span>
                        <svg
                          className="h-2.5 w-2.5 rotate-180"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                    )}
                    {replies
                      .sort(
                        (a, b) =>
                          new Date(a.created_at).getTime() -
                          new Date(b.created_at).getTime()
                      )
                      .map((reply) => (
                        <CommentItem
                          key={reply.id}
                          comment={reply}
                          currentUser={currentUser}
                          depth={depth + 1}
                          allComments={allComments}
                          onViewProfile={onViewProfile}
                          onDeleteComment={onDeleteComment}
                          onEditComment={onEditComment}
                          onLikeComment={onLikeComment}
                          onReply={onReply}
                          replyingTo={replyingTo}
                          replyText={replyText}
                          setReplyText={setReplyText}
                          onSubmitReply={onSubmitReply}
                          onCancelReply={onCancelReply}
                        />
                      ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Comment Likers List ──
function CommentLikersList({
  commentLikes,
  currentUser,
  onViewProfile,
  onClose,
}: {
  commentLikes: CommentLike[];
  currentUser: User;
  onViewProfile?: (user: User) => void;
  onClose: () => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      const ids = commentLikes.map((cl) => cl.user_id);
      const { data } = await supabase.from('users').select('*').in('id', ids);
      setUsers(data || []);
      setLoading(false);
    };
    fetchUsers();
  }, [commentLikes]);

  return (
    <div className="mt-1.5 ml-1 rounded-xl bg-white border border-gray-100 shadow-lg overflow-hidden max-w-[240px] animate-in slide-in-from-top-1 fade-in duration-200">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-50 bg-gradient-to-r from-pink-50 to-red-50">
        <div className="flex items-center gap-1.5">
          <svg
            className="h-3 w-3 text-red-500"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          <span className="text-[10px] font-semibold text-gray-600">
            {commentLikes.length} suka
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition"
        >
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <div
        className="max-h-32 overflow-y-auto p-1.5"
        style={{ scrollbarWidth: 'thin' }}
      >
        {loading ? (
          <div className="flex justify-center py-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" />
          </div>
        ) : (
          users.map((user) => (
            <button
              key={user.id}
              onClick={() => {
                if (onViewProfile) onViewProfile(user);
                onClose();
              }}
              className="flex w-full items-center gap-2 p-1.5 hover:bg-gray-50 rounded-lg transition text-left"
            >
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[8px] font-bold overflow-hidden flex-shrink-0">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  user.display_name.charAt(0).toUpperCase()
                )}
              </div>
              <span className="text-[11px] font-medium text-gray-700 truncate flex-1">
                {user.display_name}
              </span>
              {user.id === currentUser.id && (
                <span className="text-[8px] bg-pink-100 text-pink-500 px-1 py-0.5 rounded-full font-medium flex-shrink-0">
                  Kamu
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main PostCard ──
export function PostCard({
  post,
  currentUser,
  onLike,
  onComment,
  onDeletePost,
  onDeleteComment,
  onEditComment,
  onLikeComment,
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

  // Reply state
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Visible comments
  const COMMENTS_PER_PAGE = 5;
  const [visibleCommentsCount, setVisibleCommentsCount] =
    useState(COMMENTS_PER_PAGE);

  const isLiked =
    post.likes?.some((l: Like) => l.user_id === currentUser.id) || false;
  const likeCount = post.likes?.length || 0;
  const isOwner = post.user_id === currentUser.id;

  const authorName = post.users?.display_name || 'Unknown';
  const authorUsername = post.users?.username || 'unknown';
  const authorAvatar = post.users?.avatar_url;
  const isVideo = post.video_url && post.video_url.length > 0;
  const isEdited = post.updated_at && post.updated_at !== post.created_at;

  const MAX_VISIBLE_LIKERS = 5;

  const fetchLikerUsers = useCallback(async () => {
    if (!post.likes || post.likes.length === 0) return;
    if (likersFetched) return;
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
    if (!showComments) {
      setVisibleCommentsCount(COMMENTS_PER_PAGE);
      setReplyingTo(null);
      setReplyText('');
    }
  }, [showComments]);

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.trim()) {
      onComment(post.id, commentText.trim());
      setCommentText('');
    }
  };

  const handleReply = (commentId: string) => {
    if (replyingTo === commentId) {
      // Toggle off if clicking the same reply button
      setReplyingTo(null);
      setReplyText('');
    } else {
      setReplyingTo(commentId);
      setReplyText('');
    }
  };

  const handleSubmitReply = () => {
    if (replyText.trim() && replyingTo) {
      onComment(post.id, replyText.trim(), replyingTo);
      setReplyingTo(null);
      setReplyText('');
    }
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setReplyText('');
  };

  const handleAuthorClick = () => {
    if (onViewProfile && post.users) onViewProfile(post.users);
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onLike(post.id);
  };

  const visibleLikers = likerUsers.slice(0, MAX_VISIBLE_LIKERS);
  const remainingLikersCount = likerUsers.length - MAX_VISIBLE_LIKERS;

  // Separate top-level comments (no parent_id) and sort by date
  const allComments = post.comments || [];
  const topLevelComments = allComments
    .filter((c) => !c.parent_id)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  const visibleTopComments = topLevelComments.slice(0, visibleCommentsCount);
  const hasMoreComments = topLevelComments.length > visibleCommentsCount;
  const hiddenCommentsCount = topLevelComments.length - visibleCommentsCount;

  // Total count including replies
  const totalInteractions = allComments.length;

  return (
    <div className="bg-white border-b border-gray-100">
      {/* ══════════ Header ══════════ */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          onClick={handleAuthorClick}
          className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-blue-300 transition"
        >
          {authorAvatar ? (
            <img
              src={authorAvatar}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            authorName.charAt(0).toUpperCase()
          )}
        </button>
        <button
          onClick={handleAuthorClick}
          className="flex-1 min-w-0 text-left hover:opacity-80 transition"
        >
          <p className="text-sm font-semibold text-gray-900 truncate">
            {authorName}
          </p>
          <p className="text-xs text-gray-400">
            @{authorUsername} · {timeAgo(post.created_at)}
            {isEdited && (
              <span
                className="ml-1 text-gray-300"
                title={`Diedit ${timeAgo(post.updated_at!)}`}
              >
                ·{' '}
                <span className="italic"></span>
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
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-8 z-20 w-44 rounded-2xl bg-white shadow-xl border border-gray-100 py-1.5 overflow-hidden">
                  {onEditPost && (
                    <>
                      <button
                        onClick={() => {
                          onEditPost(post);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-600 flex items-center gap-2.5 transition-colors"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                        Edit
                      </button>
                      <div className="mx-3 my-0.5 border-t border-gray-100" />
                    </>
                  )}
                  <button
                    onClick={() => {
                      if (confirm('Hapus postingan ini?'))
                        onDeletePost(post.id);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2.5 transition-colors"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
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
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
            {post.content}
          </p>
        </div>
      )}

      {/* ══════════ Image ══════════ */}
      {post.image_url && !isVideo && (
        <div className="mt-1 relative">
          <img
            src={post.image_url}
            alt="Post"
            className="w-full max-h-[80vh] object-contain cursor-pointer hover:brightness-[0.92] transition-all duration-200"
            loading="lazy"
            onClick={(e) => {
              e.stopPropagation();
              setShowLightbox(true);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ══════════ Video ══════════ */}
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
        <ImageLightbox
          src={post.image_url}
          alt={`Foto dari ${authorName}`}
          onClose={() => setShowLightbox(false)}
        />
      )}

      {/* ══════════ Actions ══════════ */}
      <div className="flex border-t border-gray-50">
        <button
          onClick={handleLikeClick}
          className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-all active:scale-95 ${
            isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
          }`}
        >
          {isLiked ? (
            <svg
              className="h-5 w-5 animate-[bounce_0.3s_ease-in-out]"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          ) : (
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
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
                isLiked
                  ? 'bg-red-50 text-red-500'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {likeCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-all active:scale-95 ${
            showComments
              ? 'text-blue-500'
              : 'text-gray-400 hover:text-blue-500'
          }`}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span>Komentar</span>
          {totalInteractions > 0 && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                showComments
                  ? 'bg-blue-50 text-blue-500'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {totalInteractions}
            </span>
          )}
        </button>
      </div>

      {/* ══════════ Likers Row ══════════ */}
      {likeCount > 0 && (
        <div className="px-4 py-2.5 border-t border-gray-50">
          <div className="flex items-center gap-2">
            <div className="flex items-center">
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
                        className="relative h-7 w-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold overflow-hidden flex-shrink-0 ring-2 ring-white hover:ring-pink-200 hover:z-10 hover:scale-110 transition-all duration-200 shadow-sm"
                        title={user.display_name}
                      >
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
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
                          .map((u) =>
                            u.id === currentUser.id
                              ? 'Kamu'
                              : u.display_name
                          )
                          .join(', ')}
                      </span>
                      {likerUsers.length > 2 && (
                        <span>
                          {' '}
                          dan{' '}
                          <span className="font-semibold text-gray-700">
                            {likerUsers.length - 2} lainnya
                          </span>
                        </span>
                      )}
                      {likerUsers.length <= 2 && likerUsers.length > 0 && (
                        <span className="text-gray-400"> menyukai ini</span>
                      )}
                    </p>
                  </div>

                  {remainingLikersCount > 0 && (
                    <button
                      onClick={() => setShowAllLikers(!showAllLikers)}
                      className="ml-2 flex items-center gap-1 text-xs font-medium text-pink-500 hover:text-pink-600 bg-pink-50 hover:bg-pink-100 px-2.5 py-1 rounded-full transition-all flex-shrink-0"
                    >
                      <span>+{remainingLikersCount}</span>
                      <svg
                        className={`h-3 w-3 transition-transform duration-200 ${
                          showAllLikers ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {showAllLikers && remainingLikersCount > 0 && (
            <div className="mt-3">
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: 'rgba(249,250,251,0.8)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(0,0,0,0.05)',
                }}
              >
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center">
                      <svg
                        className="h-3 w-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold text-gray-600">
                      Disukai oleh {likeCount} orang
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAllLikers(false)}
                    className="h-6 w-6 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-black/5 transition"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div
                  className="max-h-48 overflow-y-auto p-2"
                  style={{ scrollbarWidth: 'thin' }}
                >
                  <div className="space-y-0.5">
                    {likerUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => {
                          if (onViewProfile) onViewProfile(user);
                          setShowAllLikers(false);
                        }}
                        className="flex w-full items-center gap-3 p-2.5 hover:bg-white/70 rounded-xl transition group text-left"
                      >
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs overflow-hidden flex-shrink-0 ring-1 ring-white/50 shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200">
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            user.display_name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate leading-tight">
                            {user.display_name}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate leading-tight">
                            @{user.username}
                          </p>
                        </div>
                        {user.id === currentUser.id && (
                          <span className="text-[10px] bg-gradient-to-r from-pink-500 to-red-500 text-white px-2 py-0.5 rounded-full font-medium shadow-sm flex-shrink-0">
                            Kamu
                          </span>
                        )}
                        <svg
                          className="h-3.5 w-3.5 text-gray-300 group-hover:text-pink-400 group-hover:translate-x-0.5 transition-all duration-200 flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ Comments Section ══════════ */}
      {showComments && (
        <div className="border-t border-gray-50 bg-gray-50/50">
          {/* Load more button */}
          {hasMoreComments && (
            <button
              onClick={() =>
                setVisibleCommentsCount((prev) => prev + COMMENTS_PER_PAGE)
              }
              className="w-full py-2.5 text-xs font-medium text-blue-500 hover:text-blue-600 hover:bg-blue-50/50 transition flex items-center justify-center gap-1.5"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 15l7-7 7 7"
                />
              </svg>
              <span>Lihat {hiddenCommentsCount} komentar lainnya</span>
            </button>
          )}

          {/* Comments list */}
          {topLevelComments.length > 0 && (
            <div
              className="overflow-y-auto px-4 pt-3 pb-2 space-y-3"
              style={{ maxHeight: '500px', scrollbarWidth: 'thin' }}
            >
              {visibleTopComments.map((comment: Comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUser={currentUser}
                  depth={0}
                  allComments={allComments}
                  onViewProfile={onViewProfile}
                  onDeleteComment={onDeleteComment}
                  onEditComment={onEditComment}
                  onLikeComment={onLikeComment}
                  onReply={handleReply}
                  replyingTo={replyingTo}
                  replyText={replyText}
                  setReplyText={setReplyText}
                  onSubmitReply={handleSubmitReply}
                  onCancelReply={handleCancelReply}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {topLevelComments.length === 0 && (
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
              <p className="text-sm text-gray-400 font-medium">
                Belum ada komentar
              </p>
              <p className="text-xs text-gray-300 mt-1">
                Jadilah yang pertama berkomentar 💬
              </p>
            </div>
          )}

          {/* Comment input */}
          <form
            onSubmit={handleSubmitComment}
            className="flex items-center gap-2.5 p-3 border-t border-gray-100/50 bg-white"
          >
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 overflow-hidden shadow-sm">
              {currentUser.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
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
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-30 disabled:hover:scale-100 disabled:hover:shadow-md flex-shrink-0 active:scale-95"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
