This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Configuration

Copy `.env.example` to `.env.local` and fill in. See the file for the full list of variables.

## Email channel setup (Resend)

The activation pipeline sends WhatsApp + email in parallel when a lead has an email address. Resend powers the email side.

1. **Verify the sending domain.** In the Resend dashboard, add `mail.skhokholabs.xyz` and follow the SPF / DKIM / DMARC DNS instructions. Keep the friendly `From` on the apex (`chuma@skhokholabs.xyz`); the subdomain isolates bounce-handling reputation from your real inbox.
2. **Configure the webhook.** Point Resend at `https://<your-app>/api/resend-webhook` and subscribe to: `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`. Copy the signing secret into `RESEND_WEBHOOK_SECRET`.
3. **Set the env vars.** All `RESEND_*`, `EMAIL_*`, and `UNSUBSCRIBE_HMAC_SECRET` from `.env.example`. `EMAIL_PHYSICAL_ADDRESS` is required by POPIA s.69 — the app fails closed if it's missing.
4. **Run the migration.** `SUPABASE_ACCESS_TOKEN=... node scripts/migrate-email.js` adds the email columns, the `email_events` table, and renames `meta_message_id` → `provider_message_id`.

Replies are intentionally fire-and-forget — they land in `chuma@skhokholabs.xyz` (Reply-To) rather than being ingested into the dashboard.
