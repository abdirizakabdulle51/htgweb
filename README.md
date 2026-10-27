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

## Deployment Convention

For normal code or UI changes, "push to GitHub" means commit the approved changes and push `main`. Pushing `main` triggers the Cloudflare Pages frontend deployment and the Render backend deployment.

If a change includes a new Prisma migration or any database schema change, do not push `main` until the production migration has been applied first. Run `npx prisma migrate deploy` with a one-command production `DATABASE_URL`, confirm it succeeds, then push `main`.

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

## Contact enquiries

The public `/contact` page sends enquiries through `POST /api/contact` to
`support@htgclouds.com`. The visitor's validated email is used as Reply-To;
the recipient and subject category are controlled by the server. Phone and
company are optional. Requests are validated, limited in size and rate, and
only report success after SMTP accepts the message. No database migration is needed.

Configure the existing `SMTP_USER`, `SMTP_PASS`, and other SMTP settings on
the backend. Without working SMTP the form returns an error, never a false
success. Restart the backend after pulling changes:
`pm2 restart htgweb-backend`. Frontend API selection uses the existing
`VITE_API_BASE_URL` configuration. Ensure it points to a backend running this endpoint.

Validation: `node --test server/contact.test.js server/contact-mailer.test.js`
(mail transport is mocked; tests do not send real email).

### Development verification codes

Real email is not connected yet. Verification codes are logged in the backend terminal:

```text
Verification code for user@example.com: 123456
```

During Render testing, you can fetch the latest unused verification code:

```text
https://htgweb.onrender.com/api/auth/dev-code?email=user@example.com
```

The verify email page can generate a new code through `POST /api/auth/resend-verification`.
