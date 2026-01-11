# Project Setup Guide

## Current Folder Structure

Your `C:\Claude\pokemon_meta_tracker\` folder should look like this:

```
pokemon_meta_tracker/
│
│── CLAUDE.md                    ← Claude Code instructions (KEEP IN ROOT)
├── README.md                    
├── PRD.md                       
├── TECH_STACK.md               
├── IMPLEMENTATION_GUIDE.md     
├── DATA_SOURCES.md             
├── CLAUDE_CODE_GUIDELINES.md   
│
├── scripts/
│   ├── check.sh                
│   └── verify-build.sh         
│
└── app/                         ← The Next.js app goes here
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── next.config.js
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx
    │   │   ├── layout.tsx
    │   │   ├── globals.css
    │   │   ├── deck/
    │   │   │   └── [id]/
    │   │   │       └── page.tsx
    │   │   └── api/
    │   │       └── limitless/
    │   │           └── tournaments/
    │   │               ├── route.ts
    │   │               └── [id]/
    │   │                   └── results/
    │   │                       └── route.ts
    │   ├── components/
    │   │   ├── ui/
    │   │   │   └── Tabs.tsx
    │   │   ├── Header.tsx
    │   │   ├── DeckCard.tsx
    │   │   ├── DeckList.tsx
    │   │   └── TournamentSelector.tsx
    │   ├── hooks/
    │   │   └── useTournamentSelection.ts
    │   ├── lib/
    │   │   ├── types.ts
    │   │   ├── utils.ts
    │   │   └── limitless.ts
    │   └── data/
    │       └── creators.json
    └── public/
```

## Setup Instructions

### Step 1: Open in Claude Code

Open the `pokemon_meta_tracker` folder in Claude Code:

```
cd C:\Claude\pokemon_meta_tracker
claude
```

Or open Claude Code and navigate to this folder.

### Step 2: Initialize the Next.js App

Tell Claude Code to create the app subfolder:

```
Create a new Next.js app in a subfolder called "app" using:
npx create-next-app@latest app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

### Step 3: Navigate to App Folder

All development commands should be run from inside the `app` folder:

```
cd app
npm install
npm run dev
```

### Step 4: Follow Build Order

Refer to CLAUDE.md for the exact file creation order. Claude Code will read this automatically.

---

## Why This Structure?

1. **Documentation separate from code** - Keeps the Next.js app clean while maintaining easy access to specs

2. **CLAUDE.md in root** - Claude Code finds instructions when you open the project

3. **App in subfolder** - Standard practice for projects with documentation alongside code

4. **Scripts accessible** - Can run verification scripts from project root

---

## Alternative: Flat Structure

If you prefer everything in one folder, you can also do:

```
pokemon_meta_tracker/
├── CLAUDE.md
├── docs/
│   ├── README.md
│   ├── PRD.md
│   ├── TECH_STACK.md
│   ├── IMPLEMENTATION_GUIDE.md
│   ├── DATA_SOURCES.md
│   └── CLAUDE_CODE_GUIDELINES.md
├── scripts/
│   ├── check.sh
│   └── verify-build.sh
├── package.json            ← Next.js app at root level
├── tsconfig.json
├── tailwind.config.ts
├── src/
│   └── ...
└── public/
```

In this case, run `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir` (note the `.` to create in current directory).

---

## Commands Reference

From the app directory:

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

## Windows Notes

- Use PowerShell or Git Bash for running shell scripts
- Replace `./scripts/check.sh` with `bash scripts/check.sh`
- Or convert scripts to `.ps1` PowerShell format
