// src/App.jsx
//
// Top-level router + layout shell for Library Loot.
//
// Created by Miguel Brown on 5/12/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React                  from 'react'
import { Routes, Route }      from 'react-router-dom'

import Navbar                 from './components/Navbar.jsx'
import Footer                 from './components/Footer.jsx'

import Home                   from './pages/Home.jsx'
import About                  from './pages/About.jsx'
import Donors                 from './pages/Donors.jsx'
import Sponsor                from './pages/Sponsor.jsx'
import Terms                  from './pages/Terms.jsx'
import Privacy                from './pages/Privacy.jsx'
import NotFound               from './pages/NotFound.jsx'

import styles                 from './App.module.css'

/**
 * App — root component. Renders the persistent layout (Navbar + Footer) and
 * routes between top-level pages.
 *
 * @returns {JSX.Element}
 */
export default function App() {
  return (
    <div className={styles.appShell}>
      <Navbar />

      <main className={styles.appMain}>
        <Routes>
          <Route path="/"        element={<Home />}    />
          <Route path="/about"   element={<About />}   />
          <Route path="/donors"  element={<Donors />}  />
          <Route path="/sponsor" element={<Sponsor />} />
          <Route path="/terms"   element={<Terms />}   />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*"        element={<NotFound />} />
        </Routes>
      </main>

      <Footer />
    </div>
  )
}
