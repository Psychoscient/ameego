import type { Metadata } from "next";
import { Cormorant_Garamond, Public_Sans } from "next/font/google";
import type { ReactNode } from "react";
// @ts-ignore: CSS module declarations are not yet available
import "./globals.css";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"]
});

const bodyFont = Public_Sans({
  subsets: ["latin"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "Ameego",
  description: "AI speaking coach for hackathon-ready practice loops."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>{children}</body>
    </html>
  );
}
