# Track-a-Bite 🥗⚡

Track-a-Bite is an AI-powered visual food tracking, nutritional analysis, and longitudinal wellness platform tailored for students, campus residents, and busy individuals. It pairs multimodal vision models with local fallback resilience and real-time cloud synchronization over Firebase.

---

## 1. Architecture Overview

Track-a-Bite is architected with a **Dual-Layer Persistence & Offline-First Model**:

```
 ┌────────────────────────────────────────────────────────┐
 │                    User Interface                      │
 │     Next.js 16 (App Router) + React 19 + TailwindCSS   │
 └───────────────────────────┬────────────────────────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
 ┌───────────────────────────┐   ┌────────────────────────────┐
 │  Local Persistence Layer  │   │  Authoritative Cloud Layer │
 │ (localStorage + Envelopes)│   │   (Cloud Firestore + Auth) │
 └─────────────┬─────────────┘   └─────────────┬──────────────┘
               │                               │
               └───────────────┬───────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
   ┌──────────────────────────┐  ┌────────────────────────────┐
   │    Analytics Engine      │  │    Server-Side Vision API  │
   │  (Macros, Micros, Water, │  │   (/api/recognize-food)    │
   │   Mifflin-St Jeor Goals) │  │   Gemini Vision Pipeline   │
   └──────────────────────────┘  └────────────────────────────┘
```

- **Client Layer**: Next.js App Router, React 19 with `useSyncExternalStore` for flicker-free reactive synchronization with local caches.
- **Server API Layer**: Next.js Route Handlers (`/api/recognize-food`) providing rate limiting, payload sanitization, base64 size bounding, and server-side secret isolation.
- **Authoritative Database**: Google Cloud Firestore with granular user-scoped security rules (`users/{userId}/*`).
- **Offline Fallback**: Resilient local-first store envelopes that retain user history, hydration, and profile when disconnected or unauthenticated.

---

## 2. Tech Stack

- **Core Framework**: [Next.js 16.3](https://nextjs.org/) (Turbopack, App Router)
- **UI & State**: [React 19.2](https://react.dev/), TypeScript 5, TailwindCSS 4
- **Backend & Auth**: [Firebase Web SDK 12.19](https://firebase.google.com/) (Modular SDK: Authentication, Cloud Firestore)
- **Multimodal AI**: Google Gemini 2.5 Flash (`@google/genai` vision pipeline with JSON schemas)
- **Code Quality**: ESLint 9, TypeScript Strict Mode

---

## 3. Firebase Setup

1. Create a Firebase project at the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Email/Password** under **Authentication > Sign-in method**.
3. Create a **Cloud Firestore** database (Production Mode recommended).
4. Configure your web application in the Firebase Console to obtain your client configuration keys.
5. Deploy Firestore Security Rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

---

## 4. Authentication Architecture

- **Authoritative Identity**: The Firebase Auth UID is strictly authoritative.
- **No Spoofing**: Services reject missing or mismatched user identifiers. The application never accepts user IDs from URLs, query parameters, or form fields for data fetching.
- **Session Lifecycle**: Handled via `onAuthStateChanged`.
- **Account Isolation on Logout**: Triggering `logout()` immediately purges active snapshot listeners, migration locks, and local storage caches (`profile`, `hydration`, `meals`) to prevent data leakage on shared computers. Persistent cloud records remain untouched.

---

## 5. Firestore Structure

Data is partitioned hierarchically under root `users` documents, ensuring strict tenant isolation:

```
users/{userId}
  ├── [Document: UserProfile]
  │     ├── age, gender, height, weight, activityLevel
  │     ├── dietaryRestrictions, allergies, healthGoals
  │     ├── targetCalories, targetProteinG (Custom / MSJ targets)
  │     └── updatedAt, createdAt
  │
  ├── meals/{mealId}
  │     ├── id, mealName, mealType, analyzedAt
  │     ├── items: [ { name, portionMultiplier, nutrition, micronutrients } ]
  │     ├── totalCalories, totalProtein, totalCarbs, totalFat
  │     └── createdAt, updatedAt
  │
  └── hydration/{entryId}
        ├── id, amountMl, date (YYYY-MM-DD)
        └── timestamp, createdAt
```

---

## 6. Security Rules

Rules located in `firestore.rules` enforce that only authenticated users can read or write their own documents:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /meals/{mealId} {
        allow read, write, delete: if request.auth != null && request.auth.uid == userId;
      }

      match /hydration/{entryId} {
        allow read, write, delete: if request.auth != null && request.auth.uid == userId;
      }
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

*Verified with a 26-test live security matrix (`scripts/test-phase9-firestore-security.ts`) covering cross-user access, unauthenticated attempts, and wildcard privilege escalation.*

---

## 7. Gemini Vision Architecture

- **Server-Only Execution**: Multimodal AI requests run strictly within `/api/recognize-food`.
- **Zero Client Exposure**: `GEMINI_API_KEY` is loaded server-side only via `process.env.GEMINI_API_KEY`.
- **Sliding-Window Rate Limiting**: Maximum 30 requests/minute per client IP to safeguard quota and prevent abuse.
- **Payload Bounds**: Max 14MB base64 string constraint (~10MB raw image).
- **Structured Schema**: Output is validated against a deterministic JSON schema and sanitized to prevent prompt injections.

---

## 8. Environment Variables

Create `.env.local` in the project root:

```ini
# Client Configuration (Safe for browser bundles)
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSy..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-app.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-app.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="1234567890"
NEXT_PUBLIC_FIREBASE_APP_ID="1:1234567890:web:abcdef"

# Server-Only Configuration (NEVER prefix with NEXT_PUBLIC_)
GEMINI_API_KEY="AIzaSy..."
```

---

## 9. Local Development

Install dependencies and start the Turbopack development server:

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the application.

---

## 10. Testing Suite

The repository contains automated verification scripts under `scripts/`:

```bash
# Run unit & data validation suite
npx tsx scripts/test-phase9-final-verification.ts

# Run live Firestore security regression suite
npx tsx scripts/test-phase9-firestore-security.ts

# Run route smoke test
npx tsx scripts/test-phase9-routes.ts

# Run linter
npm run lint
```

---

## 11. Production Deployment

1. **Verify Builds & Linter**:
   ```bash
   npm run lint
   npm run build
   ```
2. **Deploy to Vercel**:
   - Push repository to GitHub/GitLab.
   - Import the project into [Vercel](https://vercel.com).
   - Configure the environment variables (`NEXT_PUBLIC_FIREBASE_*` and server-only `GEMINI_API_KEY`).
   - Deployment runs standard `npm run build`.

---

## 12. Offline Behavior & Resilience

- **Instant Local Logging**: Meals and hydration logged when disconnected are saved immediately into browser storage envelopes.
- **Background Sync**: Upon authentication or network restoration, uncommitted meals are synced to Firestore without loss.
- **Bounded Fallbacks**: If Cloud Firestore encounters permission or network issues, services automatically fall back to local cached snapshots without throwing uncaught exceptions.

---

## 13. Data Model

- **Biometric Profiles**: Validates age (1-120), height (50-280 cm), weight (20-400 kg), activity level, dietary restrictions, and allergies.
- **Target Calculations**: Utilizes Mifflin-St Jeor BMR formula with physical activity multipliers; supports custom macronutrient and hydration targets.
- **Micronutrients Tracked**: Iron (mg), Calcium (mg), Potassium (mg), Folate (mcg), Sodium (mg), Vitamin A (mcg), Vitamin C (mg), Vitamin B12 (mcg).
- **Non-Diagnostic Policy**: Dietary guidance uses lifestyle phrasing ("reference intake", "consider adding") and avoids clinical diagnostic claims ("deficient", "cure").

---

## 14. Known Limitations

- **Image Capture Quality**: Low-lighting or severely out-of-focus camera captures may require manual portion adjustments.
- **Compound Hostel Dishes**: Complex mixed curries may have estimated calorie variances of ±15-20% relative to standard home recipes.
- **IndexedDB**: Large historical meal datasets (>1,000 meals) currently page through memory via Firestore pagination cursors; local storage caches are capped at the latest 50 entries to avoid quota exhaustion.

---

## 15. Security Model Summary

| Vector | Protection Mechanism |
|---|---|
| **API Keys** | `GEMINI_API_KEY` is server-only; excluded from Next.js client bundles. |
| **API Abuse** | In-memory sliding-window rate limiter (30 req/min/IP) on `/api/recognize-food`. |
| **Cross-User Data** | Enforced by Firestore Security Rules using `request.auth.uid == userId`. |
| **Client Spoofing** | UIDs sourced strictly from Firebase Auth token; parameters ignored. |
| **Data Residue** | `logout()` purges all local storage caches and snapshot subscriptions. |
| **Data Validation** | Strict schema validation on profile, meal, and hydration inputs prior to persistence. |

---

## License

MIT License. Designed and engineered for Track-a-Bite.
