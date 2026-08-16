 # Fulfillment Dashboard

Order intake + fulfillment tracking for the team. Next.js 14 (App Router) + Supabase, deployed on Vercel.

## 1. Set up Supabase

1. Create a project at supabase.com (or use an existing one).
2. Go to the **SQL Editor** and run the contents of `supabase/schema.sql`. This creates the `orders` table, an open RLS policy for internal use, and enables realtime so everyone's dashboard updates live.
3. Go to **Project Settings -> API** and grab your **Project URL** and **anon public key**.

## 2. Run locally

```bash
npm install
cp .env.local.example .env.local
# paste your Supabase URL + anon key into .env.local
npm run dev
```

Open http://localhost:3000

## 3. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. Import the repo in Vercel.
3. In the Vercel project's **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. Share the URL with your team — everyone sees the same live order list.

## Notes

- The `orders` RLS policy currently allows full read/write with just the anon key, which is fine for an internal tool behind a private link. If you ever want to lock it down (e.g. require login), add Supabase Auth and tighten the policy in `supabase/schema.sql`.
- Realtime updates come through a Postgres changes subscription in `app/page.tsx` — no polling, no manual refresh needed.
- Colors/theme tokens live at the top of `app/globals.css` if you want to tweak the palette.
