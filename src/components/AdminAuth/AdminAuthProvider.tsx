'use client';

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

const AdminAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/config', { method: 'GET' });
      if (res.status === 401) {
        setIsOpen(true);
      }
    } catch {
      // Network error, allow through
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      });

      if (res.ok) {
        setIsOpen(false);
        setSecret('');
        window.location.reload();
      } else {
        toast('Invalid admin secret.');
      }
    } catch {
      toast('Authentication request failed.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return null;
  }

  return (
    <>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {}}
          static
        >
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <DialogBackdrop className="fixed inset-0 bg-black/50" />
          </TransitionChild>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-150"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-md transform rounded-2xl bg-light-secondary dark:bg-dark-secondary p-6 shadow-xl transition-all">
                  <DialogTitle className="text-lg font-medium text-black dark:text-white">
                    Admin Authentication
                  </DialogTitle>
                  <p className="mt-2 text-sm text-black/70 dark:text-white/70">
                    This instance requires an admin secret to access settings.
                    Enter the value of the <code>ADMIN_SECRET</code> environment
                    variable.
                  </p>
                  <form onSubmit={handleSubmit} className="mt-4">
                    <input
                      type="password"
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                      placeholder="Admin secret"
                      autoFocus
                      className="w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary px-3 py-2 text-sm text-black dark:text-white placeholder:text-black/50 dark:placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-[#24A0ED]"
                    />
                    <button
                      type="submit"
                      disabled={loading || !secret}
                      className="mt-3 w-full rounded-lg bg-[#24A0ED] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a8cd8] disabled:opacity-50 transition-colors duration-200"
                    >
                      {loading ? 'Authenticating...' : 'Authenticate'}
                    </button>
                  </form>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
      {!isOpen && children}
    </>
  );
};

export default AdminAuthProvider;
