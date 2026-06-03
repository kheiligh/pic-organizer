import { createClient, type PostgrestError } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing Supabase environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, detectSessionInUrl: false },
});

export interface Photo {
  id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  width: number | null;
  height: number | null;
  taken_at: string | null;
  uploaded_at: string;
  latitude: number | null;
  longitude: number | null;
  location_label: string | null;
  ai_tagged: number;
  tags?: Tag[];
}

export interface Tag {
  id: number;
  name: string;
  type: 'ai' | 'location' | 'manual';
  count?: number;
}

type PhotoTagRow = {
  photo_id: number;
  tags: Tag;
};

type TagWithPhotoTags = Tag & {
  photo_tags?: { photo_id: number }[];
};

function assertNoError(error: PostgrestError | null, message: string) {
  if (error) {
    console.error(message, error);
    throw new Error(`${message}: ${error.message}`);
  }
}

async function attachTags(photos: Photo[]): Promise<Photo[]> {
  if (photos.length === 0) return photos;

  const photoIds = photos.map((photo) => photo.id);
  const { data, error } = await supabase
    .from('photo_tags')
    .select('photo_id, tags(id, name, type)')
    .in('photo_id', photoIds) as {
      data: { photo_id: number; tags: Tag | null }[] | null;
      error: PostgrestError | null;
    };
  assertNoError(error, 'Failed to load photo tags');

  const tagsByPhoto = new Map<number, Tag[]>();
  for (const row of data ?? []) {
    const tag = row.tags;
    if (!tag) continue;
    const existing = tagsByPhoto.get(row.photo_id) ?? [];
    existing.push(tag);
    tagsByPhoto.set(row.photo_id, existing);
  }

  return photos.map((photo) => ({
    ...photo,
    tags: tagsByPhoto.get(photo.id) ?? [],
  }));
}

export async function insertPhoto(
  data: Omit<Photo, 'id' | 'uploaded_at' | 'ai_tagged' | 'tags'>
): Promise<Photo> {
  const { data: photo, error } = await supabase
    .from('photos')
    .insert([{ ...data }])
    .select('*')
    .single();
  assertNoError(error, 'Failed to insert photo');
  return { ...(photo as Photo), tags: [] };
}

export async function getPhotoById(id: number): Promise<Photo | null> {
  const { data, error } = await supabase.from('photos').select('*').eq('id', id).maybeSingle();
  assertNoError(error, 'Failed to load photo');
  if (!data) return null;
  const photo = data as Photo;
  photo.tags = await getTagsForPhoto(id);
  return photo;
}

export async function getPhotos(
  limit = 50,
  offset = 0,
  tagId?: number
): Promise<Photo[]> {
  if (tagId) {
    const { data: taggedRows, error: taggedError } = await supabase
      .from('photo_tags')
      .select('photo_id')
      .eq('tag_id', tagId) as {
        data: { photo_id: number }[] | null;
        error: PostgrestError | null;
      };
    assertNoError(taggedError, 'Failed to load tagged photos');

    const photoIds = (taggedRows ?? []).map((row) => row.photo_id);
    if (photoIds.length === 0) return [];

    const { data: photosData, error: photosError } = await supabase
      .from('photos')
      .select('*')
      .in('id', photoIds)
      .order('taken_at', { ascending: false })
      .order('uploaded_at', { ascending: false })
      .range(offset, offset + limit - 1);
    assertNoError(photosError, 'Failed to load photos by tag');

    return attachTags((photosData ?? []) as Photo[]);
  }

  const { data: photosData, error } = await supabase
    .from('photos')
    .select('*')
    .order('taken_at', { ascending: false })
    .order('uploaded_at', { ascending: false })
    .range(offset, offset + limit - 1);
  assertNoError(error, 'Failed to load photos');
  return attachTags((photosData ?? []) as Photo[]);
}

export async function getPhotoCount(tagId?: number): Promise<number> {
  if (tagId) {
    const { count, error } = await supabase
      .from('photo_tags')
      .select('photo_id', { count: 'exact' })
      .eq('tag_id', tagId);

    assertNoError(error, 'Failed to count tagged photos');
    return count ?? 0;
  }
  const { count, error } = await supabase
    .from('photos')
    .select('*', { count: 'exact' });
  console.log('Counted total photos:', { count, error });
  assertNoError(error, 'Failed to count photos');
  return count ?? 0;
}

export async function getTagsForPhoto(photoId: number): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('photo_tags')
    .select('tags(id, name, type)')
    .eq('photo_id', photoId);
  assertNoError(error, 'Failed to load tags for photo');

  return ((data ?? []) as unknown as { tags: Tag | null }[])
    .map((row) => row.tags)
    .filter((tag): tag is Tag => Boolean(tag))
    .sort((a: Tag, b: Tag) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
}

export async function getAllTags(): Promise<(Tag & { count: number })[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('id, name, type, photo_tags(photo_id)');
  assertNoError(error, 'Failed to load tags');

  return (data ?? [])
    .map((row: TagWithPhotoTags) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      count: row.photo_tags?.length ?? 0,
    }))
    .sort((a: Tag & { count: number }, b: Tag & { count: number }) =>
      b.count - a.count || a.name.localeCompare(b.name)
    );
}

export async function getTagBySlug(slug: string): Promise<Tag | null> {
  const { data, error } = await supabase.from('tags').select('*').eq('name', slug).maybeSingle();
  assertNoError(error, 'Failed to load tag');
  return data as Tag | null;
}

export async function upsertTag(name: string, type: Tag['type']): Promise<Tag> {
  const { error } = await supabase
    .from('tags')
    .upsert([{ name, type }], { onConflict: 'name', ignoreDuplicates: true });
  assertNoError(error, 'Failed to upsert tag');

  const tag = await getTagBySlug(name);
  if (!tag) throw new Error('Failed to resolve upserted tag');
  return tag;
}

export async function attachTag(photoId: number, tagId: number): Promise<void> {
  const { error } = await supabase
    .from('photo_tags')
    .upsert([{ photo_id: photoId, tag_id: tagId }], {
      onConflict: 'photo_id,tag_id',
      ignoreDuplicates: true,
    });
  assertNoError(error, 'Failed to attach tag to photo');
}

export async function markPhotoAiTagged(photoId: number): Promise<void> {
  const { error } = await supabase.from('photos').update({ ai_tagged: 1 }).eq('id', photoId);
  assertNoError(error, 'Failed to mark photo as AI tagged');
}

export async function deletePhoto(id: number): Promise<string | null> {
  const { data, error } = await supabase
    .from('photos')
    .delete()
    .select('filename')
    .eq('id', id)
    .single();
  assertNoError(error, 'Failed to delete photo');
  return data?.filename ?? null;
}

export async function clearAiTags(photoId: number): Promise<void> {
  const { data: aiTags, error: aiTagError } = await supabase
    .from('tags')
    .select('id')
    .eq('type', 'ai');
  assertNoError(aiTagError, 'Failed to load AI tag ids');

  const aiTagIds = (aiTags ?? []).map((row: { id: number }) => row.id);
  if (aiTagIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('photo_tags')
      .delete()
      .eq('photo_id', photoId)
      .in('tag_id', aiTagIds);
    assertNoError(deleteError, 'Failed to remove AI tags from photo');
  }

  const { error: updateError } = await supabase
    .from('photos')
    .update({ ai_tagged: 0 })
    .eq('id', photoId);
  assertNoError(updateError, 'Failed to reset photo AI flag');
}

export async function findPhotosNearLocation(
  lat: number,
  lon: number,
  radiusDeg = 0.0145
): Promise<Photo[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .gte('latitude', lat - radiusDeg)
    .lte('latitude', lat + radiusDeg)
    .gte('longitude', lon - radiusDeg)
    .lte('longitude', lon + radiusDeg)
    .limit(100);
  assertNoError(error, 'Failed to find nearby photos');
  return (data ?? []) as Photo[];
}
