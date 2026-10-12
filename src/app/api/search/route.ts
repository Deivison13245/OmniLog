import { NextRequest, NextResponse } from 'next/server';
import { orchestrateSearch } from '@/lib/search';
import { SearchFilter } from '@/lib/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const filter = (searchParams.get('filter') || 'all') as SearchFilter;

  if (!q || !q.trim()) {
    return NextResponse.json({ items: [], failedSources: [] });
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
