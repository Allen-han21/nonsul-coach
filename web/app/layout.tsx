import type { Metadata } from 'next';
import './globals.css';
const title = '논술코치 | 성신여자대학교 인문계열';
const description =
  '공식 논술 가이드북에 근거해 답안의 논리를 점검하고 스스로 수정하는 학생용 논술 연습 공간.';
// Only an operator-supplied deployment origin is trusted. No request host headers.
function previewOrigin() {
  if (!process.env.SITE_ORIGIN) return 'http://localhost:3000';
  const url = new URL(process.env.SITE_ORIGIN);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('Invalid SITE_ORIGIN');
  return url.origin;
}
const origin = previewOrigin();
const preview = {
  url: `${origin}/og.png`,
  width: 1730,
  height: 909,
  alt: '논술코치 · 내 글의 논리를 살펴보세요. 성신여자대학교 인문계열',
};
export const metadata: Metadata = {
  title,
  description,
  robots: { index: false, follow: false },
  metadataBase: new URL(origin),
  openGraph: {
    title,
    description,
    locale: 'ko_KR',
    type: 'website',
    images: [preview],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [preview],
  },
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
