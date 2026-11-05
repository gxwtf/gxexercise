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
  // Next 只输出标准的 mobile-web-app-capable；iOS 老版本仍认 apple- 前缀，这里补上
  other: {
    "apple-mobile-web-app-capable": "yes",
    "format-detection": "telephone=no",
    "msapplication-TileColor": "#ffffff",
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
  // 与主屏相关（状态栏/标题栏）统一用白/黑，不用品牌红
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/*
          百度统计（hm.js）。按百度官方要求放在 </head> 之前，一处安装全站生效。
          根布局渲染本应用全部路由，加这一次即可覆盖整个题库站（ti.gxwtf.cn）。
          ID 是本项目专属的站点 ID，与主站 gxwtf.cn、古诗文站的 ID 都不同。
        */}
        <script
          id="baidu-tongji"
          dangerouslySetInnerHTML={{
            __html: `var _hmt = _hmt || [];
(function() {
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?b6b891606d102524c218a10594ad7139";
  var s = document.getElementsByTagName("script")[0];
  s.parentNode.insertBefore(hm, s);
})();`,
          }}
        />
      </head>
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