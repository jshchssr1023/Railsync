'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

// Route label mapping for human-readable breadcrumbs
const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  shopping: 'Shopping Events',
  shops: 'Shop Finder',
  cars: 'Cars',
  planning: 'Quick Shop',
  pipeline: 'Pipeline',
  plans: 'Master Plans',
  contracts: 'Contracts',
  projects: 'Projects',
  invoices: 'Invoices',
  'invoice-cases': 'Case Queue',
  budget: 'Budget & Forecasts',
  analytics: 'Analytics',
  'cost-analytics': 'Cost Analytics',
  'shop-performance': 'Shop Performance',
  migration: 'Data Migration',
  'parallel-run': 'Parallel Run',
  'go-live': 'Go-Live Command Center',
  feedback: 'Feedback',
  reports: 'Reports',
  audit: 'Audit Log',
  admin: 'Admin',
  settings: 'Settings',
  rules: 'Rules',
  ccm: 'Care Manuals',
  'scope-library': 'SOW Library',
  'bad-orders': 'Bad Orders',
  qualifications: 'Qualifications',
  billing: 'Billing',
  integrations: 'Integrations',
  'components-registry': 'Components',
  new: 'New Shopping Request',
};

interface BreadcrumbItem {
  label: string;
  href: string;
  current: boolean;
}

export default function Breadcrumbs() {
  const pathname = usePathname();

  if (pathname === '/' || pathname === '/dashboard') {
    return null;
  }

  const segments = pathname.split('/').filter(Boolean);
  const items: BreadcrumbItem[] = [];

  // Always start with Dashboard
  items.push({ label: 'Dashboard', href: '/dashboard', current: false });

  // Build breadcrumb trail
  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isCurrent = index === segments.length - 1;

    // Check if this is a dynamic segment (UUID or number)
    const isDynamic = /^[0-9a-f-]{8,}$/i.test(segment) || /^\d+$/.test(segment);

    const label = isDynamic
      ? `#${segment.slice(0, 8)}...`
      : ROUTE_LABELS[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');

    items.push({ label, href: currentPath, current: isCurrent });
  });

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1.5 text-sm" role="list">
        {items.map((item, index) => (
          <li key={item.href} className="flex items-center gap-1.5">
            {index > 0 && (
              <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" aria-hidden="true" />
            )}
            {index === 0 && (
              <Home className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mr-0.5" aria-hidden="true" />
            )}
            {item.current ? (
              <span
                className="text-gray-900 dark:text-gray-100 font-medium truncate max-w-[200px]"
                aria-current="page"
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors truncate max-w-[200px]"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
