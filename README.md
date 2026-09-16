# MEDIA OS Command Center — How The World Works

Operational cockpit for the MEDIA OS, built with Next.js, Vercel and Neon Postgres.

## Operating model

The dashboard is the cockpit, not the whole production system.

- **Radar / Queue automations:** research opportunities every day and prepare production-ready packages.
- **Human gate:** the owner decides what gets produced.
- **ChatGPT + HeyGen:** when a production package is ready, use the ChatGPT conversation to say `Produzir no HeyGen: <title>`. ChatGPT can use the connected HeyGen workflow directly; no MP4 download/upload step should be required in the normal workflow.
- **Metricool:** distribute approved finished videos to the connected YouTube and TikTok accounts.
- **Neon:** system of record for opportunities, content, research, publications, performance, decisions and learnings.

The daily automations should stop before HeyGen generation. Production is an explicit human decision and is not triggered merely by a trend or research result.

## Data behavior

The dashboard is **live-data only**. It reads the `How The World Works` channel from Neon at runtime through `DATABASE_URL`.

If `DATABASE_URL` is missing or the Neon query fails, the UI shows **DATABASE OFFLINE** and does not display a fabricated/local snapshot.

## Vercel

1. Connect this GitHub repository to the Vercel project.
2. Use the Next.js framework preset.
3. Add `DATABASE_URL` to Production, Preview and Development environments using the Neon connection string.
4. Redeploy after changing environment variables.

Never commit `.env` files or database credentials.
