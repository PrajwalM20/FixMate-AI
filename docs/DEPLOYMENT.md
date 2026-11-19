# FixMate AI — Deployment & Operations Guide

This guide documents how to build, verify, containerize, and deploy **FixMate AI** to Google Cloud Run (or any Node.js container runtime) alongside **Firebase Firestore**, **Firebase Authentication**, and **Firebase Storage**.

---

## 1. Pre-Deployment Checklist

1. **Dependencies & Type Safety**
   ```bash
   npm install
   npm run lint
   ```
2. **Production Bundle Build**
   ```bash
   npm run build
   ```
   Verify `dist/index.html` and hashed assets are generated cleanly.
3. **Automated QA Tests**
   ```bash
   node --test tests/aiPipeline.test.ts tests/marketplace.test.ts
   ```
4. **Firestore Security Rules Audit & Deployment**
   ```bash
   npx eslint firestore.rules
   ```
   Ensure `firestore.rules` is deployed to your Firebase project (`gen-lang-client-0173928992`) via AI Studio `DeployRules` or `firebase deploy --only firestore:rules`.
5. **Firebase Authentication Providers**
   - Confirm **Google** sign-in and **Email/Password** sign-in are enabled in Firebase Console -> Authentication -> Sign-in method.
   - Add your production Cloud Run domain to Firebase Console -> Authentication -> Settings -> Authorized domains.
6. **Secret Verification**
   - `GEMINI_API_KEY` must ONLY be injected as a server runtime secret (Cloud Run secret/env var). Never prefix it with `VITE_`.
   - Confirm zero references to `GEMINI_API_KEY` or `@google/genai` exist inside `src/`.

---

## 2. Container Build (`Dockerfile`)

FixMate AI serves both the `/api/*` Express backend and the compiled Vite SPA (`dist/`) from a single Node.js process listening on `process.env.PORT || 3000`.

```bash
# Build container locally
docker build -t fixmate-ai:latest .

# Test container locally with server-side Gemini secret
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e GEMINI_API_KEY="YOUR_SERVER_GEMINI_KEY" \
  fixmate-ai:latest
```

Verify health inside the running container:
```bash
curl -s http://localhost:3000/api/health
```

---

## 3. Deploying to Google Cloud Run

```bash
# Authenticate and set project
gcloud config set project gen-lang-client-0173928992

# Build & deploy from source using Dockerfile
gcloud run deploy fixmate-ai \
  --source . \
  --region asia-east1 \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --set-env-vars NODE_ENV=production \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```

---

## 4. Post-Deployment Verification Steps

1. `GET /api/health` returns `{ "status": "ok", "phase": "Phase 3" }`.
2. `GET /api/ai/architecture` reports `serverKeyPresent: true` when `GEMINI_API_KEY` is configured.
3. Unauthenticated `POST /api/ai/diagnose` returns `401`.
4. Unauthenticated `POST /api/bookings/validate` returns `401`.
5. Public `POST /api/technicians/recommend` ranks verified profiles deterministically.
6. Sign in with the bootstrapped admin account (`prajwalm1122@gmail.com`) -> Admin Console -> click **Seed Sample KB & Categories** to populate Firestore categories and knowledge entries if starting from an empty database.
7. Register a test customer and a test technician (with different emails), verify emails, approve the technician in the Admin Console, run an AI diagnosis, book an appointment, submit an itemized quotation, accept it, complete the repair, and post a verified review.
