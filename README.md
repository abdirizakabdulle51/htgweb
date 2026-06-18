# HTGClouds

HTGClouds is currently running as a Vite React app. The UI is unchanged, and authentication is handled through `src/lib/auth.ts` so the app can keep running while the PostgreSQL backend is developed separately.

## Run The App

```bash
npm install
npm run dev
```

The Vite dev server opens on `http://127.0.0.1:5173` by default.

## Current Auth Behavior

The frontend auth service first tries normal `/api/...` fetch calls for future backend integration. If those endpoints are not available, it falls back to temporary local mock auth so the app still works.

Demo credentials:

```text
demo@htgclouds.com
password123
```

During mock sign up, any 6-digit verification code is accepted.

## Backend Notes

The PostgreSQL/Prisma work is kept separate from the Vite runtime for now. Keep framework-specific server auth libraries out of the Vite client.
