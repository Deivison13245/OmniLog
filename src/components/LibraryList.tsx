'use client';

import React from 'react';
import { LibraryItem, LibraryStatus } from '@/lib/types';
import { MediaBadge } from './MediaBadge';
import { MediaMetaStats } from './MediaMetaStats';
import Link from 'next/link';
import { Star, Trash2, Folder, ImageOff, ExternalLink } from 'lucide-react';
import { GroupModal } from './GroupModal';

interface LibraryListProps {
  items: LibraryItem[];
  onUpdate: (id: number, data: { status?: LibraryStatus; rating?: number | null; review?: string | null }) => void;
  onDelete: (id: number) => void;
}

export function LibraryList({ items, onUpdate, onDelete }: LibraryListProps) {
  const [selectedItemForGroups, setSelectedItemForGroups] = React.useState<LibraryItem | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-900/40">
        <table className="w-full text-left text-sm text-neutral-300">
          <thead className="border-b border-neutral-800 bg-neutral-900/80 text-xs font-semibold text-neutral-400">
            <tr>
              <th className="py-3 px-4">Mídia</th>
              <th className="py-3 px-4">Tipo</th>
              <th className="py-3 px-4">Ano</th>
              <th className="py-3 px-4">Tempo / Detalhes</th>
              <th className="py-3 px-4">Grupos</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Nota</th>
              <th className="py-3 px-4">Resenha</th>
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60">
            {items.map((item) => {
              const coverParam = item.media.coverUrl ? `&cover=${encodeURIComponent(item.media.coverUrl)}` : '';
              const detailsHref = `/media/${item.media.source}/${item.media.externalId}?type=${item.media.type}&title=${encodeURIComponent(item.media.title)}${coverParam}`;

              return (
              <tr key={item.id} className="hover:bg-neutral-800/30 transition-colors">
                <td className="py-3 px-4">
                  <Link href={detailsHref} className="flex items-center gap-3 group">
                    <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-neutral-950 border border-neutral-800">
                      {item.media.coverUrl ? (
                        <img
                          src={item.media.coverUrl}
                          alt={item.media.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-neutral-600">
                          <ImageOff className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="font-semibold text-neutral-100 group-hover:text-emerald-400 line-clamp-1 transition-colors">
                        {item.media.title}
                      </span>
                    </div>
                  </Link>
                </td>
                <td className="py-3 px-4">
                  <MediaBadge type={item.media.type} />
                </td>
                <td className="py-3 px-4 text-neutral-400 font-medium">
                  {item.media.year || '-'}
                </td>
                <td className="py-3 px-4">
                  <MediaMetaStats media={item.media} />
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap items-center gap-1 max-w-[180px]">
                    {item.groups && item.groups.length > 0 ? (
                      item.groups.map((g) => (
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
                      ))
                    ) : (
                      <span className="text-xs text-neutral-500">-</span>
                    )}
                    <button
                      onClick={() => setSelectedItemForGroups(item)}
                      title="Gerenciar grupos"
                      className="ml-1 rounded-lg p-1 text-neutral-500 hover:bg-neutral-800 hover:text-emerald-400 transition-colors"
                    >
                      <Folder className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <select
                    value={item.status}
                    onChange={(e) => onUpdate(item.id, { status: e.target.value as LibraryStatus })}
                    className="rounded-xl border border-neutral-800 bg-neutral-950 px-2.5 py-1 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    <option value="backlog">Backlog</option>
                    <option value="in_progress">Em Andamento</option>
                    <option value="completed">Concluído</option>
                    <option value="dropped">Abandonado</option>
                  </select>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <select
                      value={item.rating || 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        onUpdate(item.id, { rating: val > 0 ? val : null });
                      }}
                      className="rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-200 font-medium"
                    >
                      <option value={0}>-</option>
                      {[...Array(10)].map((_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <p className="line-clamp-1 max-w-xs text-xs text-neutral-400 italic">
                    {item.review || 'Nenhuma resenha'}
                  </p>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => onDelete(item.id)}
                    className="text-neutral-400 hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-neutral-800"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>

      {selectedItemForGroups && (
        <GroupModal
          isOpen={!!selectedItemForGroups}
          onClose={() => setSelectedItemForGroups(null)}
          item={selectedItemForGroups}
        />
      )}
    </>
  );
}
