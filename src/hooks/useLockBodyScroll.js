/**
 * Hook that prevents background-page scrolling while a modal / overlay is
 * mounted. Standard pattern: set body.style.overflow = 'hidden' on mount,
 * restore the previous value on unmount. Used by the IsbnScanner camera overlay
 * and (via inline useEffect) by the avatar lightbox in AdminAvatars.
 * @module hooks/useLockBodyScroll
 */
// src/hooks/useLockBodyScroll.js
//
// Hook that prevents background-page scrolling while a modal / overlay
// is mounted. Standard pattern: set body.style.overflow = 'hidden' on
// mount, restore the previous value on unmount.
//
// Used by the IsbnScanner camera overlay and (via inline useEffect) by
// the avatar lightbox in AdminAvatars.
//
// Created by Miguel Brown on 5/14/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import { useEffect } from 'react'

/**
 * useLockBodyScroll — locks body scroll for the lifetime of the calling
 * component. Restores whatever overflow value was set before on unmount.
 *
 * @returns {void}
 */
export default function useLockBodyScroll() {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])
}
