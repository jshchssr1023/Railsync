'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Shield, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface CheckResult {
  name: string;
  category: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  value?: string | number;
  threshold?: string | number;
}

interface ReadinessReport {
  overall_ready: boolean;
  overall_score: number;
  timestamp: string;
  checks: CheckResult[];
  summary: {
    total: number;
    passed: number;
    warned: number;
    failed: number;
  };
}

export default function GoLivePage() {
  const { isAuthenticated } = useAuth();
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;
  const fetchWithAuth = (endpoint: string) =>
    fetch(`${API_URL}${endpoint}`, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json());

  async function loadReport() {
    const res = await fetchWithAuth('/go-live/readiness');
    setReport(res.data || null);
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    loadReport().finally(() => setLoading(false));
  }, [isAuthenticated]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadReport();
    setRefreshing(false);
  }

  const categories = report ? [...new Set(report.checks.map(c => c.category))] : [];

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'pass') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === 'fail') return <XCircle className="w-4 h-4 text-red-500" />;
    return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Go-Live Readiness</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">System readiness checklist for CIPROTS cutover</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {report && (
        <>
          {/* Overall Status */}
          <div className={`rounded-lg border-2 p-6 ${
            report.overall_ready
              ? 'border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-800'
              : 'border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800'
          }`}>
            <div className="flex items-center gap-4">
              <Shield className={`w-10 h-10 ${report.overall_ready ? 'text-green-500' : 'text-red-500'}`} />
              <div>
                <h2 className={`text-xl font-bold ${report.overall_ready ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                  {report.overall_ready ? 'READY FOR GO-LIVE' : 'NOT READY — Issues Found'}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Score: {report.overall_score}% | {report.summary.passed} passed, {report.summary.warned} warnings, {report.summary.failed} failed
                </p>
                <p className="text-xs text-gray-400 mt-1">Last checked: {new Date(report.timestamp).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{report.summary.total}</div>
              <div className="text-xs text-gray-500">Total Checks</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{report.summary.passed}</div>
              <div className="text-xs text-gray-500">Passed</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">{report.summary.warned}</div>
              <div className="text-xs text-gray-500">Warnings</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{report.summary.failed}</div>
              <div className="text-xs text-gray-500">Failed</div>
            </div>
          </div>

          {/* Checks by Category */}
          <div className="space-y-4">
            {categories.map(cat => {
              const checks = report.checks.filter(c => c.category === cat);
              const catFailed = checks.some(c => c.status === 'fail');
              const catWarned = checks.some(c => c.status === 'warn');
              return (
                <div key={cat} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className={`px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between ${
                    catFailed ? 'bg-red-50 dark:bg-red-950/10' : catWarned ? 'bg-yellow-50 dark:bg-yellow-950/10' : 'bg-green-50 dark:bg-green-950/10'
                  }`}>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{cat}</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      catFailed ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        : catWarned ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                        : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    }`}>
                      {checks.filter(c => c.status === 'pass').length}/{checks.length} passed
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {checks.map((c, i) => (
                      <div key={i} className="px-4 py-3 flex items-center gap-3">
                        <StatusIcon status={c.status} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">{c.name}</div>
                          <div className="text-xs text-gray-500 truncate">{c.message}</div>
                        </div>
                        {c.threshold !== undefined && (
                          <div className="text-xs text-gray-400 whitespace-nowrap">
                            {String(c.value)} / {String(c.threshold)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
