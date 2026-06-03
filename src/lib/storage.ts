import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { put, del } from '@vercel/blob';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const THUMBNAILS_DIR = path.join(UPLOADS_DIR, 'thumbnails');

// When a Blob store is linked (token present, e.g. on Vercel) we read/write
// Blob storage; otherwise we fall back to the local uploads/ folder for dev.
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

export function ensureUploadDirs() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
}

export function getUploadPath(filename: string) {
  return path.join(UPLOADS_DIR, filename);
}

export function getThumbnailPath(filename: string) {
  return path.join(THUMBNAILS_DIR, filename);
}

export function generateFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  return `${randomUUID()}${ext}`;
}

function contentTypeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return ext === '.png' ? 'image/png'
    : ext === '.gif' ? 'image/gif'
    : ext === '.webp' ? 'image/webp'
    : 'image/jpeg';
}

export async function saveUploadedFile(buffer: Buffer, filename: string): Promise<{ width: number; height: number }> {
  // Generate thumbnail in-memory (no disk needed)
  const thumbBuffer = await sharp(buffer)
    .rotate() // auto-rotate based on EXIF
    .resize(400, 400, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 80 })
    .toBuffer();

  if (useBlob) {
    await put(filename, buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: contentTypeFor(filename),
    });
    await put(`thumbnails/${filename}`, thumbBuffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'image/jpeg',
    });
  } else {
    ensureUploadDirs();
    fs.writeFileSync(getUploadPath(filename), buffer);
    fs.writeFileSync(getThumbnailPath(filename), thumbBuffer);
  }

  const info = await sharp(buffer).metadata();
  return { width: info.width || 0, height: info.height || 0 };
}

export async function readUploadedFile(filename: string): Promise<Buffer> {
  if (useBlob) {
    const base = process.env.photo_base_url?.replace(/\/$/, '');
    if (!base) throw new Error('photo_base_url is not set; cannot read from Blob storage');
    const res = await fetch(`${base}/${filename}`);
    if (!res.ok) throw new Error(`Failed to fetch image from Blob: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFileSync(getUploadPath(filename));
}

export async function deleteUploadedFile(filename: string) {
  if (useBlob) {
    const base = process.env.photo_base_url?.replace(/\/$/, '');
    if (!base) return;
    try {
      await del([`${base}/${filename}`, `${base}/thumbnails/${filename}`]);
    } catch {}
    return;
  }

  const fullPath = getUploadPath(filename);
  const thumbPath = getThumbnailPath(filename);
  try { fs.unlinkSync(fullPath); } catch {}
  try { fs.unlinkSync(thumbPath); } catch {}
}
