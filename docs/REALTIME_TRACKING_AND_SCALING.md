# Real-Time Tracking & Mapping System

This document outlines the architecture and user experience of the QuickMechanic real-time location tracking system, designed to handle 100,000+ concurrent users with an enterprise-grade backend and a highly polished, unique frontend experience.

## 1. System Architecture

The core of the live-tracking engine relies on **NestJS**, **WebSockets (Socket.IO)**, and **Redis**.

### Event Flow
1. **Job Request:** The Customer submits a job. The `DispatchService` assigns the nearest mechanic.
2. **Socket Dispatch:** The backend (`LocationGateway`) immediately fires a `new_job_request` socket event to the Provider app.
3. **Live Telemetry Stream:** Upon acceptance, the Provider app begins streaming GPS coordinates *and* speed data (in m/s) to the backend via the `update_location` socket event (every ~2 seconds).
4. **Redis Pub/Sub:** The backend caches the live location in Redis (10-minute expiry) and instantly broadcasts it to a dedicated room (`tracking_<mechanicId>`).
5. **Customer Map Update:** The Customer app listens to this room. It receives the stream and uses `latlong2` to calculate the exact distance, factoring in the live speed to compute an accurate ETA.

### Enterprise Scalability
To support 100,000+ users across multiple horizontal server nodes (e.g., Google Cloud Run), the system uses the `@socket.io/redis-adapter`. 
* **The Problem Solved:** Without this, a Customer connected to Server Node A would never receive location updates from a Mechanic connected to Server Node B.
* **The Solution:** The `RedisIoAdapter` (configured in `main.ts` and `redis.adapter.ts`) acts as a central nervous system. All nodes publish socket events to Redis, and Redis instantly routes them to the exact node where the recipient is connected (in under 5ms).

## 2. User Experience (UI/UX)

To differentiate QuickMechanic from standard ride-sharing applications (like Uber or Rapido), the Map UX is designed around a **"Technical Rescue"** and **"HUD (Heads-Up Display)"** aesthetic.

### Customer App
- **Carto Dark Tile Layer:** The map is rendered in high-contrast dark mode to feel premium and tech-focused.
- **Pulsing SOS Radar:** The breakdown location is marked by a translucent red 50-meter `CircleLayer`, indicating an active rescue zone.
- **Wrench Target Icon:** The incoming mechanic is displayed as a distinct glowing Wrench/Toolbox icon.
- **Glassmorphic Telemetry HUD:** Live metrics (Distance and ETA) are rendered in a blurred, top-mounted panel using a monospace terminal font, mimicking live vehicle diagnostic dashboards.
- **Auto-Fit Bounds:** The `MapController` continuously auto-zooms and auto-pans the map so both the Customer and the Mechanic are perfectly framed on the screen at all times.
- **Connecting Polyline:** A dotted blue line dynamically connects the two markers, shrinking in real-time as the mechanic approaches.

### Provider App (Mechanic)
- **Carto Dark Tile Layer:** Matches the Customer's premium dark aesthetic.
- **Target Reticle:** The customer is marked with a bright red "Target Reticle", emphasizing the mission/job focus.
- **Nav Arrow:** The mechanic is represented by a blue navigation arrow.
- **Auto-Fit Bounds:** Just like the Customer app, the map automatically keeps both the mechanic's location and the destination perfectly visible, eliminating the need to manually pan while driving.
- **Connecting Polyline:** The same dynamic dotted blue line connects the mechanic to their target.

## 3. Libraries Used
- **Backend:** `@nestjs/websockets`, `@socket.io/redis-adapter`, `ioredis`
- **Frontend (Flutter):** `flutter_map` (v8.3.1), `latlong2` (v0.10.1), `geolocator` (v13.0.1)
