import { MediaItem } from '../types';
import { igdbLimiter } from '../rate-limit';

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

async function getTwitchToken(): Promise<string | null> {
  const clientId = process.env.IGDB_CLIENT_ID;
  const clientSecret = process.env.IGDB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  if (cachedAccessToken && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: 'POST' }
  );

  if (!res.ok) {
    console.error('Failed to obtain Twitch OAuth token for IGDB');
    return null;
  }

  const data = await res.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
  return cachedAccessToken;
}

interface IGDBGame {
  id: number;
  name: string;
  first_release_date?: number;
  cover?: {
    image_id: string;
  };
  summary?: string;
  rating?: number;
}

export async function searchIGDB(query: string): Promise<MediaItem[]> {
  const clientId = process.env.IGDB_CLIENT_ID;
  if (!clientId) {
    throw new Error('IGDB_CLIENT_ID não está configurado.');
  }

  const token = await getTwitchToken();
  if (!token) {
    throw new Error('Não foi possível obter token de acesso para o IGDB (verifique IGDB_CLIENT_ID e IGDB_CLIENT_SECRET).');
  }

  return igdbLimiter(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const sanitized = query.replace(/"/g, '\\"');
      const body = `search "${sanitized}"; fields name, first_release_date, cover.image_id, summary, rating; limit 12;`;

      const response = await fetch('https://api.igdb.com/v4/games', {
        method: 'POST',
        headers: {
          'Client-ID': clientId,
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`IGDB returned status ${response.status}`);
      }

      const games: IGDBGame[] = await response.json();

      return games.map((game): MediaItem => {
        let year: number | null = null;
        if (game.first_release_date) {
          year = new Date(game.first_release_date * 1000).getFullYear();
        }

        const coverUrl = game.cover?.image_id
          ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
          : null;

        return {
          source: 'igdb',
          externalId: game.id.toString(),
          type: 'game',
          title: game.name,
          year,
          coverUrl,
          metadata: {
            summary: game.summary,
            rating: game.rating,
          },
        };
      });
    } finally {
      clearTimeout(timeout);
    }
  });
}
