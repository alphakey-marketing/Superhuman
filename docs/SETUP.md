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
```

## 4. Run locally
```bash
npm run dev
```
Visit `http://localhost:5173`

## 5. Deploy to Vercel / Netlify
- Add the two env vars above in your deployment dashboard
- Build command: `npm run build`
- Output dir: `dist`

---

## What's in Phase 1
| Feature | Description |
|---------|-------------|
| **Auth** | Email/password login via Supabase |
| **Attention Planner** | Drag-drop daily budget (16h) by category |
| **Pomodoro Timer** | 25/5/15 cycles, task label, distraction logger |
| **Dashboard** | Focus score, allocation pie, 7-day line chart, CSV export |

## Phase 2 (coming next)
- Restoration breaks (nature images + binaural beats)
- Distraction tracker (auto-log app switches)
- Weekly analytics & streaks
