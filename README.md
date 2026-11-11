# GK Practice Portal

A MEAN-stack examination platform starter for competitive practice tests with OTP-based authentication, question attempts, scoring, and dashboard analytics.

## Project structure

- client/ — Angular frontend application
- server/ — Express + TypeScript backend application

## Quick start

### Backend

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

### Frontend

```bash
cd client
npm install
npm run start
```

## Environment

Configure environment files before running the applications. See `.env.example` files in both client and server folders.

## Included modules

- Phone-number login with OTP verification
- JWT access token + refresh token flow
- Dashboard stats and recent attempts
- GK question practice flow with persistence and scoring
- MongoDB Mongoose models and seed script
- Basic automated backend tests

## Notes

This project is a secure, maintainable foundation intended for extension into a full production portal.

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
