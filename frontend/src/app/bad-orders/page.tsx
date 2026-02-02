'use client';

import { useState, useEffect, useCallback } from 'react';
import { listBadOrders, createBadOrder, resolveBadOrder, BadOrderReport } from '@/lib/api';
import { FetchError } from '@/components/ErrorBoundary';

const SEVERITY_COLORS = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

const STATUS_COLORS = {
  open: 'bg-red-100 text-red-800',
  pending_decision: 'bg-yellow-100 text-yellow-800',
  assigned: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
};

export default function BadOrdersPage() {
  const [reports, setReports] = useState<BadOrderReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<string>('');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBadOrders(filter ? { status: filter } : undefined);
      setReports(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bad orders');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      await createBadOrder({
        car_number: formData.get('car_number') as string,
        issue_type: formData.get('issue_type') as string,
        issue_description: formData.get('issue_description') as string,
        severity: formData.get('severity') as string,
        location: formData.get('location') as string || undefined,
        reported_by: formData.get('reported_by') as string || undefined,
      });
      setShowForm(false);
      fetchReports();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create report');
    }
  };

  const handleResolve = async (id: string, action: string) => {
    try {
      await resolveBadOrder(id, action);
      fetchReports();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resolve');
    }
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <FetchError error={error} onRetry={fetchReports} />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bad Order Reports</h1>
          <p className="text-sm text-gray-500">Track and resolve unplanned repair needs</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
        >
          {showForm ? 'Cancel' : '+ Report Bad Order'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Car Number *</label>
              <input name="car_number" required className="input w-full" placeholder="GATX 12345" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Severity *</label>
              <select name="severity" required className="input w-full">
                <option value="critical">Critical - Safety issue</option>
                <option value="high">High - Needs prompt attention</option>
                <option value="medium">Medium - Found during inspection</option>
                <option value="low">Low - Minor issue</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Issue Type *</label>
              <select name="issue_type" required className="input w-full">
                <option value="valve_leak">Valve Leak</option>
                <option value="structural_damage">Structural Damage</option>
                <option value="lining_failure">Lining Failure</option>
                <option value="tank_integrity">Tank Integrity</option>
                <option value="safety_device">Safety Device</option>
                <option value="wheels_trucks">Wheels/Trucks</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <input name="location" className="input w-full" placeholder="Houston Yard" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description *</label>
            <textarea name="issue_description" required rows={2} className="input w-full" placeholder="Describe the issue..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reported By</label>
            <input name="reported_by" className="input w-full" placeholder="Your name" />
          </div>
          <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
            Submit Bad Order Report
          </button>
        </form>
      )}

      <div className="flex gap-2">
        {['', 'open', 'pending_decision', 'assigned', 'resolved'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-sm ${filter === s ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />)}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No bad order reports found</div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{report.car_number}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[report.severity]}`}>
                      {report.severity}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[report.status]}`}>
                      {report.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {report.issue_type.replace('_', ' ')} - {report.issue_description}
                  </p>
                  {report.location && <p className="text-xs text-gray-500 mt-1">Location: {report.location}</p>}
                  {report.had_existing_plan && (
                    <p className="text-xs text-yellow-600 mt-1">
                      Has existing plan: {report.existing_shop_code} ({report.existing_target_month})
                    </p>
                  )}
                </div>
                {(report.status === 'open' || report.status === 'pending_decision') && (
                  <div className="flex gap-2">
                    {report.had_existing_plan ? (
                      <>
                        <button onClick={() => handleResolve(report.id, 'expedite_existing')} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          Expedite Existing
                        </button>
                        <button onClick={() => handleResolve(report.id, 'planning_review')} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                          Planning Review
                        </button>
                      </>
                    ) : (
                      <button onClick={() => handleResolve(report.id, 'repair_only')} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                        Create Assignment
                      </button>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">Reported: {new Date(report.reported_date).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
