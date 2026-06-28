import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import WagmiProvider from './components/WagmiProvider';
import { TronWalletProvider } from './hooks/useTronWallet';
import ConnectWallet from './components/ConnectWallet';
import NavLinks from './components/NavLinks';
import AiAssistant from './components/AiAssistant';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ClawTree · AI-driven University Event OS',
  description:
    'ClawTree — OpenClaw AI Agent powered cross-platform engine for Web3+AI university event discovery, intelligent outreach & trend formation.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={{ color: 'var(--text)' }}>
        <TronWalletProvider>
        <WagmiProvider>
          <header style={{
            borderBottom: '1px solid rgba(255,255,255,0.13)',
            background: 'rgba(7,9,14,0.82)',
            backdropFilter: 'blur(12px)',
          }}>
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
              <div className="flex items-center gap-3">
                <span className="text-xl">🌳</span>
                <span className="text-lg font-bold tracking-tight">
                  Claw<span style={{ color: 'var(--success)' }}>Tree</span>
                </span>
                <span className="hidden sm:inline text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                  树爪智动
                </span>
              </div>
              <NavLinks />
              <ConnectWallet />
            </div>
          </header>
          {children}
        </WagmiProvider>
        </TronWalletProvider>
        <AiAssistant />
      </body>
    </html>
  );
}
