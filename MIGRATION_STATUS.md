# Migration status — K-M Promotions

## Source and frontend migration

- Imported the original React/Vite public website, admin dashboard, campaign manager, analytics and finance source.
- Added a Cloudflare Workers API implementation and a D1 schema for products, enquiries, campaigns, affiliate click events, conversions and payouts.
- Created Cloudflare D1 database `km-promotions-db` (ID: `163cc83e-5889-4246-8f60-9991fd741c25`) and successfully applied the initial 11 schema statements.
- Added a frontend compatibility client and replaced the old redirect-based sign-in placeholder with an email/password admin login form.
- Added a Cloudflare Worker configuration and a GitHub Actions workflow that deploys from `main`.
- Added admin layout improvements: desktop left-side navigation, sticky admin header and mobile bottom navigation.
- Added an in-dashboard email/password sign-in form, signed HttpOnly session cookies, constant-time password comparison, IP-based failed-login throttling and automatic admin data loading after sign-in.
- Added a repeatable D1 migration file and verified that the live D1 database contains the expected tables, including login-attempt tracking.

## Cloudflare resources and outstanding setup

- D1 is provisioned and schema creation succeeded.
- R2 is not enabled for this Cloudflare account yet. Cloudflare's API returned an instruction to enable R2 in the dashboard. Until that is done, media upload/storage is intentionally unavailable in the new Worker.
- The Worker is not deployed yet. GitHub Actions needs repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- The Worker also needs Cloudflare secrets `ADMIN_PASSWORD` and `SESSION_SECRET`. Do not put passwords or tokens in source code or commit them.
- Once R2 is enabled, create bucket `km-promotions-media` and add the `MEDIA_BUCKET` binding in `wrangler.jsonc`.

## Data preservation gate

The build-manifest ZIP contains source code and build metadata, not live database contents or uploaded product media. Existing AppDeploy logical tables are:
- `km_affiliate_products`
- `km_promotion_enquiries`
- `km_promotion_campaigns`
- `km_affiliate_click_events`
- `km_affiliate_conversions`
- `km_affiliate_payouts`

No live records or uploaded media have been copied. Before cutover, export these tables and media from AppDeploy, import with stable IDs, and reconcile row counts and media objects. The old AppDeploy site must remain online until the Cloudflare version is tested.

## Next steps

1. Enable R2 in Cloudflare, create `km-promotions-media`, and add the R2 binding.
2. Set Worker secrets `ADMIN_PASSWORD` and `SESSION_SECRET`.
3. Add GitHub Actions repository secrets for Cloudflare deployment.
4. Run the deployment workflow from `main`, test public/admin flows and media upload, and fix any build/runtime issues.
5. Export and import AppDeploy data, verify records and media, then plan a controlled cutover.

**Status:** Migration foundation and Worker API source are in `main`; Cloudflare deployment and live data migration are not complete.
