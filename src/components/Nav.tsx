'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Nav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className="nav">
      <div className="container">
        <div className="nav__inner">
          <Link href="/" className="nav__logo">
            pic<span>.</span>organizer
          </Link>
          <ul className="nav__links">
            <li>
              <Link href="/" className={`nav__link ${isActive('/') ? 'active' : ''}`}>
                Home
              </Link>
            </li>
            <li>
              <Link href="/photos" className={`nav__link ${isActive('/photos') ? 'active' : ''}`}>
                All Photos
              </Link>
            </li>
            <li>
              <Link href="/tags" className={`nav__link ${isActive('/tags') ? 'active' : ''}`}>
                Tags
              </Link>
            </li>
          </ul>
          <Link href="/upload" className="nav__upload-btn">
            + Upload
          </Link>
        </div>
      </div>
    </nav>
  );
}
