import { Dialog, DialogPanel } from '@headlessui/react';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';

const ResetPasswordDialog = ({
  userId,
  username,
  open,
  setOpen,
}: {
  userId: string;
  username: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) throw new Error('Failed to reset password');

      toast.success(`Password reset for ${username}.`);
      setOpen(false);
      setPassword('');
    } catch (err) {
      console.error('Error resetting password:', err);
      toast.error('Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <Dialog
          static
          open={open}
          onClose={() => setOpen(false)}
          className="relative z-[60]"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="fixed inset-0 flex w-screen items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
          >
            <DialogPanel className="w-full mx-4 lg:w-[600px] max-h-[85vh] flex flex-col border bg-light-primary dark:bg-dark-primary border-light-secondary dark:border-dark-secondary rounded-lg">
              <form onSubmit={handleSubmit} className="flex flex-col flex-1">
                <div className="px-6 pt-6 pb-4">
                  <h3 className="text-black/90 dark:text-white/90 font-medium text-sm">
                    Reset password for {username}
                  </h3>
                </div>
                <div className="border-t border-light-200 dark:border-dark-200" />
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <div className="flex flex-col items-start space-y-2">
                    <label className="text-xs text-black/70 dark:text-white/70">
                      New Password*
                    </label>
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary px-4 py-3 text-sm text-black/80 dark:text-white/80 placeholder:text-black/40 dark:placeholder:text-white/40 focus-visible:outline-none focus-visible:border-light-300 dark:focus-visible:border-dark-300 transition-colors"
                      placeholder="Enter new password"
                      type="password"
                      required
                    />
                  </div>
                </div>
                <div className="border-t border-light-200 dark:border-dark-200" />
                <div className="px-6 py-4 flex justify-end space-x-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setOpen(false)}
                    className="px-4 py-2 rounded-lg text-sm border border-light-200 dark:border-dark-200 text-black dark:text-white bg-light-secondary/50 dark:bg-dark-secondary/50 hover:bg-light-secondary hover:dark:bg-dark-secondary hover:border-light-300 hover:dark:border-dark-300 active:scale-95 transition duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 rounded-lg text-[13px] bg-sky-500 text-white font-medium disabled:opacity-85 hover:opacity-85 active:scale-95 transition duration-200"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      'Reset Password'
                    )}
                  </button>
                </div>
              </form>
            </DialogPanel>
          </motion.div>
        </Dialog>
      )}
    </AnimatePresence>
  );
};

export default ResetPasswordDialog;
