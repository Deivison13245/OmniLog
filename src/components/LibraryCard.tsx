'use client';

import React, { useState } from 'react';
import { LibraryItem, LibraryStatus } from '@/lib/types';
import { MediaBadge } from './MediaBadge';
import { MediaMetaStats } from './MediaMetaStats';
import Link from 'next/link';
import { Star, Trash2, Edit3, ImageOff, Folder, ExternalLink } from 'lucide-react';
import { GroupModal } from './GroupModal';

interface LibraryCardProps {
  item: LibraryItem;
  onUpdate: (id: number, data: { status?: LibraryStatus; rating?: number | null; review?: string | null }) => void;
  onDelete: (id: number) => void;
}

const STATUS_LABELS: Record<LibraryStatus, { label: string; color: string }> = {
  backlog: { label: 'Backlog', color: 'bg-neutral-800 text-neutral-300 border-neutral-700/60' },
  in_progress: { label: 'Em Andamento', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  completed: { label: 'Concluído', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  dropped: { label: 'Abandonado', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
};

export function LibraryCard({ item, onUpdate, onDelete }: LibraryCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [rating, setRating] = useState<number>(item.rating || 0);
  const [review, setReview] = useState<string>(item.review || '');

  const detailsHref = `/media/${item.media.source}/${item.media.externalId}?type=${item.media.type}&title=${encodeURIComponent(item.media.title)}`;

  const handleSave = () => {
    onUpdate(item.id, {
      rating: rating > 0 ? rating : null,
      review: review.trim() || null,
    });
    setIsEditing(false);
  };

  return (
    <>
      <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-800/80 bg-neutral-900/60 transition-all duration-300 hover:border-neutral-700 hover:shadow-xl">
        {/* Pôster com proporção 2:3 rígida para evitar distorção */}
        <Link href={detailsHref} className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-950 block">
          {item.media.coverUrl && !imgError ? (
            <img
              src={item.media.coverUrl}
              alt={item.media.title}
              onError={() => setImgError(true)}
              className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center p-4 text-neutral-600 bg-neutral-950/80">
              <ImageOff className="h-8 w-8 mb-2 opacity-40 text-neutral-500" />
              <span className="text-[11px] text-center font-medium text-neutral-500 line-clamp-2 px-1">
                {item.media.title}
              </span>
            </div>
          )}

          <div className="absolute top-2.5 left-2.5 z-10 shadow-sm">
            <MediaBadge type={item.media.type} />
          </div>

          <div className="absolute top-2.5 right-2.5 z-10 flex gap-1.5 opacity-90 transition-opacity group-hover:opacity-100">
            <button
              onClick={(e) => {
                e.preventDefault();
                setIsGroupModalOpen(true);
              }}
              title="Gerenciar Grupos"
              className="rounded-lg bg-neutral-950/80 p-1.5 text-neutral-300 hover:text-emerald-400 backdrop-blur-md transition-colors border border-white/10"
            >
              <Folder className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                onDelete(item.id);
              }}
              title="Remover da biblioteca"
              className="rounded-lg bg-neutral-950/80 p-1.5 text-neutral-300 hover:text-rose-400 backdrop-blur-md transition-colors border border-white/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </Link>

        <div className="flex flex-1 flex-col justify-between p-3.5 gap-2">
          <div>
            <Link href={detailsHref} className="block">
              <h3
                className="line-clamp-2 text-sm font-semibold text-neutral-100 group-hover:text-emerald-400 transition-colors leading-snug"
                title={item.media.title}
              >
                {item.media.title}
              </h3>
            </Link>
            <p className="mt-1 text-xs text-neutral-400 font-medium">
              {item.media.year ? item.media.year : 'Ano n/d'}
            </p>

            {/* Informações de Duração / Tempo / Temporadas / Capítulos */}
            <MediaMetaStats media={item.media} />

            {/* Grupos atribuídos */}
            {item.groups && item.groups.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {item.groups.map((g) => (
                  <span
                    key={g.id}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium border border-neutral-700/60 bg-neutral-800/80 text-neutral-300"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: g.color || '#10b981' }}
                    />
                    {g.name}
                  </span>
                ))}
              </div>
            )}

            {/* Status selector */}
            <div className="mt-2.5">
              <select
                value={item.status}
                onChange={(e) => onUpdate(item.id, { status: e.target.value as LibraryStatus })}
                className={`w-full rounded-xl px-2.5 py-1.5 text-xs font-semibold cursor-pointer border focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors ${
                  STATUS_LABELS[item.status].color
                }`}
              >
                <option value="backlog">Backlog</option>
                <option value="in_progress">Em Andamento</option>
                <option value="completed">Concluído</option>
                <option value="dropped">Abandonado</option>
              </select>
            </div>
          </div>

          {/* Avaliação e Review */}
          <div className="mt-2 border-t border-neutral-800/60 pt-2.5">
            {!isEditing ? (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-neutral-200">
                    {item.rating ? `${item.rating}/10` : '-'}
                  </span>
                  {item.rating && (
                    <span className="text-[10px] text-neutral-500">
                      ({(item.rating / 2).toFixed(1)} ★)
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 text-[11px] font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
                >
                  <Edit3 className="h-3 w-3" />
                  {item.review ? 'Ver nota' : 'Avaliar'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-neutral-400 font-medium">Nota (1 a 10):</label>
                  <select
                    value={rating}
                    onChange={(e) => setRating(parseInt(e.target.value, 10))}
                    className="rounded-lg bg-neutral-800 border border-neutral-700 px-2 py-0.5 text-xs text-white"
                  >
                    <option value={0}>Sem nota</option>
                    {[...Array(10)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1} ({((i + 1) / 2).toFixed(1)} ★)
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder="Resenha privada..."
                  rows={2}
                  className="w-full resize-none rounded-xl border border-neutral-800 bg-neutral-950 p-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="rounded-lg px-2.5 py-1 text-[11px] text-neutral-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            )}
            {item.review && !isEditing && (
              <p className="mt-1.5 line-clamp-2 text-[11px] italic text-neutral-400 bg-neutral-950/40 p-1.5 rounded-lg border border-neutral-800/40">
                &quot;{item.review}&quot;
              </p>
            )}
          </div>
        </div>
      </div>

      <GroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        item={item}
      />
    </>
  );
}
