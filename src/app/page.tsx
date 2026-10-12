'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LibraryItem, LibraryStatus, MediaType, Group } from '@/lib/types';
import { LibraryCard } from '@/components/LibraryCard';
import { LibraryList } from '@/components/LibraryList';
import Link from 'next/link';
import {
  LayoutGrid,
  List as ListIcon,
  Search,
  Filter,
  ArrowUpDown,
  BookMarked,
  Loader2,
  Folder,
  HardDrive,
} from 'lucide-react';
import { BackupModal } from '@/components/BackupModal';

export default function LibraryPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'added_at' | 'title'>('added_at');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // Buscar lista de grupos para o filtro
  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: async () => {
      const res = await fetch('/api/groups');
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Buscar itens da biblioteca
  const { data: items = [], isLoading } = useQuery<LibraryItem[]>({
    queryKey: ['library', filterStatus, filterType, filterGroup, sortBy, sortDir],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterType !== 'all') params.set('type', filterType);
      if (filterGroup !== 'all') params.set('groupId', filterGroup);
      params.set('sort', sortBy);
      params.set('dir', sortDir);

      const res = await fetch(`/api/library?${params.toString()}`);
      if (!res.ok) throw new Error('Falha ao carregar biblioteca');
      return res.json();
    },
  });

  // Atualizar item (status, rating, review)
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: { status?: LibraryStatus; rating?: number | null; review?: string | null };
    }) => {
      const res = await fetch(`/api/library/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Erro ao atualizar item');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
    },
  });

  // Remover item
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/library/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Erro ao excluir item');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
    },
  });

  const handleUpdate = (
    id: number,
    data: { status?: LibraryStatus; rating?: number | null; review?: string | null }
  ) => {
    updateMutation.mutate({ id, data });
  };

  const handleDelete = (id: number) => {
    if (confirm('Deseja realmente remover este item da biblioteca?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Minha Biblioteca</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {items.length} {items.length === 1 ? 'item registrado' : 'itens registrados'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsBackupModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-sm font-medium text-neutral-300 hover:border-neutral-700 hover:text-white transition-colors"
            title="Backup e Segurança dos Dados"
          >
            <HardDrive className="h-4 w-4 text-emerald-400" />
            Backup Local
          </button>

          <Link
            href="/search"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
          >
            <Search className="h-4 w-4" />
            Adicionar Nova Mídia
          </Link>
        </div>
      </div>

      {/* Controles de Filtros e Visualização */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Filter className="h-3.5 w-3.5" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">Todos os Status</option>
              <option value="backlog">Backlog</option>
              <option value="in_progress">Em Andamento</option>
              <option value="completed">Concluído</option>
              <option value="dropped">Abandonado</option>
            </select>
          </div>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">Todos os Tipos</option>
            <option value="game">Jogos</option>
            <option value="movie">Filmes</option>
            <option value="tv">Séries</option>
            <option value="anime">Animes</option>
            <option value="manga">Mangás</option>
            <option value="book">Livros</option>
          </select>

          {/* Group filter */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Folder className="h-3.5 w-3.5" />
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">Todos os Grupos</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id.toString()}>
                  {g.name} ({g.itemCount || 0})
                </option>
              ))}
            </select>
          </div>

          {/* Ordenação */}
          <div className="flex items-center gap-1">
            <ArrowUpDown className="h-3.5 w-3.5 text-neutral-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'added_at' | 'title')}
              className="rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="added_at">Data de adição</option>
              <option value="title">Título</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-xs text-neutral-300 hover:text-white"
            >
              {sortDir === 'asc' ? 'Crescente' : 'Decrescente'}
            </button>
          </div>
        </div>

        {/* Grade / Lista Toggle */}
        <div className="flex items-center rounded-lg border border-neutral-800 bg-neutral-950 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            title="Visualização em Grade"
            className={`rounded-md p-1.5 transition-colors ${
              viewMode === 'grid'
                ? 'bg-neutral-800 text-emerald-400'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            title="Visualização em Lista"
            className={`rounded-md p-1.5 transition-colors ${
              viewMode === 'list'
                ? 'bg-neutral-800 text-emerald-400'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <ListIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-2" />
          <p className="text-sm">Carregando sua biblioteca...</p>
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-800 py-16 text-center">
          <BookMarked className="h-12 w-12 text-neutral-600 mb-3" />
          <h3 className="text-base font-semibold text-neutral-200">Nenhum item encontrado</h3>
          <p className="mt-1 text-sm text-neutral-500 max-w-sm">
            {filterStatus !== 'all' || filterType !== 'all'
              ? 'Tente ajustar os filtros selecionados acima.'
              : 'Você ainda não registrou nenhum jogo, filme, livro ou anime. Comece buscando agora!'}
          </p>
          <Link
            href="/search"
            className="mt-4 rounded-xl bg-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 transition-colors"
          >
            Fazer uma busca
          </Link>
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6">
              {items.map((item) => (
                <LibraryCard
                  key={item.id}
                  item={item}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <LibraryList items={items} onUpdate={handleUpdate} onDelete={handleDelete} />
          )}
        </>
      )}

      {/* Modal de Backup Local */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
      />
    </div>
  );
}
