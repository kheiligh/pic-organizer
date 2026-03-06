import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'photos.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      taken_at TEXT,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      latitude REAL,
      longitude REAL,
      location_label TEXT,
      ai_tagged INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK(type IN ('ai', 'location', 'manual')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS photo_tags (
      photo_id INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (photo_id, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_photos_taken_at ON photos(taken_at DESC);
    CREATE INDEX IF NOT EXISTS idx_photos_uploaded_at ON photos(uploaded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_photo_tags_photo ON photo_tags(photo_id);
    CREATE INDEX IF NOT EXISTS idx_photo_tags_tag ON photo_tags(tag_id);
  `);
}

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

export function insertPhoto(data: Omit<Photo, 'id' | 'uploaded_at' | 'ai_tagged' | 'tags'>): Photo {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO photos (filename, original_name, mime_type, size, width, height, taken_at, latitude, longitude, location_label)
    VALUES (@filename, @original_name, @mime_type, @size, @width, @height, @taken_at, @latitude, @longitude, @location_label)
  `);
  const result = stmt.run(data);
  return getPhotoById(result.lastInsertRowid as number)!;
}

export function getPhotoById(id: number): Photo | null {
  const db = getDb();
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(id) as Photo | undefined;
  if (!photo) return null;
  photo.tags = getTagsForPhoto(id);
  return photo;
}

export function getPhotos(limit = 50, offset = 0, tagId?: number): Photo[] {
  const db = getDb();
  let photos: Photo[];
  if (tagId) {
    photos = db.prepare(`
      SELECT p.* FROM photos p
      JOIN photo_tags pt ON pt.photo_id = p.id
      WHERE pt.tag_id = ?
      ORDER BY COALESCE(p.taken_at, p.uploaded_at) DESC
      LIMIT ? OFFSET ?
    `).all(tagId, limit, offset) as Photo[];
  } else {
    photos = db.prepare(`
      SELECT * FROM photos
      ORDER BY COALESCE(taken_at, uploaded_at) DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as Photo[];
  }
  for (const photo of photos) {
    photo.tags = getTagsForPhoto(photo.id);
  }
  return photos;
}

export function getPhotoCount(tagId?: number): number {
  const db = getDb();
  if (tagId) {
    const row = db.prepare('SELECT COUNT(*) as count FROM photo_tags WHERE tag_id = ?').get(tagId) as { count: number };
    return row.count;
  }
  const row = db.prepare('SELECT COUNT(*) as count FROM photos').get() as { count: number };
  return row.count;
}

export function getTagsForPhoto(photoId: number): Tag[] {
  const db = getDb();
  return db.prepare(`
    SELECT t.* FROM tags t
    JOIN photo_tags pt ON pt.tag_id = t.id
    WHERE pt.photo_id = ?
    ORDER BY t.type, t.name
  `).all(photoId) as Tag[];
}

export function getAllTags(): (Tag & { count: number })[] {
  const db = getDb();
  return db.prepare(`
    SELECT t.*, COUNT(pt.photo_id) as count
    FROM tags t
    JOIN photo_tags pt ON pt.tag_id = t.id
    GROUP BY t.id
    ORDER BY count DESC, t.name ASC
  `).all() as (Tag & { count: number })[];
}

export function getTagBySlug(slug: string): Tag | null {
  const db = getDb();
  return db.prepare('SELECT * FROM tags WHERE name = ?').get(slug) as Tag | null;
}

export function upsertTag(name: string, type: Tag['type']): Tag {
  const db = getDb();
  db.prepare(`
    INSERT INTO tags (name, type) VALUES (?, ?)
    ON CONFLICT(name) DO NOTHING
  `).run(name, type);
  return db.prepare('SELECT * FROM tags WHERE name = ?').get(name) as Tag;
}

export function attachTag(photoId: number, tagId: number) {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO photo_tags (photo_id, tag_id) VALUES (?, ?)').run(photoId, tagId);
}

export function markPhotoAiTagged(photoId: number) {
  const db = getDb();
  db.prepare('UPDATE photos SET ai_tagged = 1 WHERE id = ?').run(photoId);
}

export function deletePhoto(id: number): string | null {
  const db = getDb();
  const photo = db.prepare('SELECT filename FROM photos WHERE id = ?').get(id) as { filename: string } | undefined;
  if (!photo) return null;
  db.prepare('DELETE FROM photos WHERE id = ?').run(id);
  return photo.filename;
}

// Find photos within ~1 mile radius (0.0145 degrees ≈ 1 mile)
export function findPhotosNearLocation(lat: number, lon: number, radiusDeg = 0.0145): Photo[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM photos
    WHERE latitude IS NOT NULL
      AND ABS(latitude - ?) < ?
      AND ABS(longitude - ?) < ?
    LIMIT 100
  `).all(lat, radiusDeg, lon, radiusDeg) as Photo[];
}
