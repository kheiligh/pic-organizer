import Link from 'next/link';
import { getAllTags } from '@/lib/db';
import { Tag } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function TagsPage() {
  const tags = getAllTags();

  if (tags.length === 0) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state__icon">&#127991;</div>
          <div className="empty-state__title">No tags yet</div>
          <div className="empty-state__body">
            Tags appear automatically after you upload photos.
          </div>
          <Link href="/upload" className="empty-state__cta">Upload photos</Link>
        </div>
      </div>
    );
  }

  const aiTags = tags.filter((t) => t.type === 'ai');
  const locationTags = tags.filter((t) => t.type === 'location');
  const manualTags = tags.filter((t) => t.type === 'manual');
  const maxCount = tags[0]?.count ?? 1;

  const renderSection = (title: string, sectionTags: (Tag & { count: number })[]) => {
    if (sectionTags.length === 0) return null;
    return (
      <>
        <div className="tag-list__section-title">{title}</div>
        {sectionTags.map((tag) => (
          <Link key={tag.id} href={`/tags/${encodeURIComponent(tag.name)}`} className="tag-row">
            <span className={`tag tag--${tag.type}`}>{tag.type === 'ai' ? 'AI' : tag.type === 'location' ? 'LOC' : 'TAG'}</span>
            <span className="tag-row__name">{tag.name}</span>
            <div className="tag-row__bar">
              <div
                className="tag-row__bar-fill"
                style={{ width: `${(tag.count / maxCount) * 100}%` }}
              />
            </div>
            <span className="tag-row__count">{tag.count}</span>
          </Link>
        ))}
      </>
    );
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-header__title">Tags</h1>
        <p className="page-header__subtitle">{tags.length} tags across your library</p>
      </div>

      <div className="tag-list">
        {renderSection('Location Tags', locationTags)}
        {renderSection('AI Tags', aiTags)}
        {renderSection('Manual Tags', manualTags)}
      </div>
    </div>
  );
}
