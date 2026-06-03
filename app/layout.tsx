import type { Metadata } from 'next';
import './globals.css';
import Nav from '@/components/Nav';

export const metadata: Metadata = {
  title: 'Light — Customer Health',
  description: 'Customer health monitoring for Light ERP',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-[#f8f9fb] text-gray-900">
        <Nav />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
