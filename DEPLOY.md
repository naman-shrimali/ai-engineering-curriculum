# Deployment

> Already deployed. This file is now the redeploy runbook + first-time setup reference.

**Status: live at [https://naman-shrimali.github.io/ai-engineering-curriculum/](https://naman-shrimali.github.io/ai-engineering-curriculum/)** — repo: [https://github.com/naman-shrimali/ai-engineering-curriculum](https://github.com/naman-shrimali/ai-engineering-curriculum), Pages serving from `main` / root.

Day-to-day you don't need any of this; just `./read.sh` locally, or open the live URL. The sections below cover redeploying, and the first-time setup for anyone forking this.

## Updating the live site

```bash
python3 tutor/build-index.py     # refresh written/pending state
git add -A && git commit -m "..." && git push
```

Pages rebuilds within a minute or two.

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
| `index.html` | Redirects the Pages root URL to `tutor/reader.html`. |
| `tutor/files.json` | Prebuilt file index: one request instead of ~100 HEAD probes. Regenerate with `python3 tutor/build-index.py` (also run automatically by `read.sh`). |

The reader resolves paths relative to the repo root (`new URL('../', location.href)`), so it works both at a subpath (`user.github.io/repo/`) and at a domain root. Verified against a simulated subpath deploy: 0 failed requests.

## After adding or editing chapters

```bash
python3 tutor/build-index.py    # refresh written/pending state
git add -A && git commit -m "..." && git push
```

Pages redeploys automatically within a minute. Skipping the index rebuild only means newly added chapters still show as "pending" in the sidebar — content itself stays correct.

## Local use is unchanged

```bash
./read.sh
```

No deploy needed for day-to-day reading.
