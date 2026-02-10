'use client';

import { useState, useEffect } from 'react';
import { Loader2, Bell, Mail, Play, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface QueueStatus {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  oldest_pending: string | null;
}

interface NotificationPreferences {
  email_enabled: boolean;
  shopping_events: boolean;
  estimate_updates: boolean;
  invoice_alerts: boolean;
  system_alerts: boolean;
}

export default function NotificationsPage() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.role === 'admin';
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;
  const fetchWithAuth = (endpoint: string, opts?: RequestInit) =>
    fetch(`${API_URL}${endpoint}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...opts?.headers } }).then(r => r.json());

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    const fetches = [fetchWithAuth('/notifications/preferences')];
    if (isAdmin) fetches.push(fetchWithAuth('/notifications/queue/status'));
    Promise.all(fetches).then(([prefsRes, queueRes]) => {
      setPrefs(prefsRes.data || null);
      if (queueRes) setQueueStatus(queueRes.data || null);
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isAdmin]);

  async function handleProcessQueue() {
    setProcessing(true);
    try {
      await fetchWithAuth('/notifications/queue/process', { method: 'POST' });
      const res = await fetchWithAuth('/notifications/queue/status');
      setQueueStatus(res.data || null);
    } catch { /* silent */ }
    finally { setProcessing(false); }
  }

  async function refreshQueue() {
    const res = await fetchWithAuth('/notifications/queue/status');
    setQueueStatus(res.data || null);
  }

  async function savePreferences(updated: NotificationPreferences) {
    setSavingPrefs(true);
    try {
      const res = await fetchWithAuth('/notifications/preferences', { method: 'PUT', body: JSON.stringify(updated) });
      setPrefs(res.data || updated);
    } catch { /* silent */ }
    finally { setSavingPrefs(false); }
  }

  function togglePref(key: keyof NotificationPreferences) {
    if (!prefs) return;
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    savePreferences(updated);
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Notifications</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Manage your notification preferences and email queue</p>
      </div>

      {/* Notification Preferences */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary-500" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Your Preferences</h3>
          {savingPrefs && <Loader2 className="w-3 h-3 animate-spin text-primary-500 ml-2" />}
        </div>
        {prefs && (
          <div className="p-4 space-y-3">
            {([
              { key: 'email_enabled' as const, label: 'Email Notifications', desc: 'Receive email notifications' },
              { key: 'shopping_events' as const, label: 'Shopping Events', desc: 'New shopping events, assignments, completions' },
              { key: 'estimate_updates' as const, label: 'Estimate Updates', desc: 'Estimate submissions, approvals, rejections' },
              { key: 'invoice_alerts' as const, label: 'Invoice Alerts', desc: 'New invoices, overdue payments, disputes' },
              { key: 'system_alerts' as const, label: 'System Alerts', desc: 'System maintenance, migration, and go-live alerts' },
            ]).map(item => (
              <div key={item.key} className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</div>
                </div>
                <button
                  onClick={() => togglePref(item.key)}
                  className="relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none"
                  style={{ backgroundColor: prefs[item.key] ? '#22c55e' : '#d1d5db' }}
                >
                  <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${prefs[item.key] ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin: Email Queue */}
      {isAdmin && queueStatus && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary-500" />
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Email Queue (Admin)</h3>
            </div>
            <div className="flex gap-2">
              <button onClick={refreshQueue} className="p-1.5 text-gray-400 hover:text-primary-600 rounded"><RefreshCw className="w-4 h-4" /></button>
              <button onClick={handleProcessQueue} disabled={processing || queueStatus.pending === 0} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50">
                {processing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Process Queue
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4">
            <div className="text-center p-2 rounded-lg cursor-default hover:bg-yellow-50 dark:hover:bg-yellow-900/10 transition-colors">
              <div className="flex items-center justify-center gap-1 text-xs text-yellow-600 dark:text-yellow-400 mb-1">
                <Clock className="w-3 h-3" /> Pending
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{queueStatus.pending}</div>
            </div>
            <div className="text-center p-2 rounded-lg cursor-default hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors">
              <div className="flex items-center justify-center gap-1 text-xs text-blue-600 dark:text-blue-400 mb-1">
                <Loader2 className="w-3 h-3" /> Processing
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{queueStatus.processing}</div>
            </div>
            <div className="text-center p-2 rounded-lg cursor-default hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors">
              <div className="flex items-center justify-center gap-1 text-xs text-green-600 dark:text-green-400 mb-1">
                <CheckCircle className="w-3 h-3" /> Sent
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{queueStatus.sent}</div>
            </div>
            <div className="text-center p-2 rounded-lg cursor-default hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
              <div className="flex items-center justify-center gap-1 text-xs text-red-600 dark:text-red-400 mb-1">
                <XCircle className="w-3 h-3" /> Failed
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{queueStatus.failed}</div>
            </div>
          </div>
          {queueStatus.oldest_pending && (
            <div className="px-4 pb-3 text-xs text-gray-400">
              Oldest pending: {new Date(queueStatus.oldest_pending).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
