'use client';

import { useEffect, useRef, useState } from 'react';

export function useAnimatedPresence(duration = 220, initiallyOpen = false) {
  const [isPresent, setIsPresent] = useState(initiallyOpen);
  const [isClosing, setIsClosing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function open() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setIsPresent(true);
    setIsClosing(false);
  }

  function close(onExited?: () => void) {
    if (!isPresent || isClosing) return;
    setIsClosing(true);
    timeoutRef.current = setTimeout(() => {
      setIsPresent(false);
      setIsClosing(false);
      timeoutRef.current = null;
      onExited?.();
    }, duration);
  }

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return { isPresent, isClosing, open, close };
}