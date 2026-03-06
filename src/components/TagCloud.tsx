'use client';

import Link from 'next/link';
import { Tag } from '@/lib/db';

interface Props {
  tags: (Tag & { count: number })[];
  max?: number;
}

export default function TagCloud({ tags, max = 20 }: Props) {
  const visible = tags.slice(0, max);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {visible.map((tag) => (
        <Link
          key={tag.id}
          href={`/tags/${encodeURIComponent(tag.name)}`}
          className={`tag tag--${tag.type}`}
          style={{ fontSize: '0.78rem', padding: '4px 10px' }}
        >
          {tag.name}
          <span style={{ opacity: 0.6, marginLeft: 4 }}>{tag.count}</span>
        </Link>
      ))}
      {tags.length > max && (
        <Link href="/tags" className="tag tag--ai">
          +{tags.length - max} more
        </Link>
      )}
    </div>
  );
}
