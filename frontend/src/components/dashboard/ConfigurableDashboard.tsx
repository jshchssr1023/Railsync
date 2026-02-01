'use client';

import { useState, useEffect, useCallback } from 'react';
import { listDashboardWidgets } from '@/lib/api';
import { DashboardWidget, WidgetPlacement } from '@/types';
import WidgetCard from './WidgetCard';
import ForecastWidget from './widgets/ForecastWidget';
import BudgetGaugeWidget from './widgets/BudgetGaugeWidget';
import AllocationStatusWidget from './widgets/AllocationStatusWidget';
import CapacityHeatmapWidget from './widgets/CapacityHeatmapWidget';
import DemandChartWidget from './widgets/DemandChartWidget';
import RecentCompletionsWidget from './widgets/RecentCompletionsWidget';
import TopShopsWidget from './widgets/TopShopsWidget';
import ScenarioComparisonWidget from './widgets/ScenarioComparisonWidget';

const STORAGE_KEY = 'railsync_dashboard_layout';

const DEFAULT_LAYOUT: WidgetPlacement[] = [
  { id: 'forecast-summary', x: 0, y: 0, w: 2, h: 1 },
  { id: 'budget-gauge', x: 2, y: 0, w: 1, h: 1 },
  { id: 'allocation-status', x: 0, y: 1, w: 1, h: 1 },
];

function getWidgetComponent(widgetId: string) {
  switch (widgetId) {
    case 'forecast-summary':
      return <ForecastWidget />;
    case 'budget-gauge':
      return <BudgetGaugeWidget />;
    case 'allocation-status':
      return <AllocationStatusWidget />;
    case 'capacity-heatmap':
      return <CapacityHeatmapWidget />;
    case 'demand-chart':
      return <DemandChartWidget />;
    case 'recent-completions':
      return <RecentCompletionsWidget />;
    case 'top-shops':
      return <TopShopsWidget />;
    case 'scenario-comparison':
      return <ScenarioComparisonWidget />;
    default:
      return <div className="text-sm text-gray-500">Unknown widget: {widgetId}</div>;
  }
}

function loadLayout(): WidgetPlacement[] {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load dashboard layout:', e);
  }
  return DEFAULT_LAYOUT;
}

function saveLayout(layout: WidgetPlacement[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch (e) {
    console.error('Failed to save dashboard layout:', e);
  }
}

export default function ConfigurableDashboard() {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [layout, setLayout] = useState<WidgetPlacement[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    setLayout(loadLayout());
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (initialized) {
      saveLayout(layout);
    }
  }, [layout, initialized]);

  useEffect(() => {
    listDashboardWidgets()
      .then(setWidgets)
      .catch(console.error);
  }, []);

  const addWidget = useCallback((widget: DashboardWidget) => {
    setLayout((prev) => {
      const maxY = prev.reduce((max, w) => Math.max(max, w.y + w.h), 0);
      return [
        ...prev,
        { id: widget.id, x: 0, y: maxY, w: widget.default_width, h: widget.default_height },
      ];
    });
    setShowPicker(false);
  }, []);

  const removeWidget = useCallback((widgetId: string) => {
    setLayout((prev) => prev.filter((w) => w.id !== widgetId));
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
  }, []);

  const activeWidgetIds = new Set(layout.map((w) => w.id));
  const availableWidgets = widgets.filter((w) => !activeWidgetIds.has(w.id));

  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Dashboard</h2>
        <div className="flex gap-2">
          {isEditing && (
            <>
              <button
                onClick={resetLayout}
                className="btn btn-secondary text-sm"
                title="Reset to default layout"
              >
                Reset
              </button>
              <button
                onClick={() => setShowPicker(true)}
                className="btn btn-secondary text-sm"
              >
                + Add Widget
              </button>
            </>
          )}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`btn text-sm ${isEditing ? 'btn-primary' : 'btn-secondary'}`}
          >
            {isEditing ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {layout.map((placement) => {
          const widget = widgets.find((w) => w.id === placement.id);
          const colSpanClass = placement.w === 3 ? 'col-span-3' : placement.w === 2 ? 'col-span-2' : 'col-span-1';
          return (
            <div
              key={placement.id}
              className={colSpanClass}
              style={{ minHeight: placement.h * 150 }}
            >
              <WidgetCard
                title={widget?.name || placement.id}
                description={widget?.description}
                category={widget?.category || 'Other'}
                isEditing={isEditing}
                onRemove={() => removeWidget(placement.id)}
              >
                {getWidgetComponent(placement.id)}
              </WidgetCard>
            </div>
          );
        })}
      </div>

      {layout.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No widgets configured.</p>
          <button
            onClick={() => { setIsEditing(true); setShowPicker(true); }}
            className="mt-2 text-primary-600 hover:underline"
          >
            Add your first widget
          </button>
        </div>
      )}

      {showPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Add Widget</h3>
              <button onClick={() => setShowPicker(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-96">
              {availableWidgets.length === 0 ? (
                <p className="text-gray-500 text-center">All widgets are already added</p>
              ) : (
                <div className="space-y-2">
                  {availableWidgets.map((widget) => (
                    <button
                      key={widget.id}
                      onClick={() => addWidget(widget)}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="font-medium text-gray-900 dark:text-gray-100">{widget.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{widget.description}</div>
                      <div className="text-xs text-gray-400 mt-1">{widget.category}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
