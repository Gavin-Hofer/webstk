'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// #endregion
