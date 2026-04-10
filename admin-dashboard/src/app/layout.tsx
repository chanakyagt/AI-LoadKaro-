import type { Metadata } from "next";
import { Geist_Mono, Roboto } from "next/font/google";

import "./globals.css";

/**
 * LoadKaro (Expo / React Native) does not load a custom font — it uses the system UI
 * font (Roboto on Android, San Francisco on iOS). On the web we use Roboto + system
 * fallbacks so the dashboard feels close to the Android app.
 */
const roboto = Roboto({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-roboto",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LoadKaro Admin",
  description: "Admin & moderator web dashboard (demo mode)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${roboto.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
