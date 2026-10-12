import React from 'react';
import { Gamepad2, Film, Tv, Sparkles, BookOpen, Bookmark } from 'lucide-react';
import { MediaType } from '@/lib/types';

export function MediaBadge({ type }: { type: MediaType }) {
  const configs: Record<MediaType, { label: string; icon: React.ReactNode; color: string }> = {
    game: { label: 'Jogo', icon: <Gamepad2 className="h-3.5 w-3.5" />, color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
    movie: { label: 'Filme', icon: <Film className="h-3.5 w-3.5" />, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    tv: { label: 'Série', icon: <Tv className="h-3.5 w-3.5" />, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    anime: { label: 'Anime', icon: <Sparkles className="h-3.5 w-3.5" />, color: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
    manga: { label: 'Mangá', icon: <Bookmark className="h-3.5 w-3.5" />, color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
    book: { label: 'Livro', icon: <BookOpen className="h-3.5 w-3.5" />, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  };

  const config = configs[type] || { label: type, icon: null, color: 'bg-neutral-800 text-neutral-300 border-neutral-700' };

  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${config.color}`}>
      {config.icon}
      {config.label}
    </span>
  );
}
