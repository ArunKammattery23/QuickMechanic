# Flutter Setup Guide for Windows

Welcome to Phase 2! To build the mobile application for Android and iOS, you must install the Flutter SDK on your Windows machine. Please follow these steps carefully.

## 1. Download the Flutter SDK
1. Go to the official Flutter website: [https://docs.flutter.dev/get-started/install/windows](https://docs.flutter.dev/get-started/install/windows)
2. Click the blue button to download the latest **Flutter SDK `.zip` file**.

## 2. Extract the SDK
1. Open your `Downloads` folder.
2. Right-click the `.zip` file you just downloaded and select **Extract All**.
3. Extract the contents to `C:\src\flutter`.
   > [!WARNING]
   > Do **not** extract Flutter to a folder that requires elevated privileges like `C:\Program Files\`.

## 3. Update your Windows Path
To use Flutter from any command line window, you must add it to your environment variables.
1. Click the Windows Start Search bar and type **"env"**.
2. Click **"Edit the system environment variables"**.
3. Click the **"Environment Variables..."** button at the bottom.
4. Under "User variables", find the variable named **"Path"** and double-click it.
5. Click **"New"** and add: `C:\src\flutter\bin`
6. Click **OK** on all three windows.

## 4. Install Android Studio
Android Studio provides the Android SDK tools and emulators required to compile and run your app.
1. Download Android Studio here: [https://developer.android.com/studio](https://developer.android.com/studio)
2. Run the installer and leave all settings as default.
3. Open Android Studio once it finishes installing. Follow the "Android Studio Setup Wizard" to download the necessary Android SDK tools.

## 5. Accept Android Licenses
Open a brand new Terminal window (PowerShell or Command Prompt) and run the following command to accept the Google licenses:
```bash
flutter doctor --android-licenses
```
*Press `y` and `Enter` for every prompt.*

## 6. Verify Installation
Finally, run the Flutter diagnostic tool to ensure everything is perfect:
```bash
flutter doctor
```

> [!TIP]
> Once `flutter doctor` shows green checkmarks for Flutter and Android Toolchain, return to our chat and tell me **"I have installed Flutter"**. I will then generate the mobile app source code!
