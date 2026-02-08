'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  getCCMHierarchyTree,
  listCCMInstructions,
  getCCMInstruction,
  getCCMInstructionByScope,
  getParentCCM,
  createCCMInstruction,
  updateCCMInstruction,
} from '@/lib/api';
import {
  CCMHierarchyNode,
  CCMInstruction,
  CCMInstructionScope,
  CCMInstructionFields,
  CCMScopeLevel,
} from '@/types';
import { HierarchyTreePicker, InheritanceChainDisplay, CCMInstructionEditor } from '@/components/ccm';
import { FileText, Pencil, ChevronRight, ClipboardList, List } from 'lucide-react';

// ---------------------------------------------------------------------------
// Scope Level Labels and Colors
// ---------------------------------------------------------------------------
const SCOPE_LEVEL_LABELS: Record<CCMScopeLevel, string> = {
  customer: 'Customer',
  master_lease: 'Master Lease',
  rider: 'Rider',
  amendment: 'Amendment',
};

const SCOPE_LEVEL_COLORS: Record<CCMScopeLevel, string> = {
  customer: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  master_lease: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  rider: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  amendment: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
};

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------
export default function CCMPage() {
  return (
    <Suspense fallback={<div className="container mx-auto p-6">Loading...</div>}>
      <CCMContent />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Inner Content Component
// ---------------------------------------------------------------------------
function CCMContent() {
  const searchParams = useSearchParams();

  // --- Tab state ---
  const [activeTab, setActiveTab] = useState<'browse' | 'edit'>('browse');

  // --- Browse tab state ---
  const [hierarchyTree, setHierarchyTree] = useState<CCMHierarchyNode[]>([]);
  const [instructions, setInstructions] = useState<CCMInstruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // --- Edit tab state ---
  const [selectedScope, setSelectedScope] = useState<CCMInstructionScope | null>(null);
  const [editingInstruction, setEditingInstruction] = useState<CCMInstruction | null>(null);
  const [parentCCM, setParentCCM] = useState<CCMInstructionFields | null>(null);
  const [formData, setFormData] = useState<Partial<CCMInstructionFields>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // --- Expanded instruction detail ---
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<CCMInstruction | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // -------------------------------------------------------------------------
  // Load hierarchy tree and instructions
  // -------------------------------------------------------------------------
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tree, list] = await Promise.all([
        getCCMHierarchyTree(),
        listCCMInstructions(),
      ]);
      setHierarchyTree(tree);
      setInstructions(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CCM data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // -------------------------------------------------------------------------
  // Handle scope selection in edit mode
  // -------------------------------------------------------------------------
  const handleScopeSelect = useCallback(async (scope: CCMInstructionScope | null) => {
    setSelectedScope(scope);
    setEditingInstruction(null);
    setParentCCM(null);
    setFormData({});
    setSaveError(null);
    setSaveSuccess(false);

    if (!scope) return;

    try {
      // Check if there's an existing CCM at this scope
      const existing = await getCCMInstructionByScope(scope.type, scope.id);
      setEditingInstruction(existing);

      // Get parent CCM for inheritance preview
      if (scope.type !== 'customer') {
        const parent = await getParentCCM(scope.type, scope.id);
        setParentCCM(parent);
      }
    } catch (err) {
      console.error('Error loading scope data:', err);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Handle form changes
  // -------------------------------------------------------------------------
  const handleFormChange = useCallback((data: Partial<CCMInstructionFields>) => {
    setFormData(data);
    setSaveSuccess(false);
  }, []);

  // -------------------------------------------------------------------------
  // Save CCM instruction
  // -------------------------------------------------------------------------
  const handleSave = useCallback(async () => {
    if (!selectedScope) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      if (editingInstruction) {
        // Update existing
        await updateCCMInstruction(editingInstruction.id, formData);
      } else {
        // Create new
        await createCCMInstruction(selectedScope, formData);
      }
      setSaveSuccess(true);
      loadData(); // Refresh list
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save CCM instruction');
    } finally {
      setSaving(false);
    }
  }, [selectedScope, editingInstruction, formData, loadData]);

  // -------------------------------------------------------------------------
  // Cancel editing
  // -------------------------------------------------------------------------
  const handleCancel = useCallback(() => {
    setSelectedScope(null);
    setEditingInstruction(null);
    setParentCCM(null);
    setFormData({});
    setSaveError(null);
    setSaveSuccess(false);
  }, []);

  // -------------------------------------------------------------------------
  // Expand instruction detail
  // -------------------------------------------------------------------------
  const handleToggleExpand = useCallback(async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }

    setExpandedId(id);
    setDetailLoading(true);
    try {
      const detail = await getCCMInstruction(id);
      setExpandedDetail(detail);
    } catch (err) {
      console.error('Error loading instruction detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }, [expandedId]);

  // -------------------------------------------------------------------------
  // Edit from browse
  // -------------------------------------------------------------------------
  const handleEditFromBrowse = useCallback((instruction: CCMInstruction) => {
    const scope: CCMInstructionScope = {
      type: instruction.scope_level,
      id: instruction.customer_id || instruction.master_lease_id || instruction.rider_id || instruction.amendment_id || '',
    };
    setSelectedScope(scope);
    setEditingInstruction(instruction);
    setActiveTab('edit');
  }, []);

  // -------------------------------------------------------------------------
  // Format date
  // -------------------------------------------------------------------------
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // -------------------------------------------------------------------------
  // Render Browse Tab
  // -------------------------------------------------------------------------
  const renderBrowseTab = () => (
    <div className="space-y-6">
      {/* Search */}
      <div className="card p-4">
        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
          Search
        </label>
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Search by customer, lease, or rider name..."
          className="input w-full"
        />
      </div>

      {/* Instructions List */}
      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
      ) : error ? (
        <div className="card p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <p className="text-red-700 dark:text-red-400">{error}</p>
            <button onClick={loadData} className="btn-secondary text-sm">
              Retry
            </button>
          </div>
        </div>
      ) : instructions.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" strokeWidth={1.5} aria-hidden="true" />
          <p>No CCM instructions found</p>
          <p className="text-sm mt-1">Switch to the Create/Edit tab to add CCM instructions</p>
        </div>
      ) : (
        <div className="space-y-3">
          {instructions
            .filter(i =>
              !searchFilter ||
              i.scope_name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
              i.customer_name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
              i.lease_name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
              i.rider_name?.toLowerCase().includes(searchFilter.toLowerCase())
            )
            .map(instruction => (
              <div key={instruction.id}>
                {/* List Card */}
                <div
                  onClick={() => handleToggleExpand(instruction.id)}
                  className="card p-4 hover:shadow-md transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SCOPE_LEVEL_COLORS[instruction.scope_level]}`}>
                          {SCOPE_LEVEL_LABELS[instruction.scope_level]}
                        </span>
                        <span className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                          {instruction.scope_name || instruction.customer_name || 'Unnamed'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        {instruction.customer_name && instruction.scope_level !== 'customer' && (
                          <span>Customer: {instruction.customer_name}</span>
                        )}
                        {instruction.lease_name && instruction.scope_level !== 'master_lease' && (
                          <span>Lease: {instruction.lease_name}</span>
                        )}
                        <span>Updated: {formatDate(instruction.updated_at)}</span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        {instruction.sealing_count !== undefined && instruction.sealing_count > 0 && (
                          <span className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded">
                            {instruction.sealing_count} sealing
                          </span>
                        )}
                        {instruction.lining_count !== undefined && instruction.lining_count > 0 && (
                          <span className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">
                            {instruction.lining_count} lining
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditFromBrowse(instruction);
                        }}
                        className="p-2 text-gray-500 hover:text-primary-600 dark:hover:text-primary-400"
                        title="Edit"
                      >
                        <Pencil className="w-5 h-5" aria-hidden="true" />
                      </button>
                      <ChevronRight
                        className={`w-5 h-5 text-gray-400 transition-transform ${expandedId === instruction.id ? 'rotate-90' : ''}`}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded Detail */}
                {expandedId === instruction.id && (
                  <div className="mt-1 card p-4">
                    {detailLoading ? (
                      <div className="animate-pulse space-y-3">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                      </div>
                    ) : expandedDetail ? (
                      <div className="space-y-4">
                        {/* Quick Summary */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Food Grade</span>
                            <p className="font-medium">{expandedDetail.food_grade ? 'Yes' : 'No'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Kosher Wash</span>
                            <p className="font-medium">{expandedDetail.kosher_wash ? 'Yes' : 'No'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Nitrogen</span>
                            <p className="font-medium">
                              {expandedDetail.nitrogen_applied ? `Yes (${expandedDetail.nitrogen_psi || 'N/A'})` : 'No'}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Primary Contact</span>
                            <p className="font-medium truncate">{expandedDetail.primary_contact_name || '--'}</p>
                          </div>
                        </div>

                        {/* Sealing Sections */}
                        {expandedDetail.sealing_sections && expandedDetail.sealing_sections.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sealing Commodities</h4>
                            <div className="flex flex-wrap gap-2">
                              {expandedDetail.sealing_sections.map(s => (
                                <span key={s.id} className="text-xs px-2 py-1 rounded bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400">
                                  {s.commodity}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Lining Sections */}
                        {expandedDetail.lining_sections && expandedDetail.lining_sections.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Lining Commodities</h4>
                            <div className="flex flex-wrap gap-2">
                              {expandedDetail.lining_sections.map(l => (
                                <span key={l.id} className="text-xs px-2 py-1 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                                  {l.commodity} {l.lining_required ? '(Required)' : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {expandedDetail.additional_notes && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                              {expandedDetail.additional_notes}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">Failed to load details</p>
                    )}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );

  // -------------------------------------------------------------------------
  // Render Edit Tab
  // -------------------------------------------------------------------------
  const renderEditTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Hierarchy Picker */}
      <div className="lg:col-span-1">
        <div className="card p-4 sticky top-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Select Scope
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Choose where to define CCM instructions. Child levels inherit from parents.
          </p>

          {/* Search within tree */}
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search..."
            className="input w-full mb-4"
          />

          {/* Tree Picker */}
          <div className="max-h-[500px] overflow-y-auto">
            <HierarchyTreePicker
              nodes={hierarchyTree}
              value={selectedScope}
              onChange={handleScopeSelect}
              loading={loading}
              searchFilter={searchFilter}
            />
          </div>
        </div>
      </div>

      {/* Right: Editor */}
      <div className="lg:col-span-2">
        {!selectedScope ? (
          <div className="card p-8 text-center text-gray-500 dark:text-gray-400">
            <ClipboardList className="w-16 h-16 mx-auto mb-4 text-gray-300" strokeWidth={1.5} aria-hidden="true" />
            <p className="text-lg font-medium mb-2">Select a scope to begin</p>
            <p className="text-sm">Choose a customer, lease, rider, or amendment from the hierarchy tree</p>
          </div>
        ) : (
          <div className="card p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SCOPE_LEVEL_COLORS[selectedScope.type]}`}>
                  {SCOPE_LEVEL_LABELS[selectedScope.type]}
                </span>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mt-1">
                  {editingInstruction
                    ? `Edit CCM: ${editingInstruction.scope_name || 'Unnamed'}`
                    : 'Create New CCM Instructions'}
                </h3>
              </div>
              {editingInstruction && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Version {editingInstruction.version}
                </span>
              )}
            </div>

            {/* Parent inheritance info */}
            {parentCCM && selectedScope.type !== 'customer' && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Inheriting from parent
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Fields left empty will inherit values from the parent level. Override specific fields as needed.
                </p>
              </div>
            )}

            {/* Success/Error Messages */}
            {saveSuccess && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <p className="text-green-700 dark:text-green-400 text-sm">CCM instructions saved successfully!</p>
              </div>
            )}
            {saveError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-red-700 dark:text-red-400 text-sm">{saveError}</p>
              </div>
            )}

            {/* Editor */}
            <CCMInstructionEditor
              instruction={editingInstruction}
              parentCCM={parentCCM}
              onChange={handleFormChange}
              onSave={handleSave}
              onCancel={handleCancel}
              saving={saving}
              isNew={!editingInstruction}
            />
          </div>
        )}
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // Main Render
  // -------------------------------------------------------------------------
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Customer Care Manuals
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage CCM instructions at customer, lease, rider, or amendment level
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('browse')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'browse'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <List className="w-5 h-5" aria-hidden="true" />
              Browse
            </span>
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'edit'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <Pencil className="w-5 h-5" aria-hidden="true" />
              Create / Edit
            </span>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'browse' ? renderBrowseTab() : renderEditTab()}
    </div>
  );
}
