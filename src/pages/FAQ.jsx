/**
 * Public Q&A — questions are driven by siteContent.faq (data) so editing the
 * answers doesn't touch component code. Each entry is either a single string
 * answer or an array of strings (rendered as paragraphs / bullets). Highlighted
 * scenario: "What happens if Epic asks Library Loot to stop using Fortnite
 * branding?" — the user-facing summary of the operational playbook documented in
 * SPEC.md §11.
 * @module pages/FAQ
 */
// src/pages/FAQ.jsx
//
// Public Q&A — questions are driven by siteContent.faq (data) so editing
// the answers doesn't touch component code. Each entry is either a single
// string answer or an array of strings (rendered as paragraphs / bullets).
//
// Highlighted scenario: "What happens if Epic asks Library Loot to stop
// using Fortnite branding?" — the user-facing summary of the operational
// playbook documented in SPEC.md §11.
//
// Created by Miguel Brown on 5/13/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

import React              from 'react'
import { Link }           from 'react-router-dom'

import Disclaimer         from '../components/Disclaimer.jsx'

import useTenantSettings  from '../hooks/useTenantSettings.js'

import siteContent        from '../data/siteContent.js'

import styles             from './FAQ.module.css'

/**
 * AnswerBody — renders a single FAQ answer. Accepts a plain string OR an
 * array of strings (first item is treated as an intro paragraph; remaining
 * items rendered as a bullet list if any start with the em-dash convention,
 * otherwise as paragraphs).
 *
 * @param   {Object}                props
 * @param   {string|string[]}       props.answer
 * @returns {JSX.Element}
 */
function AnswerBody({ answer }) {
  if (typeof answer === 'string') {
    return <p>{renderInline(answer)}</p>
  }
  if (!Array.isArray(answer) || answer.length === 0) {
    return null
  }

  const [intro, ...rest] = answer
  const bulletEntries    = rest.filter((line) => typeof line === 'string' && line.startsWith('— '))
  const tailParagraphs   = rest.filter((line) => !(typeof line === 'string' && line.startsWith('— ')))

  return (
    <>
      <p>{renderInline(intro)}</p>
      {bulletEntries.length > 0 ? (
        <ul className={styles.bullets}>
          {bulletEntries.map((line, i) => (
            <li key={i}>{renderInline(line.replace(/^—\s*/, ''))}</li>
          ))}
        </ul>
      ) : null}
      {tailParagraphs.map((line, i) => (
        <p key={i}>{renderInline(line)}</p>
      ))}
    </>
  )
}

/**
 * Tiny inline-formatting helper — converts the `**bold**` convention used
 * in answers into <strong> nodes. Kept very small on purpose; we don't
 * want a markdown parser dep for what is at most a dozen FAQ entries.
 *
 * @param   {string} text
 * @returns {Array<string|JSX.Element>}
 */
function renderInline(text) {
  if (typeof text !== 'string') return [text]
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

/**
 * FAQ — public Q&A page.
 *
 * @returns {JSX.Element}
 */
export default function FAQ() {

  const { brand }   = siteContent
  const { support } = useTenantSettings()
  const items       = siteContent.faq || []

  return (
    <article className={`container ${styles.faqWrap}`}>

      <header className={styles.header}>
        <p className={styles.eyebrow}>FAQ</p>
        <h1 className={styles.title}>Frequently asked questions</h1>
        <p className={styles.lede}>
          Short answers to the most common questions about how Library Loot works,
          what happens to participants in different scenarios, and how the
          platform protects kids and stays inside Epic Games&apos; Fan Content Policy.
        </p>
      </header>

      <Disclaimer tone="soft" />

      <section className={styles.faqList}>
        {items.map((entry, idx) => (
          <details key={idx} className={styles.item}>
            <summary className={styles.summary}>
              <span className={styles.questionMark}>?</span>
              <span className={styles.question}>{entry.q}</span>
            </summary>
            <div className={styles.answer}>
              <AnswerBody answer={entry.a} />
            </div>
          </details>
        ))}
      </section>

      <section className={styles.tail}>
        <h2>Still have a question?</h2>
        <p>
          Reach out to the operator of this Library Loot instance:
          {' '}<strong>{support.organizationName}</strong> at
          {' '}<a href={`mailto:${support.programContactEmail}`}>{support.programContactEmail}</a>.
        </p>
        <p className="muted">
          For an overview of the program, see <Link to="/about">About</Link>. If
          you&apos;re a parent or guardian thinking about signing your kid up,
          the <Link to="/for-parents">For Parents guide</Link> walks the whole
          flow step by step. For privacy specifics see
          {' '}<Link to="/privacy">Privacy Policy</Link>. The source code lives
          at <a href={siteContent.footer.sourceUrl} target="_blank" rel="noreferrer">
            github.com/LuckeyLogic/LibraryLoot
          </a>.
        </p>
        <p className="muted">
          {brand.operatedBy} maintains the platform. Individual libraries operate
          their own instances and set their own COPPA contact, supplement terms,
          and prize policies — see <Link to="/about">About</Link> for the
          operator of THIS instance.
        </p>
      </section>

    </article>
  )
}
