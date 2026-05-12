// src/data/siteContent.js
//
// Single source of truth for site-wide copy, branding values, and legal
// disclaimers. Components must NEVER hardcode client-facing strings — they
// import what they need from this module.
//
// When the app goes multi-tenant at the content level (later), this file
// gets replaced with a `useSiteContent()` hook backed by the tenant's
// `_main` settings doc. Shape stays the same.
//
// Created by Miguel Brown on 5/12/26.
// Copyright (c) 2026 Luckey Logic LLC. All rights reserved.

/**
 * Site-wide content used across the app.
 *
 * @typedef {Object} SiteContent
 * @property {Object} brand              - Program-level branding strings.
 * @property {Object} hero               - Landing-page hero copy + asset URL.
 * @property {Object[]} howItWorks       - Steps for the "How It Works" section.
 * @property {Object[]} prizeCategories  - Prize types surfaced on the landing page.
 * @property {Object} sponsorCTA         - Donor/sponsor call-to-action card.
 * @property {Object} legal              - Trademark/legal disclaimer strings.
 * @property {Object} footer             - Footer copy + credit.
 */

const siteContent = {

  // ── BRAND ──
  brand: {
    name        : 'Library Loot',
    tagline     : 'Read the book. Earn the loot.',
    blurb       : 'A community-funded reading program where adults sponsor books, kids read them, and earn real prizes — donated by neighbors, families, and local businesses.',
    operatedBy  : 'Luckey Logic LLC',
    contactEmail: 'libraryloot@luckeylogic.com'
  },

  // ── HERO ──
  hero: {
    eyebrow      : 'Summer of Library Loot',
    headline     : 'Read the book. Earn the loot.',
    subhead      : 'Adults sponsor reading challenges. Kids read, prove they read, and a verifiable random draw awards a real prize from the community pool.',
    primaryCtaLabel  : 'See the books',
    primaryCtaPath   : '/books',
    secondaryCtaLabel: 'Sponsor a prize',
    secondaryCtaPath : '/sponsor',
    // Served from public/ for v1. ITEM 1 migrates to Firebase Storage and updates these URLs.
    imageUrl     : '/assets/library-loot-hero-bg.jpg',
    logoUrl      : '/assets/summer-of-library-loot.png'
  },

  // ── ORIGIN STORY ──
  // Kid's real name is intentionally NOT used. The portrait is referred to by the
  // callsign JAMBO, which stands in for the kid in the story. Miguel's name is
  // fine; kids' names are not.
  story: {
    title    : 'Where Library Loot started',
    body     : 'This whole thing started when my kid came home from his school book fair and asked if he could buy a book. Two minutes later he asked if he could earn V-Bucks for reading books. That second question is the entire idea. Kids already love the things we want them to love books less than. So we built a way to use what they love to get them to the thing we want them to love.',
    signoff  : '— Miguel, founder of Luckey Logic. The kid in the portrait goes by JAMBO.',
    imageUrl : '/assets/jambo.jpg',
    imageAlt : 'JAMBO — fan-art-style portrait of the original Library Loot reader, holding V-Bucks coins beside a loot chest.'
  },

  // ── HOW IT WORKS ──
  howItWorks: [
    {
      step : 1,
      title: 'Sponsor a book',
      body : 'A parent, grandparent, neighbor, or local business drops off a Fortnite prize at the library — a V-Bucks gift card, a Fortnite Lego set, a poster, an action figure. The librarian adds it to the prize pool. The site never touches the card or cash.'
    },
    {
      step : 2,
      title: 'Pick a challenge',
      body : 'A kid picks a book from the active reward shelf — at the library or on this site — through their parent\'s account.'
    },
    {
      step : 3,
      title: 'Read it. Prove it.',
      body : 'After reading, kids take a quick quiz the librarian approved, or check off the book in person at the desk. Quizzes target stuff that\'s actually in the book — not a Wikipedia summary, not something an AI can answer for them.'
    },
    {
      step : 4,
      title: 'Win loot',
      body : 'A verifiable random draw picks one prize from the donated pool. The kid sees what they won + a shout-out for whoever donated it. The library hands the prize over in person.'
    }
  ],

  // ── PRIZE CATEGORIES (v1: Fortnite-only — see SPEC §3.3 for rationale) ──
  prizeCategories: [
    { label: 'V-Bucks Gift Cards',   tone: 'epic'      },
    { label: 'Fortnite Legos',       tone: 'rare'      },
    { label: 'Action Figures',       tone: 'rare'      },
    { label: 'Apparel & Posters',    tone: 'legendary' }
  ],

  // ── SPONSOR CTA ──
  sponsorCTA: {
    title    : 'Want to sponsor a kid\'s next read?',
    body     : 'For v1, donations are physical drop-offs at the library — V-Bucks gift cards, Fortnite Legos, posters, action figures, anything Fortnite-themed. The library logs your donation into the prize pool and your shout-out shows up every time a kid wins something you donated. The site doesn\'t handle money. Ever.',
    ctaLabel : 'Become a sponsor',
    ctaPath  : '/sponsor'
  },

  // ── LEGAL ──
  legal: {
    epicGamesDisclaimer:
      '"Fortnite" and "V-Bucks" are trademarks of Epic Games, Inc. Library Loot is not affiliated with, endorsed, or sponsored by Epic Games. Fortnite-related visual elements are used as Fan Content under Epic\'s Fan Content Policy.',
    privacyDigest:
      'Library Loot collects the minimum information needed to run reading challenges. Parents manage their children\'s profiles — kids do not log in directly. We never share child data with advertisers or third parties beyond the platform\'s infrastructure providers. See the Privacy Policy for details.'
  },

  // ── TENANT SUPPORT ──
  // These values are the FALLBACK defaults shown if a tenant has not yet
  // configured their own. Once ITEM 2 wires up tenant settings, About /
  // Privacy / Terms pull the live values from `/{tenantId}/_main.support`
  // and only fall back to these defaults if a field is missing.
  //
  // Critical: the COPPA contact and the program contact MUST be set per
  // tenant. Luckey Logic is the right contact only while we are the
  // operator. After handoff the receiving org sets these to their own
  // contacts and Luckey Logic is no longer involved.
  support: {
    organizationName : 'Luckey Logic LLC',
    programContactEmail : 'libraryloot@luckeylogic.com',
    coppaContactEmail   : 'libraryloot@luckeylogic.com',
    contactBlurb        : 'Library Loot for this site is operated by Luckey Logic LLC.'
  },

  // ── FOOTER ──
  footer: {
    credit       : 'Built by Luckey Logic LLC.',
    sourceUrl    : 'https://github.com/LuckeyLogic/LibraryLoot',
    copyrightYear: 2026
  }

}

export default siteContent
