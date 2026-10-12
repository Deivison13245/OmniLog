import { MediaItem } from '../types';
import { anilistLimiter } from '../rate-limit';

interface AniListMedia {
  id: number;
  type: 'ANIME' | 'MANGA';
  title: {
    romaji?: string;
    english?: string;
    native?: string;
  };
  startDate?: {
    year?: number;
  };
  coverImage?: {
    large?: string;
    medium?: string;
  };
  description?: string;
  genres?: string[];
  averageScore?: number;
  episodes?: number | null;
  duration?: number | null; // duração do episódio em minutos
  chapters?: number | null;
  volumes?: number | null;
}

const GRAPHQL_QUERY = `
query ($search: String, $type: MediaType) {
  Page(page: 1, perPage: 12) {
    media(search: $search, type: $type, sort: POPULARITY_DESC) {
      id
      type
      title {
        romaji
        english
        native
      }
      startDate {
        year
      }
      coverImage {
        large
        medium
      }
      description
      genres
      averageScore
      episodes
      duration
      chapters
      volumes
    }
  }
}
`;

export async function searchAniList(query: string, mediaType?: 'ANIME' | 'MANGA'): Promise<MediaItem[]> {
  return anilistLimiter(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const variables: { search: string; type?: string } = { search: query };
      if (mediaType) {
        variables.type = mediaType;
      }

      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query: GRAPHQL_QUERY,
          variables,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`AniList returned status ${response.status}`);
      }

      const json = await response.json();
      const mediaList: AniListMedia[] = json?.data?.Page?.media || [];

      return mediaList.map((item): MediaItem => {
        const title = item.title.english || item.title.romaji || item.title.native || 'Sem título';
        const type = item.type === 'ANIME' ? 'anime' : 'manga';

        return {
          source: 'anilist',
          externalId: item.id.toString(),
          type,
          title,
          year: item.startDate?.year || null,
          coverUrl: item.coverImage?.large || item.coverImage?.medium || null,
          metadata: {
            description: item.description,
            genres: item.genres,
            averageScore: item.averageScore,
            episodes: item.episodes ?? null,
            duration: item.duration ?? null,
            chapters: item.chapters ?? null,
            volumes: item.volumes ?? null,
          },
        };
      });
    } finally {
      clearTimeout(timeout);
    }
  });
}
