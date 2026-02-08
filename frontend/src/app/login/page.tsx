'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Train } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import LoginForm from '@/components/LoginForm';

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  // While checking auth state, show nothing to avoid flash
  if (isLoading || isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-primary-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-primary-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8">
          {/* Logo and Branding */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary-600 mb-4">
              <Train className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Railsync
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Railcar Fleet Management
            </p>
          </div>

          {/* Login Form */}
          <LoginForm onSuccess={() => router.push('/dashboard')} />

          {/* Demo Credentials */}
          <details className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-400">
            <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
              Show demo credentials
            </summary>
            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-xs font-mono">
              admin@railsync.com / admin123<br />
              operator@railsync.com / operator123
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
