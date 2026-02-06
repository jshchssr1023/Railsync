'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import ProjectPlanView from '@/components/ProjectPlanView';
import LockConfirmationModal from '@/components/LockConfirmationModal';
import RelockDialog from '@/components/RelockDialog';
import CreateDemandDialog, { type CreateDemandFormData } from '@/components/CreateDemandDialog';
import CommunicationLog from '@/components/CommunicationLog';
import PlanHistoryTimeline from '@/components/PlanHistoryTimeline';
import { unlockProjectAssignment } from '@/lib/api';
import type {
  ProjectAssignment,
  ProjectPlanSummary,
  ProjectCommunication,
  ProjectPlanAuditEvent,
  CommunicationType,
  CommunicationMethod,
} from '@/types';

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
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
      </div>
    }>
      <ProjectsContent />
    </Suspense>
  );
}

function ProjectsContent() {
  const { getAccessToken } = useAuth();
  const toast = useToast();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectCars, setProjectCars] = useState<ProjectCar[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddCarsModal, setShowAddCarsModal] = useState(false);

  // Detail panel tab
  type DetailTab = 'cars' | 'plan' | 'communications' | 'history';
  const [activeTab, setActiveTab] = useState<DetailTab>('cars');

  // Plan tab state
  const [planSummary, setPlanSummary] = useState<ProjectPlanSummary | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [lockModalOpen, setLockModalOpen] = useState(false);
  const [lockTargetIds, setLockTargetIds] = useState<string[]>([]);
  const [lockLoading, setLockLoading] = useState(false);
  const [relockDialogOpen, setRelockDialogOpen] = useState(false);
  const [relockTarget, setRelockTarget] = useState<ProjectAssignment | null>(null);
  const [relockLoading, setRelockLoading] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ProjectAssignment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [unlockTarget, setUnlockTarget] = useState<any>(null);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  // Communications tab state
  const [communications, setCommunications] = useState<ProjectCommunication[]>([]);
  const [commsLoading, setCommsLoading] = useState(false);

  // History tab state
  const [auditEvents, setAuditEvents] = useState<ProjectPlanAuditEvent[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyCarFilter, setHistoryCarFilter] = useState('');

  // Plan Cars modal state
  const [showPlanCarsModal, setShowPlanCarsModal] = useState(false);
  const [planCarsForm, setPlanCarsForm] = useState<{ car_ids: string[]; shop_code: string; target_month: string; estimated_cost: string }>({
    car_ids: [],
    shop_code: '',
    target_month: '',
    estimated_cost: '',
  });
  const [shops, setShops] = useState<{ shop_code: string; shop_name: string }[]>([]);

  // Create Demand dialog state
  const [showCreateDemandDialog, setShowCreateDemandDialog] = useState(false);
  const [createDemandLoading, setCreateDemandLoading] = useState(false);

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

  // Handle URL params (from "Plan to Project" link on Planning page)
  useEffect(() => {
    const projectParam = searchParams.get('project');
    const tabParam = searchParams.get('tab');
    if (projectParam && projects.length > 0 && !selectedProject) {
      const match = projects.find(p => p.id === projectParam);
      if (match) {
        fetchProjectDetails(match.id);
        if (tabParam === 'plan' || tabParam === 'communications' || tabParam === 'history') {
          setActiveTab(tabParam as DetailTab);
        }
      }
    }
  }, [searchParams, projects, selectedProject]);

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
        toast.success('Cars added', `${carNumbers.length} car(s) added to project`);
        setShowAddCarsModal(false);
        setCarNumbersInput('');
        fetchProjectDetails(selectedProject.id);
      }
    } catch (err) {
      toast.error('Failed to add cars');
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
        toast.success('Project activated', `${selectedProject.project_number} is now active`);
        fetchProjectDetails(selectedProject.id);
        fetchProjects();
      }
    } catch (err) {
      toast.error('Failed to activate project');
    }
  };

  const handleCompleteProject = async () => {
    if (!selectedProject) return;
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
        toast.success('Project completed', `${selectedProject.project_number} marked as complete`);
        fetchProjectDetails(selectedProject.id);
        fetchProjects();
      }
    } catch (err) {
      toast.error('Failed to complete project');
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

  // Plan data fetching
  const fetchPlanSummary = useCallback(async (projectId: string) => {
    setPlanLoading(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_URL}/projects/${projectId}/plan`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) setPlanSummary(data.data);
    } catch (err) {
      console.error('Failed to fetch plan:', err);
    } finally {
      setPlanLoading(false);
    }
  }, [getAccessToken]);

  const fetchCommunications = useCallback(async (projectId: string) => {
    setCommsLoading(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_URL}/projects/${projectId}/communications`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) setCommunications(data.data || []);
    } catch (err) {
      console.error('Failed to fetch communications:', err);
    } finally {
      setCommsLoading(false);
    }
  }, [getAccessToken]);

  const fetchAuditHistory = useCallback(async (projectId: string, carNumber?: string) => {
    setHistoryLoading(true);
    try {
      const token = getAccessToken();
      const params = new URLSearchParams();
      if (carNumber) params.append('car_number', carNumber);
      const res = await fetch(`${API_URL}/projects/${projectId}/plan-history?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        setAuditEvents(data.data.events || []);
        setAuditTotal(data.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [getAccessToken]);

  const fetchShops = useCallback(async () => {
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_URL}/shops?active=true`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) setShops(data.data || []);
    } catch {
      // Non-critical
    }
  }, [getAccessToken]);

  // Load tab data when tab changes
  useEffect(() => {
    if (!selectedProject) return;
    if (activeTab === 'plan') fetchPlanSummary(selectedProject.id);
    else if (activeTab === 'communications') fetchCommunications(selectedProject.id);
    else if (activeTab === 'history') fetchAuditHistory(selectedProject.id, historyCarFilter || undefined);
  }, [activeTab, selectedProject, fetchPlanSummary, fetchCommunications, fetchAuditHistory, historyCarFilter]);

  // Plan Cars handler
  const handlePlanCars = async () => {
    if (!selectedProject) return;
    const unplannedCars = projectCars.filter(c => c.status === 'pending');
    const carsToUse = planCarsForm.car_ids.length > 0
      ? unplannedCars.filter(c => planCarsForm.car_ids.includes(c.id))
      : unplannedCars;

    if (carsToUse.length === 0 || !planCarsForm.shop_code || !planCarsForm.target_month) return;

    try {
      const token = getAccessToken();
      const res = await fetch(`${API_URL}/projects/${selectedProject.id}/plan-cars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          cars: carsToUse.map(c => ({
            project_car_id: c.id,
            car_number: c.car_number,
            shop_code: planCarsForm.shop_code,
            target_month: planCarsForm.target_month,
            estimated_cost: planCarsForm.estimated_cost ? parseFloat(planCarsForm.estimated_cost) : undefined,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowPlanCarsModal(false);
        setPlanCarsForm({ car_ids: [], shop_code: '', target_month: '', estimated_cost: '' });
        fetchPlanSummary(selectedProject.id);
      }
    } catch (err) {
      console.error('Failed to plan cars:', err);
    }
  };

  // Lock handler
  const handleLockSelected = (ids: string[]) => {
    setLockTargetIds(ids);
    setLockModalOpen(true);
  };

  const handleLockConfirm = async (confirmedIds: string[]) => {
    if (!selectedProject) return;
    setLockLoading(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_URL}/projects/${selectedProject.id}/lock-cars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assignment_ids: confirmedIds }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Cars locked', `${confirmedIds.length} assignment(s) locked to SSOT`);
        setLockModalOpen(false);
        setLockTargetIds([]);
        fetchPlanSummary(selectedProject.id);
      }
    } catch (err) {
      toast.error('Failed to lock assignments');
    } finally {
      setLockLoading(false);
    }
  };

  // Relock handler
  const handleRelockConfirm = async (data: { new_shop_code: string; new_target_month: string; new_target_date?: string; new_estimated_cost?: number; reason: string }) => {
    if (!selectedProject || !relockTarget) return;
    setRelockLoading(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_URL}/projects/${selectedProject.id}/relock-car`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ project_assignment_id: relockTarget.id, ...data }),
      });
      const resData = await res.json();
      if (resData.success) {
        toast.success('Assignment relocked', `${relockTarget.car_number} updated and relocked`);
        setRelockDialogOpen(false);
        setRelockTarget(null);
        fetchPlanSummary(selectedProject.id);
      }
    } catch (err) {
      toast.error('Failed to relock assignment');
    } finally {
      setRelockLoading(false);
    }
  };

  // Cancel handler
  const handleCancelConfirm = async () => {
    if (!selectedProject || !cancelTarget || !cancelReason.trim()) return;
    setCancelLoading(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_URL}/projects/${selectedProject.id}/cancel-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ project_assignment_id: cancelTarget.id, reason: cancelReason }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Plan cancelled', `${cancelTarget.car_number} plan cancelled`);
        setCancelDialogOpen(false);
        setCancelTarget(null);
        setCancelReason('');
        fetchPlanSummary(selectedProject.id);
      }
    } catch (err) {
      toast.error('Failed to cancel plan');
    } finally {
      setCancelLoading(false);
    }
  };

  // Unlock handler
  const handleUnlockConfirm = async () => {
    if (!selectedProject || !unlockTarget) return;
    setUnlockLoading(true);
    try {
      await unlockProjectAssignment(selectedProject.id, unlockTarget.id);
      toast.success('Assignment unlocked', `${unlockTarget.car_number} reverted to Planned`);
      setUnlockTarget(null);
      fetchPlanSummary(selectedProject.id);
    } catch (err) {
      toast.error('Failed to unlock assignment', err instanceof Error ? err.message : undefined);
    } finally {
      setUnlockLoading(false);
    }
  };

  // Create Demand handler
  const handleCreateDemand = async (formData: CreateDemandFormData) => {
    if (!selectedProject) return;
    setCreateDemandLoading(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_URL}/projects/${selectedProject.id}/create-demand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success || data.data) {
        setShowCreateDemandDialog(false);
        fetchPlanSummary(selectedProject.id);
      }
    } catch (err) {
      console.error('Failed to create demand:', err);
    } finally {
      setCreateDemandLoading(false);
    }
  };

  // Communication handler
  const handleLogCommunication = async (data: {
    communication_type: CommunicationType;
    communicated_to?: string;
    communication_method?: CommunicationMethod;
    subject?: string;
    notes?: string;
  }) => {
    if (!selectedProject) return;
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_URL}/projects/${selectedProject.id}/communications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (resData.success) {
        fetchCommunications(selectedProject.id);
      }
    } catch (err) {
      console.error('Failed to log communication:', err);
    }
  };

  // Lock modal assignments (filtered from plan)
  const lockModalAssignments = useMemo(() => {
    if (!planSummary) return [];
    return planSummary.assignments.filter(a => lockTargetIds.includes(a.id) && a.plan_state === 'Planned');
  }, [planSummary, lockTargetIds]);

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
                        onClick={() => setShowCompleteConfirm(true)}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                      >
                        Complete Project
                      </button>
                    </>
                  )}
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200 dark:border-gray-700">
                  <nav className="-mb-px flex gap-4">
                    {([
                      { key: 'cars' as DetailTab, label: `Cars (${projectCars.length})` },
                      { key: 'plan' as DetailTab, label: 'Plan' },
                      { key: 'communications' as DetailTab, label: 'Communications' },
                      { key: 'history' as DetailTab, label: 'History' },
                    ]).map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`py-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === tab.key
                            ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Tab Content: Cars */}
                {activeTab === 'cars' && (
                  <div>
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
                )}

                {/* Tab Content: Plan */}
                {activeTab === 'plan' && (
                  <ProjectPlanView
                    plan={planSummary}
                    loading={planLoading}
                    onLockSelected={handleLockSelected}
                    onRelock={(a) => { setRelockTarget(a); setRelockDialogOpen(true); }}
                    onCancel={(a) => { setCancelTarget(a); setCancelDialogOpen(true); }}
                    onUnlock={(a) => setUnlockTarget(a)}
                    onPlanCars={() => { fetchShops(); setShowPlanCarsModal(true); }}
                    onCreateDemand={() => setShowCreateDemandDialog(true)}
                    isActive={['active', 'in_progress'].includes(selectedProject.status)}
                  />
                )}

                {/* Tab Content: Communications */}
                {activeTab === 'communications' && (
                  <CommunicationLog
                    communications={communications}
                    loading={commsLoading}
                    onLog={handleLogCommunication}
                    isActive={['active', 'in_progress'].includes(selectedProject.status)}
                  />
                )}

                {/* Tab Content: History */}
                {activeTab === 'history' && (
                  <PlanHistoryTimeline
                    events={auditEvents}
                    total={auditTotal}
                    loading={historyLoading}
                    carFilter={historyCarFilter}
                    onCarFilterChange={setHistoryCarFilter}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Complete Project Confirmation */}
        <ConfirmDialog
          open={showCompleteConfirm}
          title="Complete Project"
          description="All pending cars will be marked as completed."
          confirmLabel="Complete Project"
          variant="warning"
          irreversibleWarning
          summaryItems={selectedProject ? [
            { label: 'Project', value: selectedProject.project_number },
            { label: 'Pending Cars', value: selectedProject.pending_cars },
            { label: 'In Progress', value: selectedProject.in_progress_cars },
          ] : []}
          onConfirm={() => {
            setShowCompleteConfirm(false);
            handleCompleteProject();
          }}
          onCancel={() => setShowCompleteConfirm(false)}
        />

        {/* Unlock Plan Confirmation */}
        <ConfirmDialog
          open={!!unlockTarget}
          title="Unlock Plan"
          description="This will revert the assignment from Locked back to Planned and cancel the associated car assignment."
          variant="warning"
          confirmLabel="Unlock"
          loading={unlockLoading}
          summaryItems={unlockTarget ? [
            { label: 'Car', value: unlockTarget.car_number || '' },
            { label: 'Shop', value: unlockTarget.shop_code || '' },
            { label: 'Month', value: unlockTarget.target_month || '' },
          ] : []}
          onConfirm={handleUnlockConfirm}
          onCancel={() => setUnlockTarget(null)}
        />

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
        {/* Lock Confirmation Modal */}
        <LockConfirmationModal
          open={lockModalOpen}
          onConfirm={handleLockConfirm}
          onCancel={() => { setLockModalOpen(false); setLockTargetIds([]); }}
          assignments={lockModalAssignments}
          loading={lockLoading}
        />

        {/* Relock Dialog */}
        <RelockDialog
          open={relockDialogOpen}
          onConfirm={handleRelockConfirm}
          onCancel={() => { setRelockDialogOpen(false); setRelockTarget(null); }}
          assignment={relockTarget}
          loading={relockLoading}
          getAccessToken={getAccessToken}
        />

        {/* Create Demand Dialog */}
        <CreateDemandDialog
          open={showCreateDemandDialog}
          onConfirm={handleCreateDemand}
          onCancel={() => setShowCreateDemandDialog(false)}
          project={selectedProject ? {
            project_number: selectedProject.project_number,
            project_name: selectedProject.project_name,
            project_type: selectedProject.project_type,
            lessee_code: selectedProject.lessee_code,
            lessee_name: selectedProject.lessee_name,
            total_cars: parseInt(selectedProject.total_cars, 10) || 0,
            unplanned_cars: planSummary?.unplanned_cars ?? (parseInt(selectedProject.pending_cars, 10) || 0),
          } : null}
          loading={createDemandLoading}
        />

        {/* Cancel Plan Dialog */}
        {cancelDialogOpen && cancelTarget && (
          <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
            <div className="fixed inset-0 bg-black/50" onClick={() => { setCancelDialogOpen(false); setCancelTarget(null); setCancelReason(''); }} />
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cancel Plan</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Cancel plan for {cancelTarget.car_number}?
                  {cancelTarget.plan_state === 'Locked' && ' This will also cancel the SSOT assignment.'}
                </p>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Car</span><span className="font-medium text-gray-900 dark:text-gray-100">{cancelTarget.car_number}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Shop</span><span className="font-medium text-gray-900 dark:text-gray-100">{cancelTarget.shop_name || cancelTarget.shop_code}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Month</span><span className="font-medium text-gray-900 dark:text-gray-100">{cancelTarget.target_month}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">State</span><span className="font-medium text-gray-900 dark:text-gray-100">{cancelTarget.plan_state}</span></div>
                </div>
                <div className="px-3 py-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                  <span>This action cannot be undone.</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason *</label>
                  <textarea
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                    placeholder="Why is this plan being cancelled?"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => { setCancelDialogOpen(false); setCancelTarget(null); setCancelReason(''); }}
                    disabled={cancelLoading}
                    className="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Keep Plan
                  </button>
                  <button
                    onClick={handleCancelConfirm}
                    disabled={cancelLoading || !cancelReason.trim()}
                    className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                  >
                    {cancelLoading ? 'Cancelling...' : 'Cancel Plan'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Plan Cars Modal */}
        {showPlanCarsModal && selectedProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowPlanCarsModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Plan Cars to Shop</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Select unplanned cars and assign them to a shop/month.
              </p>

              {/* Car selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cars (select from unplanned)
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded p-2 space-y-1">
                  {projectCars.filter(c => c.status === 'pending').map(car => (
                    <label key={car.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={planCarsForm.car_ids.includes(car.id)}
                        onChange={e => {
                          const ids = e.target.checked
                            ? [...planCarsForm.car_ids, car.id]
                            : planCarsForm.car_ids.filter(id => id !== car.id);
                          setPlanCarsForm({ ...planCarsForm, car_ids: ids });
                        }}
                        className="rounded"
                      />
                      <span className="font-mono text-gray-900 dark:text-gray-100">{car.car_number}</span>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">{car.car_type}</span>
                    </label>
                  ))}
                  {projectCars.filter(c => c.status === 'pending').length === 0 && (
                    <p className="text-xs text-gray-400 py-2">No unplanned cars available</p>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {planCarsForm.car_ids.length > 0
                    ? `${planCarsForm.car_ids.length} selected`
                    : 'All unplanned cars will be planned'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shop *</label>
                <select
                  value={planCarsForm.shop_code}
                  onChange={e => setPlanCarsForm({ ...planCarsForm, shop_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                >
                  <option value="">Select shop...</option>
                  {shops.map(s => (
                    <option key={s.shop_code} value={s.shop_code}>{s.shop_code} - {s.shop_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Month *</label>
                  <input
                    type="month"
                    value={planCarsForm.target_month}
                    onChange={e => setPlanCarsForm({ ...planCarsForm, target_month: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Est. Cost/Car</label>
                  <input
                    type="number"
                    value={planCarsForm.estimated_cost}
                    onChange={e => setPlanCarsForm({ ...planCarsForm, estimated_cost: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowPlanCarsModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePlanCars}
                  disabled={!planCarsForm.shop_code || !planCarsForm.target_month}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  Plan Cars
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
