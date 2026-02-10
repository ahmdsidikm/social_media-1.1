import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sdpkszleuubddfovgkfy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkcGtzemxldXViZGRmb3Zna2Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MDU5OTMsImV4cCI6MjA4NTk4MTk5M30.Ir5ftpwkYLGI6r516cxhN0xac2cQNb38200jKOTDKv0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type User = {
  id: string;
  username: string;
  display_name: string;
  password: string;
  avatar_url: string;
  cover_url: string;
  bio: string;
  created_at: string;
};

export type Post = {
  id: string;
  user_id: string;
  content: string;
  image_url: string;
  video_url: string;
  created_at: string;
  users?: User;
  likes?: Like[];
  comments?: Comment[];
};

export type Like = {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
};

export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  users?: User;
};

export type Follower = {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
};

export type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image_url: string;
  is_read: boolean;
  created_at: string;
  sender?: User;
  receiver?: User;
};

export type Group = {
  id: string;
  name: string;
  description: string;
  image_url: string;
  creator_id: string;
  created_at: string;
  creator?: User;
  member_count?: number;
};

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  role: string;
  created_at: string;
  users?: User;
};

export type GroupMessage = {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  image_url: string;
  created_at: string;
  users?: User;
};

export type Story = {
  id: string;
  user_id: string;
  image_url: string;
  caption: string;
  created_at: string;
  expires_at: string;
  users?: User;
};

export function timeAgo(dateStr: string) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'Baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}j`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}h`;
  return date.toLocaleDateString('id-ID');
}
