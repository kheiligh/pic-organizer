'use client';

import { useState, useEffect, useCallback } from 'react';
import PhotoGrid from '@/components/PhotoGrid';
import { Photo } from '@/lib/db';

const PAGE_SIZE = 48;

export default function PhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPhotos = useCallback(async (offset: number, append: boolean) => {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);

    const res = await fetch(`/api/photos?limit=${PAGE_SIZE}&offset=${offset}`);
    const data = await res.json();

    setPhotos((prev) => (append ? [...prev, ...data.photos] : data.photos));
    setTotal(data.total);
    setLoading(false);
    setLoadingMore(false);
  }, []);

  useEffect(() => {
    fetchPhotos(0, false);
  }, [fetchPhotos]);

  const loadMore = () => fetchPhotos(photos.length, true);

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-header__title">All Photos</h1>
        {!loading && (
          <p className="page-header__subtitle">{total.toLocaleString()} photos</p>
        )}
      </div>

      {!loading && photos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">&#128247;</div>
          <div className="empty-state__title">No photos yet</div>
          <div className="empty-state__body">Upload some photos to get started.</div>
          <a href="/upload" className="empty-state__cta">Upload photos</a>
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
