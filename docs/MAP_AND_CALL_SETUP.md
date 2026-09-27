# Map and call improvements

For the current payment and completion workflow, see [Job payments and history](JOB_PAYMENTS_AND_HISTORY.md). Customer approval now releases funds; the old OTP/mock-payment workflow has been replaced.

Both Flutter apps now share the same map behavior and backend road router:

- OpenStreetMap tiles, visible attribution, and native on-demand tile caching.
- Full OSRM road geometry with a highlighted remaining route, road distance, and estimated travel time.
- Animated mechanic position and heading; manual panning pauses camera following and recenter restores it.
- Upcoming road/maneuver guidance in the provider map.
- Route refresh when the mechanic moves off route, throttled refresh during travel, no repeated polling while stationary.
- GPS accuracy and delayed-location states. Route errors show retry instead of a fabricated straight line.

Travel times are estimates based on the road network, without live traffic. OSM coverage, GPS accuracy, and routing profiles affect results. This is foreground guidance, not a replacement for a tested full turn-by-turn navigation system. Existing external navigation remains available.

## Free routing

`OSRM_BASE_URL` selects the router in `.env.development` or `.env.production`. The isolated local demo API started by `scripts/start-updated-demo-api.ps1` uses `http://127.0.0.1:5000` by default, keeping job coordinates on the PC. Other backend launches fall back to the public OSRM demonstration server unless configured. Both apps call the authenticated backend endpoint, so they no longer disagree about which router to use. Identical requests are cached for 30 seconds. Use a self-hosted OSRM instance for sustained production traffic; open-source software has no API licence fee, but hosting and bandwidth may cost money.

For local self-hosting, obtain an `.osm.pbf` extract covering your operating region and run:

```powershell
./scripts/start-local-routing.ps1 -PbfPath C:/path/to/region.osm.pbf
```

For Kerala local testing, `./scripts/prepare-kerala-routing.ps1` downloads the public Kerala extract from OpenStreetMap France, verifies its published MD5 checksum, and runs the same local OSRM setup. It prepares routing only for Kerala; use another regional extract for jobs elsewhere.

Then set `OSRM_BASE_URL=http://127.0.0.1:5000` in the backend development environment. The script saves data under `data/routing/`, preprocesses it with the driving profile, and binds the router to loopback. It does not download a large regional dataset or replace an existing dataset automatically. Pass `-Image` with a tested image tag/digest for reproducible deployments.

Tiles default to `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. `--dart-define=MAP_TILE_URL=...` supports a different compatible tile server. Retain the appropriate attribution. The app fetches displayed tiles only and respects HTTP caching, with a seven-day native fallback when no max-age is supplied.

Sources: [OSRM setup](https://github.com/Project-OSRM/osrm-backend#quick-start), [OSRM demo usage](https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server), [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/).

## Calling

Login and WebSockets now use the same JWT configuration. `JWT_SECRET` is required in production. HTTP job actions validate signatures and roles. Socket room membership verifies the token before joining, and calls/tracking require an active job linking the two users. Re-login if tokens were signed with a different secret.

Calls now have unique IDs, serial buffering of early ICE candidates, incoming/connecting/connected/error states, mute, timeout, decline, and remote hang-up handling. The overlay is app-wide rather than attached to a previous screen. Both iOS apps declare microphone usage. Android and iOS phone-scheme lookups support the cellular fallback.

For calls across restrictive networks, configure a reachable TURN server:

```dotenv
TURN_URLS=turn:your-relay.example:3478?transport=udp,turn:your-relay.example:3478?transport=tcp
TURN_SECRET=your-coturn-shared-authentication-secret
```

Use coturn's `use-auth-secret`/`static-auth-secret` configuration with the same secret. The API issues user-specific credentials valid for one hour; the shared secret stays on the server. Public relay deployment, firewall/NAT configuration, and TLS certificates are environment-specific and have not been provisioned. Without these values, same-network STUN calling can work, but cross-network reliability is not guaranteed. Background/terminated-app incoming calls still require native call notifications and a separate lifecycle implementation.

An SMTP password previously embedded in source was removed. Configure `SMTP_USER` and `SMTP_PASSWORD`, and rotate the exposed old credential. Removing it from the working tree does not invalidate it or erase old copies/history.

## Local validation

Use the Flutter SDK compatible with the repository's package lock. The current package configuration points to Flutter 3.24.0. The newer `C:/flutter` installation and this older project SDK should not share generated build caches.

```powershell
./scripts/test-realtime-local.ps1
./scripts/test-realtime-local.ps1 -Database
```

If Flutter 3.24.0 is not on PATH, pass `-FlutterExecutable C:/path/to/flutter/bin/flutter.bat` to either command.

Latest local verification: both Flutter suites passed (11 tests each); all 14 backend tests passed, including the two PostgreSQL concurrency tests. The main backend TypeScript check passed. Real-device audio and TURN traversal remain pending.

The database option requires Docker Desktop, starts only the local PostGIS and Redis services, and runs concurrency tests in a uniquely named disposable schema in local `QuickMechanic`. It never uses `.env.production` or Cloud SQL. Set `QM_LOCAL_DB_PASSWORD` only if your local Docker password differs.

For two real phones on the same Wi-Fi, build/run both apps with the same local API address:

```powershell
flutter run --dart-define=API_BASE_URL=http://YOUR_PC_LAN_IP:3000
```

Verify a customer/mechanic job end to end: request, accept, quote, customer wallet/Razorpay payment, live GPS, reconnect, calls in both directions, delayed answer, decline, mute, hang-up, cancellation/completion. Repeat the call test with one phone on mobile data after configuring TURN. Microphone audio and mobile-network traversal require real device validation.

The revised wallet payment/completion/cancellation flows are transactional, and withdrawals lock the profile balance. Database concurrency checks must pass before deployment. Existing broader workspace TypeScript errors in legacy microservice tests are outside this change.

## Visual preview

The preview uses public demonstration coordinates and simulated mechanic movement, not real customer data:

```powershell
cd apps/customer_app
flutter build web --no-pub -t lib/map_preview.dart --output=build/map-preview --web-renderer html
cd ../..
node scripts/preview-map.cjs
```

Open `http://127.0.0.1:8089`. This is a separate preview build; the normal app entrypoint remains `lib/main.dart`. Deploy the backend and both rebuilt apps together after local validation because the call signaling and route response contracts changed. Use `scripts/deploy.bat` for the backend deployment.
