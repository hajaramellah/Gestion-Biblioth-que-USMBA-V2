import React, { useState } from 'react';
import { BookCategory } from '../../types/library';

interface BookCoverProps {
  title: string;
  author: string;
  category: BookCategory | string;
  shelfLocation?: string;
  coverImage?: string;
  className?: string;
  compact?: boolean;
}

interface PaletteStyle {
  bg: string;
  accent: string;
  spine: string;
  text: string;
  muted: string;
}

const CATEGORY_PALETTES: Record<string, PaletteStyle> = {
  'Informatique & Réseaux': {
    bg: 'from-[#0f1f38] via-[#13294b] to-[#0b1628]',
    accent: 'border-[#d97706]/50',
    spine: 'bg-[#091322]',
    text: 'text-[#f8fafc]',
    muted: 'text-[#93c5fd]',
  },
  'Mathématiques & Algorithmique': {
    bg: 'from-[#1e293b] via-[#273549] to-[#0f172a]',
    accent: 'border-[#f59e0b]/45',
    spine: 'bg-[#0c1320]',
    text: 'text-[#f8fafc]',
    muted: 'text-[#cbd5e1]',
  },
  'Génie Électrique & Électronique': {
    bg: 'from-[#1c2e3e] via-[#233c50] to-[#13202c]',
    accent: 'border-[#fbbf24]/50',
    spine: 'bg-[#0e1922]',
    text: 'text-[#f8fafc]',
    muted: 'text-[#fde68a]',
  },
  'Génie Industriel & Mécanique': {
    bg: 'from-[#292524] via-[#3f3834] to-[#1c1917]',
    accent: 'border-[#ea580c]/50',
    spine: 'bg-[#171412]',
    text: 'text-[#fafaf9]',
    muted: 'text-[#fdba74]',
  },
  'Management & Économie': {
    bg: 'from-[#0f2e24] via-[#154032] to-[#0a211a]',
    accent: 'border-[#d4a373]/55',
    spine: 'bg-[#071812]',
    text: 'text-[#f8fafc]',
    muted: 'text-[#a7f3d0]',
  },
  'Sciences & Physique': {
    bg: 'from-[#1e1b4b] via-[#2e2968] to-[#141236]',
    accent: 'border-[#a5b4fc]/45',
    spine: 'bg-[#0e0c29]',
    text: 'text-[#f8fafc]',
    muted: 'text-[#c7d2fe]',
  },
  'Littérature & Langues': {
    bg: 'from-[#451a1d] via-[#5c2328] to-[#2e1012]',
    accent: 'border-[#e7c697]/55',
    spine: 'bg-[#240c0e]',
    text: 'text-[#fef2f2]',
    muted: 'text-[#fecdd3]',
  },
  'Général & Divers': {
    bg: 'from-[#27272a] via-[#3f3f46] to-[#18181b]',
    accent: 'border-[#d4d4d8]/40',
    spine: 'bg-[#111113]',
    text: 'text-[#fafafa]',
    muted: 'text-[#d4d4d8]',
  },
};

export const BookCover: React.FC<BookCoverProps> = ({
  title,
  author,
  category,
  shelfLocation,
  coverImage,
  className = '',
  compact = false,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const palette = CATEGORY_PALETTES[category] || CATEGORY_PALETTES['Général & Divers'];

  if (coverImage && !imgFailed) {
    return (
      <div className={`relative overflow-hidden bg-slate-100 ${className}`}>
        <img
          src={coverImage}
          alt={title}
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          referrerPolicy="no-referrer"
        />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-r from-black/25 to-transparent" />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${palette.bg} ${palette.text} select-none flex ${className}`}
    >
      {/* Book Spine Accent */}
      <div className={`${compact ? 'w-1.5' : 'w-2.5'} shrink-0 ${palette.spine} border-r border-white/10`} />

      {/* Editorial Hardcover Jacket */}
      <div className={`flex-1 flex flex-col justify-between ${compact ? 'p-1.5' : 'p-3.5'} relative`}>
        {/* Subtle inner border frame */}
        {!compact && (
          <div className={`pointer-events-none absolute inset-2 border ${palette.accent} rounded-[2px]`} />
        )}

        {!compact ? (
          <>
            <div className="relative z-10 flex items-center justify-between gap-1 text-[9px] uppercase tracking-widest opacity-80 px-1 pt-0.5">
              <span className={`truncate font-medium ${palette.muted}`}>
                {category.split('&')[0].trim()}
              </span>
              {shelfLocation && (
                <span className="font-code text-[8px] opacity-75 shrink-0">
                  {shelfLocation.split('-').slice(0, 2).join('-')}
                </span>
              )}
            </div>

            <div className="relative z-10 px-1 my-auto">
              <div className="font-serif-display text-xs sm:text-[13px] font-semibold leading-snug line-clamp-3 tracking-tight">
                {title}
              </div>
              <div className="w-6 h-px bg-white/30 my-2" />
              <div className="text-[10px] opacity-80 truncate font-medium">
                {author}
              </div>
            </div>

            <div className="relative z-10 px-1 pb-0.5 flex items-center justify-between text-[8px] tracking-widest uppercase opacity-60">
              <span>EST Fès · USMBA</span>
              {shelfLocation && <span className="font-code">{shelfLocation}</span>}
            </div>
          </>
        ) : (
          <div className="flex flex-col justify-center items-center h-full text-center px-0.5">
            <span className="font-serif-display text-[9px] font-semibold leading-tight line-clamp-3 opacity-95">
              {title}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
