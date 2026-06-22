import React, { useState } from 'react';
import { Shield, Key, User, ArrowRight, Eye, EyeOff } from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: (token: string, username: string) => void;
  apiBase: string;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess, apiBase }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError('Username is required');
      return;
    }
    if (trimmedUsername.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/signup';
      const response = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: trimmedUsername,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      onAuthSuccess(data.token, data.username);
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-zinc-950 text-slate-100 font-sans relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-500/10 blur-[120px] pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-md p-8 bg-zinc-900/60 backdrop-blur-2xl border border-zinc-800/80 rounded-3xl shadow-2xl relative z-10 mx-4 transition-all duration-300">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 via-fuchsia-600 to-pink-500 flex items-center justify-center text-white font-extrabold text-2xl shadow-xl shadow-violet-600/20 mb-4 animate-pulse">
            S
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white font-display">
            Slack Intelligence Copilot
          </h1>
          <p className="text-zinc-400 text-xs mt-1 text-center font-ui">
            {isLogin ? 'Sign in to access your workspace agent' : 'Create an account to get started'}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-zinc-950/80 border border-zinc-800/60 p-1 rounded-xl mb-6 font-ui">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              isLogin
                ? 'bg-zinc-800 text-white shadow'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              !isLogin
                ? 'bg-zinc-800 text-white shadow'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 mb-5 bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-xl text-xs flex items-start gap-2.5 font-ui">
            <Shield className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 font-display">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="e.g. dev_admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/70 focus:ring-1 focus:ring-violet-500/15 transition-all font-ui"
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 font-display">
              Password
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/70 focus:ring-1 focus:ring-violet-550/15 transition-all font-ui"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-zinc-500 hover:text-zinc-300"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password (Signup only) */}
          {!isLogin && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 font-display">
                Confirm Password
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/70 focus:ring-1 focus:ring-violet-500/15 transition-all font-ui"
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl py-3 text-xs font-bold shadow-lg shadow-violet-700/15 hover:shadow-violet-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {isLogin ? 'Sign In' : 'Create Account'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

        </form>

      </div>
    </div>
  );
};
