# Libris Study Tracker

Libris is an open-source, installable study tracker for recording library visits, timing focus sessions, and reviewing weekly progress. It uses ordinary email/password accounts and does not depend on ChatGPT.

## Features

- Email/password sign-up and login
- Private per-user data protected by PostgreSQL Row Level Security
- Library, café, campus, home, or custom-address check-ins
- Google Maps links for every location
- Focus timer and saved session history
- Seven-day study totals
- Installable PWA for iPhone and Android
- Responsive Roboto interface

## Local setup

Requirements: Node.js 22+ and pnpm.

1. Create a free [Supabase](https://supabase.com) project.
2. Open its SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql).
3. Copy `.env.example` to `.env.local`.
4. In Supabase's **Connect** dialog, copy the Project URL and publishable key into `.env.local`.
5. Install and start the app:

   ```bash
   pnpm install
   pnpm dev
   ```

## Publish it independently

Push this directory to a public Git repository, then import it into Vercel, Netlify, or Cloudflare Pages. Set these environment variables in the host:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Use `pnpm build` as the build command and `dist` as the output directory. In Supabase Authentication settings, set **Site URL** to the deployed website URL and add the same URL to **Redirect URLs**.

The publishable Supabase key is designed for browser use. The included Row Level Security policies ensure signed-in users can only access their own records. Never expose a Supabase secret or service-role key.

## Install on a phone

- iPhone: open the deployed URL in Safari, tap Share, then **Add to Home Screen**.
- Android: open the URL in Chrome and choose **Install app**.

## License

[MIT](LICENSE) — use, modify, and publish it freely.
