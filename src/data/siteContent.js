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
    // Served from Firebase Storage under /luckey-logic/assets/. Swap = upload
    // new file in the Storage console + replace the URL. Per-tenant assets
    // live under their own root collection key.
    imageUrl     : 'https://firebasestorage.googleapis.com/v0/b/library-loot.firebasestorage.app/o/luckey-logic%2Fassets%2Fhero%2Flibrary-loot-hero-bg.jpg?alt=media&token=4ee41908-b25d-432b-9f48-e36686c867cf',
    logoUrl      : 'https://firebasestorage.googleapis.com/v0/b/library-loot.firebasestorage.app/o/luckey-logic%2Fassets%2Fbranding%2Fsummer-of-library-loot.png?alt=media&token=6aad1c3a-3eea-40f0-a88d-5d326d5b8db6'
  },

  // ── ORIGIN STORY ──
  // Kid's real name is intentionally NOT used. The portrait is referred to by the
  // callsign JAMBO, which stands in for the kid in the story. Miguel's name is
  // fine; kids' names are not.
  story: {
    title    : 'Where Library Loot started',
    body     : 'This whole thing started when my kid came home from his school book fair and asked if he could buy a book. Two minutes later he asked if he could earn V-Bucks for reading books. That second question is the entire idea. Kids already love the things we want them to love books less than. So we built a way to use what they love to get them to the thing we want them to love.',
    signoff  : '— Miguel, founder of Luckey Logic. The kid in the portrait goes by JAMBO.',
    imageUrl : 'https://firebasestorage.googleapis.com/v0/b/library-loot.firebasestorage.app/o/luckey-logic%2Fassets%2Fstory%2Fjambo.jpg?alt=media&token=ca560378-97ff-45fb-a623-8dcd2d7bd9d3',
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
  },

  // ── READER'S PROMISE ──
  // Honor-system pledge shown when a child (or their parent) accepts a
  // challenge on a book. Kid-readable tone — first-person statements that
  // name the cheat vectors directly without being preachy. Stored once in
  // siteContent so the wording stays consistent across the
  // challenge-acceptance UI (ITEM 5) and any future surface that needs to
  // remind readers what they agreed to (e.g. the librarian approval view).
  honestyPledge: {
    eyebrow      : 'Reader\'s promise',
    title        : 'Quick promises before we start',
    intro        : 'Just a few honest promises. These are between you and the librarian — nobody\'s secretly checking, but they\'re how the program stays fair for every reader.',
    statements   : [
      'I haven\'t read this book before.',
      'I\'ll read the whole book myself, or have a grown-up read it to me.',
      'I won\'t ask ChatGPT or any AI helper to read the book or answer the quiz for me.',
      'If I get stuck, I\'ll ask a grown-up — not the internet.'
    ],
    consentLabel : 'I promise to keep these.',
    acceptLabel  : 'I promise — accept challenge',
    footnote     : 'Your grown-up will see this promise when they approve your finished book.'
  },

  // ── FAQ ──
  // Public Q&A surfaced at /faq. Keep answers concrete and short. When
  // the same answer needs to evolve (e.g., Epic Games policy change),
  // update the answer in place — this file is the canonical source.
  // Operational details for the Epic withdrawal scenario live in
  // SPEC.md §11; the FAQ entry below is the user-friendly summary.
  faq: [
    {
      q: 'What is Library Loot?',
      a: 'A community-funded reading rewards program. Adults sponsor reading challenges on specific books. Kids accept challenges through their parent\'s account, read the books, prove they read them, and a verifiable random draw awards a prize from the donated prize pool. The platform never takes money — every prize comes from the community.'
    },
    {
      q: 'Is Library Loot affiliated with Epic Games or Fortnite?',
      a: 'No. Library Loot is not affiliated with, endorsed, or sponsored by Epic Games. Fortnite-related visual elements are used as Fan Content under Epic\'s Fan Content Policy. If Epic Games asks us to remove or change Fortnite branding, we comply immediately. See "What happens if Epic asks Library Loot to stop using Fortnite branding?" below for the detailed plan.'
    },
    {
      q: 'What happens if Epic asks Library Loot to stop using Fortnite branding?',
      a: [
        'We pivot away from Fortnite branding within ~24 hours and continue running the program. Specifically:',
        '— **Your child\'s current challenges are unaffected.** Whatever they\'re reading, they keep reading. Their quiz works. Their prize draw fires.',
        '— **Already-won prizes are honored.** If a child has earned a prize, they get it.',
        '— **Existing V-Bucks gift cards in the pool are still distributed.** Giving away a V-Bucks card you bought at retail is normal gift-card use — Epic\'s policy restricts how you market with Fortnite branding, not who can give the cards away. Already-donated cards stay in the pool until they\'re won.',
        '— **The Fortnite-styled art and "V-Bucks" wording come down** from the site, and the program rebrands to a brand-agnostic reading-rewards program. The name "Library Loot" stays — it\'s a generic phrase, not Epic IP.',
        '— **New prize categories open up:** Amazon books, Nintendo eShop, PlayStation, Xbox, local store gift cards, etc.',
        'See SPEC.md §11 in the public repo for the full operational playbook.'
      ]
    },
    {
      q: 'How is the prize draw verified — can someone rig it?',
      a: 'When a challenge is approved, a Cloud Function pulls a random value from drand (the League of Entropy public randomness beacon, signed by an international consortium of universities and labs), falling back to random.org if drand is unreachable, and to the server\'s OS-level random as a last resort. Every input — the entropy values, the prize pool snapshot at draw time, the timestamp, the algorithm version — is recorded in an append-only audit document. Anyone with the audit ID can re-run the math and verify. No human — librarian, sponsor, parent, or developer — can rig a draw.'
    },
    {
      q: 'Are prizes guaranteed?',
      a: 'No. The prize pool is community-funded — sponsors donate prizes physically at the library, and the platform tracks them. If more kids complete challenges than there are prizes, the pool can run dry. We surface the live prize-pool count on the home page so kids and parents see the current state. Reading is the win; the prize is a bonus. Kids who complete a challenge after the pool is empty receive a "Library Loot Champion" certificate signed by the librarian.'
    },
    {
      q: 'What stops older kids from picking easy books for prizes?',
      a: [
        'Three things, layered:',
        '— Each book has an age range. Books with broad appeal (think Harry Potter) are labeled "ages 8 and up" — older kids welcome. Books strictly targeted at younger readers (like picture books) have an upper age too, so a high schooler picking it triggers a warning at challenge acceptance.',
        '— The library can configure how strict the warning is: a soft "are you sure?" the kid can accept and keep going, OR a hard block. The librarian sets the policy.',
        '— The librarian reviews every completion before any prize draw fires. Even if a kid bypasses the age warning, the librarian sees the bypass at approval and can decline. Reading levels are anchored to what the librarian observes about the kid in person, not what their birth year says.'
      ]
    },
    {
      q: 'How do you prevent cheating?',
      a: [
        'Several layers, working together:',
        '— Children participate only through a parent\'s account. The parent is the COPPA consent agent.',
        '— Each child profile must be verified in person by a librarian before any prize draw fires. Kids can read and quiz before verification; the prize gate is the librarian-handshake moment.',
        '— Quiz questions test specific recall (minor character names, scene order, specific dialogue) — not summary-derivable facts. A pool of 15–20 questions per book is randomly sampled per attempt, so two kids see different quizzes on the same book. Quizzes are time-limited (~10 min) so Googling per question is friction.',
        '— A librarian or parent must approve every challenge completion before the prize draw fires.',
        '— One prize draw per book per child.'
      ]
    },
    {
      q: 'Why no written book reports?',
      a: 'Because kids can feed any book to an AI and get a written summary in seconds. The platform exists to incentivize actual reading, not writing. Quiz mode and in-person check-off test recall of specifics they could only know by reading the book themselves.'
    },
    {
      q: 'What about Roblox?',
      a: 'Not supported. The platform operator excluded Roblox prizes — donations of Roblox cards or merchandise are declined.'
    },
    {
      q: 'What information do you collect about my child?',
      a: 'First name only. Optional birth year (year only — no full date of birth). A reference to which avatar they picked. That\'s it. No email, no phone, no last name, no photos, no address. Children never log in directly; their parent manages their participation. See the Privacy Policy for the full framework — base policy plus any supplement the operator of this site has added.'
    },
    {
      q: 'What happens if I delete my child\'s profile?',
      a: 'The child\'s profile and all associated activity are deleted. Prize-draw audit records are anonymized (your child\'s identifier is replaced with "deleted") but the random-draw audit trail itself is retained, because the platform\'s public verifiability depends on every past draw being re-checkable.'
    },
    {
      q: 'Who operates this site, and who do I contact?',
      a: 'See the About page or the contact email at the bottom of the Privacy Policy. Library Loot is a platform — each library or organization that hosts it is the operator of their instance and is the right contact for participation questions, COPPA requests, and sponsorship.'
    },
    {
      q: 'Is the source code public?',
      a: 'Yes — MIT-licensed at github.com/LuckeyLogic/LibraryLoot. Anyone can audit how the prize draw works, how child data is handled, and how the platform stays inside Epic\'s Fan Content Policy.'
    },
    {
      q: 'Can my library run its own Library Loot instance?',
      a: 'Yes. Contact Luckey Logic to either host on the shared Firebase project (free while the platform is small) or hand off the codebase and your tenant data to your own Firebase project. The handoff scripts in `/scripts` are designed to make this a clean operational transition with zero data sharing post-handoff.'
    }
  ]

}

export default siteContent
