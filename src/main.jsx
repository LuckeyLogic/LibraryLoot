// src/main.jsx
//
// React entry point for Library Loot.
//
// Created by Miguel Brown on 5/12/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React               from 'react'
import { createRoot }      from 'react-dom/client'
import { BrowserRouter }   from 'react-router-dom'

import { AuthProvider }    from './context/AuthContext.jsx'

import App                 from './App.jsx'

import './index.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
