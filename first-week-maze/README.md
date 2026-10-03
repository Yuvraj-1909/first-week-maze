# First-Week Maze — AI-Powered New Joiner Onboarding Assistant

A hackathon-ready MVP based on **Bennett University Hackathon 2026 — Problem Statement #15, “The First-Week Maze”**.

The source problem calls for a personalized onboarding checklist, the right links/contacts, progress tracking, role/location personalization, source citations, nudges, and human handoff for sensitive questions. This implementation turns that into a workflow-first product rather than a generic chatbot.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Persistence: JSON-backed demo database (`data/db.json`), intentionally simple for a hackathon
- AI layer: deterministic grounded-assistant engine over a small approved knowledge base; no paid API required for the demo

## Run

```bash
npm install
npm run dev
```

Frontend: http://localhost:5173
API: http://localhost:4000

For a production build:

```bash
npm run build
npm start
```

## Deploy to Vercel

This project includes a Vercel configuration for the Vite frontend and the `/api` serverless function. Keep `vercel.json` at the project root. When importing a GitHub repository that contains this folder inside another folder, set Vercel's **Root Directory** to `first-week-maze`; if the repository root already contains `package.json` and `vercel.json`, leave Root Directory as `./`. The Vercel config explicitly runs `npm install` and `npm run build`, then serves the `dist` output.

For local development, run `npm install` once and then `npm run dev`. If the API is unavailable, the site now shows a connection screen with a retry button instead of staying on the loading screen.

## Demo users

- `u1` Aarav Mehta — Software Engineer / Backend Engineering / Noida — partially complete, includes a blocked repo-access dependency.
- `u2` Maya Rao — Product Manager / Product / Mumbai — mostly complete.
- `u3` Ishita Kapoor — HR Executive / People Operations / Noida — intentionally stuck for the HR demo.

The UI starts on `u1`; use the Personalize button to generate a different profile using the supplied role/location options.

## API overview

- `GET /api/knowledge` — searchable onboarding source documents and tags
- `GET /api/users` — demo users
- `GET /api/me/:id` — profile + personalized checklist
- `POST /api/onboarding/generate` — generate/update personalized week
- `PATCH /api/tasks/:userId/:taskId` — complete/reopen/block a task
- `POST /api/assistant` — grounded onboarding Q&A + citation + handoff
- `GET /api/admin/analytics` — synthetic HR dashboard metrics
- `POST /api/admin/tasks` / `PUT /api/admin/tasks/:id` — task authoring endpoints

## Grounding behavior

The assistant only uses text from `knowledgeDocuments` in `data/db.json`. For common onboarding questions it selects the relevant approved document and returns the document title, section, and source text. For uncertain/sensitive questions it declines to guess and creates a human-handoff record.

The demo is deliberately designed to make the trust boundary visible to judges. A production implementation would replace the deterministic retrieval layer with a real vector search + LLM RAG service while preserving the same source-citation and refusal pattern.

## Data model

The JSON file mirrors these requested models:

- `users`
- `tasks` (onboarding tasks)
- `taskProgress`
- `knowledgeDocuments`
- `contacts`
- `supportEscalations`

Dependencies are represented by `tasks.dependsOn`.

## 3-minute judge demo

1. Start on Aarav’s employee dashboard.
2. Point to the personalized journey and progress ring.
3. Show role/location-specific tasks for Software Engineer + Backend + Noida.
4. Ask: “Why is repository access blocked?” — show the dependency and source citation.
5. Mark Security Awareness Training complete; the repo task becomes unblocked.
6. Ask: “Who is my HR contact?” — show the verified contact card.
7. Click Personalize and switch to Product Manager + Mumbai to show that the journey changes.
8. Switch to HR Admin. Show employees, blockers, open handoffs, missed tasks, and the day-by-day completion curve.

## Intentional MVP boundaries

Excluded to keep the hackathon build reliable: enterprise SSO, real HRIS/ITSM integrations, production-grade vector database, automated email/Teams notifications, full RBAC enforcement, audit-grade immutable storage, and real-time multi-tenant administration.
