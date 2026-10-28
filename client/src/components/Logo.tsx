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
  // Height classes based on size
  const imgHeight = {
    sm: 'h-6 sm:h-7',
    md: 'h-8 sm:h-9',
    lg: 'h-11 sm:h-12',
  }[size];

  const textSize = {
    sm: 'text-base sm:text-lg',
    md: 'text-xl sm:text-2xl',
    lg: 'text-2xl sm:text-3xl',
  }[size];

  const mark = (
    <img
      src="/logo-mark.png"
      alt="SenBye Sb Logo"
      className={`${imgHeight} w-auto object-contain shrink-0 transition-transform duration-200 group-hover:scale-105`}
    />
  );

  if (variant === 'mark') {
    return <div className={`inline-flex items-center ${className}`}>{mark}</div>;
  }

  if (variant === 'stacked') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        {mark}
        <div className={`font-black tracking-tight mt-1.5 ${textSize}`}>
          <span className={light ? 'text-white' : 'text-slate-900'}>Sen</span>
          <span className="text-blue-600">Bye</span>
        </div>
        {withTagline && (
          <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">
            Seniors move on. Good stuff moves forward.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 sm:gap-2.5 ${className}`}>
      {mark}
      <div className="flex flex-col justify-center min-w-0">
        <div className={`font-black tracking-tight flex items-center leading-none ${textSize}`}>
          <span className={light ? 'text-white' : 'text-slate-900'}>Sen</span>
          <span className="text-blue-600">Bye</span>
        </div>
        {withTagline && (
          <p className={`text-[10px] sm:text-[11px] font-medium leading-tight mt-0.5 hidden xs:block truncate ${light ? 'text-slate-300' : 'text-slate-500'}`}>
            Seniors move on. Good stuff moves forward.
          </p>
        )}
      </div>
    </div>
  );
}
