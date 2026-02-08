'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  FileUp,
  Lock,
  AlertTriangle,
  Loader2,
  X,
  Check,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type CleaningClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'kosher' | 'hazmat' | 'none';

interface CleaningRequirement {
  id: string;
  commodity_code: string;
  commodity_name: string;
  cleaning_class: CleaningClass;
  requires_interior_blast: boolean;
  requires_exterior_paint: boolean;
  requires_new_lining: boolean;
  requires_kosher_cleaning: boolean;
  special_instructions: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CleaningClassSummary {
  cleaning_class: CleaningClass;
  count: number;
  class_description: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CLEANING_CLASS_OPTIONS: { value: CleaningClass; label: string; description: string }[] = [
  { value: 'A', label: 'Class A', description: 'Food Grade' },
  { value: 'B', label: 'Class B', description: 'Chemical' },
  { value: 'C', label: 'Class C', description: 'Petroleum' },
  { value: 'D', label: 'Class D', description: 'General' },
  { value: 'E', label: 'Class E', description: 'Exempt' },
  { value: 'kosher', label: 'Kosher', description: 'Certified cleaning required' },
  { value: 'hazmat', label: 'Hazmat', description: 'Hazardous materials protocol' },
  { value: 'none', label: 'None', description: 'No cleaning required' },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CommodityCleaningPage() {
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();

  const [commodities, setCommodities] = useState<CleaningRequirement[]>([]);
  const [summary, setSummary] = useState<CleaningClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState<CleaningClass | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedCommodity, setSelectedCommodity] = useState<CleaningRequirement | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    commodity_code: '',
    commodity_name: '',
    cleaning_class: 'D' as CleaningClass,
    requires_interior_blast: false,
    requires_exterior_paint: false,
    requires_new_lining: false,
    requires_kosher_cleaning: false,
    special_instructions: '',
  });

  const getToken = () => localStorage.getItem('railsync_access_token');

  const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
    });
    return response.json();
  };

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [commoditiesData, summaryData] = await Promise.all([
        fetchApi('/commodities'),
        fetchApi('/commodities?summary=true'),
      ]);

      if (commoditiesData.success) {
        setCommodities(commoditiesData.data || []);
      }
      if (summaryData.success) {
        setSummary(summaryData.data || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load commodity cleaning data');
    } finally {
      setLoading(false);
    }
  };

  const filteredCommodities = useMemo(() => {
    return commodities.filter((commodity) => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          commodity.commodity_code.toLowerCase().includes(term) ||
          commodity.commodity_name.toLowerCase().includes(term) ||
          commodity.special_instructions?.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }
      // Cleaning class filter
      if (filterClass && commodity.cleaning_class !== filterClass) return false;
      return true;
    });
  }, [commodities, searchTerm, filterClass]);

  const openCreateModal = () => {
    setFormData({
      commodity_code: '',
      commodity_name: '',
      cleaning_class: 'D',
      requires_interior_blast: false,
      requires_exterior_paint: false,
      requires_new_lining: false,
      requires_kosher_cleaning: false,
      special_instructions: '',
    });
    setSelectedCommodity(null);
    setModalMode('create');
    setShowModal(true);
  };

  const openEditModal = (commodity: CleaningRequirement) => {
    setFormData({
      commodity_code: commodity.commodity_code,
      commodity_name: commodity.commodity_name,
      cleaning_class: commodity.cleaning_class,
      requires_interior_blast: commodity.requires_interior_blast,
      requires_exterior_paint: commodity.requires_exterior_paint,
      requires_new_lining: commodity.requires_new_lining,
      requires_kosher_cleaning: commodity.requires_kosher_cleaning,
      special_instructions: commodity.special_instructions || '',
    });
    setSelectedCommodity(commodity);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = {
        ...formData,
        special_instructions: formData.special_instructions || null,
      };

      const endpoint = modalMode === 'create'
        ? '/commodities'
        : `/commodities/${selectedCommodity?.id}`;
      const result = await fetchApi(endpoint, {
        method: modalMode === 'create' ? 'POST' : 'PUT',
        body: JSON.stringify(payload),
      });

      if (result.success) {
        toast.success(
          `Commodity cleaning requirement ${modalMode === 'create' ? 'created' : 'updated'} successfully`
        );
        setShowModal(false);
        loadData();
      } else {
        toast.error(result.error || 'Operation failed');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      toast.error('An error occurred');
    }
  };

  const handleDelete = async (commodityCode: string) => {
    if (!confirm(`Are you sure you want to delete commodity "${commodityCode}"?`)) {
      return;
    }

    try {
      const result = await fetchApi(`/commodities/${commodityCode}`, {
        method: 'DELETE',
      });

      if (result.success) {
        toast.success('Commodity cleaning requirement deleted successfully');
        loadData();
      } else {
        toast.error(result.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('An error occurred');
    }
  };

  const getClassBadgeColor = (cleaningClass: CleaningClass) => {
    switch (cleaningClass) {
      case 'A':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'B':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'C':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'D':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'E':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'kosher':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'hazmat':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const csvInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter((l) => l.trim());
      if (lines.length < 2) {
        toast.error('CSV must have a header row and at least one data row');
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
      const codeIdx = headers.findIndex((h) => h.includes('code'));
      const nameIdx = headers.findIndex((h) => h.includes('name') && !h.includes('class'));
      const classIdx = headers.findIndex((h) => h.includes('class'));

      if (codeIdx === -1 || nameIdx === -1) {
        toast.error('CSV must have "commodity_code" and "commodity_name" columns');
        return;
      }

      let imported = 0;
      let skipped = 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
        const code = cols[codeIdx];
        const name = cols[nameIdx];
        if (!code || !name) { skipped++; continue; }

        const payload = {
          commodity_code: code,
          commodity_name: name,
          cleaning_class: classIdx !== -1 && cols[classIdx] ? cols[classIdx] : 'D',
          requires_interior_blast: false,
          requires_exterior_paint: false,
          requires_new_lining: false,
          requires_kosher_cleaning: false,
          special_instructions: null,
        };

        try {
          const result = await fetchApi('/commodities', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          if (result.success) imported++;
          else skipped++;
        } catch {
          skipped++;
        }
      }

      toast.success(`Imported ${imported} commodities${skipped > 0 ? `, ${skipped} skipped` : ''}`);
      loadData();
    } catch {
      toast.error('Failed to parse CSV file');
    } finally {
      setImporting(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md mx-auto">
          <Lock className="w-12 h-12 mx-auto text-red-500 mb-4" aria-hidden="true" />
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Access Denied</h3>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            Admin privileges required to manage commodity cleaning requirements.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Commodity Cleaning Matrix
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage cleaning requirements for different commodity types
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCsvImport}
          />
          <button
            onClick={() => csvInputRef.current?.click()}
            disabled={importing}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" aria-hidden="true" />}
            {importing ? 'Importing...' : 'Import CSV'}
          </button>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add Commodity
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {summary.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {summary.map((item) => (
            <div
              key={item.cleaning_class}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3"
            >
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Class {item.cleaning_class.toUpperCase()}
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {item.count}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                {item.class_description.split('—')[1]?.trim() || item.class_description}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[250px]">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Search
            </label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by code, name, or instructions..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Cleaning Class
            </label>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value as CleaningClass | '')}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">All Classes</option>
              {CLEANING_CLASS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.description}
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {filteredCommodities.length} of {commodities.length} commodities
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin h-8 w-8 text-primary-600" aria-hidden="true" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Commodity Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Class
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Requirements
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Special Instructions
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredCommodities.map((commodity) => (
                  <tr
                    key={commodity.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                        {commodity.commodity_code}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {commodity.commodity_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getClassBadgeColor(
                          commodity.cleaning_class
                        )}`}
                      >
                        {commodity.cleaning_class.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {commodity.requires_interior_blast && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            Blast
                          </span>
                        )}
                        {commodity.requires_exterior_paint && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                            Paint
                          </span>
                        )}
                        {commodity.requires_new_lining && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                            Lining
                          </span>
                        )}
                        {commodity.requires_kosher_cleaning && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                            Kosher
                          </span>
                        )}
                        {!commodity.requires_interior_blast &&
                          !commodity.requires_exterior_paint &&
                          !commodity.requires_new_lining &&
                          !commodity.requires_kosher_cleaning && (
                            <span className="text-xs text-gray-400">None</span>
                          )}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {commodity.special_instructions || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => openEditModal(commodity)}
                        className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 text-sm inline-flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" aria-hidden="true" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(commodity.commodity_code)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" aria-hidden="true" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCommodities.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      {searchTerm || filterClass
                        ? 'No commodities match your filters'
                        : 'No commodity cleaning requirements found. Click "Add Commodity" to create one.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {modalMode === 'create'
                  ? 'Create Commodity Cleaning Requirement'
                  : 'Edit Commodity Cleaning Requirement'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Commodity Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.commodity_code}
                    onChange={(e) =>
                      setFormData({ ...formData, commodity_code: e.target.value })
                    }
                    disabled={modalMode === 'edit'}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="e.g., CORN, WHEAT, LPG"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cleaning Class *
                  </label>
                  <select
                    value={formData.cleaning_class}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        cleaning_class: e.target.value as CleaningClass,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    {CLEANING_CLASS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} — {opt.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Commodity Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.commodity_name}
                  onChange={(e) =>
                    setFormData({ ...formData, commodity_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="e.g., Corn, Wheat, Liquefied Petroleum Gas"
                />
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Requirements
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.requires_interior_blast}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          requires_interior_blast: e.target.checked,
                        })
                      }
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Requires Interior Blast
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.requires_exterior_paint}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          requires_exterior_paint: e.target.checked,
                        })
                      }
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Requires Exterior Paint
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.requires_new_lining}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          requires_new_lining: e.target.checked,
                        })
                      }
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Requires New Lining
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.requires_kosher_cleaning}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          requires_kosher_cleaning: e.target.checked,
                        })
                      }
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Requires Kosher Cleaning
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Special Instructions
                </label>
                <textarea
                  value={formData.special_instructions}
                  onChange={(e) =>
                    setFormData({ ...formData, special_instructions: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Any specific cleaning protocols or notes..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                >
                  <Check className="w-4 h-4" aria-hidden="true" />
                  {modalMode === 'create' ? 'Create Requirement' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
