import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const thumb = request.nextUrl.searchParams.get('thumb') === '1';

  // Sanitize filename — no path traversal
  const safe = path.basename(filename);
  const relPath = thumb ? `thumbnails/${safe}` : safe;

  // When photo_base_url is an absolute URL (e.g. Vercel Blob), redirect there.
  // Otherwise fall back to reading the local uploads/ folder.
  const baseUrl = process.env.photo_base_url;
  if (baseUrl && /^https?:\/\//.test(baseUrl)) {
    return NextResponse.redirect(`${baseUrl.replace(/\/$/, '')}/${relPath}`, 302);
  }

  const filePath = path.join(process.cwd(), 'uploads', relPath);

  if (!fs.existsSync(filePath)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(safe).toLowerCase();
  const contentType =
    ext === '.png' ? 'image/png'
    : ext === '.gif' ? 'image/gif'
    : ext === '.webp' ? 'image/webp'
    : 'image/jpeg';

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
