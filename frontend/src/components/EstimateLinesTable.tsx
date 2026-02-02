'use client';

import { useState } from 'react';
import { Plus, Trash2, AlertCircle } from 'lucide-react';

export interface EstimateLine {
  id: string;
  description: string;
  estimatedCost: number;
  laborHours?: number;
  materialsCost?: number;
  allocateToCustomer: boolean;
  allocationOverrideReason?: string;
}

interface EstimateLinesTableProps {
  lines: EstimateLine[];
  onChange: (lines: EstimateLine[]) => void;
  defaultAllocateToCustomer?: boolean;
  readOnly?: boolean;
}

export default function EstimateLinesTable({
  lines,
  onChange,
  defaultAllocateToCustomer = false,
  readOnly = false,
}: EstimateLinesTableProps) {
  const [editingOverride, setEditingOverride] = useState<string | null>(null);

  const addLine = () => {
    const newLine: EstimateLine = {
      id: crypto.randomUUID(),
      description: '',
      estimatedCost: 0,
      allocateToCustomer: defaultAllocateToCustomer,
    };
    onChange([...lines, newLine]);
  };

  const updateLine = (id: string, updates: Partial<EstimateLine>) => {
    onChange(lines.map(line =>
      line.id === id ? { ...line, ...updates } : line
    ));
  };

  const removeLine = (id: string) => {
    onChange(lines.filter(line => line.id !== id));
  };

  const toggleAllocation = (id: string) => {
    const line = lines.find(l => l.id === id);
    if (!line) return;

    const newValue = !line.allocateToCustomer;

    // If changing from default, require override reason
    if (newValue !== defaultAllocateToCustomer) {
      setEditingOverride(id);
      updateLine(id, { allocateToCustomer: newValue });
    } else {
      updateLine(id, { allocateToCustomer: newValue, allocationOverrideReason: undefined });
    }
  };

  const totalCost = lines.reduce((sum, l) => sum + (l.estimatedCost || 0), 0);
  const customerCost = lines
    .filter(l => l.allocateToCustomer)
    .reduce((sum, l) => sum + (l.estimatedCost || 0), 0);
  const ownerCost = totalCost - customerCost;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Estimate Lines</h3>
        {!readOnly && (
          <button
            onClick={addLine}
            className="flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            <Plus className="w-4 h-4" />
            Add Line
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-2 font-medium text-gray-600 dark:text-gray-400">Description</th>
              <th className="text-right py-2 px-2 font-medium text-gray-600 dark:text-gray-400 w-28">Est. Cost</th>
              <th className="text-right py-2 px-2 font-medium text-gray-600 dark:text-gray-400 w-20">Labor Hrs</th>
              <th className="text-right py-2 px-2 font-medium text-gray-600 dark:text-gray-400 w-28">Materials</th>
              <th className="text-center py-2 px-2 font-medium text-gray-600 dark:text-gray-400 w-32">
                <span className="flex items-center justify-center gap-1">
                  Allocate to Customer
                </span>
              </th>
              {!readOnly && <th className="w-10"></th>}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={readOnly ? 5 : 6} className="py-8 text-center text-gray-500">
                  No estimate lines. {!readOnly && 'Click "Add Line" to begin.'}
                </td>
              </tr>
            ) : (
              lines.map((line) => {
                const needsOverride = line.allocateToCustomer !== defaultAllocateToCustomer && !line.allocationOverrideReason;

                return (
                  <tr key={line.id} className="border-b border-gray-200 dark:border-gray-700">
                    <td className="py-2 px-2">
                      {readOnly ? (
                        <span className="text-gray-900 dark:text-gray-100">{line.description || '-'}</span>
                      ) : (
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => updateLine(line.id, { description: e.target.value })}
                          placeholder="Line item description..."
                          className="w-full px-2 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                      )}
                    </td>
                    <td className="py-2 px-2">
                      {readOnly ? (
                        <span className="text-right block">{formatCurrency(line.estimatedCost)}</span>
                      ) : (
                        <input
                          type="number"
                          value={line.estimatedCost || ''}
                          onChange={(e) => updateLine(line.id, { estimatedCost: parseFloat(e.target.value) || 0 })}
                          placeholder="0"
                          className="w-full px-2 py-1 text-sm text-right border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                      )}
                    </td>
                    <td className="py-2 px-2">
                      {readOnly ? (
                        <span className="text-right block">{line.laborHours || '-'}</span>
                      ) : (
                        <input
                          type="number"
                          step="0.5"
                          value={line.laborHours || ''}
                          onChange={(e) => updateLine(line.id, { laborHours: parseFloat(e.target.value) || undefined })}
                          placeholder="-"
                          className="w-full px-2 py-1 text-sm text-right border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                      )}
                    </td>
                    <td className="py-2 px-2">
                      {readOnly ? (
                        <span className="text-right block">{line.materialsCost ? formatCurrency(line.materialsCost) : '-'}</span>
                      ) : (
                        <input
                          type="number"
                          value={line.materialsCost || ''}
                          onChange={(e) => updateLine(line.id, { materialsCost: parseFloat(e.target.value) || undefined })}
                          placeholder="-"
                          className="w-full px-2 py-1 text-sm text-right border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex flex-col items-center gap-1">
                        <input
                          type="checkbox"
                          checked={line.allocateToCustomer}
                          onChange={() => !readOnly && toggleAllocation(line.id)}
                          disabled={readOnly}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        {needsOverride && (
                          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <AlertCircle className="w-3 h-3" />
                            <span>Reason required</span>
                          </div>
                        )}
                        {editingOverride === line.id && (
                          <input
                            type="text"
                            value={line.allocationOverrideReason || ''}
                            onChange={(e) => updateLine(line.id, { allocationOverrideReason: e.target.value })}
                            onBlur={() => setEditingOverride(null)}
                            placeholder="Override reason..."
                            autoFocus
                            className="w-full px-1 py-0.5 text-xs border border-amber-300 dark:border-amber-600 rounded bg-amber-50 dark:bg-amber-900/40 dark:text-amber-100"
                          />
                        )}
                        {line.allocationOverrideReason && editingOverride !== line.id && (
                          <button
                            onClick={() => !readOnly && setEditingOverride(line.id)}
                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 truncate max-w-[120px]"
                            title={line.allocationOverrideReason}
                          >
                            {line.allocationOverrideReason}
                          </button>
                        )}
                      </div>
                    </td>
                    {!readOnly && (
                      <td className="py-2 px-2">
                        <button
                          onClick={() => removeLine(line.id)}
                          className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
          {lines.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 dark:bg-gray-800/50">
                <td className="py-2 px-2 font-medium text-gray-900 dark:text-gray-100">Total</td>
                <td className="py-2 px-2 text-right font-medium text-gray-900 dark:text-gray-100">
                  {formatCurrency(totalCost)}
                </td>
                <td colSpan={2}></td>
                <td className="py-2 px-2 text-center">
                  <div className="text-xs">
                    <div className="text-gray-600 dark:text-gray-400">
                      Customer: <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(customerCost)}</span>
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">
                      Owner: <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(ownerCost)}</span>
                    </div>
                  </div>
                </td>
                {!readOnly && <td></td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
