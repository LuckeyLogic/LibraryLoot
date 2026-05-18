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
 * Class description: Tracks who last modified a Firestore document, when, and
 * what type of modification was made. Designed to be embedded as a `lastModified`
 * map field inside other model documents — not stored as its own standalone collection.
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
 * @example
 * const lastModified = new LastModified({
 *   byName : 'Miguel Brown',
 *   byUUID : 'abc123firebaseuid',
 *   date   : serverTimestamp(),
 *   state  : 'updated',
 * })
 */
class LastModified {

  /**
   * @param {Object}  [data={}]
   * @param {string}  [data.byName]  - Display name of the user who made the modification. (Optional)
   * @param {string}  [data.byUUID]  - Firebase Auth UID of the user who made the modification. (Optional)
   * @param {*}       [data.date]    - Firestore Timestamp / sentinel or JS Date of the modification. (Optional)
   * @param {string}  [data.state]   - Type of modification: "created", "updated", or "deleted". (Optional)
   */
  constructor({
    byName,
    byUUID,
    date,
    state
  } = {}) {
    /**
     * @property {string}  byName  - Display name of the modifying user.
     * @property {string}  byUUID  - Firebase Auth UID of the modifying user.
     * @property {*}       date    - Timestamp of the modification (Firestore Timestamp/serverTimestamp() or JS Date).
     * @property {string}  state   - Type of modification: "created", "updated", or "deleted".
     */

    this.byName = byName ?? ''
    this.byUUID = byUUID ?? ''
    this.date   = date   ?? null
    this.state  = state  ?? ''
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
      byName: this.byName,
      byUUID: this.byUUID,
      date  : this.date,
      state : this.state
    }
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
