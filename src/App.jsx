/**
 * Top-level router + layout shell for Library Loot.
 * @module App
 */
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
import PrivateRoute           from './components/PrivateRoute.jsx'
import AdminRoute             from './components/AdminRoute.jsx'
import AdminLayout            from './components/AdminLayout.jsx'

import Home                   from './pages/Home.jsx'
import About                  from './pages/About.jsx'
import Books                  from './pages/Books.jsx'
import BookDetail             from './pages/BookDetail.jsx'
import Donors                 from './pages/Donors.jsx'
import Sponsor                from './pages/Sponsor.jsx'
import Login                  from './pages/Login.jsx'
import Signup                 from './pages/Signup.jsx'
import AdminSetup             from './pages/AdminSetup.jsx'
import AdminIndex             from './pages/admin/AdminIndex.jsx'
import AdminSettings          from './pages/admin/AdminSettings.jsx'
import AdminBooks             from './pages/admin/AdminBooks.jsx'
import AdminAvatars           from './pages/admin/AdminAvatars.jsx'
import FAQ                    from './pages/FAQ.jsx'
import ForParents             from './pages/ForParents.jsx'
import Account                from './pages/Account.jsx'
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
          <Route path="/"            element={<Home />}       />
          <Route path="/about"       element={<About />}      />
          <Route path="/books"       element={<Books />}      />
          <Route path="/books/:isbn" element={<BookDetail />} />
          <Route path="/donors"      element={<Donors />}     />
          <Route path="/sponsor"     element={<Sponsor />}    />
          <Route path="/login"   element={<Login />}   />
          <Route path="/signup"  element={<Signup />}  />
          <Route
            path   ="/admin/setup"
            element={
              <PrivateRoute>
                <AdminSetup />
              </PrivateRoute>
            }
          />
          <Route
            path   ="/account"
            element={
              <PrivateRoute>
                <Account />
              </PrivateRoute>
            }
          />
          <Route
            path   ="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index            element={<AdminIndex />}    />
            <Route path="settings"  element={<AdminSettings />} />
            <Route path="books"     element={<AdminBooks />}    />
            <Route path="avatars"   element={<AdminAvatars />}  />
          </Route>
          <Route path="/faq"          element={<FAQ />}        />
          <Route path="/for-parents"  element={<ForParents />} />
          <Route path="/terms"        element={<Terms />}      />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*"        element={<NotFound />} />
        </Routes>
      </main>

      <Footer />
    </div>
  )
}
