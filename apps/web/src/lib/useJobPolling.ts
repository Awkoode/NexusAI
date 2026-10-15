'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '@/lib/api';

const POLL_INTERVAL_MS = 2000;
const SLOW_POLL_INTERVAL_MS = 8000;

/**
 * Polls a job until it reaches a terminal state, then stops automatically.
 * Interval backs off while the job is queued (nothing to show yet).
 * Returns the latest job snapshot plus loading/error flags.
 */
export function useJobPolling(jobId: string | null) {
  const [job, setJob] = useState<api.Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopped = useRef(false);

  const stop = useCallback(() => {
    stopped.current = true;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => {
    stopped.current = false;
    setJob(null);
    setError(null);
    if (!jobId) return;

    let delay = POLL_INTERVAL_MS;

    const poll = async () => {
      if (stopped.current) return;
      try {
        const current = await api.getJob(jobId);
        if (stopped.current) return;
        setJob(current);
        setLoading(false);
        if (api.isTerminalJobStatus(current.status)) return; // stop: terminal
        // Back off while queued; poll normally once active.
        delay = current.status === 'queued' ? SLOW_POLL_INTERVAL_MS : POLL_INTERVAL_MS;
        timer.current = setTimeout(() => void poll(), delay);
      } catch (err) {
        if (stopped.current) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch job');
        setLoading(false);
      }
    };

    setLoading(true);
    void poll();

    return () => {
      stopped.current = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [jobId]);

  return { job, loading, error, stop };
}
