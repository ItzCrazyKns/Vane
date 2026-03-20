'use client';

import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const SetupAccount = ({ onComplete }: { onComplete: () => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || 'Failed to create account');
        return;
      }

      toast.success('Admin account created');
      onComplete();
    } catch (err) {
      console.error('Setup failed:', err);
      toast.error('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-[95vw] md:w-[80vw] lg:w-[450px] mx-auto px-2 sm:px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, delay: 0.1 },
        }}
        className="w-full bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 rounded-xl shadow-sm p-6 md:p-8"
      >
        <div className="mb-6">
          <p className="text-sm font-medium text-black dark:text-white">
            Create Admin Account
          </p>
          <p className="text-xs text-black/50 dark:text-white/50 mt-1">
            This will be the administrator account for your instance.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-black/70 dark:text-white/70 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 text-sm text-black dark:text-white focus:outline-none focus:border-light-300 dark:focus:border-dark-300 transition-colors"
              placeholder="admin"
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-black/70 dark:text-white/70 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 text-sm text-black dark:text-white focus:outline-none focus:border-light-300 dark:focus:border-dark-300 transition-colors"
              placeholder="Min 8 characters"
              autoComplete="new-password"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-black/70 dark:text-white/70 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 text-sm text-black dark:text-white focus:outline-none focus:border-light-300 dark:focus:border-dark-300 transition-colors"
              placeholder="Confirm password"
              autoComplete="new-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex flex-row items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#24A0ED] text-white hover:bg-[#1e8fd1] active:scale-95 transition-all duration-200 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <>
                <span>Continue</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default SetupAccount;
