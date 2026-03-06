'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Photo } from '@/lib/db';

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function PhotoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [retagging, setRetagging] = useState(false);

  const loadPhoto = () =>
    fetch(`/api/photos/${id}`)
      .then((r) => r.json())
      .then((data) => { setPhoto(data); setLoading(false); })
      .catch(() => setLoading(false));

  useEffect(() => { loadPhoto(); }, [id]);

  const handleRetag = async () => {
    setRetagging(true);
    await fetch(`/api/photos/${id}/retag`, { method: 'POST' });
    await loadPhoto();
    setRetagging(false);
  };

  const handleDelete = async () => {
    if (!confirm('Delete this photo permanently?')) return;
    setDeleting(true);
    await fetch(`/api/photos/${id}`, { method: 'DELETE' });
    router.push('/photos');
  };

  if (loading) {
    return (
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      </div>
    );
  }

  if (!photo) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state__title">Photo not found</div>
          <Link href="/photos" className="empty-state__cta">Back to photos</Link>
        </div>
      </div>
    );
  }

  const aiTags = photo.tags?.filter((t) => t.type === 'ai') ?? [];
  const locationTags = photo.tags?.filter((t) => t.type === 'location') ?? [];
  const takenAt = formatDate(photo.taken_at);
  const uploadedAt = formatDate(photo.uploaded_at);

  return (
    <div className="container">
      <Link href="/photos" className="photo-detail__back">
        &#8592; Back to photos
      </Link>
      <div className="photo-detail">
        <div className="photo-detail__image-wrap">
          <img
            className="photo-detail__image"
            src={`/api/image/${photo.filename}`}
            alt={photo.original_name}
          />
        </div>

        <div className="photo-detail__sidebar">
          {/* Tags */}
          <div className="photo-detail__section">
            <div className="photo-detail__section-title">Tags</div>
            {photo.tags && photo.tags.length > 0 ? (
              <div className="photo-detail__tags">
                {photo.tags.map((tag) => (
                  <Link
                    key={tag.id}
                    href={`/tags/${encodeURIComponent(tag.name)}`}
                    className={`tag tag--${tag.type}`}
                  >
                    {tag.name}
                  </Link>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.82rem', color: '#555' }}>
                {photo.ai_tagged ? 'No tags found.' : 'AI tagging in progress...'}
              </p>
            )}
          </div>

          {/* File info */}
          <div className="photo-detail__section">
            <div className="photo-detail__section-title">Details</div>
            <div className="photo-detail__meta-row">
              <span className="photo-detail__meta-row-label">Filename</span>
              <span className="photo-detail__meta-row-value">{photo.original_name}</span>
            </div>
            {photo.width && photo.height && (
              <div className="photo-detail__meta-row">
                <span className="photo-detail__meta-row-label">Dimensions</span>
                <span className="photo-detail__meta-row-value">{photo.width} × {photo.height}</span>
              </div>
            )}
            <div className="photo-detail__meta-row">
              <span className="photo-detail__meta-row-label">Size</span>
              <span className="photo-detail__meta-row-value">{formatBytes(photo.size)}</span>
            </div>
            {takenAt && (
              <div className="photo-detail__meta-row">
                <span className="photo-detail__meta-row-label">Taken</span>
                <span className="photo-detail__meta-row-value">{takenAt}</span>
              </div>
            )}
            <div className="photo-detail__meta-row">
              <span className="photo-detail__meta-row-label">Uploaded</span>
              <span className="photo-detail__meta-row-value">{uploadedAt}</span>
            </div>
          </div>

          {/* Location */}
          {photo.latitude != null && (
            <div className="photo-detail__section">
              <div className="photo-detail__section-title">Location</div>
              {photo.location_label && (
                <div className="photo-detail__meta-row">
                  <span className="photo-detail__meta-row-label">Place</span>
                  <span className="photo-detail__meta-row-value">{photo.location_label}</span>
                </div>
              )}
              <div className="photo-detail__meta-row">
                <span className="photo-detail__meta-row-label">Coordinates</span>
                <span className="photo-detail__meta-row-value">
                  {photo.latitude?.toFixed(5)}, {photo.longitude?.toFixed(5)}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="photo-detail__section" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              className="photo-detail__retag-btn"
              onClick={handleRetag}
              disabled={retagging}
            >
              {retagging ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  Re-tagging...
                </span>
              ) : 'Re-tag with AI'}
            </button>
            <button
              className="photo-detail__delete-btn"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete photo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
