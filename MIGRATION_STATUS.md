# Migration status — K-M Promotions

## Source baseline imported to `main`

The existing AppDeploy source snapshot was imported from the uploaded build manifest ZIP and cross-checked against the latest stored AppDeploy source version `1795018518605`.

Imported application areas include:
- React/Vite public website and admin dashboard
- K-M visual styles and responsive layout
- Product create/edit/publish/delete and affiliate redirect/click tracking
- Promotion enquiries and status updates
- Campaign management
- Performance analytics
- Finance records for conversions and payouts
- Original AppDeploy backend and realtime source

## Important compatibility note

This is a source import, not yet a Cloudflare deployment. The frontend still imports `@appdeploy/client`, and the backend still imports `@appdeploy/sdk`. Those platform integrations must be replaced with Cloudflare-compatible code before the app can run independently on Cloudflare.

## Data preservation gate

The ZIP contains source code and build metadata, not the live database contents or uploaded product media. The original logical data tables are:
- `km_affiliate_products`
- `km_promotion_enquiries`
- `km_promotion_campaigns`
- `km_affiliate_click_events`
- `km_affiliate_conversions`
- `km_affiliate_payouts`

No live records or media have been copied yet. Do not point the new app at production or switch domains until exports are imported and record counts/media checksums are reconciled. The initial D1 schema is in `cloudflare/schema.sql`.

## Next implementation steps

1. Replace AppDeploy client auth/API calls with a Cloudflare API client and a protected admin identity flow for munachimsokenneth@gmail.com.
2. Port backend routes to Workers + D1 and product uploads to R2, retaining existing API response shapes where practical.
3. Export live records and media from AppDeploy, import them with stable IDs, and verify counts and files.
4. Build and test public and admin flows, including mobile navigation and the admin header/sidebar/bottom navigation.
5. Deploy a test Cloudflare address, validate it, and only then plan cutover. The AppDeploy site remains untouched during migration.
