/** @module model/LastModified */
//  src/model/LastModified.js
//
//  Created by Miguel Brown on 2026-05-15.
//  Copyright © 2026 Luckey Logic LLC. All rights reserved.
//
//  Ported from MCL Central's model/LastModified.js (originally written
//  2026-04-28). Same shape, same toDict/fromDict semantics — Library Loot
//  consumes it the same way: embed the latest LastModified as a
//  `lastModified` map field on the parent doc, archive previous values
//  to a `lastModifieds` subcollection for accountability.

/**
 * Class description: Tracks who last modified a Firestore document, when,
 * what type of modification was made, AND a per-field diff capturing exactly
 * which fields changed (with previous + current values). Designed to be
 * embedded as a `lastModified` map field inside other model documents —
 * not stored as its own standalone collection.
 *
 * Embed it by calling lastModified.toDict() inside the parent model's toDict():
 *   lastModified: this.lastModified ? this.lastModified.toDict() : null
 *
 * Reconstruct it inside the parent model's fromDict() or constructor:
 *   this.lastModified = LastModified.fromDict(data.lastModified ?? null)
 *
 * Accountability pattern (Library Loot): the parent doc holds the CURRENT
 * LastModified inline. When that doc is updated, the OLD LastModified is
 * moved to a `lastModifieds` subcollection in the same batch write, so we
 * get a permanent audit trail of every change without exploding the
 * parent doc size.
 *
 * Changes array semantics by state:
 *   - 'created' : changes is empty (genesis state — nothing changed, the doc
 *                 was just initialized to its current values).
 *   - 'updated' : changes contains one entry per field that drifted, with
 *                 the previous value and the new current value. Use this to
 *                 render "what changed" in an admin audit viewer.
 *   - 'deleted' : changes is empty (whole-doc removal, not a field diff).
 *
 * Each entry in `changes`:
 *   { field: string, previous: any|null, current: any|null }
 * `null` is used for "value was unset / didn't exist" on either side.
 *
 * @example
 * const lastModified = new LastModified({
 *   byName : 'Miguel Brown',
 *   byUUID : 'abc123firebaseuid',
 *   date   : serverTimestamp(),
 *   state  : 'updated',
 *   changes: [
 *     { field: 'displayName', previous: 'Miguel Brown', current: 'Bart' }
 *   ]
 * })
 */
class LastModified {

  /**
   * @param {Object}    [data={}]
   * @param {string}    [data.byName]   - Display name of the user who made the modification. (Optional)
   * @param {string}    [data.byUUID]   - Firebase Auth UID of the user who made the modification. (Optional)
   * @param {*}         [data.date]     - Firestore Timestamp / sentinel or JS Date of the modification. (Optional)
   * @param {string}    [data.state]    - Type of modification: "created", "updated", or "deleted". (Optional)
   * @param {Array<{field: string, previous: *, current: *}>} [data.changes]
   *                                     - (Optional) Per-field diff for 'updated' state. Empty for 'created' / 'deleted'.
   */
  constructor({
    byName,
    byUUID,
    date,
    state,
    changes
  } = {}) {
    /**
     * @property {string}                                                  byName  - Display name of the modifying user.
     * @property {string}                                                  byUUID  - Firebase Auth UID of the modifying user.
     * @property {*}                                                       date    - Timestamp of the modification (Firestore Timestamp/serverTimestamp() or JS Date).
     * @property {string}                                                  state   - Type of modification: "created", "updated", or "deleted".
     * @property {Array<{field: string, previous: *, current: *}>}         changes - Per-field diff (only populated for 'updated').
     */

    this.byName  = byName ?? ''
    this.byUUID  = byUUID ?? ''
    this.date    = date   ?? null
    this.state   = state  ?? ''
    this.changes = Array.isArray(changes) ? changes : []
  }

  /**
   * Converts this LastModified instance to a plain object suitable for embedding
   * inside a parent model's toDict() output or for direct Firestore storage.
   *
   * @function toDict
   * @returns  {Object}
   */
  toDict() {
    return {
      byName : this.byName,
      byUUID : this.byUUID,
      date   : this.date,
      state  : this.state,
      changes: this.changes
    }
  }

  /**
   * Render the change diff as a single human-readable line suitable for an
   * audit-trail UI. Returns the empty string when there are no field changes
   * (i.e. for 'created' or 'deleted' entries, or when nothing actually
   * drifted). Format: `displayName: "Miguel Brown" → "Bart"; email added: "..."`.
   *
   * @function describe
   * @returns  {string}
   */
  describe() {
    if (!Array.isArray(this.changes) || this.changes.length === 0) return ''
    return this.changes.map((c) => {
      const f = c && c.field ? c.field : '?'
      const before = c && c.previous !== undefined && c.previous !== null ? JSON.stringify(c.previous) : null
      const after  = c && c.current  !== undefined && c.current  !== null ? JSON.stringify(c.current ) : null
      if (before === null && after !== null) return `${f} added: ${after}`
      if (before !== null && after === null) return `${f} removed (was ${before})`
      return `${f}: ${before} → ${after}`
    }).join('; ')
  }

  /**
   * Creates a LastModified instance from a plain data object.
   * Returns null if data is null or undefined — callers should guard against null
   * before calling methods on the result.
   *
   * @function  fromDict
   * @static
   * @param     {Object|null}  data  - Plain map data, typically from a parent document's `lastModified` field.
   * @returns   {LastModified|null}
   */
  static fromDict(data) {
    if (!data) return null
    return new LastModified(data)
  }
}

// ── CONVERTER ────────────────────────────────────────────────────────────────
//
// Firestore data converter for LastModified used as a top-level document.
// In most cases LastModified is embedded inside another model — call
// `lastModified.toDict()` in the parent's toFirestore() instead of using this
// converter directly. Provided for completeness and edge-case standalone use.

/** @typedef {Object} LastModifiedConverter */

/** @type {LastModifiedConverter} */
export const lastModifiedConverter = {
  toFirestore  : (lastModified) => lastModified.toDict(),
  fromFirestore: (snapshot, options) => LastModified.fromDict(snapshot.data(options))
}

export default LastModified
