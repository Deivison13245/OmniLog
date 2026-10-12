import { db } from '@/db';
import { media, libraryItems } from '@/db/schema';
import { MediaItem } from './types';
import { eq, and, sql, notInArray } from 'drizzle-orm';

const CACHE_TTL_DAYS = parseInt(process.env.CACHE_TTL_DAYS || '30', 10);

/**
 * Busca item no cache local por source e externalId
 */
export async function getCachedMedia(source: MediaItem['source'], externalId: string): Promise<MediaItem | null> {
  const result = await db
    .select()
    .from(media)
    .where(and(eq(media.source, source), eq(media.externalId, externalId)))
    .get();

  if (!result) return null;

  return {
    id: result.id,
    source: result.source,
    externalId: result.externalId,
    type: result.type,
    title: result.title,
    year: result.year,
    coverUrl: result.coverUrl,
    metadata: result.metadata ? JSON.parse(result.metadata) : undefined,
  };
}

/**
 * Salva ou atualiza itens de mídia no cache
 */
export async function saveMediaCache(item: MediaItem): Promise<number> {
  const now = new Date().toISOString();
  const metaStr = item.metadata ? JSON.stringify(item.metadata) : null;

  const existing = await db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.source, item.source), eq(media.externalId, item.externalId)))
    .get();

  if (existing) {
    await db
      .update(media)
      .set({
        title: item.title,
        year: item.year,
        coverUrl: item.coverUrl,
        metadata: metaStr,
        fetchedAt: now,
      })
      .where(eq(media.id, existing.id));
    return existing.id;
  }

  const inserted = await db
    .insert(media)
    .values({
      source: item.source,
      externalId: item.externalId,
      type: item.type,
      title: item.title,
      year: item.year,
      coverUrl: item.coverUrl,
      metadata: metaStr,
      fetchedAt: now,
    })
    .returning({ id: media.id });

  return inserted[0].id;
}

/**
 * Limpa itens do cache mais antigos que CACHE_TTL_DAYS que NÃO estejam na biblioteca
 */
export async function cleanExpiredCache(): Promise<void> {
  const cutoffDate = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Subquery de IDs na biblioteca
  const inLibrary = db.select({ mediaId: libraryItems.mediaId }).from(libraryItems);

  await db
    .delete(media)
    .where(
      and(
        sql`${media.fetchedAt} < ${cutoffDate}`,
        notInArray(media.id, inLibrary)
      )
    );
}
