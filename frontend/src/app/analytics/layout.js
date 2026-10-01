'use client';

import React from 'react';
import AuthGuard from '@/components/auth/AuthGuard';

export default function AnalyticsLayout({ children }) {
  return <AuthGuard>{children}</AuthGuard>;
}
