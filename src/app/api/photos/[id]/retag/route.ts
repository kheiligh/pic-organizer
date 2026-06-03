import { NextRequest, NextResponse } from 'next/server';
import { getPhotoById, clearAiTags } from '@/lib/db';
import { tagPhotoWithAI } from '@/lib/tagger';
import path from 'path';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photo = await getPhotoById(parseInt(id));
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await clearAiTags(photo.id);

  const filePath = path.join(process.cwd(), 'uploads', photo.filename);
  try {
    const tags = await tagPhotoWithAI(photo.id, filePath);
    return NextResponse.json({ tags });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    let message = `AI tagging failed: ${raw}`;
    if (raw.includes('Could not process image'))
      message = 'AI tagging failed: the image could not be processed (it may be corrupted or an unsupported format).';
    else if (raw.includes('too large') || raw.includes('Request too large'))
      message = 'AI tagging failed: image is too large even after compression. Try a smaller file.';
    else if (raw.includes('401') || raw.includes('authentication'))
      message = 'AI tagging failed: invalid API key. Check your ANTHROPIC_API_KEY.';
    else if (raw.includes('529') || raw.includes('overloaded'))
      message = 'AI tagging failed: Claude is overloaded right now. Try again in a moment.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
