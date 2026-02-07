'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import AdminRulesEditor from '@/components/AdminRulesEditor';
import BRCImportModal from '@/components/BRCImportModal';
import BRCHistoryList from '@/components/BRCHistoryList';
import { Lock, AlertTriangle, Building2, ClipboardList, Bell, Search, FileText, Database, Loader2 } from 'lucide-react';

type AdminTab = 'rules' | 'users' | 'audit' | 'import';

export default function AdminPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('rules');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 max-w-md mx-auto">
          <Lock className="w-12 h-12 mx-auto text-yellow-500 mb-4" aria-hidden="true" />
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
          <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" aria-hidden="true" />
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

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a
          href="/admin/shop-designations"
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Building2 className="w-6 h-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Shop Designations</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Manage repair, storage, scrap locations</p>
            </div>
          </div>
        </a>
        <a
          href="/audit"
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <ClipboardList className="w-6 h-6 text-purple-600 dark:text-purple-400" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Audit Log</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">View system activity history</p>
            </div>
          </div>
        </a>
        <a
          href="/settings"
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Bell className="w-6 h-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Email Queue</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Monitor notification queue status</p>
            </div>
          </div>
        </a>
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
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

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

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          user.email?.toLowerCase().includes(term) ||
          user.first_name?.toLowerCase().includes(term) ||
          user.last_name?.toLowerCase().includes(term) ||
          user.organization?.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }
      // Role filter
      if (filterRole && user.role !== filterRole) return false;
      // Status filter
      if (filterStatus === 'active' && !user.is_active) return false;
      if (filterStatus === 'inactive' && user.is_active) return false;
      return true;
    });
  }, [users, searchTerm, filterRole, filterStatus]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600 mx-auto" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search name, email, org..."
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Role</label>
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="operator">Operator</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {filteredUsers.length} of {users.length} users
        </div>
      </div>

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
            {filteredUsers.map((user) => (
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
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  {searchTerm || filterRole || filterStatus ? 'No users match your filters' : 'No users found'}
                </td>
              </tr>
            )}
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
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

  useState(() => {
    fetchLogs();
  });

  const fetchLogs = async () => {
    try {
      const response = await authFetch(`${API_BASE}/audit-logs?limit=100`);
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

  // Get unique actions and entities for filter dropdowns
  const uniqueActions = useMemo(() => {
    const actions = new Set(logs.map(l => l.action).filter(Boolean));
    return Array.from(actions).sort();
  }, [logs]);

  const uniqueEntities = useMemo(() => {
    const entities = new Set(logs.map(l => l.entity_type).filter(Boolean));
    return Array.from(entities).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Search filter (user email)
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!log.user_email?.toLowerCase().includes(term)) return false;
      }
      // Action filter
      if (filterAction && log.action !== filterAction) return false;
      // Entity filter
      if (filterEntity && log.entity_type !== filterEntity) return false;
      return true;
    });
  }, [logs, searchTerm, filterAction, filterEntity]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600 mx-auto" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Search User</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by user email..."
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Action</label>
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
          >
            <option value="">All Actions</option>
            {uniqueActions.map(action => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Entity Type</label>
          <select
            value={filterEntity}
            onChange={e => setFilterEntity(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
          >
            <option value="">All Entities</option>
            {uniqueEntities.map(entity => (
              <option key={entity} value={entity}>{entity}</option>
            ))}
          </select>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {filteredLogs.length} of {logs.length} logs
        </div>
      </div>

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
            {filteredLogs.map((log) => (
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
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  {searchTerm || filterAction || filterEntity ? 'No logs match your filters' : 'No audit logs found'}
                </td>
              </tr>
            )}
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
                <FileText className="w-6 h-6 text-primary-600 dark:text-primary-400" aria-hidden="true" />
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
                <Database className="w-6 h-6 text-gray-500" aria-hidden="true" />
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
                <ClipboardList className="w-6 h-6 text-gray-500" aria-hidden="true" />
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
