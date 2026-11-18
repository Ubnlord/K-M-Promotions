# First Cloudflare deployment checklist

The application is configured to deploy from the repository's `main` branch. Complete these one-time account settings first.

## 1. Enable R2 media storage

Cloudflare's API reported that R2 has not yet been enabled for this account.

1. Open the Cloudflare dashboard.
2. Open **R2 Object Storage** from the left navigation.
3. Enable R2 / complete the account's R2 activation steps.
4. Create a bucket named `km-promotions-media`.

Then add this binding to the top-level `wrangler.jsonc` configuration:

```jsonc
"r2_buckets": [
  { "binding": "MEDIA_BUCKET", "bucket_name": "km-promotions-media" }
],
```

Do not enable public bucket access for private uploads. The Worker serves product media through its own media route.

## 2. Add GitHub Actions secrets

In GitHub, open **Settings → Secrets and variables → Actions → New repository secret**.

Add:
- `CLOUDFLARE_API_TOKEN`: a scoped Cloudflare API token with permission to deploy Workers and access the configured D1 and R2 resources.
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account ID.

The deployment workflow is `.github/workflows/deploy.yml`. A push to `main` triggers the build and deploy.

## 3. Set Worker secrets after the first deploy

Use Cloudflare Dashboard → Workers & Pages → `km-promotions-hub` → Settings → Variables and Secrets.

Add these as **secrets**, not plain text variables:
- `ADMIN_PASSWORD`: create a unique, strong password for the K-M admin.
- `SESSION_SECRET`: generate a long random value (at least 32 random bytes).

The allowed administrator email is already configured as `munachimsokenneth@gmail.com`.

## 4. Verify the deployment

Open the Worker URL ending in `.workers.dev` and check:
- `/api/_healthcheck` returns `ok: true`.
- `/#admin` shows the administrator email/password login.
- Admin login works and the products, enquiries, campaigns, performance and finance sections load.
- Product media upload and display work after the R2 binding is active.

## 5. Migrate existing live data before switching

The current AppDeploy build-manifest ZIP contains source files, not production database rows or uploaded media. Export and import the existing products, enquiries, campaigns, click events, conversions, payouts and product media, preserving their IDs. Compare row counts and verify representative media before changing any public domain.

Keep the current AppDeploy website online until the new deployment and data are verified.
