import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { libraryItemGroups, groups } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const ToggleGroupSchema = z.object({
  groupId: z.number().int().positive(),
  action: z.enum(['add', 'remove']),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const libraryItemId = parseInt(id, 10);
    if (isNaN(libraryItemId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const validated = ToggleGroupSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: validated.error }, { status: 400 });
    }

    const { groupId, action } = validated.data;

    if (action === 'add') {
      const existing = await db
        .select()
        .from(libraryItemGroups)
        .where(
          and(
            eq(libraryItemGroups.libraryItemId, libraryItemId),
            eq(libraryItemGroups.groupId, groupId)
          )
        )
        .get();

      if (!existing) {
        await db.insert(libraryItemGroups).values({
          libraryItemId,
          groupId,
        });
      }
    } else {
      await db
        .delete(libraryItemGroups)
        .where(
          and(
            eq(libraryItemGroups.libraryItemId, libraryItemId),
            eq(libraryItemGroups.groupId, groupId)
          )
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/library/[id]/groups error:', error);
    return NextResponse.json({ error: 'Erro ao vincular grupo' }, { status: 500 });
  }
}
