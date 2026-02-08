'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, ChevronDown, ChevronRight, DollarSign, FileCheck, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getEstimate, getEstimateDecisions, updateEstimateStatus, generateApprovalPacket, runEstimatePreReview } from '@/lib/api';
import { EstimateSubmission, EstimateLineDecision } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const statusColors: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  under_review: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  changes_required: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const statusIcons: Record<string, typeof Clock> = {
  submitted: Clock,
  under_review: AlertCircle,
  approved: CheckCircle,
  changes_required: AlertCircle,
  rejected: XCircle,
};

function fmt(n: number | null): string {
  if (n === null) return '-';
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function EstimatesPage() {
  const { user, isAuthenticated } = useAuth();
  const isOperator = isAuthenticated && (user?.role === 'admin' || user?.role === 'operator');
  const [estimates, setEstimates] = useState<EstimateSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<EstimateLineDecision[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [preReviewing, setPreReviewing] = useState<string | null>(null);

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;
  const fetchWithAuth = (endpoint: string) =>
    fetch(`${API_URL}${endpoint}`, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json());

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    // Fetch estimates from shopping events that have estimates
    fetchWithAuth('/shopping-events?limit=200')
      .then(async (res) => {
        const events = res.data || [];
        const estimatePromises = events
          .filter((e: any) => e.status === 'estimate_received' || e.status === 'estimate_review' || e.status === 'approved' || e.status === 'work_in_progress')
          .map(async (e: any) => {
            try {
              const est = await fetchWithAuth(`/shopping-events/${e.id}/estimates`);
              return (est.data || []).map((sub: any) => ({ ...sub, shopping_event_id: e.id, car_number: e.car_number, shop_code: e.shop_code }));
            } catch { return []; }
          });
        const results = await Promise.all(estimatePromises);
        setEstimates(results.flat());
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  async function toggleExpand(estId: string) {
    if (expandedId === estId) { setExpandedId(null); return; }
    setExpandedId(estId);
    setLoadingDetail(true);
    try {
      const decs = await getEstimateDecisions(estId);
      setDecisions(decs);
    } catch { setDecisions([]); }
    finally { setLoadingDetail(false); }
  }

  async function handleStatusChange(estId: string, newStatus: string) {
    setUpdating(estId);
    try {
      const updated = await updateEstimateStatus(estId, newStatus);
      setEstimates(estimates.map(e => e.id === estId ? { ...e, ...updated } : e));
    } catch { /* silent */ }
    finally { setUpdating(null); }
  }

  async function handlePreReview(estId: string) {
    setPreReviewing(estId);
    try {
      await runEstimatePreReview(estId);
      // Refresh decisions
      const decs = await getEstimateDecisions(estId);
      setDecisions(decs);
    } catch { /* silent */ }
    finally { setPreReviewing(null); }
  }

  async function handleGeneratePacket(estId: string) {
    try {
      await generateApprovalPacket(estId, {
        overall_decision: 'approved',
        line_decisions: [],
      });
      alert('Approval packet generated successfully.');
    } catch { /* silent */ }
  }

  const filtered = statusFilter ? estimates.filter(e => e.status === statusFilter) : estimates;

  // Count by status
  const counts = estimates.reduce((acc, e) => { acc[e.status] = (acc[e.status] || 0) + 1; return acc; }, {} as Record<string, number>);

  if (!isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
          Please sign in to view estimates
        </h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Estimate Review</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Review, approve, and manage shop repair estimates</p>
      </div>

      {/* Status filter cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button onClick={() => setStatusFilter('')} className={`bg-white dark:bg-gray-800 rounded-lg border p-3 text-left transition-colors ${!statusFilter ? 'border-primary-500 ring-1 ring-primary-500' : 'border-gray-200 dark:border-gray-700'}`}>
          <div className="text-xs text-gray-500 dark:text-gray-400">All</div>
          <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{estimates.length}</div>
        </button>
        {Object.keys(statusColors).map(s => {
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

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="w-8 px-3 py-2" />
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Car / Shop</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Version</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Status</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Labor Hrs</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Material</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Total</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Submitted</th>
                {isOperator && <th className="px-4 py-2 text-xs font-medium text-gray-500">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map(est => {
                const nextStatuses = getNextStatuses(est.status);
                return (
                  <React.Fragment key={est.id}>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => toggleExpand(est.id)}>
                      <td className="px-3 py-2 text-gray-400">
                        {expandedId === est.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{(est as any).car_number || '-'}</div>
                        <div className="text-xs text-gray-400">{(est as any).shop_code || '-'}</div>
                      </td>
                      <td className="text-center px-4 py-2 text-gray-700 dark:text-gray-300">v{est.version_number}</td>
                      <td className="text-center px-4 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[est.status] || 'bg-gray-100 text-gray-500'}`}>
                          {est.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="text-right px-4 py-2 text-gray-700 dark:text-gray-300">{est.total_labor_hours ?? '-'}</td>
                      <td className="text-right px-4 py-2 text-gray-700 dark:text-gray-300">{fmt(est.total_material_cost)}</td>
                      <td className="text-right px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{fmt(est.total_cost)}</td>
                      <td className="px-4 py-2 text-xs text-gray-400">{est.submitted_at ? new Date(est.submitted_at).toLocaleDateString() : '-'}</td>
                      {isOperator && (
                        <td className="px-4 py-2" onClick={e => e.stopPropagation()}>
                          {updating === est.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                          ) : (
                            <div className="flex gap-2 flex-wrap">
                              {nextStatuses.map(ns => (
                                <button key={ns} onClick={() => handleStatusChange(est.id, ns)} className="text-xs text-primary-600 hover:underline capitalize whitespace-nowrap">
                                  {ns.replace('_', ' ')}
                                </button>
                              ))}
                              {est.status === 'submitted' && (
                                <button onClick={() => handlePreReview(est.id)} disabled={preReviewing === est.id} className="text-xs text-purple-600 hover:underline whitespace-nowrap">
                                  {preReviewing === est.id ? 'Running...' : 'AI Pre-Review'}
                                </button>
                              )}
                              {est.status === 'approved' && (
                                <button onClick={() => handleGeneratePacket(est.id)} className="text-xs text-green-600 hover:underline whitespace-nowrap">
                                  Gen. Packet
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                    {expandedId === est.id && (
                      <tr key={`${est.id}-detail`}>
                        <td colSpan={isOperator ? 9 : 8} className="bg-gray-50 dark:bg-gray-900/30 px-8 py-4">
                          {loadingDetail ? (
                            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /></div>
                          ) : (
                            <div className="space-y-4">
                              {est.notes && (
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  <strong>Notes:</strong> {est.notes}
                                </div>
                              )}

                              {/* Line items */}
                              {est.lines && est.lines.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Line Items ({est.lines.length})</h4>
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <th className="text-left py-1 px-2 text-gray-500">#</th>
                                        <th className="text-left py-1 px-2 text-gray-500">AAR Code</th>
                                        <th className="text-left py-1 px-2 text-gray-500">Description</th>
                                        <th className="text-right py-1 px-2 text-gray-500">Hours</th>
                                        <th className="text-right py-1 px-2 text-gray-500">Material</th>
                                        <th className="text-right py-1 px-2 text-gray-500">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                      {est.lines.map(line => (
                                        <tr key={line.id}>
                                          <td className="py-1 px-2 text-gray-400">{line.line_number}</td>
                                          <td className="py-1 px-2 text-gray-700 dark:text-gray-300">{line.aar_code || '-'}</td>
                                          <td className="py-1 px-2 text-gray-700 dark:text-gray-300 max-w-[300px] truncate">{line.description || '-'}</td>
                                          <td className="text-right py-1 px-2 text-gray-700 dark:text-gray-300">{line.labor_hours ?? '-'}</td>
                                          <td className="text-right py-1 px-2 text-gray-700 dark:text-gray-300">{fmt(line.material_cost)}</td>
                                          <td className="text-right py-1 px-2 font-medium text-gray-900 dark:text-gray-100">{fmt(line.total_cost)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* Decisions */}
                              {decisions.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Line Decisions ({decisions.length})</h4>
                                  <div className="space-y-1">
                                    {decisions.map(d => (
                                      <div key={d.id} className="flex items-center gap-3 text-xs">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${d.decision === 'approve' ? 'bg-green-100 text-green-700' : d.decision === 'reject' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                          {d.decision}
                                        </span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${d.decision_source === 'ai' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                                          {d.decision_source}
                                        </span>
                                        <span className="text-gray-500">{d.responsibility}</span>
                                        {d.confidence_score !== null && <span className="text-gray-400">{(d.confidence_score * 100).toFixed(0)}% conf</span>}
                                        {d.decision_notes && <span className="text-gray-400 truncate max-w-[200px]">{d.decision_notes}</span>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No estimates found{statusFilter ? ` with status "${statusFilter.replace('_', ' ')}"` : ''}</p>}
        </div>
      )}
    </div>
  );
}

function getNextStatuses(current: string): string[] {
  switch (current) {
    case 'submitted': return ['under_review', 'rejected'];
    case 'under_review': return ['approved', 'changes_required', 'rejected'];
    case 'changes_required': return ['under_review'];
    default: return [];
  }
}
