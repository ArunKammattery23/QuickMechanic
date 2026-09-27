# QuickMechanic: Scaling Guide (10k to 1M Users)

This document outlines the necessary architectural changes and code updates required to scale the QuickMechanic platform from an MVP to an enterprise-grade system capable of handling up to 1 million concurrent users.

The foundational architecture (NestJS + PostgreSQL + Redis) is correct, but scaling requires shifting focus from application logic to distributed systems infrastructure.

---

## 1. Addressing 10,000 Concurrent Users

At 10,000 active users, a single Node.js instance and a basic PostgreSQL database will start to experience significant degradation.

### A. Spatial Index (Database Bottleneck) - ✅ IMPLEMENTED
Previously, the `mechanic-profile.entity.ts` lacked a spatial index on the `currentLocation` column. The Dispatch Engine relies heavily on `ST_DWithin`. Searching through 10,000 unindexed rows would force PostgreSQL to perform a sequential scan, crippling performance.

**Status:**
This has now been **implemented**. The entity correctly uses a spatial GIST index:
```typescript
import { Index } from 'typeorm';

// ...
  @Index({ spatial: true })
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  currentLocation: string;
```

### B. WebSocket Scaling (Memory & CPU Bottleneck) - ✅ IMPLEMENTED
A single NestJS instance handles a few thousand WebSockets before event loop lag becomes an issue. To handle 10k users, you must scale horizontally to multiple backend instances.
Currently, `location.gateway.ts` stores location data in Redis but does not use the Socket.io Redis Adapter. Without this adapter, a customer on Server A cannot receive socket events from a mechanic connected to Server B.

**Status:**
This has now been **implemented**. The `@socket.io/redis-adapter` is installed and a custom `RedisIoAdapter` is bound in `main.ts`. All websocket traffic is seamlessly routed across the Redis pub/sub channels.

### C. Database Connections
A single Node.js instance scaling up will open too many direct database connections.
**Action Required:**
Deploy a connection pooler like **PgBouncer** or use Cloud SQL's built-in connection pooling to multiplex lightweight connections.

---

## 2. Scaling to 1 Million Users

At 1 million users, the platform moves into the territory of massive distributed systems, comparable to the early days of Uber or DoorDash.

### A. Database Read Replicas (Master-Slave Architecture)
With 1 million users, read traffic (viewing profiles, loading maps, checking past invoices) will overwhelm the primary database.
**Action Required:**
- Deploy PostgreSQL Read Replicas.
- Configure TypeORM to route all `SELECT` queries to the replicas, keeping the Master database free for `INSERT/UPDATE` operations.

### B. Redis Clustering for the Location Firehose
If 50,000 mechanics stream their GPS location every 3 seconds, that generates ~16,000 writes per second. A single-threaded Redis instance will bottleneck.
**Action Required:**
Upgrade to a **Redis Cluster** to shard the high-frequency location data across multiple Redis nodes, ensuring unlimited throughput.

### C. Advanced Horizontal Scaling
At 1M users, you may have 50-100 NestJS backend instances.
**Action Required:**
- Ensure strictly stateless authentication (JWT is already in place).
- Implement robust horizontal auto-scaling (e.g., using Kubernetes or Google Cloud Run) based on CPU/Memory thresholds.

---

## Summary
The QuickMechanic codebase is built on the right enterprise foundation (Hexagonal Architecture). The transition to 1 million users does not require a rewrite of the business logic, but it does mandate the implementation of a distributed infrastructure layer (PgBouncer, Read Replicas, Redis Socket Adapters, and Redis Clustering).
