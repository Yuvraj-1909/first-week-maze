# Deployment setup (demo)

This project keeps the Express API on Vercel and stores changes in Supabase. The bundled `data/db.json` is only the initial sample data and local-development fallback.

## 1. Create the Supabase table

In Supabase, open **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and run it once.

The first successful API read seeds the `app_state` row from `data/db.json`. The API then reads and writes the saved JSON payload in Supabase.

## 2. Add server-side environment variables in Vercel

In the Vercel project, open **Settings → Environment Variables** and add:

- `SUPABASE_URL`: the Supabase project URL
- `SUPABASE_SECRET_KEY`: a Supabase secret key (or the legacy service-role key)

To enable generated answers in the grounded assistant, also add:

- `OPENAI_API_KEY`: an OpenAI API key
- `OPENAI_MODEL`: optional; defaults to `gpt-5-mini`

Select the environments you need (at least **Production**). These values are read only by the server. Never put Supabase secret or OpenAI keys in frontend code, screenshots, Git, or messages. After changing variables, redeploy the Vercel project.

Without `OPENAI_API_KEY`, the assistant continues using the built-in source-matched answers. If the AI request fails, it safely falls back to those answers.

## 3. Import the fork into Vercel

Import `Yuvraj-1909/first-week-maze` as a new Vercel project. Set **Root Directory** to `first-week-maze`. Keep the repository's existing Vercel build settings. Add the environment variables above before the first production deployment.

After deployment, open `/api/health`; it should return `{"ok":true}`. Then test loading a demo profile, completing a task, refreshing the page, and confirming the task remains complete.

## Demo limitations

This is a hackathon demo, not a secure employee system. It has no sign-in or access control; the HR/admin routes are also public. Use only fictional demo profiles and contacts. Do not enter real employee details or confidential company information. The current database stores the app state as one JSON document, which is appropriate only for a small demo and may lose updates if simultaneous users write at the same time. A production rollout needs authentication, per-record authorization, and normalized database tables.
