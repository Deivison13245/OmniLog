'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock,
  Tv,
  Film,
  Gamepad2,
  BookOpen,
  Sparkles,
  ExternalLink,
  Plus,
  Check,
  Star,
  Calculator,
  Layers,
  ChevronRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type {
  MediaDetails,
  MediaItem,
  MediaSource,
  MediaType,
  RelatedWork,
} from '@/lib/types';
import {
  addLibraryItem,
  getCachedMediaDetails,
  saveCachedMediaDetails,
  updateLibraryItem,
  useAllLibraryItems,
  useLibraryItemByMedia,
} from '@/lib/library-db';
import { MediaBadge } from '@/components/MediaBadge';

function MediaDetailsContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const source = params.source as MediaSource;
  const id = params.id as string;
  const initialType = (searchParams.get('type') as MediaType) || 'game';
  const initialTitle = searchParams.get('title') || '';
  const initialCover = searchParams.get('cover') || null;

  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Região de Streaming
  const [region, setRegion] = useState('BR');

  // Horas por dia para a calculadora HLTB
  const [hoursPerDay, setHoursPerDay] = useState(2);

  // Item correspondente na biblioteca local do usuário
  const libraryItem = useLibraryItemByMedia(source, id);
  const allLibraryItems = useAllLibraryItems();

  // Carregar detalhes (primeiro do cache local, depois da API)
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setError(null);

      // 1. Tentar ler do cache do Dexie
      const cached = await getCachedMediaDetails(source, id);
      if (cached && isMounted) {
        setDetails({
          ...cached,
          coverUrl: cached.coverUrl || initialCover,
        });
        setIsLoading(false);
      }

      // 2. Buscar da rota /api/details
      try {
        const query = new URLSearchParams({
          source,
          id,
          type: initialType,
          region,
        });
        if (initialTitle) query.set('title', initialTitle);

        const res = await fetch(`/api/details?${query.toString()}`);
        if (!res.ok) throw new Error('Falha ao obter detalhes');
        const data: MediaDetails = await res.json();

        if (isMounted) {
          setDetails((prev) => ({
            ...data,
            coverUrl: data.coverUrl || prev?.coverUrl || initialCover,
            year: data.year || prev?.year,
            title: data.title || prev?.title || initialTitle,
          }));
          setIsLoading(false);
          // Salvar em cache local (RF-T6)
          await saveCachedMediaDetails({
            ...data,
            coverUrl: data.coverUrl || cached?.coverUrl || initialCover,
          });
        }
      } catch (err) {
        if (isMounted && !cached) {
          setError('Não foi possível carregar os detalhes completos da obra.');
          setIsLoading(false);
        }
      }
    }

    if (source && id) {
      void loadData();
    }

    return () => {
      isMounted = false;
    };
  }, [source, id, initialType, initialTitle, region]);

  // Ação de adicionar ou atualizar item na biblioteca
  const handleAddToLibrary = async (status: 'backlog' | 'in_progress' | 'completed') => {
    if (!details) return;
    const media: MediaItem = {
      source,
      externalId: id,
      type: details.type || initialType,
      title: details.title || initialTitle,
      year: details.year ?? null,
      coverUrl: details.coverUrl ?? null,
      metadata: {
        genres: details.genres,
        synopsis: details.synopsis,
      },
    };
    await addLibraryItem(media, status);
  };

  const handleUpdateHours = async (hours: number) => {
    if (!libraryItem) return;
    await updateLibraryItem(libraryItem.id, {
      playtimeHours: hours,
      progress: hours,
    });
  };

  const isWorkInLibrary = (rel: RelatedWork) => {
    return (allLibraryItems || []).some(
      (item) => item.media.source === rel.source && item.media.externalId === rel.externalId
    );
  };

  const handleAddRelatedToLibrary = async (rel: RelatedWork) => {
    const media: MediaItem = {
      source: rel.source,
      externalId: rel.externalId,
      type: rel.type,
      title: rel.title,
      year: rel.year ?? null,
      coverUrl: rel.coverUrl ?? null,
    };
    await addLibraryItem(media, 'backlog');
  };

  const formatHours = (hours?: number) => {
    if (!hours) return '-';
    const isHalf = hours % 1 !== 0;
    const whole = Math.floor(hours);
    return isHalf ? `${whole}½ h` : `${whole} h`;
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Botão Voltar */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      {/* Banner Principal com Capa e Metadados */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 md:p-8 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          {/* Capa com Proporção Rígida */}
          <div className="w-full md:w-56 shrink-0 flex justify-center">
            <div className="relative aspect-[2/3] w-48 md:w-56 overflow-hidden rounded-xl bg-neutral-800 shadow-xl border border-neutral-700/50">
              {details?.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={details.coverUrl}
                  alt={details?.title || 'Capa'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-neutral-500 text-xs">
                  Sem capa
                </div>
              )}
            </div>
          </div>

          {/* Info Principal */}
          <div className="flex-1 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <MediaBadge type={details?.type || initialType} />
                <span className="text-xs uppercase font-bold tracking-wider text-neutral-400 px-2 py-0.5 rounded-full bg-neutral-800">
                  {source}
                </span>
                {details?.year && (
                  <span className="text-xs font-medium text-neutral-400">
                    {details.year}
                  </span>
                )}
              </div>

              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                {details?.title || initialTitle || 'Detalhes da Mídia'}
              </h1>

              {/* Gêneros */}
              {details?.genres && details.genres.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {details.genres.map((g) => (
                    <span
                      key={g}
                      className="rounded-md border border-neutral-700/60 bg-neutral-800/60 px-2 py-0.5 text-xs text-neutral-300"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {/* Sinopse */}
              {details?.synopsis && (
                <div className="mt-4 text-sm text-neutral-300 leading-relaxed max-w-3xl whitespace-pre-line">
                  {details.synopsis}
                </div>
              )}
            </div>

            {/* Status na Biblioteca */}
            <div className="pt-4 border-t border-neutral-800 flex flex-wrap items-center gap-3">
              {libraryItem ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2 text-sm font-semibold text-emerald-400">
                    <Check className="h-4 w-4" />
                    Na sua biblioteca: <span className="capitalize">{libraryItem.status.replace('_', ' ')}</span>
                  </div>

                  <select
                    value={libraryItem.status}
                    onChange={(e) =>
                      updateLibraryItem(libraryItem.id, {
                        status: e.target.value as any,
                      })
                    }
                    className="rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="backlog">Mudar para Backlog</option>
                    <option value="in_progress">Mudar para Em Andamento</option>
                    <option value="completed">Mudar para Concluído</option>
                    <option value="dropped">Mudar para Abandonado</option>
                  </select>

                  <div className="flex items-center gap-1.5 text-xs text-neutral-400 bg-neutral-800/80 px-3 py-2 rounded-xl border border-neutral-700/50">
                    <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                    <span>Nota:</span>
                    <select
                      value={libraryItem.rating || ''}
                      onChange={(e) =>
                        updateLibraryItem(libraryItem.id, {
                          rating: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="bg-transparent text-white font-semibold focus:outline-none"
                    >
                      <option value="" className="bg-neutral-900">Sem nota</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <option key={n} value={n} className="bg-neutral-900">
                          {n}/10
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => handleAddToLibrary('backlog')}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar ao Backlog
                  </button>
                  <button
                    onClick={() => handleAddToLibrary('in_progress')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-800 px-3.5 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-700 transition-colors"
                  >
                    Iniciar Agora
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-10 text-neutral-400">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-500 mr-2" />
          <span className="text-sm">Carregando detalhes e serviços de streaming...</span>
        </div>
      )}

      {/* BLOCO: TEMPO DE JOGO ESTILO HOWLONGTOBEAT (RF-H1 a RF-H9) */}
      {(details?.type === 'game' || initialType === 'game') && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-4">
            <div className="flex items-center gap-2.5">
              <Clock className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">Tempo de Jogo Estimado</h2>
            </div>
            {details?.timeToBeat && (
              <span className="text-xs text-neutral-400">
                Fonte: <strong className="text-neutral-200 uppercase">{details.timeToBeat.source}</strong>
                {details.timeToBeat.sourceUrl && (
                  <a
                    href={details.timeToBeat.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1.5 text-emerald-400 hover:underline inline-flex items-center gap-0.5"
                  >
                    Ver no HLTB <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </span>
            )}
          </div>

          {/* Cards dos 4 Tempos (RF-H1, RF-H2) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 text-center">
              <span className="text-xs font-medium text-neutral-400 block mb-1">
                {details?.timeToBeat?.source === 'igdb' ? 'Rápido' : 'História Principal'}
              </span>
              <span className="text-2xl font-black text-emerald-400">
                {formatHours(details?.timeToBeat?.mainStory || details?.timeToBeat?.rushed)}
              </span>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 text-center">
              <span className="text-xs font-medium text-neutral-400 block mb-1">
                {details?.timeToBeat?.source === 'igdb' ? 'Normal' : 'Principal + Extras'}
              </span>
              <span className="text-2xl font-black text-cyan-400">
                {formatHours(details?.timeToBeat?.mainPlusExtras || details?.timeToBeat?.normal)}
              </span>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 text-center">
              <span className="text-xs font-medium text-neutral-400 block mb-1">
                {details?.timeToBeat?.source === 'igdb' ? 'Completo' : '100% (Completionist)'}
              </span>
              <span className="text-2xl font-black text-purple-400">
                {formatHours(details?.timeToBeat?.completionist || details?.timeToBeat?.complete)}
              </span>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 text-center">
              <span className="text-xs font-medium text-neutral-400 block mb-1">
                Todos os Estilos
              </span>
              <span className="text-2xl font-black text-amber-400">
                {formatHours(details?.timeToBeat?.allStyles)}
              </span>
            </div>
          </div>

          {/* RF-H3: Seu Tempo e Barra de Progresso */}
          {libraryItem && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-sm font-semibold text-neutral-200">
                  Suas Horas Jogadas:
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={libraryItem.playtimeHours ?? 0}
                    onChange={(e) => handleUpdateHours(parseFloat(e.target.value) || 0)}
                    className="w-24 rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-sm font-bold text-emerald-400 text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-neutral-400">horas registradas</span>
                </div>
              </div>

              {/* Barra comparativa com História Principal */}
              {details?.timeToBeat?.mainStory ? (
                <div>
                  <div className="flex justify-between text-xs text-neutral-400 mb-1">
                    <span>Progresso estimado:</span>
                    <span>
                      {Math.round(((libraryItem.playtimeHours || 0) / details.timeToBeat.mainStory) * 100)}% da história principal
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-800">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(((libraryItem.playtimeHours || 0) / details.timeToBeat.mainStory) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* RF-H4: Calculadora de Término */}
          {details?.timeToBeat?.mainStory ? (
            <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
                <Calculator className="h-4 w-4 text-emerald-400" />
                <span>Calculadora de Término</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-300">
                <div className="flex items-center gap-2">
                  <span>Jogando</span>
                  <input
                    type="number"
                    min="0.5"
                    max="24"
                    step="0.5"
                    value={hoursPerDay}
                    onChange={(e) => setHoursPerDay(Math.max(0.5, parseFloat(e.target.value) || 1))}
                    className="w-16 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-center font-bold text-white focus:outline-none"
                  />
                  <span>horas por dia:</span>
                </div>

                <div className="flex flex-wrap gap-3">
                  <span className="rounded-lg bg-emerald-950/60 border border-emerald-800/40 px-3 py-1.5 text-emerald-300 font-medium">
                    História: <strong>{Math.ceil(details.timeToBeat.mainStory / hoursPerDay)} dias</strong>
                  </span>
                  {details.timeToBeat.completionist && (
                    <span className="rounded-lg bg-purple-950/60 border border-purple-800/40 px-3 py-1.5 text-purple-300 font-medium">
                      100%: <strong>{Math.ceil(details.timeToBeat.completionist / hoursPerDay)} dias</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* BLOCO: CONSOLES E PLATAFORMAS DE JOGOS (RF-T4) */}
      {details?.platforms && details.platforms.length > 0 && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-6 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-neutral-800 pb-4">
            <Gamepad2 className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Consoles e Plataformas</h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {details.platforms.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-neutral-800 bg-neutral-950/60 px-3.5 py-2 text-xs"
              >
                <span className="text-neutral-200 font-medium">{p.name}</span>
                {p.family && p.family !== 'Outros' && (
                  <span className="ml-2 text-[10px] text-neutral-400 font-mono">
                    ({p.family})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BLOCO: ONDE ASSISTIR / STREAMING COM JUSTWATCH (RF-T2, RF-T7) */}
      {details?.streaming && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
            <div className="flex items-center gap-2.5">
              <Tv className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">Onde Assistir (Streaming)</h2>
            </div>

            {/* Atribuição Obrigatória ao JustWatch (RF-T2) */}
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span>Dados de streaming por</span>
              <a
                href={details.streaming.tmdbLink || 'https://www.justwatch.com'}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-amber-400 hover:underline inline-flex items-center gap-1"
              >
                JustWatch <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Categorias de Streaming */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Assinatura (Flatrate) */}
            <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/50 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3">
                Assinatura (Incluso)
              </h3>
              {details.streaming.flatrate.length > 0 ? (
                <div className="flex flex-wrap gap-2.5">
                  {details.streaming.flatrate.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 rounded-lg bg-neutral-900 px-2.5 py-1.5 border border-neutral-800 text-xs text-white"
                      title={p.name}
                    >
                      {p.logoPath && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.logoPath} alt={p.name} className="h-5 w-5 rounded object-cover" />
                      )}
                      <span>{p.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-500">Nenhum serviço de assinatura no momento.</p>
              )}
            </div>

            {/* Aluguel */}
            <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/50 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3">
                Aluguel Digital
              </h3>
              {details.streaming.rent.length > 0 ? (
                <div className="flex flex-wrap gap-2.5">
                  {details.streaming.rent.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 rounded-lg bg-neutral-900 px-2.5 py-1.5 border border-neutral-800 text-xs text-white"
                      title={p.name}
                    >
                      {p.logoPath && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.logoPath} alt={p.name} className="h-5 w-5 rounded object-cover" />
                      )}
                      <span>{p.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-500">Indisponível para aluguel digital.</p>
              )}
            </div>

            {/* Compra */}
            <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/50 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-3">
                Compra Digital
              </h3>
              {details.streaming.buy.length > 0 ? (
                <div className="flex flex-wrap gap-2.5">
                  {details.streaming.buy.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 rounded-lg bg-neutral-900 px-2.5 py-1.5 border border-neutral-800 text-xs text-white"
                      title={p.name}
                    >
                      {p.logoPath && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.logoPath} alt={p.name} className="h-5 w-5 rounded object-cover" />
                      )}
                      <span>{p.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-500">Indisponível para compra digital.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BLOCO: LINKS OFICIAIS DE ANIME/MANGÁ (RF-T3) */}
      {details?.externalLinks && details.externalLinks.length > 0 && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-6 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-neutral-800 pb-4">
            <ExternalLink className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Links Oficiais de Leitura / Streaming</h2>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {details.externalLinks.map((link, idx) => (
              <a
                key={idx}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950/80 px-3.5 py-2 text-xs font-medium text-emerald-400 hover:border-emerald-500 hover:text-white transition-colors"
              >
                <span>{link.site}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* BLOCO: FRANQUIA, COLEÇÃO E OBRAS RELACIONADAS (RF-T5) */}
      {details?.collection && details.collection.works.length > 0 && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-6 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-neutral-800 pb-4">
            <Layers className="h-5 w-5 text-emerald-400" />
            <div>
              <h2 className="text-lg font-bold text-white">Coleção: {details.collection.name}</h2>
              <p className="text-xs text-neutral-400">Demais obras pertencentes a esta franquia</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {details.collection.works.map((work) => {
              const inLibrary = isWorkInLibrary(work);
              return (
                <div
                  key={work.externalId}
                  className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-2.5 flex flex-col justify-between space-y-2 group"
                >
                  <Link
                    href={`/media/${work.source}/${work.externalId}?type=${work.type}&title=${encodeURIComponent(work.title)}`}
                    className="block"
                  >
                    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-neutral-800">
                      {work.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={work.coverUrl}
                          alt={work.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-neutral-500 text-xs">
                          Sem capa
                        </div>
                      )}
                    </div>
                    <h3 className="mt-2 text-xs font-bold text-white line-clamp-1 group-hover:text-emerald-400">
                      {work.title}
                    </h3>
                    {work.year && <span className="text-[10px] text-neutral-400">{work.year}</span>}
                  </Link>

                  <div>
                    {inLibrary ? (
                      <span className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-neutral-800 py-1 text-[10px] font-semibold text-emerald-400">
                        <Check className="h-3 w-3" /> Na Biblioteca
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAddRelatedToLibrary(work)}
                        className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 py-1 text-[10px] font-semibold text-white transition-colors"
                      >
                        <Plus className="h-3 w-3" /> Adicionar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BLOCO: RELAÇÕES DE ANIME E MANGÁ (RF-T5) */}
      {details?.relations && details.relations.length > 0 && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-6 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-neutral-800 pb-4">
            <Layers className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Relações (Sequências, Adaptações)</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {details.relations.map((rel, idx) => {
              const inLibrary = isWorkInLibrary(rel.work);
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-2.5 flex flex-col justify-between space-y-2 group"
                >
                  <Link
                    href={`/media/${rel.work.source}/${rel.work.externalId}?type=${rel.work.type}&title=${encodeURIComponent(rel.work.title)}`}
                    className="block"
                  >
                    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-neutral-800">
                      {rel.work.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={rel.work.coverUrl}
                          alt={rel.work.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-neutral-500 text-xs">
                          Sem capa
                        </div>
                      )}
                      <span className="absolute top-1 left-1 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-400 backdrop-blur-sm">
                        {rel.type.replace('_', ' ')}
                      </span>
                    </div>
                    <h3 className="mt-2 text-xs font-bold text-white line-clamp-1 group-hover:text-emerald-400">
                      {rel.work.title}
                    </h3>
                  </Link>

                  <div>
                    {inLibrary ? (
                      <span className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-neutral-800 py-1 text-[10px] font-semibold text-emerald-400">
                        <Check className="h-3 w-3" /> Na Biblioteca
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAddRelatedToLibrary(rel.work)}
                        className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 py-1 text-[10px] font-semibold text-white transition-colors"
                      >
                        <Plus className="h-3 w-3" /> Adicionar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MediaDetailsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-24 text-neutral-400">
          <Loader2 className="mb-2 h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm">Carregando detalhes da obra...</p>
        </div>
      }
    >
      <MediaDetailsContent />
    </React.Suspense>
  );
}
