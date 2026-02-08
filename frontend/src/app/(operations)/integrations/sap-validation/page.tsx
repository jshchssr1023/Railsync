'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import {
  Loader2,
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  Table,
  FileJson,
  ChevronDown,
} from 'lucide-react';
import { getSAPFieldMappings, validateSAPPayload } from '@/lib/api';
import { useToast } from '@/components/Toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface FieldMapping {
  railsync_field: string;
  sap_field: string;
  sap_structure: string;
  transform_rule: string;
  transform_config: Record<string, unknown> | null;
  is_required: boolean;
  default_value: string | null;
}

interface ValidationResult {
  valid: boolean;
  header: Record<string, string>;
  items: Record<string, string>[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DOCUMENT_TYPES = ['AP_INVOICE', 'AR_INVOICE', 'SPV_COST', 'MILEAGE'] as const;
type DocumentType = (typeof DOCUMENT_TYPES)[number];

const SAMPLE_PAYLOADS: Record<DocumentType, string> = {
  AP_INVOICE: JSON.stringify(
    {
      invoice_number: 'INV-2026-001',
      vendor_code: 'V100200',
      amount: 15000.0,
      currency: 'USD',
      posting_date: '2026-02-06',
      line_items: [
        { gl_account: '510000', amount: 10000.0, cost_center: 'CC100' },
        { gl_account: '520000', amount: 5000.0, cost_center: 'CC200' },
      ],
    },
    null,
    2
  ),
  AR_INVOICE: JSON.stringify(
    {
      invoice_number: 'AR-2026-001',
      customer_code: 'C300400',
      amount: 25000.0,
      currency: 'USD',
      posting_date: '2026-02-06',
    },
    null,
    2
  ),
  SPV_COST: JSON.stringify(
    {
      spv_number: 'SPV-1001',
      car_initial: 'BNSF',
      car_number: '123456',
      repair_cost: 3500.0,
      labor_cost: 1200.0,
    },
    null,
    2
  ),
  MILEAGE: JSON.stringify(
    {
      car_initial: 'UP',
      car_number: '654321',
      miles: 1250,
      rate_per_mile: 0.45,
      billing_period: '2026-01',
    },
    null,
    2
  ),
};

// ---------------------------------------------------------------------------
// Inner Page Component
// ---------------------------------------------------------------------------
function SAPValidationPageInner() {
  const toast = useToast();

  // State: document type & field mappings
  const [selectedDocType, setSelectedDocType] = useState<DocumentType | ''>('');
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [mappingsError, setMappingsError] = useState<string | null>(null);

  // State: test payload
  const [payloadJson, setPayloadJson] = useState('');
  const [jsonParseError, setJsonParseError] = useState<string | null>(null);

  // State: validation results
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // ---------------------------------------------------------------------------
  // Load field mappings when document type changes
  // ---------------------------------------------------------------------------
  const loadMappings = useCallback(
    async (docType: string) => {
      if (!docType) {
        setMappings([]);
        return;
      }
      setLoadingMappings(true);
      setMappingsError(null);
      setValidationResult(null);
      try {
        const data = await getSAPFieldMappings(docType);
        setMappings(Array.isArray(data) ? data : []);
      } catch {
        setMappingsError('Failed to load field mappings for this document type.');
        toast.error('Failed to load field mappings');
        setMappings([]);
      } finally {
        setLoadingMappings(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (selectedDocType) {
      loadMappings(selectedDocType);
    } else {
      setMappings([]);
      setMappingsError(null);
    }
  }, [selectedDocType, loadMappings]);

  // ---------------------------------------------------------------------------
  // Populate sample payload when doc type changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (selectedDocType) {
      setPayloadJson(SAMPLE_PAYLOADS[selectedDocType]);
      setJsonParseError(null);
    } else {
      setPayloadJson('');
    }
    setValidationResult(null);
  }, [selectedDocType]);

  // ---------------------------------------------------------------------------
  // Validate JSON as user types
  // ---------------------------------------------------------------------------
  const handlePayloadChange = (value: string) => {
    setPayloadJson(value);
    if (!value.trim()) {
      setJsonParseError(null);
      return;
    }
    try {
      JSON.parse(value);
      setJsonParseError(null);
    } catch (e) {
      setJsonParseError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  // ---------------------------------------------------------------------------
  // Run validation
  // ---------------------------------------------------------------------------
  const handleValidate = async () => {
    if (!selectedDocType) {
      toast.warning('Select a document type first');
      return;
    }
    if (!payloadJson.trim()) {
      toast.warning('Enter a test payload');
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(payloadJson);
    } catch {
      toast.error('Invalid JSON in payload');
      return;
    }

    setValidating(true);
    setValidationResult(null);
    try {
      const result = await validateSAPPayload(selectedDocType, parsed);
      setValidationResult(result as ValidationResult);
      if ((result as ValidationResult).valid) {
        toast.success('Payload is valid');
      } else {
        toast.warning('Validation completed with errors');
      }
    } catch {
      toast.error('Validation request failed');
    } finally {
      setValidating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Back link */}
      <Link
        href="/integrations"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Integrations
      </Link>

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            SAP Payload Validation
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Test SAP field mappings and validate payloads before posting to SAP.
          </p>
        </div>
      </div>

      {/* Document type selector */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Document Type
        </label>
        <div className="relative max-w-xs">
          <select
            value={selectedDocType}
            onChange={(e) => setSelectedDocType(e.target.value as DocumentType | '')}
            className="w-full appearance-none px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select document type...</option>
            {DOCUMENT_TYPES.map((dt) => (
              <option key={dt} value={dt}>
                {dt.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Field Mappings Table */}
      {selectedDocType && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Table className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Field Mappings &mdash; {selectedDocType.replace(/_/g, ' ')}
            </h2>
            {loadingMappings && (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400 ml-auto" />
            )}
          </div>

          {mappingsError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {mappingsError}
            </div>
          )}

          {!loadingMappings && !mappingsError && mappings.length === 0 && (
            <div className="px-4 py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
              No field mappings found for this document type.
            </div>
          )}

          {mappings.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                      RailSync Field
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                      SAP Field
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                      SAP Structure
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                      Transform Rule
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">
                      Required
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                      Default Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {mappings.map((m, idx) => (
                    <tr
                      key={`${m.railsync_field}-${idx}`}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                        m.is_required
                          ? 'bg-amber-50/50 dark:bg-amber-900/10'
                          : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-900 dark:text-gray-100">
                        {m.railsync_field}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                        {m.sap_field}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                        {m.sap_structure || '--'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                        {m.transform_rule || '--'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {m.is_required ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            Required
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            Optional
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                        {m.default_value ?? '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Test Payload Section */}
      {selectedDocType && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <FileJson className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Test Payload
            </h2>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Source Data (JSON)
              </label>
              <textarea
                value={payloadJson}
                onChange={(e) => handlePayloadChange(e.target.value)}
                rows={12}
                spellCheck={false}
                className={`w-full font-mono text-xs px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y ${
                  jsonParseError
                    ? 'border-red-400 dark:border-red-600'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder='{"field": "value"}'
              />
              {jsonParseError && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <XCircle className="w-3 h-3 flex-shrink-0" />
                  {jsonParseError}
                </p>
              )}
            </div>

            <button
              onClick={handleValidate}
              disabled={validating || !payloadJson.trim() || !!jsonParseError}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {validating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Validate
            </button>
          </div>
        </div>
      )}

      {/* Validation Results */}
      {validationResult && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            {validationResult.valid ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Validation Results
            </h2>
            <span
              className={`ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                validationResult.valid
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
              }`}
            >
              {validationResult.valid ? 'VALID' : 'INVALID'}
            </span>
          </div>

          <div className="p-4 space-y-4">
            {/* Errors */}
            {validationResult.errors && validationResult.errors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Validation Errors ({validationResult.errors.length})
                </h3>
                <ul className="space-y-1">
                  {validationResult.errors.map((err, i) => (
                    <li
                      key={i}
                      className="text-sm text-red-700 dark:text-red-400 flex items-start gap-2"
                    >
                      <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Generated SAP Header */}
            {validationResult.header &&
              Object.keys(validationResult.header).length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" />
                    Generated SAP Header
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-green-200 dark:border-green-800">
                          <th className="text-left py-1.5 pr-4 font-medium text-green-700 dark:text-green-400">
                            SAP Field
                          </th>
                          <th className="text-left py-1.5 font-medium text-green-700 dark:text-green-400">
                            Value
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-green-100 dark:divide-green-900">
                        {Object.entries(validationResult.header).map(
                          ([key, value]) => (
                            <tr key={key}>
                              <td className="py-1.5 pr-4 font-mono text-green-800 dark:text-green-300">
                                {key}
                              </td>
                              <td className="py-1.5 font-mono text-green-700 dark:text-green-400">
                                {String(value)}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            {/* Generated SAP Items */}
            {validationResult.items && validationResult.items.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  Generated SAP Items ({validationResult.items.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-green-200 dark:border-green-800">
                        <th className="text-left py-1.5 pr-4 font-medium text-green-700 dark:text-green-400">
                          #
                        </th>
                        {validationResult.items.length > 0 &&
                          Object.keys(validationResult.items[0]).map((col) => (
                            <th
                              key={col}
                              className="text-left py-1.5 pr-4 font-medium text-green-700 dark:text-green-400 font-mono"
                            >
                              {col}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-green-100 dark:divide-green-900">
                      {validationResult.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-1.5 pr-4 text-green-600 dark:text-green-500">
                            {idx + 1}
                          </td>
                          {Object.values(item).map((val, vi) => (
                            <td
                              key={vi}
                              className="py-1.5 pr-4 font-mono text-green-700 dark:text-green-400"
                            >
                              {String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Success with no items and no errors */}
            {validationResult.valid &&
              (!validationResult.errors || validationResult.errors.length === 0) &&
              (!validationResult.items || validationResult.items.length === 0) &&
              (!validationResult.header ||
                Object.keys(validationResult.header).length === 0) && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Payload validated successfully with no transformation output.
                </div>
              )}
          </div>
        </div>
      )}

      {/* Empty state when no doc type selected */}
      {!selectedDocType && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <FileJson className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select a document type above to view field mappings and test payload validation.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported Page with Suspense Boundary
// ---------------------------------------------------------------------------
export default function SAPValidationPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      }
    >
      <SAPValidationPageInner />
    </Suspense>
  );
}
