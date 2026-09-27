# QuickMechanic: Security Audit & Threat Model

This document tracks the known security threats to the QuickMechanic platform, what has been resolved, and what needs to be addressed in future phases.

---

## ✅ Resolved Security Threats

These vulnerabilities have been patched and deployed to the codebase.

### 1. Unauthenticated WebSockets (Location Spoofing & Stalking)
* **The Threat:** Previously, anyone could connect to the Socket.io server and emit `update_location` or `subscribe_to_mechanic` events using just a `mechanicId`. This allowed malicious actors to secretly track mechanics or spoof their locations.
* **The Fix:** Implemented `@nestjs/jwt` and a custom `WsJwtGuard`. 
    * WebSockets now require a valid JWT token during the initial connection handshake.
    * The backend ignores the client-provided `mechanicId` and securely extracts the user's ID directly from the cryptographic token payload, making spoofing impossible.

### 2. Lack of Rate Limiting (DDoS & Brute Force Attacks)
* **The Threat:** The system was vulnerable to automated bots spamming the `/auth/login` and `/auth/register` endpoints, which could exhaust database connections, fill the database with fake accounts, or brute-force user passwords.
* **The Fix:** Implemented `@nestjs/throttler` globally across the NestJS backend. All IP addresses are now strictly limited to 10 requests per minute by default, instantly blocking brute-force attacks with HTTP 429 errors.

---

## 🚧 Future Security Threads (To Be Addressed)

These vulnerabilities exist in the architecture but are scheduled for future development phases.

### 1. Device-Level GPS Spoofing (Mobile App)
* **The Threat:** A legitimate mechanic could install a "Mock Location" app on their Android or iOS device to fake their GPS coordinates. This could be used to steal jobs from other mechanics by appearing closer to the customer, or to manipulate the distance-based pricing algorithm.
* **Planned Fix:** The Flutter apps (Provider App) must implement root/jailbreak detection and block usage if "Mock Locations" or developer spoofing settings are enabled on the OS level.

### 2. JWT Token Storage (XSS Vulnerability)
* **The Threat:** If the Next.js Super Admin Dashboard or any future web portals store the JWT access token in `localStorage`, a Cross-Site Scripting (XSS) attack could easily steal the token, granting the attacker full access.
* **Planned Fix:** Migrate web-based JWT storage to **HttpOnly, Secure Cookies**. This prevents JavaScript (and therefore malicious scripts) from reading the token.

### 3. Business Logic Abuse (Dispatch Pricing Manipulation)
* **The Threat:** The pricing is calculated using a `Base Fee + (Distance * Rate)` formula. If a customer intercepts the HTTP request and artificially sends a "Customer Location" that is exactly 0.01 meters away from the mechanic, they could trick the server into charging only the base fee.
* **Planned Fix:** The backend must implement strict geofencing validation. It should cross-reference the customer's actual GPS location against the requested breakdown location and ensure the calculated distance is mathematically plausible before generating an invoice.
