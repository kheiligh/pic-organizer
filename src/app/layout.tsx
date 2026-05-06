import type { Metadata } from 'next';
import Nav from '@/components/Nav';
import { ToastProvider } from '@/components/ToastProvider';
import '@/styles/globals.scss';

export const metadata: Metadata = {
  title: 'pic.organizer',
  description: 'Local photo organizer with AI tagging',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <Nav />
          <main>{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
