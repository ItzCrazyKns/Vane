import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react';
import { History } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Chat } from '@/app/library/page';

const HistoryPopover = () => {
  const [recentChats, setRecentChats] = useState<Chat[]>([]);

  useEffect(() => {
    const fetchRecentChats = async () => {
      try {
        const res = await fetch('/api/chats', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const data = await res.json();
        // Assuming data.chats is sorted by date already, or we can sort/slice here
        setRecentChats(data.chats.slice(0, 5));
      } catch (error) {
        console.error('Failed to fetch recent chats', error);
      }
    };

    fetchRecentChats();
  }, []);

  return (
    <Popover className="relative flex flex-col items-center justify-center w-full">
      {({ open }) => (
        <>
          <PopoverButton
            className={cn(
              'relative flex flex-col items-center justify-center space-y-0.5 cursor-pointer w-full py-2 rounded-lg outline-none',
              open ? 'text-black/70 dark:text-white/70' : 'text-black/60 dark:text-white/60'
            )}
          >
            <div
              className={cn(
                open && 'bg-light-200 dark:bg-dark-200',
                'group rounded-lg hover:bg-light-200 hover:dark:bg-dark-200 transition duration-200'
              )}
            >
              <History
                size={25}
                className={cn(
                  !open && 'group-hover:scale-105',
                  'transition duration:200 m-1.5'
                )}
              />
            </div>
            <p
              className={cn(
                open ? 'text-black/80 dark:text-white/80' : 'text-black/60 dark:text-white/60',
                'text-[10px]'
              )}
            >
              History
            </p>
          </PopoverButton>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 translate-x-1"
            enterTo="opacity-100 translate-x-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-x-0"
            leaveTo="opacity-0 translate-x-1"
          >
            <PopoverPanel className="absolute left-full top-0 ml-2 w-64 z-50">
              <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black/5 bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200">
                <div className="p-4">
                  <h3 className="text-sm font-medium text-black dark:text-white mb-2">
                    Recent Threads
                  </h3>
                  {recentChats.length > 0 ? (
                    <div className="flex flex-col space-y-1">
                      {recentChats.map((chat) => (
                        <Link
                          key={chat.id}
                          href={`/c/${chat.id}`}
                          className="block rounded-md px-2 py-2 text-sm text-black/70 dark:text-white/70 hover:bg-light-secondary dark:hover:bg-dark-secondary hover:text-black dark:hover:text-white transition-colors truncate"
                        >
                          {chat.title}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-black/50 dark:text-white/50 py-2">
                      No recent chats found.
                    </p>
                  )}
                  <div className="mt-3 pt-3 border-t border-light-200 dark:border-dark-200">
                    <Link
                      href="/library"
                      className="text-xs text-sky-500 hover:text-sky-600 dark:hover:text-sky-400 font-medium"
                    >
                      View all in Library
                    </Link>
                  </div>
                </div>
              </div>
            </PopoverPanel>
          </Transition>
        </>
      )}
    </Popover>
  );
};

export default HistoryPopover;
