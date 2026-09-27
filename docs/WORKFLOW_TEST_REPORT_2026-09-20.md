# QuickMechanic local workflow and concurrency validation

Tests began 20 September 2026; provider tests and both admin builds reconfirmed 21 September 2026. No production deployment or live money movement.

## Conclusion

The tested core workflows pass after fixing reproducible authentication, configuration, discovery, quotation and concurrency failures. This is a local acceptance result, **not a guarantee of crash-free operation or a certified production user limit**.

The sustained-load run established 500 authenticated sockets gradually, delivered 4,500 GPS updates over approximately one minute, exercised concurrent discovery reads, and verified reconnect/subscription and call-offer signaling. An earlier instantaneous 500-socket connection attempt encountered connection refusals. The ramped test does not resolve or conceal that burst limitation; its cause and production impact still need investigation.

## Environment and isolation

- Windows development host; Node v25.2.1; 20 logical CPUs; approximately 31.7 GiB host memory. These are not the specifications or measured limits of a budget VPS.
- Local Docker PostgreSQL/PostGIS and Redis. Tests target loopback only and create separate timestamped schemas. Test schemas and namespaced Redis keys are removed by teardown; existing application records are not test fixtures.
- Flutter 3.47.2 / Dart 3.13.2. Both apps' cached dependency configuration had referenced an older Flutter SDK. Offline dependency resolution updated SDK-pinned lockfile entries; generated build/cache files were cleaned and regenerated.
- Real Nest controllers, services, JWT authentication, TypeORM transactions, PostgreSQL, Redis and Socket.IO are used in the new integration harness. It assembles a dedicated testing module, not the complete production `AppModule`/`main.ts` bootstrap.
- Road routing is a deterministic local HTTP stub; payments use simulation. Test account credentials and socket JWTs are synthetic. Full production auth IP-rate-limiter/proxy behavior is not measured by the harness.

## Coverage and observed results

| Check | Result and scope |
| --- | --- |
| Backend build and full TypeScript checking | Pass, including test source type checking |
| Backend Jest suite | 14 suites / 47 tests; includes opt-in local database and workflow tests |
| Concurrent complete workflows | 20 customer/provider pairs; 350 HTTP requests; zero workflow failures; roughly 6.6 seconds total; observed per-request p95 approximately 1.2 seconds |
| Competing accepts | 1,000 database operations against the same provider; exactly one acceptance |
| HTTP discovery burst | 1,000 requests over 100 persistent connections; all HTTP 201; zero rejected connections; approximately 0.9 seconds on this host |
| Sustained real-time load | 250 customer/provider pairs = 500 authenticated sockets; 4,500 GPS updates delivered over approximately 61 seconds; reconnect and call signaling passed |
| Customer Flutter tests | 13 passing widget/unit tests |
| Provider Flutter tests | 19 passing widget/unit tests, including automatic quotation and retry behavior |
| Admin applications | Production builds pass for both `apps/admin_dashboard_web` and `admin-dashboard`; browser-based end-to-end UI testing is not included |
| Flutter static analysis | No analyzer errors; 129 customer and 222 provider warnings/info findings remain. Analyses used `--no-fatal-infos --no-fatal-warnings`, so this is not a warning-free result |

The 20-pair workflows cover registration/login, provider service/vehicle/pricing setup, online status, service/vehicle-filtered discovery, request/accept, automatic quote preparation/sending, failed then successful simulated payment, completion/customer confirmation/rating, cancellation/refund, job detail/history, and balanced ledger/empty escrow checks. Half the pairs complete and half cancel.

Additional tests cover admin login/finance authorization, unauthenticated and wrong-role configuration access, malformed credentials/signup, simultaneous duplicate signup, one-use password-reset token consumption under concurrent requests, repeated configuration saves, price clearing, and competing quote preparation. Existing suites also exercise payment idempotency, payout accounting, pricing policy and mocked payment callbacks.

Socket fixtures authenticate but do not perform 500 simultaneous password logins or 500 full booking flows. GPS updates and call signaling are not real GPS hardware or WebRTC audio. Short-run memory changes are affected by garbage collection and are not evidence of absence of memory leaks.

## Failures fixed during this work

1. Discovery's vehicle filter referenced an unavailable query alias; automatic saved-price lookup also placed cross-alias comparisons inside unsuitable join conditions. Both queries now succeed in service/vehicle-filtered workflows.
2. Provider configuration/service mutation routes lacked authentication/ownership checks. They now reject unauthorized writes. Concurrent replacement of provider pricing now runs transactionally with a profile row lock, input validation and proper empty-price clearing.
3. Automatic quote preparation could accept another job without the normal capacity lock. It now shares the provider advisory lock and active-job check used by acceptance.
4. Password-reset token consumption used a read/write sequence vulnerable to concurrent reuse. Conditional database updates now permit one successful consumption and avoid overwriting a newer reset request during email failure cleanup.
5. Malformed login/signup caused server errors. Signup validates required inputs, duplicate database constraints become HTTP 409, and provider account/profile creation is atomic.
6. Redis Socket.IO client errors lacked handlers, and clients were not disposed cleanly. Added error listeners and graceful disposal.
7. Repaired obsolete unit-test expectations, Supertest imports and a Nest listener type mismatch. Provider quote widget tests now reflect server-calculated pricing rather than the removed manual-price UI.

## Reproduce

Prerequisites: installed repository npm dependencies, Docker Desktop, cached Flutter packages, and Flutter on PATH (or pass its executable explicitly).

From the repository root in PowerShell:

```powershell
.\scripts\test-workflows-local.ps1 -SocketPairs 250 -SoakSeconds 60 -FlutterExecutable C:/flutter/bin/flutter.bat
```

Use `-BackendOnly` to omit mobile tests and dashboard builds. Default load is 100 socket pairs with five GPS rounds. Supported bounds are 1–500 pairs and 0–300 soak seconds; those bounds are test options, not claims that all combinations have been validated. PostgreSQL must already be ready or the script asks you to retry. Local database tests use the repository's local credentials (the new workflow suite also accepts `QM_LOCAL_DB_PASSWORD`).

The script starts local database/Redis services if needed, builds/type-checks the backend, runs all Jest suites with local database tests enabled, then runs Flutter tests and both admin builds. It restores the test environment flags and working directory on exit. Docker services stay running for local development.

Execution note: the combined script's backend and customer results were captured successfully. Its terminal session was no longer available when work resumed, so the provider tests and both admin builds were rerun individually and each returned exit code 0. A final exit code for that original combined invocation was not captured.

## Before production release

1. Reproduce both gradual and sudden arrival loads on the intended server using separate load-generator machines. Measure latency percentiles, error rate, CPU, memory and database connections. Include longer soak tests, disconnect storms, rolling restarts and dependency outages.
2. Run physical-device customer/provider journeys, background GPS/permissions, network loss/recovery and actual WebRTC voice/TURN flows. Complete browser-based admin login/session/authorization checks.
3. Verify real email delivery, external routing failures and payment-provider sandbox callbacks; do not enable real money merely because simulated ledger tests pass. Validate payout reconciliation separately.
4. Resolve or triage remaining Flutter analyzer findings, especially asynchronous UI-context warnings.
5. Test actual production bootstrap, reverse proxy, TLS/WSS, CORS and per-IP auth throttling. Many users sharing one public IP may encounter the configured auth limit; proxy configuration must preserve the correct client IP without trusting arbitrary forwarded headers.
6. The old `npm run test:e2e` Hello World scaffold and standalone prototype microservice e2e suites were not run against application data. The isolated local script above is the validated integration entrypoint. Do not confuse compile success of legacy scaffolds with workflow validation.
7. Confirm production migrations, backups/restore, observability, graceful shutdown and deployed-host resource limits. No deployment, failover or restoration drill was performed here.

Graphify's existing map was consulted for coverage orientation; it contains older source references and is not used as validation evidence. The repository had substantial pre-existing changes, which were preserved.
