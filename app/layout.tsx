import type { Metadata } from 'next';
import { DM_Sans, Fraunces } from 'next/font/google';
import '@livekit/components-styles';
import { AuthProvider } from '@/lib/firebase/auth-context';
import './globals.css';

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
});

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'LiveDesk — Video reps for your website',
  description:
    'Embed a video call widget on your site. Visitors talk to a real representative — with a live queue when you are busy.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${fraunces.variable} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
