'use client';

import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';
import { formatUnits } from 'viem';
import { useTronWallet } from '../hooks/useTronWallet';
import { FAUCET_URL } from '../config/tron';

export default function ConnectWallet() {
  // ---- TRON native (TronLink / OKX) ----
  const tron = useTronWallet();

  // ---- EVM via wagmi (MetaMask / OKX EVM mode) ----
  const { address: evmAddress, isConnected: evmConnected, chainId } = useAccount();
  const { connect: wagmiConnect, connectors } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { data: evmBalance } = useBalance({ address: evmAddress });

  const isConnected = tron.isConnected || evmConnected;

  if (isConnected) {
    const displayAddr = tron.address || evmAddress;
    const shortAddr = displayAddr
      ? `${displayAddr.slice(0, 6)}…${displayAddr.slice(-4)}`
      : '';

    return (
      <div className="flex items-center gap-3">
        {/* Balance */}
        <span className="text-sm font-mono text-emerald-400">
          {tron.balance ||
            (evmBalance
              ? `${Number(formatUnits(evmBalance.value, evmBalance.decimals)).toFixed(2)} ${evmBalance.symbol}`
              : '—')}
        </span>

        {/* Network badge */}
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          {tron.network === 'nile'
            ? 'Nile'
            : chainId === 3448148188
              ? 'Nile EVM'
              : 'Connected'}
        </span>

        {/* Address */}
        <span className="text-sm font-mono text-zinc-400">{shortAddr}</span>

        {/* Disconnect */}
        <button
          onClick={() => {
            tron.disconnect();
            wagmiDisconnect();
          }}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 ring-1 ring-zinc-700 hover:bg-zinc-800 hover:text-zinc-200 transition"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // ---- Not connected — show connect options ----
  const injectedConnector = connectors.find((c) => c.type === 'injected');

  return (
    <div className="flex items-center gap-2">
      {/* TRON wallet */}
      <button
        onClick={tron.connect}
        className="rounded-lg bg-gradient-to-r from-red-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-500/25 hover:from-red-400 hover:to-orange-400 transition"
      >
        {tron.error ? '🦊 Retry TronLink' : '🔗 TronLink'}
      </button>

      {/* EVM wallet (MetaMask / OKX) */}
      <button
        onClick={() => {
          if (injectedConnector) wagmiConnect({ connector: injectedConnector });
        }}
        className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-200 ring-1 ring-zinc-700 hover:bg-zinc-700 transition"
      >
        🦊 MetaMask
      </button>

      {/* Faucet link */}
      <a
        href={FAUCET_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg px-3 py-2 text-xs text-zinc-500 ring-1 ring-zinc-800 hover:text-zinc-300 hover:ring-zinc-600 transition"
      >
        💧 Faucet
      </a>

      {/* Error toast */}
      {tron.error && (
        <span
          className="max-w-64 truncate text-xs text-amber-400"
          title={tron.error}
        >
          ⚠ {tron.error}
        </span>
      )}
    </div>
  );
}
