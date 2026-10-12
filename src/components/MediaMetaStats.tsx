import React from 'react';
import { MediaItem } from '@/lib/types';
import { Clock, Tv, Film, BookOpen, Layers } from 'lucide-react';

export function MediaMetaStats({ media }: { media: MediaItem }) {
  const meta = media.metadata as Record<string, unknown> | undefined;
  if (!meta) return null;

  const type = media.type;

  // 1. Jogos (HowLongToBeat / Playtime)
  if (type === 'game') {
    const playtime = meta.playtime as {
      mainStoryHours?: number | null;
      mainExtraHours?: number | null;
      completionistHours?: number | null;
    } | undefined;

    if (playtime?.mainStoryHours) {
      return (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-emerald-400">
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 border border-emerald-500/20" title="Tempo para zerar a história principal">
            <Clock className="h-3 w-3" />
            {playtime.mainStoryHours}h
            <span className="text-[9px] text-emerald-500/80 font-normal">história</span>
          </span>
          {playtime.completionistHours && (
            <span className="inline-flex items-center gap-1 rounded bg-neutral-800/80 px-1.5 py-0.5 text-neutral-400 border border-neutral-700/50" title="Tempo para 100% / platinar">
              {playtime.completionistHours}h
              <span className="text-[9px] text-neutral-500 font-normal">100%</span>
            </span>
          )}
        </div>
      );
    }
  }

  // 2. Séries (Temporadas e Episódios)
  if (type === 'tv') {
    const seasons = meta.seasons as number | undefined;
    const episodes = meta.episodes as number | undefined;
    const runtime = meta.runtime as number | undefined;

    if (seasons || episodes) {
      return (
        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-blue-400 font-medium">
          {seasons && (
            <span className="inline-flex items-center gap-0.5 rounded bg-blue-500/10 px-1.5 py-0.5 border border-blue-500/20">
              <Tv className="h-3 w-3" />
              {seasons} {seasons === 1 ? 'temp.' : 'temps.'}
            </span>
          )}
          {episodes && (
            <span className="rounded bg-neutral-800/80 px-1.5 py-0.5 text-neutral-300 border border-neutral-700/50">
              {episodes} eps
            </span>
          )}
          {runtime && (
            <span className="text-[10px] text-neutral-500">
              (~{runtime}m/ep)
            </span>
          )}
        </div>
      );
    }
  }

  // 3. Filmes (Duração em minutos)
  if (type === 'movie') {
    const runtime = meta.runtime as number | undefined;
    if (runtime && runtime > 0) {
      const h = Math.floor(runtime / 60);
      const m = runtime % 60;
      return (
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-400 font-medium">
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 border border-amber-500/20">
            <Film className="h-3 w-3" />
            {h > 0 ? `${h}h ${m}m` : `${m}m`}
          </span>
        </div>
      );
    }
  }

  // 4. Animes (Episódios e Duração)
  if (type === 'anime') {
    const episodes = meta.episodes as number | undefined;
    const duration = meta.duration as number | undefined;

    if (episodes) {
      return (
        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-pink-400 font-medium">
          <span className="inline-flex items-center gap-1 rounded bg-pink-500/10 px-1.5 py-0.5 border border-pink-500/20">
            <Tv className="h-3 w-3" />
            {episodes} {episodes === 1 ? 'ep.' : 'eps.'}
          </span>
          {duration && (
            <span className="text-[10px] text-neutral-500">
              (~{duration}m)
            </span>
          )}
        </div>
      );
    }
  }

  // 5. Mangás (Capítulos e Volumes)
  if (type === 'manga') {
    const chapters = meta.chapters as number | undefined;
    const volumes = meta.volumes as number | undefined;

    if (chapters || volumes) {
      return (
        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-rose-400 font-medium">
          {volumes && (
            <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-1.5 py-0.5 border border-rose-500/20">
              <Layers className="h-3 w-3" />
              {volumes} {volumes === 1 ? 'vol.' : 'vols.'}
            </span>
          )}
          {chapters && (
            <span className="rounded bg-neutral-800/80 px-1.5 py-0.5 text-neutral-300 border border-neutral-700/50">
              {chapters} caps
            </span>
          )}
        </div>
      );
    }
  }

  // 6. Livros (Páginas se houver)
  if (type === 'book') {
    const pages = (meta.pageCount || meta.number_of_pages) as number | undefined;
    if (pages) {
      return (
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 border border-emerald-500/20">
            <BookOpen className="h-3 w-3" />
            {pages} págs
          </span>
        </div>
      );
    }
  }

  return null;
}
