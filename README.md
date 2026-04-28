# MindPulse Admin Portal (web)

Vite + React analyzer for MindPulse pilot sessions (Firebase RTDB + local export fallback).

## Build

```bash
npm ci
npm run build
```

## Netlify

Connect this repository with **base directory** left empty (root). Build command `npm run build`, publish directory `dist`. No environment variables required; config is in `src/config/appDeployConfig.ts`.

> **Note:** The GitHub repository may still be named `MindPulseDAQ` for historical reasons; this tree is **only** the web admin app (the Android DAQ app is not maintained here).
