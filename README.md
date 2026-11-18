# K-M Promotions & Affiliate Hub

**Discover. Promote. Earn.**

This repository is the source workspace for migrating the existing K-M Promotions & Affiliate Hub from AppDeploy to Cloudflare.

## Current migration baseline

- The original React + Vite frontend and AppDeploy backend source are being preserved here as the starting point.
- Existing K-M branding and the current public website/admin experience are retained as the migration baseline.
- The existing AppDeploy data is not included in this source export. Products, enquiries, uploaded media, affiliate click history, campaign records, conversions and payouts must be exported from the live backend and verified before cutover.
- The current backend uses AppDeploy SDK services. It must be ported to Cloudflare Workers, D1 and R2 before this repository can be deployed as a standalone Cloudflare application.
- Admin authentication must be replaced with a secure Cloudflare-compatible flow. Do not expose admin endpoints before that is complete.

## Target architecture

- Cloudflare Workers + Static Assets: public site and API
- Cloudflare D1: products, enquiries, campaigns, click events, conversions and payouts
- Cloudflare R2: product images and videos
- One application/repository for both the public website and admin dashboard
- Custom domain can be connected later; development can use the Cloudflare-provided address.

## Local development

Install dependencies with npm, then run `npm run dev`. The AppDeploy SDK integration is still present in this imported baseline, so a Cloudflare-ready build is not complete yet.

## Admin access

The current AppDeploy allowlist is `munachimsokenneth@gmail.com`. Preserve this administrator identity when implementing the replacement authentication flow. Never commit passwords, API tokens or secrets.


## Cloudflare deployment setup

The deployment workflow runs on pushes to `main`. Before it can publish, add these GitHub repository Actions secrets under Settings → Secrets and variables → Actions:
- `CLOUDFLARE_API_TOKEN` — token with Workers Scripts, D1 and account access required for deployment.
- `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID.

After the first Worker deployment, add Worker secrets in Cloudflare:
- `ADMIN_PASSWORD` — a strong, unique administrator password.
- `SESSION_SECRET` — a long random secret (at least 32 random bytes).

The administrator email is configured as `munachimsokenneth@gmail.com`. Do not share the password or secrets in chat or commit them to GitHub.
