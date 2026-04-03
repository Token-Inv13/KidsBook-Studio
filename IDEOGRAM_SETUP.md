# Ideogram V3 Setup

KidsBook Studio stores API keys in the OS keychain through Electron.

## Required keys

- OpenAI API key: used for story generation, scene analysis, and fallback image generation.
- Ideogram API key: used for the primary illustration pipeline.

## Where to enter them

Open the app, go to `Settings`, and paste the keys in the API key fields.

## Storage

- OpenAI key: stored under the `KidsBookStudio` keychain entry for `OpenAI_API_Key`
- Ideogram key: stored under the `KidsBookStudio` keychain entry for `Ideogram_API_Key`

## Provider order

- Primary image provider: Ideogram when its service is available
- Fallback image provider: OpenAI

## Runtime behavior

- React never receives the raw API keys
- Electron main starts local proxy services for both providers
- The illustration pipeline automatically selects the primary provider and falls back if needed
