import React from 'react';
import { useCountdown } from '../lib/clock.js';
import { Clock, Zap } from 'lucide-react';

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
    let colorClass = 'text-slate-700 bg-slate-100';
    if (isClosed) {
      colorClass = 'text-slate-500 bg-slate-100';
    } else if (isExtensionWindow) {
      colorClass = 'text-orange-900 bg-orange-100 font-bold animate-pulse ring-1 ring-orange-400';
    } else if (isEndingSoon) {
      colorClass = 'text-amber-800 bg-amber-100 font-semibold';
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs ${colorClass}`}>
        <Clock className="w-3.5 h-3.5" />
        <span>{formatted}</span>
      </span>
    );
  }

  let statusBg = 'bg-blue-50/80 border-blue-200 text-blue-950';
  if (isClosed) {
    statusBg = 'bg-slate-100 border-slate-300 text-slate-600';
  } else if (isExtensionWindow) {
    statusBg = 'bg-orange-50 border-orange-400 text-orange-950 ring-2 ring-orange-400/80 shadow-md';
  } else if (isEndingSoon) {
    statusBg = 'bg-amber-50 border-amber-300 text-amber-950';
  }

  return (
    <div
      className={`p-5 rounded-2xl border ${statusBg} flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs transition-all`}
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${isExtensionWindow ? 'bg-orange-600 text-white animate-bounce' : 'bg-blue-600 text-white'}`}>
          {isExtensionWindow ? <Zap className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
        </div>
        <div>
          <div className="text-[11px] uppercase font-bold tracking-wider opacity-75">
            {isClosed ? 'Auction Concluded' : 'Official Time Remaining'}
          </div>
          <div className="text-3xl font-black font-mono tracking-tight">
            {formatted}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {extensionCount > 0 && (
          <span className="px-2.5 py-1 bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold rounded-lg shadow-2xs">
            Extended {extensionCount}x
          </span>
        )}
        {isExtensionWindow && (
          <span className="px-2.5 sm:px-3 py-1 bg-orange-600 text-white text-[11px] sm:text-xs font-bold rounded-lg animate-pulse shadow-sm flex items-center gap-1 whitespace-nowrap">
            <Zap className="w-3.5 h-3.5 shrink-0" />
            <span>&lt;30s Anti-Snipe (+60s/bid)</span>
          </span>
        )}
      </div>
    </div>
  );
};
