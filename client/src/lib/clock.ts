export function getServerOffset(): number {
  return 0; // Stub for M2
}

export function useCountdown(_targetDate: string): {
  msRemaining: number;
  formatted: string;
  isClosed: boolean;
} {
  return { msRemaining: 0, formatted: '00:00', isClosed: false };
}
