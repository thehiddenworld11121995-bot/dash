# MEDIA OS Dashboard — How The World Works

Operational dashboard for the MEDIA OS, built with Next.js and Neon Postgres.

## Data
The dashboard reads the `How The World Works` channel from Neon at runtime through `DATABASE_URL`. If the variable is missing or Neon is unavailable, the UI falls back to a local snapshot.

## Deploy on Vercel
1. Import this GitHub repository into Vercel.
2. Use the Next.js framework preset.
3. Add `DATABASE_URL` as a Production environment variable using the Neon connection string.
4. Deploy.

Never commit `.env` files or database credentials.
