import { NextRequest, NextResponse } from 'next/server';
import { getPhotoById, getDb } from '@/lib/db';
import { tagPhotoWithAI } from '@/lib/tagger';
import path from 'path';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photo = getPhotoById(parseInt(id));
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Remove existing AI tags before re-tagging
  const db = getDb();
  db.prepare(`
    DELETE FROM photo_tags
    WHERE photo_id = ?
      AND tag_id IN (SELECT id FROM tags WHERE type = 'ai')
  `).run(photo.id);

  // Reset ai_tagged flag
  db.prepare('UPDATE photos SET ai_tagged = 0 WHERE id = ?').run(photo.id);

  const filePath = path.join(process.cwd(), 'uploads', photo.filename);
  const tags = await tagPhotoWithAI(photo.id, filePath);

  return NextResponse.json({ tags });
}
