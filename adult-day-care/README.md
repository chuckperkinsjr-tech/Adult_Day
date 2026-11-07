# Adult Day Care

Patient records for an adult day care. Runs as a standalone Mac app. Everything is stored on the computer it is installed on.

## What it does
- Add, edit, and delete patients (name, date of birth, contact info, emergency contact, allergies, medications, medical history, dated history log)
- Search by name, phone, or email
- Sort by last name, first name, age, recently updated, or recently added
- Print a patient record, or save it as a PDF to attach to an email
- Back up all data to a file, and restore from a backup

## Where the data lives
    ~/Library/Application Support/Adult Day Care/patients.json
A copy of the previous version is kept next to it as patients.json.bak.

## Easiest install (no typing)
Double-click `Install Adult Day Care.command`. It builds the app and puts it in Applications. The first time, macOS may say it cannot verify the file: right-click it, choose Open, then Open again. Node.js (nodejs.org, LTS) must be installed first; the script opens the download page if it is missing.

## Windows
Double-click `Install Adult Day Care.bat` on a Windows PC (Node.js must be installed first; the script opens the download page if it is missing). It builds `Adult Day Care Setup 1.0.0.exe` in the `dist` folder. Double-click that file to install. Windows may show a SmartScreen warning because the installer is not signed: click More info, then Run anyway.
Without a Windows PC, run the "Build Windows installer" workflow on GitHub (Actions tab) and download the result from Artifacts.
Data location on Windows: `%APPDATA%\Adult Day Care\patients.json`

## Run it while developing
1. Install Node.js (LTS) from nodejs.org
2. In this folder:

       npm install
       npm start

## Build the Mac installer
On the Mac:

    npm install
    npm run dist

The installer appears in `dist/` as a `.dmg` (works on Intel and Apple Silicon Macs). Open it and drag Adult Day Care into Applications.

No Mac handy? Push this folder to GitHub and run the "Build Mac installer" workflow from the Actions tab.
Note: a .dmg downloaded that way will show a Gatekeeper warning; right-click the app and choose Open the first time.
A .dmg built on the same Mac you install it on does not show the warning. To remove the warning for other
computers you need an Apple Developer account ($99/yr) to sign and notarize.

## Customize
- Fields: `renderer/index.html` (form), `renderer/app.js` (TEXT_FIELDS / LISTS), `main.js` (TEXT_FIELDS / LIST_FIELDS), `record-html.js` (printed layout)
- Organization name on printouts: `record-html.js`
- App icon: add `build/icon.icns`

## Privacy
The app does not encrypt its data file. Turn on FileVault (System Settings > Privacy & Security), use a login password,
and keep backups somewhere secure. PDFs contain health information; send them only through encrypted email.
