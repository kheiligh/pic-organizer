import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const THUMBNAILS_DIR = path.join(UPLOADS_DIR, 'thumbnails');

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

export async function saveUploadedFile(buffer: Buffer, filename: string): Promise<{ width: number; height: number }> {
  ensureUploadDirs();
  const fullPath = getUploadPath(filename);
  fs.writeFileSync(fullPath, buffer);

  // Generate thumbnail
  const thumbPath = getThumbnailPath(filename);
  const metadata = await sharp(buffer)
    .rotate() // auto-rotate based on EXIF
    .resize(400, 400, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 80 })
    .toFile(thumbPath);

  // Get actual dimensions
  const info = await sharp(buffer).metadata();
  return { width: info.width || metadata.width, height: info.height || metadata.height };
}

export function deleteUploadedFile(filename: string) {
  const fullPath = getUploadPath(filename);
  const thumbPath = getThumbnailPath(filename);
  try { fs.unlinkSync(fullPath); } catch {}
  try { fs.unlinkSync(thumbPath); } catch {}
}
