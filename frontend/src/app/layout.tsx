import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider, ThemeToggle } from '@/components/ThemeProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Railsync - Shop Loading Tool',
  description: 'Railcar repair shop assignment and evaluation system',
};

function Header() {
  return (
    <header className="bg-primary-700 dark:bg-gray-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold">Railsync</h1>
            <span className="ml-3 text-primary-200 dark:text-gray-400 text-sm hidden sm:inline">
              Shop Loading Tool
            </span>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <nav className="flex space-x-1 sm:space-x-4">
              <a
                href="/"
                className="px-2 sm:px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-600 dark:hover:bg-gray-700 transition-colors"
              >
                Dashboard
              </a>
              <a
                href="/rules"
                className="px-2 sm:px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-600 dark:hover:bg-gray-700 transition-colors"
              >
                Rules
              </a>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100`}>
        <ThemeProvider>
          <div className="min-h-screen flex flex-col">
            <Header />

            {/* Main Content */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
              {children}
            </main>

            {/* Footer */}
            <footer className="bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                  Railsync Shop Loading Tool v1.0.0
                </p>
              </div>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
