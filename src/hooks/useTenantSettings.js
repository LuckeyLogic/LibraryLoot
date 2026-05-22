/**
 * Live subscription to the active tenant's settings doc at /{tenantId}/_main.
 * Returns the operator contact info (`support`), the optional legal supplements
 * (`legal`), and a merged catch-all `settings` object. Falls back to
 * siteContent.* defaults when a field is missing — so the public About / Privacy
 * / Terms pages render cleanly the moment the React app mounts, even before
 * Firestore has responded. Firestore rules allow public read on `_main` so
 * anonymous visitors get the live operator contact too…
 * @module hooks/useTenantSettings
 */
// src/hooks/useTenantSettings.js
//
// Live subscription to the active tenant's settings doc at /{tenantId}/_main.
// Returns the operator contact info (`support`), the optional legal
// supplements (`legal`), and a merged catch-all `settings` object. Falls
// back to siteContent.* defaults when a field is missing — so the public
// About / Privacy / Terms pages render cleanly the moment the React app
// mounts, even before Firestore has responded.
//
// Firestore rules allow public read on `_main` so anonymous visitors get
// the live operator contact too (see firestore.rules — ITEM 2c + 2e.1).
//
// Created by Miguel Brown on 5/13/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import { useEffect, useState }  from 'react'
import { onSnapshot }            from 'firebase/firestore'

import { tenantDoc }             from '../firebase/tenant.js'
import siteContent               from '../data/siteContent.js'

/**
 * useTenantSettings — subscribes to `/{tenantId}/_main` and exposes the
 * tenant's live settings with siteContent fallbacks for unset fields.
 *
 * @returns {{
 *   settings: Object | null,
 *   support : Object,
 *   legal   : Object,
 *   loading : boolean,
 *   error   : Error | null
 * }}
 */
export default function useTenantSettings() {

  const [settings, setSettings] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    const ref   = tenantDoc()
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setSettings(snap.exists() ? snap.data() : null)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])

  // Merge live tenant settings on top of siteContent defaults. Each field
  // resolves independently so a partially-populated _main still produces
  // a fully-populated `support` block in the consumer.
  const tenantSupport = (settings && settings.support) || {}
  const tenantLegal   = (settings && settings.legal)   || {}

  const support = {
    organizationName    : tenantSupport.organizationName    || siteContent.support.organizationName,
    programContactEmail : tenantSupport.programContactEmail || siteContent.support.programContactEmail,
    coppaContactEmail   : tenantSupport.coppaContactEmail   || siteContent.support.coppaContactEmail,
    privacyContactEmail : tenantSupport.privacyContactEmail || siteContent.support.programContactEmail,
    operatorAddress     : tenantSupport.operatorAddress     || null,
    contactBlurb        : tenantSupport.contactBlurb        || siteContent.support.contactBlurb
  }

  const legal = {
    privacyPolicySupplement          : tenantLegal.privacyPolicySupplement          || null,
    privacyPolicySupplementUpdatedAt : tenantLegal.privacyPolicySupplementUpdatedAt || null,
    termsSupplement                  : tenantLegal.termsSupplement                  || null,
    termsSupplementUpdatedAt         : tenantLegal.termsSupplementUpdatedAt         || null
  }

  return { settings, support, legal, loading, error }
}
