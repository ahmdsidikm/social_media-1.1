import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '../lib/supabase';

type Props = {
  onLogin: (user: User) => void;
};

export function LoginPage({ onLogin }: Props) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Username dan password wajib diisi');
      return;
    }
    setSubmitting(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.trim().toLowerCase())
      .single();

    if (fetchError || !data) {
      setError('Username tidak ditemukan. Silakan daftar terlebih dahulu.');
      setSubmitting(false);
      return;
    }

    if (data.password !== password) {
      setError('Password salah!');
      setSubmitting(false);
      return;
    }

    onLogin(data);
    setSubmitting(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !displayName.trim() || !password) {
      setError('Semua field wajib diisi');
      return;
    }
    if (password.length < 4) {
      setError('Password minimal 4 karakter');
      return;
    }
    setSubmitting(true);
    setError('');

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username.trim().toLowerCase())
      .single();

    if (existing) {
      setError('Username sudah digunakan');
      setSubmitting(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from('users')
      .insert({
        username: username.trim().toLowerCase(),
        display_name: displayName.trim(),
        password: password,
      })
      .select()
      .single();

    if (insertError) {
      setError('Gagal mendaftar: ' + insertError.message);
      setSubmitting(false);
      return;
    }

    if (data) {
      onLogin(data);
    }
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-xl">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">SosmedKu</h1>
          <p className="mt-1 text-white/80">Media Sosial Sederhana</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-2xl">
          <h2 className="mb-6 text-center text-xl font-bold text-gray-800">
            {isRegister ? 'Daftar Akun Baru' : 'Masuk ke Akun'}
          </h2>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100">
              {error}
            </div>
          )}

          <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>

            {isRegister && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Nama Tampilan</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Masukkan nama tampilan"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-12 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 hover:shadow-xl transition-all disabled:opacity-50"
            >
              {submitting ? 'Memproses...' : isRegister ? 'Daftar' : 'Masuk'}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              className="text-sm text-blue-500 hover:text-blue-700 font-medium"
            >
              {isRegister ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
