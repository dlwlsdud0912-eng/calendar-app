import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const notoSansKR = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "캘린더끝판왕",
  description: "AI 캘린더 - 일정 관리의 끝판왕",
  other: {
    'color-scheme': 'light only',
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" style={{ colorScheme: 'light' }} data-theme="light">
      <body className={`${notoSansKR.variable} antialiased`}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
