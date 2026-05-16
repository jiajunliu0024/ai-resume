# How to obtain API keys (Resume Tailor providers)

Resume Tailor calls the provider **directly from your browser** using the key you paste in **Settings**. Keys are saved only in Chrome extension storage on your device—not on project servers.

**Important:** Free tiers, signup bonuses, rate limits, and pricing **change often**. Treat the **“Free-ish”** column as orientation only; confirm on each provider’s site before relying on free usage.

| In-app provider | Typical first step | Get / manage API keys | Rough “free-ish” notes (verify on site) |
|-----------------|--------------------|-----------------------|----------------------------------------|
| **OpenAI** | Create an OpenAI account | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | API usage is generally **paid** (billing + usage limits). New accounts occasionally receive **limited starter credits**; not guaranteed. |
| **Google Gemini (OpenAI-compat)** | Sign in with Google | [Google AI Studio → API key](https://aistudio.google.com/apikey) | **Free tier quotas** exist for Gemini API usage in AI Studio; caps and regions change—check Google’s current terms. Keys work with the **OpenAI-compatible** endpoint this extension uses. |
| **Groq** | Sign up at Groq | [console.groq.com/keys](https://console.groq.com/keys) | Often used for **fast, low-cost demos** with **generous developer limits**; still subject to rate limits / policy updates. Good first **try-for-free API** candidate. |
| **Mistral AI** | Create a Mistral account | [console.mistral.ai](https://console.mistral.ai/) → API keys | May offer **trial / limited free credits** for new workspaces; ongoing API use is usually **metered**. |
| **DeepSeek** | Sign up / log in | [platform.deepseek.com](https://platform.deepseek.com/) (API keys in console) | **Very cheap** pricing; explicit long-term **free unlimited** API tier is uncommon—check live pricing and promotions. |
| **xAI (Grok)** | xAI developer account | [console.x.ai](https://console.x.ai/) → API keys | API access is largely **commercial / usage-based**; do not assume a permanent free tier. |
| **Together AI** | Together account | [api.together.xyz](https://api.together.xyz/) → account / API keys | Sometimes **trial credits**; sustained use usually **paid** by tokens. |
| **OpenRouter** | OpenRouter account | [openrouter.ai/keys](https://openrouter.ai/keys) | Routes to **many models** behind **one key**; billing is mostly **pay-as-you-go**. Some routed models advertise **\$0 price**—availability changes; you still follow OpenRouter/account rules. |

## How keys are used in this extension

1. Pick the **same provider** in Settings that issued the key.
2. Paste the **secret API key** (often starts with prefixes like `sk-…` depending on vendor—follow their docs).
3. Use **Scan / Resume / Tailor / Cover letter** as usual—the extension sends prompts and document snippets **only** to that provider’s HTTPS API declared in [`public/manifest.json`](../public/manifest.json).

## Defaults vs your account

Built-in defaults (for example **`gpt-4o-mini`** on OpenAI, **`gemini-2.0-flash`** on Gemini) **must exist and be permitted** on your API plan. If a model returns 404 or billing errors, open that provider’s model list and either enable the model for your account or change the extension’s default model in source (`openAiJobInsightsExtractor.ts`) and rebuild.

## Security hygiene

- Do **not** commit keys to Git or share screenshots of Settings.
- **Rotate** keys if they leak or if employees leave shared machines.
- For **Gemini**, use AI Studio keys as documented by Google for the Gemini API—not OAuth client secrets from unrelated Google Cloud setups unless you knowingly configured that stack.
