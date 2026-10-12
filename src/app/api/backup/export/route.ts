import { NextResponse } from 'next/server';
import { db } from '@/db';
import { media, libraryItems, groups, libraryItemGroups } from '@/db/schema';

export async function GET() {
  try {
    const allMedia = await db.select().from(media).all();
    const allLibraryItems = await db.select().from(libraryItems).all();
    const allGroups = await db.select().from(groups).all();
    const allItemGroups = await db.select().from(libraryItemGroups).all();

    const backupData = {
      version: 1,
      appName: 'OmniLog',
      exportedAt: new Date().toISOString(),
      data: {
        media: allMedia,
        libraryItems: allLibraryItems,
        groups: allGroups,
        libraryItemGroups: allItemGroups,
      },
    };

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `omnilog-backup-${dateStr}.json`;

    return new NextResponse(JSON.stringify(backupData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating backup:', error);
    return NextResponse.json({ error: 'Erro ao gerar backup' }, { status: 500 });
  }
}
