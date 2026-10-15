'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAnimatedPresence } from '@/lib/useAnimatedPresence';

function DashboardIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}

function QueueIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: <DashboardIcon />, match: (p: string) => p === '/' },
  { href: '/projects', label: 'Projetos', icon: <FolderIcon />, match: (p: string) => p.startsWith('/projects') },
  { href: '/jobs', label: 'Execuções', icon: <QueueIcon />, match: (p: string) => p.startsWith('/jobs') },
];

function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-lg" aria-label="NexusAI - Dashboard">
      <svg className="w-8 h-8 text-primary-600 dark:text-primary-400" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="currentColor" opacity="0.1" />
        <path d="M16 6L22 12V20L16 26L10 20V12L16 6Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M16 10V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M10 14H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="text-lg font-bold text-surface-900 dark:text-surface-50">NexusAI</span>
    </Link>
  );
}

/**
 * Authenticated application shell: fixed sidebar on desktop, drawer on
 * mobile. Public pages (landing, auth) keep using <Navigation /> instead.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const {
    isPresent: drawerOpen,
    isClosing: drawerClosing,
    open: openDrawer,
    close: closeDrawer,
  } = useAnimatedPresence(220);
  const { user, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    window.location.href = '/auth/login';
  }

  const links = (
    <ul className="space-y-1" role="list">
      {NAV_ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? 'page' : undefined}
              onClick={() => closeDrawer()}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                active
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="min-h-screen flex bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:bg-white focus:dark:bg-surface-900 focus:px-3 focus:py-2 focus:rounded-lg focus:ring-2 focus:ring-primary-500"
      >
        Pular para o conteúdo
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 px-4 py-6">
        <BrandMark />
        <nav className="mt-8 flex-1" aria-label="Navegação principal">
          {links}
        </nav>
        <div className="pt-4 border-t border-surface-200 dark:border-surface-800 text-sm">
          {user ? (
            <div className="flex flex-col gap-2">
              <span className="truncate text-surface-600 dark:text-surface-400" title={user.email ?? ''}>
                {user.user_metadata?.full_name || user.email}
              </span>
              <button onClick={handleSignOut} className="btn-ghost text-sm justify-start">
                Sair
              </button>
            </div>
          ) : (
            <Link href="/auth/login" className="btn-primary text-sm w-full">
              Entrar
            </Link>
          )}
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className={`fixed inset-0 z-50 md:hidden presence-backdrop ${drawerClosing ? 'is-closing' : ''}`} role="dialog" aria-modal="true" aria-label="Menu de navegação" aria-hidden={drawerClosing}>
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => closeDrawer()}
            aria-hidden="true"
          />
          <div className={`absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-800 px-4 py-6 flex flex-col presence-panel presence-panel-left ${drawerClosing ? 'is-closing' : ''}`}>
            <div className="flex items-center justify-between">
              <BrandMark />
              <button
                onClick={() => closeDrawer()}
                className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Fechar menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="mt-8 flex-1" aria-label="Navegação principal móvel">
              {links}
            </nav>
            <div className="pt-4 border-t border-surface-200 dark:border-surface-700">
              {user ? (
                <button onClick={handleSignOut} className="btn-ghost text-sm w-full">
                  Sair ({user.email})
                </button>
              ) : (
                <Link href="/auth/login" className="btn-primary text-sm w-full text-center block">
                  Entrar
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-16 border-b border-surface-200 dark:border-surface-800 bg-white/90 dark:bg-surface-950/90 backdrop-blur-sm">
          <button
            onClick={openDrawer}
            className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Abrir menu"
            aria-expanded={drawerOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <BrandMark />
        </header>

        <main id="main-content" className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          {children}
        </main>

        <footer className="border-t border-surface-200 dark:border-surface-800 py-6">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-surface-500 dark:text-surface-400">
            <p>NexusAI — Análise de dados &amp; Machine Learning</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
