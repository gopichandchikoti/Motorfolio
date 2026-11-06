# Motorfolio

Motorfolio keeps your vehicle ownership history in one private place: fuel, maintenance, expenses, trips, receipts, warranties, and reminders. It runs as a local browser app and an Android app, without an account, hosted database, analytics, or automatic vehicle tracking.

**Local app:** [http://127.0.0.1:5181](http://127.0.0.1:5181)  
**Android:** `com.portfolio.motorfolio`, version **1.0.0 (1)**  
**Developer guide:** [Architecture, flowcharts, verification, and release](docs/ARCHITECTURE.md)

## Features

| Area | What you can do |
|---|---|
| Garage | Keep multiple vehicles, optional VIN/photo, year/make/model/trim, and odometer units |
| Fuel | Log full/partial fills, station, quantity, cost, derived unit price, and valid US MPG trends |
| Services and expenses | Record categories, providers, notes, and local image/PDF receipts |
| Maintenance | Set date-only, mileage-only, or combined reminders with adjustable lead times |
| Warranties | Store provider, reference, coverage dates, mileage limit, terms, receipt, and expiry status |
| Trips | Keep start/end odometers, distances, and explained corrections |
| Reports | Review ownership costs, cost per mile, monthly/category summaries, and filtered activity |
| Data and preferences | Capture/import receipts, transfer CSV, encrypt/restore full backups, convert units, change currency/theme |

Browser data lives in IndexedDB; Android uses app-private SQLite. The browser works offline after its first successful load and shell caching. Android bundles its interface for offline use. Data stays local until you explicitly export or delete it.

## Run locally

Use Node **22.13.1** and npm; [.nvmrc](.nvmrc) records the tested Node version. From the repository root:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd start
```

Open **http://127.0.0.1:5181**. On macOS/Linux, use `npm` instead of `npm.cmd`.

The server binds only to loopback. Keep the same hostname and port: `localhost` and `127.0.0.1` have separate garages. Clearing site storage deletes that garage. Both `npm start` and `npm run dev` serve the production files in `dist/`; rebuild after source changes. These commands do not provide hot reload.

For a Windows background server:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1
```

Stop that background server with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/stop-local.ps1
```

Use **Ctrl+C** for a foreground server. The stop helper targets only the process recorded by the background start helper. `scripts/bootstrap.ps1` combines dependency installation, production build, and foreground startup.

## How to use the app

### 1. Create a garage

Choose **Add your first vehicle**, enter a nickname and vehicle details, and choose miles or kilometers. VIN and photo are optional. Add more vehicles in **My garage** and switch vehicles in **Overview**.

A fictional demo garage loads only when explicitly selected and is visibly labeled. **Start with my vehicles** clears demo records and additions made in demo mode; export a backup first if you want to keep them.

### 2. Record activity

Choose **Log activity**, select the correct vehicle/type, and enter the date and odometer.

- **Fuel:** enter quantity, total cost, optional station, and full/partial tank status. Choose gallons or liters in **Settings & data**. Unit price derives from cost divided by quantity. MPG needs two valid full fills and includes intermediate partial fills.
- **Service or expense:** enter category, description, cost/currency, provider, notes, and an optional receipt. Search/filter/edit/delete records in **Fuel & expenses**.
- **Trip:** enter starting and ending odometers; the end must exceed the start. Review distances in **Trips & odometer**.

The app rejects future completed activities, invalid fuel quantities, and conflicting odometers. For an intentional history change, select **This is an intentional odometer correction** and explain why. Corrections reset MPG boundaries; cost per mile is unavailable when a trustworthy distance span cannot be established.

### 3. Keep receipts and warranties

Attach PNG, JPEG, WebP, or PDF files up to **3 MB** to an activity or warranty. **Capture receipt photo** opens the Android camera; browser capture uses available device/browser file-capture support. Cancellation or denial leaves file import available.

In **Warranties**, choose **Add warranty** and enter provider, reference, coverage start, optional expiry date/odometer, lead times, terms, and receipt. Status uses your entered limits; no manufacturer/provider terms are inferred. Download receipts from their records.

### 4. Set maintenance reminders

In **Maintenance**, choose **Add reminder** and set a date, positive due odometer, or both. At least one is required. Choose day/distance lead times; complete, reopen, edit, or delete reminders as work is done. Choose appropriate intervals from the owner's manual.

Enable optional Android date notifications in **Settings & data** and allow permission. Delivery is approximate and may be delayed by Android power management; no exact-alarm access is requested. Mileage warnings update in-app after manual odometer records. The browser uses the calendar rather than background date scheduling. Denial does not prevent record keeping or calendar use.

### 5. Review costs and preferences

**Overview** shows the selected vehicle's recorded cost, efficiency, services, and recent activity. **Reports** shows monthly/category totals. **Fuel & expenses** supports text, type, category, vehicle, and date filters; **Export results** exports matching activity.

In **Settings & data**, choose appearance, fuel unit, and reporting currency. Reports include records already in that currency; no exchange rates are applied. Changing a vehicle's distance unit asks for confirmation, then converts its complete odometer/trip/reminder/warranty history together.

### 6. Back up and restore

| Settings action | Contents | Import behavior |
|---|---|---|
| **CSV export** | Activity records; no receipt binary data | Requires matching vehicles; merges by record ID after review |
| **Encrypted backup** | Entire garage, warranties, schedules, preferences, photos, receipts | Replaces the workspace only after validation and confirmation |

Choose **Encrypted backup**, enter a password of at least **10 characters**, and save the file. Keep the password safely; there is no recovery service. On another device, choose **Import / restore**, select the backup, enter its password, review, and confirm. Export the existing garage before replacing it. Restore files are limited to **50 MB**.

Back up before clearing browser storage, uninstalling Android, or choosing **Delete all local data**. Shared/downloaded files are separate copies; deleting local records does not delete them.

## Build and run on Android

Prerequisites: **JDK 21**, Android SDK **platform 36**, **build-tools 36.0.0**, and configured `JAVA_HOME` / `ANDROID_HOME`. Minimum Android SDK is **26**; target SDK is **36**.

Replace these example paths with your installed toolchain directories:

```powershell
$env:JAVA_HOME='C:\path\to\jdk-21'
$env:ANDROID_HOME='C:\path\to\Android\Sdk'
npm.cmd ci
npm.cmd run android:build
```

The build compiles the web app, synchronizes Capacitor, and runs Gradle `assembleDebug assembleRelease`.

| Output | Purpose |
|---|---|
| `artifacts/motorfolio-1.0.0-debug.apk` | Debug-signed APK for sideload testing |
| `artifacts/motorfolio-1.0.0-release-unsigned.apk` | Release build requiring owner signing before installation/distribution |
| `artifacts/build-evidence.json`, `artifacts/*.sha256` | Versions, sizes, hashes, build evidence |

Install and launch the debug build on a connected device or booted emulator:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" devices -l
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r artifacts\motorfolio-1.0.0-debug.apk
& "$env:ANDROID_HOME\platform-tools\adb.exe" shell am start -n com.portfolio.motorfolio/.MainActivity
```

If several devices are connected, add `-s YOUR_SERIAL` after the adb executable. See [packaging, signing, and recovery](docs/ARCHITECTURE.md#build-release-and-recovery).

## Verify the app

| Command | Checks |
|---|---|
| `npm run check` | Strict TypeScript, ESLint, behavior tests, production build |
| `npm run test:coverage` | Full configured TypeScript scope, 90% thresholds in all four metrics |
| `npm run test:browser` | Isolated Chrome journeys, backups/receipts, accessibility, responsive layout, offline use; start server first |
| `npm run test:android` | Actual APK/SQLite, camera, permissions/delivery, airplane mode, Back, text scale, relaunch on a dedicated emulator |
| `npm audit --omit=dev` | Production dependency vulnerability audit |

For browser tests, install Chrome or set `CHROME_PATH` to its executable. For Android tests, boot a **dedicated test emulator** and set `ANDROID_SERIAL`, for example `$env:ANDROID_SERIAL='emulator-5582'`. The native suite creates QA records, tests permissions, opens camera/share UI, and temporarily changes display/connectivity settings. Do not run it on a personal phone.

Verified **2026-11-05**: **41 automated tests**, **16 Chrome checks**, **13 Android 15 emulator checks**, web/debug/release builds, and an isolated clean installation passed. All four coverage gates passed. [Verification and evidence](docs/ARCHITECTURE.md#verification-and-evidence) records exact scope and remaining acceptance.

## Limits and troubleshooting

- **Physical-device acceptance is pending:** TalkBack, manufacturer camera/power behavior, battery use, and Android 12-16 hardware checks need physical phones. Public distribution needs production signing.
- **Storage is device/origin specific:** transfer a full backup between browser profiles and Android; there is no account-based sync.
- **Charts may be empty:** add enough valid history. Efficiency uses US MPG; reports omit missing months and do not estimate depreciation or exchange rates.
- **Storage/conflict error:** retain the draft, check available space, and reload/retry as directed. Another tab may have saved a newer revision. Corrupt data is reported rather than silently reset.
- **Missing build:** run `npm run build`, restart the server, and reload the same URL.
- **Port in use:** use the existing Motorfolio instance or stop its owned process with the helper; leave unrelated processes running.
- **Wrong Java:** check `JAVA_HOME`; the native build requires JDK 21 even if other versions are installed.

See [remaining acceptance and security boundaries](docs/ARCHITECTURE.md#limitations-and-remaining-acceptance), including development-tool audit findings.

## Repository layout

```text
README.md                Setup, everyday use, commands, troubleshooting
docs/ARCHITECTURE.md      Implementation, diagrams, contracts, QA, release, notices
src/                     React UI, domain rules, state, validation, adapters
server/                  Loopback static server and health endpoint
android/                 Capacitor app and native integration
tests/                   Domain, persistence-boundary, DOM behavior tests
scripts/                 Build, browser/native checks, local lifecycle helpers
public/                  Bundled web assets and app metadata
.github/workflows/       Static/coverage/build and Android packaging CI
qa/                      Generated local screenshots and evidence; ignored
artifacts/               Generated APKs, hashes, build evidence; ignored
```

The architecture guide contains the consolidated engineering documentation and dependency notices. Generated QA images/APKs are available locally after the documented checks; reading the repository does not require them.
