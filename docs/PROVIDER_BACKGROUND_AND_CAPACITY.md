# Provider online mode, concurrency and badges

Android online mode starts a location foreground service while the app is visible, after location and notification permission. It sends fresh GPS at most once every 15 seconds, reconnects its authenticated socket, and posts job alerts. Offline/logout stops the timer and socket. A changed or expired token also stops the worker. Boot auto-start is disabled. Returning to the dashboard retrieves up to 20 recent persisted requests, so a missed socket notification does not lose the request. Only one incoming request dialog is shown at a time.

Providers without a location update for 90 seconds are excluded from discovery. Reopen the app and go online again after service termination. Force-stop, revoked permissions, disabled GPS and manufacturer battery restrictions can interrupt service. Test screen lock, backgrounding, reconnect, logout and permission revocation on a physical Android device before release. iOS continuous background jobs/push delivery is not implemented by this Android foreground service.

Reference: [Android foreground location service requirements](https://developer.android.com/develop/background-work/services/fgs/launch).

## Concurrent work

PostgreSQL transaction-scoped advisory locks serialize acceptance for the same provider across API replicas. A provider may accept only one active service at a time. Different providers use separate locks. Job row locks prevent repeat reviews; payment, completion and withdrawal transactions remain protected. Quote updates use a conditional status transition to avoid resurrecting a cancelled job. The provider/status database index supports availability checks and tracking queries.

Authenticated HTTP limits use a verified user ID (120 requests/minute), rather than grouping all users on the same IP. Anonymous requests retain IP limits. Login also retains the separate brute-force limiter. Existing Socket.IO Redis adapter supports cross-replica room events. HTTP limiter counters remain per process: use a shared gateway/Redis limiter before scaling replicas.

The local PostgreSQL contention test launches 1,000 service calls together against 10 jobs for one provider. Exactly one succeeds; the rest are business rejections. The final run took 4.582 seconds. A second test launched 1,000 discovery HTTP requests with distinct signed synthetic customer identities through the real Nest controller, JWT guard, user rate limiter and PostgreSQL, using a client pool of 100 connections. All 1,000 returned HTTP 201 in 808 ms. The disposable dataset is small and the discovery result is empty; this is not representative production sizing.

An unpooled burst of 1,000 simultaneous TCP connections failed locally: 232 returned a response and 768 connections were refused, including outside the sandbox. Increasing the listener backlog alone did not resolve it. The test requested a 2,048 backlog; operating-system limits still apply. The passing pooled test does not prove 1,000 simultaneous sockets or sustained 1,000 requests/second. Production capacity requires representative HTTP/WebSocket tests, database pool/instance sizing, connection pooling/reverse-proxy configuration, routing capacity and latency monitoring. Do not set PostgreSQL's pool to 1,000 simply to match request count.

Final checks: 18 backend tests passed, including PostgreSQL and HTTP bursts; 11 provider Flutter tests passed. Android device/background and release-build verification remain required.

Run `scripts/test-realtime-local.ps1 -Database -FlutterExecutable C:/path/to/flutter/bin/flutter.bat` for local checks. The opt-in tests use a disposable local database schema.

## Badges

The provider dashboard displays actual performance badges instead of its old hardcoded list. Completion milestones: Reliable Starter (10), Bronze Wrench (100), Silver Wrench (500), Gold Wrench (1,000). Customer Favourite requires at least 10 reviews and a 4.5 average. Top Performer requires 100 completed jobs, 50 reviews and a 4.8 average. Review-dependent badges disappear if the average drops below the threshold. No KYC badge is claimed by this calculation.

Only the customer owning a completed job can submit its single 1–5 star rating. Ratings and reputation changes commit atomically. Historical ratings were not persisted per job, so they cannot be reconstructed into trustworthy averages; new badge review counts use stored job ratings only.

Schema additions are saved in `scripts/provider-performance-migration.sql`. Test/apply through the project's local-first migration and deployment workflow. Nothing was deployed as part of this change.

