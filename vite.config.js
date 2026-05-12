// vite.config.js
//
// Build configuration for Library Loot.
// Created by Miguel Brown on 5/12/26.
// Copyright © 2026 Luckey Logic LLC. All rights reserved.

import { defineConfig } from 'vite'
import react             from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server : {
    port      : 5173,
    strictPort: false,
    open      : false
  },
  build  : {
    outDir       : 'dist',
    sourcemap    : false,
    chunkSizeWarningLimit: 900
  }
})
