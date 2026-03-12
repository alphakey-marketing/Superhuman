# AttentionOS — Phase 1 Setup

## 1. Install dependencies
```bash
npm install
```

## 2. Create Supabase project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Open the **SQL Editor** and run the contents of `docs/supabase_schema.sql`
3. Go to **Project Settings → API** and copy:
   - Project URL
   - Anon/public key

## 3. Set environment variables
Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# UAT / Production toggle
# true  = short timer durations (10s / 5s / 8s) for testing
# false = real durations (25min / 5min / 15min) for production
VITE_UAT_MODE=true
```

## 4. Run locally
```bash
npm run dev
```
Visit `http://localhost:5173`

> A yellow **⚡ UAT MODE** banner appears at the top when `VITE_UAT_MODE=true`.
> Remove or set to `false` before going live.

## 5. Switch to Production mode
In `.env.local`, change:
```env
VITE_UAT_MODE=false
```
Then restart the dev server (`Ctrl+C` → `npm run dev`).

## 6. Deploy to Vercel / Netlify
- Add env vars in your deployment dashboard:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_UAT_MODE=false` ← always false in production
- Build command: `npm run build`
- Output dir: `dist`

---

## Features in Phase 1
| Feature | Description |
|---------|-------------|
| **Auth** | Email/password login via Supabase |
| **Attention Planner** | Drag-drop daily budget (16h) by category |
| **Pomodoro Timer** | 25/5/15 cycles, task label, distraction logger |
| **Dashboard** | Focus score, allocation pie, 7-day line chart, CSV export |
| **UAT Mode** | Short timer durations for testing via env flag |

## Phase 2 (coming next)
- Restoration breaks (nature images + binaural beats)
- Distraction tracker (auto-log app switches)
- Weekly analytics & streaks
