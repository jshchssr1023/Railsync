import type { Metadata, Viewport } from 'next';
import { Roboto } from 'next/font/google';
import dynamic from 'next/dynamic';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/context/AuthContext';
import { SidebarProvider } from '@/context/SidebarContext';
import { ToastProvider } from '@/components/Toast';
import AppShell from '@/components/AppShell';

// Dynamic import to avoid SSR hydration issues with framer-motion
const DashboardWithWrapper = dynamic(
  () => import('@/components/DashboardWithWrapper'),
  { ssr: false }
);

const roboto = Roboto({ subsets: ['latin'], weight: ['300', '400', '500', '700'] });

export const metadata: Metadata = {
  title: 'Railsync - Shop Loading Tool',
  description: 'Railcar repair shop assignment and evaluation system',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Railsync',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${roboto.className} bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100`}>
        <ThemeProvider>
          <AuthProvider>
            <SidebarProvider>
              <ToastProvider>
                <AppShell dashboardWrapper={<DashboardWithWrapper />}>
                  {children}
                </AppShell>
              </ToastProvider>
            </SidebarProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
