'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, MessageSquare } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Feedback {
  id: string;
  user_name: string;
  page: string | null;
  category: string;
  severity: string;
  title: string;
  description: string | null;
  status: string;
  admin_notes: string | null;
  reviewer_name: string | null;
  created_at: string;
}

interface FeedbackStats {
  total: number;
  new_count: number;
  reviewed: number;
  planned: number;
  resolved: number;
  bugs: number;
  features: number;
  usability: number;
}

export default function FeedbackPage() {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'other', severity: 'low', page: '' });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>('');

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;
  const fetchWithAuth = (endpoint: string, opts?: RequestInit) =>
    fetch(`${API_URL}${endpoint}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } }).then(r => r.json());

  async function loadData() {
    const params = filter ? `?status=${filter}` : '';
    await Promise.all([
      fetchWithAuth(`/feedback${params}`).then(r => setFeedback(r.data || [])),
      fetchWithAuth('/feedback/stats').then(r => setStats(r.data || null)),
    ]);
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [isAuthenticated, filter]);

  async function handleSubmit() {
    if (!form.title.trim()) return;
    setSaving(true);
    await fetchWithAuth('/feedback', { method: 'POST', body: JSON.stringify({ ...form, page: form.page || pathname }) });
    setForm({ title: '', description: '', category: 'other', severity: 'low', page: '' });
    setShowForm(false);
    await loadData();
    setSaving(false);
  }

  async function handleStatusUpdate(id: string, status: string) {
    await fetchWithAuth(`/feedback/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    await loadData();
  }

  const categoryBadge = (cat: string) => {
    const colors: Record<string, string> = {
      bug: 'bg-red-100 text-red-700', feature: 'bg-blue-100 text-blue-700',
      usability: 'bg-purple-100 text-purple-700', performance: 'bg-yellow-100 text-yellow-700',
      other: 'bg-gray-100 text-gray-600',
    };
    return <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${colors[cat] || colors.other}`}>{cat}</span>;
  };

  const statusBadge = (st: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-100 text-blue-700', reviewed: 'bg-yellow-100 text-yellow-700',
      planned: 'bg-purple-100 text-purple-700', resolved: 'bg-green-100 text-green-700',
      wontfix: 'bg-gray-100 text-gray-600',
    };
    return <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${colors[st] || 'bg-gray-100 text-gray-600'}`}>{st === 'wontfix' ? "won't fix" : st}</span>;
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Feedback</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Submit and track user feedback for system improvements</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700">
          <Plus className="w-4 h-4" /> Submit Feedback
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
            <div className="text-lg font-bold text-blue-600">{stats.new_count}</div>
            <div className="text-xs text-gray-500">New</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
            <div className="text-lg font-bold text-red-600">{stats.bugs}</div>
            <div className="text-xs text-gray-500">Bugs</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
            <div className="text-lg font-bold text-blue-600">{stats.features}</div>
            <div className="text-xs text-gray-500">Features</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
            <div className="text-lg font-bold text-green-600">{stats.resolved}</div>
            <div className="text-xs text-gray-500">Resolved</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{stats.total}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
        </div>
      )}

      {/* New Feedback Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> New Feedback
          </h3>
          <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="Title" className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800" />
          <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Description (optional)" rows={3} className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800" />
          <div className="flex gap-3">
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800">
              <option value="bug">Bug</option>
              <option value="feature">Feature Request</option>
              <option value="usability">Usability</option>
              <option value="performance">Performance</option>
              <option value="other">Other</option>
            </select>
            <select value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} disabled={saving || !form.title.trim()}
              className="px-4 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Submitting...' : 'Submit'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md">Cancel</button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {['', 'new', 'reviewed', 'planned', 'resolved'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded-full ${filter === f ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
            {f || 'All'}
          </button>
        ))}
      </div>

      {/* Feedback List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
        {feedback.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No feedback yet</p>
        ) : feedback.map(fb => (
          <div key={fb.id} className="px-4 py-3 flex items-start gap-3">
            <div className="pt-0.5">{categoryBadge(fb.category)}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{fb.title}</div>
              {fb.description && <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{fb.description}</div>}
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                {statusBadge(fb.status)}
                <span>{fb.user_name}</span>
                {fb.page && <span>{fb.page}</span>}
                <span>{new Date(fb.created_at).toLocaleDateString()}</span>
              </div>
              {fb.admin_notes && <div className="text-xs text-gray-500 mt-1 italic">Admin: {fb.admin_notes}</div>}
            </div>
            <div className="flex gap-1">
              {fb.status === 'new' && (
                <button onClick={() => handleStatusUpdate(fb.id, 'reviewed')}
                  className="text-xs px-2 py-1 rounded bg-yellow-50 text-yellow-700 hover:bg-yellow-100">Review</button>
              )}
              {(fb.status === 'new' || fb.status === 'reviewed') && (
                <button onClick={() => handleStatusUpdate(fb.id, 'planned')}
                  className="text-xs px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100">Plan</button>
              )}
              {fb.status !== 'resolved' && fb.status !== 'wontfix' && (
                <button onClick={() => handleStatusUpdate(fb.id, 'resolved')}
                  className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100">Resolve</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
