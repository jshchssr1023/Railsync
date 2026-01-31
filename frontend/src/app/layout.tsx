import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Railsync - Shop Loading Tool',
  description: 'Railcar repair shop assignment and evaluation system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen">
          {/* Header */}
          <header className="bg-primary-700 text-white shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center">
                  <h1 className="text-xl font-bold">Railsync</h1>
                  <span className="ml-3 text-primary-200 text-sm">
                    Shop Loading Tool
                  </span>
                </div>
                <nav className="flex space-x-4">
                  <a
                    href="/"
                    className="px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-600 transition-colors"
                  >
                    Dashboard
                  </a>
                  <a
                    href="/rules"
                    className="px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-600 transition-colors"
                  >
                    Rules
                  </a>
                </nav>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>

          {/* Footer */}
          <footer className="bg-gray-100 border-t border-gray-200 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <p className="text-center text-sm text-gray-500">
                Railsync Shop Loading Tool v1.0.0
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
