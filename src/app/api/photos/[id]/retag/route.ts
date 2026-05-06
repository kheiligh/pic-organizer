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
  try {
    const tags = await tagPhotoWithAI(photo.id, filePath);
    return NextResponse.json({ tags });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    // Surface a human-readable message for common API errors
    let message = `AI tagging failed: ${raw}`;
    if (raw.includes('Could not process image')) message = 'AI tagging failed: the image could not be processed (it may be corrupted or an unsupported format).';
    else if (raw.includes('too large') || raw.includes('Request too large')) message = 'AI tagging failed: image is too large even after compression. Try a smaller file.';
    else if (raw.includes('401') || raw.includes('authentication')) message = 'AI tagging failed: invalid API key. Check your ANTHROPIC_API_KEY.';
    else if (raw.includes('529') || raw.includes('overloaded')) message = 'AI tagging failed: Claude is overloaded right now. Try again in a moment.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
