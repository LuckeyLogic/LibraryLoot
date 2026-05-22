// vite.config.js
//
// Build configuration for Library Loot.
//
// Dev server is HTTPS-by-default via vite-plugin-mkcert. iOS Safari
// only exposes `navigator.mediaDevices` (the camera API the barcode
// scanner depends on) in **secure contexts** — meaning HTTPS or
// localhost. A bare-IP LAN URL like http://192.168.x.x:5173 is NOT a
// secure context for Safari, so the scanner returned
// `navigator.mediaDevices is undefined` when the operator tried to
// test on their iPhone over the LAN (surfaced 2026-05-20).
//
// vite-plugin-mkcert auto-generates a local CA on first run, signs a
// cert for localhost + the LAN IP, and serves the dev server over
// HTTPS. After a one-time CA trust on the iPhone (Settings → General
// → About → Certificate Trust Settings → toggle on the mkcert root
// CA), `https://<your-iMac-IP>:5173` works on the phone with the
// camera API available.
//
// Production hosting (Firebase Hosting) is already HTTPS, so this
// only affects local dev — no impact on user-facing builds.
//
// Created by Miguel Brown on 5/12/26.
// Copyright © 2026 Luckey Logic LLC. All rights reserved.

import { defineConfig } from 'vite'
import react             from '@vitejs/plugin-react'
import mkcert            from 'vite-plugin-mkcert'

export default defineConfig({
  plugins: [
    react(),
    // mkcert auto-runs on `npm run dev`. On first run it:
    //   1. Installs a local Certificate Authority into the system
    //      trust store (asks for sudo on macOS/Linux).
    //   2. Generates a cert for localhost + the detected LAN IPs.
    //   3. Caches both in ~/.vite-plugin-mkcert/ for re-use.
    // Subsequent runs reuse the cached cert with no prompts.
    // The cert is dev-only; nothing about this affects `npm run
    // build` or production hosting.
    mkcert()
  ],
  server : {
    port      : 5173,
    strictPort: false,
    open      : false,
    // Bind to all interfaces so the phone can reach the dev server
    // over the LAN. Without this, Vite binds to 127.0.0.1 only and
    // 192.168.x.x doesn't route. Pair with HTTPS (above) so the
    // camera API works on iOS Safari.
    host      : true
  },
  build  : {
    outDir       : 'dist',
    sourcemap    : false,
    chunkSizeWarningLimit: 900
  }
})
