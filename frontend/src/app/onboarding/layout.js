'use client';

import React from 'react';
import AuthGuard from '@/components/auth/AuthGuard';

export default function OnboardingLayout({ children }) {
  return <AuthGuard>{children}</AuthGuard>;
}
