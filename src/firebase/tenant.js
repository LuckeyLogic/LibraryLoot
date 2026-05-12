// src/firebase/tenant.js
//
// Single source of truth for the active tenant root in Firestore + Storage.
//
// Library Loot is multi-tenant: every Firestore doc lives under the active
// tenant's top-level collection. Code anywhere in the app that needs a
// Firestore reference must go through THIS module — never hardcode a tenant
// ID. When the app eventually resolves the tenant from hostname / claims /
// route, only this file changes.
//
// Storage paths follow the same convention: every object lives under a path
// that begins with the tenant ID.
//
// Created by Miguel Brown on 5/12/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import { collection, doc } from 'firebase/firestore'

import { db }              from '../firebase'

/**
 * The active tenant ID for this deploy.
 *
 * v1: hardcoded to Luckey Logic's hosting tenant.
 * v2 (planned): resolved from hostname or from the authenticated user's
 *   custom claim `tenant`. When v2 lands, replace the constant with a
 *   `useTenant()` hook return value — the function helpers below stay the
 *   same.
 */
export const tenantId = 'luckey-logic'

/**
 * Returns a Firestore doc reference under the active tenant root.
 *
 * Example:
 *   tenantDoc('books', bookId)
 *   → /luckey-logic/_main/books/{bookId}
 *
 * @param   {...string}      pathSegments - Subcollection / doc segments below the tenant root.
 * @returns {DocumentReference}
 */
export const tenantDoc = (...pathSegments) => doc(db, tenantId, '_main', ...pathSegments)

/**
 * Returns a Firestore collection reference under the active tenant root.
 *
 * Example:
 *   tenantCollection('books')
 *   → /luckey-logic/_main/books
 *
 * @param   {...string}          pathSegments - Subcollection segments below the tenant root.
 * @returns {CollectionReference}
 */
export const tenantCollection = (...pathSegments) => collection(db, tenantId, '_main', ...pathSegments)

/**
 * Returns a Firebase Storage path string scoped to the active tenant.
 *
 * Example:
 *   tenantStoragePath('assets', 'hero', 'library-loot-hero-bg.jpg')
 *   → 'luckey-logic/assets/hero/library-loot-hero-bg.jpg'
 *
 * @param   {...string} pathSegments - Path segments below the tenant root.
 * @returns {string}
 */
export const tenantStoragePath = (...pathSegments) => [tenantId, ...pathSegments].join('/')
