import { describe, expect, it } from 'vitest';
import { parseSaveFile, SAVE_FILE_VERSION } from '@/lib/save-file';

describe('OmniLog save files', () => {
  it('validates and normalizes the current save format', () => {
    const parsed = parseSaveFile({
      app: 'OmniLog',
      version: SAVE_FILE_VERSION,
      exportedAt: '2026-10-12T12:00:00.000Z',
      groups: [{ id: 3, name: 'Favoritos', createdAt: '2026-10-01T00:00:00.000Z' }],
      items: [
        {
          id: 8,
          mediaId: 8,
          status: 'completed',
          rating: 9,
          review: 'Ótimo',
          addedAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-02T00:00:00.000Z',
          media: {
            source: 'anilist',
            externalId: '123',
            type: 'anime',
            title: 'Death Note',
            year: 2006,
            coverUrl: null,
            metadata: { episodes: 37 },
          },
          groups: [{ id: 3, name: 'Favoritos', createdAt: '2026-10-01T00:00:00.000Z' }],
        },
      ],
    });

    expect(parsed.version).toBe(2);
    expect(parsed.items[0].media.title).toBe('Death Note');
    expect(parsed.items[0].groups?.[0].name).toBe('Favoritos');
    expect(parsed.items[0].media.metadata).toEqual({ episodes: 37 });
  });

  it('migrates version 1 database backups to the current format', () => {
    const parsed = parseSaveFile({
      version: 1,
      appName: 'OmniLog',
      exportedAt: '2025-10-12T12:00:00.000Z',
      data: {
        media: [
          {
            id: 4,
            source: 'igdb',
            externalId: 'game-1',
            type: 'game',
            title: 'Jogo antigo',
            metadata: '{"playtime":{"mainStoryHours":12}}',
            fetchedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
        libraryItems: [
          {
            id: 10,
            mediaId: 4,
            status: 'in_progress',
            rating: null,
            review: null,
            addedAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-02T00:00:00.000Z',
          },
        ],
        groups: [
          { id: 2, name: 'Retomar', createdAt: '2025-01-01T00:00:00.000Z' },
        ],
        libraryItemGroups: [{ libraryItemId: 10, groupId: 2 }],
      },
    });

    expect(parsed.version).toBe(2);
    expect(parsed.items[0].media.metadata).toEqual({
      playtime: { mainStoryHours: 12 },
    });
    expect(parsed.items[0].groups?.map((group) => group.name)).toEqual(['Retomar']);
  });

  it('rejects invalid media and rating data', () => {
    expect(() =>
      parseSaveFile({
        app: 'OmniLog',
        version: 2,
        groups: [],
        items: [
          {
            status: 'completed',
            rating: 15,
            media: {
              source: 'unknown',
              externalId: 'bad',
              type: 'game',
              title: 'Inválido',
            },
          },
        ],
      })
    ).toThrow('Arquivo de save inválido ou incompatível com o OmniLog.');
  });
});
