import { useEffect, useState } from 'react';
import { History, KeyRound, Shield, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';
import Loader from '@/components/ui/Loader';
import AddUserDialog from './AddUserDialog';
import DeleteUserDialog from './DeleteUserDialog';
import ResetPasswordDialog from './ResetPasswordDialog';
import UserHistoryDialog from './UserHistoryDialog';

type UserRecord = {
  id: string;
  username: string;
  role: string;
  createdAt: string;
};

const UsersSection = (_props: { fields?: any; values?: any }) => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Dialog state
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [resetTarget, setResetTarget] = useState<UserRecord | null>(null);
  const [historyTarget, setHistoryTarget] = useState<UserRecord | null>(null);

  useEffect(() => {
    // Get current user id from /api/auth/me
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.id) setCurrentUserId(data.user.id);
      })
      .catch(() => {});

    // Fetch users
    fetch('/api/admin/users')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
      })
      .then((data) => setUsers(data.users || []))
      .catch((err) => {
        console.error('Error fetching users:', err);
        toast.error('Failed to load users.');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto py-6">
      <div className="flex flex-row justify-between items-center px-6">
        <p className="text-xs lg:text-xs text-black/70 dark:text-white/70">
          Manage users
        </p>
        <AddUserDialog
          onUserAdded={(user) => setUsers((prev) => [...prev, user])}
        />
      </div>
      <div className="flex flex-col px-6 gap-y-3">
        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 rounded-lg border-2 border-dashed border-light-200 dark:border-dark-200 bg-light-secondary/10 dark:bg-dark-secondary/10">
            <p className="text-sm font-medium text-black/70 dark:text-white/70 mb-1">
              No users yet
            </p>
            <p className="text-xs text-black/50 dark:text-white/50 text-center max-w-sm">
              Add your first user to get started.
            </p>
          </div>
        ) : (
          users.map((user) => {
            const isCurrentUser = user.id === currentUserId;
            return (
              <div
                key={user.id}
                className="flex flex-row items-center justify-between px-4 py-3 rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-1.5 rounded-md bg-light-200 dark:bg-dark-200">
                    <User
                      size={14}
                      className="text-black/60 dark:text-white/60"
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-black/80 dark:text-white/80 font-medium truncate">
                        {user.username}
                      </p>
                      {isCurrentUser && (
                        <span className="text-[10px] text-black/40 dark:text-white/40">
                          (you)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          user.role === 'admin'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                        }`}
                      >
                        {user.role === 'admin' ? (
                          <span className="flex items-center gap-0.5">
                            <Shield size={9} />
                            admin
                          </span>
                        ) : (
                          'user'
                        )}
                      </span>
                      <span className="text-[10px] text-black/40 dark:text-white/40">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setHistoryTarget(user)}
                    className="p-1.5 rounded-md hover:bg-light-200 hover:dark:bg-dark-200 transition-colors"
                    title="View search history"
                  >
                    <History
                      size={14}
                      className="text-black/50 dark:text-white/50"
                    />
                  </button>
                  <button
                    onClick={() => setResetTarget(user)}
                    className="p-1.5 rounded-md hover:bg-light-200 hover:dark:bg-dark-200 transition-colors"
                    title="Reset password"
                  >
                    <KeyRound
                      size={14}
                      className="text-black/50 dark:text-white/50"
                    />
                  </button>
                  <button
                    onClick={() => !isCurrentUser && setDeleteTarget(user)}
                    disabled={isCurrentUser}
                    className="p-1.5 rounded-md hover:bg-light-200 hover:dark:bg-dark-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={
                      isCurrentUser
                        ? 'Cannot delete your own account'
                        : 'Delete user'
                    }
                  >
                    <Trash2
                      size={14}
                      className="text-black/50 dark:text-white/50 hover:text-red-500 hover:dark:text-red-400"
                    />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {deleteTarget && (
        <DeleteUserDialog
          userId={deleteTarget.id}
          username={deleteTarget.username}
          open={!!deleteTarget}
          setOpen={(open) => !open && setDeleteTarget(null)}
          onDeleted={(id) =>
            setUsers((prev) => prev.filter((u) => u.id !== id))
          }
        />
      )}
      {resetTarget && (
        <ResetPasswordDialog
          userId={resetTarget.id}
          username={resetTarget.username}
          open={!!resetTarget}
          setOpen={(open) => !open && setResetTarget(null)}
        />
      )}
      {historyTarget && (
        <UserHistoryDialog
          userId={historyTarget.id}
          username={historyTarget.username}
          open={!!historyTarget}
          setOpen={(open) => !open && setHistoryTarget(null)}
        />
      )}
    </div>
  );
};

export default UsersSection;
