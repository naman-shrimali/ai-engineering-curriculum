# Deployment

> Already deployed. This file is now the redeploy runbook + first-time setup reference.

**Status: live at [https://naman-shrimali.github.io/ai-engineering-curriculum/](https://naman-shrimali.github.io/ai-engineering-curriculum/)** — repo: [https://github.com/naman-shrimali/ai-engineering-curriculum](https://github.com/naman-shrimali/ai-engineering-curriculum), Pages serving from `main` / root.

Day-to-day you don't need any of this; just `./read.sh` locally, or open the live URL. The sections below cover redeploying, and the first-time setup for anyone forking this.

## Updating the live site

```bash
python3 scripts/build-content.py   # refresh app/data/content.json + tutor/files.json
python3 scripts/validate.py        # optional: same checks CI runs
git add -A && git commit -m "..." && git push
```

Pages rebuilds within a minute or two. There is no build step for the app itself: `index.html` + `app/` are plain ES modules and the runtime libraries are vendored in `app/vendor/` (rebuild with `scripts/vendor.sh` only when bumping versions).

### Enabling sign-in and cloud progress (optional)

The app runs in local-only mode until `app/config.js` carries a Firebase web config. Follow [docs/SETUP-GCP-AUTH.md](docs/SETUP-GCP-AUTH.md): create the Firebase (Google Cloud) project, enable the auth providers, add `naman-shrimali.github.io` and `localhost` as authorized domains, create Firestore, deploy `firestore.rules`, paste the config, push.

## First-time setup (for a fork or a fresh account)

### Path A — no extra tooling (create the repo in the browser)

1. Create a new **public**, empty repo at <https://github.com/new> — no README, no .gitignore, no license (the local repo already has everything). Name it e.g. `ai-engineering-curriculum`.
2. Push:

```bash
git remote add origin https://github.com/<your-username>/ai-engineering-curriculum.git
git branch -M main
git push -u origin main
```

3. Enable Pages: repo **Settings → Pages → Source: Deploy from a branch → Branch: `main`, folder: `/ (root)` → Save**.
4. Wait ~1 minute, then open `https://<your-username>.github.io/ai-engineering-curriculum/`.

### Path B — with the GitHub CLI

```bash
brew install gh
gh auth login
gh repo create ai-engineering-curriculum --public --source=. --remote=origin --push
gh api -X POST repos/:owner/ai-engineering-curriculum/pages \
  -f 'source[branch]=main' -f 'source[path]=/' 2>/dev/null \
  || echo "Enable Pages manually: Settings → Pages → main / root"
```

## Why it works on Pages (don't remove these)

| File | Purpose |
|---|---|
| `.nojekyll` | **Critical.** Without it Pages runs Jekyll, which converts `.md` files carrying YAML frontmatter into HTML — every chapter fetch would 404. |
| `index.html` | The interactive app (the classic reader remains at `tutor/reader.html`). |
| `app/data/content.json` | Prebuilt content index the app boots from (structure only; chapters are fetched live). Regenerate with `python3 scripts/build-content.py` (also run by `read.sh`); CI fails when it is stale. |
| `tutor/files.json` | File index for the classic reader; written by the same script. |

The reader resolves paths relative to the repo root (`new URL('../', location.href)`), so it works both at a subpath (`user.github.io/repo/`) and at a domain root. Verified against a simulated subpath deploy: 0 failed requests.

## After adding or editing chapters

```bash
python3 scripts/build-content.py   # refresh the content index
git add -A && git commit -m "..." && git push
```

Pages redeploys automatically within a minute. CI rejects a push whose index is stale, so the app's flashcards, questions and map never drift from the Markdown.

## Local use is unchanged

```bash
./read.sh
```

No deploy needed for day-to-day reading.
