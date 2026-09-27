# QuickMechanic: Core Application Workflow

This document outlines the complete end-to-end workflow of the QuickMechanic platform, detailing both the business rules and the technical implementation that powers the gig-economy dispatch system.

---

## 1. Mechanic Onboarding & Configuration (The Wizard)
Before a mechanic can go online and receive jobs, they must configure their profile.

- **Step 1: Services Selection**: The mechanic selects the types of services they offer (e.g., Flat Tire, Battery Jump Start, Unknown Trouble/Checking Charge).
- **Step 2: Vehicle Categories**: The mechanic selects which vehicle classes they can service (e.g., Standard Cars, Luxury Cars, Heavy Trucks).
- **Step 3: Pricing Matrix**: The mechanic sets their desired **"Take-Home Pay"** for every combination of Service + Vehicle. 
  - *Business Logic*: Servicing a luxury vehicle (e.g., BMW) inherently costs more than a standard vehicle (e.g., Toyota) due to specialized tools and care. The pricing matrix handles this dynamically.
- **Save to Database**: The entire matrix is saved to the `MechanicPricing` entity in PostgreSQL.

---

## 2. Monetization Strategy: The Premium Paywall
The platform uses a highly effective "freemium" provider model to guarantee rapid onboarding while monetizing high-earners.

- **Free Tier (Standard Vehicles)**: Mechanics can configure and service standard cars, bikes, and trucks completely for free.
- **Subscription Tier (Luxury Vehicles)**: The backend Database explicitly marks certain vehicle categories (like Superbikes and Luxury Cars) with an `isPremiumTier = true` flag. 
- **The Lock**: If a free-tier mechanic attempts to select a Luxury vehicle in the Configuration Wizard, they are blocked by a Paywall Dialog. They must purchase a monthly subscription (e.g., ₹499/month) to unlock these high-paying jobs.
- **API Security**: The NestJS backend enforces this lock by throwing a `403 Forbidden` error if an unsubscribed mechanic tries to inject luxury vehicles into their profile.

---

## 3. Going Online, Geospatial Dispatch, & Badges
- **Status Change**: The mechanic taps "GO ONLINE". The Flutter app connects to the NestJS WebSocket Gateway.
- **Location Broadcasting**: The mechanic's GPS coordinates are continuously broadcasted to the backend and stored using PostGIS (`currentLocation` geometry point).
- **Busy Mode (Wait Time)**: Mechanics can toggle "Busy Mode" and set a time penalty (e.g., "+30 mins"). This allows them to finish their lunch without going completely offline. The algorithm factors this penalty into their ETA.
- **The Dispatch Algorithm**: When a customer requests a rescue, the backend uses PostGIS (`ST_DWithin`) to find nearby mechanics. It then sorts the results sent to the customer based on a heavily weighted algorithm:
  1. **Badge Tier** (Platinum mechanics appear first)
  2. **Average Rating** (e.g., 4.9 Stars)
  3. **Effective ETA** (Physical driving time + `busyWaitTimeMins` penalty)
- **Dynamic Badges**: Mechanics are awarded dynamic badges (Bronze, Silver, Gold, Platinum) based on their lifetime `completedJobsCount` and `averageRating`.

---

## 4. The Job Offer & Premium Gamification
When the backend assigns a job, a neon-styled alert pops up on the mechanic's dashboard.

- **Standard Mechanics (Under 100 Lifetime Jobs)**: 
  - They see the customer's vehicle details, breakdown location, and driving distance.
  - They can only tap "ACCEPT" or "DECLINE".
  
- **Milestone Mechanics (100+ Lifetime Jobs)**:
  - *Gamification Incentive*: Mechanics who hit the 100-job milestone unlock a special Extra Charge capability.
  - *The Extra Charge Feature*: A glowing amber box appears on their job offer, allowing them to instantly tack on an "Extra Charge" (e.g., late-night fee, off-road recovery fee, hazardous weather fee) before they accept the job.

---

## 5. Wallet Escrow & Dispatch SLA (Service Level Agreement)
To protect both the customer and the platform, a strict dispatch pipeline is enforced.

- **Acceptance & Escrow**: When the mechanic taps "ACCEPT JOB", the customer's payment is processed and deposited into a virtual wallet under the `WalletStatus.ESCROW` state. The mechanic *cannot* withdraw this money yet.
- **The SLA Timer (10 Minutes)**: The moment the job is accepted, a hidden 10-minute countdown begins on the backend.
- **Start Journey**: The mechanic is required to tap "START JOURNEY" to confirm they are physically moving toward the customer. This stops the SLA timer.
- **SLA Penalty Engine**: If the mechanic accepts a job but gets distracted or ghosts the customer (failing to start the journey within 10 minutes), the backend Cron engine (`@nestjs/schedule`) automatically:
  1. Revokes the job from the mechanic.
  2. Cancels the Escrow wallet transaction (penalty).
  3. Re-routes the job to the *next* nearest available mechanic.

---

## 6. Job Completion & Payout
- **Arrival & Fix**: The mechanic arrives, fixes the vehicle, and taps "MARK AS COMPLETED".
- **Fund Release**: The backend updates the `ServiceRequest` status to `COMPLETED`. This triggers the `WalletTransaction` to shift from `ESCROW` to `AVAILABLE`.
- **Platform Commission**: The platform automatically calculates its percentage/flat-fee commission on top of the mechanic's "Take-Home Pay" before presenting the final invoice to the customer. 
- **Stats Update**: The mechanic's lifetime `completedJobsCount` increments by 1, pushing them closer to the next Badge Tier and maintaining their high-performer status. Their daily earnings dashboard instantly updates.
