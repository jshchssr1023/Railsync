'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface Project {
  id: string;
  project_number: string;
  project_name: string;
  project_type: string;
  scope_of_work: string;
  special_instructions: string | null;
  engineer_notes: string | null;
  customer_billable: boolean;
  estimated_total_cost: string;
  lessee_code: string | null;
  lessee_name: string | null;
  due_date: string | null;
  priority: number;
  status: string;
  mc_name: string | null;
  ec_name: string | null;
  total_cars: string;
  pending_cars: string;
  in_progress_cars: string;
  completed_cars: string;
  deadline_status: string;
  created_at: string;
}

interface ProjectCar {
  id: string;
  car_number: string;
  status: string;
  car_type: string;
  lessee_name: string;
  commodity: string;
  tank_qual_year: number;
  car_current_status: string;
  brc_reviewed: boolean;
  added_at: string;
}

interface ProjectSummary {
  by_type: { project_type: string; total: string; active: string; in_progress: string; completed: string; overdue: string }[];
  by_mc: { mc_name: string; total_projects: string; active: string; in_progress: string; total_cars: string }[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const PROJECT_TYPES = [
  { value: 'assignment', label: 'Assignment', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
  { value: 'release', label: 'Release', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
  { value: 'qualification', label: 'Qualification', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
  { value: 'lining', label: 'Lining', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300' },
  { value: 'inspection', label: 'Inspection', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
  { value: 'other', label: 'Other', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  active: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  pending_review: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
};

const DEADLINE_COLORS: Record<string, string> = {
  'Overdue': 'text-red-600 dark:text-red-400',
  'Due This Week': 'text-orange-600 dark:text-orange-400',
  'Due This Month': 'text-yellow-600 dark:text-yellow-400',
  'Future': 'text-green-600 dark:text-green-400',
  'No Deadline': 'text-gray-500 dark:text-gray-400',
};

export default function ProjectsPage() {
  const { getAccessToken } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectCars, setProjectCars] = useState<ProjectCar[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddCarsModal, setShowAddCarsModal] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [activeOnly, setActiveOnly] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterType) params.append('type', filterType);
      if (filterStatus) params.append('status', filterStatus);
      if (activeOnly) params.append('active_only', 'true');

      const token = getAccessToken();
      const res = await fetch(`${API_URL}/projects?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) setProjects(data.data);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  }, [getAccessToken, filterType, filterStatus, activeOnly]);

  const fetchSummary = useCallback(async () => {
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_URL}/projects/summary`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) setSummary(data.data);
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    }
  }, [getAccessToken]);

  const fetchProjectDetails = async (projectId: string) => {
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_URL}/projects/${projectId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        setSelectedProject(data.data);
        setProjectCars(data.data.cars || []);
      }
    } catch (err) {
      console.error('Failed to fetch project details:', err);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchProjects(), fetchSummary()]);
      setLoading(false);
    };
    load();
  }, [fetchProjects, fetchSummary]);

  const getTypeColor = (type: string) => {
    return PROJECT_TYPES.find(t => t.value === type)?.color || PROJECT_TYPES[5].color;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  // Client-side filtering for search
  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) return projects;
    const term = searchTerm.toLowerCase();
    return projects.filter(p =>
      p.project_number.toLowerCase().includes(term) ||
      p.project_name.toLowerCase().includes(term) ||
      (p.lessee_name && p.lessee_name.toLowerCase().includes(term)) ||
      (p.lessee_code && p.lessee_code.toLowerCase().includes(term)) ||
      (p.mc_name && p.mc_name.toLowerCase().includes(term)) ||
      (p.ec_name && p.ec_name.toLowerCase().includes(term))
    );
  }, [projects, searchTerm]);

  // Create Project Form
  const [newProject, setNewProject] = useState({
    project_name: '',
    project_type: 'qualification',
    scope_of_work: '',
    special_instructions: '',
    lessee_code: '',
    lessee_name: '',
    due_date: '',
    customer_billable: false,
    estimated_total_cost: '',
  });

  const handleCreateProject = async () => {
    try {
      const res = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify(newProject),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        setNewProject({
          project_name: '',
          project_type: 'qualification',
          scope_of_work: '',
          special_instructions: '',
          lessee_code: '',
          lessee_name: '',
          due_date: '',
          customer_billable: false,
          estimated_total_cost: '',
        });
        fetchProjects();
      }
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  };

  // Add Cars
  const [carNumbersInput, setCarNumbersInput] = useState('');

  const handleAddCars = async () => {
    if (!selectedProject) return;
    const carNumbers = carNumbersInput.split(/[\n,]/).map(c => c.trim()).filter(c => c);
    if (carNumbers.length === 0) return;

    try {
      const res = await fetch(`${API_URL}/projects/${selectedProject.id}/cars`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({ car_numbers: carNumbers }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddCarsModal(false);
        setCarNumbersInput('');
        fetchProjectDetails(selectedProject.id);
      }
    } catch (err) {
      console.error('Failed to add cars:', err);
    }
  };

  const handleActivateProject = async () => {
    if (!selectedProject) return;
    try {
      const res = await fetch(`${API_URL}/projects/${selectedProject.id}/activate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        fetchProjectDetails(selectedProject.id);
        fetchProjects();
      }
    } catch (err) {
      console.error('Failed to activate project:', err);
    }
  };

  const handleCompleteProject = async () => {
    if (!selectedProject) return;
    if (!confirm('Complete this project? All pending cars will be marked as completed.')) return;
    try {
      const res = await fetch(`${API_URL}/projects/${selectedProject.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({ completion_notes: 'Project completed' }),
      });
      const data = await res.json();
      if (data.success) {
        fetchProjectDetails(selectedProject.id);
        fetchProjects();
      }
    } catch (err) {
      console.error('Failed to complete project:', err);
    }
  };

  const handleBrcReview = async (carNumber: string) => {
    if (!selectedProject) return;
    try {
      const res = await fetch(`${API_URL}/projects/${selectedProject.id}/cars/${carNumber}/brc-review`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        fetchProjectDetails(selectedProject.id);
      }
    } catch (err) {
      console.error('Failed to BRC review:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Projects</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Group cars for coordinated work - assignments, releases, qualifications
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            + New Project
          </button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {summary.by_type.map(t => (
              <div key={t.project_type} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${getTypeColor(t.project_type)}`}>
                  {t.project_type}
                </div>
                <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{t.total}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t.active} active · {t.overdue} overdue
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px] max-w-md">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search project name, number, lessee..."
                className="w-full pl-9 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                >
                  <X className="w-3 h-3 text-gray-400" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Type</label>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
            >
              <option value="">All Types</option>
              {PROJECT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="activeOnly"
              checked={activeOnly}
              onChange={e => setActiveOnly(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="activeOnly" className="text-sm text-gray-700 dark:text-gray-300">
              Active Only
            </label>
          </div>
          <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
            {filteredProjects.length} of {projects.length} projects
          </div>
        </div>

        {/* Projects Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Project</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Lessee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cars</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Due Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredProjects.map(project => (
                <tr
                  key={project.id}
                  onClick={() => fetchProjectDetails(project.id)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{project.project_number}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{project.project_name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(project.project_type)}`}>
                      {project.project_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {project.lessee_name || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{project.total_cars}</span>
                      <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">
                        ({project.completed_cars} done)
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`text-sm ${DEADLINE_COLORS[project.deadline_status] || ''}`}>
                      {formatDate(project.due_date)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{project.deadline_status}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[project.status] || ''}`}>
                      {project.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredProjects.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {searchTerm ? 'No projects match your search' : 'No projects found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Project Detail Slide-over */}
        {selectedProject && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedProject(null)} />
            <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white dark:bg-gray-800 shadow-xl overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(selectedProject.project_type)}`}>
                        {selectedProject.project_type}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[selectedProject.status]}`}>
                        {selectedProject.status.replace('_', ' ')}
                      </span>
                      {selectedProject.customer_billable && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                          Customer Billable
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                      {selectedProject.project_number}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">{selectedProject.project_name}</p>
                  </div>
                  <button
                    onClick={() => setSelectedProject(null)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Lessee:</span>
                    <span className="ml-2 text-gray-900 dark:text-gray-100">{selectedProject.lessee_name || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Due Date:</span>
                    <span className={`ml-2 ${DEADLINE_COLORS[selectedProject.deadline_status]}`}>
                      {formatDate(selectedProject.due_date)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">MC:</span>
                    <span className="ml-2 text-gray-900 dark:text-gray-100">{selectedProject.mc_name || 'Unassigned'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">EC:</span>
                    <span className="ml-2 text-gray-900 dark:text-gray-100">{selectedProject.ec_name || 'Unassigned'}</span>
                  </div>
                </div>

                {/* Scope */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Scope of Work</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded">
                    {selectedProject.scope_of_work}
                  </p>
                </div>

                {selectedProject.special_instructions && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Special Instructions</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded">
                      {selectedProject.special_instructions}
                    </p>
                  </div>
                )}

                {/* Progress */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Progress</h3>
                  <div className="flex gap-4">
                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{selectedProject.total_cars}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Total Cars</div>
                    </div>
                    <div className="flex-1 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{selectedProject.pending_cars}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Pending</div>
                    </div>
                    <div className="flex-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedProject.in_progress_cars}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">In Progress</div>
                    </div>
                    <div className="flex-1 bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">{selectedProject.completed_cars}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Completed</div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {selectedProject.status === 'draft' && (
                    <button
                      onClick={handleActivateProject}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      Activate Project
                    </button>
                  )}
                  {['active', 'in_progress'].includes(selectedProject.status) && (
                    <>
                      <button
                        onClick={() => setShowAddCarsModal(true)}
                        className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm"
                      >
                        + Add Cars
                      </button>
                      <button
                        onClick={handleCompleteProject}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                      >
                        Complete Project
                      </button>
                    </>
                  )}
                </div>

                {/* Cars List */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Cars ({projectCars.length})
                  </h3>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Car #</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Type</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">BRC</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {projectCars.map(car => (
                          <tr key={car.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                              {car.car_number}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                              {car.car_type}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[car.status] || ''}`}>
                                {car.status}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {car.brc_reviewed ? (
                                <span className="text-green-600 dark:text-green-400 text-xs">Reviewed</span>
                              ) : (
                                <span className="text-gray-400 text-xs">Pending</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {!car.brc_reviewed && car.status !== 'completed' && (
                                <button
                                  onClick={() => handleBrcReview(car.car_number)}
                                  className="text-xs text-primary-600 hover:underline"
                                >
                                  BRC Review
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {projectCars.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                              No cars in this project
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Project Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Create New Project</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Name *</label>
                <input
                  type="text"
                  value={newProject.project_name}
                  onChange={e => setNewProject({ ...newProject, project_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  placeholder="e.g., Marathon Q2 Tank Quals"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type *</label>
                  <select
                    value={newProject.project_type}
                    onChange={e => setNewProject({ ...newProject, project_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  >
                    {PROJECT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newProject.due_date}
                    onChange={e => setNewProject({ ...newProject, due_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lessee Name</label>
                <input
                  type="text"
                  value={newProject.lessee_name}
                  onChange={e => setNewProject({ ...newProject, lessee_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  placeholder="e.g., Marathon Petroleum Company LP"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scope of Work *</label>
                <textarea
                  value={newProject.scope_of_work}
                  onChange={e => setNewProject({ ...newProject, scope_of_work: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  placeholder="Describe the work to be performed..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="customerBillable"
                  checked={newProject.customer_billable}
                  onChange={e => setNewProject({ ...newProject, customer_billable: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="customerBillable" className="text-sm text-gray-700 dark:text-gray-300">
                  Customer Billable
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!newProject.project_name || !newProject.scope_of_work}
                  className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                >
                  Create Project
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Cars Modal */}
        {showAddCarsModal && selectedProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddCarsModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Add Cars to Project</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enter car numbers, one per line or comma-separated
              </p>

              <textarea
                value={carNumbersInput}
                onChange={e => setCarNumbersInput(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 font-mono text-sm"
                placeholder="ACFX072050&#10;ACFX072052&#10;ACFX072058"
              />

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowAddCarsModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCars}
                  disabled={!carNumbersInput.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                >
                  Add Cars
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
