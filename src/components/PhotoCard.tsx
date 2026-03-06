'use client';

import Link from 'next/link';
import { Photo } from '@/lib/db';

interface Props {
  photo: Photo;
}

export default function PhotoCard({ photo }: Props) {
  const displayTags = photo.tags?.slice(0, 3) ?? [];

  return (
    <Link href={`/photos/${photo.id}`} className="photo-card">
      <img
        className="photo-card__thumb"
        src={`/api/image/${photo.filename}?thumb=1`}
        alt={photo.original_name}
        loading="lazy"
      />
      <div className="photo-card__meta">
        <div className="photo-card__name">{photo.original_name}</div>
        {displayTags.length > 0 && (
          <div className="photo-card__tags">
            {displayTags.map((tag) => (
              <span key={tag.id} className={`tag tag--${tag.type}`}>
                {tag.name}
              </span>
            ))}
            {(photo.tags?.length ?? 0) > 3 && (
              <span className="tag tag--ai">+{(photo.tags?.length ?? 0) - 3}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
