'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

export function RouteTransitions() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    document.documentElement.classList.remove('route-exit');

    function handleNavigation(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      const anchor = target instanceof Element ? target.closest('a[href]') : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;

      event.preventDefault();
      const navigate = () => router.push(`${destination.pathname}${destination.search}${destination.hash}`);
      const viewTransitionDocument = document as ViewTransitionDocument;

      if (
        viewTransitionDocument.startViewTransition &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        viewTransitionDocument.startViewTransition(navigate);
        return;
      }

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        navigate();
        return;
      }

      document.documentElement.classList.add('route-exit');
      window.setTimeout(navigate, 140);
    }

    document.addEventListener('click', handleNavigation, true);
    return () => document.removeEventListener('click', handleNavigation, true);
  }, [pathname, router]);

  return null;
}