'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

// #region Constants
// =============================================================================

const queryClient = new QueryClient();

// #endregion

// #region Main Component
// =============================================================================

export const ReactQueryClientProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>{children}</NuqsAdapter>
    </QueryClientProvider>
  );
};

// #endregion
