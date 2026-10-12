import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { media, libraryItems, groups, libraryItemGroups } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const BackupSchema = z.object({
  version: z.number().optional(),
  appName: z.literal('OmniLog').optional(),
  data: z.object({
    media: z.array(
      z.object({
        source: z.string(),
        externalId: z.string(),
        type: z.string(),
        title: z.string(),
        year: z.number().nullable().optional(),
        coverUrl: z.string().nullable().optional(),
        metadata: z.string().nullable().optional(),
        fetchedAt: z.string(),
      })
    ),
    libraryItems: z.array(
      z.object({
        source: z.string().optional(),
        externalId: z.string().optional(),
        mediaId: z.number().optional(),
        status: z.enum(['backlog', 'in_progress', 'completed', 'dropped']),
        rating: z.number().nullable().optional(),
        review: z.string().nullable().optional(),
        addedAt: z.string(),
        updatedAt: z.string(),
      })
    ),
    groups: z.array(
      z.object({
        id: z.number().optional(),
        name: z.string(),
        description: z.string().nullable().optional(),
        color: z.string().nullable().optional(),
        createdAt: z.string(),
      })
    ).optional(),
    libraryItemGroups: z.array(
      z.object({
        libraryItemId: z.number(),
        groupId: z.number(),
      })
    ).optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const rawData = await request.json();
    const parsed = BackupSchema.safeParse(rawData);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Estrutura de arquivo de backup inválida', details: parsed.error },
        { status: 400 }
      );
    }

    const { media: backupMedia, libraryItems: backupItems, groups: backupGroups = [] } = parsed.data.data;

    // Mapa para mapear ID antigo de mídia para novo ID
    const mediaIdMap = new Map<number, number>();

    for (let i = 0; i < backupMedia.length; i++) {
      const m = backupMedia[i];
      const oldId = (m as { id?: number }).id ?? i + 1;

      const existing = await db
        .select({ id: media.id })
        .from(media)
        .where(
          and(
            eq(media.source, m.source as 'igdb' | 'tmdb' | 'anilist' | 'openlibrary' | 'googlebooks'),
            eq(media.externalId, m.externalId)
          )
        )
        .get();

      if (existing) {
        mediaIdMap.set(oldId, existing.id);
      } else {
        const inserted = await db
          .insert(media)
          .values({
            source: m.source as 'igdb' | 'tmdb' | 'anilist' | 'openlibrary' | 'googlebooks',
            externalId: m.externalId,
            type: m.type as 'game' | 'movie' | 'tv' | 'anime' | 'manga' | 'book',
            title: m.title,
            year: m.year ?? null,
            coverUrl: m.coverUrl ?? null,
            metadata: m.metadata ?? null,
            fetchedAt: m.fetchedAt,
          })
          .returning({ id: media.id });

        mediaIdMap.set(oldId, inserted[0].id);
      }
    }

    // Inserir ou atualizar libraryItems
    let importedItemsCount = 0;
    for (const item of backupItems) {
      const targetMediaId = item.mediaId ? mediaIdMap.get(item.mediaId) : undefined;
      if (!targetMediaId) continue;

      const existingLibItem = await db
        .select({ id: libraryItems.id })
        .from(libraryItems)
        .where(eq(libraryItems.mediaId, targetMediaId))
        .get();

      if (existingLibItem) {
        await db
          .update(libraryItems)
          .set({
            status: item.status,
            rating: item.rating ?? null,
            review: item.review ?? null,
            updatedAt: item.updatedAt,
          })
          .where(eq(libraryItems.id, existingLibItem.id));
      } else {
        await db.insert(libraryItems).values({
          mediaId: targetMediaId,
          status: item.status,
          rating: item.rating ?? null,
          review: item.review ?? null,
          addedAt: item.addedAt,
          updatedAt: item.updatedAt,
        });
        importedItemsCount++;
      }
    }

    // Inserir grupos se houver
    for (const g of backupGroups) {
      const existing = await db.select({ id: groups.id }).from(groups).where(eq(groups.name, g.name)).get();
      if (!existing) {
        await db.insert(groups).values({
          name: g.name,
          description: g.description ?? null,
          color: g.color ?? null,
          createdAt: g.createdAt,
        });
      }
    }

    return NextResponse.json({
      success: true,
      importedMedia: backupMedia.length,
      importedLibraryItems: importedItemsCount,
    });
  } catch (error) {
    console.error('Error importing backup:', error);
    return NextResponse.json({ error: 'Erro ao importar dados do backup' }, { status: 500 });
  }
}
