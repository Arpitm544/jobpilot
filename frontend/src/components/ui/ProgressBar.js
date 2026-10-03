'use client';

import React, { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// Lightweight top progress bar — pure CSS, no heavy dependency
// Inspired by nprogress but without the jQuery dep
let timer = null;
let activeRequests = 0;

export function startProgress() {
  activeRequests++;
  if (typeof document === 'undefined') return;
  const bar = document.getElementById('jp-progress-bar');
  if (!bar) return;
  bar.style.opacity = '1';
  bar.style.width = '30%';
  bar.style.transition = 'width 0.4s ease';
  clearTimeout(timer);
  timer = setTimeout(() => {
    bar.style.width = '70%';
  }, 400);
}

export function finishProgress() {
  activeRequests = Math.max(0, activeRequests - 1);
  if (activeRequests > 0) return;
  if (typeof document === 'undefined') return;
  const bar = document.getElementById('jp-progress-bar');
  if (!bar) return;
  clearTimeout(timer);
  bar.style.width = '100%';
  bar.style.transition = 'width 0.15s ease';
  timer = setTimeout(() => {
    bar.style.opacity = '0';
    bar.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      bar.style.width = '0%';
      bar.style.transition = 'none';
    }, 300);
  }, 150);
}

export default function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevPathRef = useRef(null);

  useEffect(() => {
    if (prevPathRef.current !== null && prevPathRef.current !== pathname) {
      // Route changed — show a quick flash
      startProgress();
      const t = setTimeout(finishProgress, 350);
      return () => clearTimeout(t);
    }
    prevPathRef.current = pathname;
  }, [pathname, searchParams]);

  return (
    <>
      <style>{`
        #jp-progress-bar {
          position: fixed;
          top: 0;
          left: 0;
          width: 0%;
          height: 2px;
          background: linear-gradient(to right, #6366f1, #22d3ee);
          z-index: 9999;
          opacity: 0;
          pointer-events: none;
        }
      `}</style>
      <div id="jp-progress-bar" aria-hidden="true" />
    </>
  );
}
