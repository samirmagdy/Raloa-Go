# AI Crawler Access Report: RALOA

**Analysis Date:** 2026-09-24  
**Domain:** raloa.app  
**robots.txt Status:** Present in local production server and public assets

## Crawler Access Summary

| Crawler | Status | Impact |
|---|---|---|
| GPTBot | Allowed | ChatGPT discovery/search access |
| OAI-SearchBot | Allowed | ChatGPT search access |
| ChatGPT-User | Allowed | User-requested page access |
| ClaudeBot | Allowed | Claude discovery/search access |
| PerplexityBot | Allowed | Perplexity citations |
| Google-Extended | Allowed | Google AI ecosystem access |
| Googlebot | Allowed | Google Search and AI Overviews |
| Bingbot | Allowed | Bing/Copilot discovery |
| Applebot-Extended | Allowed | Apple Intelligence ecosystem |
| Amazonbot | Allowed | Alexa/Amazon AI discovery |
| FacebookBot | Allowed | Meta AI discovery |
| CCBot | Not mentioned | Inherits wildcard policy; no blanket block |
| anthropic-ai | Not mentioned | Inherits wildcard policy |
| Bytespider | Blocked | Aggressive/low-priority training crawler |
| cohere-ai | Not mentioned | Inherits wildcard policy |

## AI Visibility Score: 92/100

Tier 1 access: 5/5 allowed. Tier 2 access: 5/5 allowed. No blanket AI block. `llms.txt` and sitemap are accessible.

## Additional Findings

- Meta robots: `index, follow` is present on the base document.
- X-Robots-Tag: none detected in local responses.
- JavaScript rendering: application UI remains client-rendered, but meaningful raw fallback content is now present.
- `llms.txt`: present and valid at `/llms.txt`.
- Sitemap: present and referenced from robots.txt.
- Content Signals: `ai-train=yes, search=yes, ai-retrieval=yes` declares the intended access policy.

## Recommendation

Recheck crawler behavior after Cloudflare is enabled; ensure the edge layer does not replace or override these directives.
