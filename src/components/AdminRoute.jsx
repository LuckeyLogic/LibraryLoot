/**
 * Route guard for pages that require an authenticated user with the `admin:
 * true` custom claim on the active tenant. Pages that anyone can reach (e.g.,
 * `/admin/setup`) should use PrivateRoute instead — this wrapper is for pages
 * that REQUIRE existing admin status. Behavior: - Loading auth state → render
 * nothing (avoid flash) - Signed out → redirect to /login with `from` preserved
 * - Signed in but not admin → redirect to / (home) with no message; the home
 * page is a safe landing for any non-admin user
 * @module components/AdminRoute
 */
// src/components/AdminRoute.jsx
//
// Route guard for pages that require an authenticated user with the
// `admin: true` custom claim on the active tenant. Pages that anyone can
// reach (e.g., `/admin/setup`) should use PrivateRoute instead — this
// wrapper is for pages that REQUIRE existing admin status.
//
// Behavior:
//   - Loading auth state → render nothing (avoid flash)
//   - Signed out → redirect to /login with `from` preserved
//   - Signed in but not admin → redirect to / (home) with no message;
//     the home page is a safe landing for any non-admin user
//
// Created by Miguel Brown on 5/12/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React                       from 'react'
import { Navigate, useLocation }   from 'react-router-dom'

import { useAuth }                 from '../context/AuthContext.jsx'

/**
 * AdminRoute — renders children only if the signed-in user has admin
 * custom claims. Bounces non-admins home, unauthenticated users to /login.
 *
 * @param   {Object}      props
 * @param   {JSX.Element} props.children  - The page or element to protect.
 * @returns {JSX.Element}
 */
export default function AdminRoute({ children }) {

  const { user, isAdmin, loading } = useAuth()
  const location                   = useLocation()

  if (loading) {
    return null
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return children
}
