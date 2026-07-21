import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '온라인 재고관리 Agent',
  description: '뉴발란스 온라인 재고관리 Agent · AI가 24시간 3채널 재고를 실시간 재배치합니다.',
  robots: 'noindex, nofollow',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
