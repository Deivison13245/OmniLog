import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { libraryItems } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const UpdateItemSchema = z.object({
  status: z.enum(['backlog', 'in_progress', 'completed', 'dropped']).optional(),
  rating: z.number().int().min(1).max(10).nullable().optional(),
  review: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = parseInt(id, 10);
    if (isNaN(itemId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const validated = UpdateItemSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: validated.error }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (validated.data.status !== undefined) updateData.status = validated.data.status;
    if (validated.data.rating !== undefined) updateData.rating = validated.data.rating;
    if (validated.data.review !== undefined) updateData.review = validated.data.review;

    const updated = await db
      .update(libraryItems)
      .set(updateData)
      .where(eq(libraryItems.id, itemId))
      .returning();

    if (!updated.length) {
      return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('PATCH /api/library/[id] error:', error);
    return NextResponse.json({ error: 'Erro ao atualizar item' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = parseInt(id, 10);
    if (isNaN(itemId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    await db.delete(libraryItems).where(eq(libraryItems.id, itemId));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('DELETE /api/library/[id] error:', error);
    return NextResponse.json({ error: 'Erro ao excluir item' }, { status: 500 });
  }
}
