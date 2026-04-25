# 12 Week Year Tracker

A daily task tracker built around the 12 Week Year framework. Track daily execution, review weekly/monthly/quarterly progress, and stay accountable to your goals.

## Features

- **Daily Task Management** with week calendar strip for fast day switching
- **Due Date Assignment** with quick-pick dates (Today, Tomorrow, This Friday, Next Monday) or custom date picker
- **Week/Month/Quarter Reviews** with completion stats and interactive task lists
- **12 Week Goals** to define and track quarterly objectives
- **Streak Tracking** for consecutive 100% completion days
- **PWA Installable** as a desktop or mobile app
- **Offline Support** via service worker caching
- **Local Storage** persistence (no backend required, data stays on your device)

## Deploy to Vercel

### Option 1: Push to GitHub, then deploy

```bash
# Initialize repo
git init
git add .
git commit -m "Initial commit: 12 Week Year Tracker"

# Push to GitHub
gh repo create 12-week-tracker --public --push --source=.

# Then go to vercel.com/new and import the repo
```

### Option 2: Deploy directly with Vercel CLI

```bash
npm i -g vercel
vercel
```

## Install as Desktop/Mobile App

After deploying:

1. Open your Vercel URL in Chrome
2. Click the install icon in the address bar (or Menu > "Install app")
3. The tracker will run in its own window like a native app

On mobile: Use "Add to Home Screen" from the browser menu.

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

- Next.js 14 (App Router)
- Tailwind CSS
- localStorage for persistence
- Service Worker for offline/PWA
