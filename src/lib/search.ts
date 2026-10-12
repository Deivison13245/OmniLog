import { MediaItem, MediaSource, SearchFilter, SearchResponse } from './types';
import { searchIGDB } from './providers/igdb';
import { searchTMDB } from './providers/tmdb';
import { searchAniList } from './providers/anilist';
import { searchOpenLibrary } from './providers/openlibrary';
import { searchGoogleBooks } from './providers/googlebooks';
import { fetchHLTBPlaytime } from './providers/hltb';

export async function orchestrateSearch(query: string, filter: SearchFilter = 'all'): Promise<SearchResponse> {
  const items: MediaItem[] = [];
  const failedSources: MediaSource[] = [];

  const tasks: Promise<void>[] = [];

  // 1. Jogos (IGDB) + Enriquecimento HowLongToBeat
  if (filter === 'all' || filter === 'game') {
    tasks.push(
      searchIGDB(query)
        .then(async (res) => {
          // Enriquecer jogos com tempo estimado de zeramento (HowLongToBeat)
          const enriched = await Promise.all(
            res.map(async (game) => {
              const hltb = await fetchHLTBPlaytime(game.title);
              if (hltb && (hltb.mainStoryHours || hltb.completionistHours)) {
                return {
                  ...game,
                  metadata: {
                    ...game.metadata,
                    playtime: hltb,
                  },
                };
              }
              return game;
            })
          );
          items.push(...enriched);
        })
        .catch((err) => {
          console.error('Error querying IGDB:', err);
          failedSources.push('igdb');
        })
    );
  }

  // 2. Filmes / Séries (TMDB)
  if (filter === 'all' || filter === 'video') {
    tasks.push(
      searchTMDB(query)
        .then((res) => {
          items.push(...res);
        })
        .catch((err) => {
          console.error('Error querying TMDB:', err);
          failedSources.push('tmdb');
        })
    );
  }

  // 3. Animes (AniList)
  if (filter === 'all' || filter === 'anime') {
    tasks.push(
      searchAniList(query, filter === 'anime' ? 'ANIME' : undefined)
        .then((res) => {
          items.push(...(filter === 'anime' ? res.filter((r) => r.type === 'anime') : res));
        })
        .catch((err) => {
          console.error('Error querying AniList for Anime:', err);
          failedSources.push('anilist');
        })
    );
  }

  // 4. Mangás (AniList)
  if (filter === 'manga') {
    tasks.push(
      searchAniList(query, 'MANGA')
        .then((res) => {
          items.push(...res.filter((r) => r.type === 'manga'));
        })
        .catch((err) => {
          console.error('Error querying AniList for Manga:', err);
          failedSources.push('anilist');
        })
    );
  }

  // 5. Livros (Open Library com fallback para Google Books)
  if (filter === 'all' || filter === 'book') {
    tasks.push(
      (async () => {
        try {
          const openLibraryResults = await searchOpenLibrary(query);
          if (openLibraryResults.length > 0) {
            items.push(...openLibraryResults);
            return;
          }
          // Fallback para Google Books se Open Library vier vazio
          const googleBooksResults = await searchGoogleBooks(query);
          items.push(...googleBooksResults);
        } catch (openLibErr) {
          console.warn('OpenLibrary failed, trying Google Books fallback:', openLibErr);
          try {
            const googleBooksResults = await searchGoogleBooks(query);
            items.push(...googleBooksResults);
          } catch (googleErr) {
            console.error('Google Books also failed:', googleErr);
            failedSources.push('openlibrary');
          }
        }
      })()
    );
  }

  await Promise.allSettled(tasks);

  return {
    items,
    failedSources,
  };
}
