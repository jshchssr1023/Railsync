'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface InvoiceLineItem {
  id: string;
  line_number: number;
  car_number?: string;
  brc_number?: string;
  job_code?: string;
  why_made_code?: string;
  labor_amount: number;
  material_amount: number;
  total_amount: number;
  description?: string;
  match_status: string;
  matched_allocation_id?: string;
  match_confidence?: number;
  match_notes?: string;
  manually_verified: boolean;
  verified_by?: string;
  verified_at?: string;
}

interface BrcMatch {
  id: string;
  allocation_id: string;
  brc_number?: string;
  brc_total?: number;
  invoice_amount?: number;
  match_type: string;
  allocation_car_number?: string;
  allocation_shop_code?: string;
  allocation_actual_cost?: number;
  allocation_job_codes?: { code: string; amount: number }[];
}

interface InvoiceComparison {
  invoice: {
    id: string;
    invoice_number: string;
    vendor_code?: string;
    shop_code?: string;
    shop_name?: string;
    invoice_date: string;
    received_date: string;
    invoice_total: number;
    brc_total?: number;
    variance_amount?: number;
    variance_pct?: number;
    status: string;
    approval_notes?: string;
    reviewed_by_name?: string;
    reviewed_at?: string;
    original_filename?: string;
    file_format?: string;
  };
  line_items: InvoiceLineItem[];
  brc_matches: BrcMatch[];
  summary: {
    invoice_total: number;
    brc_total: number;
    variance_amount: number;
    variance_pct: number;
    within_tolerance: boolean;
    exact_matches: number;
    close_matches: number;
    unmatched: number;
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  auto_approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  manual_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  sent_to_sap: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

const MATCH_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  exact_match: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  close_match: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  no_match: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  manually_matched: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const [comparison, setComparison] = useState<InvoiceComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const getToken = () => localStorage.getItem('auth_token');

  const fetchComparison = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/invoices/${id}/comparison`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.invoice) {
        setComparison(data);
      }
    } catch (err) {
      console.error('Failed to fetch invoice comparison:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && id) {
      fetchComparison();
    }
  }, [isAuthenticated, id]);

  const handleApprove = async () => {
    if (!confirm('Are you sure you want to approve this invoice?')) return;

    setApproving(true);
    try {
      const res = await fetch(`${API_URL}/invoices/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (data.id) {
        fetchComparison();
        alert('Invoice approved successfully');
      } else {
        alert(data.error || 'Failed to approve invoice');
      }
    } catch (err) {
      console.error('Approval failed:', err);
      alert('Failed to approve invoice');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    setRejecting(true);
    try {
      const res = await fetch(`${API_URL}/invoices/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ notes: rejectReason }),
      });
      const data = await res.json();

      if (data.id) {
        setShowRejectModal(false);
        setRejectReason('');
        fetchComparison();
        alert('Invoice rejected');
      } else {
        alert(data.error || 'Failed to reject invoice');
      }
    } catch (err) {
      console.error('Rejection failed:', err);
      alert('Failed to reject invoice');
    } finally {
      setRejecting(false);
    }
  };

  const handleRematch = async () => {
    if (!confirm('Re-run matching against BRC data?')) return;

    setRematching(true);
    try {
      const res = await fetch(`${API_URL}/invoices/${id}/rematch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
      });
      const data = await res.json();

      if (data.invoice) {
        fetchComparison();
        alert('Matching complete');
      } else {
        alert(data.error || 'Matching failed');
      }
    } catch (err) {
      console.error('Rematch failed:', err);
      alert('Failed to rematch');
    } finally {
      setRematching(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        Please log in to view invoice details.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 mx-auto text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="mt-4 text-gray-500 dark:text-gray-400">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">Invoice not found</p>
          <button
            onClick={() => router.push('/invoices')}
            className="mt-4 text-blue-600 hover:underline"
          >
            Back to Invoices
          </button>
        </div>
      </div>
    );
  }

  const { invoice, line_items, brc_matches, summary } = comparison;
  const canApprove = ['pending', 'manual_review', 'auto_approved'].includes(invoice.status);
  const canReject = ['pending', 'manual_review'].includes(invoice.status);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <button
              onClick={() => router.push('/invoices')}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1 mb-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Invoices
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Invoice {invoice.invoice_number}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {invoice.shop_name || invoice.shop_code || 'Unknown Shop'} &bull; {formatDate(invoice.invoice_date)}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 text-sm rounded-full ${STATUS_COLORS[invoice.status]}`}>
              {invoice.status.replace(/_/g, ' ').toUpperCase()}
            </span>

            {canApprove && (
              <button
                onClick={handleApprove}
                disabled={approving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {approving ? 'Approving...' : 'Approve'}
              </button>
            )}

            {canReject && (
              <button
                onClick={() => setShowRejectModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Reject
              </button>
            )}

            <button
              onClick={handleRematch}
              disabled={rematching}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {rematching ? 'Matching...' : 'Re-Match'}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">Invoice Total</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {formatCurrency(summary.invoice_total)}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">BRC Total</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {formatCurrency(summary.brc_total)}
            </div>
          </div>

          <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 border ${summary.within_tolerance ? 'border-green-300 dark:border-green-700' : 'border-red-300 dark:border-red-700'}`}>
            <div className="text-sm text-gray-500 dark:text-gray-400">Variance</div>
            <div className={`text-2xl font-bold mt-1 ${summary.within_tolerance ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {summary.variance_pct >= 0 ? '+' : ''}{summary.variance_pct.toFixed(2)}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formatCurrency(summary.variance_amount)}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">Matching</div>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-green-600 dark:text-green-400 font-semibold">
                {summary.exact_matches} exact
              </span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                {summary.close_matches} close
              </span>
              <span className="text-red-600 dark:text-red-400 font-semibold">
                {summary.unmatched} unmatched
              </span>
            </div>
          </div>
        </div>

        {/* Approval Notes */}
        {invoice.approval_notes && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-8">
            <div className="text-sm text-gray-500 dark:text-gray-400">Notes</div>
            <p className="text-gray-900 dark:text-white mt-1">{invoice.approval_notes}</p>
            {invoice.reviewed_by_name && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                By {invoice.reviewed_by_name} on {invoice.reviewed_at ? formatDate(invoice.reviewed_at) : ''}
              </p>
            )}
          </div>
        )}

        {/* Line Items Comparison */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Line Items Comparison</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Car</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Job</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Why Made</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Invoice Amt</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">BRC Amt</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Match</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {line_items.map((item) => {
                  const match = brc_matches.find(m => m.allocation_id === item.matched_allocation_id);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {item.line_number}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {item.car_number || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {item.job_code || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {item.why_made_code || '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white">
                        {formatCurrency(item.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                        {match ? formatCurrency(match.brc_total || match.allocation_actual_cost || 0) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 text-xs rounded-full ${MATCH_STATUS_COLORS[item.match_status]}`}>
                          {item.match_status.replace(/_/g, ' ')}
                        </span>
                        {item.match_confidence && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {item.match_confidence}%
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate">
                        {item.match_notes || item.description || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Reject Invoice
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Please provide a reason for rejecting this invoice.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Rejection reason..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejecting || !rejectReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {rejecting ? 'Rejecting...' : 'Reject Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
