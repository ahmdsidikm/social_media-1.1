// components/Feed.tsx

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Post, User } from '../lib/supabase';
import { PostCard } from './PostCard';

type FeedProps = {
  currentUser: User;
  onViewProfile?: (user: User) => void;
  onEditPost?: (post: Post) => void;
};

export function Feed({ currentUser, onViewProfile, onEditPost }: FeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Fetch semua posts beserta relasi ──
  const fetchPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        users (*),
        likes (*),
        comments (
          *,
          users (*),
          comment_likes (*)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching posts:', error);
      return;
    }

    setPosts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPosts();

    // Realtime: auto-refresh saat ada perubahan
    const channel = supabase
      .channel('feed-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, fetchPosts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, fetchPosts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, fetchPosts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_likes' }, fetchPosts)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPosts]);

  // ── Like / Unlike Post ──
  const handleLikePost = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    const existingLike = post?.likes?.find(l => l.user_id === currentUser.id);

    if (existingLike) {
      // Unlike
      await supabase.from('likes').delete().eq('id', existingLike.id);

      setPosts(prev =>
        prev.map(p =>
          p.id === postId
            ? { ...p, likes: p.likes?.filter(l => l.id !== existingLike.id) }
            : p
        )
      );
    } else {
      // Like
      const { data } = await supabase
        .from('likes')
        .insert({ user_id: currentUser.id, post_id: postId })
        .select('*')
        .single();

      if (data) {
        setPosts(prev =>
          prev.map(p =>
            p.id === postId
              ? { ...p, likes: [...(p.likes || []), data] }
              : p
          )
        );
      }
    }
  };

  // ── Tambah Komentar (+ Reply dengan parentId) ──
  const handleComment = async (postId: string, content: string, parentId?: string) => {
    const insertData: Record<string, string> = {
      user_id: currentUser.id,
      post_id: postId,
      content,
    };

    if (parentId) {
      insertData.parent_id = parentId;
    }

    const { data, error } = await supabase
      .from('comments')
      .insert(insertData)
      .select(`
        *,
        users (*),
        comment_likes (*)
      `)
      .single();

    if (error) {
      console.error('Error adding comment:', error);
      return;
    }

    if (data) {
      setPosts(prev =>
        prev.map(p =>
          p.id === postId
            ? { ...p, comments: [...(p.comments || []), data] }
            : p
        )
      );
    }
  };

  // ── Hapus Post ──
  const handleDeletePost = async (postId: string) => {
    const { error } = await supabase.from('posts').delete().eq('id', postId);

    if (error) {
      console.error('Error deleting post:', error);
      return;
    }

    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  // ── Hapus Komentar (beserta balasan-balasannya) ──
  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);

    if (error) {
      console.error('Error deleting comment:', error);
      return;
    }

    // Hapus komentar + semua reply yang parent_id = commentId
    setPosts(prev =>
      prev.map(p => ({
        ...p,
        comments: p.comments?.filter(
          c => c.id !== commentId && c.parent_id !== commentId
        ),
      }))
    );
  };

  // ── Edit Komentar (hanya pemilik) ──
  const handleEditComment = async (commentId: string, newContent: string) => {
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('comments')
      .update({
        content: newContent,
        updated_at: now,
      })
      .eq('id', commentId)
      .eq('user_id', currentUser.id); // Keamanan: hanya pemilik

    if (error) {
      console.error('Error editing comment:', error);
      return;
    }

    // Optimistic update
    setPosts(prev =>
      prev.map(p => ({
        ...p,
        comments: p.comments?.map(c =>
          c.id === commentId
            ? { ...c, content: newContent, updated_at: now }
            : c
        ),
      }))
    );
  };

  // ── Like / Unlike Komentar ──
  const handleLikeComment = async (commentId: string) => {
    // Cari apakah sudah di-like
    let existingLike: { id: string } | undefined;
    let targetPostId: string | undefined;

    for (const post of posts) {
      const comment = post.comments?.find(c => c.id === commentId);
      if (comment) {
        targetPostId = post.id;
        existingLike = comment.comment_likes?.find(
          cl => cl.user_id === currentUser.id
        );
        break;
      }
    }

    if (!targetPostId) return;

    if (existingLike) {
      // Unlike komentar
      const { error } = await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', currentUser.id);

      if (error) {
        console.error('Error unliking comment:', error);
        return;
      }

      setPosts(prev =>
        prev.map(p => ({
          ...p,
          comments: p.comments?.map(c =>
            c.id === commentId
              ? {
                  ...c,
                  comment_likes: c.comment_likes?.filter(
                    cl => cl.user_id !== currentUser.id
                  ),
                }
              : c
          ),
        }))
      );
    } else {
      // Like komentar
      const { data, error } = await supabase
        .from('comment_likes')
        .insert({
          user_id: currentUser.id,
          comment_id: commentId,
        })
        .select('*')
        .single();

      if (error) {
        console.error('Error liking comment:', error);
        return;
      }

      if (data) {
        setPosts(prev =>
          prev.map(p => ({
            ...p,
            comments: p.comments?.map(c =>
              c.id === commentId
                ? {
                    ...c,
                    comment_likes: [...(c.comment_likes || []), data],
                  }
                : c
            ),
          }))
        );
      }
    }
  };

  // ── Loading State ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />
        <p className="text-sm text-gray-400">Memuat postingan...</p>
      </div>
    );
  }

  // ── Empty State ──
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

  // ── Render Posts ──
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
          onViewProfile={onViewProfile}
          onEditPost={onEditPost}
        />
      ))}
    </div>
  );
}
