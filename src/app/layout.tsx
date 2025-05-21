
import type {Metadata} from 'next';
import { Inter, Roboto_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: '--font-sans', // Changed from --font-geist-sans
  subsets: ['latin'],
});

const robotoMono = Roboto_Mono({
  variable: '--font-mono', // Changed from --font-geist-mono
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Student Companion',
  description: 'AI-Powered General Knowledge Quiz and Student Helper',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${robotoMono.variable} antialiased font-sans`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
