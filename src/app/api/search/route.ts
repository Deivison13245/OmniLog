import { NextRequest, NextResponse } from 'next/server';
import { orchestrateSearch } from '@/lib/search';
import { SearchFilter } from '@/lib/types';
import { limitRequestsByIp } from '@/lib/rate-limit';

const validFilters = new Set<SearchFilter>(['all', 'game', 'video', 'anime', 'manga', 'book']);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get('q');
  const rawFilter = searchParams.get('filter') || 'all';
  const filter = rawFilter as SearchFilter;
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const rateLimit = limitRequestsByIp(ip);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Limite de buscas excedido. Tente novamente em instantes.' },
      {
        status: 429,
        headers: { 'Retry-After': rateLimit.retryAfterSeconds.toString() },
      }
    );
  }

  if (!q || !q.trim()) {
    return NextResponse.json({ items: [], failedSources: [] });
  }
  if (!validFilters.has(filter)) {
    return NextResponse.json({ error: 'Filtro de busca inválido.' }, { status: 400 });
  }

  try {
    const result = await orchestrateSearch(q.trim(), filter);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Search API route error:', error);
    return NextResponse.json(
      { error: 'Falha ao processar busca', items: [], failedSources: [] },
      { status: 500 }
    );
  }
}
