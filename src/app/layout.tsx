// 只包含footer的总布局

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import FooterWrapper from "@/components/layout/FooterWrapper";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AlertProvider } from "@/components/alert-provider";
import { Toaster } from "@/components/ui/sonner";
import { WebAppManager } from "@/components/WebAppManager";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "广学题库",
  description: "以题会友，广学天下 —— 北京高考真题、一模、二模、期末试卷在线练习",
  applicationName: "广学题库",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "广学题库",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#A31F24" },
    { media: "(prefers-color-scheme: dark)", color: "#8a1010" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AlertProvider>
          <ThemeProvider>
            <WebAppManager />
            <div className="min-h-screen flex flex-col">
              {children}
              <FooterWrapper />
            </div>
            <Toaster />
          </ThemeProvider>
        </AlertProvider>
      </body>
    </html>
  );
}