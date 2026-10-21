import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { orchestrateSearch } from '@/lib/search';
import type { AiRecommendedItem, MediaItem } from '@/lib/types';

// Validação da entrada da requisição
const profileItemSchema = z.object({
  title: z.string().min(1).max(150),
  type: z.enum(['game', 'movie', 'tv', 'anime', 'manga', 'book']),
  year: z.number().nullable().optional(),
  status: z.enum(['backlog', 'in_progress', 'completed', 'dropped']),
  rating: z.number().min(1).max(10).nullable().optional(),
  genres: z.array(z.string()).optional(),
});

const requestSchema = z.object({
  profile: z.array(profileItemSchema).min(5, 'Necessário pelo menos 5 itens para gerar recomendações precisas.').max(60),
  type: z.enum(['all', 'game', 'movie', 'tv', 'anime', 'manga', 'book']).default('all'),
  count: z.number().min(5).max(10).default(6),
  note: z.string().max(140).optional(),
  consent: z.boolean().refine((val) => val === true, {
    message: 'É necessário consentir com o processamento pela IA.',
  }),
  apiKey: z.string().optional(),
});

// Schema da resposta esperada do Gemini
const geminiItemSchema = z.object({
  title: z.string().min(1),
  type: z.enum(['game', 'movie', 'tv', 'anime', 'manga', 'book']),
  year: z.number().nullable().optional(),
  reason: z.string().max(180),
  basedOn: z.array(z.string()).min(1).max(3),
});

const geminiResponseSchema = z.array(geminiItemSchema);

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message || 'Entrada inválida.' } },
        { status: 400 }
      );
    }

    const { profile, type, count, note, apiKey: userKey } = parsed.data;

    // Chave de API: obtida via header, corpo da requisição ou variável de ambiente GEMINI_API_KEY
    const apiKey =
      request.headers.get('x-gemini-key') ||
      userKey ||
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: { code: 'NO_API_KEY', message: 'Chave da API Gemini não configurada.' } },
        { status: 500 }
      );
    }

    // Preparar lista da biblioteca para contexto da IA (sem resenhas!)
    const liked = profile
      .filter((i) => (i.rating && i.rating >= 8) || i.status === 'completed' || i.status === 'in_progress')
      .map((i) => `• ${i.title} (${i.type}, ${i.year || '?'}) - Nota: ${i.rating || 'Sem nota'} - Gêneros: ${i.genres?.join(', ') || 'N/A'}`)
      .slice(0, 30);

    const disliked = profile
      .filter((i) => i.status === 'dropped' || (i.rating && i.rating <= 5))
      .map((i) => `• ${i.title} (${i.type}) - ${i.status === 'dropped' ? 'Abandonado' : `Nota ${i.rating}`}`)
      .slice(0, 15);

    const existingTitles = new Set(profile.map((i) => i.title.toLowerCase().trim()));

    const targetTypeInstruction =
      type === 'all'
        ? 'Recomende uma mistura balanceada de mídias (jogos, filmes, animes, etc.)'
        : `Recomende estritamente mídias do tipo: "${type}"`;

    const userNoteInstruction = note ? `Preferência específica do usuário: "${note}".` : '';

    const prompt = `
Você é um curador especialista em entretenimento e cultura pop (jogos, filmes, séries, animes, mangás e livros) do OmniLog.
Sua missão é sugerir exatamente ${count} obras reais, excelentes e relevantes com base estritamente no perfil do usuário abaixo.

Mídias que o usuário mais gostou / completou:
${liked.join('\n') || 'Nenhuma informada com alta avaliação.'}

Mídias que o usuário não curtiu ou abandonou (evite estilo semelhante):
${disliked.join('\n') || 'Nenhuma abandonada.'}

Diretrizes:
1. ${targetTypeInstruction}
2. ${userNoteInstruction}
3. NÃO recomende nenhuma das obras já listadas no perfil do usuário.
4. Cada recomendação deve ter uma justificativa cativante em português do Brasil de até 160 caracteres.
5. Indique no campo "basedOn" de 1 a 3 títulos EXATOS presentes na lista de mídias que o usuário mais gostou acima que justificam essa recomendação.
6. Retorne APENAS um array JSON de objetos, sem formatação markdown ou explicações fora do JSON.

Formato do JSON:
[
  {
    "title": "Nome da Obra",
    "type": "game" | "movie" | "tv" | "anime" | "manga" | "book",
    "year": 2023,
    "reason": "Porque você gostou da atmosfera densa e narrativa envolvente...",
    "basedOn": ["Título do Perfil"]
  }
]
`.trim();

    const candidateModels = ['gemini-2.5-flash', 'gemini-1.5-flash'];
    let geminiResponse: Response | null = null;
    let selectedModel = candidateModels[0];

    for (const model of candidateModels) {
      selectedModel = model;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      try {
        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: 0.7,
            },
          }),
          signal: controller.signal,
        });

        if (res.ok) {
          geminiResponse = res;
          break;
        } else {
          const errText = await res.text();
          console.error(`Gemini Error on model ${model}:`, res.status, errText);
          if (res.status === 400 || res.status === 401 || res.status === 403) {
            let userMessage = `Erro de autorização com a API Gemini (${res.status}). Verifique a GEMINI_API_KEY.`;
            try {
              const parsedErr = JSON.parse(errText);
              if (parsedErr?.error?.message) {
                userMessage = `Gemini API: ${parsedErr.error.message}`;
              }
            } catch {
              // Mantém mensagem padrão
            }
            return NextResponse.json(
              { error: { code: 'AI_AUTH_ERROR', message: userMessage } },
              { status: 502 }
            );
          }
          if (res.status === 429) {
            return NextResponse.json(
              { error: { code: 'RATE_LIMIT', message: 'Cota de requisições do Gemini atingida. Aguarde um instante.' } },
              { status: 429 }
            );
          }
          // Se for 404 (modelo não encontrado) ou 503, tenta o próximo modelo
          if (res.status === 404 || res.status === 503) {
            continue;
          }
          return NextResponse.json(
            { error: { code: 'AI_ERROR', message: `Erro ao gerar recomendações com a IA (${res.status}).` } },
            { status: 502 }
          );
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    if (!geminiResponse || !geminiResponse.ok) {
      return NextResponse.json(
        { error: { code: 'AI_ERROR', message: 'Nenhum modelo Gemini compatível respondeu.' } },
        { status: 502 }
      );
    }

    const geminiData = await geminiResponse.json();
    const rawContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) {
      return NextResponse.json(
        { error: { code: 'EMPTY_RESPONSE', message: 'A IA não retornou recomendações.' } },
        { status: 502 }
      );
    }

    let parsedSuggestions: z.infer<typeof geminiResponseSchema>;
    try {
      const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedRaw = JSON.parse(cleanJson);
      parsedSuggestions = geminiResponseSchema.parse(parsedRaw);
    } catch (parseError) {
      console.error('Erro ao decodificar JSON do Gemini:', parseError, rawContent);
      return NextResponse.json(
        { error: { code: 'INVALID_AI_FORMAT', message: 'Formato de resposta inesperado da IA.' } },
        { status: 502 }
      );
    }

    // RF-I4: Verificação no catálogo (busca real no IGDB, TMDB, AniList, OpenLibrary)
    // Descartamos títulos inexistentes ou que já estejam na biblioteca!
    const verifiedItems: AiRecommendedItem[] = [];

    await Promise.all(
      parsedSuggestions.map(async (suggestion) => {
        const cleanTitle = suggestion.title.toLowerCase().trim();
        // Não incluir se já está na biblioteca
        if (existingTitles.has(cleanTitle)) return;

        try {
          const filterMap: Record<string, 'game' | 'video' | 'anime' | 'manga' | 'book'> = {
            game: 'game',
            movie: 'video',
            tv: 'video',
            anime: 'anime',
            manga: 'manga',
            book: 'book',
          };
          const searchFilter = filterMap[suggestion.type] || 'all';

          const searchResult = await orchestrateSearch(suggestion.title, searchFilter);
          if (searchResult.items && searchResult.items.length > 0) {
            // Pega o melhor resultado correspondente
            const matched = searchResult.items[0];

            // Formatação do motivo com base nos títulos indicados (RF-I10)
            const basedOnText =
              suggestion.basedOn && suggestion.basedOn.length > 0
                ? `Porque você curtiu ${suggestion.basedOn.join(' e ')}: `
                : '';

            verifiedItems.push({
              media: matched,
              reason: `${basedOnText}${suggestion.reason}`.slice(0, 200),
              basedOn: suggestion.basedOn,
            });
          }
        } catch (searchErr) {
          console.warn('Erro ao validar sugestão no catálogo:', suggestion.title, searchErr);
        }
      })
    );

    return NextResponse.json({
      items: verifiedItems,
      model: selectedModel,
      totalGenerated: parsedSuggestions.length,
      totalVerified: verifiedItems.length,
    });
  } catch (error: unknown) {
    console.error('Erro na rota /api/ai/recommend:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: { code: 'TIMEOUT', message: 'Tempo limite da IA excedido (30s). Tente novamente.' } },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ocorreu um erro ao processar as recomendações.' } },
      { status: 500 }
    );
  }
}
