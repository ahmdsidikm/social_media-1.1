// components/PostCard.tsx

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Post, User, Like, Comment, CommentLike, CommentReply, ReplyLike } from '../lib/supabase';
import { timeAgo, supabase } from '../lib/supabase';
import { ImageLightbox } from './ImageLightbox';

type Props = {
  post: Post;
  currentUser: User;
  onLike: (postId: string) => void;
  onComment: (postId: string, content: string) => void;
  onDeletePost: (postId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onEditComment: (commentId: string, newContent: string) => void;
  onLikeComment: (commentId: string) => void;
  onReplyComment: (commentId: string, content: string) => void;
  onDeleteReply: (replyId: string) => void;
  onEditReply: (replyId: string, newContent: string) => void;
  onLikeReply: (replyId: string) => void;
  onViewProfile?: (user: User) => void;
  onEditPost?: (post: Post) => void;
};

/* ═══════════════════════════════════════════
   Reply Item (balasan komentar - tabel terpisah)
   ═══════════════════════════════════════════ */
function ReplyItem({
  reply,
  currentUser,
  parentCommentUser,
  onViewProfile,
  onDeleteReply,
  onEditReply,
  onLikeReply,
}: {
  reply: CommentReply;
  currentUser: User;
  parentCommentUser?: User;
  onViewProfile?: (user: User) => void;
  onDeleteReply: (replyId: string) => void;
  onEditReply: (replyId: string, newContent: string) => void;
  onLikeReply: (replyId: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(reply.content);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const replyUser = reply.users;
  const replyName = replyUser?.display_name || 'Unknown';
  const replyAvatar = replyUser?.avatar_url;
  const isOwner = reply.user_id === currentUser.id;
  const isEdited = reply.updated_at && reply.updated_at !== reply.created_at;

  const replyLikes = reply.reply_likes || [];
  const isLiked = replyLikes.some((rl: ReplyLike) => rl.user_id === currentUser.id);
  const likeCount = replyLikes.length;

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.selectionStart = editRef.current.value.length;
    }
  }, [isEditing]);

  const handleSaveEdit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== reply.content) {
      onEditReply(reply.id, trimmed);
    }
    setIsEditing(false);
  };

  return (
    <div className="ml-10 mt-2.5 flex items-start gap-2 group/reply relative">
      {/* Garis penghubung ke komentar induk */}
      <div className="absolute -left-[0.35rem] top-0 w-4 h-3 border-l-2 border-b-2 border-gray-200 rounded-bl-lg" />

      {/* Avatar */}
      <button
        onClick={() => { if (onViewProfile && replyUser) onViewProfile(replyUser); }}
        className="h-6 w-6 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 overflow-hidden hover:ring-2 hover:ring-emerald-200 transition shadow-sm"
      >
        {replyAvatar ? (
          <img src={replyAvatar} alt="" className="h-full w-full object-cover" />
        ) : (
          replyName.charAt(0).toUpperCase()
        )}
      </button>

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="rounded-2xl bg-white px-3 py-2 shadow-sm border-2 border-emerald-200">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[11px] font-semibold text-gray-800">{replyName}</span>
              <span className="text-[8px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">mengedit</span>
            </div>
            <textarea
              ref={editRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full text-[11px] text-gray-700 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-50 resize-none transition"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                if (e.key === 'Escape') { setEditText(reply.content); setIsEditing(false); }
              }}
            />
            <div className="flex items-center justify-end gap-1 mt-1">
              <button onClick={() => { setEditText(reply.content); setIsEditing(false); }} className="px-2 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100 rounded-lg transition">Batal</button>
              <button onClick={handleSaveEdit} disabled={!editText.trim() || editText.trim() === reply.content} className="px-2 py-0.5 text-[10px] font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition disabled:opacity-40">Simpan</button>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-emerald-50/60 px-3 py-2 shadow-sm border border-emerald-100/50 relative inline-block max-w-full">
              <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                <button
                  onClick={() => { if (onViewProfile && replyUser) onViewProfile(replyUser); }}
                  className="text-[11px] font-semibold text-gray-800 hover:text-emerald-600 transition"
                >
                  {replyName}
                </button>
                {isOwner && <span className="text-[7px] bg-emerald-100 text-emerald-500 px-1 py-0.5 rounded-full font-medium">kamu</span>}
                {isEdited && <span className="text-[7px] text-gray-300 italic">· diedit</span>}
              </div>

              {/* Mention siapa yang dibalas */}
              {parentCommentUser && (
                <p className="text-[9px] text-emerald-500 mb-0.5 flex items-center gap-1">
                  <span>↩</span>
                  <span>membalas <span className="font-semibold">{parentCommentUser.display_name}</span></span>
                </p>
              )}

              <p className="text-[11px] text-gray-600 leading-relaxed break-words whitespace-pre-wrap">{reply.content}</p>

              {/* Like badge */}
              {likeCount > 0 && (
                <div className="absolute -bottom-2 right-2 flex items-center gap-0.5 bg-white rounded-full px-1.5 py-0.5 shadow border border-gray-100">
                  <svg className="h-2 w-2 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                  <span className="text-[8px] font-semibold text-gray-500">{likeCount}</span>
                </div>
              )}

              {/* Menu (owner only) */}
              {isOwner && (
                <div className="absolute top-1 right-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                    className="h-4 w-4 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 opacity-0 group-hover/reply:opacity-100 transition-all"
                  >
                    <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="6" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="18" cy="12" r="1.5" />
                    </svg>
                  </button>
                  {showMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                      <div className="absolute right-0 top-5 z-20 w-32 rounded-xl bg-white shadow-xl border border-gray-100 py-1 overflow-hidden">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditText(reply.content); setIsEditing(true); setShowMenu(false); }}
                          className="w-full px-3 py-1.5 text-left text-[10px] text-gray-700 hover:bg-amber-50 hover:text-amber-600 flex items-center gap-1.5 transition-colors"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); if (confirm('Hapus balasan ini?')) onDeleteReply(reply.id); setShowMenu(false); }}
                          className="w-full px-3 py-1.5 text-left text-[10px] text-red-500 hover:bg-red-50 flex items-center gap-1.5 transition-colors"
                        >
                          🗑️ Hapus
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-0.5 px-1.5">
              <span className="text-[9px] text-gray-400">{timeAgo(reply.created_at)}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onLikeReply(reply.id); }}
                className={`text-[9px] font-semibold transition active:scale-90 ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}
              >
                {isLiked ? '❤️ Disukai' : 'Suka'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Comment Item (komentar utama)
   ═══════════════════════════════════════════ */
function CommentItem({
  comment,
  currentUser,
  onViewProfile,
  onDeleteComment,
  onEditComment,
  onLikeComment,
  onReplyComment,
  onDeleteReply,
  onEditReply,
  onLikeReply,
}: {
  comment: Comment;
  currentUser: User;
  onViewProfile?: (user: User) => void;
  onDeleteComment: (commentId: string) => void;
  onEditComment: (commentId: string, newContent: string) => void;
  onLikeComment: (commentId: string) => void;
  onReplyComment: (commentId: string, content: string) => void;
  onDeleteReply: (replyId: string) => void;
  onEditReply: (replyId: string, newContent: string) => void;
  onLikeReply: (replyId: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [showReplies, setShowReplies] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);

  const commenterName = comment.users?.display_name || 'Unknown';
  const commenterAvatar = comment.users?.avatar_url;
  const isOwner = comment.user_id === currentUser.id;
  const isEdited = comment.updated_at && comment.updated_at !== comment.created_at;

  const commentLikes = comment.comment_likes || [];
  const isLiked = commentLikes.some((cl: CommentLike) => cl.user_id === currentUser.id);
  const likeCount = commentLikes.length;

  const replies = comment.comment_replies || [];
  const replyCount = replies.length;

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.selectionStart = editRef.current.value.length;
    }
  }, [isEditing]);

  useEffect(() => {
    if (isReplying && replyInputRef.current) {
      setTimeout(() => replyInputRef.current?.focus(), 100);
    }
  }, [isReplying]);

  const handleSaveEdit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== comment.content) {
      onEditComment(comment.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleSubmitReply = async () => {
    const trimmed = replyText.trim();
    if (!trimmed || sending) return;

    console.log('Submitting reply:', trimmed, 'to comment:', comment.id);
    setSending(true);

    try {
      await onReplyComment(comment.id, trimmed);
      setReplyText('');
      setIsReplying(false);
      setShowReplies(true);
    } catch (err) {
      console.error('Reply failed:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-start gap-2 group/comment">
        {/* Avatar */}
        <button
          onClick={() => { if (onViewProfile && comment.users) onViewProfile(comment.users); }}
          className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 overflow-hidden hover:ring-2 hover:ring-blue-200 transition shadow-sm"
        >
          {commenterAvatar ? (
            <img src={commenterAvatar} alt="" className="h-full w-full object-cover" />
          ) : (
            commenterName.charAt(0).toUpperCase()
          )}
        </button>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            /* ── Edit Mode ── */
            <div className="rounded-2xl bg-white px-3 py-2 shadow-sm border-2 border-blue-200">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[12px] font-semibold text-gray-800">{commenterName}</span>
                <span className="text-[8px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">mengedit</span>
              </div>
              <textarea
                ref={editRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full text-[12px] text-gray-700 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-50 resize-none transition"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                  if (e.key === 'Escape') { setEditText(comment.content); setIsEditing(false); }
                }}
              />
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[9px] text-gray-400">Enter simpan · Esc batal</span>
                <div className="flex gap-1">
                  <button onClick={() => { setEditText(comment.content); setIsEditing(false); }} className="px-2 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100 rounded-lg transition">Batal</button>
                  <button onClick={handleSaveEdit} disabled={!editText.trim() || editText.trim() === comment.content} className="px-2 py-0.5 text-[10px] font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition disabled:opacity-40">Simpan</button>
                </div>
              </div>
            </div>
          ) : (
            /* ── Display Mode ── */
            <>
              <div className="rounded-2xl bg-gray-50 px-3 py-2 shadow-sm border border-gray-100/50 relative inline-block max-w-full">
                <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                  <button
                    onClick={() => { if (onViewProfile && comment.users) onViewProfile(comment.users); }}
                    className="text-[12px] font-semibold text-gray-800 hover:text-blue-600 transition"
                  >
                    {commenterName}
                  </button>
                  {isOwner && <span className="text-[7px] bg-blue-100 text-blue-500 px-1 py-0.5 rounded-full font-medium">kamu</span>}
                  {isEdited && <span className="text-[7px] text-gray-300 italic" title={`Diedit ${timeAgo(comment.updated_at!)}`}>· diedit</span>}
                </div>
                <p className="text-[12px] text-gray-600 leading-relaxed break-words whitespace-pre-wrap">{comment.content}</p>

                {/* Like badge */}
                {likeCount > 0 && (
                  <div className="absolute -bottom-2.5 right-2 flex items-center gap-0.5 bg-white rounded-full px-1.5 py-0.5 shadow-md border border-gray-100">
                    <svg className="h-2.5 w-2.5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                    <span className="text-[9px] font-semibold text-gray-600">{likeCount}</span>
                  </div>
                )}

                {/* Menu (owner only) - SELALU TAMPIL UNTUK OWNER */}
                {isOwner && (
                  <div className="absolute top-1.5 right-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                      className="h-5 w-5 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-200/50 opacity-0 group-hover/comment:opacity-100 transition-all"
                    >
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="6" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="18" cy="12" r="1.5" />
                      </svg>
                    </button>
                    {showMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                        <div className="absolute right-0 top-6 z-20 w-40 rounded-xl bg-white shadow-xl border border-gray-100 py-1 overflow-hidden">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditText(comment.content);
                              setIsEditing(true);
                              setShowMenu(false);
                            }}
                            className="w-full px-3 py-2 text-left text-[11px] text-gray-700 hover:bg-amber-50 hover:text-amber-600 flex items-center gap-2 transition-colors"
                          >
                            ✏️ Edit komentar
                          </button>
                          <div className="mx-2 border-t border-gray-100" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('Hapus komentar ini beserta semua balasannya?')) {
                                onDeleteComment(comment.id);
                              }
                              setShowMenu(false);
                            }}
                            className="w-full px-3 py-2 text-left text-[11px] text-red-500 hover:bg-red-50 flex items-center gap-2 transition-colors"
                          >
                            🗑️ Hapus
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Action row: time, like, reply */}
              <div className="flex items-center gap-3 mt-1 px-1.5">
                <span className="text-[10px] text-gray-400">{timeAgo(comment.created_at)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onLikeComment(comment.id); }}
                  className={`text-[10px] font-semibold transition active:scale-90 ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}
                >
                  {isLiked ? '❤️ Disukai' : 'Suka'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsReplying(!isReplying);
                    if (isReplying) setReplyText('');
                  }}
                  className={`text-[10px] font-semibold transition ${isReplying ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500'}`}
                >
                  💬 Balas
                </button>
              </div>
            </>
          )}

          {/* ── Reply Input Box ── */}
          {isReplying && (
            <div className="mt-2 ml-2 rounded-2xl border border-blue-200 bg-white shadow-sm overflow-hidden">
              <div className="px-3 py-1.5 bg-blue-50/50 border-b border-blue-100">
                <p className="text-[9px] text-blue-500 font-medium">
                  ↩ Membalas <span className="font-semibold">{commenterName}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 p-2">
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 overflow-hidden">
                  {currentUser.avatar_url ? (
                    <img src={currentUser.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    currentUser.display_name.charAt(0).toUpperCase()
                  )}
                </div>
                <input
                  ref={replyInputRef}
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Tulis balasan untuk ${commenterName}...`}
                  className="flex-1 text-[11px] text-gray-800 placeholder-gray-400 bg-gray-50 rounded-full px-3 py-1.5 border border-gray-200 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-100 transition"
                  disabled={sending}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSubmitReply();
                    }
                    if (e.key === 'Escape') {
                      setIsReplying(false);
                      setReplyText('');
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsReplying(false);
                    setReplyText('');
                  }}
                  className="text-[9px] text-gray-400 hover:text-gray-600 transition flex-shrink-0 px-1"
                >
                  ✕
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSubmitReply();
                  }}
                  disabled={!replyText.trim() || sending}
                  className="h-7 w-7 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 transition disabled:opacity-30 active:scale-90 flex-shrink-0"
                >
                  {sending ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── Replies Section (dari tabel comment_replies) ── */}
          {replyCount > 0 && (
            <div className="mt-1.5 relative">
              {/* Garis vertikal penghubung */}
              <div className="absolute left-[0.55rem] top-0 bottom-2 w-px bg-gray-200/80" />

              {!showReplies ? (
                <button
                  onClick={() => setShowReplies(true)}
                  className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-500 hover:text-blue-600 transition ml-2 mt-1"
                >
                  <div className="w-5 h-px bg-blue-300" />
                  <span>Lihat {replyCount} balasan</span>
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setShowReplies(false)}
                    className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 hover:text-gray-600 transition ml-2 mt-1 mb-1"
                  >
                    <div className="w-5 h-px bg-gray-300" />
                    <span>Sembunyikan {replyCount} balasan</span>
                    <svg className="h-2.5 w-2.5 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {replies
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .map((reply) => (
                      <ReplyItem
                        key={reply.id}
                        reply={reply}
                        currentUser={currentUser}
                        parentCommentUser={comment.users}
                        onViewProfile={onViewProfile}
                        onDeleteReply={onDeleteReply}
                        onEditReply={onEditReply}
                        onLikeReply={onLikeReply}
                      />
                    ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Main PostCard
   ═══════════════════════════════════════════ */
export function PostCard({
  post,
  currentUser,
  onLike,
  onComment,
  onDeletePost,
  onDeleteComment,
  onEditComment,
  onLikeComment,
  onReplyComment,
  onDeleteReply,
  onEditReply,
  onLikeReply,
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
  const totalReplies = allComments.reduce((sum, c) => sum + (c.comment_replies?.length || 0), 0);
  const totalInteractions = allComments.length + totalReplies;

  const sortedComments = [...allComments].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
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
    } catch { setLikerUsers([]); }
    setLikersLoading(false);
  }, [post.likes, likersFetched]);

  useEffect(() => { if (likeCount > 0 && !likersFetched) fetchLikerUsers(); }, [likeCount, likersFetched, fetchLikerUsers]);
  useEffect(() => { setLikersFetched(false); }, [likeCount]);
  useEffect(() => { if (!showComments) setVisibleCommentsCount(COMMENTS_PER_PAGE); }, [showComments]);

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
          onClick={() => { if (onViewProfile && post.users) onViewProfile(post.users); }}
          className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-blue-300 transition"
        >
          {authorAvatar ? <img src={authorAvatar} alt="" className="h-full w-full object-cover" /> : authorName.charAt(0).toUpperCase()}
        </button>
        <button onClick={() => { if (onViewProfile && post.users) onViewProfile(post.users); }} className="flex-1 min-w-0 text-left hover:opacity-80 transition">
          <p className="text-sm font-semibold text-gray-900 truncate">{authorName}</p>
          <p className="text-xs text-gray-400">
            @{authorUsername} · {timeAgo(post.created_at)}
            {isEdited && <span className="ml-1 text-gray-300">· <span className="italic">diedit</span></span>}
          </p>
        </button>
        {isOwner && (
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-8 z-20 w-44 rounded-2xl bg-white shadow-xl border border-gray-100 py-1.5">
                  {onEditPost && (
                    <>
                      <button onClick={() => { onEditPost(post); setShowMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-600 flex items-center gap-2.5 transition-colors">✏️ Edit</button>
                      <div className="mx-3 my-0.5 border-t border-gray-100" />
                    </>
                  )}
                  <button onClick={() => { if (confirm('Hapus postingan ini?')) onDeletePost(post.id); setShowMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2.5 transition-colors">🗑️ Hapus</button>
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
          <img src={post.image_url} alt="Post" className="w-full max-h-[80vh] object-contain cursor-pointer hover:brightness-[0.92] transition" loading="lazy" onClick={() => setShowLightbox(true)} />
        </div>
      )}

      {/* Video */}
      {isVideo && (
        <div className="mt-1">
          <video src={post.video_url} controls className="w-full max-h-[500px] bg-black" preload="metadata" />
        </div>
      )}

      {showLightbox && post.image_url && (
        <ImageLightbox src={post.image_url} alt={`Foto dari ${authorName}`} onClose={() => setShowLightbox(false)} />
      )}

      {/* Like & Comment Buttons */}
      <div className="flex border-t border-gray-50">
        <button
          onClick={(e) => { e.stopPropagation(); onLike(post.id); }}
          className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-all active:scale-95 ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}
        >
          {isLiked ? (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
          )}
          <span>{isLiked ? 'Disukai' : 'Suka'}</span>
          {likeCount > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${isLiked ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'}`}>{likeCount}</span>}
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-all active:scale-95 ${showComments ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500'}`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          <span>Komentar</span>
          {totalInteractions > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${showComments ? 'bg-blue-50 text-blue-500' : 'bg-gray-100 text-gray-500'}`}>{totalInteractions}</span>}
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
                  {visibleLikers.map(user => (
                    <button key={user.id} onClick={() => { if (onViewProfile) onViewProfile(user); }} className="relative h-7 w-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold overflow-hidden flex-shrink-0 ring-2 ring-white hover:ring-pink-200 hover:z-10 hover:scale-110 transition-all shadow-sm" title={user.display_name}>
                      {user.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" /> : user.display_name.charAt(0).toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="ml-2.5 flex-1 min-w-0">
                  <p className="text-xs text-gray-500 truncate">
                    <span className="font-semibold text-gray-700">{visibleLikers.slice(0, 2).map(u => u.id === currentUser.id ? 'Kamu' : u.display_name).join(', ')}</span>
                    {likerUsers.length > 2 && <span> dan <span className="font-semibold text-gray-700">{likerUsers.length - 2} lainnya</span></span>}
                    {likerUsers.length <= 2 && <span className="text-gray-400"> menyukai ini</span>}
                  </p>
                </div>
                {remainingLikersCount > 0 && (
                  <button onClick={() => setShowAllLikers(!showAllLikers)} className="ml-2 flex items-center gap-1 text-xs font-medium text-pink-500 bg-pink-50 hover:bg-pink-100 px-2.5 py-1 rounded-full transition flex-shrink-0">
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
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto p-2" style={{ scrollbarWidth: 'thin' }}>
                {likerUsers.map(user => (
                  <button key={user.id} onClick={() => { if (onViewProfile) onViewProfile(user); setShowAllLikers(false); }} className="flex w-full items-center gap-3 p-2.5 hover:bg-white rounded-xl transition text-left">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs overflow-hidden flex-shrink-0 shadow-sm">
                      {user.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" /> : user.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{user.display_name}</p>
                      <p className="text-[11px] text-gray-400 truncate">@{user.username}</p>
                    </div>
                    {user.id === currentUser.id && <span className="text-[10px] bg-pink-500 text-white px-2 py-0.5 rounded-full font-medium flex-shrink-0">Kamu</span>}
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
            <button onClick={() => setVisibleCommentsCount(prev => prev + COMMENTS_PER_PAGE)} className="w-full py-2.5 text-xs font-medium text-blue-500 hover:bg-blue-50/50 transition flex items-center justify-center gap-1.5">
              ▲ Lihat {hiddenCount} komentar lainnya
            </button>
          )}

          {sortedComments.length > 0 ? (
            <div className="overflow-y-auto px-4 pt-3 pb-2 space-y-4" style={{ maxHeight: '500px', scrollbarWidth: 'thin' }}>
              {visibleComments.map(comment => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUser={currentUser}
                  onViewProfile={onViewProfile}
                  onDeleteComment={onDeleteComment}
                  onEditComment={onEditComment}
                  onLikeComment={onLikeComment}
                  onReplyComment={onReplyComment}
                  onDeleteReply={onDeleteReply}
                  onEditReply={onEditReply}
                  onLikeReply={onLikeReply}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <svg className="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400 font-medium">Belum ada komentar</p>
              <p className="text-xs text-gray-300 mt-1">Jadilah yang pertama berkomentar 💬</p>
            </div>
          )}

          {/* Comment input */}
          <form onSubmit={handleSubmitComment} className="flex items-center gap-2.5 p-3 border-t border-gray-100/50 bg-white">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 overflow-hidden shadow-sm">
              {currentUser.avatar_url ? <img src={currentUser.avatar_url} alt="" className="h-full w-full object-cover" /> : currentUser.display_name.charAt(0).toUpperCase()}
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
