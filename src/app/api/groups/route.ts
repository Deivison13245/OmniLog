import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { groups, libraryItemGroups } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

const CreateGroupSchema = z.object({
  name: z.string().trim().min(1, 'Nome do grupo é obrigatório'),
  description: z.string().trim().optional().nullable(),
  color: z.string().trim().optional().nullable(),
});

export async function GET() {
  try {
    const allGroups = await db.select().from(groups).all();

    // Contagem de itens por grupo
    const counts = await db
      .select({
        groupId: libraryItemGroups.groupId,
        count: sql<number>`count(${libraryItemGroups.id})`,
      })
      .from(libraryItemGroups)
      .groupBy(libraryItemGroups.groupId)
      .all();

    const countMap = new Map<number, number>();
    for (const c of counts) {
      countMap.set(c.groupId, c.count);
    }

    const result = allGroups.map((g) => ({
      ...g,
      itemCount: countMap.get(g.id) || 0,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/groups error:', error);
    return NextResponse.json({ error: 'Erro ao listar grupos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = CreateGroupSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: validated.error }, { status: 400 });
    }

    const now = new Date().toISOString();
    const inserted = await db
      .insert(groups)
      .values({
        name: validated.data.name,
        description: validated.data.description || null,
        color: validated.data.color || '#10b981', // default emerald
        createdAt: now,
      })
      .returning();

    return NextResponse.json({ ...inserted[0], itemCount: 0 }, { status: 201 });
  } catch (error) {
    console.error('POST /api/groups error:', error);
    return NextResponse.json({ error: 'Erro ao criar grupo' }, { status: 500 });
  }
}
