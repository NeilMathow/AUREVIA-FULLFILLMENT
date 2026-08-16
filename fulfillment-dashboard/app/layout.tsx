import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fulfillment Dashboard',
  description: 'Order and fulfillment tracking',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
