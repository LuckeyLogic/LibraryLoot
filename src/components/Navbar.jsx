// src/components/Navbar.jsx
//
// Sticky top navigation. Mobile-friendly hamburger collapses links below the
// nav bar; brand mark stays visible.
//
// Created by Miguel Brown on 5/12/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React, { useState }    from 'react'
import { Link, NavLink }      from 'react-router-dom'

import siteContent            from '../data/siteContent.js'

import styles                 from './Navbar.module.css'

const links = [
  { to: '/',        label: 'Home'    },
  { to: '/about',   label: 'About'   },
  { to: '/donors',  label: 'Donors'  }
]

/**
 * Navbar — sticky top navigation with brand mark and primary links.
 *
 * @returns {JSX.Element}
 */
export default function Navbar() {

  const [open, setOpen] = useState(false)

  const closeMenu = () => setOpen(false)

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
        </nav>

      </div>
    </header>
  )
}
