'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, User, FileText, Train, Building2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface SearchResult {
  type: 'customer' | 'lease' | 'car' | 'shop';
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

export default function GlobalCommandBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Search debounce
  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const [customers, cars, shops] = await Promise.all([
        fetch(`${API_URL}/customers?search=${encodeURIComponent(q)}&limit=5`).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${API_URL}/cars?search=${encodeURIComponent(q)}&limit=5`).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${API_URL}/shops?search=${encodeURIComponent(q)}&limit=5`).then(r => r.json()).catch(() => ({ data: [] })),
      ]);

      const searchResults: SearchResult[] = [];

      // Customers
      (customers.data || []).forEach((c: any) => {
        searchResults.push({
          type: 'customer',
          id: c.id,
          title: c.name,
          subtitle: `${c.total_cars || 0} cars`,
          href: `/contracts?customer=${c.id}`,
        });
      });

      // Cars
      (cars.data || []).forEach((c: any) => {
        searchResults.push({
          type: 'car',
          id: c.id,
          title: c.car_number,
          subtitle: `${c.product_code} • ${c.material_type || 'Unknown'}`,
          href: `/planning?tab=quick-shop&car=${c.car_number}`,
        });
      });

      // Shops
      (shops.data || []).forEach((s: any) => {
        searchResults.push({
          type: 'shop',
          id: s.id,
          title: s.name || s.shop_code,
          subtitle: s.city ? `${s.city}, ${s.state}` : s.region,
          href: `/shops?shop=${s.shop_code}`,
        });
      });

      setResults(searchResults);
      setSelectedIndex(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery('');
    router.push(result.href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'customer': return <User className="w-4 h-4" />;
      case 'lease': return <FileText className="w-4 h-4" />;
      case 'car': return <Train className="w-4 h-4" />;
      case 'shop': return <Building2 className="w-4 h-4" />;
      default: return <Search className="w-4 h-4" />;
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono bg-gray-200 dark:bg-gray-600 rounded">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Search">
          <div className="min-h-screen px-4 pt-20 text-center">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />

            {/* Dialog */}
            <div className="inline-block w-full max-w-xl text-left align-middle transition-all transform bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center border-b border-gray-200 dark:border-gray-700">
                <Search className="w-5 h-5 ml-4 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search customers, cars, shops..."
                  className="flex-1 px-4 py-4 text-gray-900 dark:text-gray-100 bg-transparent outline-none placeholder-gray-400 dark:placeholder-gray-500"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="p-2 mr-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto">
                {loading ? (
                  <div className="px-4 py-8 text-center text-gray-500">Searching...</div>
                ) : results.length > 0 ? (
                  <ul className="py-2">
                    {results.map((result, index) => (
                      <li key={`${result.type}-${result.id}`}>
                        <button
                          onClick={() => handleSelect(result)}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                            index === selectedIndex
                              ? 'bg-primary-50 dark:bg-primary-900/20'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          <span className={`p-1.5 rounded ${
                            result.type === 'customer' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' :
                            result.type === 'car' ? 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400' :
                            'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400'
                          }`}>
                            {getIcon(result.type)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {result.title}
                            </p>
                            {result.subtitle && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {result.subtitle}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 capitalize">{result.type}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : query.length >= 2 ? (
                  <div className="px-4 py-8 text-center text-gray-500">No results found</div>
                ) : (
                  <div className="px-4 py-8 text-center text-gray-400 text-sm">
                    Type at least 2 characters to search
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400">
                <span>
                  <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">↑↓</kbd> Navigate
                  <kbd className="ml-2 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">↵</kbd> Select
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">Esc</kbd> Close
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
