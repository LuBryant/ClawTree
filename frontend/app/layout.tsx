import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'ClawTree · AI 媒体活动增长操作系统',
  description:
    '把高校与热点信号转成可审核的选题、合作名单、个性化外联和可验证执行凭证。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <header className="site-header">
          <div className="nav-wrap">
            <Link href="/" className="brand" aria-label="ClawTree 首页">
              <span className="brand-mark">CT</span>
              <span>ClawTree <small>树爪智动</small></span>
            </Link>
            <nav className="top-nav" aria-label="主导航">
              <Link href="/demo">现场 Demo</Link>
              <Link href="/admin">运营台</Link>
              <a href="https://treefinance.co" target="_blank" rel="noreferrer">大树财经</a>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
