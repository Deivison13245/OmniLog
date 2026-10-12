import { beforeEach, describe, expect, it, vi } from 'vitest';
import { orchestrateSearch } from '@/lib/search';
import { searchGoogleBooks } from '@/lib/providers/googlebooks';
import { searchOpenLibrary } from '@/lib/providers/openlibrary';

vi.mock('@/lib/providers/igdb', () => ({ searchIGDB: vi.fn() }));
vi.mock('@/lib/providers/tmdb', () => ({ searchTMDB: vi.fn() }));
vi.mock('@/lib/providers/anilist', () => ({ searchAniList: vi.fn() }));
vi.mock('@/lib/providers/openlibrary', () => ({ searchOpenLibrary: vi.fn() }));
vi.mock('@/lib/providers/googlebooks', () => ({ searchGoogleBooks: vi.fn() }));
vi.mock('@/lib/providers/hltb', () => ({ fetchHLTBPlaytime: vi.fn() }));

describe('book search fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports both providers when Open Library and Google Books fail', async () => {
    vi.mocked(searchOpenLibrary).mockRejectedValue(new Error('Open Library unavailable'));
    vi.mocked(searchGoogleBooks).mockRejectedValue(new Error('Google Books unavailable'));

    const result = await orchestrateSearch('Dune', 'book');

    expect(result.failedSources).toEqual(['openlibrary', 'googlebooks']);
    expect(result.items).toEqual([]);
  });

  it('reports only Google Books when Open Library succeeds without results', async () => {
    vi.mocked(searchOpenLibrary).mockResolvedValue([]);
    vi.mocked(searchGoogleBooks).mockRejectedValue(new Error('Google Books unavailable'));

    const result = await orchestrateSearch('Dune', 'book');

    expect(result.failedSources).toEqual(['googlebooks']);
    expect(result.items).toEqual([]);
  });
});
