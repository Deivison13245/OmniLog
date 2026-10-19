import type { MediaDetails, MediaItem, RelatedWork, StreamingProvider } from '../types';
import { tmdbLimiter } from '../rate-limit';

interface TMDBResult {
  id: number;
  media_type?: 'movie' | 'tv';
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
  vote_average?: number;
}

interface TMDBTvDetail {
  number_of_seasons?: number;
  number_of_episodes?: number;
  episode_run_time?: number[];
}

interface TMDBMovieDetail {
  runtime?: number; // minutos
}

async function fetchTvDetails(id: number, token: string): Promise<TMDBTvDetail | null> {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/tv/${id}?language=pt-BR`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchMovieDetail(id: number, token: string): Promise<TMDBMovieDetail | null> {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/movie/${id}?language=pt-BR`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function searchTMDB(query: string): Promise<MediaItem[]> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) {
    throw new Error('TMDB_READ_TOKEN não está configurado.');
  }

  return tmdbLimiter(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const url = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&include_adult=false&language=pt-BR&page=1`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`TMDB error status ${response.status}`);
      }

      const data = await response.json();
      const results: TMDBResult[] = (data?.results || []).filter(
        (r: TMDBResult) => r.media_type === 'movie' || r.media_type === 'tv'
      );

      const items = await Promise.all(
        results.slice(0, 12).map(async (item): Promise<MediaItem> => {
          const title = item.title || item.name || 'Sem título';
          const dateStr = item.release_date || item.first_air_date;
          let year: number | null = null;
          if (dateStr) {
            const parsed = parseInt(dateStr.substring(0, 4), 10);
            if (!isNaN(parsed)) year = parsed;
          }

          const coverUrl = item.poster_path
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
            : null;

          const isTv = item.media_type === 'tv';
          let seasons: number | null = null;
          let episodes: number | null = null;
          let runtime: number | null = null;

          if (isTv) {
            const tvDetail = await fetchTvDetails(item.id, token);
            if (tvDetail) {
              seasons = tvDetail.number_of_seasons ?? null;
              episodes = tvDetail.number_of_episodes ?? null;
              if (tvDetail.episode_run_time && tvDetail.episode_run_time.length > 0) {
                runtime = tvDetail.episode_run_time[0];
              }
            }
          } else {
            const movieDetail = await fetchMovieDetail(item.id, token);
            if (movieDetail) {
              runtime = movieDetail.runtime ?? null;
            }
          }

          return {
            source: 'tmdb',
            externalId: item.id.toString(),
            type: isTv ? 'tv' : 'movie',
            title,
            year,
            coverUrl,
            metadata: {
              overview: item.overview,
              rating: item.vote_average,
              seasons,
              episodes,
              runtime,
            },
          };
        })
      );

      return items;
    } finally {
      clearTimeout(timeout);
    }
  });
}

/**
 * Busca detalhes enriquecidos da obra no TMDB (RF-T2, RF-T5, RF-T6)
 */
export async function fetchTMDBDetails(
  id: string,
  type: 'movie' | 'tv',
  region = 'BR'
): Promise<Partial<MediaDetails> | null> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) return null;

  return tmdbLimiter(async () => {
    try {
      const url = `https://api.themoviedb.org/3/${type}/${id}?append_to_response=watch/providers&language=pt-BR`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (!res.ok) return null;

      const data = await res.json();
      const genres = Array.isArray(data.genres)
        ? data.genres.map((g: { name: string }) => g.name)
        : [];

      // Provedores de Streaming por JustWatch
      const providersData = data['watch/providers']?.results?.[region];
      let streaming: MediaDetails['streaming'] | undefined;

      if (providersData) {
        const mapProvider = (p: { provider_id: number; provider_name: string; logo_path?: string }): StreamingProvider => ({
          id: p.provider_id,
          name: p.provider_name,
          logoPath: p.logo_path ? `https://image.tmdb.org/t/p/original${p.logo_path}` : undefined,
        });

        streaming = {
          region,
          fetchedAt: new Date().toISOString(),
          tmdbLink: providersData.link,
          flatrate: (providersData.flatrate || []).map(mapProvider),
          rent: (providersData.rent || []).map(mapProvider),
          buy: (providersData.buy || []).map(mapProvider),
        };
      }

      // Coleção de Filmes
      let collection: MediaDetails['collection'] | undefined;
      if (type === 'movie' && data.belongs_to_collection?.id) {
        try {
          const colRes = await fetch(
            `https://api.themoviedb.org/3/collection/${data.belongs_to_collection.id}?language=pt-BR`,
            { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
          );
          if (colRes.ok) {
            const colData = await colRes.json();
            const parts: RelatedWork[] = (colData.parts || []).map(
              (p: { id: number; title: string; release_date?: string; poster_path?: string }) => ({
                source: 'tmdb',
                externalId: p.id.toString(),
                type: 'movie',
                title: p.title,
                year: p.release_date ? parseInt(p.release_date.substring(0, 4), 10) : null,
                coverUrl: p.poster_path ? `https://image.tmdb.org/t/p/w500${p.poster_path}` : null,
              })
            );
            parts.sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

            collection = {
              id: data.belongs_to_collection.id,
              name: data.belongs_to_collection.name,
              works: parts,
            };
          }
        } catch (err) {
          console.warn('Erro ao carregar coleção TMDB:', err);
        }
      }

      return {
        synopsis: data.overview || undefined,
        genres,
        streaming,
        collection,
      };
    } catch {
      return null;
    }
  });
}

/**
 * Busca obras em alta ou similares no TMDB (RF-D7)
 */
export async function fetchTMDBDiscover(
  kind: 'trending' | 'similar',
  type: 'movie' | 'tv',
  id?: string
): Promise<MediaItem[]> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) return [];

  return tmdbLimiter(async () => {
    try {
      let url = '';
      if (kind === 'trending') {
        url = `https://api.themoviedb.org/3/trending/${type}/week?language=pt-BR`;
      } else if (kind === 'similar' && id) {
        url = `https://api.themoviedb.org/3/${type}/${id}/recommendations?language=pt-BR&page=1`;
      } else {
        return [];
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (!res.ok) return [];

      const data = await res.json();
      const results: TMDBResult[] = data.results || [];

      return results.slice(0, 10).map((item) => {
        const title = item.title || item.name || 'Sem título';
        const dateStr = item.release_date || item.first_air_date;
        let year: number | null = null;
        if (dateStr) {
          const parsed = parseInt(dateStr.substring(0, 4), 10);
          if (!isNaN(parsed)) year = parsed;
        }

        return {
          source: 'tmdb',
          externalId: item.id.toString(),
          type,
          title,
          year,
          coverUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
          metadata: {
            overview: item.overview,
            rating: item.vote_average,
          },
        };
      });
    } catch {
      return [];
    }
  });
}
