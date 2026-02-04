'use client';

import { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, X, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardWrapperProps {
  children: React.ReactNode;
}

// Simpsons theme audio URL (short clip)
const SIMPSONS_AUDIO_URL = '/audio/simpsons-theme-short.mp3';

export default function DashboardWrapper({ children }: DashboardWrapperProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [simpsonsMode, setSimpsonsMode] = useState(false);
  const [hasPlayedThisSession, setHasPlayedThisSession] = useState(false);
  const [audioError, setAudioError] = useState(false);

  // Load Simpsons mode preference from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('railsync-simpsons-mode');
      setSimpsonsMode(saved === 'true');
    }
  }, []);

  // Play Simpsons theme when dashboard opens (if enabled)
  useEffect(() => {
    if (isOpen && simpsonsMode && !hasPlayedThisSession && !audioError) {
      // Only play once per session
      setHasPlayedThisSession(true);

      // Dynamic import of howler to avoid SSR issues
      import('howler').then(({ Howl }) => {
        const sound = new Howl({
          src: [SIMPSONS_AUDIO_URL],
          volume: 0.4,
          onloaderror: () => {
            console.log("D'oh! Audio file not found. Add simpsons-theme-short.mp3 to public/audio/");
            setAudioError(true);
          },
          onend: () => {
            console.log("D'oh! Theme finished.");
          },
        });
        sound.play();
      }).catch(() => {
        // howler not installed, skip audio
        console.log('Howler not available');
      });
    }
  }, [isOpen, simpsonsMode, hasPlayedThisSession, audioError]);

  const toggleSimpsonsMode = useCallback(() => {
    const newValue = !simpsonsMode;
    setSimpsonsMode(newValue);
    if (typeof window !== 'undefined') {
      localStorage.setItem('railsync-simpsons-mode', String(newValue));
    }
    // Reset session flag so it plays on next open if enabled
    if (newValue) {
      setHasPlayedThisSession(false);
    }
  }, [simpsonsMode]);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-300 transition-all duration-300"
        aria-label={isOpen ? 'Close Dashboard' : 'Open Dashboard'}
        title={simpsonsMode ? "Open Dashboard (Ralph Wiggum Mode)" : "Open Dashboard"}
      >
        {isOpen ? <X size={28} /> : <LayoutDashboard size={28} />}
      </button>

      {/* Modal Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 sm:inset-4 md:inset-8 overflow-hidden sm:rounded-2xl border-0 sm:border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-full flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 dark:bg-gray-800">
                  <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                    Contracts Dashboard
                  </h1>
                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    {/* Simpsons Mode Toggle */}
                    <button
                      onClick={toggleSimpsonsMode}
                      className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                        simpsonsMode
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                      title={simpsonsMode ? "Disable Ralph Wiggum Mode" : "Enable Ralph Wiggum Mode"}
                    >
                      {simpsonsMode ? <Volume2 size={16} /> : <VolumeX size={16} />}
                      <span className="hidden sm:inline">
                        {simpsonsMode ? 'Ralph Mode ON' : 'Ralph Mode'}
                      </span>
                    </button>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="rounded-full p-1.5 sm:p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <X className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                </div>
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                  {children}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
