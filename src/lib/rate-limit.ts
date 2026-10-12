import pLimit from 'p-limit';

// IGDB: limite de 4 req/segundo
export const igdbLimiter = pLimit(4);

// TMDB: tolerante, limite de segurança 10 concorrentes
export const tmdbLimiter = pLimit(10);

// AniList: até 90 req/min
export const anilistLimiter = pLimit(3);

// OpenLibrary / GoogleBooks
export const booksLimiter = pLimit(5);
