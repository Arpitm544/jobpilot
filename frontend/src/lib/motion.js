'use client';

// Shared Easing Curves & Springs
export const TRANSITION_SPRING = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
};

export const TRANSITION_SOFT = {
  duration: 0.35,
  ease: [0.16, 1, 0.3, 1],
};

export const TRANSITION_FAST = {
  duration: 0.2,
  ease: 'easeOut',
};

// Fade Variants
export const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: TRANSITION_SOFT,
  },
};

export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: TRANSITION_SOFT,
  },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: TRANSITION_SPRING,
  },
};

export const slideIn = (direction = 'right') => ({
  hidden: {
    opacity: 0,
    x: direction === 'left' ? -20 : direction === 'right' ? 20 : 0,
    y: direction === 'up' ? 20 : direction === 'down' ? -20 : 0,
  },
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: TRANSITION_SOFT,
  },
});

// Stagger Container for Grids and Lists
export const staggerContainer = (staggerDelay = 0.06, delayChildren = 0.04) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: staggerDelay,
      delayChildren: delayChildren,
    },
  },
});

// Interactive Micro-Interactions (Hover & Tap)
export const buttonTapScale = {
  scale: 0.97,
  transition: { duration: 0.1 },
};

export const cardHoverLift = {
  y: -2,
  transition: { duration: 0.2, ease: 'easeOut' },
};

// Modal Animation Variants
export const modalOverlayVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

export const modalContentVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: TRANSITION_SPRING,
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 8,
    transition: { duration: 0.15 },
  },
};

// Toast Variants
export const toastVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.94 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: TRANSITION_SPRING,
  },
  exit: {
    opacity: 0,
    y: 10,
    scale: 0.94,
    transition: { duration: 0.18 },
  },
};

// Route Template Transition
export const pageTransitionVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
  },
};
