'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Trash2, Shield, User as UserIcon } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data.users);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    const confirmMsg =
      newRole === 'admin'
        ? 'Promote this user to admin?'
        : 'Demote this admin to user?';

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to update role');
      }

      await fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const deleteUser = async (userId: string, email: string) => {
    if (!confirm(`Delete user ${email}? This will also delete all their chats.`))
      return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete user');
      }

      await fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading || loadingUsers) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-black/70 dark:text-white/70">Loading...</p>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-light-primary dark:bg-dark-primary p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-black dark:text-white mb-2">
            User Management
          </h1>
          <p className="text-black/60 dark:text-white/60">
            Manage user accounts and permissions
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-light-secondary dark:bg-dark-secondary rounded-xl border border-light-200 dark:border-dark-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-light-200 dark:bg-dark-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-black/70 dark:text-white/70 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-black/70 dark:text-white/70 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-black/70 dark:text-white/70 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-black/70 dark:text-white/70 uppercase tracking-wider">
                  Registered
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-black/70 dark:text-white/70 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-light-200 dark:divide-dark-200">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-light-200 dark:hover:bg-dark-200">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#24A0ED] flex items-center justify-center text-white text-sm font-medium">
                        {u.name
                          ? u.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)
                          : u.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-black dark:text-white">
                          {u.name || 'Unnamed User'}
                        </p>
                        {u.id === user.id && (
                          <span className="text-xs text-black/60 dark:text-white/60">
                            (You)
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-black/70 dark:text-white/70">
                    {u.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleRole(u.id, u.role)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        u.role === 'admin'
                          ? 'bg-[#24A0ED]/10 text-[#24A0ED] hover:bg-[#24A0ED]/20'
                          : 'bg-light-200 dark:bg-dark-200 text-black/70 dark:text-white/70 hover:bg-light-300 dark:hover:bg-dark-300'
                      }`}
                      title={
                        u.role === 'admin'
                          ? 'Click to demote to user'
                          : 'Click to promote to admin'
                      }
                    >
                      {u.role === 'admin' ? (
                        <>
                          <Shield size={12} />
                          Admin
                        </>
                      ) : (
                        <>
                          <UserIcon size={12} />
                          User
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-black/70 dark:text-white/70">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={() => deleteUser(u.id, u.email)}
                      disabled={u.id === user.id}
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={
                        u.id === user.id
                          ? 'Cannot delete yourself'
                          : 'Delete user'
                      }
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="text-center py-12 text-black/60 dark:text-white/60">
              No users found
            </div>
          )}
        </div>

        <div className="mt-6 text-sm text-black/60 dark:text-white/60">
          <p>Total users: {users.length}</p>
          <p>
            Admins: {users.filter((u) => u.role === 'admin').length} | Users:{' '}
            {users.filter((u) => u.role === 'user').length}
          </p>
        </div>
      </div>
    </div>
  );
}
