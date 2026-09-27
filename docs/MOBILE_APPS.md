# QuickMechanic: Mobile Applications Architecture

The QuickMechanic platform uses a **Dual-App Strategy**. Instead of building one massive app with complicated permissions and mixed UI, we have separated the ecosystem into two distinct, lightweight Flutter applications tailored perfectly for their specific users.

---

## 1. The Customer App (`apps/customer_app`)
**Target Audience:** Everyday drivers, commuters, and fleet managers who experience a breakdown.
**Purpose:** To request emergency roadside assistance as fast and seamlessly as possible.

### Key Features:
- **Premium Glassmorphic UI:** A visually stunning, modern dark-mode aesthetic designed to reassure users during stressful breakdowns.
- **Live Mechanic Tracking:** Uses WebSockets (`socket_io_client`) and `flutter_map` (OpenStreetMap) to show a live icon of the dispatched mechanic driving toward their exact GPS location in real-time.
- **Frictionless Registration:** Simple email/phone signup flow to get users into the system instantly without heavy KYC.

---

## 2. The Provider App (`apps/provider_app`)
**Target Audience:** Tow truck drivers, freelance mechanics, and mobile repair shops.
**Purpose:** To accept breakdown jobs, navigate to the customer, and get paid.

### Key Features:
- **Mechanic Dashboard:** A streamlined interface focusing on a giant "Go Online / Go Offline" toggle button.
- **Background Location Emitter:** When online, the app utilizes WebSockets to constantly beam the mechanic's GPS coordinates to the NestJS backend via Redis, ensuring the dispatch engine always knows where they are.
- **KYC & Tiering System:** A specialized registration flow that captures the mechanic's capabilities (e.g., Two-Wheeler vs. Heavy Truck repairs) so the backend can dispatch them to the correct type of breakdown.

---

## Shared Technology Stack
Both mobile applications are built using the exact same core technologies to maximize code reuse and maintainability:
- **Framework:** Flutter (Dart) — Allows compiling to both iOS and Android natively from a single codebase.
- **API Communication:** `http` package for stateless REST requests (Login, Signup).
- **Real-Time Communication:** `socket_io_client` for persistent, bi-directional socket connections.
- **Environment Management:** A custom `api_config.dart` file that allows instantly toggling the backend connection between `localhost` (testing) and Google Cloud Run (live production).
