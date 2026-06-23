# Facility Maintenance System

React/Vite CMMS prototype for maintenance requests, fleet, PPE, suppliers, and operational dashboards.

## Requirements

- Node.js 20 or newer
- npm

## Local Run

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://127.0.0.1:5173/`.

## Production Build

```powershell
npm run build
```

The build output is written to `dist/`.

## Demo Login

- Admin: `vadim@chemipal.co.il`
- Password: `1234`

Demo data is stored in the browser through the local `window.storage` shim backed by `localStorage`.
