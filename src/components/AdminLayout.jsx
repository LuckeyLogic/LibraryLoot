// src/components/AdminLayout.jsx
//
// Shell for the admin dashboard. Side nav on the left (collapses to a
// strip across the top on small screens), <Outlet /> on the right for the
// active admin sub-page. Wrap an admin route tree with this layout so the
// sub-pages don't each have to render their own nav.
//
// Created by Miguel Brown on 5/13/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React              from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth }        from '../context/AuthContext.jsx'

import styles             from './AdminLayout.module.css'

const adminLinks = [
  { to: '/admin',          label: 'Overview', end: true },
  { to: '/admin/settings', label: 'Settings'            },
  { to: '/admin/books',    label: 'Books'               },
  { to: '/admin/avatars',  label: 'Avatars'             }
]

/**
 * AdminLayout — sticky-side-nav + content shell for admin pages.
 *
 * @returns {JSX.Element}
 */
export default function AdminLayout() {

  const { tenantClaim, user } = useAuth()

  return (
    <div className={styles.adminWrap}>

      <aside className={styles.sidebar} aria-label="Admin navigation">

        <div className={styles.sidebarHeader}>
          <p className={styles.eyebrow}>Admin</p>
          <p className={styles.tenant}>
            <span className={styles.tenantLabel}>Tenant</span>
            <span className={styles.tenantId}>{tenantClaim || '—'}</span>
          </p>
          {user ? (
            <p className={styles.who} title={user.email || ''}>
              Signed in as {(user.displayName && user.displayName.trim()) || user.email}
            </p>
          ) : null}
        </div>

        <nav className={styles.nav}>
          {adminLinks.map(({ to, label, end }) => (
            <NavLink
              key       ={to}
              to        ={to}
              end       ={Boolean(end)}
              className ={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

      </aside>

      <main className={styles.content}>
        <Outlet />
      </main>

    </div>
  )
}
