// 只包含footer的总布局

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import FooterWrapper from "@/components/layout/FooterWrapper";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AlertProvider } from "@/components/alert-provider";
import { Toaster } from "@/components/ui/sonner";

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
  description: "以题会友，广学天下",
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