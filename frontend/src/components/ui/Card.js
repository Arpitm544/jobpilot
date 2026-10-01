'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function Card({
  children,
  className = '',
  interactive = false,
  elevated = false,
  onClick,
  ...props
}) {
  const baseClasses = elevated
    ? 'glass-panel-elevated rounded-2xl p-6 relative overflow-hidden'
    : 'glass-panel rounded-2xl p-6 relative overflow-hidden';

  if (interactive) {
    return (
      <motion.div
        whileHover={{ y: -2, borderColor: 'rgba(99, 102, 241, 0.4)' }}
        whileTap={{ scale: 0.99 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={onClick}
        className={`${baseClasses} glass-panel-hover cursor-pointer ${className}`}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={`${baseClasses} ${className}`} {...props}>
      {children}
    </div>
  );
}
