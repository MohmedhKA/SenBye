import { useState, useEffect } from 'react';

let serverOffsetMs = 0;

/**
 * Syncs the local clock with the server's authoritative clock timestamp.
 */
export function syncServerClock(serverIso: string): void {
  const serverTime = new Date(serverIso).getTime();
  if (!Number.isNaN(serverTime)) {
    serverOffsetMs = serverTime - Date.now();
  }
}

/**
 * Returns current authoritative timestamp adjusted for server clock skew.
 */
export function getServerNow(): number {
  return Date.now() + serverOffsetMs;
}

export function getServerOffset(): number {
  return serverOffsetMs;
}

export interface CountdownState {
  msRemaining: number;
  formatted: string;
  isClosed: boolean;
  isEndingSoon: boolean; // <= 2 minutes
  isExtensionWindow: boolean; // <= 30 seconds (Rule E1 threshold)
}

/**
 * Real-time countdown hook aligned to the authoritative server clock.
 * Ticks every 250ms when near closing (<30s) for high precision, otherwise 1000ms.
 */
export function useCountdown(targetDateIso: string): CountdownState {
  const calculate = (): CountdownState => {
    const targetMs = new Date(targetDateIso).getTime();
    if (Number.isNaN(targetMs)) {
      return {
        msRemaining: 0,
        formatted: '00:00',
        isClosed: true,
        isEndingSoon: false,
        isExtensionWindow: false,
      };
    }

    const now = getServerNow();
    const msRemaining = Math.max(0, targetMs - now);
    const isClosed = msRemaining <= 0;
    const totalSeconds = Math.floor(msRemaining / 1000);

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let formatted = 'Closed';
    if (!isClosed) {
      if (days > 0) {
        formatted = `${days}d ${hours}h ${minutes}m`;
      } else if (hours > 0) {
        formatted = `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
      } else {
        formatted = `${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
      }
    }

    return {
      msRemaining,
      formatted,
      isClosed,
      isEndingSoon: !isClosed && totalSeconds <= 120,
      isExtensionWindow: !isClosed && totalSeconds <= 30,
    };
  };

  const [state, setState] = useState<CountdownState>(calculate);

  useEffect(() => {
    setState(calculate());

    // When <= 30s, tick at 250ms for smooth anti-sniping responsiveness
    const tickInterval = state.isExtensionWindow ? 250 : 1000;
    const interval = setInterval(() => {
      setState(calculate());
    }, tickInterval);

    return () => clearInterval(interval);
  }, [targetDateIso, state.isExtensionWindow]);

  return state;
}
