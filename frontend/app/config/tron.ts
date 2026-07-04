/**
 * TRON Nile Testnet configuration — EVM-compatible chain.
 *
 * Chain ID: 3448148188
 * RPC:      https://nile.trongrid.io
 * Explorer: https://nile.tronscan.org
 * Currency: TRX (6 decimals)
 */
export const TRON_NILE = {
  id: 3448148188,
  name: 'TRON Nile Testnet',
  nativeCurrency: {
    name: 'TRX',
    symbol: 'TRX',
    decimals: 6,
  },
  rpcUrls: {
    default: { http: ['https://nile.trongrid.io/jsonrpc'] },
  },
  blockExplorers: {
    default: {
      name: 'TronScan Nile',
      url: 'https://nile.tronscan.org',
    },
  },
  testnet: true,
} as const;

export const EXPLORER_BASE = 'https://nile.tronscan.org';

export const FAUCET_URL = 'https://nileex.io/join/getJoinPage';

/** Contract addresses deployed on TRON Nile (filled after deploy). */
export const CONTRACTS = {
  EventRegistry: '',
  OutreachRecord: 'TM33ZtfZg4ZTHAQXSe7gd6j92cQDqAjzC3',
  TrendOracle: '',
} as const;

/** TronLink window type (injected by TronLink browser extension). */
export interface TronLinkProvider {
  ready: boolean;
  defaultAddress: {
    base58: string;
    hex: string;
  };
  fullNode: {
    host: string;
  };
  trx: {
    getBalance: (address: string) => Promise<number>;
  };
  fromSun: (sun: number) => string;
  sha3: (input: string) => string;
  address: {
    toHex: (base58: string) => string;
  };
  contract: (abi: unknown[], address?: string) => Promise<{
    recordOutreach: (...args: string[]) => { send: (opts: Record<string, unknown>) => Promise<unknown> };
    setRecorder: (addr: string, authorized: boolean) => { send: (opts: Record<string, unknown>) => Promise<unknown> };
    recorders: (addr: string) => { call: () => Promise<boolean> };
    outreachCount: () => { call: () => Promise<{ toString: () => string }> };
  }>;
}

declare global {
  interface Window {
    tronWeb?: TronLinkProvider;
    okxwallet?: {
      tronLink: {
        request: (args: { method: string }) => Promise<{ code: number; message: string }>;
        tronWeb?: TronLinkProvider;
      };
    };
  }
}
