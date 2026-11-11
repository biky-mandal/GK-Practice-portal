# Search engine configuration

## Audit findings

- The Angular 18 application uses the browser application builder and an SPA fallback. It has no Angular SSR or prerender configuration; page content and route-specific metadata are not present in the initial HTML before JavaScript runs.
- `deploy/nginx.conf` serves the expected frontend root, `/var/www/letscrackadre/client/dist/client/browser`, and proxies the API to `127.0.0.1:4000`. The checked-in Nginx file contains HTTP listeners only; whether TLS and host redirects are configured elsewhere is unknown. No certificate, API, or production service configuration was changed.
- The homepage, `/adre` and `/assam-police-forest` have public content. Other defined application routes are login, purchase, account, practice, results, or administration pages and must not be indexed.
- The ADRE page contains time-sensitive statements about the 2026 election, the expected notification, and whether an official syllabus has been released. Their current status is not verifiable from this repository; confirm them against authoritative sources and update the visible copy before relying on it as evergreen search content.
- The former homepage included testimonials with named identities and precise outcome claims that are not substantiated in the repository. That section was removed rather than represented as verified customer feedback.
- The existing banner assets are 1672 x 941 pixels, but each is over 2 MB. Their dimensions are specified to reduce layout shift. Compression remains a manual performance follow-up because image conversion was not verified visually.
- The fallback route previously redirected unknown paths to `/dashboard`. It now renders a not-found view and is marked `noindex`; the static SPA still returns the web server's HTTP status for `index.html` (normally 200), so a true HTTP 404 requires server rendering or a deliberate server-side route strategy.

## Route inventory and index policy

| URL path | Page | Access | Index? | Canonical | Rendering |
| --- | --- | --- | --- | --- | --- |
| `/` | Public preparation landing page | Public | Yes | `https://letscrackadre.com/` | Angular client-rendered |
| `/adre` | ADRE 3.0 information and practice-pack page | Public | Yes | `https://letscrackadre.com/adre` | Angular client-rendered |
| `/assam-police-forest` | Assam Police and Forest information and two practice packages | Public | Yes | `https://letscrackadre.com/assam-police-forest` | Angular client-rendered |
| `/login` | Login and registration | Guest-only; authenticated users are redirected | No (`noindex,nofollow`) | None | Angular client-rendered |
| `/checkout/:language` | Purchase checkout | Authenticated | No (`noindex,nofollow`) | None | Angular client-rendered |
| `/dashboard` | User dashboard | Authenticated | No (`noindex,nofollow`) | None | Angular client-rendered |
| `/practice/gk` | GK practice session | Authenticated | No (`noindex,nofollow`) | None | Angular client-rendered |
| `/result/:attemptId` | Attempt-specific result | Authenticated | No (`noindex,nofollow`) | None | Angular client-rendered |
| `/profile` | User profile | Authenticated | No (`noindex,nofollow`) | None | Angular client-rendered |
| `/admin` | Admin overview | Admin-only | No (`noindex,nofollow`) | None | Angular client-rendered |
| `/admin/questions` | Question management | Admin-only | No (`noindex,nofollow`) | None | Angular client-rendered |
| `/admin/upload` | Question upload | Admin-only | No (`noindex,nofollow`) | None | Angular client-rendered |
| `/admin/users` | User management | Admin-only | No (`noindex,nofollow`) | None | Angular client-rendered |
| `/admin/purchases` | Purchase management | Admin-only | No (`noindex,nofollow`) | None | Angular client-rendered |
| `/admin/messages` | Contact-message management | Admin-only | No (`noindex,nofollow`) | None | Angular client-rendered |
| `/admin/pricing` | Pricing management | Admin-only | No (`noindex,nofollow`) | None | Angular client-rendered |
| `/admin/tests` | Test management | Admin-only | No (`noindex,nofollow`) | None | Angular client-rendered |
| `/admin/settings` | Settings management | Admin-only | No (`noindex,nofollow`) | None | Angular client-rendered |
| Any other path | Not-found view | Public | No (`noindex,nofollow`) | None | Angular client-rendered; HTTP 404 not provided by static fallback |

The route list is taken from `client/src/app/app.routes.ts` and the admin child routes in `client/src/app/features/admin/admin.module.ts`. No landing pages for syllabus, Assam GK, or mock tests have been added. `robots.txt` allows crawling and does not disallow private route paths: the `noindex` metadata must remain crawlable, while authentication and authorization—not robots rules—protect private data.

## Metadata and structured data

`SeoService` updates the document title, description, robots directive, canonical, Open Graph, and Twitter metadata after Angular route navigation. The home page uses the requested title and description. `/adre` and `/assam-police-forest` have separate descriptive metadata. All public pages use absolute HTTPS URLs on the preferred non-WWW origin. The homepage receives one truthful `WebSite` JSON-LD object; no organization details, article, quiz, reviews, or breadcrumb data are asserted.

The homepage title includes `2026` as requested and should be reviewed when preparing the next exam-year campaign.

Because the site is client-rendered, social crawlers and search bots that do not execute JavaScript can see only the shell and homepage defaults on direct route requests. The metadata implementation does not replace SSR. A full Angular 18 SSR/prerender migration should be a separately tested project: there is no current Node rendering service or Nginx TLS configuration in the checked-in deployment file, and runtime `env.js` plus authenticated route behavior need to be integrated and tested for that hosting model.

## Static SEO assets

`client/public/robots.txt` is copied to the build root and contains:

```text
User-agent: *
Allow: /

Sitemap: https://letscrackadre.com/sitemap.xml
```

`client/public/sitemap.xml` contains only these verified indexable URLs:

- `https://letscrackadre.com/`
- `https://letscrackadre.com/adre`
- `https://letscrackadre.com/assam-police-forest`

No `lastmod` values are emitted because there is no reliable content-update timestamp. The sitemap is static and will only change when the maintained public route list changes. The Nginx configuration has exact-file locations for these files, returns 404 if a file is missing, and applies a one-hour cache lifetime. `index.html` is revalidated and `env.js` remains `no-store`. One-year immutable caching is limited to hashed JavaScript and CSS bundles; named images and other un-hashed assets are not given immutable caching.

## Build and local validation (Windows PowerShell)

From the repository root:

```powershell
Set-Location 'C:\Users\mbiky\Desktop\ADRE3.0\gk-practice-portal\client'
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Angular production build failed.' }

$buildRoot = Join-Path (Get-Location) 'dist\client\browser'
foreach ($file in @('robots.txt', 'sitemap.xml', 'env.js', 'index.html')) {
  if (-not (Test-Path (Join-Path $buildRoot $file))) { throw "Missing build asset: $file" }
}

[xml]$sitemap = Get-Content -Raw (Join-Path $buildRoot 'sitemap.xml')
$namespace = [System.Xml.XmlNamespaceManager]::new($sitemap.NameTable)
$namespace.AddNamespace('sm', 'http://www.sitemaps.org/schemas/sitemap/0.9')
$urls = @($sitemap.SelectNodes('/sm:urlset/sm:url/sm:loc', $namespace) | ForEach-Object { $_.InnerText })
$expected = @('https://letscrackadre.com/', 'https://letscrackadre.com/adre', 'https://letscrackadre.com/assam-police-forest')
if (($urls -join "`n") -cne ($expected -join "`n")) { throw "Unexpected sitemap URLs: $($urls -join ', ')" }
if ((Get-Content -Raw (Join-Path $buildRoot 'robots.txt')) -notmatch 'Sitemap: https://letscrackadre\.com/sitemap\.xml') { throw 'robots.txt sitemap reference is missing.' }

Compress-Archive -Path (Join-Path $buildRoot '*') -DestinationPath '.\seo-deploy.zip' -Force
```

`env.js` must remain in the build package: its hostname-based runtime API selection is unchanged. Do not include server `.env` files in a static frontend archive.

## Deployment (manual; do not run automatically)

The VPS SSH username and hostname were not present in the repository. Replace `VPS_USER` and `VPS_HOST` with the operator-provided values. These commands deploy only the static Angular build; they do not restart PM2 or change secrets.

From the client directory after the build/package block above:

```powershell
$VpsUser = 'VPS_USER'
$VpsHost = 'VPS_HOST'
scp '.\seo-deploy.zip' "${VpsUser}@${VpsHost}:/tmp/letscrackadre-seo.zip"
ssh "${VpsUser}@${VpsHost}"
```

After connecting over SSH, stage and validate a new release beside the current frontend root, then switch directories. Keep the printed backup path for rollback:

```sh
set -eu
ROOT=/var/www/letscrackadre/client/dist/client/browser
STAMP=$(date +%Y%m%d%H%M%S)
NEXT="${ROOT}.release-${STAMP}"
BACKUP="${ROOT}.backup-${STAMP}"
sudo mkdir -p "$NEXT"
sudo unzip -oq /tmp/letscrackadre-seo.zip -d "$NEXT"
sudo test -s "$NEXT/index.html"
sudo test -s "$NEXT/env.js"
sudo test -s "$NEXT/robots.txt"
sudo test -s "$NEXT/sitemap.xml"
sudo mv "$ROOT" "$BACKUP"
if ! sudo mv "$NEXT" "$ROOT"; then
  sudo mv "$BACKUP" "$ROOT"
  exit 1
fi
printf 'Rollback backup: %s\n' "$BACKUP"
```

The two directory renames can cause a brief gap in service. Check the active Nginx configuration and static root before deployment (`sudo nginx -T`); the repository file alone does not establish the production TLS/redirect setup. No Nginx reload is needed for a static asset-only release.

Verify after deployment:

```sh
curl -fsS https://letscrackadre.com/robots.txt
curl -fsS https://letscrackadre.com/sitemap.xml
curl -fsSI https://letscrackadre.com/
curl -fsS https://letscrackadre.com/ | head
```

Confirm the sitemap response is XML and lists only the two canonical URLs, the homepage returns successfully, `/env.js` points to the production API URL when loaded in a browser, and both preferred-domain URLs resolve over HTTPS. Check `https://www.letscrackadre.com/` redirects to the non-WWW HTTPS host; this redirect is not verifiable or configurable from the checked-in HTTP-only Nginx file.

### Rollback

If checks fail, replace `BACKUP_PATH` with the exact printed backup path and run:

```sh
set -eu
ROOT=/var/www/letscrackadre/client/dist/client/browser
BACKUP_PATH=/var/www/letscrackadre/client/dist/client/browser.backup-YYYYMMDDHHMMSS
FAILED="${ROOT}.failed-$(date +%Y%m%d%H%M%S)"
sudo mv "$ROOT" "$FAILED"
sudo mv "$BACKUP_PATH" "$ROOT"
curl -fsSI https://letscrackadre.com/
```

The failed deployment is retained for inspection rather than deleted. If the second rename fails, move `$FAILED` back to `$ROOT` and investigate before retrying.

## Google Search Console

1. Open the verified `letscrackadre.com` property.
2. Choose **Sitemaps**, submit `https://letscrackadre.com/sitemap.xml`, and review the processing status and discovered URLs.
3. Use **URL inspection** for `https://letscrackadre.com/` and `https://letscrackadre.com/adre`; run a live test and verify the rendered title, description, canonical, and visible page content before requesting indexing.
4. Inspect a private route only to confirm it is not indexed and its rendered robots directive is `noindex,nofollow`. Do not request indexing for private URLs.
5. Recheck after future deployments that change public page paths or metadata.
