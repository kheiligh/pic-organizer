import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { attachTag, markPhotoAiTagged, upsertTag, findPhotosNearLocation, upsertTag as upsertTagAlias } from './db';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_DIMENSION = 7500;
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const TAGGING_PROMPT = `Analyze this photo and return a JSON array of descriptive tags.

Rules:
- Return ONLY a valid JSON array of lowercase strings, nothing else
- 3 to 10 tags — use more tags when multiple distinct things are present (e.g. a photo with people AND a whiteboard AND food should get all three)
- Be specific but not overly granular
- Good tag categories: subject (person, group photo, selfie, pet, animal), setting (outdoor, indoor, beach, mountain, forest, city, office, home, restaurant), activity (hiking, party, meeting, wedding, graduation, sports), objects of note (whiteboard, food, car, architecture, art), mood/style (landscape, portrait, sunset, night photography)
- Do NOT include color descriptions, camera settings, or image quality notes

Example output: ["outdoor","group photo","hiking","mountain","nature"]`;

export async function tagPhotoWithAI(photoId: number, filePath: string): Promise<string[]> {
  const ext = path.extname(filePath).toLowerCase();
  let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' =
    ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

  const metadata = await sharp(filePath).metadata();
  const needsResize = (metadata.width ?? 0) > MAX_DIMENSION || (metadata.height ?? 0) > MAX_DIMENSION;
  let imageBuffer: Buffer = needsResize
    ? await sharp(filePath).resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true }).toBuffer()
    : fs.readFileSync(filePath);

  // If still over 5 MB, compress to JPEG at decreasing quality until it fits
  if (imageBuffer.length > MAX_SIZE_BYTES) {
    let quality = 85;
    while (imageBuffer.length > MAX_SIZE_BYTES && quality >= 20) {
      imageBuffer = await sharp(imageBuffer).jpeg({ quality }).toBuffer();
      mediaType = 'image/jpeg';
      quality -= 15;
    }
  }

  const base64 = imageBuffer.toString('base64');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: TAGGING_PROMPT },
        ],
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]';
  let tags: string[] = [];
  try {
    // Extract JSON array even if there's surrounding text
    const match = text.match(/\[[\s\S]*?\]/);
    if (match) tags = JSON.parse(match[0]);
  } catch {
    tags = [];
  }

  // Normalize and persist
  const normalized = tags
    .filter((t) => typeof t === 'string' && t.length > 0 && t.length < 60)
    .map((t) => t.toLowerCase().trim())
    .slice(0, 10);

  for (const tagName of normalized) {
    const tag = upsertTag(tagName, 'ai');
    attachTag(photoId, tag.id);
  }

  markPhotoAiTagged(photoId);
  return normalized;
}

export async function applyLocationTag(
  photoId: number,
  lat: number,
  lon: number,
  locationLabel: string | null
): Promise<void> {
  // Find existing location tags nearby (within ~1 mile)
  const nearbyPhotos = findPhotosNearLocation(lat, lon);

  // Check if any nearby photo already has a location tag
  let locationTagName: string | null = null;
  for (const nearby of nearbyPhotos) {
    if (nearby.id === photoId) continue;
    if (nearby.location_label) {
      locationTagName = nearby.location_label;
      break;
    }
  }

  // Fall back to reverse geocoded label
  if (!locationTagName && locationLabel) {
    locationTagName = locationLabel;
  }

  if (locationTagName) {
    const tag = upsertTag(locationTagName, 'location');
    attachTag(photoId, tag.id);
  }
}
