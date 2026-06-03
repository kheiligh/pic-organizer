import { NextRequest, NextResponse } from 'next/server';
import { getPhotos, getPhotoCount } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const offset = parseInt(searchParams.get('offset') || '0');
  const tagId = searchParams.get('tagId') ? parseInt(searchParams.get('tagId')!) : undefined;

  const photos = await getPhotos(limit, offset, tagId);
  const total = await getPhotoCount(tagId);

  return NextResponse.json({ photos, total, limit, offset });
}
