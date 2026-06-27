'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider as Wagmi } from 'wagmi';
import { wagmiConfig } from '../config/wagmi';
import { useState, type ReactNode } from 'react';

export default function WagmiProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <Wagmi config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Wagmi>
  );
}
