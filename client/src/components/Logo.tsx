import React from 'react';

interface LogoProps {
  variant?: 'full' | 'mark' | 'stacked';
  size?: 'sm' | 'md' | 'lg';
  withTagline?: boolean;
  light?: boolean;
  className?: string;
}

export function Logo({
  variant = 'full',
  size = 'md',
  withTagline = false,
  light = false,
  className = '',
}: LogoProps) {
  // Dimensions
  const iconDimensions = {
    sm: { width: 30, height: 26 },
    md: { width: 38, height: 32 },
    lg: { width: 50, height: 42 },
  }[size];

  const textSize = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  }[size];

  const mark = (
    <svg
      width={iconDimensions.width}
      height={iconDimensions.height}
      viewBox="0 0 135 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 transition-transform duration-200 group-hover:scale-105"
    >
      {/* S-loop (Connection / Senior - Vibrant Blue #2563EB) */}
      <path
        d="M62 30 C62 18 50 12 36 12 C18 12 12 24 12 38 C12 54 26 62 44 68 C58 73 70 80 70 93 C70 102 62 108 48 108 C32 108 20 98 18 84"
        stroke="#2563EB"
        strokeWidth="15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* b-stem & bowl (Action / Handover / Junior - Vibrant Orange #F97316) */}
      <path
        d="M74 14 V102"
        stroke="#F97316"
        strokeWidth="15"
        strokeLinecap="round"
      />
      <path
        d="M74 60 C80 50 90 46 102 46 C117 46 126 58 126 74 C126 91 115 104 99 104 C88 104 78 98 74 88"
        stroke="#F97316"
        strokeWidth="15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (variant === 'mark') {
    return <div className={`inline-flex items-center ${className}`}>{mark}</div>;
  }

  if (variant === 'stacked') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        {mark}
        <div className={`font-bold tracking-tight mt-1.5 ${textSize}`}>
          <span className={light ? 'text-white' : 'text-slate-900'}>Sen</span>
          <span className="text-blue-600">Bye</span>
        </div>
        {withTagline && (
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Seniors move on. Good stuff moves forward.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {mark}
      <div className="flex flex-col justify-center">
        <div className={`font-bold tracking-tight flex items-center leading-none ${textSize}`}>
          <span className={light ? 'text-white' : 'text-slate-900'}>Sen</span>
          <span className="text-blue-600">Bye</span>
        </div>
        {withTagline && (
          <p className={`text-[11px] font-medium leading-tight mt-0.5 ${light ? 'text-slate-300' : 'text-slate-500'}`}>
            Seniors move on. Good stuff moves forward.
          </p>
        )}
      </div>
    </div>
  );
}
