import { booksLimiter } from '../rate-limit';
import type { TimeToBeat } from '../types';

interface HLTBGameResult {
  game_id: number;
  game_name: string;
  comp_main: number; // segundos
  comp_plus: number; // segundos
  comp_100: number;  // segundos
  comp_all?: number; // segundos
}

export interface PlaytimeInfo {
  mainStoryHours?: number | null;
  mainExtraHours?: number | null;
  completionistHours?: number | null;
}

// Disjuntor (Circuit Breaker) após 3 falhas consecutivas (RF-H7)
let consecutiveFailures = 0;
let circuitOpenUntil = 0;

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  const s2 = str2.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    return 0.85 + 0.15 * (minLen / maxLen);
  }

  // Bigramas para similaridade Dice
  const pairs1 = new Set<string>();
  for (let i = 0; i < s1.length - 1; i++) pairs1.add(s1.substring(i, i + 2));
  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    if (pairs1.has(s2.substring(i, i + 2))) intersection++;
  }
  const total = (s1.length - 1) + (s2.length - 1);
  return total > 0 ? (2.0 * intersection) / total : 0;
}

const secondsToHours = (secs?: number): number | undefined => {
  if (!secs || secs <= 0) return undefined;
  const hours = secs / 3600;
  // Arredonda para 1 casa decimal
  return Math.round(hours * 10) / 10;
};

/**
 * Busca dados completos de tempo de jogo no HowLongToBeat (RF-H1 a RF-H7)
 */
export async function fetchHLTBTimeToBeat(
  gameTitle: string,
  overrideId?: number
): Promise<TimeToBeat | null> {
  // RF-H6: Ativação por variável de ambiente
  if (process.env.HLTB_ENABLED === 'false') {
    return null;
  }

  // Verificar disjuntor
  if (Date.now() < circuitOpenUntil) {
    return null;
  }

  return booksLimiter(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      const terms = gameTitle.replace(/[^a-zA-Z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);

      const response = await fetch('https://howlongtobeat.com/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OmniLog/1.0',
          Referer: 'https://howlongtobeat.com/',
        },
        body: JSON.stringify({
          searchType: 'games',
          searchTerms: terms,
          searchPage: 1,
          size: 10,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        consecutiveFailures++;
        if (consecutiveFailures >= 3) {
          circuitOpenUntil = Date.now() + 60 * 60 * 1000; // 1 hora de pausa (RF-H7)
        }
        return null;
      }

      const data = await response.json();
      const list: HLTBGameResult[] = data?.data || [];
      if (!list.length) return null;

      // Reseta falhas consecutivas ao ter resposta bem-sucedida
      consecutiveFailures = 0;

      let chosen: HLTBGameResult | undefined;

      if (overrideId) {
        chosen = list.find((g) => g.game_id === overrideId);
      }

      if (!chosen) {
        // Encontrar o jogo com similaridade >= 0.85
        let bestScore = 0;
        let bestMatch: HLTBGameResult | undefined;

        for (const item of list) {
          const score = calculateSimilarity(gameTitle, item.game_name);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = item;
          }
        }

        if (bestScore >= 0.85 && bestMatch) {
          chosen = bestMatch;
        }
      }

      if (!chosen) return null;

      const mainStory = secondsToHours(chosen.comp_main);
      const mainPlusExtras = secondsToHours(chosen.comp_plus);
      const completionist = secondsToHours(chosen.comp_100);
      const allStyles = secondsToHours(chosen.comp_all);

      return {
        source: 'hltb',
        sourceId: chosen.game_id.toString(),
        sourceUrl: `https://howlongtobeat.com/game/${chosen.game_id}`,
        fetchedAt: new Date().toISOString(),
        mainStory,
        mainPlusExtras,
        completionist,
        allStyles,
      };
    } catch {
      consecutiveFailures++;
      if (consecutiveFailures >= 3) {
        circuitOpenUntil = Date.now() + 60 * 60 * 1000;
      }
      return null;
    }
  });
}

/**
 * Legado / compatibilidade para cards de busca
 */
export async function fetchHLTBPlaytime(gameTitle: string): Promise<PlaytimeInfo | null> {
  const result = await fetchHLTBTimeToBeat(gameTitle);
  if (!result) return null;
  return {
    mainStoryHours: result.mainStory ? Math.round(result.mainStory) : null,
    mainExtraHours: result.mainPlusExtras ? Math.round(result.mainPlusExtras) : null,
    completionistHours: result.completionist ? Math.round(result.completionist) : null,
  };
}
