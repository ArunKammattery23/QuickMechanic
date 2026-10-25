# Where QuickMechanic runs

Last checked: 25 October 2026. No passwords are in this file; they live in
`backend/.env.production` (gitignored) and in each provider's dashboard.

## Live (production)

| Piece | Provider | Address | Plan / notes |
| --- | --- | --- | --- |
| Backend API (NestJS) | **Render** — Web Service `quickmechanic-api` (`srv-dbe0pst9fdbs738ul2e0`), workspace "My Workspace" | `https://quickmechanic-api.onrender.com` | Free. Docker build from `backend/Dockerfile`, which copies the **prebuilt `backend/dist`** — run `npm run build` and commit `dist` with backend changes. Auto-deploys on push to `main` of GitHub `ArunKammattery23/QuickMechanic`. Sleeps when idle; first request after a pause can take ~50 s. |
| PostgreSQL database | **Aiven** | host `quckmechanicdb-arunkammattery-3290.b.aivencloud.com`, port `25857`, database `defaultdb`, user `avnadmin` | TLS required (`DB_SSL=true`, CA in `backend/certs/aiven-ca.pem`, also set as `DB_CA_CERT` on Render). |
| Redis (Socket.IO live updates + cache) | **Layerbase** — database `quickmechanic-redis` (Redis 7.2), team "Arun K's team" | `rediss://…@quickmechanic-redis-ripe-dune.ovh2.cloud.layerbase.dev:6379` | Free. **Sleeps when idle and wakes on connect**, which drops open connections: expect short bursts of `Redis socket adapter (pub/sub) connection error` followed by `reconnecting` / `ready` in Render logs. Only a problem if `ready` never follows. |
| Google sign-in (OAuth clients) | **Google Cloud** project `quickmechanic-512711` ("QuickMechanic") | Web client `678034200026-gcg9n3qabbfratc18h1raab14rq1hndb.apps.googleusercontent.com` | Free. Details in `docs/GOOGLE_AUTH_SETUP.md`. The same Web client ID is `GOOGLE_WEB_CLIENT_ID` on Render. |
| Mobile apps | **Google Play Console** (account ARUN K, closed testing) | Customer `com.quickmechanic.mobile_app`, Provider `com.quickmechanic.provider_app`, Admin `com.quickmechanic.admin` | Built with `scripts/build-release-aabs.ps1`; the apps call `https://quickmechanic-api.onrender.com`. |

### Render environment variables (names only)

Set in Render → quickmechanic-api → Environment. They mirror `backend/.env.production`:
`NODE_ENV`, `PORT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL`, `DB_CA_CERT`,
`REDIS_URL`, `GOOGLE_WEB_CLIENT_ID`, plus the JWT and payment settings listed in `backend/.env.production.example`.

## Local (development)

`docker-compose.yml` at the repo root runs PostgreSQL (`db`) and Redis (`redis`, plus `redis_demo`) on this
computer. The backend reads `backend/.env.development`. Start Docker Desktop, then `docker compose up -d`.

## Retired — do not use

| What | Status |
| --- | --- |
| Google Cloud project `project-8d23d91b-6c41-4eea-8cf` (Cloud Run `quickmechanic-api-180157507652.us-central1.run.app`, Cloud SQL, old OAuth clients) | Shut down and scheduled for deletion (seen 25 Oct 2026). `scripts/deploy.bat`, `backend/cloudbuild.yaml` and the cloud cost scripts still point at it and no longer work. |
