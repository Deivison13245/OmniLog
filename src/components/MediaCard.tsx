'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { MediaItem } from '@/lib/types';
import { MediaBadge } from './MediaBadge';
import { MediaMetaStats } from './MediaMetaStats';
import { Plus, Check, Loader2, ImageOff, ExternalLink } from 'lucide-react';

interface MediaCardProps {
  item: MediaItem;
  inLibrary?: boolean;
  onAdd?: (item: MediaItem) => void;
  isAdding?: boolean;
}

export function MediaCard({ item, inLibrary = false, onAdd, isAdding = false }: MediaCardProps) {
  const [imgError, setImgError] = useState(false);
  const coverParam = item.coverUrl ? `&cover=${encodeURIComponent(item.coverUrl)}` : '';
  const detailsHref = `/media/${item.source}/${item.externalId}?type=${item.type}&title=${encodeURIComponent(item.title)}${coverParam}`;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-800/80 bg-neutral-900/60 transition-all duration-300 hover:border-neutral-700 hover:shadow-xl hover:-translate-y-0.5">
      {/* Container de imagem clicável com proporção fixa 2:3 */}
      <Link href={detailsHref} className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-950 block">
        {item.coverUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.coverUrl}
            alt={item.title}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-4 text-neutral-600 bg-neutral-950/80">
            <ImageOff className="h-8 w-8 mb-2 opacity-40 text-neutral-500" />
            <span className="text-[11px] text-center font-medium text-neutral-500 line-clamp-2 px-1">
              {item.title}
            </span>
          </div>
        )}

        <div className="absolute top-2.5 left-2.5 z-10 shadow-sm">
          <MediaBadge type={item.type} />
        </div>
      </Link>

      <div className="flex flex-1 flex-col justify-between p-3.5 gap-2">
        <div>
          <Link href={detailsHref} className="block">
            <h3
              className="line-clamp-2 text-sm font-semibold text-neutral-100 group-hover:text-emerald-400 transition-colors leading-snug"
              title={item.title}
            >
              {item.title}
            </h3>
          </Link>
          <p className="mt-1 text-xs text-neutral-400 font-medium">
            {item.year ? item.year : 'Ano n/d'}
          </p>

          {/* Estatísticas de tempo/episódios/capítulos */}
          <MediaMetaStats media={item} />
        </div>

        <div className="mt-2 pt-2 border-t border-neutral-800/40">
          {inLibrary ? (
            <Link
              href={detailsHref}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-neutral-800/90 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-neutral-800 transition-colors"
            >
              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
              Na biblioteca
            </Link>
          ) : (
            <button
              type="button"
              disabled={isAdding}
              onClick={() => onAdd?.(item)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isAdding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              )}
              Adicionar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
