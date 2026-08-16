import './globals.css';

export const metadata = {
  title: 'Fulfillment Dashboard',
  description: 'Order and fulfillment tracking',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
