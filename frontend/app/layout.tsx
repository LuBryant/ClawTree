import type { Metadata } from 'next';
import './globals.css';
import TopNav from './components/TopNav';
import HumanSupportLink from './components/HumanSupportLink';
import AiAssistant from './components/AiAssistant';
import WagmiProvider from './components/WagmiProvider';
import { TronWalletProvider } from './hooks/useTronWallet';
import { LanguageProvider } from './i18n/LanguageProvider';
import BrandLink from './components/BrandLink';

export const metadata: Metadata = {
  title: 'ClawTree · AI Partnership Intelligence Network｜AI 合作增长网络',
  description:
    'Turn public signals into trusted partnerships with sourced intelligence, human-reviewed action, and verifiable proof. 把公共信号转成可信机会、人审行动与可验证合作成果。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <LanguageProvider>
          <WagmiProvider>
            <TronWalletProvider>
              <header className="site-header">
                <div className="nav-wrap">
                  <BrandLink />
                  <div className="flex items-center gap-6">
                    <HumanSupportLink />
                    <TopNav />
                  </div>
                </div>
              </header>
              {children}
              <AiAssistant />
            </TronWalletProvider>
          </WagmiProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
