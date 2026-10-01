'use client';

import React from 'react';
import AuthGuard from '@/components/auth/AuthGuard';

export default function ProfileLayout({ children }) {
  return <AuthGuard>{children}</AuthGuard>;
}
