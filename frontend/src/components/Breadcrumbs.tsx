'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { NAV_CONTEXT_MAP, ROUTE_LABELS } from '@/config/navigation';

interface BreadcrumbItem {
  label: string;
  href: string;
  current: boolean;
  isContext?: boolean; // Non-clickable context segment (pillar / category)
}

export default function Breadcrumbs() {
  const pathname = usePathname();

  if (pathname === '/' || pathname === '/dashboard') {
    return null;
  }

  const items: BreadcrumbItem[] = [];

  // Always start with Dashboard
  items.push({ label: 'Dashboard', href: '/dashboard', current: false });

  // Try to get navigation context (pillar > category) from the config
  const navContext = NAV_CONTEXT_MAP.get(pathname.split('?')[0]);

  if (navContext) {
    // Add pillar context (non-clickable)
    items.push({
      label: navContext.pillarLabel,
      href: '#',
      current: false,
      isContext: true,
    });

    // Add category context (non-clickable) if it's different from the item
    if (navContext.categoryLabel !== navContext.itemLabel) {
      items.push({
        label: navContext.categoryLabel,
        href: '#',
        current: false,
        isContext: true,
      });
    }
  }

  // Build the URL-based breadcrumb trail
  const segments = pathname.split('/').filter(Boolean);
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
          <li key={`${item.href}-${index}`} className="flex items-center gap-1.5">
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
            ) : item.isContext ? (
              <span className="text-gray-400 dark:text-gray-500 truncate max-w-[200px]">
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
