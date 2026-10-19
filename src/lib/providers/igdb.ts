import type { MediaDetails, MediaItem, RelatedWork, TimeToBeat } from '../types';
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

  try {
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
  } catch {
    return null;
  }
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

/**
 * Busca detalhes completos do jogo no IGDB (plataformas, franquias, coleções, etc.)
 */
export async function fetchIGDBDetails(id: string): Promise<Partial<MediaDetails> | null> {
  const clientId = process.env.IGDB_CLIENT_ID;
  const token = await getTwitchToken();
  if (!clientId || !token) return null;

  return igdbLimiter(async () => {
    try {
      const query = `
        where id = ${id};
        fields name, summary, genres.name,
               platforms.name, platforms.platform_family.name,
               release_dates.date, release_dates.platform.name,
               franchises.name, collection.name,
               game_time_to_beats.hastly, game_time_to_beats.normally, game_time_to_beats.completely;
        limit 1;
      `;

      const res = await fetch('https://api.igdb.com/v4/games', {
        method: 'POST',
        headers: {
          'Client-ID': clientId,
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: query,
      });

      if (!res.ok) return null;
      const games = await res.json();
      if (!games.length) return null;

      const game = games[0];
      const genres = Array.isArray(game.genres) ? game.genres.map((g: { name: string }) => g.name) : [];

      // Plataformas agrupadas por família / fabricante
      const platforms: MediaDetails['platforms'] = [];
      if (Array.isArray(game.platforms)) {
        for (const p of game.platforms) {
          let family = 'Outros';
          const pName: string = p.name || '';
          if (pName.includes('PlayStation') || pName.includes('PS')) family = 'Sony PlayStation';
          else if (pName.includes('Xbox')) family = 'Microsoft Xbox';
          else if (pName.includes('Nintendo') || pName.includes('Switch') || pName.includes('Wii') || pName.includes('DS') || pName.includes('Game Boy')) family = 'Nintendo';
          else if (pName.includes('PC') || pName.includes('Windows') || pName.includes('Mac') || pName.includes('Linux')) family = 'PC / Computador';
          else if (pName.includes('iOS') || pName.includes('Android')) family = 'Mobile';

          platforms.push({
            id: p.id,
            name: p.name,
            family,
          });
        }
      }

      // Franquia e Coleção
      let franchise: MediaDetails['franchise'] | undefined;
      if (Array.isArray(game.franchises) && game.franchises.length > 0) {
        franchise = { id: game.franchises[0].id, name: game.franchises[0].name };
      }

      let collection: MediaDetails['collection'] | undefined;
      if (game.collection?.id) {
        // Buscar outros jogos da mesma coleção
        try {
          const colQuery = `
            where collection = ${game.collection.id};
            fields name, first_release_date, cover.image_id;
            sort first_release_date asc;
            limit 20;
          `;
          const colRes = await fetch('https://api.igdb.com/v4/games', {
            method: 'POST',
            headers: { 'Client-ID': clientId, Authorization: `Bearer ${token}` },
            body: colQuery,
          });
          if (colRes.ok) {
            const colGames = await colRes.json();
            const works: RelatedWork[] = colGames.map((cg: IGDBGame) => ({
              source: 'igdb',
              externalId: cg.id.toString(),
              type: 'game',
              title: cg.name,
              year: cg.first_release_date ? new Date(cg.first_release_date * 1000).getFullYear() : null,
              coverUrl: cg.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${cg.cover.image_id}.jpg` : null,
            }));
            collection = {
              id: game.collection.id,
              name: game.collection.name,
              works,
            };
          }
        } catch (err) {
          console.warn('Erro ao carregar coleção IGDB:', err);
        }
      }

      // Tempo de jogo oficial IGDB (game_time_to_beats) - RF-H2
      let timeToBeat: TimeToBeat | undefined;
      if (game.game_time_to_beats && game.game_time_to_beats.length > 0) {
        const tb = game.game_time_to_beats[0];
        const secToHour = (s?: number) => (s && s > 0 ? Math.round((s / 3600) * 10) / 10 : undefined);
        timeToBeat = {
          source: 'igdb',
          fetchedAt: new Date().toISOString(),
          rushed: secToHour(tb.hastly),
          normal: secToHour(tb.normally),
          complete: secToHour(tb.completely),
          mainStory: secToHour(tb.normally),
          completionist: secToHour(tb.completely),
        };
      }

      return {
        synopsis: game.summary,
        genres,
        platforms,
        franchise,
        collection,
        timeToBeat,
      };
    } catch {
      return null;
    }
  });
}

/**
 * Busca jogos em alta ou similares no IGDB (RF-D7)
 */
export async function fetchIGDBDiscover(
  kind: 'trending' | 'similar',
  id?: string
): Promise<MediaItem[]> {
  const clientId = process.env.IGDB_CLIENT_ID;
  const token = await getTwitchToken();
  if (!clientId || !token) return [];

  return igdbLimiter(async () => {
    try {
      let body = '';
      if (kind === 'trending') {
        const nowSec = Math.floor(Date.now() / 1000);
        const pastYearSec = nowSec - 365 * 24 * 3600;
        body = `
          where first_release_date > ${pastYearSec} & hypes > 2 & rating > 75;
          fields name, first_release_date, cover.image_id, summary, rating;
          sort hypes desc;
          limit 10;
        `;
      } else if (kind === 'similar' && id) {
        body = `
          where id = ${id};
          fields similar_games.name, similar_games.first_release_date, similar_games.cover.image_id, similar_games.summary, similar_games.rating;
          limit 1;
        `;
      } else {
        return [];
      }

      const res = await fetch('https://api.igdb.com/v4/games', {
        method: 'POST',
        headers: { 'Client-ID': clientId, Authorization: `Bearer ${token}` },
        body,
      });

      if (!res.ok) return [];
      const data = await res.json();

      let games: IGDBGame[] = [];
      if (kind === 'trending') {
        games = data;
      } else if (kind === 'similar' && data.length > 0) {
        games = data[0].similar_games || [];
      }

      return games.slice(0, 10).map((g) => ({
        source: 'igdb',
        externalId: g.id.toString(),
        type: 'game',
        title: g.name,
        year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null,
        coverUrl: g.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg` : null,
        metadata: { summary: g.summary, rating: g.rating },
      }));
    } catch {
      return [];
    }
  });
}
