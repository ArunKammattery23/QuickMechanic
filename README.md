# QuickMechanic: Roadside Assistance Platform

Welcome to the QuickMechanic repository! This document serves as a comprehensive guide to all features, architecture, and workflows implemented in the platform.

## 🏗 Architecture Overview

The system is built on a modern, real-time microservices stack:
- **Backend**: NestJS, PostgreSQL (with PostGIS for spatial queries), TypeORM, Redis (for Socket.IO adapter scaling).
- **Frontend Apps**: Flutter (Customer App, Provider/Mechanic App).
- **Communication**: REST APIs for CRUD operations and Wallet management, Socket.IO for real-time dispatch and WebRTC signaling.

## 🚀 Key Features Implemented

### 1. Advanced Geolocation & Dispatching (Backend)
- **PostGIS Integration**: Mechanics' locations are stored using spatial geometries (Points).
- **20KM Radius Filtering**: The `getNearbyMechanics` API dynamically calculates distance and restricts searches strictly to mechanics within a 20 km radius using `ST_DWithin`.
- **Accurate Distance Calculation**: The exact distance is returned to the Customer App (`distanceText` e.g., "4.2 km") using the `ST_Distance` PostGIS function.
- **SLA Timeout Cron Job**: Automatically cancels jobs and penalizes mechanics who accept a job but fail to act within 10 minutes.

### 2. Provider App (Mechanic Workflow)
- **Real-Time GPS Broadcast**: When online, the app continuously syncs location with the backend.
- **Quotation System**: When accepting a breakdown request, the mechanic app calculates the distance and prompts the mechanic to send a quote ($30 base + $2/km travel charge).
- **Escrow Wait State**: The mechanic app pauses and waits for the `payment_secured` socket event before releasing the customer's exact coordinates.
- **Job Tracking & Navigation**: Shows live tracking to the customer, provides an "Arrived" button, and supports a direct "Navigate in Google Maps" redirect.
- **OTP Verification**: To complete a job, the mechanic must physically arrive and collect a 4-digit OTP from the customer.
- **Wallet & Withdrawals**: A premium dashboard shows the mechanic's current wallet balance, total earnings, and allows daily withdrawals (restricted to once per 24 hours).
- **Job Cancellation**: Mechanics can cancel the job while en route, which automatically refunds the customer.

### 3. Customer App Workflow
- **Service Selection & Discovery**: Customers select a breakdown service (e.g., Flat Tire) and instantly see a list of nearby mechanics complete with star ratings and exact distance.
- **Secure Mock Payments**: Once the mechanic sends a quote, a bottom sheet prompts the customer to securely pay. The funds are placed into an Escrow Wallet state.
- **OTP Generation**: Upon successful payment, a 4-digit Completion OTP is securely displayed on the map HUD for the customer to give to the mechanic upon arrival.
- **Live Mechanic Tracking**: Customers can watch the mechanic's vehicle drive towards them on a live map, with real-time Distance and ETA updates.
- **Cancellation Handling**: If the mechanic cancels the job, the customer is alerted immediately, and their escrow payment is automatically refunded.

### 4. In-App Communication
- **WebRTC Voice Calling**: Both apps feature a prominent green phone button that utilizes WebRTC (signaled over our persistent Socket.IO connection) to establish direct voice calls between the customer and mechanic without exposing real phone numbers.

---

## 🔄 The Complete Job Lifecycle

1. **REQUEST**: Customer views mechanics under 20km and presses "Request". Job is created in `REQUESTED` status.
2. **ACCEPTANCE**: Mechanic accepts.
3. **QUOTATION**: Mechanic sends quote. Job moves to `AWAITING_PAYMENT`.
4. **PAYMENT (ESCROW)**: Customer reviews quote and pays. Wallet transaction created in `ESCROW`. Job moves to `PAYMENT_SECURED`.
5. **EN ROUTE**: Mechanic drives to customer. Live tracking begins.
6. **ARRIVED**: Mechanic presses "Arrived".
7. **COMPLETION**: Mechanic enters the 4-digit OTP provided by the customer. Job moves to `COMPLETED`. Escrow wallet transaction changes to `AVAILABLE` and credits the mechanic's digital wallet.
8. **WITHDRAWAL**: Mechanic hits "Withdraw" on their dashboard to transfer digital wallet funds to their bank (simulated, max 1x per day).

*(Exception Flow)*
- **CANCELLATION**: If the mechanic cancels before arriving, the job moves to `CANCELLED`, the escrow transaction is updated to `CANCELLED` (refund), and the customer is notified.

---

## 📂 Codebase Structure

- `/backend` - The NestJS server.
  - `apps/backend/src/dispatch/` - Core business logic for quotes, mock payments, cancellations, and withdrawals.
  - `apps/backend/src/location/` - WebSocket Gateway for live tracking and signaling.
  - `libs/common/src/entities/` - Database schemas (ServiceRequest, MechanicProfile, WalletTransaction).
- `/apps/provider_app` - Flutter app for Mechanics.
  - `lib/screens/dashboard_screen.dart` - Wallet UI, Online/Offline toggle, Quote handling.
  - `lib/screens/active_job_screen.dart` - Map tracking, Arrived, Complete Job OTP UI, Cancel Job.
- `/apps/customer_app` - Flutter app for Customers.
  - `lib/screens/mechanic_list_screen.dart` - Displays 20km filtered mechanics.
  - `lib/screens/map_screen.dart` - Payment bottom sheet, OTP display, live ETA tracking, Cancellation handler.
