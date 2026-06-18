# HTGClouds

HTGClouds is a Vite React frontend with a separate Express authentication backend.

## Environment

Copy `.env.example` to `.env` and set local values:

```env
DATABASE_URL="postgresql://postgres:replace-with-database-password@localhost:5432/htgclouds"
JWT_SECRET="replace-with-secure-random-secret"
CLIENT_URL="http://localhost:5173"
SERVER_PORT=4000
VITE_API_BASE_URL="http://localhost:4000"
```

If your PostgreSQL password contains `@`, Prisma may require it to be URL encoded in `.env`.

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

The Vite app runs on `http://127.0.0.1:5173`.
The Express auth server runs on `http://localhost:4000`.

## Development Email Verification

Real email is not connected yet. Verification codes are logged in the backend terminal:

```text
Verification code for user@example.com: 123456
```
