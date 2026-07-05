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
  title: 'ClawTree · AI Media & Event Growth OS｜AI 媒体活动增长操作系统',
  description:
    'Turn campus and trend signals into reviewable campaigns, partner matches, personalized outreach, and verifiable proof. 把高校与热点信号转成可审核的选题、合作名单、个性化外联和可验证执行凭证。',
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
