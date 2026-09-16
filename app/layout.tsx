import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'MEDIA OS — How The World Works',
  description: 'Operational media dashboard for How The World Works.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
