import { MediaItem } from '../types';
import { tmdbLimiter } from '../rate-limit';

interface TMDBResult {
  id: number;
  media_type: 'movie' | 'tv';
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
