# QuickMechanic: Cloud Services Architecture & Accomplishments

This document outlines the exact Google Cloud Platform (GCP) services currently provisioned for the QuickMechanic deployment, as well as a summary of everything we have built and accomplished in Phase 1.

Every service below was explicitly chosen because it satisfies the requirement for a **"beginning testing and development stage"**, prioritizing the absolute minimum compute resources to conserve Free Trial credits.

---

## Part 1: Cloud Architecture

### 1. Database Layer: Google Cloud SQL
- **Service Name:** `quickmechanic-db`
- **Engine:** PostgreSQL 15 (with PostGIS extension for geolocation)
- **Machine Tier:** `db-f1-micro` (Shared core)
- **Storage:** 10 GB (SSD)
- **Why this tier?** This is the smallest, lowest-tier instance Google offers. It has only 1 virtual CPU and 0.6 GB of memory. It costs approximately ~$10/month and is strictly for development. Standard production databases cost $50-$200+/month.

### 2. API Backend: Google Cloud Run
- **Service Name:** `quickmechanic-api`
- **Environment:** Serverless Container Execution
- **Machine Tier:** 1 vCPU, 512MB RAM
- **Why this tier?** Traditional Compute Engine (VM) servers run 24/7 and charge you by the hour even when no one is using the app. Cloud Run uses a **"scale to zero"** architecture. This means when you are not actively testing the app, the server shuts down completely. You are only billed for the exact milliseconds the CPU is actively processing a request. 

### 3. Container Storage: Artifact Registry
- **Service Name:** `quickmechanic-repo`
- **Purpose:** Cloud Run requires your backend code to be zipped up into a "Docker Image" before it can be executed. Artifact Registry simply acts as a secure storage locker to hold this code image.
- **Why this tier?** You are only charged for the exact Megabytes of storage your code takes up, which is less than $0.05 a month.

---

## Part 2: Phase 1 Accomplishments (What We Have Done)

We successfully completed the entire **Cloud Infrastructure & Backend Initialization** phase. Here is exactly what is currently built into this repository:

1. **NestJS Backend Foundation:**
   - We bootstrapped a modern, enterprise-grade NestJS backend in the `backend/` folder.
   - We configured `TypeORM` to connect to PostgreSQL.
   - We scaffolded modules for `Users`, `Auth`, `Mechanic`, `ServiceRequests`, and `Invoice`.

2. **Dual-Mode Database System (Local-First):**
   - **Local Mode:** We created a `docker-compose.yml` file to instantly spin up a local PostgreSQL database (`QuickMechanic`) on your machine for zero-cost, hyper-fast development testing.
   - **Live Mode:** We connected the backend to Google Cloud SQL.
   - We implemented `@nestjs/config` and `.env.development` files so the app automatically knows whether to use the local DB or the live DB depending on where it is running.

3. **Production Containerization:**
   - We wrote a highly optimized `Dockerfile` that packages only the necessary production dependencies (using `--omit=dev`) to keep the cloud deployment tiny and fast.
   - We set up `cloudbuild.yaml` to utilize high-CPU cloud build instances for faster remote compiling.

4. **Security & Deployment Scripts:**
   - We securely routed Cloud Run through a Unix Domain Socket to talk to Cloud SQL privately, completely avoiding dangerous public IP connections.
   - We created the `scripts/deploy.bat` file, which permanently saves the massive, complex `gcloud` deployment commands so you can deploy to the cloud with a single click.
   - We created `AGENTS.md` to ensure any future AI assistants strictly adhere to our Local-First testing policy.

By combining the `db-f1-micro` database with a "Scale-to-Zero" `Cloud Run` backend, and establishing a robust "Local-First" Docker workflow, we have created an architecture that is incredibly powerful, entirely portable, and completely free under your trial limits.
