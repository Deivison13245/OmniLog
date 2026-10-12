'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SearchBar } from '@/components/SearchBar';
import { TypeTabs } from '@/components/TypeTabs';
import { MediaCard } from '@/components/MediaCard';
import { MediaItem, SearchFilter, SearchResponse, LibraryItem } from '@/lib/types';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function SearchPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Busca na API
  const { data, isLoading, error } = useQuery<SearchResponse>({
    queryKey: ['search', searchTerm, activeTab],
    queryFn: async () => {
      if (!searchTerm.trim()) return { items: [], failedSources: [] };
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchTerm)}&filter=${activeTab}`);
      if (!res.ok) throw new Error('Falha ao buscar itens');
      return res.json();
    },
    enabled: !!searchTerm.trim(),
  });

  // Obter itens já existentes na biblioteca para marcar o botão
  const { data: libraryItems } = useQuery<LibraryItem[]>({
    queryKey: ['library'],
    queryFn: async () => {
      const res = await fetch('/api/library');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const libraryKeys = new Set(
    (libraryItems || []).map((li) => `${li.media.source}:${li.media.externalId}`)
  );

  // Adicionar à biblioteca
  const addMutation = useMutation({
    mutationFn: async (item: MediaItem) => {
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (!res.ok) throw new Error('Erro ao adicionar à biblioteca');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchTerm(query.trim());
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Buscar Mídia</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Encontre jogos, filmes, séries, animes, mangás e livros para sua biblioteca.
        </p>
      </div>

      <SearchBar
        value={query}
        onChange={setQuery}
        onSubmit={handleSearch}
        placeholder="Digite o título (ex: Cyberpunk 2077, Interstellar, Death Note, Dune...)"
      />

      <TypeTabs
        currentTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
        }}
      />

      {data?.failedSources && data.failedSources.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Fonte de dados não configurada ou indisponível ({data.failedSources.map((s) => s.toUpperCase()).join(', ')}):</span>
          </div>
          <p className="text-amber-200/90 pl-6">
            {data.failedSources.includes('igdb') && (
              <span className="block">• <strong>Jogos (IGDB):</strong> Configure <code>IGDB_CLIENT_ID</code> e <code>IGDB_CLIENT_SECRET</code> no seu arquivo <code>.env.local</code>.</span>
            )}
            {data.failedSources.includes('tmdb') && (
              <span className="block">• <strong>Filmes / Séries (TMDB):</strong> Configure <code>TMDB_READ_TOKEN</code> no seu arquivo <code>.env.local</code>.</span>
            )}
          </p>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-2" />
          <p className="text-sm">Consultando fontes externas e cache local...</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-center text-sm text-rose-300">
          Ocorreu um erro ao realizar a busca. Tente novamente mais tarde.
        </div>
      )}

      {!isLoading && data?.items && data.items.length === 0 && searchTerm && (
        <div className="py-16 text-center text-neutral-500">
          Nenhum resultado encontrado para &quot;{searchTerm}&quot;.
        </div>
      )}

      {data?.items && data.items.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6">
          {data.items.map((item) => {
            const isSaved = libraryKeys.has(`${item.source}:${item.externalId}`);
            return (
              <MediaCard
                key={`${item.source}-${item.externalId}`}
                item={item}
                inLibrary={isSaved}
                onAdd={(m) => addMutation.mutate(m)}
                isAdding={addMutation.isPending && addMutation.variables?.externalId === item.externalId}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
