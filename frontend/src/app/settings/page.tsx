'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

interface NotificationPreferences {
  user_id: string;
  email_bad_orders: boolean;
  email_capacity_warnings: boolean;
  email_allocation_updates: boolean;
  email_daily_digest: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function SettingsPage() {
  const { user, isAuthenticated } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getToken = () => localStorage.getItem('auth_token');

  const fetchPreferences = async () => {
    try {
      const res = await fetch(`${API_URL}/notifications/preferences`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setPreferences(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchPreferences();
    }
  }, [isAuthenticated]);

  const handleToggle = (key: keyof Omit<NotificationPreferences, 'user_id'>) => {
    if (!preferences) return;
    setPreferences({ ...preferences, [key]: !preferences[key] });
  };

  const handleSave = async () => {
    if (!preferences) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_URL}/notifications/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          email_bad_orders: preferences.email_bad_orders,
          email_capacity_warnings: preferences.email_capacity_warnings,
          email_allocation_updates: preferences.email_allocation_updates,
          email_daily_digest: preferences.email_daily_digest,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Preferences saved successfully' });
        setPreferences(data.data);
      } else {
        setMessage({ type: 'error', text: 'Failed to save preferences' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save preferences' });
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500">Please sign in to access settings.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Manage your account and notification preferences
        </p>

        {/* User Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Account</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Name</span>
              <p className="text-gray-900 dark:text-gray-100 font-medium">
                {user?.first_name} {user?.last_name}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Email</span>
              <p className="text-gray-900 dark:text-gray-100 font-medium">{user?.email}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Role</span>
              <p className="text-gray-900 dark:text-gray-100 font-medium capitalize">{user?.role}</p>
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Email Notifications
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Choose which email notifications you would like to receive.
          </p>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading preferences...</div>
          ) : preferences ? (
            <div className="space-y-4">
              {/* Bad Orders */}
              <label className="flex items-start gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <input
                  type="checkbox"
                  checked={preferences.email_bad_orders}
                  onChange={() => handleToggle('email_bad_orders')}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🚨</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">Bad Order Alerts</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Get notified when a bad order is reported for any car in the fleet
                  </p>
                </div>
              </label>

              {/* Capacity Warnings */}
              <label className="flex items-start gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <input
                  type="checkbox"
                  checked={preferences.email_capacity_warnings}
                  onChange={() => handleToggle('email_capacity_warnings')}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚠️</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">Capacity Warnings</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Get notified when shop capacity exceeds 90% utilization
                  </p>
                </div>
              </label>

              {/* Allocation Updates */}
              <label className="flex items-start gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <input
                  type="checkbox"
                  checked={preferences.email_allocation_updates}
                  onChange={() => handleToggle('email_allocation_updates')}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📦</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">Allocation Updates</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Get notified when allocations change status (planned → confirmed, etc.)
                  </p>
                </div>
              </label>

              {/* Daily Digest */}
              <label className="flex items-start gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <input
                  type="checkbox"
                  checked={preferences.email_daily_digest}
                  onChange={() => handleToggle('email_daily_digest')}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📊</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">Daily Digest</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Receive a daily summary of bad orders, completions, and capacity warnings
                  </p>
                </div>
              </label>

              {/* Save Button */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                {message && (
                  <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {message.text}
                  </p>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="ml-auto px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">Failed to load preferences</div>
          )}
        </div>

        {/* Admin: Email Queue Status */}
        {user?.role === 'admin' && <EmailQueueStatus />}
      </div>
    </div>
  );
}

function EmailQueueStatus() {
  const [status, setStatus] = useState<{ pending: number; sent_today: number; failed_today: number } | null>(null);
  const [processing, setProcessing] = useState(false);

  const getToken = () => localStorage.getItem('auth_token');

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/notifications/queue/status`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch queue status:', err);
    }
  };

  const processQueue = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`${API_URL}/notifications/queue/process`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        alert(`Processed ${data.data.sent} emails, ${data.data.failed} failed`);
        fetchStatus();
      }
    } catch (err) {
      console.error('Failed to process queue:', err);
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Email Queue (Admin)
      </h2>
      {status ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
              <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{status.pending}</p>
              <p className="text-sm text-yellow-600 dark:text-yellow-500">Pending</p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">{status.sent_today}</p>
              <p className="text-sm text-green-600 dark:text-green-500">Sent Today</p>
            </div>
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">{status.failed_today}</p>
              <p className="text-sm text-red-600 dark:text-red-500">Failed Today</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchStatus}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Refresh
            </button>
            <button
              onClick={processQueue}
              disabled={processing || status.pending === 0}
              className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
            >
              {processing ? 'Processing...' : 'Process Queue'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-gray-500">Loading queue status...</p>
      )}
    </div>
  );
}
