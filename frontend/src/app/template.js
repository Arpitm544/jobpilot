'use client';

import React from 'react';
import { LazyMotion, m, useReducedMotion } from 'framer-motion';
import { pageTransitionVariants } from '@/lib/motion';

// Load only the domAnimation feature set (~15 KB vs full ~50 KB)
const loadFeatures = () => import('@/lib/motionFeatures').then(mod => mod.default);

export default function Template({ children }) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <>{children}</>;
  }

  return (
    <LazyMotion features={loadFeatures} strict>
      <m.div
        variants={pageTransitionVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 flex flex-col w-full"
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
