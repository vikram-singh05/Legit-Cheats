# LEGIT - Autonomous Process Interceptor Web Portal

Modern web portal and administration dashboard for LEGIT, built with React, Vite, Framer Motion, and Supabase.

## Tech Stack

- **Framework**: React 19 + Vite
- **Styling**: Vanilla CSS (Cyberpunk / High-Tech Glassmorphism Design System)
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Backend / Auth**: Supabase

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local` and add your Supabase credentials:
```bash
cp .env.example .env.local
```

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```
