'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Loader2, X } from 'lucide-react';

interface TypeaheadSearchProps<T> {
  placeholder: string;
  onSearch: (query: string) => Promise<T[]>;
  onSelect: (item: T) => void;
  renderItem: (item: T) => React.ReactNode;
  getKey: (item: T) => string;
  debounceMs?: number;
  minChars?: number;
  disabled?: boolean;
}

export default function TypeaheadSearch<T>({
  placeholder,
  onSearch,
  onSelect,
  renderItem,
  getKey,
  debounceMs = 300,
  minChars = 2,
  disabled = false,
}: TypeaheadSearchProps<T>) {
  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const doSearch = useCallback(async (q: string) => {
    if (q.length < minChars) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await onSearch(q);
      setResults(data);
      setIsOpen(data.length > 0);
      setHighlightedIndex(-1);
    } catch {
      setResults([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, [onSearch, minChars]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (inputValue.length < minChars) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      doSearch(inputValue);
    }, debounceMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue, debounceMs, minChars, doSearch]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(item: T) {
    onSelect(item);
    setInputValue('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < results.length) {
          handleSelect(results[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-9 pr-8 py-2 rounded-lg border border-[var(--color-border)]
                     bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]
                     placeholder:text-[var(--color-text-tertiary)]
                     focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500
                     disabled:opacity-50"
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)] animate-spin" />
        )}
        {!isLoading && inputValue && (
          <button
            onClick={() => {
              setInputValue('');
              setResults([]);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto rounded-lg border border-[var(--color-border)]
                     bg-[var(--color-bg-primary)] shadow-lg"
        >
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[var(--color-text-tertiary)]">
              No results found
            </div>
          ) : (
            results.map((item, index) => (
              <button
                key={getKey(item)}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer
                  ${index === highlightedIndex
                    ? 'bg-blue-500/10 text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
                  }
                  ${index < results.length - 1 ? 'border-b border-[var(--color-border)]' : ''}
                `}
              >
                {renderItem(item)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
