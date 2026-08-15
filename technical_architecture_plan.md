# QuickMechanic: Technical Architecture & Implementation Plan

As a software architect with 30+ years of experience, I have designed this platform to be resilient, highly scalable, and structurally modular from day one. By adopting a **Microservices Architecture**, we ensure that high-traffic components (like real-time location tracking) can scale independently from administrative or payment components.

## 1. Proposed World-Class Technology Stack

After analyzing the project requirements and modern enterprise standards, here is the recommended stack:

### A. Mobile Applications (Frontend)
*   **Framework:** **Flutter (Dart)**
*   **Why:** Allows us to maintain a single, unified codebase for iOS and Android. Flutter is exceptionally performant, handles complex real-time map animations gracefully, and was specifically recommended in your initial research document. We will build separate app flavors or modules for:
    *   Customer App
    *   Mechanic / Provider Terminal (including Towing & Petrol variants)

### B. Admin Web Dashboard (Frontend)
*   **Framework:** **Next.js (React / TypeScript)** with TailwindCSS.
*   **Why:** Next.js is the industry standard for robust, fast, and scalable web applications. It provides an excellent developer experience for building data-heavy dashboards to monitor users, mechanics, and live jobs.

### C. Backend Engine (Microservices)
*   **Framework:** **NestJS (Node.js / TypeScript)**
*   **Why:** NestJS is heavily inspired by Angular's architecture and forces a highly disciplined, modular structure. It has native support for microservices (TCP, Redis, gRPC) out of the box, making it the absolute best choice for splitting your backend into independent services.

### D. Databases & Real-Time Infrastructure
*   **Primary Database:** **PostgreSQL with PostGIS Extension**
    *   *Why:* PostGIS is mandatory for accurate "Radius Searches" (finding the nearest mechanic within X km). Relational structure is best for financial and user data integrity.
*   **In-Memory Store / Pub-Sub:** **Redis**
    *   *Why:* Crucial for handling real-time location updates, storing ephemeral data (like active mechanic online status), and caching.
*   **Real-time Communication:** **WebSockets (Socket.io)** integrated within NestJS for live tracking.

---

## 2. Modular Architecture (Microservices Breakdown)

To ensure true modularity, the backend will be split into the following independent domains:

### 1. API Gateway / Auth Service
*   **Responsibility:** The single entry point for all mobile apps and the admin dashboard. Handles user & mechanic registration, login, and JWT token issuance and validation.

### 2. User & Provider Management Service
*   **Responsibility:** Manages profiles. For mechanics and towing services, this handles the **KYC verification flow**, vehicle types (crane, flatbed, petrol delivery), and stores their permanent data.

### 3. Job Dispatch & Matching Service (The Core)
*   **Responsibility:** Receives breakdown requests, calculates the dynamic pricing based on distance and base fees, and runs the matching algorithm to ping nearby, available mechanics. Manages the job state (Requested -> Accepted -> En Route -> Completed).

### 4. Location & Tracking Service
*   **Responsibility:** A high-throughput WebSocket service. Mechanics constantly ping this service with their GPS coordinates. Customers connect to this to see their mechanic moving on the map in real-time.

### 5. Notification Service
*   **Responsibility:** Connects to Firebase Cloud Messaging (FCM) for push notifications, and handles SMS (e.g., Twilio) or emails for alerts and receipts.
