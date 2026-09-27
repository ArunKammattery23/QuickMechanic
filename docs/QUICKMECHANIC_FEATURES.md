# QuickMechanic: Comprehensive Feature Specification

This document serves as the official master list of all business, technical, and UI features requested and designed for the QuickMechanic platform. It acts as the ultimate blueprint for investors, developers, and platform administrators.

---

## 1. Provider (Mechanic) Onboarding & Configuration
Mechanics have full autonomy over what jobs they take and how much they get paid, creating a highly attractive gig-economy environment.

* **Configuration Wizard:** A guided multi-step UI where mechanics select their available services (e.g., Flat Tire, Battery Jump Start, Unknown Trouble/Checking Charge) and supported vehicle categories.
* **Dual-Tier Vehicle Classification:** Vehicles are strictly categorized into Standard (Hatchbacks, Regular Bikes) and Premium/Luxury (Superbikes, BMW, Audi).
* **Dynamic Pricing Matrix:** Mechanics set their exact desired **"Take-Home Pay"** for every specific Service + Vehicle combination. 
* **Platform Commission Engine:** The backend automatically calculates a percentage or flat-fee commission on top of the mechanic's take-home pay to generate the final customer invoice.

---

## 2. Monetization Strategy: The Premium Paywall
QuickMechanic utilizes a powerful "Freemium" model to acquire mechanics rapidly while monetizing high earners.

* **Free Tier (Standard):** Mechanics can configure their profiles and service standard vehicles completely for free.
* **Premium Subscription (Luxury):** Mechanics must purchase a recurring monthly subscription (e.g., ₹499/month) to unlock the ability to service Luxury/Premium vehicle categories.
* **Paywall Enforcement:** If a free-tier mechanic attempts to select a Luxury vehicle in the app, a dedicated Paywall Dialog blocks them. The backend strictly enforces this via a `403 Forbidden` API rejection if circumvented.

---

## 3. Dispatch, Algorithmic Ranking, & Elite Badges
The platform ensures customers get the best possible service by gamifying and rewarding top mechanics. To maximize long-term retention and trust, QuickMechanic employs a brutally difficult Elite 11-Badge system.

* **The Elite 11-Badge System:** Mechanics grind for years to collect highly prestigious badges that signal extreme competence to the customer. The 11 predefined badges are:
  1. **Verified Mechanic:** Passed strict KYC & Background Checks (The foundation badge).
  2. **Bronze Wrench:** 100 Completed Jobs
  3. **Rising Star:** 100 Five-Star Reviews
  4. **1-Year Veteran:** 1 Year Active on App
  5. **Silver Wrench:** 500 Completed Jobs
  6. **Local Hero:** 500 Five-Star Reviews
  7. **3-Year Veteran:** 3 Years Active on App
  8. **Gold Wrench:** 1,000 Completed Jobs
  9. **Titan of the Road:** 1,500 Completed Jobs (The legendary badge)
  10. **The Perfect Legend:** 1,000 Five-Star Reviews
  11. **The Apex Founder:** 5 Years Active on App (The ultimate badge)
* **Geospatial Dispatching:** The backend utilizes PostGIS (`ST_DWithin`) to track mechanic GPS coordinates in real-time and locate the absolute closest active providers.
* **Algorithmic Priority:** When a customer requests a rescue, the backend sorts the list of available mechanics so that mechanics holding elite badges (like Titan of the Road) and 5-star ratings appear at the very top of the customer's screen.
* **Busy Mode (ETA Penalty):** Mechanics can toggle "Busy Mode" and select a custom wait time (e.g., "+30 mins"). This adds a time penalty to their estimated arrival, dropping them down the customer's priority list without forcing them to go offline completely (perfect for lunch breaks).

---

## 4. Job Offers & Milestone Gamification
* **Standard Job Offers:** Mechanics receive a neon-styled alert showing the vehicle, breakdown location, and driving ETA.
* **100-Job Milestone (Extra Charge):** To reward loyalty, mechanics who complete 100 lifetime jobs unlock a special "Premium Mechanic Feature" on their job offers. This allows them to instantly tack on an "Extra Charge" (for late-night hours, difficult terrain, etc.) *before* accepting the job.

---

## 5. Escrow Security & SLA Enforcement
To protect the platform's reputation and the customer's wallet, a strict Service Level Agreement (SLA) is enforced.

* **The Wallet Escrow:** When a mechanic taps "ACCEPT JOB", the customer's payment is processed and locked in a virtual wallet under a `WalletStatus.ESCROW` state. The mechanic cannot withdraw it yet.
* **The 10-Minute SLA Timer:** Accepting a job triggers a hidden 10-minute countdown on the NestJS backend. The mechanic must tap "START JOURNEY" to confirm they are moving, which stops the timer.
* **Automated Penalty Engine:** If a mechanic ghosts the customer and fails to start their journey within 10 minutes, a server-side Cron Job automatically:
  1. Revokes the job.
  2. Cancels the Escrow payment.
  3. Re-routes the job to the next nearest available mechanic.

---

## 6. Dynamic Pricing: Weather Surcharges
* **Automated Surge Pricing:** During harsh environmental conditions (like heavy rain), the platform automatically applies a Surge Surcharge (e.g., +20% or flat ₹90) to the customer's bill.
* **Provider Incentive:** This extra fee is explicitly passed on to the mechanic. 
* **Dynamic UI Alerts:** When it starts raining, a glowing "🌧️ HEAVY RAIN ALERT" banner appears on the mechanic's dashboard. Any incoming job alerts clearly break down the Base Pay vs the Weather Surcharge, maximizing their motivation to work.

---

## 7. Completion & Payout
* **Mark as Completed:** Upon arriving and fixing the vehicle, the mechanic taps "MARK AS COMPLETED", dropping them back onto the active dashboard.
* **Instant Payout:** The backend updates the Service Request to `COMPLETED` and instantly shifts the Escrow funds to `AVAILABLE` in the mechanic's wallet.
* **Real-time Analytics:** The mechanic's "Today's Dashboard" immediately updates with their new total earnings, accepted jobs count, and pushes them closer to their next lifetime badge milestone.
