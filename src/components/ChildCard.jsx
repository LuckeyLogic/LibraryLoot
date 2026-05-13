// src/components/ChildCard.jsx
//
// Single-child tile shown in the parent dashboard. Renders the avatar
// (transparent PNG on the same gradient surface as the picker), first
// name, optional birth year, verified or pending badge, and Edit / Delete
// actions.
//
// Pure presentational — parent owns the data and the action callbacks.
//
// Created by Miguel Brown on 5/13/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React              from 'react'

import styles             from './ChildCard.module.css'

/**
 * ChildCard — renders one child sub-profile with edit / delete actions.
 *
 * @param   {Object}    props
 * @param   {Object}    props.child       - { id, firstName, birthYear, avatarId, verified, ... }
 * @param   {Object?}   [props.avatar]    - The avatar doc { downloadUrl, name } for child.avatarId, if found.
 * @param   {Function}  props.onEdit      - Called with the child object.
 * @param   {Function}  props.onDelete    - Called with the child object.
 * @returns {JSX.Element}
 */
export default function ChildCard({ child, avatar, onEdit, onDelete }) {

  const ageHint = child.birthYear
    ? `Age ~${new Date().getFullYear() - child.birthYear}`
    : null

  return (
    <article className={styles.card}>

      <div className={styles.surface}>
        {avatar && avatar.downloadUrl ? (
          <img
            src      ={avatar.downloadUrl}
            alt      =""
            className={styles.avatarImg}
            loading  ="lazy"
          />
        ) : (
          <span className={styles.avatarFallback} aria-hidden="true">
            {child.firstName ? child.firstName.charAt(0).toUpperCase() : '?'}
          </span>
        )}
      </div>

      <div className={styles.body}>

        <p className={styles.name} title={child.firstName}>
          {child.firstName}
        </p>

        {ageHint ? <p className={styles.age}>{ageHint}</p> : null}

        {child.verified ? (
          <p className={`${styles.badge} ${styles.badgeVerified}`} title="Verified by librarian">
            <span aria-hidden="true">✓</span> Verified by librarian
          </p>
        ) : (
          <p className={`${styles.badge} ${styles.badgePending}`} title="Visit the library to verify this profile">
            <span aria-hidden="true">⏳</span> Pending librarian verification
          </p>
        )}
      </div>

      <div className={styles.actions}>
        <button
          type      ="button"
          className ={styles.edit}
          onClick   ={() => onEdit(child)}
          aria-label={`Edit ${child.firstName}`}
        >
          Edit
        </button>
        <button
          type      ="button"
          className ={styles.delete}
          onClick   ={() => onDelete(child)}
          aria-label={`Delete ${child.firstName}`}
        >
          Delete
        </button>
      </div>

    </article>
  )
}
