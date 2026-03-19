import type { Metadata } from "next";
import { Geist_Mono, Nunito } from "next/font/google";
import "./globals.css";

const uiSans = Nunito({
  variable: "--font-ui-sans",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Editor Compis",
  description: "AI-powered video editor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${uiSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
