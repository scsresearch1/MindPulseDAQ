# MindPulseDAQ - Android DAQ App

MindPulseDAQ is a focused Android data-acquisition app with a strict runtime flow:

1. BLE connection to hardware
2. Subject details (name + 6-digit case ID)
3. Live collection from BLE stream
4. Manual upload with `Store Test Data`

The app writes session records to Firebase Realtime Database at:
`mindpulse/v1/sessions/{timestamp_caseId}`.

## Build

**Option 1: Android Studio (recommended)**  
Open the `MindPulseDAQ` folder in Android Studio. It will sync Gradle and download dependencies. Then use **Build → Make Project** or run on an emulator/device.

**Option 2: Command line**  
If you have Gradle installed, run `gradle wrapper` first to generate the wrapper, then:

```bash
./gradlew assembleDebug   # Windows: gradlew.bat assembleDebug
./gradlew installDebug    # Install to connected device
```

## Project Structure

```
app/src/main/java/com/mindpulse/mindpulseui/
├── MainActivity.kt
├── MindPulseApp.kt
├── Theme.kt
├── data/
│   ├── BleBandManager.kt
│   ├── MindPulseTelemetryStore.kt
│   └── FirebaseRtdbUploader.kt
└── ... (supporting UI/data files)
```

## Temporary Firebase seed script

Use this to quickly push a temporary DAQ record into the same RTDB used by EndUserSimulation:

```bash
node scripts/push-temp-session.mjs 123456 SubjectA
```

Arguments are optional; defaults are used if omitted.
