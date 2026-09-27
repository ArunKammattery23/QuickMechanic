# QuickMechanic: Complete Local Testing Guide

Because this platform uses a microservices-style monorepo architecture, you must run multiple applications simultaneously to test the full ecosystem locally.

You will need to open **4 separate terminal windows** in VS Code (click the `+` icon in the terminal panel to open new ones) and follow these exact steps in order.

---

## 1. Start the Databases (PostgreSQL + Redis)
Open your first terminal window. This command spins up your local testing databases using Docker.
```powershell
cd C:\Users\aruns\Desktop\DREAM\QuickMechanic
docker compose down
docker compose up -d
```
*(Wait 10 seconds for the databases to fully boot up before moving to step 2).*

---

## 2. Start the Backend API (NestJS)
Open your second terminal window. This starts the core brain (The Dispatch Engine, Auth, and WebSockets).
```powershell
cd C:\Users\aruns\Desktop\DREAM\QuickMechanic\backend
npm run start:dev
```
*(You should see a message saying "Nest application successfully started").*

---

## 3. Start the Admin Dashboard (Next.js)
Open your third terminal window. This starts the super admin web panel.
```powershell
cd C:\Users\aruns\Desktop\DREAM\QuickMechanic\apps\admin_dashboard_web
npm run dev
```
👉 **Test It:** Open Google Chrome and go to [http://localhost:3000](http://localhost:3000). You should see your live, dark-mode glassmorphism dashboard!

---

## 4. Start the Mobile Apps (Flutter)
Open your fourth terminal. Ensure you have the Flutter SDK installed on this machine or use an Android Emulator.

To test the **Customer App**:
```powershell
cd C:\Users\aruns\Desktop\DREAM\QuickMechanic\apps\mobile_app
flutter run -d chrome
```

*(Optional)* To test the **Provider App** side-by-side, open a fifth terminal:
```powershell
cd C:\Users\aruns\Desktop\DREAM\QuickMechanic\apps\provider_app
flutter run -d chrome
```

---

### The Ultimate Testing Flow (End-to-End)
Once all the above services are running, execute this sequence to verify the entire platform:
1. Open the **Customer App** and register a new customer account.
2. Open the **Provider App** and register as a mechanic (verify the backend hashes your password and saves you to PostgreSQL).
3. In the **Provider App**, trigger the mechanic to go "Online" to connect to WebSockets and start beaming their location.
4. In the **Customer App**, navigate to the Map Screen. You should see the WebSocket connect and instantly receive the location data via the Redis cache, moving the marker on the map!
5. Open the **Admin Dashboard** (`http://localhost:3000`) and verify the active mechanic and customer count have incremented!
