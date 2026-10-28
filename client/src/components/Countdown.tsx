import React from 'react';
import { useCountdown } from '../lib/clock.js';

interface CountdownProps {
  closesAt: string;
  extensionCount?: number;
  compact?: boolean;
}

export const Countdown: React.FC<CountdownProps> = ({
  closesAt,
  extensionCount = 0,
  compact = false,
}) => {
  const { formatted, isClosed, isEndingSoon, isExtensionWindow } = useCountdown(closesAt);

  if (compact) {
    let colorClass = 'text-gray-700 bg-gray-100';
    if (isClosed) {
      colorClass = 'text-gray-500 bg-gray-100';
    } else if (isExtensionWindow) {
      colorClass = 'text-red-700 bg-red-100 font-bold animate-pulse';
    } else if (isEndingSoon) {
      colorClass = 'text-amber-700 bg-amber-100 font-semibold';
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs ${colorClass}`}>
        <span>⏱️</span>
        <span>{formatted}</span>
      </span>
    );
  }

  let statusBg = 'bg-blue-50 border-blue-200 text-blue-900';
  if (isClosed) {
    statusBg = 'bg-gray-100 border-gray-300 text-gray-600';
  } else if (isExtensionWindow) {
    statusBg = 'bg-red-50 border-red-300 text-red-900 ring-2 ring-red-400';
  } else if (isEndingSoon) {
    statusBg = 'bg-amber-50 border-amber-300 text-amber-900';
  }

  return (
    <div className={`p-4 rounded-xl border ${statusBg} flex flex-col sm:flex-row items-center justify-between gap-3`} aria-live="polite">
      <div className="flex items-center gap-2">
        <span className="text-2xl">⏳</span>
        <div>
          <div className="text-xs uppercase font-bold tracking-wider opacity-75">
            {isClosed ? 'Status' : 'Time Remaining'}
          </div>
          <div className="text-2xl font-black font-mono">
            {formatted}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {extensionCount > 0 && (
          <span className="px-2 py-1 bg-amber-200 text-amber-900 text-xs font-bold rounded-md">
            Extended {extensionCount}x
          </span>
        )}
        {isExtensionWindow && (
          <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-md animate-pulse">
            ⚡ 30s Anti-Sniping Window (+60s per bid)
          </span>
        )}
      </div>
    </div>
  );
};
