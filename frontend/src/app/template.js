'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { pageTransitionVariants } from '@/lib/motion';

export default function Template({ children }) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <>{children}</>;
  }

  return (
    <motion.div
      variants={pageTransitionVariants}
      initial="hidden"
      animate="visible"
      className="flex-1 flex flex-col w-full"
    >
      {children}
    </motion.div>
  );
}
