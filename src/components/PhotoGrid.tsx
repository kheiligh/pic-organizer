'use client';

import { Photo } from '@/lib/db';
import PhotoCard from './PhotoCard';

interface Props {
  photos: Photo[];
  loading?: boolean;
}

export default function PhotoGrid({ photos, loading }: Props) {
  if (loading) {
    return (
      <div className="photo-grid">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="photo-card" style={{ height: 260, opacity: 0.3 }}>
            <div className="photo-card__thumb" style={{ background: '#222' }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="photo-grid">
      {photos.map((photo) => (
        <PhotoCard key={photo.id} photo={photo} />
      ))}
    </div>
  );
}
