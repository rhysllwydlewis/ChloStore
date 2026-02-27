# Chlo

A Next.js 15 (App Router) marketing / landing site for [chlo.co.uk](https://chlo.co.uk).

---

## Table of Contents

- [Project overview](#project-overview)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Design tokens](#design-tokens)
- [Local development](#local-development)
- [Scripts](#scripts)
- [Environment variables](#environment-variables)
- [Railway deployment](#railway-deployment)
- [CI](#ci)
- [SEO](#seo)
- [Pre-merge checklist](#pre-merge-checklist)

---

## Project overview

Chlo is a home for modern brands — a curated group of digital and lifestyle experiences united by a commitment to quality, authenticity, and thoughtful design. This site is the public-facing marketing site built with Next.js 15 App Router, Tailwind CSS, and Framer Motion.

**Key features:**
- Animated kintsugi-glass canvas hero (pure 2D HTML Canvas, no WebGL dependencies)
- Contact form with Postmark email delivery, honeypot spam protection, and rate limiting
- Fully responsive, accessible, keyboard-navigable UI
- Static-first architecture — all pages except the contact API and OG image are pre-rendered at build time
- Security headers baked into `next.config.js`
- Zero cookie banner required — no tracking or advertising cookies used

---

## Architecture

```
Browser ──► Next.js 15 (App Router, static export-compatible)
              │
              ├─ / (static)         Landing page
              ├─ /legal (static)    Legal hub
              ├─ /privacy (static)  Privacy policy
              ├─ /terms (static)    Terms of use
              ├─ /api/contact (dynamic, Node.js)  Contact form handler → Postmark
              └─ /opengraph-image (edge)           Open Graph image generation
```

**Rendering strategy:**
- All page routes are statically generated at build time (SSG)
- `/api/contact` is a server-side API route using Next.js Route Handlers
- `/opengraph-image` runs on the Edge Runtime using `next/og`

**Animation library:** [Framer Motion](https://www.framer.com/motion/) — scroll-triggered entry animations, spring-based modals

**Email delivery:** [Postmark](https://postmarkapp.com) — falls back gracefully to `console.log` when not configured

---

## Project structure

```
/
├── app/
│   ├── api/contact/route.ts      Contact form API (POST handler, rate-limiting, Postmark)
│   ├── legal/                    Legal hub page
│   │   ├── page.tsx              Route with metadata export
│   │   └── LegalHubContent.tsx   Client component with UI
│   ├── privacy/                  Privacy policy page
│   │   ├── page.tsx
│   │   └── PrivacyContent.tsx
│   ├── terms/                    Terms of use page
│   │   ├── page.tsx
│   │   └── TermsContent.tsx
│   ├── globals.css               Global styles (Tailwind base, grain overlay, scroll behaviour)
│   ├── layout.tsx                Root layout — fonts, metadata, viewport, OG tags
│   ├── opengraph-image.tsx       Edge OG image (1200×630)
│   ├── page.tsx                  Landing page — composes all sections
│   ├── robots.ts                 /robots.txt
│   └── sitemap.ts                /sitemap.xml
│
├── components/
│   ├── About.tsx                 "About Chlo" section
│   ├── Collections.tsx           Portfolio / collections section
│   ├── ContactBand.tsx           Full-width CTA band
│   ├── ContactWidget.tsx         Contact modal + context (ContactProvider, useContact)
│   ├── DecorativeBackground.tsx  Animated blob background (used on hero fallback)
│   ├── Footer.tsx                Site footer with dynamic year
│   ├── Hero.tsx                  Full-screen hero with kintsugi canvas
│   ├── KintsugiGlassCanvas.tsx   Pure 2D canvas animation (RAF, pointer parallax, seeded PRNG)
│   ├── LegalNav.tsx              Minimal nav for legal pages
│   └── Navbar.tsx                Main navigation (scroll-aware, mobile hamburger)
│
├── public/
│   └── favicon.svg               SVG favicon (brown rounded square with "C")
│
├── .github/workflows/ci.yml      GitHub Actions — lint + build on every push/PR
├── next.config.js                Next.js config (compression, security headers, strict mode)
├── tailwind.config.ts            Design tokens, custom animations, font families
├── tsconfig.json                 TypeScript config (strict mode, bundler resolution)
├── package.json                  Dependencies and scripts
└── README.md                     This file
```

---

## Design tokens

All brand colours and typography are defined in `tailwind.config.ts` and `app/globals.css`.

### Colour palette

| Token | Hex | Usage |
|---|---|---|
| `chlo-cream` | `#F7F1E7` | Page background, hero background |
| `chlo-surface` | `#FFFCF7` | Card surfaces, modal, footer |
| `chlo-beige` | `#E7D8C6` | Borders, dividers, ContactBand background |
| `chlo-tan` | `#C9A983` | Gold accent, OG top/bottom bands |
| `chlo-brown` | `#3B2F2A` | Primary text, buttons, nav wordmark |
| `chlo-muted` | `#6E5B52` | Secondary text, subtitles, labels |

### Typography

| Font | Weights | Usage |
|---|---|---|
| Playfair Display | 400, 600, 700 (+ italic) | Headings, hero, cards, wordmark |
| Inter | 300, 400, 500, 600 | Body text, UI labels, buttons |

Both fonts are loaded from Google Fonts in `app/layout.tsx` with `display=swap`.

### Custom animations

| Class | Description |
|---|---|
| `animate-bounce-slow` | Gentle 2.5 s vertical bounce (hero scroll arrow) |
| `animate-drift-slow` | 20 s drift loop (decorative blobs) |
| `animate-drift-medium` | 15 s reversed drift loop |
| `animate-drift-fast` | 10 s drift loop |
| `animate-shimmer` | Horizontal shimmer sweep |

---

## Local development

### Prerequisites

- Node.js 20+
- npm 10+

### Setup

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment variables (local)

Copy the example below into a `.env.local` file (never commit this file):

```env
# Required for email delivery via Postmark
POSTMARK_SERVER_TOKEN=your_postmark_server_token
CONTACT_TO_EMAIL=you@example.com
CONTACT_FROM_EMAIL=noreply@yourdomain.com

# Optional — defaults to https://chlo.co.uk
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

When Postmark variables are absent, the form still works but submissions are only logged to the server console.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Build for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |

---

## Environment variables

Create a `.env.local` file (never committed) with the following keys:

### Required for contact form email delivery (Postmark)

| Variable | Description |
|---|---|
| `POSTMARK_SERVER_TOKEN` | Postmark Server API token |
| `CONTACT_TO_EMAIL` | Email address that receives enquiries |
| `CONTACT_FROM_EMAIL` | Verified sender address in your Postmark account |

### Optional

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL (used for OG tags, sitemap, robots.txt) | `https://chlo.co.uk` |

---

## Railway deployment

The site is deployed on [Railway](https://railway.app).

1. Connect the GitHub repository to a Railway project.
2. Railway auto-detects Next.js and sets the build command to `npm run build` and start command to `npm run start`.
3. Add the environment variables above via the Railway **Variables** tab.
4. The site will be live on a temporary `*.railway.app` domain until a custom domain is configured.

### Custom domain

Set `NEXT_PUBLIC_SITE_URL` to your final domain (e.g. `https://chlo.co.uk`) in Railway variables once DNS is pointed.

---

## CI

GitHub Actions runs on every push and pull request:

- Installs dependencies (`npm ci`)
- Lints (`npm run lint`)
- Builds (`npm run build`)

See [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

---

## SEO

- Open Graph image is generated at `/opengraph-image` via `app/opengraph-image.tsx` (Edge Runtime, 1200×630 PNG).
- `robots.txt` is served at `/robots.txt` via `app/robots.ts`.
- `sitemap.xml` is served at `/sitemap.xml` via `app/sitemap.ts`.
- Canonical URL and `<meta name="theme-color">` are set in `app/layout.tsx`.

---

## Pre-merge checklist

Use this checklist before merging any pull request into `main`:

### Code quality
- [ ] `npm run lint` passes with no warnings or errors
- [ ] `npm run build` completes successfully
- [ ] TypeScript compiles with no type errors
- [ ] No `console.log` or debug statements left in production code

### Functionality
- [ ] Landing page renders correctly at all breakpoints (mobile 375px, tablet 768px, desktop 1280px+)
- [ ] Navbar scroll behaviour works (transparent → frosted glass on scroll)
- [ ] Mobile hamburger menu opens, closes, and navigates correctly
- [ ] Hero canvas animation runs and responds to pointer movement
- [ ] "Contact" and "Explore" buttons in hero work correctly
- [ ] Scroll-down chevron navigates to collections section
- [ ] About, Collections, ContactBand scroll-triggered animations fire once
- [ ] Contact modal opens from all CTA locations (Navbar, Hero, ContactBand, Footer)
- [ ] Contact form validates all fields client-side before submission
- [ ] Contact form POST `/api/contact` returns 200 on valid submission
- [ ] Contact form rate limiting returns 429 after 3 rapid submissions
- [ ] Legal Hub, Privacy, Terms pages load correctly with LegalNav
- [ ] Back-navigation from Privacy/Terms to Legal Hub works

### Accessibility
- [ ] All interactive elements are keyboard-navigable (Tab + Enter/Space)
- [ ] All interactive elements have visible `:focus-visible` rings
- [ ] All images and decorative SVGs have appropriate `alt` / `aria-hidden`
- [ ] Screen reader: no meaningless text or unlabelled buttons
- [ ] Motion: `prefers-reduced-motion` suppresses animations (hero canvas shows static frame; bounce arrow stops)
- [ ] Colour contrast ratios meet WCAG AA for all text/background combinations

### SEO & metadata
- [ ] `<title>` and `<meta description>` present and correct on all pages
- [ ] Open Graph image renders at `/opengraph-image`
- [ ] `sitemap.xml` lists all public URLs
- [ ] `robots.txt` allows all crawlers

### Security
- [ ] Security headers present (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`)
- [ ] Contact form honeypot field is present and invisible to real users
- [ ] No secrets committed (no `.env.local`, no API tokens in source)
- [ ] `POSTMARK_SERVER_TOKEN`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` set in deployment environment

### Performance
- [ ] First Load JS ≤ 200 kB per route
- [ ] No synchronous external font blocking render (fonts use `display=swap`)
- [ ] Hero canvas animation uses `cancelAnimationFrame` on unmount
- [ ] Hero canvas pauses when tab is hidden or hero is scrolled off-screen

### Deployment
- [ ] `NEXT_PUBLIC_SITE_URL` set to production domain in Railway variables
- [ ] Custom domain DNS configured and SSL active
- [ ] OG image, sitemap, and robots.txt verified on production URL
