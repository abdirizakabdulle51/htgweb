# HTGClouds

HTGClouds is a Vite React frontend with a separate Express authentication backend.

## Environment

Copy `.env.example` to `.env` and set local values:

```env
DATABASE_URL="postgresql://postgres:replace-with-database-password@localhost:5432/htgclouds"
JWT_SECRET="replace-with-secure-random-secret"
CLIENT_URL="http://localhost:5180"
SERVER_PORT=4001
VITE_API_BASE_URL="http://localhost:4001"
```

If your PostgreSQL password contains `@`, Prisma may require it to be URL encoded in `.env`.
For production frontend builds, set `VITE_API_BASE_URL="https://htgweb.onrender.com"` or leave it unset to use that Render URL automatically.

## Cloudflare Pages

Set the Cloudflare Pages environment variable:

```env
VITE_API_BASE_URL="https://htgweb.onrender.com"
```

The frontend auth client falls back to the Render backend in production if the variable is unset or accidentally points to localhost. Local development continues to use `http://localhost:4001`.

## Render Backend

Set these Render environment variables:

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="replace-with-secure-random-secret"
CLIENT_URL="https://htgweb.abdirizak-abdulle.workers.dev"
NODE_ENV=production
```

In production, the auth cookie is `httpOnly`, `secure`, `sameSite: "none"`, and scoped to `/` so the Cloudflare frontend can use the Render API with credentials.

## Install

```bash
npm install
npx prisma generate
npx prisma migrate deploy
```

## Run

Frontend only:

```bash
npm run dev
```

Backend only:

```bash
npm run server
```

Frontend and backend together:

```bash
npm run dev:all
```

The Vite app runs on `http://localhost:5180`.
The Express auth server runs on `http://localhost:4001`.

## Development Email Verification

Real email is not connected yet. Verification codes are logged in the backend terminal:

```text
Verification code for user@example.com: 123456
```

During Render testing, you can fetch the latest unused verification code:

```text
https://htgweb.onrender.com/api/auth/dev-code?email=user@example.com
```

The verify email page can generate a new code through `POST /api/auth/resend-verification`.
