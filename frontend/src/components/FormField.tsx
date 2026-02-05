'use client';

import { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, htmlFor, error, hint, required, children, className = '' }: FormFieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}
    </div>
  );
}

// Input with error state
interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ error, className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none transition-all ${
        error
          ? 'border-red-500 dark:border-red-400 focus:ring-2 focus:ring-red-500 focus:border-red-500'
          : 'border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
      } ${className}`}
      aria-invalid={error ? 'true' : undefined}
      {...props}
    />
  )
);
InputField.displayName = 'InputField';

// Select with error state
interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  children: ReactNode;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ error, className = '', children, ...props }, ref) => (
    <select
      ref={ref}
      className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none transition-all ${
        error
          ? 'border-red-500 dark:border-red-400 focus:ring-2 focus:ring-red-500 focus:border-red-500'
          : 'border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
      } ${className}`}
      aria-invalid={error ? 'true' : undefined}
      {...props}
    >
      {children}
    </select>
  )
);
SelectField.displayName = 'SelectField';

// Textarea with error state
interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ error, className = '', ...props }, ref) => (
    <textarea
      ref={ref}
      className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none transition-all ${
        error
          ? 'border-red-500 dark:border-red-400 focus:ring-2 focus:ring-red-500 focus:border-red-500'
          : 'border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
      } ${className}`}
      aria-invalid={error ? 'true' : undefined}
      {...props}
    />
  )
);
TextareaField.displayName = 'TextareaField';
