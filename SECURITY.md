# Security

## Report issues

If you find a vulnerability, please open a private report or contact the maintainer — do not post exploit details publicly until fixed.

## Public beta posture

- **No original PDFs stored** — processed in memory, discarded after analysis.
- **PII redaction** before/after model extraction; user confirms drafts before publish.
- **xAI Grok** receives redacted technical text only (not raw file retention).
- **Rate limits** cap Grok spend (per-IP and global daily).
- **API keys** must never be committed; use platform secrets only.

## What we do not claim

- Perfect redaction (always review before publish).
- Durable multi-region storage (Workers memory store is early-beta).
- Enterprise compliance certifications.

## Operator checklist

1. Store `XAI_API_KEY` only as a Cloudflare Worker secret.
2. Rotate keys if they ever appear in chat, logs, or git.
3. Keep beta rate limits enabled in production.
4. Set xAI billing alerts in the console.
