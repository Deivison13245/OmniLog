import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchTMDBDiscover } from '@/lib/providers/tmdb';
import { fetchIGDBDiscover } from '@/lib/providers/igdb';
import { fetchAniListDiscover } from '@/lib/providers/anilist';
import type { MediaItem } from '@/lib/types';

const discoverSchema = z.object({
  kind: z.enum(['trending', 'similar']).default('trending'),
  type: z.enum(['game', 'movie', 'tv', 'anime', 'manga', 'book']).default('game'),
  source: z.string().optional(),
  id: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const parsed = discoverSchema.safeParse({
      kind: searchParams.get('kind') || 'trending',
      type: searchParams.get('type') || 'game',
      source: searchParams.get('source') || undefined,
      id: searchParams.get('id') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'INVALID_PARAMS', message: 'Parâmetros de busca em alta inválidos.' } },
        { status: 400 }
      );
    }

    const { kind, type, id } = parsed.data;
    let items: MediaItem[] = [];

    if (type === 'movie' || type === 'tv') {
      items = await fetchTMDBDiscover(kind, type, id);
    } else if (type === 'game') {
      items = await fetchIGDBDiscover(kind, id);
    } else if (type === 'anime' || type === 'manga') {
      items = await fetchAniListDiscover(kind, type);
    }

    return NextResponse.json(
      { items },
      {
        headers: {
          'Cache-Control':
            kind === 'trending'
              ? 'public, s-maxage=10800, stale-while-revalidate=3600' // 3 horas
              : 'public, s-maxage=86400, stale-while-revalidate=3600', // 24 horas
        },
      }
    );
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'digest' in error) {
      throw error;
    }
    console.error('Erro na rota /api/discover:', error);
    return NextResponse.json({ items: [] });
  }
}
