'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PhotoGrid from '@/components/PhotoGrid';
import { Photo } from '@/lib/db';

const PAGE_SIZE = 48;

export default function TagPage() {
  const { slug } = useParams<{ slug: string }>();
  const tagName = decodeURIComponent(slug);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [total, setTotal] = useState(0);
  const [tagId, setTagId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPhotos = useCallback(async (offset: number, append: boolean, resolvedTagId?: number) => {
    const id = resolvedTagId ?? tagId;
    if (id == null) return;

    if (offset === 0) setLoading(true);
    else setLoadingMore(true);

    const res = await fetch(`/api/photos?limit=${PAGE_SIZE}&offset=${offset}&tagId=${id}`);
    const data = await res.json();

    setPhotos((prev) => (append ? [...prev, ...data.photos] : data.photos));
    setTotal(data.total);
    setLoading(false);
    setLoadingMore(false);
  }, [tagId]);

  useEffect(() => {
    // Resolve tag by name via tags API
    fetch('/api/tags')
      .then((r) => r.json())
      .then((tags: { id: number; name: string }[]) => {
        const tag = tags.find((t) => t.name === tagName);
        if (tag) {
          setTagId(tag.id);
          fetchPhotos(0, false, tag.id);
        } else {
          setLoading(false);
        }
      });
  }, [tagName]);

  const loadMore = () => fetchPhotos(photos.length, true);

  return (
    <div className="container">
      <Link href="/tags" style={{ fontSize: '0.875rem', color: '#888', display: 'inline-block', marginBottom: 16 }}>
        &#8592; All tags
      </Link>
      <div className="page-header">
        <h1 className="page-header__title">{tagName}</h1>
        {!loading && <p className="page-header__subtitle">{total.toLocaleString()} photos</p>}
      </div>

      {!loading && photos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__title">No photos with this tag</div>
        </div>
      ) : (
        <>
          <PhotoGrid photos={photos} loading={loading} />
          {photos.length < total && (
            <div className="load-more">
              <button
                className="load-more__btn"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : `Load more (${total - photos.length} remaining)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
