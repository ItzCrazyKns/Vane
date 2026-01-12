'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/hooks/useAuth';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { refresh } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: name || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      // Refresh auth state to load user data
      await refresh();

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-light-primary dark:bg-dark-primary min-h-screen w-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, translateY: '30px' }}
        animate={{ opacity: 1, translateY: '0px' }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-normal font-['Instrument_Serif'] tracking-tight">
            Create your{' '}
            <span className="text-[#24A0ED] italic font-['PP_Editorial']">
              Perplexica
            </span>{' '}
            account
          </h1>
          <p className="text-black/60 dark:text-white/60 mt-2">
            Get started with AI-powered search
          </p>
        </div>

        <div className="bg-light-secondary dark:bg-dark-secondary rounded-xl border border-light-200 dark:border-dark-200 p-6 md:p-8">
          {error && (
            <div className="mb-4 p-3 text-sm text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-black/70 dark:text-white/70 mb-1"
              >
                Name{' '}
                <span className="text-black/40 dark:text-white/40">
                  (optional)
                </span>
              </label>
              <input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary text-black dark:text-white placeholder-black/40 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#24A0ED]/50 focus:border-[#24A0ED]"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-black/70 dark:text-white/70 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary text-black dark:text-white placeholder-black/40 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#24A0ED]/50 focus:border-[#24A0ED]"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-black/70 dark:text-white/70 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary text-black dark:text-white placeholder-black/40 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#24A0ED]/50 focus:border-[#24A0ED]"
                minLength={8}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-[#24A0ED] text-white rounded-lg font-medium hover:bg-[#1a8cd8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-black/60 dark:text-white/60">
              Already have an account?{' '}
              <Link
                href="/login"
                className="text-[#24A0ED] hover:underline font-medium"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
