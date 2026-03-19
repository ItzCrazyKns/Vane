import { Dialog, DialogPanel } from '@headlessui/react';
import { ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Loader from '@/components/ui/Loader';

type Chat = {
  id: string;
  title: string;
  createdAt: string;
};

const UserHistoryDialog = ({
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
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetch(`/api/admin/users/${userId}/chats`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => setChats(data.chats || []))
        .catch((err) => console.error('Error fetching chats:', err))
        .finally(() => setLoading(false));
    }
  }, [open, userId]);

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
                <h3 className="text-black/90 dark:text-white/90 font-medium text-sm">
                  Search history — {username}
                </h3>
              </div>
              <div className="border-t border-light-200 dark:border-dark-200" />
              <div className="flex-1 overflow-y-auto px-6 py-4 max-h-[60vh]">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader />
                  </div>
                ) : chats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 px-4 rounded-lg border-2 border-dashed border-light-200 dark:border-dark-200 bg-light-secondary/20 dark:bg-dark-secondary/20">
                    <p className="text-xs text-black/50 dark:text-white/50 text-center">
                      No search history for this user.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {chats.map((chat) => (
                      <a
                        key={chat.id}
                        href={`/c/${chat.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-row items-center justify-between px-3 py-2.5 rounded-lg border border-light-200 dark:border-dark-200 hover:bg-light-secondary/50 hover:dark:bg-dark-secondary/50 transition-colors group"
                      >
                        <div className="flex flex-col min-w-0 flex-1">
                          <p className="text-sm text-black/80 dark:text-white/80 truncate">
                            {chat.title}
                          </p>
                          <p className="text-[10px] text-black/40 dark:text-white/40">
                            {new Date(chat.createdAt).toLocaleDateString(
                              undefined,
                              {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              },
                            )}
                          </p>
                        </div>
                        <ExternalLink
                          size={14}
                          className="text-black/30 dark:text-white/30 group-hover:text-black/60 group-hover:dark:text-white/60 shrink-0 ml-2"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-light-200 dark:border-dark-200" />
              <div className="px-6 py-4 flex justify-end">
                <button
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm border border-light-200 dark:border-dark-200 text-black dark:text-white bg-light-secondary/50 dark:bg-dark-secondary/50 hover:bg-light-secondary hover:dark:bg-dark-secondary hover:border-light-300 hover:dark:border-dark-300 active:scale-95 transition duration-200"
                >
                  Close
                </button>
              </div>
            </DialogPanel>
          </motion.div>
        </Dialog>
      )}
    </AnimatePresence>
  );
};

export default UserHistoryDialog;
