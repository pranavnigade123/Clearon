import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthSessionProvider from "@/components/providers/session-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clearon - Multi-Source RAG Platform",
  description: "Enterprise-grade Retrieval-Augmented Generation platform for processing multiple document types with accurate citations.",
  keywords: ["RAG", "AI", "Document Processing", "Vector Search", "Citations"],
  authors: [{ name: "Clearon Team" }],
  openGraph: {
    title: "Clearon - Multi-Source RAG Platform",
    description: "Enterprise-grade Retrieval-Augmented Generation platform",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthSessionProvider>
          {children}
        </AuthSessionProvider>
      </body>
    </html>
  );
}
