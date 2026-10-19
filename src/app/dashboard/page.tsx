'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Compass,
  Flame,
  Gamepad2,
  Film,
  Tv,
  BookOpen,
  Sparkles,
  Plus,
  Play,
  TrendingUp,
  Star,
  Check,
  AlertCircle,
  Loader2,
  ChevronRight,
  ShieldCheck,
  Info,
} from 'lucide-react';
import {
  addLibraryItem,
  getLatestAiResult,
  incrementItemProgress,
  readSetting,
  saveAiResult,
  useAllLibraryItems,
  writeSetting,
} from '@/lib/library-db';
import type {
  AiResult,
  AiRecommendedItem,
  LibraryItem,
  MediaItem,
  MediaType,
} from '@/lib/types';
import { MediaBadge } from '@/components/MediaBadge';

export default function DashboardPage() {
  const items = useAllLibraryItems();

  // Estados da IA
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiType, setAiType] = useState<string>('all');
  const [aiCount, setAiCount] = useState<number>(6);
  const [aiNote, setAiNote] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [hasAiConsent, setHasAiConsent] = useState<boolean | null>(null);

  // Recomendações em alta (Discover)
  const [trendingItems, setTrendingItems] = useState<MediaItem[]>([]);
  const [trendingType, setTrendingType] = useState<MediaType>('game');
  const [isTrendingLoading, setIsTrendingLoading] = useState(false);

  // Carregar consentimento da IA e último resultado salvo (RF-I5, RF-I7)
  useEffect(() => {
    async function loadInitial() {
      const consent = await readSetting<boolean>('aiConsent');
      setHasAiConsent(!!consent);

      const latest = await getLatestAiResult();
      if (latest) {
        setAiResult(latest);
      }
    }
    void loadInitial();
  }, []);

  // Carregar em alta quando o tipo de aba mudar (RF-D7)
  useEffect(() => {
    async function loadTrending() {
      setIsTrendingLoading(true);
      try {
        const res = await fetch(`/api/discover?kind=trending&type=${trendingType}`);
        if (res.ok) {
          const data = await res.json();
          setTrendingItems(data.items || []);
        }
      } catch (err) {
        console.warn('Erro ao carregar tendências:', err);
      } finally {
        setIsTrendingLoading(false);
      }
    }
    void loadTrending();
  }, [trendingType]);

  // Cálculos de Resumo (RF-D1)
  const stats = useMemo(() => {
    if (!items) return null;

    const total = items.length;
    const byStatus = {
      backlog: items.filter((i) => i.status === 'backlog').length,
      in_progress: items.filter((i) => i.status === 'in_progress').length,
      completed: items.filter((i) => i.status === 'completed').length,
      dropped: items.filter((i) => i.status === 'dropped').length,
    };

    const byType = {
      game: items.filter((i) => i.media.type === 'game').length,
      movie: items.filter((i) => i.media.type === 'movie').length,
      tv: items.filter((i) => i.media.type === 'tv').length,
      anime: items.filter((i) => i.media.type === 'anime').length,
      manga: items.filter((i) => i.media.type === 'manga').length,
      book: items.filter((i) => i.media.type === 'book').length,
    };

    // RF-D2: Indicadores de tempo
    let totalPlayedHours = 0;
    let backlogEstimatedHours = 0;
    let totalEpisodesWatched = 0;
    let totalChaptersRead = 0;
    let totalPagesRead = 0;

    for (const item of items) {
      if (item.media.type === 'game') {
        if (item.playtimeHours) totalPlayedHours += item.playtimeHours;
        else if (item.progress) totalPlayedHours += item.progress;

        // Tempo estimado para zerar backlog (RF-D2, RF-H9)
        if (item.status === 'backlog') {
          const metadataPlaytime = item.media.metadata?.playtime as any;
          if (metadataPlaytime?.mainStoryHours) {
            backlogEstimatedHours += metadataPlaytime.mainStoryHours;
          }
        }
      } else if (item.media.type === 'tv' || item.media.type === 'anime') {
        if (item.progress) totalEpisodesWatched += item.progress;
      } else if (item.media.type === 'manga') {
        if (item.progress) totalChaptersRead += item.progress;
      } else if (item.media.type === 'book') {
        if (item.progress) totalPagesRead += item.progress;
      }
    }

    // RF-D4: Concluídos por mês nos últimos 12 meses
    const now = new Date();
    const monthsMap = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthsMap.set(key, 0);
    }

    let hasEstimatedDates = false;
    for (const item of items) {
      if (item.status === 'completed') {
        const dateStr = item.completedAt || item.updatedAt;
        if (item.completedAtEstimated) hasEstimatedDates = true;
        if (dateStr) {
          const key = dateStr.substring(0, 7);
          if (monthsMap.has(key)) {
            monthsMap.set(key, (monthsMap.get(key) || 0) + 1);
          }
        }
      }
    }

    const monthlyCompleted = Array.from(monthsMap.entries()).map(([key, count]) => {
      const [year, month] = key.split('-');
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return {
        label: `${monthNames[parseInt(month, 10) - 1]}`,
        count,
      };
    });

    // RF-D5: Distribuição de notas e média por tipo
    const ratingsDist = Array.from({ length: 10 }, (_, i) => ({ rating: i + 1, count: 0 }));
    const ratedItems = items.filter((i) => i.rating && i.rating >= 1 && i.rating <= 10);
    for (const item of ratedItems) {
      if (item.rating) ratingsDist[item.rating - 1].count++;
    }

    const typeAvgScores: Record<string, { sum: number; count: number }> = {};
    for (const item of ratedItems) {
      const t = item.media.type;
      if (!typeAvgScores[t]) typeAvgScores[t] = { sum: 0, count: 0 };
      typeAvgScores[t].sum += item.rating!;
      typeAvgScores[t].count++;
    }

    // RF-D6: Top 5 Gêneros
    const genreCounts: Record<string, number> = {};
    for (const item of items) {
      const gList = item.genres || (item.media.metadata?.genres as string[]) || [];
      for (const g of gList) {
        if (typeof g === 'string') {
          genreCounts[g] = (genreCounts[g] || 0) + 1;
        }
      }
    }
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Itens em andamento para "Continuar de onde parou" (RF-D3)
    const inProgressList = items.filter((i) => i.status === 'in_progress');

    // RF-D7: Do seu backlog (mais curtos primeiro)
    const backlogShortest = items
      .filter((i) => i.status === 'backlog' && i.media.type === 'game')
      .sort((a, b) => {
        const timeA = (a.media.metadata?.playtime as any)?.mainStoryHours ?? 999;
        const timeB = (b.media.metadata?.playtime as any)?.mainStoryHours ?? 999;
        return timeA - timeB;
      })
      .slice(0, 6);

    return {
      total,
      byStatus,
      byType,
      totalPlayedHours,
      backlogEstimatedHours,
      totalEpisodesWatched,
      totalChaptersRead,
      totalPagesRead,
      monthlyCompleted,
      hasEstimatedDates,
      ratingsDist,
      ratedCount: ratedItems.length,
      unratedCount: total - ratedItems.length,
      typeAvgScores,
      topGenres,
      inProgressList,
      backlogShortest,
    };
  }, [items]);

  // Itens válidos para o cálculo da IA (mínimo de 5 - RF-I9)
  const eligibleAiItemsCount = useMemo(() => {
    if (!items) return 0;
    return items.filter(
      (i) => i.status === 'completed' || i.status === 'in_progress' || (i.rating && i.rating >= 7)
    ).length;
  }, [items]);

  // Gerar Recomendações com IA (RF-I1 a RF-I10)
  const handleGenerateAiRecommendations = async () => {
    if (!items || eligibleAiItemsCount < 5) return;
    setIsAiLoading(true);
    setAiError(null);

    try {
      // Perfil mínimo: até 60 itens, SEM resenhas! (RF-I2)
      const profile = items.slice(0, 60).map((i) => ({
        title: i.media.title,
        type: i.media.type,
        year: i.media.year,
        status: i.status,
        rating: i.rating,
        genres: i.genres || (i.media.metadata?.genres as string[]) || undefined,
      }));

      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          type: aiType,
          count: aiCount,
          note: aiNote || undefined,
          consent: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Falha ao gerar recomendações com a IA.');
      }

      const newResult: Omit<AiResult, 'id'> = {
        createdAt: new Date().toISOString(),
        profileHash: `hash-${Date.now()}`,
        request: {
          type: aiType,
          count: aiCount,
          note: aiNote,
        },
        items: data.items,
      };

      await saveAiResult(newResult);
      setAiResult({ ...newResult, id: Date.now() });
      setIsAiModalOpen(false);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Erro ao consultar a IA.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleConsent = async () => {
    await writeSetting('aiConsent', true);
    setHasAiConsent(true);
  };

  const handleAddAiItemToLibrary = async (rec: AiRecommendedItem) => {
    await addLibraryItem(rec.media, 'backlog');
    // Remove da lista exibida
    if (aiResult) {
      setAiResult({
        ...aiResult,
        items: aiResult.items.filter((i) => i.media.externalId !== rec.media.externalId),
      });
    }
  };

  const isAlreadyInLibrary = (media: MediaItem) => {
    return (items || []).some(
      (item) => item.media.source === media.source && item.media.externalId === media.externalId
    );
  };

  // RF-D8: Estado Vazio
  if (!items || items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center text-center">
        <BarChart3 className="mb-4 h-14 w-14 text-emerald-400" />
        <h1 className="text-2xl font-bold text-white">Seu Dashboard está vazio</h1>
        <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
          Adicione itens à sua biblioteca para visualizar estatísticas de tempo, progresso de mídias,
          gráficos de conclusão e recomendações personalizadas por IA.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" /> Buscar Primeira Mídia
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            Ir para a Biblioteca
          </Link>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-8 pb-16">
      {/* Top Banner do Dashboard */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <BarChart3 className="h-6 w-6 text-emerald-400" />
            Dashboard & Estatísticas
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Visão analítica de todo o seu acervo pessoal de entretenimento.
          </p>
        </div>

        <button
          onClick={() => setIsAiModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/40 hover:from-emerald-500 hover:to-teal-500 transition-all"
        >
          <Sparkles className="h-4 w-4 text-emerald-200" />
          Recomendações com IA
        </button>
      </div>

      {/* RF-D1: CARDS DE RESUMO POR STATUS E TIPO */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
          <span className="text-xs font-medium text-neutral-400 block mb-1">Total no Acervo</span>
          <span className="text-2xl font-black text-white">{stats.total}</span>
          <span className="text-[11px] text-neutral-500 block mt-1">mídias catalogadas</span>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
          <span className="text-xs font-medium text-emerald-400 block mb-1">Concluídos</span>
          <span className="text-2xl font-black text-emerald-400">{stats.byStatus.completed}</span>
          <span className="text-[11px] text-neutral-500 block mt-1">obras finalizadas</span>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
          <span className="text-xs font-medium text-amber-400 block mb-1">Em Andamento</span>
          <span className="text-2xl font-black text-amber-400">{stats.byStatus.in_progress}</span>
          <span className="text-[11px] text-neutral-500 block mt-1">jogando / assistindo</span>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
          <span className="text-xs font-medium text-cyan-400 block mb-1">No Backlog</span>
          <span className="text-2xl font-black text-cyan-400">{stats.byStatus.backlog}</span>
          <span className="text-[11px] text-neutral-500 block mt-1">na fila de espera</span>
        </div>
      </div>

      {/* RF-D2: INDICADORES DE TEMPO E CONSUMO */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-4">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
            <Clock className="h-3.5 w-3.5 text-emerald-400" />
            <span>Horas Jogadas</span>
          </div>
          <span className="text-xl font-bold text-neutral-100">
            {stats.totalPlayedHours > 0 ? `${stats.totalPlayedHours}h` : '-'}
          </span>
        </div>

        <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-4">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            <span>Para Zerar Backlog</span>
          </div>
          <span className="text-xl font-bold text-neutral-100">
            {stats.backlogEstimatedHours > 0 ? `~${stats.backlogEstimatedHours}h` : '-'}
          </span>
        </div>

        <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-4">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
            <Tv className="h-3.5 w-3.5 text-purple-400" />
            <span>Episódios Assistidos</span>
          </div>
          <span className="text-xl font-bold text-neutral-100">
            {stats.totalEpisodesWatched > 0 ? stats.totalEpisodesWatched : '-'}
          </span>
        </div>

        <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-4">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
            <BookOpen className="h-3.5 w-3.5 text-amber-400" />
            <span>Capítulos & Páginas</span>
          </div>
          <span className="text-xl font-bold text-neutral-100">
            {stats.totalChaptersRead + stats.totalPagesRead > 0
              ? `${stats.totalChaptersRead} caps / ${stats.totalPagesRead} págs`
              : '-'}
          </span>
        </div>
      </div>

      {/* RF-D3: CONTINUAR DE ONDE PAROU COM AVANÇO RÁPIDO (+1) */}
      {stats.inProgressList.length > 0 && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
            <div className="flex items-center gap-2.5">
              <Play className="h-5 w-5 text-amber-400 fill-amber-400/20" />
              <h2 className="text-lg font-bold text-white">Continuar de Onde Parou</h2>
            </div>
            <span className="text-xs text-neutral-400">
              {stats.inProgressList.length} em andamento
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {stats.inProgressList.map((item) => {
              const current = item.progress ?? 0;
              const total = item.totalProgress;
              const percent = total ? Math.min(100, Math.round((current / total) * 100)) : null;

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-3.5 flex gap-3 items-center justify-between"
                >
                  <Link
                    href={`/media/${item.media.source}/${item.media.externalId}?type=${item.media.type}&title=${encodeURIComponent(item.media.title)}`}
                    className="flex items-center gap-3 min-w-0 flex-1 group"
                  >
                    <div className="relative aspect-[2/3] w-12 shrink-0 overflow-hidden rounded-md bg-neutral-800">
                      {item.media.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.media.coverUrl}
                          alt={item.media.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-bold text-white truncate group-hover:text-emerald-400">
                        {item.media.title}
                      </h3>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-neutral-400">
                        <span>
                          {item.media.type === 'game'
                            ? `${item.playtimeHours ?? current}h jogadas`
                            : total
                            ? `${current} / ${total}`
                            : `${current} concluídos`}
                        </span>
                      </div>
                      {percent !== null && (
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Botão de Avançar +1 na hora (RF-D3) */}
                  <button
                    onClick={() => incrementItemProgress(item.id)}
                    className="shrink-0 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white transition-colors"
                    title="Avançar 1 episódio/capítulo/página"
                  >
                    +1
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RF-I: SEÇÃO DE RECOMENDAÇÕES DA IA (GEMINI) */}
      {aiResult && aiResult.items.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 to-neutral-900/40 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-4">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              <div>
                <h2 className="text-lg font-bold text-white">Recomendações Personalizadas da IA</h2>
                <p className="text-xs text-neutral-400">
                  Geradas via Gemini com base exclusiva no seu gosto pessoal
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsAiModalOpen(true)}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1"
            >
              Pedir Novas Recomendações <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {aiResult.items.map((rec, idx) => {
              const inLibrary = isAlreadyInLibrary(rec.media);
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-3.5 flex flex-col justify-between space-y-3"
                >
                  <div className="flex gap-3">
                    <Link
                      href={`/media/${rec.media.source}/${rec.media.externalId}?type=${rec.media.type}&title=${encodeURIComponent(rec.media.title)}`}
                      className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-800 block"
                    >
                      {rec.media.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={rec.media.coverUrl}
                          alt={rec.media.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-500">
                          Sem foto
                        </div>
                      )}
                    </Link>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <MediaBadge type={rec.media.type} />
                        {rec.media.year && (
                          <span className="text-[10px] text-neutral-500">{rec.media.year}</span>
                        )}
                      </div>
                      <Link
                        href={`/media/${rec.media.source}/${rec.media.externalId}?type=${rec.media.type}&title=${encodeURIComponent(rec.media.title)}`}
                        className="text-xs font-bold text-white line-clamp-1 hover:text-emerald-400"
                      >
                        {rec.media.title}
                      </Link>
                      <p className="mt-1 text-[11px] text-neutral-300 leading-snug line-clamp-3">
                        {rec.reason}
                      </p>
                    </div>
                  </div>

                  <div>
                    {inLibrary ? (
                      <span className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-neutral-800 py-1.5 text-xs font-medium text-emerald-400">
                        <Check className="h-3.5 w-3.5" /> Na sua Biblioteca
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAddAiItemToLibrary(rec)}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-600 py-1.5 text-xs font-semibold text-white transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" /> Adicionar ao Backlog
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RF-D4: GRÁFICO DE CONCLUÍDOS POR MÊS NOS ÚLTIMOS 12 MESES */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2.5">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Obras Concluídas por Mês</h2>
          </div>
          {stats.hasEstimatedDates && (
            <span className="text-[11px] text-neutral-500">
              * Contém datas estimadas por migração
            </span>
          )}
        </div>

        <div className="pt-4 flex items-end justify-between gap-2 h-44">
          {stats.monthlyCompleted.map((m, idx) => {
            const maxVal = Math.max(...stats.monthlyCompleted.map((x) => x.count), 1);
            const heightPct = Math.round((m.count / maxVal) * 100);

            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="text-[11px] font-bold text-neutral-400">
                  {m.count > 0 ? m.count : ''}
                </span>
                <div className="w-full max-w-[28px] bg-neutral-800/80 rounded-t-md overflow-hidden flex items-end h-28">
                  <div
                    className="w-full bg-emerald-500 hover:bg-emerald-400 transition-all rounded-t-md"
                    style={{ height: `${heightPct}%` }}
                    title={`${m.label}: ${m.count} concluídos`}
                  />
                </div>
                <span className="text-[10px] text-neutral-400 font-medium">{m.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* RF-D5: DISTRIBUIÇÃO DE NOTAS E RF-D6: TOP GÊNEROS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Distribuição de Notas */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
              Distribuição de Notas (1 a 10)
            </h3>
            <span className="text-xs text-neutral-400">
              {stats.ratedCount} avaliados ({stats.unratedCount} sem nota)
            </span>
          </div>

          <div className="space-y-2">
            {stats.ratingsDist.map((r) => {
              const maxR = Math.max(...stats.ratingsDist.map((x) => x.count), 1);
              const pct = Math.round((r.count / maxR) * 100);

              return (
                <div key={r.rating} className="flex items-center gap-2 text-xs">
                  <span className="w-5 text-neutral-400 font-mono text-right">{r.rating}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-neutral-800">
                    <div
                      className="h-full bg-amber-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-6 text-[11px] text-neutral-400 font-medium">{r.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top 5 Gêneros */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Compass className="h-4 w-4 text-cyan-400" />
              Gêneros Mais Frequentes
            </h3>
          </div>

          <div className="space-y-3 pt-2">
            {stats.topGenres.length > 0 ? (
              stats.topGenres.map(([genre, count], idx) => (
                <div key={genre} className="flex items-center justify-between text-xs">
                  <span className="text-neutral-200 font-medium">
                    #{idx + 1} {genre}
                  </span>
                  <span className="rounded-full bg-neutral-800 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                    {count} {count === 1 ? 'mídia' : 'mídias'}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-neutral-500">Nenhum metadado de gênero coletado ainda.</p>
            )}
          </div>
        </div>
      </div>

      {/* RF-D7: EM ALTA POR TIPO (DISCOVER) */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2.5">
            <Flame className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-bold text-white">Mídias em Alta no Momento</h2>
          </div>

          {/* Abas de tipo */}
          <div className="flex flex-wrap gap-1.5">
            {(['game', 'movie', 'tv', 'anime', 'manga'] as MediaType[]).map((t) => (
              <button
                key={t}
                onClick={() => setTrendingType(t)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
                  trendingType === t
                    ? 'bg-emerald-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                {t === 'game'
                  ? 'Jogos'
                  : t === 'movie'
                  ? 'Filmes'
                  : t === 'tv'
                  ? 'Séries'
                  : t === 'anime'
                  ? 'Animes'
                  : 'Mangás'}
              </button>
            ))}
          </div>
        </div>

        {isTrendingLoading ? (
          <div className="flex justify-center py-8 text-neutral-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2 text-emerald-500" /> Carregando em alta...
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
            {trendingItems.map((item) => {
              const inLib = isAlreadyInLibrary(item);
              return (
                <div
                  key={item.externalId}
                  className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-2.5 flex flex-col justify-between space-y-2 group"
                >
                  <Link
                    href={`/media/${item.source}/${item.externalId}?type=${item.type}&title=${encodeURIComponent(item.title)}`}
                    className="block"
                  >
                    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-neutral-800">
                      {item.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.coverUrl}
                          alt={item.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : null}
                    </div>
                    <h3 className="mt-2 text-xs font-bold text-white line-clamp-1 group-hover:text-emerald-400">
                      {item.title}
                    </h3>
                  </Link>

                  <div>
                    {inLib ? (
                      <span className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-neutral-800 py-1 text-[10px] font-semibold text-emerald-400">
                        <Check className="h-3 w-3" /> Na Biblioteca
                      </span>
                    ) : (
                      <button
                        onClick={() => addLibraryItem(item, 'backlog')}
                        className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 py-1 text-[10px] font-semibold text-white transition-colors"
                      >
                        <Plus className="h-3 w-3" /> Backlog
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL DE RECOMENDAÇÕES COM IA (RF-I1 a RF-I10) */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                Gerar Recomendações com IA
              </h3>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="text-neutral-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Aviso de Privacidade e Consentimento Obrigatório (RF-I5) */}
            {!hasAiConsent ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-200 leading-relaxed">
                    <strong>Aviso de Privacidade:</strong> Para gerar sugestões, apenas títulos,
                    tipos de mídia e notas do seu acervo são enviados à IA. <strong>Suas resenhas privadas nunca saem do seu dispositivo.</strong>
                  </div>
                </div>
                <button
                  onClick={handleConsent}
                  className="w-full rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400 transition-colors"
                >
                  Entendi e Aceito Continuar
                </button>
              </div>
            ) : eligibleAiItemsCount < 5 ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300 space-y-1">
                <strong>Biblioteca Mínima Necessária (RF-I9):</strong>
                <p>
                  Você possui {eligibleAiItemsCount} itens qualificados (concluídos ou com nota 7+).
                  São necessários pelo menos 5 para que a IA trace um perfil preciso de gostos.
                </p>
              </div>
            ) : (
              <div className="space-y-4 text-xs text-neutral-300">
                {/* Filtro por tipo de mídia */}
                <div>
                  <label className="block font-semibold text-neutral-200 mb-1.5">
                    O que você quer que a IA recomende?
                  </label>
                  <select
                    value={aiType}
                    onChange={(e) => setAiType(e.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="all">Todas as Mídias (Balanceado)</option>
                    <option value="game">Apenas Jogos</option>
                    <option value="movie">Apenas Filmes</option>
                    <option value="tv">Apenas Séries</option>
                    <option value="anime">Apenas Animes</option>
                    <option value="manga">Apenas Mangás</option>
                    <option value="book">Apenas Livros</option>
                  </select>
                </div>

                {/* Quantidade de Recomendações (5 a 10) */}
                <div>
                  <div className="flex justify-between font-semibold text-neutral-200 mb-1.5">
                    <span>Quantidade de sugestões:</span>
                    <span className="text-emerald-400 font-bold">{aiCount}</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={10}
                    value={aiCount}
                    onChange={(e) => setAiCount(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </div>

                {/* Pedido Livre de até 140 chars */}
                <div>
                  <label className="block font-semibold text-neutral-200 mb-1.5">
                    Instrução ou tema específico (opcional - até 140 letras):
                  </label>
                  <input
                    type="text"
                    maxLength={140}
                    placeholder="Ex: Quero algo com investigação e clima sombrio..."
                    value={aiNote}
                    onChange={(e) => setAiNote(e.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {aiError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                    {aiError}
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-2.5">
                  <button
                    onClick={() => setIsAiModalOpen(false)}
                    className="rounded-xl border border-neutral-700 px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={isAiLoading}
                    onClick={handleGenerateAiRecommendations}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {isAiLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {isAiLoading ? 'Analisando perfil...' : 'Gerar Recomendações'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
