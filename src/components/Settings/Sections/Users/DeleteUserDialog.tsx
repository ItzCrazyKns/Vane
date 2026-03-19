import { Dialog, DialogPanel } from '@headlessui/react';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';

const DeleteUserDialog = ({
  userId,
  username,
  open,
  setOpen,
  onDeleted,
}: {
  userId: string;
  username: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  onDeleted: (userId: string) => void;
}) => {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete user');
      }

      onDeleted(userId);
      toast.success('User deleted successfully.');
      setOpen(false);
    } catch (err: any) {
      console.error('Error deleting user:', err);
      toast.error(err.message || 'Failed to delete user.');
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
              <div className="px-6 pt-6 pb-4">
                <h3 className="text-black/90 dark:text-white/90 font-medium">
                  Delete user
                </h3>
              </div>
              <div className="border-t border-light-200 dark:border-dark-200" />
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <p className="text-sm text-black/60 dark:text-white/60">
                  Are you sure you want to delete the user &quot;{username}
                  &quot;? This action cannot be undone. Their sessions will be
                  invalidated immediately.
                </p>
              </div>
              <div className="px-6 py-6 flex justify-end space-x-2">
                <button
                  disabled={loading}
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm border border-light-200 dark:border-dark-200 text-black dark:text-white bg-light-secondary/50 dark:bg-dark-secondary/50 hover:bg-light-secondary hover:dark:bg-dark-secondary hover:border-light-300 hover:dark:border-dark-300 flex flex-row items-center space-x-1 active:scale-95 transition duration-200"
                >
                  Cancel
                </button>
                <button
                  disabled={loading}
                  onClick={handleDelete}
                  className="px-4 py-2 rounded-lg text-sm bg-red-500 text-white font-medium disabled:opacity-85 hover:opacity-85 active:scale-95 transition duration-200"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </DialogPanel>
          </motion.div>
        </Dialog>
      )}
    </AnimatePresence>
  );
};

export default DeleteUserDialog;
