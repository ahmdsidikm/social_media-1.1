// components/Feed.tsx

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Post, User } from '../lib/supabase';
import { PostCard } from './PostCard';

type FeedProps = {
  currentUser: User;
  posts?: Post[];
  onRefresh?: () => void;
  onViewProfile?: (user: User) => void;
  onEditPost?: (post: Post) => void;
};

export function Feed({ currentUser, posts: externalPosts, onRefresh, onViewProfile, onEditPost }: FeedProps) {
  const [internalPosts, setInternalPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(!externalPosts);

  const posts = externalPosts || internalPosts;

  // Fetch posts (hanya jika tidak ada externalPosts)
  const fetchPosts = useCallback(async () => {
    if (externalPosts) return;

    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        users (*),
        likes (*),
        comments (
          *,
          users (*),
          comment_likes (*),
          comment_replies (
            *,
            users (*),
            reply_likes (*)
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setInternalPosts(data);
    }
    setLoading(false);
  }, [externalPosts]);

  useEffect(() => {
    fetchPosts();

    if (!externalPosts) {
      const channel = supabase
        .channel('feed-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, fetchPosts)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, fetchPosts)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, fetchPosts)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_likes' }, fetchPosts)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_replies' }, fetchPosts)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reply_likes' }, fetchPosts)
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [fetchPosts, externalPosts]);

  const refresh = () => {
    if (onRefresh) onRefresh();
    else fetchPosts();
  };

  // ── Like Post ──
  const handleLikePost = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    const existing = post?.likes?.find(l => l.user_id === currentUser.id);

    if (existing) {
      await supabase.from('likes').delete().eq('id', existing.id);
    } else {
      await supabase.from('likes').insert({ user_id: currentUser.id, post_id: postId });
    }
    refresh();
  };

  // ── Comment ──
  const handleComment = async (postId: string, content: string) => {
    await supabase.from('comments').insert({
      user_id: currentUser.id,
      post_id: postId,
      content,
    });
    refresh();
  };

  // ── Delete Post ──
  const handleDeletePost = async (postId: string) => {
    await supabase.from('posts').delete().eq('id', postId);
    refresh();
  };

  // ── Delete Comment ──
  const handleDeleteComment = async (commentId: string) => {
    await supabase.from('comments').delete().eq('id', commentId);
    refresh();
  };

  // ── Edit Comment ──
  const handleEditComment = async (commentId: string, newContent: string) => {
    await supabase
      .from('comments')
      .update({ content: newContent, updated_at: new Date().toISOString() })
      .eq('id', commentId)
      .eq('user_id', currentUser.id);
    refresh();
  };

  // ── Like Comment ──
  const handleLikeComment = async (commentId: string) => {
    const { data: existing } = await supabase
      .from('comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', currentUser.id)
      .single();

    if (existing) {
      await supabase.from('comment_likes').delete().eq('id', existing.id);
    } else {
      await supabase.from('comment_likes').insert({ user_id: currentUser.id, comment_id: commentId });
    }
    refresh();
  };

  // ── Reply to Comment ──
  const handleReplyComment = async (commentId: string, content: string) => {
    await supabase.from('comment_replies').insert({
      comment_id: commentId,
      user_id: currentUser.id,
      content,
    });
    refresh();
  };

  // ── Delete Reply ──
  const handleDeleteReply = async (replyId: string) => {
    await supabase.from('comment_replies').delete().eq('id', replyId);
    refresh();
  };

  // ── Edit Reply ──
  const handleEditReply = async (replyId: string, newContent: string) => {
    await supabase
      .from('comment_replies')
      .update({ content: newContent, updated_at: new Date().toISOString() })
      .eq('id', replyId)
      .eq('user_id', currentUser.id);
    refresh();
  };

  // ── Like Reply ──
  const handleLikeReply = async (replyId: string) => {
    const { data: existing } = await supabase
      .from('reply_likes')
      .select('id')
      .eq('reply_id', replyId)
      .eq('user_id', currentUser.id)
      .single();

    if (existing) {
      await supabase.from('reply_likes').delete().eq('id', existing.id);
    } else {
      await supabase.from('reply_likes').insert({ user_id: currentUser.id, reply_id: replyId });
    }
    refresh();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />
        <p className="text-sm text-gray-400">Memuat postingan...</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        </div>
        <p className="text-gray-500 font-medium">Belum ada postingan</p>
        <p className="text-sm text-gray-400 mt-1">Buat postingan pertamamu!</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {posts.map(post => (
        <PostCard
          key={post.id}
          post={post}
          currentUser={currentUser}
          onLike={handleLikePost}
          onComment={handleComment}
          onDeletePost={handleDeletePost}
          onDeleteComment={handleDeleteComment}
          onEditComment={handleEditComment}
          onLikeComment={handleLikeComment}
          onReplyComment={handleReplyComment}
          onDeleteReply={handleDeleteReply}
          onEditReply={handleEditReply}
          onLikeReply={handleLikeReply}
          onViewProfile={onViewProfile}
          onEditPost={onEditPost}
        />
      ))}
    </div>
  );
}
