import { NextRequest, NextResponse } from 'next/server';
import { insertPhoto } from '@/lib/db';
import { saveUploadedFile, generateFilename } from '@/lib/storage';
import { extractMetadata, reverseGeocode } from '@/lib/exif';
import { tagPhotoWithAI, applyLocationTag } from '@/lib/tagger';
import path from 'path';
import os from 'os';
import fs from 'fs';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const files = formData.getAll('photos') as File[];

  if (!files || files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 });
  }

  const results = [];
  const errors = [];

  for (const file of files) {
    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.(jpe?g|png|webp|gif|heic|heif)$/i)) {
      errors.push({ name: file.name, error: 'Unsupported file type' });
      continue;
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = generateFilename(file.name);

      // Save to disk + generate thumbnail (get dimensions from sharp)
      const { width, height } = await saveUploadedFile(buffer, filename);

      // Extract EXIF from a temp file (exifr needs a file path for reliability)
      const tmpPath = path.join(os.tmpdir(), filename);
      fs.writeFileSync(tmpPath, buffer);
      const meta = await extractMetadata(tmpPath);
      fs.unlinkSync(tmpPath);

      let locationLabel: string | null = null;
      if (meta.latitude != null && meta.longitude != null) {
        locationLabel = await reverseGeocode(meta.latitude, meta.longitude);
      }

      const photo = await insertPhoto({
        filename,
        original_name: file.name,
        mime_type: file.type || 'image/jpeg',
        size: buffer.length,
        width: meta.width || width,
        height: meta.height || height,
        taken_at: meta.takenAt?.toISOString() ?? null,
        latitude: meta.latitude ?? null,
        longitude: meta.longitude ?? null,
        location_label: locationLabel,
      });

      if (meta.latitude != null && meta.longitude != null) {
        await applyLocationTag(photo.id, meta.latitude, meta.longitude, locationLabel);
      }

      tagPhotoWithAI(photo.id, buffer).catch((err) =>
        console.error(`AI tagging failed for photo ${photo.id}:`, err)
      );

      results.push(photo);
    } catch (err) {
      console.error('Upload error:', err);
      errors.push({ name: file.name, error: String(err) });
    }
  }

  return NextResponse.json({ results, errors });
}
