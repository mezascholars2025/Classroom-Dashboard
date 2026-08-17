# Meza Scholars — Classroom Dashboard

Connects to your own Google Classroom and shows, per class, which students have
turned in each assignment. Two views:

- **Full grid** — every student x every assignment (Turned in / Late / Missing)
- **Needs follow-up** — only students with missing work, sorted by who's furthest behind

Your Google credentials are already filled in. Nothing to configure.

---

## Option A — Run it on your Mac

**One-time setup: install Node.js**

1. Go to https://nodejs.org and download the **LTS** version.
2. Open the downloaded `.pkg` and click through the installer.
3. **Close any open Terminal windows** and open a fresh one — this matters, the old
   window won't know Node was installed.

**Then, every time you want to use it**

1. Open a Terminal in this folder (right-click the folder in Finder ->
   "New Terminal at Folder").
2. Run `npm install` — only needed the first time. Takes about a minute.
3. Run `npm run dev`
4. Open **http://localhost:3000** in your browser.
5. Click **Connect Google Classroom** and sign in with the account that owns your
   Classroom (the one you added as a Test User in Google Cloud Console).

Leave the Terminal window open while you're using it. Press `Ctrl+C` to stop.

---

## Option B — Put it online, no Terminal ever (recommended)

This gets you a real URL you can open from your phone, with no Node install and no
Terminal. Roughly 15 minutes, one time.

1. **Put the code on GitHub.** Go to github.com -> New repository -> name it
   `classroom-dashboard`, set it to **Private**, create it. On the next screen click
   "uploading an existing file" and drag in every file from this folder **except**
   `node_modules`, `.next`, and `.env.local`. (Never upload `.env.local` — it has
   your secret in it.)

2. **Connect Vercel.** Go to vercel.com, sign in with GitHub, click **Add New ->
   Project**, and import the repo you just made.

3. **Add your credentials as environment variables.** Before clicking Deploy, expand
   "Environment Variables" and add these two:

   | Name | Value |
   |---|---|
   | `GOOGLE_CLIENT_ID` | (copy from your local `.env.local` file) |
   | `GOOGLE_CLIENT_SECRET` | (copy from your local `.env.local` file) |

   Both values live in the `.env.local` file on your computer. That file is
   deliberately kept out of this repo — never paste these values into any file
   you commit to GitHub.

4. **Deploy.** Vercel gives you a URL like `https://classroom-dashboard-xyz.vercel.app`.

5. **Tell Google about that URL.** Back in Google Cloud Console -> Credentials ->
   click your OAuth client -> under **Authorized redirect URIs** click "+ Add URI"
   and paste your Vercel URL with `/api/auth/callback/google` on the end. For example:
   `https://classroom-dashboard-xyz.vercel.app/api/auth/callback/google`
   Save. (Keep the localhost one too — both can coexist.)

6. Open your Vercel URL, click Connect, done.

**Make it feel like an app:** open the URL in Safari on your iPhone, tap the Share
button, then "Add to Home Screen." It gets an icon and opens fullscreen, no browser bar.

---

## Troubleshooting

**"Access blocked: app has not completed verification"**
Your Google account isn't listed as a Test User. Google Cloud Console -> APIs &
Services -> OAuth consent screen -> Test users -> Add your email.

**"Couldn't load your classes" / 403**
Usually means the Classroom API isn't enabled. Google Cloud Console -> APIs &
Services -> Library -> search "Google Classroom API" -> Enable.

**"redirect_uri_mismatch"**
The URL you're using isn't registered. Add the exact URL (including
`/api/auth/callback/google`) under Authorized redirect URIs in Google Cloud Console.

**No classes showing up**
The dashboard only lists **active** classes where you are the **teacher**. Archived
classes and classes you're only a student in won't appear.

**Assignments missing from the grid**
Only **published** coursework appears. Drafts are hidden.

---

## Security notes

- `.env.local` holds your client secret. It's excluded from git via `.gitignore` —
  keep it that way. If it ever leaks, regenerate the secret in Google Cloud Console
  (Credentials -> your OAuth client -> Reset Secret) and update it here and in Vercel.
- The app requests **read-only** Classroom scopes. It cannot change grades, post
  assignments, or modify anything in your Classroom.
- To revoke access at any time: https://myaccount.google.com/permissions

---

## Adding parents later

Right now only accounts listed as Test Users in Google Cloud Console can sign in
(up to 100). If you want parents to log in and see only their own child, that's a
follow-on build — the data layer here already separates per-student status, so it's
an extension rather than a rewrite.
