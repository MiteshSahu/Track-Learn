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
