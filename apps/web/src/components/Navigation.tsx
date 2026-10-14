'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export function Navigation() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, signOut, loading } = useAuth();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '/', label: 'Início' },
    { href: '/projects', label: 'Projetos' },
  ];

  async function handleSignOut() {
    await signOut();
    window.location.href = '/auth/login';
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        isScrolled
          ? 'bg-white/90 dark:bg-surface-950/90 backdrop-blur-sm shadow-sm border-b border-surface-200 dark:border-surface-800'
          : 'bg-transparent'
      }`}
      role="banner"
    >
      <nav
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        aria-label="Navegação principal"
      >
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-bold text-surface-900 dark:text-surface-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-lg"
            aria-label="NexusAI - Página inicial"
          >
            <svg
              className="w-8 h-8 text-primary-600 dark:text-primary-400"
              viewBox="0 0 32 32"
              fill="none"
              aria-hidden="true"
            >
              <rect width="32" height="32" rx="8" fill="currentColor" opacity="0.1" />
              <path
                d="M16 6L22 12V20L16 26L10 20V12L16 6Z"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <path d="M16 10V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M10 14H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:block">NexusAI</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors relative py-2 ${
                  pathname === link.href
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
                }`}
                aria-current={pathname === link.href ? 'page' : undefined}
              >
                {link.label}
                {pathname === link.href && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400 rounded-full"
                    aria-hidden="true"
                  />
                )}
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-3">
            {!loading && user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-surface-600 dark:text-surface-400">
                  {user.user_metadata?.full_name || user.email}
                </span>
                <button onClick={handleSignOut} className="btn-ghost text-sm">
                  Sair
                </button>
              </div>
            ) : (
              <Link href="/auth/login" className="btn-primary text-sm">
                Entrar
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div
            id="mobile-menu"
            className="md:hidden py-4 border-t border-surface-200 dark:border-surface-800 animate-in"
            role="navigation"
            aria-label="Menu mobile"
          >
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-lg text-base font-medium ${
                    pathname === link.href
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                      : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={pathname === link.href ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-2 border-t border-surface-200 dark:border-surface-700">
                {!loading && user ? (
                  <button
                    onClick={handleSignOut}
                    className="w-full px-3 py-2 rounded-lg text-left text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
                  >
                    Sair ({user.email})
                  </button>
                ) : (
                  <Link
                    href="/auth/login"
                    className="btn-primary mt-2 w-full text-center block"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Entrar
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}