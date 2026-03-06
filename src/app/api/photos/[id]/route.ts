import { NextRequest, NextResponse } from 'next/server';
import { getPhotoById, deletePhoto } from '@/lib/db';
import { deleteUploadedFile } from '@/lib/storage';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photo = getPhotoById(parseInt(id));
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(photo);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const filename = deletePhoto(parseInt(id));
  if (!filename) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  deleteUploadedFile(filename);
  return NextResponse.json({ success: true });
}
