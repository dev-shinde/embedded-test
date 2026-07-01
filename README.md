# MathWorks Forge — deploy

Single-file dark app + two serverless proxies. Profile lives in `localStorage`.

```
mathworks-forge/
  index.html        # the whole app (CodeMirror via CDN)
  api/judge.js      # LLM judge proxy -> Anthropic (claude-sonnet-4-6), prompt-cached rubric
  api/run.js        # optional Judge0 (g++) proxy for real compilation
```

## Deploy on Vercel (no build step)
1. Push this folder to a GitHub repo (or `vercel` CLI from inside it).
2. Import the repo in Vercel. Framework preset: **Other**. Root = this folder.
3. Project → Settings → **Environment Variables**:
   - `ANTHROPIC_API_KEY` = your key (required — powers ⌕ Evaluate and model-traced ▶ Run).
   - `JUDGE0_RAPIDAPI_KEY` = your RapidAPI key (optional — only if you flip the Judge0 toggle).
4. Deploy. The app calls `/api/judge` automatically; no connect modal, key never hits the browser.

Local test: `vercel dev` (serves `index.html` + functions at `/api/*`).

## How the two actions map
- **▶ Run** — correctness only, *not logged*. Code → `/api/judge` (mode `run`, model-traced) or `/api/run` (g++) when Judge0 is on. Concept → checks your option locally.
- **⌕ Evaluate** — diagnosis, *logged*. Verdict + score + progressive Socratic hint + tags from the closed weakness vocabulary → updates your profile.


## Bank size
141 problems across 14 topics (26 hand-verified coding + 115 concept/MCQ), including a **Linux / Shell Commands** set (28 OA-style questions: permission math, grep/sed/awk, pipes & redirection, signals/processes, output prediction). Linux is woven into Days 7, 8, and 12 and filterable in the bank. Add more by appending to the `PROBLEMS` array.


## Notes
- `localStorage` persists across redeploys. Use **Settings → Export JSON** before big changes.
- To preload an existing bank: open the app's `PROBLEMS` array in `index.html` and append entries (same schema). Code problems need hand-verified `tests`; concept problems need `options` + `answer` + `explain`.
- Judge0 real-compile only runs for problems that carry a `harness` string (wraps your `class Solution` with a `main()`); others fall back to model-traced Run.
