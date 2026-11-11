# Let's Crack ADRE

**Website: [letscrackadre.com](https://letscrackadre.com)**

A full-stack examination preparation platform for the Assam Direct Recruitment
Examination (ADRE) and Assam Police and Forest written-test practice. It combines
English/Assamese questions, subject practice, previous-year papers, mock tests,
paid test series, learner results, and role-based administration.

The repository is named **GK Practice Portal** and contains an Angular web client,
an Express/TypeScript API, MongoDB persistence, and a Capacitor Android project.
The inventory below describes the checked-in implementation; production service
availability and exam/recruitment announcements must be verified separately.

## Contents

- [Features](#features)
- [Technology stack](#technology-stack)
- [Application URLs and page paths](#application-urls-and-page-paths)
- [Project structure and source paths](#project-structure-and-source-paths)
- [Local development](#local-development)
- [Environment configuration](#environment-configuration)
- [Creating an administrator](#creating-an-administrator)
- [Question content and imports](#question-content-and-imports)
- [API paths](#api-paths)
- [WebSocket practice](#websocket-practice)
- [Build and test commands](#build-and-test-commands)
- [Production deployment](#production-deployment)
- [Android application](#android-application)
- [GitHub publishing and secrets](#github-publishing-and-secrets)
- [Detailed feature behavior](#detailed-feature-behavior)
- [SEO and deployment notes](#seo-and-deployment)

## Features

### Learners and public pages

- Responsive homepage with ADRE and Assam Police/Forest preparation tracks,
  package information, live catalog prices, reviews, and a contact form.
- Dedicated exam information pages with practice offerings; the ADRE page
  includes paper-pattern selectors, syllabus reference content, PYQ information,
  and FAQs.
- Email/password sign-in and registration. First sign-in with an unknown email
  creates a learner account; the active login flow is **not phone OTP login**.
- Password recovery using emailed codes, profile/account information, sign-out
  across sessions, and account deletion through authenticated or emailed-code flows.
- JWT access tokens and rotating refresh-token cookies, login rate limits,
  account lockout, and learner/admin/superadmin roles.
- Public dashboard/package browsing; authentication is required to start a test.
  Learners see purchased content under **My Items**, available packages,
  practice statistics, and their most recent submitted tests.
- English and Assamese question content, options, explanations, and mathematical
  text rendering with KaTeX.
- Timed subject practice, answer saving/clearing, mark for review, session
  pause/resume, automatic submission, and persisted scoring through WebSockets.
- Results with score, percentage, correct/incorrect/unanswered counts and question
  review. Learners can report question problems for admin review.
- Daily free practice with an India-time day boundary, selected free subject
  practice, a free first mock in each collection, and a free designated PYQ paper.
- Razorpay checkout, server-side payment verification, signed webhooks,
  purchase records, content entitlements, and package reviews.
- Privacy policy, account-deletion page, route-specific SEO metadata, robots,
  sitemap, and a not-found page.

### Practice collections

| Collection | Original package ID | Content |
| --- | --- | --- |
| ADRE subject practice | `subject` | Subject selection and random practice questions |
| ADRE previous-year questions | `pyq` | 2022 and 2024 papers, with five paper types per year |
| ADRE mock tests | `mock` | Ten numbered mock sets, populated from tagged questions |
| Police/Forest subject practice | `police-subject` | Separate exam-scoped subject bank |
| Police/Forest mock tests | `police-mock` | Ten Constable practice mocks; exactly 100 questions, 50 marks, 90 minutes |

These are content/access identifiers, not separate page routes. Administrators
can create additional catalog packages and bundles mapped to the existing modes.
Live prices and availability come from the database, not this README. Complete,
reviewed question banks are not supplied automatically for every advertised set.

### Administration

- Overview statistics, trend data, attempt monitoring, admin presence, and
  admin broadcast chat.
- Question search/filtering, configurable pagination, bilingual editing,
  bulk updates, activation/archiving, deletion, reference images, and math tools.
- Question imports with normalization and validation, persistent upload drafts,
  named draft sets, review, editing, and publication.
- Subject/category and exam-label management with rename propagation.
- English-to-Assamese translation with Google Translation and a MyMemory fallback.
- Optional paid AI answer verification with sources, persisted reports, stale
  report detection, and explicit human approval before saving an answer change.
- User and purchase views, contact-message handling, question-flag moderation,
  package-review moderation, pricing, catalog/content-option editors, and settings.
- Superadmin-only user creation, role/account administration, package grants and
  revocation, password resets, unlocking, forced sign-out, and user deletion.
- Superadmin-only landscape and 9:16 Shorts simulations with separate question
  histories, language modes, countdown audio, answer reveals, and recording layouts.
- Scheduled exam management through the backend, separate from question exam labels.

See [Detailed feature behavior](#detailed-feature-behavior) for access rules,
translation limits, package lifecycle, and simulation behavior.

## Technology stack

| Layer | Technologies |
| --- | --- |
| Web application | Angular 18, TypeScript, Angular Material/CDK, RxJS, SCSS, KaTeX |
| API | Node.js, Express 4, TypeScript, Zod |
| Database | MongoDB with Mongoose |
| Authentication | bcrypt password hashing, JWT access tokens, rotating refresh tokens |
| Real-time communication | `ws` WebSocket server |
| Payments and email | Razorpay API/webhooks, Nodemailer/SMTP |
| Optional content services | Google Translation, MyMemory, OpenAI Responses API |
| Android | Capacitor 8, native Android/Gradle project |
| Tests | Vitest, Supertest, mongodb-memory-server; Angular Jasmine/Karma |
| Deployment templates | Nginx static hosting/reverse proxy and PM2 |

## Application URLs and page paths

Production addresses configured in the project:

- Website: <https://letscrackadre.com>
- Additional configured web hostname: <https://www.letscrackadre.com>
- API base: <https://api.letscrackadre.com/api>
- API health: <https://api.letscrackadre.com/api/health>
- Practice WebSocket: `wss://api.letscrackadre.com/ws/practice`
- Sitemap: <https://letscrackadre.com/sitemap.xml>
- Robots: <https://letscrackadre.com/robots.txt>

Append these paths to the website origin. Parameters beginning with `:` are
placeholders, not literal URL segments.

| Page path | Purpose | Access |
| --- | --- | --- |
| `/` | Preparation homepage and catalog | Public |
| `/adre` | ADRE information and test series | Public |
| `/assam-police-forest` | Police/Forest information and test series | Public |
| `/login` | Sign-in, registration, password recovery | Guests |
| `/dashboard` | Catalog, My Items, practice selection and statistics | Public browsing; personal data requires login |
| `/checkout/:pack` | Purchase a catalog package | Signed-in learner |
| `/practice/gk` | Shared practice runner for the supported modes | Signed-in learner; server checks content access |
| `/result/:attemptId` | Submitted attempt result and review | Signed-in owner |
| `/profile` | Account information and account actions | Signed-in learner |
| `/privacy-policy` | Privacy information | Public |
| `/delete-account` | Account-deletion information and request flow | Public |
| Any unmatched path | Not-found page | Public |

Admin and superadmin accounts are redirected from learner-only pages to the
administration area. Source of truth:
[application routes](client/src/app/app.routes.ts) and
[route guards](client/src/app/core/auth.guard.ts).

### Administration paths

| Page path | Purpose | Access |
| --- | --- | --- |
| `/admin` | Overview and administration shell | Admin/superadmin |
| `/admin/questions` | Question bank and editing | Admin/superadmin |
| `/admin/categories` | Subject/category management | Admin/superadmin |
| `/admin/exams` | Question exam-label management | Admin/superadmin |
| `/admin/upload` | Imports, upload drafts, review and publication | Admin/superadmin |
| `/admin/users` | User listing; account mutations require superadmin | Admin/superadmin |
| `/admin/purchases` | Purchase records | Admin/superadmin |
| `/admin/messages` | Contact messages | Admin/superadmin |
| `/admin/flags` | Reported question issues | Admin/superadmin |
| `/admin/reviews` | Package-review moderation | Admin/superadmin |
| `/admin/pricing` | Prices and sale state | Admin/superadmin |
| `/admin/packages` | Catalog packages, bundles and content options | Admin/superadmin |
| `/admin/tests` | Attempt monitoring | Admin/superadmin |
| `/admin/settings` | Application/practice settings | Admin/superadmin |
| `/admin/simulation` | Landscape question simulation | Superadmin only |
| `/admin/simulation-shorts` | Portrait 9:16 simulation | Superadmin only |

Source: [admin routes](client/src/app/features/admin/admin.module.ts).
API authorization is enforced independently of navigation visibility.

## Project structure and source paths

```text
gk-practice-portal\
  README.md
  .gitignore
  client\
    package.json
    angular.json
    capacitor.config.ts
    README.md
    SEO.md
    public\                 Images, logo, env.js, robots.txt, sitemap.xml
    src\
      main.ts               Angular entry point
      index.html            Browser document
      styles.scss           Global styles
      environments\         Development/production API URLs
      app\
        app.routes.ts       Top-level page routes
        core\               Auth, guards, interceptors, pricing, sockets, SEO
        shared\             Shared UI, math rendering, not-found view
        features\
          landing\          Public homepage
          adre\             ADRE information
          police-forest\    Police/Forest information
          login\            Account entry and password recovery
          dashboard\        Catalog and learner dashboard
          checkout\         Purchase flow
          practice\         Live test runner
          result\           Results and question review
          profile\          Account UI
          legal\            Privacy and deletion pages
          admin\            Administration and simulations
    android\
      app\                  Native Android application
      gradle\wrapper\       Gradle wrapper
      variables.gradle      Android SDK and dependency versions
      keystore.properties   Private local signing configuration (ignored)
      local.properties      Local Android SDK path (ignored)
  server\
    package.json
    tsconfig.json
    .env.example            Sanitized local configuration template
    .env.production.example Sanitized production configuration template
    src\
      app.ts                Express middleware and API router mounts
      server.ts             Database/server startup and WebSocket wiring
      config\               Environment validation, database, logging
      middleware\           Authentication, validation, error handling
      models\               Users, questions, attempts, payments, catalog, etc.
      routes\               HTTP endpoint definitions
      services\             Application/domain logic and external integrations
      ws\                   Practice sessions, presence, admin chat
      utils\                Shared backend utilities and scoring
      types\                Backend type declarations
      scripts\              User creation, sample imports, development seed
        data\               Sample import JSON
      __tests__\            Backend automated tests
  deploy\
    nginx.conf              Website/API reverse-proxy template
    ecosystem.config.cjs    Single-instance PM2 application
```

Useful entry points:
[frontend guide](client/README.md),
[SEO/deployment guide](client/SEO.md),
[backend environment schema](server/src/config/env.ts),
[HTTP router mounts](server/src/app.ts),
[practice socket protocol](server/src/ws/practiceSocket.ts),
[practice/scoring service](server/src/services/testService.ts),
and [package entitlements](server/src/services/entitlementService.ts).

## Local development

### Prerequisites

- Git and npm.
- A Node.js release supported by Angular 18; use Node.js 22.x **22.0 or newer**
  to also meet the installed Capacitor 8 CLI requirement.
- A running local MongoDB instance, or a MongoDB Atlas connection string with
  the required database/network access.
- Optional: SMTP for recovery/deletion email, Razorpay for checkout, and
  translation/OpenAI credentials for the corresponding admin tools.
- Android Studio, an appropriate JDK, and Android SDK 36 only if building Android.

Commands below use Windows PowerShell, starting from the cloned repository root.
Use separate terminals for the backend and frontend. There is no root application
start script; install and run each application in its own directory.

### Backend terminal

```powershell
Set-Location .\server
npm ci
Copy-Item .env.example .env
# Edit .env: configure MONGO_URI and two distinct JWT secrets before starting.
npm run dev
```

Copy the template only on first setup; do not overwrite an existing private
environment file. By default the API listens on `http://localhost:4000`.
Verify startup at `http://localhost:4000/api/health`.

### Frontend terminal

```powershell
Set-Location .\client
npm ci
npm start
```

Open `http://localhost:4200`. The development API URL is configured in
[environment.development.ts](client/src/environments/environment.development.ts).
Keep the backend running for authentication, catalog, practice and payments.

## Environment configuration

The backend loads its private `.env` from the process working directory via
`dotenv`. Run server commands from the server directory. Use
[the development template](server/.env.example) locally and
[the production template](server/.env.production.example) for deployment.
The authoritative defaults and validation are in
[env.ts](server/src/config/env.ts).

| Variable(s) | Purpose |
| --- | --- |
| `NODE_ENV` | `development`, `test`, or `production` |
| `PORT` | API port; default `4000` |
| `MONGO_URI` | MongoDB connection string; required explicitly in production |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Distinct private signing secrets, each at least 32 characters; explicitly required in production |
| `FRONTEND_ORIGIN` | Comma-separated allowed browser origins; local default `http://localhost:4200` |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Server-side Razorpay order/payment integration |
| `RAZORPAY_WEBHOOK_SECRET` | Verification secret configured for the Razorpay webhook |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Email delivery; default SMTP port `587` |
| `CONTACT_NOTIFY_EMAILS` | Optional extra comma-separated contact-notification recipients |
| `GOOGLE_TRANSLATE_API_KEY` | Optional primary English-to-Assamese translation provider key |
| `TRANSLATION_GOOGLE_COOLDOWN_SECONDS` | Google quota-error cooldown; default `300`, range `1` to `86400` |
| `OPENAI_API_KEY` | Optional paid admin answer verification |
| `OPENAI_VERIFICATION_MODEL` | Responses API model; default `gpt-5.5`, subject to account availability |
| `OTP_PROVIDER`, `SMS_ACCOUNT_SID`, `SMS_AUTH_TOKEN`, `SMS_FROM` | Existing OTP/SMS service configuration; not the active email/password login flow |
| `OTP_EXPIRY_MINUTES`, `OTP_RATE_LIMIT_PER_PHONE`, `OTP_RATE_LIMIT_PER_IP` | OTP service expiry/request limits; defaults `5`, `3`, `5` |
| `OTP_RESEND_COOLDOWN_SECONDS`, `MAX_OTP_ATTEMPTS` | OTP resend and attempt limits; defaults `30`, `5` |

For production, set `FRONTEND_ORIGIN` to
`https://letscrackadre.com,https://www.letscrackadre.com`.
Generate a separate value for each JWT secret:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Treat the output as a secret. Do not copy real values into templates or this README.

### Frontend API configuration

The current Angular services read `environment.apiUrl`:

- [Development environment](client/src/environments/environment.development.ts):
  `http://localhost:4000/api`.
- [Production environment](client/src/environments/environment.ts):
  `https://api.letscrackadre.com/api`.
- [Angular build configuration](client/angular.json) selects the development
  replacement for `npm start`; `npm run build` defaults to production.

[client/.env.example](client/.env.example) and
[public/env.js](client/public/env.js) contain an `NG_APP_API_URL` convention,
but the current services do not consume it as an override. Editing a client
`.env` alone does not change the API URL; edit the appropriate Angular environment
and rebuild. Browser assets are public: never put server secrets in them.

## Creating an administrator

Public registration creates learners, not administrators. The operator script can
create or update an existing account, including its password and role.
Run it only against the intended database.

From the server directory, securely collect a password in PowerShell rather than
placing a real password in the command line:

```powershell
$password = Read-Host 'Administrator password' -AsSecureString
$env:USER_PASSWORD = [System.Net.NetworkCredential]::new('', $password).Password
try {
    npm run user:create -- --email admin@example.com --name "Site Administrator" --role superadmin
} finally {
    Remove-Item Env:\USER_PASSWORD
    Remove-Variable password
}
```

Use `--role admin` for a regular admin or `--role user` for a learner.
The optional `--pack` argument accepts an original package ID or `all` to grant
access for test accounts. The script resets account lockout and invalidates
existing access tokens; it is not a read-only operation.
Sign in at `/login` with the created account to enter `/admin`.
Source: [createUser.ts](server/src/scripts/createUser.ts).

## Question content and imports

- Use `/admin/upload` for the normal import, draft review and publish workflow.
- Sample input: [sample-question.json](server/src/scripts/data/sample-question.json).
- From the server directory, `npm run import:sample` imports the bundled sample.
  `npm run import:sample -- "C:\path\to\questions.json"` imports another JSON file.
  The script normalizes records, upserts by question ID and activates them;
  review content before using it on a live database.
- Assign the appropriate exam label to scope ADRE versus Police/Forest content.
  Use `MOCK 1` through `MOCK 10` tags for numbered mocks.
- PYQ selection uses `PYQ`, `ADRE 2022` or `ADRE 2024`, and the paper's grade,
  paper number and level tags. See [pyq.ts](server/src/models/pyq.ts).
- Publish enough active, playable questions before enabling paid content.
  Translation and AI verification help review; they do not guarantee accuracy.

**Destructive development seed:** `npm run seed` deletes **all existing questions**
before inserting illustrative examples. Use it only with a disposable development
database, never a production question bank. Its example facts also require review.

## API paths

Local base URL: `http://localhost:4000/api`.
Production base URL: `https://api.letscrackadre.com/api`.
All paths below include `/api`; do not append it twice.
Authenticated HTTP requests use `Authorization: Bearer <access-token>`.
Refresh cookies additionally require credentials and the expected AJAX header
(`X-Requested-With: XMLHttpRequest`) where enforced by the auth router.

### Public and learner APIs

| Method | Path | Purpose/access |
| --- | --- | --- |
| GET | `/api/health` | Public health response |
| POST | `/api/auth/register`, `/api/auth/login` | Registration or email/password sign-in |
| POST | `/api/auth/forgot-password`, `/api/auth/reset-password` | Email-code recovery |
| POST | `/api/auth/refresh`, `/api/auth/logout` | Refresh-token cookie/session handling |
| POST | `/api/auth/logout-all` | Revoke the signed-in user's sessions |
| GET | `/api/auth/me` | Signed-in account |
| DELETE | `/api/auth/me` | Authenticated account deletion with password and confirmation |
| POST | `/api/auth/delete-account/request`, `/api/auth/delete-account/confirm` | Email-code account deletion |
| GET | `/api/dashboard/stats`, `/api/dashboard/recent-attempts` | Signed-in learner statistics/history |
| GET | `/api/tests/packages`, `/api/tests/pyq`, `/api/tests/mocks` | Public content summaries with optional ownership |
| GET | `/api/tests/daily-free` | Signed-in daily test availability |
| GET | `/api/tests/:attemptId/result` | Owner's submitted result |
| GET | `/api/purchases/prices` | Public catalog/pricing |
| GET | `/api/purchases` | Signed-in user's purchases |
| POST | `/api/purchases/order`, `/api/purchases/verify` | Authenticated Razorpay checkout |
| POST | `/api/purchases/webhook` | Raw-body, signature-verified Razorpay webhook |
| POST | `/api/contact` | Public contact submission with rate limiting |
| POST | `/api/flags` | Authenticated question report |
| GET | `/api/reviews` | Public reviews, optionally personalized |
| PUT | `/api/reviews/:pack` | Authenticated package review, subject to eligibility |

### Admin APIs

These routes require admin/superadmin authentication. Additional superadmin-only
checks apply to simulations and user mutations.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/admin/manage/stats`, `/api/admin/manage/stats/trends` | Overview metrics |
| GET | `/api/admin/manage/questions`, `/api/admin/manage/questions/:id` | Question listing/detail |
| PUT / DELETE | `/api/admin/manage/questions/:id` | Edit/delete a question |
| PATCH | `/api/admin/manage/questions/bulk`, `/api/admin/manage/questions/:id/active` | Bulk edits/active state |
| GET / POST | `/api/admin/manage/questions/:id/verification` | Load saved/run paid AI verification |
| POST | `/api/admin/manage/translate` | Translate editor content |
| GET / POST | `/api/admin/manage/categories`, `/api/admin/manage/exams` | List/create subjects or question exam labels |
| PUT / DELETE | `/api/admin/manage/categories/:id`, `/api/admin/manage/exams/:id` | Rename/delete labels |
| GET | `/api/admin/manage/users` | User listing |
| POST | `/api/admin/manage/users` | Create user (superadmin) |
| PATCH / DELETE | `/api/admin/manage/users/:id` | Update role/name or delete user (superadmin) |
| POST | `/api/admin/manage/users/:id/purchases` | Grant package (superadmin) |
| DELETE | `/api/admin/manage/users/:id/purchases/:pack` | Revoke package (superadmin) |
| POST | `/api/admin/manage/users/:id/password`, `/api/admin/manage/users/:id/unlock`, `/api/admin/manage/users/:id/sign-out` | Account administration (superadmin) |
| GET | `/api/admin/manage/purchases`, `/api/admin/manage/attempts` | Purchase/attempt monitoring |
| GET | `/api/admin/manage/messages`, `/api/admin/manage/flags`, `/api/admin/manage/reviews` | Moderation lists |
| PATCH / DELETE | `/api/admin/manage/messages/:id`, `/api/admin/manage/flags/:id` | Update/delete moderation records |
| DELETE | `/api/admin/manage/reviews/:id` | Remove review |
| GET / POST | `/api/admin/manage/packages`, `/api/admin/manage/package-content` | List/create packages or content options |
| PUT | `/api/admin/manage/packages/:pack`, `/api/admin/manage/package-content/:id` | Update/archive catalog entries |
| GET / PUT | `/api/admin/manage/pricing`, `/api/admin/manage/settings` | Pricing/application settings |
| GET / POST | `/api/admin/manage/broadcast` | Admin message history/post |
| GET | `/api/admin/manage/simulation/questions`, `/api/admin/manage/simulation/categories` | Simulation question data/counts (superadmin) |
| POST | `/api/admin/manage/simulation`, `/api/admin/manage/simulation/reset` | Start/reset simulation history (superadmin) |
| GET / POST | `/api/admin/questions` | Question listing/creation |
| PATCH | `/api/admin/questions/:id` | Question update |
| POST | `/api/admin/questions/import`, `/api/admin/questions/bulk-import` | Question import |
| GET / POST | `/api/admin/questions/drafts` | Persistent upload drafts |
| PUT / DELETE | `/api/admin/questions/drafts/:id` | Edit/delete a draft |
| POST | `/api/admin/questions/drafts/rename-set`, `/api/admin/questions/drafts/delete-set`, `/api/admin/questions/drafts/publish` | Draft-set management/publication |
| GET | `/api/admin/questions/count` | Question count |
| POST | `/api/admin/questions/:id/publish`, `/api/admin/questions/:id/archive` | Publication/archiving |
| GET / POST | `/api/admin/exams` | Scheduled exam listing/creation |
| PATCH | `/api/admin/exams/:examId` | Scheduled exam update |
| POST | `/api/admin/exams/:examId/publish` | Scheduled exam publication |

Older `/api/questions`, `/api/exams`, and `/api/attempts` routers are also mounted,
but the application restricts **all three to authenticated administrators**.
They are not learner-facing alternatives to the practice WebSocket.
Consult [route definitions](server/src/routes) for exact request schemas,
query parameters, response bodies, and endpoint-specific restrictions.

## WebSocket practice

- Local: `ws://localhost:4000/ws/practice`.
- Production: `wss://api.letscrackadre.com/ws/practice`.
- Authenticate first with `{ "type": "auth", "token": "<access-token>" }`.
- Session messages: `session.start`, `session.resume`, `session.pause`,
  `session.finish`.
- Answer/review messages: `answer.submit`, `answer.clear`, `review.toggle`.
- Other messages: `presence.update`, `ping`.
- Start supports `exam` (`adre` or `police-forest`), subjects/categories,
  difficulty, question count, daily mode, a PYQ paper, or a mock number.
  Server validation and entitlements determine which combinations are allowed.
- The server owns timing, answer persistence, access checks and scoring; the
  client must not calculate authoritative results or grant package access.

Exact payloads and server events:
[backend protocol](server/src/ws/practiceSocket.ts) and
[Angular socket service](client/src/app/core/practice-socket.service.ts).

## Build and test commands

Run commands in the indicated application directory:

| Directory | Command | Purpose |
| --- | --- | --- |
| `server` | `npm run dev` | Development API with source watching |
| `server` | `npm run build` | Compile TypeScript into `server\dist` |
| `server` | `npm start` | Run compiled `dist\server.js` |
| `server` | `npm test` | Run backend Vitest suite |
| `server` | `npm test -- src/__tests__/auth.test.ts` | Focused backend test example |
| `server` | `npm run user:create -- ...` | Operator account creation/update |
| `server` | `npm run import:sample` | Sample JSON import |
| `server` | `npm run seed` | Destructive development-only question seed |
| `client` | `npm start` | Angular development server |
| `client` | `npm run build` | Production build into `client\dist\client\browser` |
| `client` | `npm run watch` | Development build watcher |
| `client` | `npm test -- --watch=false --browsers=ChromeHeadless` | Headless Angular unit tests; Chrome required |

Backend tests cover authentication, recovery/deletion, question imports and drafts,
bulk question updates, exam labels, packages, PYQs, Police/Forest practice,
scheduled exams, and admin simulations. Some tests use mongodb-memory-server,
which may download a MongoDB binary on first use.
Frontend tests live alongside the corresponding source. No end-to-end runner
is configured in the application package.

## Production deployment

The supplied templates target one Linux host with:

| Resource | Configured path/address |
| --- | --- |
| Project checkout | `/var/www/letscrackadre` |
| Backend working directory | `/var/www/letscrackadre/server` |
| Backend compiled entry | `/var/www/letscrackadre/server/dist/server.js` |
| Static web root | `/var/www/letscrackadre/client/dist/client/browser` |
| Node upstream | `127.0.0.1:4000` |
| PM2 process | `letscrackadre-api` |
| Web hostnames | `letscrackadre.com`, `www.letscrackadre.com` |
| API hostname | `api.letscrackadre.com` |

Deployment checklist:

1. Configure DNS for the web and API hostnames. Provision MongoDB and private
   production environment variables; never deploy template secrets.
2. Install dependencies with `npm ci` in both application directories.
3. Run `npm run build` in the server and client directories, and run the relevant
   tests before release. Deploy source/builds from the same revision.
4. Put the backend `.env` in the configured server working directory with
   restricted permissions. Set `NODE_ENV=production`, the database URI, distinct
   JWT secrets and the production browser origins.
5. Start the API with PM2 using
   [ecosystem.config.cjs](deploy/ecosystem.config.cjs), or restart its existing
   `letscrackadre-api` process. The template runs a single instance.
6. Install/adapt [nginx.conf](deploy/nginx.conf), validate it with `nginx -t`,
   then reload Nginx. Preserve the SPA fallback and WebSocket upgrade headers.
7. **Configure TLS certificates and HTTPS redirects separately.** The checked-in
   Nginx template listens on HTTP port 80 only; it is not a complete HTTPS setup.
   The production client expects HTTPS/WSS, and production auth cookies are secure.
8. Configure Razorpay's webhook URL as
   `https://api.letscrackadre.com/api/purchases/webhook` and use the matching
   private webhook secret. Keep raw-body signature verification intact.
9. Verify the API health response, deep-link reloads, login/refresh, WebSocket
   start/save/resume/finish, package access and payment verification, email
   delivery, admin permissions, robots and sitemap.
10. Keep database backups and a rollback build/revision. Do not run the seed
    script or hand-edit compiled output in production.

Single-process translation cooldowns, AI rate limits, and admin presence are not
shared global limits across multiple Node instances. Scaling requires a separate
design and validation.
See [client/SEO.md](client/SEO.md) for additional deployment and rollback details.

## Android application

The native project is under [client/android](client/android), configured by
[capacitor.config.ts](client/capacitor.config.ts):

- App name: **Let's Crack ADRE**.
- Application ID: `com.letscrackadre.app`.
- Web assets: `client\dist\client\browser`.
- Current Android SDK configuration: minimum 24, compile/target 36.

From the client directory:

```powershell
npm run build
npx cap sync android
npx cap open android
```

The production Angular build uses the public HTTPS API. Configure SDK/JDK tooling
for the checked-in Gradle project in Android Studio.
Create private `android\local.properties` with the local SDK location and
`android\keystore.properties` with `storeFile`, `storePassword`, `keyAlias`, and
`keyPassword`. The current app Gradle script requires `keystore.properties` to
exist even while configuring a debug build.
Never commit the signing file or keystore; back them up securely for future
releases. No release signing passwords are supplied by this README.

## GitHub publishing and secrets

[.gitignore](.gitignore) excludes private `.env` files, Android signing/local
configuration, common private-key formats, dependencies, caches, build output,
and logs. Sanitized `.env.example` templates are intentionally allowed.

- Keep all API keys, database passwords, SMTP credentials and signing passwords
  in private environment/configuration files, never examples or browser assets.
- Ignore rules do not remove files already tracked, staged before being ignored,
  or present in Git history.
- Before committing, inspect filenames and staged changes without the pager:

  ```powershell
  git --no-pager diff --cached --name-only
  git --no-pager diff --cached
  ```

- Do not publish the output of those commands if it contains secrets.
- If a private file is already tracked, remove only that file from the index
  with `git rm --cached -- <exact-file>` after checking the path; this keeps the
  local copy. Secrets in earlier commits also require rotation and appropriate
  history cleanup.
- Enable GitHub secret scanning/push protection where available. `.gitignore`
  is an exclusion mechanism, not a complete security guarantee.

## Detailed feature behavior

### Revisiting test results

Signed-in learners can open **Dashboard > Recent Tests** to review their 10
most recently submitted tests. Each result includes the available questions,
all options, the learner's answers and the correct answers. Unfinished tests
are not included. Results use the current question bank rather than a historical
snapshot, so later question edits appear in the review and deleted questions
cannot be shown; the result page indicates when questions are unavailable.

### Admin exam management

Use **Admin > Exams** to add, rename, and delete question exam labels. ADRE 3.0 and Assam Police and Forest
is seeded on first use; exams are subsequently managed in the database. Renaming
updates assigned questions and saved upload drafts, and deleting removes the label
from them without deleting questions. Removing the last exam leaves the list empty.
The question filters, individual and bulk editors, and upload form use this list.
Imports recognize current exam names and previous names of renamed exams.
The ADRE and Assam Police and Forest labels scope their corresponding practice
question banks; assigning both labels shares a question intentionally. Scheduled
exams and ADRE previous-year paper tags remain separate.

### Admin package management

The dashboard and package details are public. Guests can browse prices, question
counts, mock lists and reviews without logging in; starting any attempt requires
login and returns the learner to the selected test afterwards.
Every registered learner can repeat Mock 1 in each exam collection and the first
listed PYQ paper (ADRE 2.0 / 2024, Grade-III Paper-III) without buying a package.
Each subject-practice collection (ADRE and Police/Forest) also has one free
subject, **Assam Polity** by default. Learners without the subject package can
practise that single subject with 10, 20 or 50 random questions; combining it with
other subjects is not free. Admins choose the free subject (or none) under
**Admin > Settings**; renaming the category keeps the setting in sync. Other
papers, mocks and subjects require the corresponding purchased access. The
existing daily free test remains available separately.

Use **Admin > Packages** (`/admin/packages`) to create and edit the catalog shown
on the home page, the corresponding exam page, the dashboard and checkout.
Packages support a name, description, feature list, ADRE or Police/Forest
collection, selling/original prices, featured styling and display order.
The package ID is permanent and must use lowercase letters, digits and hyphens.
An original price, when supplied, must exceed the selling price.

Select one or more existing content types to sell an individual Test Series or
a bundle: ADRE subject practice, ADRE PYQ, ADRE mocks, Police/Forest subject
practice and Police/Forest mocks. This does not create a new question bank.
The five original packages retain their own content type. Existing live prices
and purchases are preserved when the catalog is first loaded.

- **Show to users** controls catalog visibility; **Available for purchase**
  controls whether visible packages can be bought.
- **Archive** hides a package and stops new purchases without deleting payment
  records, reviews or existing access. Restore it to reuse the same package ID.
- New packages start hidden and unavailable until enabled.
- Content access is saved with each purchase, grant and paid order. Editing,
  hiding or archiving a package does not change previously granted access.
  Purchasers can continue using their unlocked content from **My Items**.
- Admins can manage packages and prices; only superadmins can grant/revoke them
  or assign them while creating users in **Admin > Users**.
- **Admin > Pricing** remains available for quick price and sale-state changes.

The **Content unlocked** editor groups selectable cards by ADRE and Police/Forest,
shows selection counts and previews the practice modes being granted. **Select all**
and **Clear group** affect active options in that collection only.
Use **Manage content options** on the Packages page to add, rename, describe,
reorder, regroup or archive reusable options. Each option maps to one or more
existing practice modes; it does not create independent questions or exam logic.
Archived options remain visible when already selected, but cannot be newly
selected. IDs are permanent. Content mapping changes apply when a package is next
saved, not to existing saved packages or past purchases. The server resolves
selected option IDs into actual practice access rather than trusting the editor's
preview. The original five options are seeded once and subsequent edits persist.
Their mappings always retain their own practice mode, although additional modes
can be included.
Package creation/editing, content-option management and content-option editing
open in scrollable popups. Opening content options from a package keeps the
unsaved package underneath. Close or Cancel dismisses an editor without saving;
successful saves close it automatically. Editors cannot be dismissed while a
save is in progress.

### Assam Police and Forest Test Series

The public `/assam-police-forest` page summarizes the supplied February 2026
recruitment information as historical information, not an open application notice.
The launch covers Constable written-test preparation only; SI/Forest-specific
patterns are not included yet.

- `police-subject`: subject-wise practice, default one-time price INR 499.
- `police-mock`: 10 Constable mocks, default one-time price INR 399.
- Manage live prices and sale availability in **Admin > Pricing**. Superadmins can
  grant/revoke the Test Series from **Admin > Users**. Purchases, reviews and payment
  verification use the same flows as ADRE, with independent entitlements.
- The new question exam label is added to existing installations automatically.
  Renaming retains its identity through aliases; deleted labels stay deleted.
- In **Admin > Questions** or the import form, assign **Assam Police and Forest**
  to the relevant questions. Add `MOCK 1` through `MOCK 10` to assign a mock.
  Each mock requires exactly 100 active, playable questions before it can start.
  Do not label a question ADRE unless it should also appear in ADRE practice.
- Constable mocks award 0.5 per correct answer, zero for wrong/unanswered answers,
  for 50 marks total. The 90-minute timer is a practice choice, not an official
  duration. ADRE and ordinary subject-practice scoring/timing remain unchanged.
- The dashboard lists these Test Series in My Items / Other Items. New Test Series
  contain no seeded question bank: publish reviewed content before selling access.

### Admin simulation

Only superadmins can access `/admin/simulation`, list its subjects, start a
simulation, or reset its history. The navigation entry is hidden from regular
admins, and both the page route and API enforce this restriction.

Each subject has persistent question history shared by
all superadmins and language modes within each format. Regular and 9:16 simulations
have separate unused counts and histories; using or resetting one format does not
affect the other. Existing history is retained for regular simulations, while 9:16
history starts empty when separate tracking is deployed.
Starting a simulation reserves the entire selected
batch, even if it is ended early. Subsequent starts use only unused active questions;
if fewer remain than requested, only those remaining are returned. Exhausting a
subject never resets it automatically.

The simulation uses larger question and option text for readability. With
**English + Assamese** (the default), each saved Assamese translation
appears below its English question and matching option. Saved Assamese explanations
also appear below the English explanation when the answer is revealed, including
when no English explanation is available. Questions with only one
language show the available text without repeating it. **English** and
**Assamese** remain available as single-language modes. Translations must already
be saved on the question; the simulation does not generate them.

After pressing Start on the intro screen, the timer beeps every countdown second,
with a longer, higher-pitched beep at zero. Beeps pause while the answer is
shown and stop when the simulation ends.
In regular manual playback, **Show manual timer** adds a configurable countdown
on the right. That space remains empty until you start it with the timer icon on
each question; at zero the answer
and any reference image appear, and the arrow advances manually. The eye icon
can reveal the answer early. Manual playback without this option has no timer.

Select the subject and use **Reset subject history**, then confirm, to make its
questions available again for everyone in the current format. The other format, other subjects and already-running
simulations are unaffected. Subjects with saved history remain selectable for
reset even when all their questions are inactive or deleted.
Renaming a subject preserves its history. History
starts empty when this feature is deployed; older simulations cannot be recovered.
Starting uses `POST /api/admin/manage/simulation`; remaining counts and reset use
`GET /api/admin/manage/simulation/categories` and
`POST /api/admin/manage/simulation/reset` respectively. All three endpoints accept
`mode` (`landscape` or `portrait`), as a query parameter for categories and a body
field for start/reset. Omitting it preserves regular simulation behavior.
Reset accepts `{ "category": "subject name", "mode": "portrait" }` for 9:16 history.

### Admin question pagination

The admin Questions page offers 20, 50, 100, 150, 200, 250, 300, 350, 400, 450,
500, or All questions per page. Changing the page length returns to page one. All loads every
question matching the current search and filters on a single page; large question
banks may take longer to load. The admin listing API supports numeric page sizes
up to 500 and `pageSize=all`;
other paginated admin listings retain their existing limits.

Use the English / Assamese switch to change the question text
shown in the admin list without changing filters or selections. When a translation
is unavailable, the original text is shown with an explicit notice.

### English-to-Assamese admin translation

The existing `POST /api/admin/manage/translate` endpoint accepts
`{ "texts": ["Question", "", "Answer"] }` and returns
`{ "success": true, "data": { "translations": ["...", "", "..."] } }`.
Only authenticated admins and superadmins can use it. It does not publish or
modify saved questions by itself.

Google Cloud Translation v2 remains primary when `GOOGLE_TRANSLATE_API_KEY` is
configured. Quota errors (including `403 userRateLimitExceeded` and HTTP 429)
open a process-local cooldown; requests use MyMemory during that cooldown.
`TRANSLATION_GOOGLE_COOLDOWN_SECONDS` optionally sets its length (default 300,
range 1–86400). Network errors, timeouts, HTTP 408, 500, 502, 503 and 504 are retried at most
twice, with 250 ms and 500 ms backoff, before falling back. Each upstream request
has a 15-second timeout. Authentication, permission and configuration errors do
not trigger fallback: correct the Google project's API enablement, billing,
restrictions or credentials instead.

MyMemory is also used when no Google key is configured. It is called sequentially,
with Unicode-safe chunks below its documented 500-byte UTF-8 limit, preserving
input ordering, duplicates, blank fields and boundary whitespace. HTML entities
are decoded as text. Unsupported-language responses and empty translations fail
explicitly. Sample `en|as` requests were verified, but translation accuracy and
availability are not guaranteed: review Assamese output before publishing.
MyMemory documents an anonymous allowance of 5,000 characters/day:
[API specifications](https://mymemory.translated.net/doc/spec.php) and
[usage limits](https://mymemory.translated.net/doc/usagelimits.php).
For sustained volume, increase the Google project's quota or evaluate another
provider with a documented Assamese service; the fallback is not unlimited.

The service serializes translation jobs, merges identical in-flight requests,
deduplicates strings within each job, and bounds the queue to 32 distinct jobs.
It does not retain completed translations. Cooldown and deduplication are local
to a Node process, appropriate to the supplied single-instance PM2 deployment;
multiple processes/hosts have independent limits. Large batches and queued jobs
may take longer than one upstream timeout. Upstream logs contain classifications,
status and known quota reasons, not keys, question content or raw fetch errors.
If both providers fail, the API returns a retryable 503 with a safe message and
the editor retains its existing values.

Build and test the authoritative source before deploying. Do not copy stale
source over newer production functionality or patch `dist` manually. No database
migration or Google key change is needed for this repair.

### AI answer verification

In **Admin > Questions**, edit a saved question and use **Verify answer with AI**.
Choose English or Assamese and, for date-sensitive questions, the intended **As of
date**. The selected language's current editor text (including unsaved edits),
options, selected answer and reference date are sent to OpenAI. Other translations
and question explanations are not verified.

Setup:

1. Create an OpenAI API account, enable API billing and create an API key. A ChatGPT
   subscription does not provide API credits. Do not paste the key into chat or
   put it in frontend configuration.
2. Set `OPENAI_API_KEY` in the server's private environment. Optionally set
   `OPENAI_VERIFICATION_MODEL` (default `gpt-5.5`) to a model available to your
   account that supports Responses API web search and structured outputs.
3. Restart the backend. Without a key, the editor shows a setup notice; all normal
   editing remains available.

Each verification makes two paid Responses API calls: live web research, then
structured assessment extraction. Requests use `store: false`; this does not
override the provider's own data-retention policies. Configure provider billing
alerts/budget controls. The server limits verification to 6 requests per admin per
15 minutes in each server process; this is not a global spending cap.

Reports contain a verdict, suggested option when justified, an explanation,
clickable sources, AI-generated evidence summaries, model and check timestamp.
Source URLs must occur in the provider's search sources or citations. A conclusive
verdict requires at least two distinct source hostnames and a consistent answer.
Different hostnames are not proof of editorial independence; the AI is instructed
to reject copied evidence and prioritize official/primary sources. Conflicting,
ambiguous or insufficient evidence should produce **Inconclusive**. Always review
the source pages yourself; evidence summaries are not verified quotations.

The latest successful report is persisted per question in `QuestionVerification`
with its exact input snapshot and admin ID. Loading a report does not call OpenAI.
Changes to checked text, options, selected answer, language or reference date mark
it stale and block applying its suggestion. A report remains historical evidence,
not a guarantee that time-sensitive facts are still current; recheck when needed.
**Use suggested answer** changes only the editor selection. Review explanations
and translations, then explicitly **Apply changes** to save. No verification
automatically changes or publishes a question.

Admin-only endpoints are `GET /api/admin/manage/questions/:id/verification` and
`POST /api/admin/manage/questions/:id/verification`. POST accepts `language`,
`questionText`, `options`, zero-based `correctOption` and optional `asOfDate`
(`YYYY-MM-DD`). Provider failures are reported explicitly and do not replace the
last successful report or change the answer.

## SEO and deployment

See [client/SEO.md](client/SEO.md) for the verified public-route inventory, SEO behavior, build checks, deployment steps, and rollback instructions.

### Homepage

The public homepage presents separate ADRE and Assam Police & Forest preparation
tracks, with live Test Series prices grouped by exam. Its sample question is an
illustrative preview, not a live practice session. Purchase ownership, sale
availability, and contact submissions use the existing services. The layout
adapts to mobile screens without requiring external fonts or hero-image downloads.

The `/adre` page follows the same visual style, with section navigation, five
post-specific paper-pattern selectors, syllabus cards, PYQ information, FAQs,
and the three ADRE Test Series. Paper-pattern figures remain reference content;
the redesign does not change test scoring, payment, or access rules.
