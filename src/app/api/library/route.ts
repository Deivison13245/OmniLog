import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { media, libraryItems, groups, libraryItemGroups } from '@/db/schema';
import { eq, desc, asc, inArray } from 'drizzle-orm';
import { saveMediaCache } from '@/lib/cache';
import { MediaItem, LibraryStatus, MediaType } from '@/lib/types';
import { z } from 'zod';

const AddItemSchema = z.object({
  source: z.enum(['igdb', 'tmdb', 'anilist', 'openlibrary', 'googlebooks']),
  externalId: z.string().min(1),
  type: z.enum(['game', 'movie', 'tv', 'anime', 'manga', 'book']),
  title: z.string().min(1),
  year: z.number().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as LibraryStatus | null;
    const type = searchParams.get('type') as MediaType | null;
    const groupIdParam = searchParams.get('groupId');
    const groupId = groupIdParam ? parseInt(groupIdParam, 10) : null;
    const sort = searchParams.get('sort') || 'added_at'; // title | added_at
    const dir = searchParams.get('dir') || 'desc'; // asc | desc

    const query = db
      .select({
        id: libraryItems.id,
        mediaId: libraryItems.mediaId,
        status: libraryItems.status,
        rating: libraryItems.rating,
        review: libraryItems.review,
        addedAt: libraryItems.addedAt,
        updatedAt: libraryItems.updatedAt,
        media: {
          id: media.id,
          source: media.source,
          externalId: media.externalId,
          type: media.type,
          title: media.title,
          year: media.year,
          coverUrl: media.coverUrl,
          metadata: media.metadata,
        },
      })
      .from(libraryItems)
      .innerJoin(media, eq(libraryItems.mediaId, media.id));

    let rows = await query.all();

    // Buscar relações de grupos
    const itemGroupsData = await db
      .select({
        libraryItemId: libraryItemGroups.libraryItemId,
        group: {
          id: groups.id,
          name: groups.name,
          description: groups.description,
          color: groups.color,
          createdAt: groups.createdAt,
        },
      })
      .from(libraryItemGroups)
      .innerJoin(groups, eq(libraryItemGroups.groupId, groups.id))
      .all();

    const groupsMap = new Map<number, typeof itemGroupsData[0]['group'][]>();
    for (const ig of itemGroupsData) {
      if (!groupsMap.has(ig.libraryItemId)) {
        groupsMap.set(ig.libraryItemId, []);
      }
      groupsMap.get(ig.libraryItemId)!.push(ig.group);
    }

    // Filtros em memória / SQLite
    if (status) {
      rows = rows.filter((r) => r.status === status);
    }
    if (type) {
      rows = rows.filter((r) => r.media.type === type);
    }
    if (groupId) {
      rows = rows.filter((r) => {
        const itemGroups = groupsMap.get(r.id) || [];
        return itemGroups.some((g) => g.id === groupId);
      });
    }

    // Ordenação
    rows.sort((a, b) => {
      if (sort === 'title') {
        const comp = a.media.title.localeCompare(b.media.title);
        return dir === 'asc' ? comp : -comp;
      } else {
        const comp = new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
        return dir === 'asc' ? comp : -comp;
      }
    });

    const parsedRows = rows.map((r) => ({
      ...r,
      groups: groupsMap.get(r.id) || [],
      media: {
        ...r.media,
        metadata: r.media.metadata ? JSON.parse(r.media.metadata) : null,
      },
    }));

    return NextResponse.json(parsedRows);
  } catch (error) {
    console.error('GET /api/library error:', error);
    return NextResponse.json({ error: 'Erro ao carregar biblioteca' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = AddItemSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: validated.error }, { status: 400 });
    }

    const item: MediaItem = {
      source: validated.data.source,
      externalId: validated.data.externalId,
      type: validated.data.type,
      title: validated.data.title,
      year: validated.data.year ?? null,
      coverUrl: validated.data.coverUrl ?? null,
      metadata: validated.data.metadata,
    };

    // 1. Garantir registro na tabela media
    const mediaId = await saveMediaCache(item);

    // 2. Verificar se já existe na biblioteca
    const existing = await db
      .select()
      .from(libraryItems)
      .where(eq(libraryItems.mediaId, mediaId))
      .get();

    if (existing) {
      return NextResponse.json({
        ...existing,
        media: item,
      });
    }

    const now = new Date().toISOString();
    const inserted = await db
      .insert(libraryItems)
      .values({
        mediaId,
        status: 'backlog',
        addedAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json(
      {
        ...inserted[0],
        media: item,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/library error:', error);
    return NextResponse.json({ error: 'Erro ao adicionar item' }, { status: 500 });
  }
}
