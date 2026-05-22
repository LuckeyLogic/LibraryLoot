/**
 * Admin editor for `/{tenantId}/_main.support` and `_main.legal.*`. Two
 * sections: 1. Support contact — operator name + program / COPPA / privacy
 * emails + optional mailing address + a free-text blurb. Surfaces on About,
 * Privacy, Terms. 2. Legal supplements — optional plain-text supplements that
 * render below the platform's base Privacy / Terms (see SPEC.md §7.2 for the
 * base-vs-supplement precedence rules). Writes via setDoc({merge:true}) so we
 * never accidentally clobber other fields in _main…
 * @module pages/admin/AdminSettings
 */
// src/pages/admin/AdminSettings.jsx
//
// Admin editor for `/{tenantId}/_main.support` and `_main.legal.*`.
//
// Two sections:
//   1. Support contact — operator name + program / COPPA / privacy emails +
//      optional mailing address + a free-text blurb. Surfaces on About,
//      Privacy, Terms.
//   2. Legal supplements — optional plain-text supplements that render
//      below the platform's base Privacy / Terms (see SPEC.md §7.2 for
//      the base-vs-supplement precedence rules).
//
// Writes via setDoc({merge:true}) so we never accidentally clobber other
// fields in _main (verification config, entropy, branding, etc.).
//
// Created by Miguel Brown on 5/13/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React, { useEffect, useState } from 'react'
import { Link }                       from 'react-router-dom'
import { serverTimestamp, setDoc }    from 'firebase/firestore'

import useTenantSettings              from '../../hooks/useTenantSettings.js'

import { tenantDoc }                  from '../../firebase/tenant.js'

import styles                         from './Admin.module.css'

/**
 * AdminSettings — operator + legal-supplement editor.
 *
 * @returns {JSX.Element}
 */
export default function AdminSettings() {

  const { settings, loading } = useTenantSettings()

  // Local form state, separate from the live snapshot so the admin can
  // make changes without each keystroke being a Firestore write.
  const [form, setForm] = useState({
    organizationName        : '',
    programContactEmail     : '',
    coppaContactEmail       : '',
    privacyContactEmail     : '',
    operatorAddress         : '',
    contactBlurb            : '',
    privacyPolicySupplement : '',
    termsSupplement         : ''
  })
  const [saving,  setSaving]  = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [error,   setError]   = useState(null)

  // Hydrate the form when the live settings doc arrives. Runs once when
  // `settings` first becomes non-null; subsequent edits stay local.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    if (hydrated || !settings) return
    const support = settings.support || {}
    const legal   = settings.legal   || {}
    setForm({
      organizationName        : support.organizationName        || '',
      programContactEmail     : support.programContactEmail     || '',
      coppaContactEmail       : support.coppaContactEmail       || '',
      privacyContactEmail     : support.privacyContactEmail     || '',
      operatorAddress         : support.operatorAddress         || '',
      contactBlurb            : support.contactBlurb            || '',
      privacyPolicySupplement : legal.privacyPolicySupplement   || '',
      termsSupplement         : legal.termsSupplement           || ''
    })
    setHydrated(true)
  }, [settings, hydrated])

  const onChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setError(null)
    setSavedAt(null)
    setSaving(true)

    try {
      // Strip empty strings → null so the live doc doesn't accumulate
      // empty values. Empties resolve to siteContent defaults via the
      // useTenantSettings fallback chain.
      const blank = (s) => (typeof s === 'string' && s.trim().length > 0 ? s.trim() : null)

      const supplementPrivacy = blank(form.privacyPolicySupplement)
      const supplementTerms   = blank(form.termsSupplement)

      const payload = {
        support: {
          organizationName    : blank(form.organizationName),
          programContactEmail : blank(form.programContactEmail),
          coppaContactEmail   : blank(form.coppaContactEmail),
          privacyContactEmail : blank(form.privacyContactEmail),
          operatorAddress     : blank(form.operatorAddress),
          contactBlurb        : blank(form.contactBlurb)
        },
        legal: {
          privacyPolicySupplement          : supplementPrivacy,
          privacyPolicySupplementUpdatedAt : supplementPrivacy ? serverTimestamp() : null,
          termsSupplement                  : supplementTerms,
          termsSupplementUpdatedAt         : supplementTerms ? serverTimestamp() : null
        }
      }

      await setDoc(tenantDoc(), payload, { merge: true })
      setSavedAt(new Date())
    } catch (e) {
      setError(e.message || 'Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className={styles.page}>

      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Settings</p>
        <h1 className={styles.title}>Operator + legal</h1>
        <p className={styles.lede}>
          These values surface on the public About / Privacy / Terms pages
          immediately when you save. The base policy ships with Library Loot
          and cannot be lowered by a supplement; see{' '}
          <Link to="/privacy">Privacy Policy</Link> and{' '}
          <Link to="/terms">Terms of Service</Link> for the live result.
        </p>
      </header>

      {loading ? (
        <p className="muted">Loading settings…</p>
      ) : (
        <form className={styles.form} onSubmit={handleSave}>

          {/* ── SUPPORT CONTACT ── */}
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Operator contact</legend>
            <p className={styles.fineprint}>
              Shown on the About page and at the bottom of Privacy / Terms. Email
              fields receive COPPA requests, privacy questions, and sponsorship
              inquiries — pick addresses you actually monitor.
            </p>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="org">Organization name</label>
              <input
                id        ="org"
                className ={styles.input}
                value     ={form.organizationName}
                onChange  ={onChange('organizationName')}
                placeholder="Luckey Logic LLC"
                disabled  ={saving}
              />
            </div>

            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="program">Program contact email</label>
                <input
                  id        ="program"
                  type      ="email"
                  className ={styles.input}
                  value     ={form.programContactEmail}
                  onChange  ={onChange('programContactEmail')}
                  placeholder="hello@example.org"
                  disabled  ={saving}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="coppa">COPPA contact email</label>
                <input
                  id        ="coppa"
                  type      ="email"
                  className ={styles.input}
                  value     ={form.coppaContactEmail}
                  onChange  ={onChange('coppaContactEmail')}
                  placeholder="coppa@example.org"
                  disabled  ={saving}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="privacy">Privacy contact email</label>
                <input
                  id        ="privacy"
                  type      ="email"
                  className ={styles.input}
                  value     ={form.privacyContactEmail}
                  onChange  ={onChange('privacyContactEmail')}
                  placeholder="privacy@example.org"
                  disabled  ={saving}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="addr">Mailing address (optional)</label>
              <input
                id        ="addr"
                className ={styles.input}
                value     ={form.operatorAddress}
                onChange  ={onChange('operatorAddress')}
                placeholder="123 Main St, City, ST 12345"
                disabled  ={saving}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="blurb">About-page blurb</label>
              <textarea
                id        ="blurb"
                className ={`${styles.input} ${styles.textarea}`}
                value     ={form.contactBlurb}
                onChange  ={onChange('contactBlurb')}
                placeholder="Library Loot for this site is operated by …"
                rows      ={3}
                disabled  ={saving}
              />
            </div>
          </fieldset>

          {/* ── LEGAL SUPPLEMENTS ── */}
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Legal supplements</legend>
            <p className={styles.fineprint}>
              Optional tenant-specific terms that render BELOW the Library Loot
              base policy. Add jurisdiction, local-law obligations, in-person
              pickup rules — anything specific to your library. <strong>You can
              add protections but cannot lower the platform&apos;s base
              protections</strong> (see <Link to="/terms">Terms §1</Link>).
            </p>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="privSupp">Privacy Policy supplement</label>
              <textarea
                id        ="privSupp"
                className ={`${styles.input} ${styles.textarea}`}
                value     ={form.privacyPolicySupplement}
                onChange  ={onChange('privacyPolicySupplement')}
                placeholder="Your library's additional privacy terms. Plain text. Use blank lines between paragraphs."
                rows      ={8}
                disabled  ={saving}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="termsSupp">Terms of Service supplement</label>
              <textarea
                id        ="termsSupp"
                className ={`${styles.input} ${styles.textarea}`}
                value     ={form.termsSupplement}
                onChange  ={onChange('termsSupplement')}
                placeholder="Your library's additional terms. Plain text. Use blank lines between paragraphs."
                rows      ={8}
                disabled  ={saving}
              />
            </div>
          </fieldset>

          {/* ── SAVE ── */}
          <div className={styles.saveRow}>
            <button
              type      ="submit"
              className ="btn btn-primary"
              disabled  ={saving}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {savedAt ? (
              <span className={styles.savedNote}>
                Saved {savedAt.toLocaleTimeString()}
              </span>
            ) : null}
          </div>

          {error ? (
            <div className={styles.error} role="alert">{error}</div>
          ) : null}
        </form>
      )}
    </article>
  )
}
