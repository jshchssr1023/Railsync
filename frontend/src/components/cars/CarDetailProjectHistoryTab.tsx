'use client';

import { useState, useEffect } from 'react';
import { Loader2, FolderKanban, Building2, Calendar, DollarSign } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('railsync_access_token');
}

async function apiFetch<T>(endpoint: string): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${endpoint}`, { headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'API error');
  return json;
}

interface ProjectHistoryEntry {
  project_id: string;
  project_number: string;
  project_name: string;
  project_type: string;
  project_status: string;
  priority: string;
  lessee_code: string;
  lessee_name: string;
  car_status: string;
  shop_code: string | null;
  shop_name: string | null;
  target_month: string | null;
  target_date: string | null;
  estimated_cost: number | null;
  plan_state: string | null;
  added_at: string;
  locked_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'text-red-600 dark:text-red-400',
  medium: 'text-amber-600 dark:text-amber-400',
  low: 'text-green-600 dark:text-green-400',
};

export default function CarDetailProjectHistoryTab({ carNumber }: { carNumber: string }) {
  const [projects, setProjects] = useState<ProjectHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ data: ProjectHistoryEntry[] }>(`/cars/${carNumber}/project-history`)
      .then(res => setProjects(res.data || []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, [carNumber]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <FolderKanban className="w-8 h-8 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-medium">No project history</p>
        <p className="text-xs mt-1">This car has not been part of any projects.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {projects.map(project => (
        <div
          key={project.project_id + (project.added_at || '')}
          className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{project.project_number}</span>
                <span className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full ${STATUS_COLORS[project.project_status?.toLowerCase()] || STATUS_COLORS.draft}`}>
                  {project.project_status}
                </span>
                {project.priority && (
                  <span className={`text-[10px] font-medium ${PRIORITY_COLORS[project.priority?.toLowerCase()] || 'text-gray-500'}`}>
                    {project.priority} priority
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{project.project_name}</p>
              {project.project_type && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{project.project_type}</p>
              )}
            </div>
            {project.estimated_cost != null && (
              <div className="text-right flex-shrink-0">
                <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                  <DollarSign className="w-3 h-3" />
                  Est. Cost
                </div>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">${project.estimated_cost.toLocaleString()}</p>
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Lessee</p>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{project.lessee_name || project.lessee_code || '-'}</p>
            </div>
            {project.shop_name && (
              <div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Shop</p>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {project.shop_name}
                </p>
              </div>
            )}
            {project.target_month && (
              <div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Target Month</p>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {project.target_month}
                </p>
              </div>
            )}
            {project.plan_state && (
              <div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Plan State</p>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{project.plan_state}</p>
              </div>
            )}
          </div>

          <div className="mt-2 text-[10px] text-gray-400 dark:text-gray-500">
            Added {project.added_at?.slice(0, 10)}
            {project.locked_at && <> &middot; Locked {project.locked_at?.slice(0, 10)}</>}
          </div>
        </div>
      ))}
    </div>
  );
}
