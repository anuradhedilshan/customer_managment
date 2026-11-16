import React, { useState } from 'react';

interface HotelLogoProps {
  logoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  darkText?: boolean;
  subtitle?: string;
}

export const HotelLogo: React.FC<HotelLogoProps> = ({
  logoUrl = 'https://www.tangerinehotels.com/tangerinebeachhotel/wp-content/uploads/sites/2/2022/12/logo.png',
  size = 'md',
  darkText = false,
  subtitle = 'Kalutara • Sri Lanka',
}) => {
  const [imgError, setImgError] = useState(false);

  const imgHeight =
    size === 'sm'
      ? 'h-8 w-auto max-w-[160px]'
      : size === 'lg'
      ? 'h-14 w-auto max-w-[240px]'
      : 'h-10 w-auto max-w-[190px]';

  return (
    <div className="flex items-center gap-3 select-none">
      {!imgError && logoUrl ? (
        <img
          src={logoUrl}
          alt="Tangerine Beach Hotel"
          className={`${imgHeight} object-contain ${
            darkText ? 'brightness-0' : ''
          }`}
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="h-10 w-10 rounded-lg bg-orange-600 flex items-center justify-center text-white font-bold text-sm">
          TBH
        </div>
      )}
      <div className="border-l border-slate-700 pl-3">
        <div
          className={`font-bold leading-tight ${
            size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-sm' : 'text-base'
          } ${darkText ? 'text-slate-900' : 'text-white'}`}
        >
          Tangerine Beach Hotel
        </div>
        <div
          className={`text-xs font-medium ${
            darkText ? 'text-slate-500' : 'text-slate-300'
          }`}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
};
