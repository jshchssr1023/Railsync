'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, X, Calendar, Wrench, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { listServiceEvents, createServiceEvent, updateServiceEventStatus } from '@/lib/api';
import { ServiceEvent } from '@/types';

const EVENT_TYPES = ['Qualification', 'Assignment', 'Return', 'Running Repair', 'Inspection', 'Tank Test'];
const STATUSES = ['requested', 'scheduled', 'in_progress', 'completed', 'cancelled'];

const statusColors: Record<string, string> = {
  requested: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

const statusIcons: Record<string, typeof Clock> = {
  requested: Clock,
  scheduled: Calendar,
  in_progress: Wrench,
  completed: CheckCircle,
  cancelled: AlertTriangle,
};

export default function ServiceEventsPage() {
  const { user, isAuthenticated } = useAuth();
  const isOperator = isAuthenticated && (user?.role === 'admin' || user?.role === 'operator');
  const [events, setEvents] = useState<ServiceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const [form, setForm] = useState({
    car_number: '',
    event_type: 'Qualification',
    requested_date: new Date().toISOString().slice(0, 10),
    assigned_shop: '',
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    listServiceEvents(statusFilter ? { status: statusFilter } : undefined)
      .then(data => setEvents(data))
      .finally(() => setLoading(false));
  }, [isAuthenticated, statusFilter]);

  async function handleCreate() {
    setCreating(true);
    try {
      const newEvent = await createServiceEvent({
        car_number: form.car_number,
        event_type: form.event_type,
        requested_date: form.requested_date,
        assigned_shop: form.assigned_shop || undefined,
      });
      setEvents(prev => [newEvent, ...prev]);
      setShowCreate(false);
      setForm({ car_number: '', event_type: 'Qualification', requested_date: new Date().toISOString().slice(0, 10), assigned_shop: '' });
    } catch { /* silent */ }
    finally { setCreating(false); }
  }

  async function handleStatusChange(eventId: string, newStatus: string) {
    setUpdating(eventId);
    try {
      const updated = await updateServiceEventStatus(eventId, newStatus);
      setEvents(events.map(e => e.event_id === updated.event_id ? updated : e));
    } catch { /* silent */ }
    finally { setUpdating(null); }
  }

  // Count by status
  const counts = events.reduce((acc, e) => { acc[e.status] = (acc[e.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  const totalCount = events.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Service Events</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Schedule and track car service events across the fleet</p>
        </div>
        {isOperator && (
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700">
            <Plus className="w-4 h-4" /> New Event
          </button>
        )}
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button onClick={() => setStatusFilter('')} className={`bg-white dark:bg-gray-800 rounded-lg border p-3 text-left transition-colors ${!statusFilter ? 'border-primary-500 ring-1 ring-primary-500' : 'border-gray-200 dark:border-gray-700'}`}>
          <div className="text-xs text-gray-500 dark:text-gray-400">All</div>
          <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{totalCount}</div>
        </button>
        {STATUSES.map(s => {
          const Icon = statusIcons[s] || Clock;
          return (
            <button key={s} onClick={() => setStatusFilter(s === statusFilter ? '' : s)} className={`bg-white dark:bg-gray-800 rounded-lg border p-3 text-left transition-colors ${statusFilter === s ? 'border-primary-500 ring-1 ring-primary-500' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 capitalize">
                <Icon className="w-3 h-3" /> {s.replace('_', ' ')}
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{counts[s] || 0}</div>
            </button>
          );
        })}
      </div>

      {/* Create form */}
      {showCreate && isOperator && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Create Service Event</h3>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Car Number</label>
              <input value={form.car_number} onChange={e => setForm({ ...form, car_number: e.target.value })} placeholder="e.g. UTLX 12345" className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Event Type</label>
              <select value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Requested Date</label>
              <input type="date" value={form.requested_date} onChange={e => setForm({ ...form, requested_date: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assigned Shop (optional)</label>
              <input value={form.assigned_shop} onChange={e => setForm({ ...form, assigned_shop: e.target.value })} placeholder="Shop code" className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={handleCreate} disabled={creating || !form.car_number} className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Event
            </button>
          </div>
        </div>
      )}

      {/* Events table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Car</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Event Type</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Requested</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Shop</th>
                {isOperator && <th className="px-4 py-2 text-xs font-medium text-gray-500">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {events.map(evt => {
                const nextStatuses = getNextStatuses(evt.status);
                return (
                  <tr key={evt.event_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{evt.car_number}</td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{evt.event_type}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[evt.status] || 'bg-gray-100 text-gray-500'}`}>
                        {evt.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs">{new Date(evt.requested_date).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{evt.assigned_shop || '-'}</td>
                    {isOperator && (
                      <td className="px-4 py-2">
                        {updating === evt.event_id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                        ) : nextStatuses.length > 0 ? (
                          <div className="flex gap-1">
                            {nextStatuses.map(ns => (
                              <button key={ns} onClick={() => handleStatusChange(evt.event_id, ns)} className="text-xs text-primary-600 hover:underline capitalize">
                                {ns.replace('_', ' ')}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {events.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No service events found</p>}
        </div>
      )}
    </div>
  );
}

function getNextStatuses(current: string): string[] {
  switch (current) {
    case 'requested': return ['scheduled', 'cancelled'];
    case 'scheduled': return ['in_progress', 'cancelled'];
    case 'in_progress': return ['completed'];
    default: return [];
  }
}
