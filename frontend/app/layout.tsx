import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import WagmiProvider from './components/WagmiProvider';
import { TronWalletProvider } from './hooks/useTronWallet';
import ConnectWallet from './components/ConnectWallet';
import AiAssistant from './components/AiAssistant';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ClawTree · AI-driven University Event OS',
  description:
    'ClawTree — OpenClaw AI Agent powered cross-platform engine for Web3+AI university event discovery, intelligent outreach & trend formation.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh-CN" suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <TronWalletProvider>
        <WagmiProvider>
          {/* Top navbar */}
          <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
              {/* Brand */}
              <div className="flex items-center gap-3">
                <span className="text-xl">🌳</span>
                <span className="text-lg font-bold tracking-tight">
                  Claw<span className="text-emerald-400">Tree</span>
                </span>
                <span className="hidden sm:inline text-xs text-zinc-500 font-medium">
                  树爪智动
                </span>
              </div>

              {/* Nav links */}
              <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
                <a href="/" className="text-zinc-100 transition hover:text-emerald-400">
                  Dashboard
                </a>
                <a href="#" className="transition hover:text-zinc-200">
                  活动发现
                </a>
                <a href="#" className="transition hover:text-zinc-200">
                  外联管道
                </a>
                <a href="#" className="transition hover:text-zinc-200">
                  趋势
                </a>
              </nav>

              {/* Wallet */}
              <ConnectWallet />
            </div>
          </header>

          {/* Page content */}
          {children}
        </WagmiProvider>
        </TronWalletProvider>
        <AiAssistant />
      </body>
    </html>
  );
}
