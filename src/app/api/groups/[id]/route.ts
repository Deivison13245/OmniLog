import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { groups, libraryItemGroups } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const groupId = parseInt(id, 10);
    if (isNaN(groupId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Deletar associações primeiro e depois o grupo
    await db.delete(libraryItemGroups).where(eq(libraryItemGroups.groupId, groupId));
    await db.delete(groups).where(eq(groups.id, groupId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/groups/[id] error:', error);
    return NextResponse.json({ error: 'Erro ao excluir grupo' }, { status: 500 });
  }
}
