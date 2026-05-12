// src/components/PrivateRoute.jsx
//
// Route guard for pages that require a signed-in user. Wraps children;
// redirects to /login when the user is not authenticated. Preserves the
// page the user originally tried to visit via the `from` location state
// so /login can bounce them back after a successful sign-in.
//
// ITEM 2a places this in the tree but does not yet use it on any routes —
// the first protected route is `/account` in ITEM 2d. Created early so 2b
// (which adds `/admin/setup`) and 2d have a ready-made wrapper.
//
// Created by Miguel Brown on 5/12/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React                       from 'react'
import { Navigate, useLocation }   from 'react-router-dom'

import { useAuth }                 from '../context/AuthContext.jsx'

/**
 * PrivateRoute — renders its children only if a user is signed in. Otherwise
 * redirects to /login with the attempted location preserved.
 *
 * @param   {Object}      props
 * @param   {JSX.Element} props.children  - The page or element to protect.
 * @returns {JSX.Element}
 */
export default function PrivateRoute({ children }) {

  const { user, loading } = useAuth()
  const location          = useLocation()

  if (loading) {
    return null   // Auth state still resolving; render nothing to avoid a flash.
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
