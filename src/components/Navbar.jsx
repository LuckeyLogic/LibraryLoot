// src/components/Navbar.jsx
//
// Sticky top navigation. Mobile-friendly hamburger collapses links below the
// nav bar; brand mark stays visible.
//
// Created by Miguel Brown on 5/12/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React, { useState }    from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import { useAuth }            from '../context/AuthContext.jsx'

import siteContent            from '../data/siteContent.js'

import styles                 from './Navbar.module.css'

const links = [
  { to: '/',             label: 'Home'        },
  { to: '/books',        label: 'Books'       },
  { to: '/about',        label: 'About'       },
  { to: '/for-parents',  label: 'For Parents' },
  { to: '/donors',       label: 'Donors'      },
  { to: '/faq',          label: 'FAQ'         }
]

/**
 * Navbar — sticky top navigation with brand mark and primary links plus
 * an auth slot on the right (Sign in / Sign up when signed out, display
 * name + Sign out when signed in).
 *
 * @returns {JSX.Element}
 */
export default function Navbar() {

  const { user, isAdmin, signOut } = useAuth()
  const navigate                   = useNavigate()
  const [open, setOpen]            = useState(false)

  const closeMenu = () => setOpen(false)

  const handleSignOut = async () => {
    closeMenu()
    try {
      await signOut()
      navigate('/', { replace: true })
    } catch (e) {
      // signOut() already surfaced via context error; swallow here.
    }
  }

  // Greeting precedence: displayName first name → email local-part (first
  // segment before any dot) → generic fallback. Never the full email — it's
  // long, sensitive-feeling, and the cap-12-char ellipsis was hiding the @ symbol.
  const greeting = (() => {
    if (!user) return null
    if (user.displayName && user.displayName.trim().length > 0) {
      return user.displayName.trim().split(' ')[0]
    }
    if (user.email) {
      return user.email.split('@')[0].split('.')[0]
    }
    return 'there'
  })()

  return (
    <header className={styles.navWrap}>
      <div className={`container ${styles.navInner}`}>

        <Link to="/" className={styles.brand} onClick={closeMenu}>
          <span className={styles.brandGlyph} aria-hidden="true">⚡</span>
          <span className={styles.brandText}>{siteContent.brand.name}</span>
        </Link>

        <button
          type="button"
          className={styles.toggle}
          aria-label="Toggle navigation menu"
          aria-expanded={open}
          onClick={() => setOpen(prev => !prev)}
        >
          <span className={styles.toggleBar} />
          <span className={styles.toggleBar} />
          <span className={styles.toggleBar} />
        </button>

        <nav className={`${styles.links} ${open ? styles.linksOpen : ''}`}>
          {links.map(({ to, label }) => (
            <NavLink
              key       ={to}
              to        ={to}
              end       ={to === '/'}
              onClick   ={closeMenu}
              className ={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              {label}
            </NavLink>
          ))}

          <span className={styles.navDivider} aria-hidden="true" />

          {user ? (
            <>
              <NavLink
                to        ="/account"
                onClick   ={closeMenu}
                className ={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
                }
              >
                My account
              </NavLink>
              {isAdmin ? (
                <NavLink
                  to        ="/admin"
                  onClick   ={closeMenu}
                  className ={({ isActive }) =>
                    `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
                  }
                >
                  Admin
                </NavLink>
              ) : null}
              <span className={styles.greeting} title={user.email || ''}>
                Hi, {greeting}
              </span>
              <button
                type      ="button"
                onClick   ={handleSignOut}
                className ={styles.navAction}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <NavLink
                to        ="/login"
                onClick   ={closeMenu}
                className ={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
                }
              >
                Sign in
              </NavLink>
              <Link
                to        ="/signup"
                onClick   ={closeMenu}
                className ={styles.navCta}
              >
                Sign up
              </Link>
            </>
          )}
        </nav>

      </div>
    </header>
  )
}
