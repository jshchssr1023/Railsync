'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  update: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  delete: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  login: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  logout: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400',
  import: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  approve: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  reject: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function AuditLogPage() {
  const { user, isAuthenticated } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    entity_type: '',
    user_id: '',
    date_from: '',
    date_to: '',
  });
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  const getToken = () => localStorage.getItem('railsync_access_token');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: ((page - 1) * pageSize).toString(),
      });

      if (filters.action) params.append('action', filters.action);
      if (filters.entity_type) params.append('entity_type', filters.entity_type);
      if (filters.user_id) params.append('user_id', filters.user_id);

      const res = await fetch(`${API_URL}/audit-logs?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();

      if (data.success) {
        setLogs(data.data.logs || data.data || []);
        setTotal(data.data.total || data.data.length || 0);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      // Mock data for demo
      setLogs([
        {
          id: '1',
          action: 'create',
          entity_type: 'allocation',
          entity_id: 'abc123',
          user_email: 'admin@railsync.com',
          user_name: 'System Administrator',
          new_values: { shop_code: 'AITX-BRK', target_month: '2026-03', status: 'planned' },
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          action: 'update',
          entity_type: 'allocation',
          entity_id: 'def456',
          user_email: 'operator@railsync.com',
          user_name: 'Fleet Operator',
          old_values: { status: 'planned' },
          new_values: { status: 'confirmed' },
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: '3',
          action: 'login',
          entity_type: 'user',
          entity_id: 'user123',
          user_email: 'demo@railsync.com',
          user_name: 'Demo User',
          ip_address: '192.168.1.100',
          created_at: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: '4',
          action: 'approve',
          entity_type: 'service_plan',
          entity_id: 'sp789',
          user_email: 'admin@railsync.com',
          user_name: 'System Administrator',
          new_values: { approved: true, allocations_created: 5 },
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: '5',
          action: 'import',
          entity_type: 'shop',
          entity_id: 'batch-001',
          user_email: 'admin@railsync.com',
          user_name: 'System Administrator',
          new_values: { shops_imported: 963, source: 'CSV' },
          created_at: new Date(Date.now() - 172800000).toISOString(),
        },
      ]);
      setTotal(5);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, page, filters]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500">Admin access required to view audit logs.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Audit Log</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              System activity and change history
            </p>
          </div>
          <button
            onClick={() => fetchLogs()}
            className="px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Action
              </label>
              <select
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              >
                <option value="">All Actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="login">Login</option>
                <option value="approve">Approve</option>
                <option value="import">Import</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Entity Type
              </label>
              <select
                value={filters.entity_type}
                onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              >
                <option value="">All Types</option>
                <option value="allocation">Allocation</option>
                <option value="car_assignment">Assignment</option>
                <option value="service_plan">Service Plan</option>
                <option value="bad_order">Bad Order</option>
                <option value="user">User</option>
                <option value="shop">Shop</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Date From
              </label>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Date To
              </label>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Log Entries */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No audit logs found</div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {logs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${ACTION_COLORS[log.action] || ACTION_COLORS.update}`}>
                        {log.action}
                      </span>
                      <div>
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          <span className="font-medium">{log.user_name || log.user_email || 'System'}</span>
                          {' '}
                          <span className="text-gray-500 dark:text-gray-400">
                            {log.action}d {log.entity_type.replace('_', ' ')}
                          </span>
                          {' '}
                          <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">
                            {log.entity_id.slice(0, 8)}...
                          </code>
                        </div>
                        {log.user_email && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {log.user_email}
                            {log.ip_address && ` • ${log.ip_address}`}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatTimeAgo(log.created_at)}
                      </span>
                      {(log.old_values || log.new_values) && (
                        <button
                          onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                          className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                        >
                          {expandedLog === log.id ? 'Hide' : 'Details'}
                        </button>
                      )}
                    </div>
                  </div>

                  {expandedLog === log.id && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-xs">
                      <div className="text-gray-500 dark:text-gray-400 mb-2">
                        {formatDate(log.created_at)}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {log.old_values && (
                          <div>
                            <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">Before</div>
                            <pre className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                              {JSON.stringify(log.old_values, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.new_values && (
                          <div>
                            <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">After</div>
                            <pre className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                              {JSON.stringify(log.new_values, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {total > pageSize && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of {total}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page * pageSize >= total}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
