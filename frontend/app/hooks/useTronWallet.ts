'use client';

import { useState, useEffect, useCallback } from 'react';
import type { TronLinkProvider } from '../config/tron';
import { FAUCET_URL, EXPLORER_BASE } from '../config/tron';

interface WalletState {
  address: string | null;
  balance: string | null;
  network: 'nile' | 'shasta' | 'mainnet' | 'unknown';
  walletType: 'tronlink' | 'okx' | 'metamask' | 'wagmi' | null;
  isConnected: boolean;
}

/** Detect TRON network from RPC host. */
function detectNetwork(host: string): WalletState['network'] {
  if (host.includes('nile')) return 'nile';
  if (host.includes('shasta')) return 'shasta';
  if (host.includes('api.trongrid.io')) return 'mainnet';
  return 'unknown';
}

/**
 * Hook: dual-wallet connection (TronLink / OKX TRON / MetaMask EVM).
 * Matches the Hackathon reference project's approach.
 */
export function useTronWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    balance: null,
    network: 'unknown',
    walletType: null,
    isConnected: false,
  });
  const [error, setError] = useState<string | null>(null);

  /** Connect via TronLink (window.tronWeb). */
  const connectTronLink = useCallback(async () => {
    try {
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
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }, []);

  /** Connect via OKX Wallet (window.okxwallet.tronLink). */
  const connectOKX = useCallback(async () => {
    try {
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
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }, []);

  /** Main connect: try TronLink → OKX → prompt install. */
  const connect = useCallback(async () => {
    setError(null);
    // 1) TronLink
    if (typeof window !== 'undefined' && window.tronWeb?.ready) {
      try { await connectTronLink(); return; } catch { /* fall through */ }
    }
    // 2) OKX
    if (typeof window !== 'undefined' && window.okxwallet?.tronLink) {
      try { await connectOKX(); return; } catch { /* fall through */ }
    }
    // 3) No wallet
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

  // Listen for account changes (TronLink)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.action === 'accountsChanged') {
        connect();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [connect]);

  return { ...state, error, connect, disconnect };
}

export default useTronWallet;
