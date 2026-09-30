# Track & Learn

Personal prep tracker with Supabase sync.

## One-time Supabase setup

1. Create a free project at https://supabase.com.
2. Open SQL Editor and run `supabase-schema.sql`.
3. Go to Project Settings -> API.
4. Copy the Project URL and anon public key into `supabase-config.js`.
5. Go to Authentication -> URL Configuration.
6. Add your GitHub Pages URL to Site URL and Redirect URLs.
7. Put the same URL in `supabase-config.js` as `redirectUrl`.

The anon key is allowed to be public. Your data is protected by Row Level Security, so each signed-in user can only read and update their own row.

## GitHub OAuth setup

1. In Supabase, go to Authentication -> Sign In / Providers -> GitHub.
2. Copy the Supabase callback URL. It looks like:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

3. Open GitHub -> Settings -> Developer settings -> OAuth Apps.
4. Click New OAuth App.
5. Use these values for local testing:

```text
Application name: Track & Learn
Homepage URL: http://localhost:3000/
Authorization callback URL: https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

6. Register the app, copy the Client ID, then generate and copy the Client Secret.
7. Paste both into Supabase -> Authentication -> Sign In / Providers -> GitHub.
8. Enable GitHub provider and save.

## GitHub Pages hosting

1. Create a GitHub repository.
2. Commit `index.html`, `supabase-config.js`, `supabase-schema.sql`, and `README.md`.
3. In GitHub, open Settings -> Pages.
4. Select Deploy from a branch, choose `main`, and use `/root`.
5. Update GitHub OAuth App Homepage URL to your GitHub Pages URL.
6. In Supabase Authentication -> URL Configuration, add the GitHub Pages URL to Site URL and Redirect URLs.
7. Update `redirectUrl` in `supabase-config.js` to the GitHub Pages URL.
8. Open the Pages URL and sign in with GitHub.

## Local use

For local Supabase login testing, run a static server from this folder:

```bash
python3 -m http.server 3000
```

Then open `http://localhost:3000/`. Supabase magic links need an HTTP redirect URL, so `file://.../index.html` is only useful for UI-only checks.

## Amazon SDE II interview preparation

Open **Amazon SDE II Preparation** in the existing tab bar. The module contains
DSA, HLD, LLD, Leadership / Bar Raiser, Projects, Mocks, and
Final Revision. The existing Amazon Top Questions and other trackers remain available.
The header’s **+ Create** button uses the existing modal style: add a DSA question to an existing or new category, or add an HLD/LLD topic, story, project, or mock. Links are optional; new items use the same completion and notes controls.
No npm build, framework, database table, or new storage technology is required.
Serve the repository as before; include `amazon-prep.js`, `amazon-prep-data.js`, and
`amazon-prep.css` when deploying the static site.

### Data and compatibility

State schema version 3 adds `amazonPrep` to the existing state JSON. It holds
preparation metadata, design/story/project/mock records, the 30-day calendar,
checklists, and any previously saved interview drafts. All changes use the existing `save()`
path: `track_learn_state_v1` localStorage and the current Supabase profile JSON.
The existing SQL schema needs no change.

Seeding is idempotent. Questions match existing records by LeetCode number, then
canonical name, then URL. Matching records are referenced, not deleted or replaced;
when both trackers have records, their original notes are accessible in the detail
view. The existing rich-text editor and note sanitization are reused. Named code
solutions and attempt snapshots extend those original note objects as `solutions`
and `attempts`, preserving `body`, `links`, and other existing fields. A new question
uses the same `amazonNotes` collection. Code saves are explicit; structured preparation
fields save on change. Question rows expand to notes and saved code. Existing history and preparation metadata remain stored but are not shown.

Legacy completion without an independence record imports as SOLVED_WITH_HELP;
revision counts import as REVISED_ONCE/TWICE without inventing dates. Existing richer
status, confidence, and date metadata is retained when available. Subsequent explicit
solves/revisions in the module also update legacy completion/revision records without
erasing history. The original global progress tree excludes this overlapping module
to avoid counting the same curriculum twice; its dedicated dashboard tracks readiness.

### Simple completion and notes

DSA, HLD, LLD, Leadership, Projects, and Mocks use the existing checkbox-and-expandable-row pattern. Click a title to open notes, then Save Note. DSA uses the same rich-text notes editor and Add link / Save Link controls as the existing tracker. Language and separate code controls are removed; previously saved code is available inside notes. Revisit is a per-question button. Overview, the planning Calendar, and Revision practice are no longer shown; the Daily Activity heatmap remains. Detailed forms, attempt history, and interview controls are not shown. Earlier answers and metadata remain stored; prior topic answers appear together in the notes editor until you save a new consolidated note.

The Amazon DSA summary reuses the existing Daily Activity heatmap and 30-day Solved Today graph. Both count completed questions by their saved completion dates, once per question even when it exists in both original trackers. Checking or unchecking a question updates the charts.

Progress is the percentage of items marked complete in each section. Overall weighting remains DSA 40%, HLD 20%, LLD 15%, Leadership 15%, projects 5%, mocks 5%. Checking DSA marks it solved without asserting independent solving or interview readiness. Unchecking removes completion; checking again restores a prior solved status where available. Notes and saved code are kept when toggling completion. Topic completion uses an explicit boolean without erasing earlier detailed fields.

The plan uses local calendar dates. October 5 belongs to Phase 1 (resuming after
vacation); October 3–4 suggest only light familiar revision. Simulation and final
revision favor previously solved questions. The bank retains the exact supplied
priorities: 57 MUST_DO, 32 IMPORTANT, 5 OPTIONAL; aim for about 20 of the IMPORTANT
questions. Company tags are the supplied labels, not independently verified claims.

### Validation

With Node installed:

```sh
node tests/check.cjs
```

Browser regression tests use Playwright and a locally installed Chrome, start an
isolated temporary localhost server, and never sign in or write to your live Supabase:

```sh
NODE_PATH=/path/to/node_modules node tests/amazon-prep.test.cjs
```

Set `PLAYWRIGHT_CHANNEL` if using another installed Playwright browser channel.
Tests cover seed counts, matching/idempotence, preserved notes, saved-code reload,
filters, code-only question details, preserved notes, design/story/
mock persistence, calendar carry-forward, mobile overflow, and existing tabs.
This repository has no configured bundler or lint tool; `tests/check.cjs` validates
all JavaScript syntax and seed invariants. Authenticated live sync still depends on
the existing Supabase configuration and account session.

The question bank also includes 20 additional pattern-grouped `GOOD_TO_DO` questions (114 seeded questions total). Select `GOOD_TO_DO` in the Priority filter to view them; existing priorities and saved progress remain unchanged.

## Recent Experience

The Recent Experience tab groups the user's supplied questions and topics: 12 tagged
DSA questions, 6 patterns, 5 HLD designs, 5 LLD designs, 6 leadership prompts, and 2
GenAI story slots. Existing matching questions/stories are tagged without resetting
progress; four new DSA questions bring the seeded bank to 118. New questions use
GOOD_TO_DO. These tags reflect the user's list, not independently verified interviews.

Practice in this tab hides patterns and previous notes, provides a plain-text solution
area (no IDE/autocomplete/execution), a configurable timer, and dry-run/follow-up
checks and notes. Drafts and timing use the existing saved state; story slots remain
empty until the user supplies real examples.
