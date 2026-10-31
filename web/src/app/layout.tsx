import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "룸픽 (RoomPick)",
  description: "경영대 빈 강의실을 실시간으로 Pick",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
