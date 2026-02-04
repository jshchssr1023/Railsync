'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { listCCMForms, getCCMForm, getCCMFormSOWSections } from '@/lib/api';
import { CCMForm, CCMFormSOWSection } from '@/types';

// ---------------------------------------------------------------------------
// Extended types for the full CCM form detail returned by getCCMForm
// ---------------------------------------------------------------------------
interface CCMFormSealing {
  id: string;
  ccm_form_id: string;
  commodity: string;
  gasket_sealing_material: string | null;
  alternate_material: string | null;
  preferred_gasket_vendor: string | null;
  alternate_vendor: string | null;
  vsp_ride_tight: boolean;
  sealing_requirements: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface CCMFormLining {
  id: string;
  ccm_form_id: string;
  commodity: string;
  lining_required: boolean;
  lining_inspection_interval: string | null;
  lining_type: string | null;
  lining_plan_on_file: boolean;
  lining_requirements: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface CCMFormAttachment {
  id: string;
  ccm_form_id: string;
  file_name: string;
  file_path: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  mfiles_id: string | null;
  mfiles_url: string | null;
  uploaded_by_id: string | null;
  created_at: string;
}

interface CCMFormDetail extends CCMForm {
  lessee_code?: string;
  lessee_name?: string | null;
  company_name: string;
  primary_contact_name?: string | null;
  primary_contact_email?: string | null;
  primary_contact_phone?: string | null;
  estimate_approval_contact_name?: string | null;
  estimate_approval_contact_email?: string | null;
  estimate_approval_contact_phone?: string | null;
  dispo_contact_name?: string | null;
  dispo_contact_email?: string | null;
  dispo_contact_phone?: string | null;
  food_grade?: boolean;
  mineral_wipe?: boolean;
  kosher_wash?: boolean;
  kosher_wipe?: boolean;
  shop_oil_material?: boolean;
  oil_provider_contact?: string | null;
  rinse_water_test_procedure?: string | null;
  decal_requirements?: string | null;
  nitrogen_applied?: boolean;
  nitrogen_psi?: string | null;
  outbound_dispo_contact_email?: string | null;
  outbound_dispo_contact_phone?: string | null;
  documentation_required_prior_to_release?: string | null;
  special_fittings_vendor_requirements?: string | null;
  additional_notes?: string | null;
  version?: number;
  sealing_sections?: CCMFormSealing[];
  lining_sections?: CCMFormLining[];
  attachments?: CCMFormAttachment[];
}

// ---------------------------------------------------------------------------
// SOW category color mapping
// ---------------------------------------------------------------------------
const SOW_CATEGORY_COLORS: Record<string, string> = {
  cleaning: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  sealing: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  lining: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  dispo: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  special_fittings: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const SOW_CATEGORY_LABELS: Record<string, string> = {
  cleaning: 'Cleaning',
  sealing: 'Sealing',
  lining: 'Lining',
  dispo: 'Outbound Dispo',
  special_fittings: 'Special Fittings',
};

// ---------------------------------------------------------------------------
// Top-level page component with Suspense boundary
// ---------------------------------------------------------------------------
export default function CCMPage() {
  return (
    <Suspense fallback={<div className="container mx-auto p-6">Loading...</div>}>
      <CCMContent />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Inner content component (uses useSearchParams)
// ---------------------------------------------------------------------------
function CCMContent() {
  const searchParams = useSearchParams();

  // --- Data state ---
  const [forms, setForms] = useState<CCMForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Filter state ---
  const [customerCodeFilter, setCustomerCodeFilter] = useState<string>(
    searchParams.get('customer_code') || ''
  );

  // --- Expanded form detail state ---
  const [expandedFormId, setExpandedFormId] = useState<string | null>(null);
  const [formDetail, setFormDetail] = useState<CCMFormDetail | null>(null);
  const [sowSections, setSowSections] = useState<CCMFormSOWSection[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch CCM forms list
  // -------------------------------------------------------------------------
  const fetchForms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listCCMForms(customerCodeFilter || undefined);
      setForms(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CCM forms');
    } finally {
      setLoading(false);
    }
  }, [customerCodeFilter]);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  // -------------------------------------------------------------------------
  // Expand / collapse a form
  // -------------------------------------------------------------------------
  const handleToggleForm = async (formId: string) => {
    if (expandedFormId === formId) {
      setExpandedFormId(null);
      setFormDetail(null);
      setSowSections([]);
      return;
    }

    setExpandedFormId(formId);
    setDetailLoading(true);
    setFormDetail(null);
    setSowSections([]);

    try {
      const [detail, sections] = await Promise.all([
        getCCMForm(formId),
        getCCMFormSOWSections(formId),
      ]);
      setFormDetail(detail as CCMFormDetail);
      setSowSections(sections);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CCM form detail');
    } finally {
      setDetailLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Group SOW sections by category
  // -------------------------------------------------------------------------
  const groupedSOWSections = sowSections.reduce<Record<string, CCMFormSOWSection[]>>(
    (acc, section) => {
      const cat = section.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(section);
      return acc;
    },
    {}
  );

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const BoolBadge = ({ value, label }: { value: boolean | undefined; label: string }) => (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        value
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
      }`}
    >
      {label}: {value ? 'Yes' : 'No'}
    </span>
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Header                                                             */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Customer Care Manuals
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage customer-specific care manual forms (CCM)
        </p>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Search / Filter                                                    */}
      {/* ----------------------------------------------------------------- */}
      <div className="card p-4">
        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
          Customer Code
        </label>
        <input
          type="text"
          value={customerCodeFilter}
          onChange={(e) => setCustomerCodeFilter(e.target.value)}
          placeholder="Filter by customer code..."
          className="input w-full"
        />
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Error state                                                        */}
      {/* ----------------------------------------------------------------- */}
      {error && (
        <div className="card p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <p className="text-red-700 dark:text-red-400">{error}</p>
            <button
              onClick={() => {
                setError(null);
                fetchForms();
              }}
              className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Loading skeleton                                                   */}
      {/* ----------------------------------------------------------------- */}
      {loading && (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Empty state                                                        */}
      {/* ----------------------------------------------------------------- */}
      {!loading && !error && forms.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p>No CCM forms found</p>
          <p className="text-sm mt-1">Adjust your filter or add CCM forms to get started</p>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* CCM Forms List                                                     */}
      {/* ----------------------------------------------------------------- */}
      {!loading && !error && forms.length > 0 && (
        <div className="space-y-3">
          {forms.map((form) => (
            <div key={form.id}>
              {/* List card */}
              <div
                onClick={() => handleToggleForm(form.id)}
                className="card p-4 hover:shadow-md transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                        {form.company_name}
                      </span>
                      {form.customer_code && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                          {form.customer_code}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Form Date:</span>{' '}
                        {formatDate(form.form_date)}
                      </span>
                      <span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Revised:</span>{' '}
                        {formatDate(form.revision_date)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      {form.sealing_count !== undefined && (
                        <span className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded">
                          {form.sealing_count} sealing
                        </span>
                      )}
                      {form.lining_count !== undefined && (
                        <span className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">
                          {form.lining_count} lining
                        </span>
                      )}
                      {form.attachment_count !== undefined && (
                        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                          {form.attachment_count} attachments
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center ml-4 flex-shrink-0">
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        expandedFormId === form.id ? 'rotate-90' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* -------------------------------------------------------------- */}
              {/* Expanded Detail                                                 */}
              {/* -------------------------------------------------------------- */}
              {expandedFormId === form.id && (
                <div className="mt-1 space-y-4">
                  {/* Detail loading skeleton */}
                  {detailLoading && (
                    <div className="card p-6 animate-pulse space-y-4">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                      <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                  )}

                  {!detailLoading && formDetail && (
                    <>
                      {/* ---------------------------------------------------- */}
                      {/* Company Info                                          */}
                      {/* ---------------------------------------------------- */}
                      <div className="card p-4 space-y-3">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          Company Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">Company Name</span>
                            <p className="text-gray-900 dark:text-gray-100">{formDetail.company_name || '--'}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">Customer Code</span>
                            <p className="text-gray-900 dark:text-gray-100">{formDetail.customer_code || formDetail.lessee_code || '--'}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">Form Date</span>
                            <p className="text-gray-900 dark:text-gray-100">{formatDate(formDetail.form_date)}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">Revision Date</span>
                            <p className="text-gray-900 dark:text-gray-100">{formatDate(formDetail.revision_date)}</p>
                          </div>
                        </div>
                      </div>

                      {/* ---------------------------------------------------- */}
                      {/* Contacts                                              */}
                      {/* ---------------------------------------------------- */}
                      {(formDetail.primary_contact_name ||
                        formDetail.estimate_approval_contact_name ||
                        formDetail.dispo_contact_name) && (
                        <div className="card p-4 space-y-3">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Contacts
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            {formDetail.primary_contact_name && (
                              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                                <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Primary Contact</p>
                                <p className="text-gray-900 dark:text-gray-100">{formDetail.primary_contact_name}</p>
                                {formDetail.primary_contact_email && (
                                  <p className="text-gray-600 dark:text-gray-400">{formDetail.primary_contact_email}</p>
                                )}
                                {formDetail.primary_contact_phone && (
                                  <p className="text-gray-600 dark:text-gray-400">{formDetail.primary_contact_phone}</p>
                                )}
                              </div>
                            )}
                            {formDetail.estimate_approval_contact_name && (
                              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                                <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Estimate Approval</p>
                                <p className="text-gray-900 dark:text-gray-100">{formDetail.estimate_approval_contact_name}</p>
                                {formDetail.estimate_approval_contact_email && (
                                  <p className="text-gray-600 dark:text-gray-400">{formDetail.estimate_approval_contact_email}</p>
                                )}
                                {formDetail.estimate_approval_contact_phone && (
                                  <p className="text-gray-600 dark:text-gray-400">{formDetail.estimate_approval_contact_phone}</p>
                                )}
                              </div>
                            )}
                            {formDetail.dispo_contact_name && (
                              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                                <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Dispo Contact</p>
                                <p className="text-gray-900 dark:text-gray-100">{formDetail.dispo_contact_name}</p>
                                {formDetail.dispo_contact_email && (
                                  <p className="text-gray-600 dark:text-gray-400">{formDetail.dispo_contact_email}</p>
                                )}
                                {formDetail.dispo_contact_phone && (
                                  <p className="text-gray-600 dark:text-gray-400">{formDetail.dispo_contact_phone}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ---------------------------------------------------- */}
                      {/* Sealing Requirements                                  */}
                      {/* ---------------------------------------------------- */}
                      {formDetail.sealing_sections && formDetail.sealing_sections.length > 0 && (
                        <div className="card p-4 space-y-3">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Sealing Requirements
                          </h3>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                  <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Commodity</th>
                                  <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Gasket Material</th>
                                  <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Vendors</th>
                                  <th className="text-center py-2 px-3 font-medium text-gray-700 dark:text-gray-300">VSP Ride Tight</th>
                                  <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Requirements</th>
                                </tr>
                              </thead>
                              <tbody>
                                {formDetail.sealing_sections.map((s) => (
                                  <tr
                                    key={s.id}
                                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                                  >
                                    <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">
                                      {s.commodity}
                                    </td>
                                    <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                                      {s.gasket_sealing_material || '--'}
                                      {s.alternate_material && (
                                        <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">
                                          (alt: {s.alternate_material})
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                                      {s.preferred_gasket_vendor || '--'}
                                      {s.alternate_vendor && (
                                        <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">
                                          (alt: {s.alternate_vendor})
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                          s.vsp_ride_tight
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                        }`}
                                      >
                                        {s.vsp_ride_tight ? 'Yes' : 'No'}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-gray-700 dark:text-gray-300 max-w-xs truncate">
                                      {s.sealing_requirements || '--'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* ---------------------------------------------------- */}
                      {/* Cleaning Requirements                                 */}
                      {/* ---------------------------------------------------- */}
                      <div className="card p-4 space-y-3">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          Cleaning Requirements
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          <BoolBadge value={formDetail.food_grade} label="Food Grade" />
                          <BoolBadge value={formDetail.mineral_wipe} label="Mineral Wipe" />
                          <BoolBadge value={formDetail.kosher_wash} label="Kosher Wash" />
                          <BoolBadge value={formDetail.kosher_wipe} label="Kosher Wipe" />
                          <BoolBadge value={formDetail.shop_oil_material} label="Shop Oil Material" />
                        </div>
                        {formDetail.oil_provider_contact && (
                          <div className="text-sm">
                            <span className="font-medium text-gray-700 dark:text-gray-300">Oil Provider Contact:</span>{' '}
                            <span className="text-gray-900 dark:text-gray-100">{formDetail.oil_provider_contact}</span>
                          </div>
                        )}
                        {formDetail.rinse_water_test_procedure && (
                          <div className="text-sm">
                            <span className="font-medium text-gray-700 dark:text-gray-300">Rinse Water Test Procedure:</span>{' '}
                            <span className="text-gray-900 dark:text-gray-100">{formDetail.rinse_water_test_procedure}</span>
                          </div>
                        )}
                      </div>

                      {/* ---------------------------------------------------- */}
                      {/* Lining Requirements                                   */}
                      {/* ---------------------------------------------------- */}
                      {formDetail.lining_sections && formDetail.lining_sections.length > 0 && (
                        <div className="card p-4 space-y-3">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Lining Requirements
                          </h3>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                  <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Commodity</th>
                                  <th className="text-center py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Lining Required</th>
                                  <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Inspection Interval</th>
                                  <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Lining Type</th>
                                  <th className="text-center py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Plan on File</th>
                                  <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Requirements</th>
                                </tr>
                              </thead>
                              <tbody>
                                {formDetail.lining_sections.map((l) => (
                                  <tr
                                    key={l.id}
                                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                                  >
                                    <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">
                                      {l.commodity}
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                          l.lining_required
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                        }`}
                                      >
                                        {l.lining_required ? 'Yes' : 'No'}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                                      {l.lining_inspection_interval || '--'}
                                    </td>
                                    <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                                      {l.lining_type || '--'}
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                          l.lining_plan_on_file
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                        }`}
                                      >
                                        {l.lining_plan_on_file ? 'Yes' : 'No'}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-gray-700 dark:text-gray-300 max-w-xs truncate">
                                      {l.lining_requirements || '--'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* ---------------------------------------------------- */}
                      {/* Outbound Dispo                                        */}
                      {/* ---------------------------------------------------- */}
                      <div className="card p-4 space-y-3">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          Outbound Dispo
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">Nitrogen Required</span>
                            <p className="text-gray-900 dark:text-gray-100">
                              {formDetail.nitrogen_applied ? 'Yes' : 'No'}
                            </p>
                          </div>
                          {formDetail.nitrogen_applied && (
                            <div>
                              <span className="font-medium text-gray-700 dark:text-gray-300">Nitrogen PSI</span>
                              <p className="text-gray-900 dark:text-gray-100">{formDetail.nitrogen_psi || '--'}</p>
                            </div>
                          )}
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">Dispo Contact</span>
                            <p className="text-gray-900 dark:text-gray-100">
                              {formDetail.outbound_dispo_contact_email || formDetail.outbound_dispo_contact_phone || '--'}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">Documentation Required</span>
                            <p className="text-gray-900 dark:text-gray-100">
                              {formDetail.documentation_required_prior_to_release || '--'}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">Decals</span>
                            <p className="text-gray-900 dark:text-gray-100">
                              {formDetail.decal_requirements || '--'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* ---------------------------------------------------- */}
                      {/* Special Fittings                                      */}
                      {/* ---------------------------------------------------- */}
                      {formDetail.special_fittings_vendor_requirements && (
                        <div className="card p-4 space-y-3">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Special Fittings
                          </h3>
                          <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                            {formDetail.special_fittings_vendor_requirements}
                          </p>
                        </div>
                      )}

                      {/* ---------------------------------------------------- */}
                      {/* Additional Notes                                      */}
                      {/* ---------------------------------------------------- */}
                      {formDetail.additional_notes && (
                        <div className="card p-4 space-y-3">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Additional Notes
                          </h3>
                          <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                            {formDetail.additional_notes}
                          </p>
                        </div>
                      )}

                      {/* ---------------------------------------------------- */}
                      {/* Attachments                                           */}
                      {/* ---------------------------------------------------- */}
                      {formDetail.attachments && formDetail.attachments.length > 0 && (
                        <div className="card p-4 space-y-3">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Attachments ({formDetail.attachments.length})
                          </h3>
                          <div className="space-y-2">
                            {formDetail.attachments.map((att) => (
                              <div
                                key={att.id}
                                className="flex items-center gap-3 text-sm bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2"
                              >
                                <svg
                                  className="w-5 h-5 text-gray-400 flex-shrink-0"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                                  />
                                </svg>
                                <span className="text-gray-900 dark:text-gray-100">{att.file_name}</span>
                                {att.file_size_bytes && (
                                  <span className="text-gray-500 dark:text-gray-400 text-xs">
                                    ({(att.file_size_bytes / 1024).toFixed(1)} KB)
                                  </span>
                                )}
                                {att.mime_type && (
                                  <span className="text-gray-500 dark:text-gray-400 text-xs">
                                    {att.mime_type}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ---------------------------------------------------- */}
                      {/* SOW Sections                                          */}
                      {/* ---------------------------------------------------- */}
                      {sowSections.length > 0 && (
                        <div className="card p-4 space-y-4">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            SOW Sections
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            These sections represent what would be injected into a Scope of Work
                          </p>

                          {Object.entries(groupedSOWSections).map(([category, sections]) => (
                            <div key={category} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    SOW_CATEGORY_COLORS[category] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  {SOW_CATEGORY_LABELS[category] || category}
                                </span>
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                  {sections.length} {sections.length === 1 ? 'section' : 'sections'}
                                </span>
                              </div>

                              <div className="space-y-1 ml-2">
                                {sections.map((section, idx) => (
                                  <div
                                    key={`${category}-${idx}`}
                                    className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-sm"
                                  >
                                    <p className="font-medium text-gray-700 dark:text-gray-300">
                                      {section.label}
                                    </p>
                                    <p className="text-gray-600 dark:text-gray-400 mt-0.5">
                                      {section.content}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
