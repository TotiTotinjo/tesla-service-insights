# Contributing

Thanks for helping improve Tesla Service Insights.

## Local setup

1. Fork and clone the repo  
2. `npm install`  
3. Copy `.env.example` → `.env.local` and add your own `XAI_API_KEY`  
4. `npm run dev`  

## Guidelines

- Never commit `.env.local`, API keys, or real invoices  
- Prefer privacy: redact PII before any model call  
- Keep Grok usage cheap: compact prompts, dedupe, rate limits  
- Open a PR with a clear description of the change  

## Code of conduct

Be respectful. This project is not affiliated with Tesla, Inc.
