import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "工作间 · AI 工具超市",
  description: "探店脚本、工厂宣传、文案、客服、周报等 10 个中文业务工具。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
