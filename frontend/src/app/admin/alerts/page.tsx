'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import { Loader2, Bell, BellOff, RefreshCw, AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';

interface Alert {
  id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
}

interface AlertStats {
  total: number;
  by_severity: Record<string, number>;
  by_type: Record<string, number>;
  unread: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const SEVERITY_STYLES: Record<string, { bg: string; icon: typeof AlertTriangle }> = {
  info: { bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Info },
  warning: { bg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: AlertTriangle },
  error: { bg: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
  critical: { bg: 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-300', icon: XCircle },
};

export default function AlertsPage() {
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const isAdmin = user?.role === 'admin';
  const getToken = () => localStorage.getItem('railsync_access_token');

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const res = await fetch(`${API_URL}${url}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
    });
    return res.json();
  };

  useEffect(() => {
    if (isAuthenticated) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [alertsData, statsData] = await Promise.all([
        fetchWithAuth('/alerts'),
        isAdmin ? fetchWithAuth('/alerts/stats') : Promise.resolve({ success: false }),
      ]);
      if (alertsData.success) setAlerts(alertsData.data || []);
      if (statsData.success) setStats(statsData.data);
    } catch {
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      const data = await fetchWithAuth(`/alerts/${id}/dismiss`, { method: 'PUT' });
      if (data.success) {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
        toast.success('Alert dismissed');
      }
    } catch {
      toast.error('Failed to dismiss alert');
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = await fetchWithAuth('/alerts/generate', { method: 'POST' });
      if (data.success) {
        toast.success(`Generated ${data.data?.generated || 0} alerts`);
        loadData();
      } else {
        toast.error(data.error || 'Generation failed');
      }
    } catch {
      toast.error('Failed to generate alerts');
    } finally {
      setGenerating(false);
    }
  };

  if (!isAuthenticated) {
    return <div className="text-center py-12 text-gray-500">Please sign in to view alerts.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Alerts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            System alerts for overdue cars, capacity issues, and qualification expirations
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {isAdmin && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              {generating ? 'Scanning...' : 'Run Alert Scan'}
            </button>
          )}
        </div>
      </div>

      {/* Stats (admin only) */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Active</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Unread</div>
            <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{stats.unread}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-red-500">Critical/Error</div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {(stats.by_severity?.critical || 0) + (stats.by_severity?.error || 0)}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-amber-500">Warnings</div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.by_severity?.warning || 0}</div>
          </div>
        </div>
      )}

      {/* Alert list */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center text-gray-500 dark:text-gray-400">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500 opacity-60" />
            <p>No active alerts</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;
            const Icon = style.icon;
            return (
              <div
                key={alert.id}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-start gap-4 ${
                  !alert.is_read ? 'border-l-4 border-primary-500' : ''
                }`}
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${style.bg}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{alert.title}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style.bg}`}>
                      {alert.severity}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                      {alert.alert_type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{alert.message}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>{new Date(alert.created_at).toLocaleString()}</span>
                    {alert.entity_type && <span>{alert.entity_type}: {alert.entity_id}</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleDismiss(alert.id)}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                  title="Dismiss"
                >
                  <BellOff className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
