import type { MediaDetails, MediaItem, RelatedWork } from '../types';
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
  duration?: number | null;
  chapters?: number | null;
  volumes?: number | null;
}

const GRAPHQL_SEARCH = `
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

const GRAPHQL_DETAILS = `
query ($id: Int, $type: MediaType) {
  Media(id: $id, type: $type) {
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
      extraLarge
    }
    description
    genres
    averageScore
    episodes
    duration
    chapters
    volumes
    externalLinks {
      site
      url
      type
    }
    relations {
      edges {
        relationType
        node {
          id
          type
          title {
            romaji
            english
          }
          startDate {
            year
          }
          coverImage {
            large
          }
        }
      }
    }
  }
}
`;

const GRAPHQL_DISCOVER = `
query ($type: MediaType, $sort: [MediaSort]) {
  Page(page: 1, perPage: 10) {
    media(type: $type, sort: $sort) {
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
      }
      description
      genres
      averageScore
    }
  }
}
`;

function stripHtml(html?: string): string | undefined {
  if (!html) return undefined;
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
}

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
          query: GRAPHQL_SEARCH,
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
            description: stripHtml(item.description),
            genres: item.genres,
            averageScore: item.averageScore,
            episodes: item.episodes,
            duration: item.duration,
            chapters: item.chapters,
            volumes: item.volumes,
          },
        };
      });
    } finally {
      clearTimeout(timeout);
    }
  });
}

/**
 * Busca detalhes com relações e links de streaming do AniList (RF-T3, RF-T5)
 */
export async function fetchAniListDetails(
  id: string,
  type: 'anime' | 'manga'
): Promise<Partial<MediaDetails> | null> {
  return anilistLimiter(async () => {
    try {
      const anilistType = type === 'anime' ? 'ANIME' : 'MANGA';
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          query: GRAPHQL_DETAILS,
          variables: { id: parseInt(id, 10), type: anilistType },
        }),
      });

      if (!response.ok) return null;
      const json = await response.json();
      const m = json?.data?.Media;
      if (!m) return null;

      // Links externos (streaming / leitura oficiais) - RF-T3
      const externalLinks = Array.isArray(m.externalLinks)
        ? m.externalLinks
            .filter((l: { url: string; site: string }) => l.url && l.site)
            .map((l: { site: string; url: string }) => ({ site: l.site, url: l.url }))
        : [];

      // Relações (sequência, prequela, história paralela, adaptação) - RF-T5
      const relations: MediaDetails['relations'] = [];
      if (m.relations?.edges && Array.isArray(m.relations.edges)) {
        for (const edge of m.relations.edges) {
          const node = edge.node;
          if (!node) continue;
          const relTitle = node.title?.english || node.title?.romaji || 'Obra Relacionada';
          const relType = node.type === 'ANIME' ? 'anime' : 'manga';

          relations.push({
            type: edge.relationType,
            work: {
              source: 'anilist',
              externalId: node.id.toString(),
              type: relType,
              title: relTitle,
              year: node.startDate?.year ?? null,
              coverUrl: node.coverImage?.large ?? null,
            },
          });
        }
      }

      return {
        synopsis: stripHtml(m.description),
        genres: m.genres || [],
        coverUrl: m.coverImage?.extraLarge || m.coverImage?.large || undefined,
        year: m.startDate?.year || undefined,
        title: m.title?.english || m.title?.romaji || m.title?.native || undefined,
        externalLinks: externalLinks.length > 0 ? externalLinks : undefined,
        relations: relations.length > 0 ? relations : undefined,
      };
    } catch {
      return null;
    }
  });
}

/**
 * Busca animes ou mangás em alta (RF-D7)
 */
export async function fetchAniListDiscover(
  kind: 'trending' | 'similar',
  type: 'anime' | 'manga'
): Promise<MediaItem[]> {
  return anilistLimiter(async () => {
    try {
      const anilistType = type === 'anime' ? 'ANIME' : 'MANGA';
      const sort = kind === 'trending' ? ['TRENDING_DESC'] : ['SCORE_DESC'];

      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          query: GRAPHQL_DISCOVER,
          variables: { type: anilistType, sort },
        }),
      });

      if (!response.ok) return [];
      const json = await response.json();
      const list: AniListMedia[] = json?.data?.Page?.media || [];

      return list.map((item) => ({
        source: 'anilist',
        externalId: item.id.toString(),
        type,
        title: item.title.english || item.title.romaji || 'Sem título',
        year: item.startDate?.year || null,
        coverUrl: item.coverImage?.large || null,
        metadata: {
          description: stripHtml(item.description),
          genres: item.genres,
          averageScore: item.averageScore,
        },
      }));
    } catch {
      return [];
    }
  });
}
