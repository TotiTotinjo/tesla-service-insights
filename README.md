# Tesla Service Insights

**Privacy-first, open-source community knowledge base for redacted Tesla service invoices.**

Owners upload PDF repair orders. The app:

1. Merges multi-PDF packages if needed  
2. Extracts text **in memory** (originals never stored)  
3. Redacts PII  
4. Uses **Grok (xAI)** to split multi-visit invoices into separate issues  
5. Lets the uploader **review before publish**  
6. Groups the same issue across owners (“N owners have this” · Fixed / No fix yet)  
7. Unlocks **Service Bulletin votes** only after **more than 1,000** owners report an issue  

> **Not affiliated with Tesla, Inc.**

## Early beta cost limits

To keep Grok API spend predictable:

| Cap | Default |
|-----|---------|
| Analyses per IP / day (UTC) | **2** |
| Analyses global / day (UTC) | **25** |
| Publishes per IP / day | **3** |

Re-uploading the **same PDF** is free (dedupe, no Grok).  
Configure via env vars in `.env.example`. See [SECURITY.md](./SECURITY.md).

## Stack

- Next.js (App Router) + TypeScript + Tailwind  
- Grok via OpenAI-compatible API (`https://api.x.ai/v1`)  
- Local JSON store under `data/` (redacted insights only)  
- `pdf-lib` merge · `pdf-parse` text · regex PII redaction  

## Setup

```bash
git clone https://github.com/<your-username>/tesla-service-insights.git
cd tesla-service-insights
npm install
cp .env.example .env.local   # or copy on Windows
# edit .env.local → set XAI_API_KEY from https://console.x.ai
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local development |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
| `npm run deploy` | Deploy to Cloudflare Workers (OpenNext) — see below |

## Product flow

| Step | What happens |
|------|----------------|
| Upload | **PDF only** (max 12 MB each, 10 files / 40 MB total) |
| Merge | 2+ PDFs merged in list order via `pdf-lib` (in memory) |
| Dedupe | SHA-256 of PDF + text — **skips Grok** on re-upload |
| Extract | One Grok call → **multiple issues** from multi-visit PDFs |
| Review | Edit / drop / merge drafts, then publish |
| Insights | Grouped by issue · owner counts · fix status |
| Bulletin | Votes unlock after **>1,000** owners |

## Privacy

- Original PDFs processed in RAM only — **never written to disk**  
- Redact names, phones, emails, VINs, addresses, RO/invoice IDs, payment data  
- Store only redacted technical notes + aggregate hashes  
- See `/privacy` in the app  

## Live beta

- **App:** https://roinsights.org (also `www.roinsights.org`)  
- **Workers URL:** https://tesla-service-insights.4kfr7tyzsh.workers.dev  
- **Source:** https://github.com/TotiTotinjo/tesla-service-insights  

## Deploy (Cloudflare Workers via OpenNext)

Requires [Wrangler](https://developers.cloudflare.com/workers/wrangler/) login and an xAI API key as a Worker secret.

```bash
npm install
npx wrangler login
# set secret (interactive — do not put the key in git)
npx wrangler secret put XAI_API_KEY
npm run deploy
```

**Windows note:** OpenNext needs symlink support. Enable **Developer Mode** in Windows Settings, or deploy via GitHub Actions (Ubuntu).

**Note:** The default file-based `data/` store is fine for a single long-lived Node host. On Cloudflare Workers the filesystem is ephemeral — for a durable beta you should later move insights/rate-limits to **D1** or **KV**. Rate limits still apply when the store is available.

Optional Worker vars (set in `wrangler.jsonc` or dashboard):

```
BETA_MAX_ANALYZES_PER_IP_PER_DAY=3
BETA_MAX_ANALYZES_GLOBAL_PER_DAY=40
XAI_EXTRACT_MODEL=grok-4-1-fast-non-reasoning
```

### GitHub Actions deploy

1. Create a Cloudflare API token (Workers Edit)  
2. Add repo secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`  
3. Push to `main` — workflow runs `npm run deploy`  

## License

MIT — see [LICENSE](./LICENSE).

## Disclaimer

Community notes may be incomplete or wrong. Not official Tesla service documentation. Always follow official procedures and applicable law when handling customer data.
