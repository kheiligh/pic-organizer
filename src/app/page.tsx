import Link from 'next/link';
import { getPhotos, getPhotoCount, getAllTags } from '@/lib/db';
import PhotoGrid from '@/components/PhotoGrid';
import TagCloud from '@/components/TagCloud';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const photos = await getPhotos(24);
  const total = await getPhotoCount();
  const tags = await getAllTags();

  if (total === 0) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state__icon">&#128247;</div>
          <div className="empty-state__title">Your photo library is empty</div>
          <div className="empty-state__body">
            Upload photos to get started. The app will automatically tag them using AI
            and group nearby photos by location.
          </div>
          <Link href="/upload" className="empty-state__cta">
            Upload your first photos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-header__title">Latest Photos</h1>
        <p className="page-header__subtitle">Your personal photo library</p>
      </div>

      <div className="stats-bar">
        <div className="stats-bar__item">
          <span className="stats-bar__value">{total.toLocaleString()}</span>
          <span className="stats-bar__label">Photos</span>
        </div>
        <div className="stats-bar__item">
          <span className="stats-bar__value">{tags.length}</span>
          <span className="stats-bar__label">Tags</span>
        </div>
        <div className="stats-bar__item">
          <span className="stats-bar__value">
            {tags.filter((t) => t.type === 'location').length}
          </span>
          <span className="stats-bar__label">Locations</span>
        </div>
      </div>

      {tags.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <TagCloud tags={tags} max={16} />
        </div>
      )}

      <PhotoGrid photos={photos} />

      {total > 24 && (
        <div className="load-more">
          <Link href="/photos" className="load-more__btn">
            View all {total.toLocaleString()} photos
          </Link>
        </div>
      )}
    </div>
  );
}
