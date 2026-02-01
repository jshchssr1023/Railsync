'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import AdminRulesEditor from '@/components/AdminRulesEditor';
import BRCImportModal from '@/components/BRCImportModal';
import BRCHistoryList from '@/components/BRCHistoryList';

type AdminTab = 'rules' | 'users' | 'audit' | 'import';

export default function AdminPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('rules');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 max-w-md mx-auto">
          <svg className="w-12 h-12 mx-auto text-yellow-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-200">Authentication Required</h3>
          <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
            Please sign in to access the admin dashboard.
          </p>
        </div>
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md mx-auto">
          <svg className="w-12 h-12 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Access Denied</h3>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            You do not have permission to access the admin dashboard.
            <br />
            Your role: <strong>{user?.role}</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage rules, users, and view audit logs
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('rules')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'rules'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Rules Editor
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'users'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            User Management
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'audit'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Audit Logs
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'import'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Data Import
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {activeTab === 'rules' && <AdminRulesEditor />}
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'audit' && <AuditLogs />}
        {activeTab === 'import' && <DataImport />}
      </div>
    </div>
  );
}

function UserManagement() {
  const { useAuthFetch } = require('@/context/AuthContext');
  const authFetch = useAuthFetch();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

  useState(() => {
    fetchUsers();
  });

  const fetchUsers = async () => {
    try {
      const response = await authFetch(`${API_BASE}/admin/users`);
      const data = await response.json();
      if (data.success) {
        setUsers(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Organization
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Last Login
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {user.first_name} {user.last_name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded ${
                    user.role === 'admin'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                      : user.role === 'operator'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {user.organization || '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded ${
                    user.is_active
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                  }`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditLogs() {
  const { useAuthFetch } = require('@/context/AuthContext');
  const authFetch = useAuthFetch();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

  useState(() => {
    fetchLogs();
  });

  const fetchLogs = async () => {
    try {
      const response = await authFetch(`${API_BASE}/audit-logs?limit=50`);
      const data = await response.json();
      if (data.success) {
        setLogs(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Action
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Entity
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                IP Address
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {log.user_email || 'Anonymous'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded ${
                    log.action === 'login' || log.action === 'create'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                      : log.action === 'delete' || log.action === 'login_failed'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                  }`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {log.entity_type}
                  {log.entity_id && ` (${log.entity_id.substring(0, 8)}...)`}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {log.ip_address || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DataImport() {
  const [showBRCModal, setShowBRCModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleBRCSuccess = () => {
    setShowBRCModal(false);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="p-6">
      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Data Import Options
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Import external data files to update costs, allocations, and fleet information.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* BRC Import Card */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                <svg className="w-6 h-6 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">BRC Import</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Import AAR 500-byte Billing Repair Card files to record actual maintenance costs.
                </p>
                <button
                  onClick={() => setShowBRCModal(true)}
                  className="mt-3 btn btn-primary text-sm py-1.5"
                >
                  Import BRC File
                </button>
              </div>
            </div>
          </div>

          {/* Car Fleet Import Card */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 opacity-60">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Car Fleet Import</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Import car master data from CSV files (Qual Planner Master format).
                </p>
                <span className="inline-block mt-3 text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                  Coming Soon
                </span>
              </div>
            </div>
          </div>

          {/* Demand Import Card */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 opacity-60">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Demand Import</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Bulk import demand forecasts from S&OP planning spreadsheets.
                </p>
                <span className="inline-block mt-3 text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                  Coming Soon
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* BRC Import History */}
        <div>
          <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
            BRC Import History
          </h4>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <BRCHistoryList key={refreshKey} />
          </div>
        </div>
      </div>

      {/* BRC Import Modal */}
      {showBRCModal && (
        <BRCImportModal
          onClose={() => setShowBRCModal(false)}
          onSuccess={handleBRCSuccess}
        />
      )}
    </div>
  );
}
