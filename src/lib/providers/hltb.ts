import { booksLimiter } from '../rate-limit';

interface HLTBGameResult {
  game_id: number;
  game_name: string;
  comp_main: number; // segundos
  comp_plus: number; // segundos
  comp_100: number;  // segundos
}

export interface PlaytimeInfo {
  mainStoryHours?: number | null;
  mainExtraHours?: number | null;
  completionistHours?: number | null;
}

/**
 * Busca estatísticas de tempo de jogo via API HowLongToBeat
 */
export async function fetchHLTBPlaytime(gameTitle: string): Promise<PlaytimeInfo | null> {
  return booksLimiter(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      // Endpoint de busca pública do HLTB
      const response = await fetch('https://howlongtobeat.com/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://howlongtobeat.com/',
        },
        body: JSON.stringify({
          searchType: 'games',
          searchTerms: gameTitle.split(' '),
          searchPage: 1,
          size: 5,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) return null;

      const data = await response.json();
      const list: HLTBGameResult[] = data?.data || [];
      if (!list.length) return null;

      // Pegar o primeiro resultado mais relevante
      const match = list[0];
      const toHours = (secs: number) => (secs > 0 ? Math.round(secs / 3600) : null);

      return {
        mainStoryHours: toHours(match.comp_main),
        mainExtraHours: toHours(match.comp_plus),
        completionistHours: toHours(match.comp_100),
      };
    } catch {
      // HLTB com proteções eventuais ou timeout não deve quebrar a busca
      return null;
    }
  });
}
