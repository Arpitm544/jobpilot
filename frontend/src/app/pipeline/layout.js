'use client';

import React from 'react';
import AuthGuard from '@/components/auth/AuthGuard';

export default function PipelineLayout({ children }) {
  return <AuthGuard>{children}</AuthGuard>;
}
