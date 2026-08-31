import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ScriptStock',
  description: 'Community Prescription Stock Tracker',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="m-0 p-0 overflow-hidden">{children}</body>
    </html>
  );
}