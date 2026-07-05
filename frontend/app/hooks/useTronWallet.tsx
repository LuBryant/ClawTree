'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { TronLinkProvider } from '../config/tron';

interface WalletState {
  address: string | null;
  balance: string | null;
  network: 'nile' | 'shasta' | 'mainnet' | 'unknown';
  walletType: 'tronlink' | 'okx' | null;
  isConnected: boolean;
}

interface TronWalletContextType extends WalletState {
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const TronWalletContext = createContext<TronWalletContextType>({
  address: null,
  balance: null,
  network: 'unknown',
  walletType: null,
  isConnected: false,
  error: null,
  connect: async () => {},
  disconnect: () => {},
});

function detectNetwork(host: string): WalletState['network'] {
  if (host.includes('nile')) return 'nile';
  if (host.includes('shasta')) return 'shasta';
  if (host.includes('api.trongrid.io')) return 'mainnet';
  return 'unknown';
}

export function TronWalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    address: null,
    balance: null,
    network: 'unknown',
    walletType: null,
    isConnected: false,
  });
  const [error, setError] = useState<string | null>(null);

  const connectTronLink = useCallback(async () => {
    const tw = window.tronWeb as TronLinkProvider | undefined;
    if (!tw?.ready) throw new Error('TronLink not ready');

    const address = tw.defaultAddress?.base58;
    if (!address) throw new Error('No address found');

    const balanceSun = await tw.trx.getBalance(address);
    const balance = tw.fromSun(balanceSun);
    const network = detectNetwork(tw.fullNode?.host || '');

    setState({
      address,
      balance: `${Number(balance).toFixed(2)} TRX`,
      network,
      walletType: 'tronlink',
      isConnected: true,
    });
    setError(null);
  }, []);

  const connectOKX = useCallback(async () => {
    const okx = window.okxwallet?.tronLink;
    if (!okx) throw new Error('OKX Wallet not found');

    await okx.request({ method: 'tron_requestAccounts' });

    const tw = (okx.tronWeb || window.tronWeb) as TronLinkProvider | undefined;
    if (!tw) throw new Error('OKX tronWeb not available');

    const address = tw.defaultAddress?.base58 || (tw as unknown as { address: string }).address;
    if (!address) throw new Error('No address found');

    const balanceSun = await tw.trx.getBalance(address);
    const balance = tw.fromSun(balanceSun);
    const network = detectNetwork(tw.fullNode?.host || '');

    setState({
      address,
      balance: `${Number(balance).toFixed(2)} TRX`,
      network,
      walletType: 'okx',
      isConnected: true,
    });
    setError(null);
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    if (typeof window !== 'undefined' && window.tronWeb?.ready) {
      try { await connectTronLink(); return; } catch { /* fall through */ }
    }
    if (typeof window !== 'undefined' && window.okxwallet?.tronLink) {
      try { await connectOKX(); return; } catch { /* fall through */ }
    }
    setError('请安装 TronLink 或 OKX 钱包，并切换到 TRON Nile 测试网');
  }, [connectTronLink, connectOKX]);

  const disconnect = useCallback(() => {
    setState({
      address: null,
      balance: null,
      network: 'unknown',
      walletType: null,
      isConnected: false,
    });
    setError(null);
  }, []);

  // Listen for account changes
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.action === 'accountsChanged') connect();
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [connect]);

  // 页面加载时自动重连（刷新后恢复钱包状态）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // TronLink 扩展注入可能有延迟，轮询等待
    let attempts = 0;
    const tryConnect = () => {
      const tw = window.tronWeb;
      if (tw?.ready && tw.defaultAddress?.base58) {
        connect();
        return;
      }
      if (++attempts < 10) {
        setTimeout(tryConnect, 300);
      }
    };
    setTimeout(tryConnect, 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TronWalletContext.Provider value={{ ...state, error, connect, disconnect }}>
      {children}
    </TronWalletContext.Provider>
  );
}

/** Hook to access shared TRON wallet state from any component. */
export function useTronWallet() {
  return useContext(TronWalletContext);
}
