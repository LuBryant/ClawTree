'use client';

import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { defineChain } from 'viem';
import { TRON_NILE } from './tron';

/** Define TRON Nile as a viem chain for wagmi. */
export const tronNileChain = defineChain({
  id: TRON_NILE.id,
  name: TRON_NILE.name,
  nativeCurrency: TRON_NILE.nativeCurrency,
  rpcUrls: TRON_NILE.rpcUrls,
  blockExplorers: TRON_NILE.blockExplorers,
  testnet: true,
});

/** Wagmi config — injected connector (MetaMask / OKX) + TRON Nile RPC. */
export const wagmiConfig = createConfig({
  chains: [tronNileChain],
  connectors: [injected()],
  transports: {
    [tronNileChain.id]: http('https://nile.trongrid.io'),
  },
});
