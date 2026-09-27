# QuickMechanic: Mobile App Testing Guide

Testing the Flutter mobile applications (`customer_app` for Customers, `provider_app` for Mechanics) requires a specific setup to ensure they can correctly communicate with the NestJS backend and stream WebSockets.

## Prerequisite: The Backend Must Be Running
The mobile apps are just the "face" of the platform. If the backend is off, you cannot log in or test the map.
Always ensure you have run the following before testing the apps:
1. `docker compose up -d` (To start PostgreSQL & Redis)
2. `npm run start:dev` (Inside the `backend/` folder to start the NestJS API)

---

## Testing Environment 1: Chrome Web Browser (Easiest)
Because Flutter supports Web compilation, the easiest way to test UI changes without heavy Android emulators is in Google Chrome.

1. Open your terminal.
2. Navigate to the app you want to test (e.g., the Provider app):
   ```powershell
   cd C:\Users\aruns\Desktop\DREAM\QuickMechanic\apps\provider_app
   ```
3. Run the app in Chrome:
   ```powershell
   flutter run -d chrome
   ```

**Important Caveat for Web:**
When running in Chrome, `http://localhost:3000` will perfectly connect to your local backend because the browser and the backend share the exact same `localhost` network.

---

## Testing Environment 2: Android Emulator / Physical Device
When you want to test native device features (like actual GPS hardware) you must run the app on an Android Emulator or a real Android phone plugged into your computer via USB.

1. Start your Android Emulator via Android Studio (or plug in your phone).
2. Forward the phone's local port 3000 to the API running on your computer:
   ```powershell
   adb reverse tcp:3000 tcp:3000
   ```
3. Run the app:
   ```powershell
   flutter run
   ```

**CRITICAL FIX FOR ANDROID TESTING:**
If you run the app on a phone/emulator, **`localhost` will fail unless you use the ADB forwarding command above.** This is because an Android phone considers "localhost" to be the phone itself, *not* your computer running the NestJS backend!

If ADB forwarding is not available, pass your computer's actual Wi-Fi IP address at build time instead:
1. Open Command Prompt and type `ipconfig`. Find your IPv4 Address (e.g., `192.168.1.15`).
2. Start the app with:
   ```dart
   flutter run --dart-define=API_BASE_URL=http://192.168.1.15:3000
   ```
The provider app defaults to the Cloud Run API in release builds. Use
`--dart-define=APP_ENV=local` only when deliberately testing a local backend.

---

## End-to-End Testing Checklist
Once the apps are running, use this checklist to verify functionality:

- [ ] **Auth Test:** Open the Provider App. Attempt to log in with an incorrect password. You should see a red *"Invalid email or password"* popup.
- [ ] **Success Test:** Log in with a valid mechanic credential. You should see a green popup and land on the Dashboard.
- [ ] **Socket Test:** On the Provider Dashboard, click "GO ONLINE". The backend console should log `Client connected: [socket_id]`.
- [ ] **Map Test:** Open the Customer App side-by-side. The Customer app map should update automatically as the mechanic moves.
