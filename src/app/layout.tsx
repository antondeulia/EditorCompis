import type { Metadata } from "next";
import { Archivo_Black, Geist_Mono } from "next/font/google";
import "./globals.css";

const uiSans = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
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
      <body className={`${uiSans.className} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
