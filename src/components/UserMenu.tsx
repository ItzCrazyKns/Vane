'use client';

import { useState, useRef, useEffect } from 'react';
import { User, LogOut, ChevronUp, Shield } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import Link from 'next/link';

const UserMenu = () => {
  const { user, logout, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Debug logging
  useEffect(() => {
    console.log('[UserMenu] State:', { loading, hasUser: !!user, email: user?.email });
  }, [loading, user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading || !user) {
    return null;
  }

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-[#24A0ED] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        title={user.email}
      >
        {initials}
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-56 bg-light-secondary dark:bg-dark-secondary rounded-lg border border-light-200 dark:border-dark-200 shadow-lg overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-light-200 dark:border-dark-200">
            <p className="text-sm font-medium text-black dark:text-white truncate">
              {user.name || 'User'}
            </p>
            <p className="text-xs text-black/60 dark:text-white/60 truncate">
              {user.email}
            </p>
            {user.role === 'admin' && (
              <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-medium bg-[#24A0ED]/10 text-[#24A0ED] rounded">
                Admin
              </span>
            )}
          </div>
          {user.role === 'admin' && (
            <Link
              href="/admin"
              className="w-full px-3 py-2 flex items-center gap-2 text-sm text-black/70 dark:text-white/70 hover:bg-light-200 dark:hover:bg-dark-200 transition-colors border-b border-light-200 dark:border-dark-200"
            >
              <Shield size={16} />
              Admin Panel
            </Link>
          )}
          <button
            onClick={logout}
            className="w-full px-3 py-2 flex items-center gap-2 text-sm text-black/70 dark:text-white/70 hover:bg-light-200 dark:hover:bg-dark-200 transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
