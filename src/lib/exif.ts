import exifr from 'exifr';

export interface PhotoMeta {
  width?: number;
  height?: number;
  takenAt?: Date;
  latitude?: number;
  longitude?: number;
}

export async function extractMetadata(filePath: string): Promise<PhotoMeta> {
  try {
    const data = await exifr.parse(filePath, {
      pick: ['DateTimeOriginal', 'CreateDate', 'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef', 'ExifImageWidth', 'ExifImageHeight', 'ImageWidth', 'ImageHeight', 'PixelXDimension', 'PixelYDimension'],
    });

    if (!data) return {};

    const meta: PhotoMeta = {};

    // Date
    const rawDate = data.DateTimeOriginal || data.CreateDate;
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
      meta.takenAt = rawDate;
    }

    // GPS
    if (data.latitude != null && data.longitude != null) {
      meta.latitude = data.latitude;
      meta.longitude = data.longitude;
    }

    // Dimensions
    const w = data.ExifImageWidth || data.ImageWidth || data.PixelXDimension;
    const h = data.ExifImageHeight || data.ImageHeight || data.PixelYDimension;
    if (w) meta.width = w;
    if (h) meta.height = h;

    return meta;
  } catch {
    return {};
  }
}

// Build a human-readable location label from coordinates using reverse geocoding
// We use the free nominatim API (no key required)
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=14`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'pic-organizer/1.0' },
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    const addr = json.address;
    if (!addr) return null;
    const parts: string[] = [];
    if (addr.neighbourhood || addr.suburb) parts.push(addr.neighbourhood || addr.suburb);
    if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
    if (addr.country) parts.push(addr.country);
    return parts.join(', ') || json.display_name?.split(',').slice(0, 2).join(',') || null;
  } catch {
    return null;
  }
}
