import { describe, it, expect } from 'vitest';
import { searchAniList } from '@/lib/providers/anilist';
import { searchOpenLibrary } from '@/lib/providers/openlibrary';

describe('Providers Live & Integration Tests', () => {
  it('AniList deve retornar animes/mangás para busca por Death Note', async () => {
    const results = await searchAniList('Death Note');
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title.toLowerCase()).toContain('death note');
    expect(['anime', 'manga']).toContain(results[0].type);
  });

  it('AniList deve filtrar especificamente por ANIME quando requisitado', async () => {
    const results = await searchAniList('Attack on Titan', 'ANIME');
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.type === 'anime')).toBe(true);
  });

  it('AniList deve filtrar especificamente por MANGA quando requisitado', async () => {
    const results = await searchAniList('Berserk', 'MANGA');
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.type === 'manga')).toBe(true);
  });

  it('OpenLibrary deve retornar livros para busca por Lord of the Rings', async () => {
    const results = await searchOpenLibrary('Lord of the Rings');
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('book');
  });
});
