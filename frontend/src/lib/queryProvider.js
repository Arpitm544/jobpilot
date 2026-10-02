'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 30s — avoids redundant refetches on tab focus / remount
        staleTime: 30 * 1000,
        // Keep unused cache for 5 minutes
        gcTime: 5 * 60 * 1000,
        // Don't refetch every time the user focuses the window
        refetchOnWindowFocus: false,
        // Retry once on failure, with a short delay
        retry: 1,
        retryDelay: 1000,
      },
      mutations: {
        // Never auto-retry mutations
        retry: false,
      },
    },
  });
}

let browserQueryClient = null;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client to avoid sharing state between requests
    return makeQueryClient();
  }
  // Browser: reuse a singleton so the cache persists across page navigations
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

export default function QueryProvider({ children }) {
  // Avoid useState so we use the singleton
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// Export the singleton for use in prefetching and imperative cache updates
export { getQueryClient };
