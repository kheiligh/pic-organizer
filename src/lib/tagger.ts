import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import {
  attachTag,
  markPhotoAiTagged,
  upsertTag,
  findPhotosNearLocation,
} from './db';

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

export async function tagPhotoWithAI(photoId: number, sourceBuffer: Buffer): Promise<string[]> {
  const metadata = await sharp(sourceBuffer).metadata();
  let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' =
    metadata.format === 'png' ? 'image/png'
    : metadata.format === 'gif' ? 'image/gif'
    : metadata.format === 'webp' ? 'image/webp'
    : 'image/jpeg';

  const needsResize =
    (metadata.width ?? 0) > MAX_DIMENSION || (metadata.height ?? 0) > MAX_DIMENSION;
  let imageBuffer: Buffer = needsResize
    ? await sharp(sourceBuffer)
        .resize(MAX_DIMENSION, MAX_DIMENSION, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .toBuffer()
    : sourceBuffer;

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
    const match = text.match(/\[[\s\S]*?\]/);
    if (match) tags = JSON.parse(match[0]);
  } catch {
    tags = [];
  }

  const normalized = tags
    .filter((t) => typeof t === 'string' && t.length > 0 && t.length < 60)
    .map((t) => t.toLowerCase().trim())
    .slice(0, 10);

  for (const tagName of normalized) {
    const tag = await upsertTag(tagName, 'ai');
    await attachTag(photoId, tag.id);
  }

  await markPhotoAiTagged(photoId);
  return normalized;
}

export async function applyLocationTag(
  photoId: number,
  lat: number,
  lon: number,
  locationLabel: string | null
): Promise<void> {
  const nearbyPhotos = await findPhotosNearLocation(lat, lon);

  let locationTagName: string | null = null;
  for (const nearby of nearbyPhotos) {
    if (nearby.id === photoId) continue;
    if (nearby.location_label) {
      locationTagName = nearby.location_label;
      break;
    }
  }

  if (!locationTagName && locationLabel) {
    locationTagName = locationLabel;
  }

  if (locationTagName) {
    const tag = await upsertTag(locationTagName, 'location');
    await attachTag(photoId, tag.id);
  }
}
