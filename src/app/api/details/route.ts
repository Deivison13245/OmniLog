import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchTMDBDetails } from '@/lib/providers/tmdb';
import { fetchIGDBDetails } from '@/lib/providers/igdb';
import { fetchAniListDetails } from '@/lib/providers/anilist';
import { fetchHLTBTimeToBeat } from '@/lib/providers/hltb';
import type { MediaDetails, MediaSource, MediaType } from '@/lib/types';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  source: z.enum(['igdb', 'tmdb', 'anilist', 'openlibrary', 'googlebooks']),
  id: z.string().min(1),
  type: z.enum(['game', 'movie', 'tv', 'anime', 'manga', 'book']),
  title: z.string().optional(),
  region: z.string().default('BR'),
  block: z.enum(['info', 'streaming', 'related', 'time', 'all']).default('all'),
  overrideId: z.coerce.number().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      source: searchParams.get('source'),
      id: searchParams.get('id'),
      type: searchParams.get('type'),
      title: searchParams.get('title') || undefined,
      region: searchParams.get('region') || 'BR',
      block: searchParams.get('block') || 'all',
      overrideId: searchParams.get('overrideId') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'INVALID_PARAMS', message: 'Parâmetros inválidos.', details: parsed.error.format() } },
        { status: 400 }
      );
    }

    const { source, id, type, title, region, block, overrideId } = parsed.data;

    let partialDetails: Partial<MediaDetails> | null = null;

    if (source === 'tmdb' && (type === 'movie' || type === 'tv')) {
      partialDetails = await fetchTMDBDetails(id, type, region);
    } else if (source === 'igdb' && type === 'game') {
      partialDetails = await fetchIGDBDetails(id);

      // Bloco de tempo de jogo (RF-H1 a RF-H7):
      if ((block === 'time' || block === 'all') && title) {
        const hltbTime = await fetchHLTBTimeToBeat(title, overrideId);
        if (hltbTime) {
          partialDetails = {
            ...(partialDetails || {}),
            timeToBeat: hltbTime,
          };
        }
      }
    } else if (source === 'anilist' && (type === 'anime' || type === 'manga')) {
      partialDetails = await fetchAniListDetails(id, type);
    }

    const result: MediaDetails = {
      source: source as MediaSource,
      externalId: id,
      type: type as MediaType,
      title: title || 'Mídia',
      fetchedAt: new Date().toISOString(),
      ...(partialDetails || {}),
    };

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
      },
    });
  } catch (error: unknown) {
    console.error('Erro na rota /api/details:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Falha ao buscar detalhes da obra.' } },
      { status: 502 }
    );
  }
}
