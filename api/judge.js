// /api/judge — Vercel serverless function (Node 18+, CommonJS).
// Reads ANTHROPIC_API_KEY from env. Key never reaches the browser.
// Two modes: "evaluate" (diagnose) and "run" (model-traced test grid).

const CLOSED_TAGS = [
  'syntax:nullptr','syntax:top-pop','syntax:iter-deref','syntax:map-access',
  'logic:off-by-one','logic:overflow','logic:wrong-approach','logic:incomplete',
  'edge:bounds','edge:empty','edge:null','complexity:too-slow','concept:misunderstood'
];

// Cached rubric (system prompt). Stays stable across calls so prompt caching hits.
const RUBRIC = `You are the grading judge for "MathWorks Forge", an embedded + SDE interview prep tool.
The candidate targets MathWorks EDG: weight C internals, RTOS, and OS correctness as heavily as DSA.

You operate in one of two MODES, given in the user message.

=== MODE: run ===
Act as a precise C++ interpreter. Compile-and-trace the candidate's code against each provided
test case. Be exact about C++ semantics (integer overflow, iterator invalidation, undefined
behavior, off-by-one). Output STRICT JSON, no markdown, no prose:
{"results":[{"input":"<case as given>","got":"<actual output or runtime/UB note>","expected":"<expected>","pass":<true|false>}], "compileError": <null or "first compile error line">}
If the code does not compile, set compileError and return results as an empty array.

=== MODE: evaluate ===
Diagnose the SUBMISSION (logic, edge cases, complexity, and the candidate's recurring C++ slips).
Give a Socratic, first-principles PROGRESSIVE hint — nudge toward the next insight, never paste a
full solution. Then TAG the submission using ONLY this closed vocabulary (zero or more, exact strings):
${CLOSED_TAGS.join(', ')}.
Tag meanings: syntax:nullptr (NULL/0 vs nullptr), syntax:top-pop (used top()/pop() wrong, pop is void),
syntax:iter-deref (dereferenced find/lower_bound/upper_bound without an end() check),
syntax:map-access (map/unordered_map declaration or access mistake), logic:off-by-one,
logic:overflow (needs long long / mid overflow), logic:wrong-approach, logic:incomplete (stub/partial),
edge:bounds, edge:empty, edge:null, complexity:too-slow (worse than required), concept:misunderstood.
Only tag what is actually present in the code. Output STRICT JSON, no markdown, no prose:
{"verdict":"Correct|Partially correct|Incorrect","score":<0-100>,"hint":"<one progressive Socratic hint>","tags":[<closed tags>],"analysis":"<one sentence>"}
Scoring: 90-100 correct & clean; 60-89 right idea with a slip; 30-59 partial; 0-29 wrong/empty.`;

function extractJSON(text){
  if(!text) return null;
  let t = text.trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if(s !== -1 && e !== -1) t = t.slice(s, e+1);
  try { return JSON.parse(t); } catch(_) { return null; }
}

module.exports = async (req, res) => {
  if(req.method !== 'POST'){ res.status(405).json({ error:'POST only' }); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  if(!key){ res.status(500).json({ error:'ANTHROPIC_API_KEY not set in Vercel env' }); return; }

  let body = req.body;
  if(typeof body === 'string'){ try { body = JSON.parse(body); } catch(_){ body = {}; } }
  const { mode = 'evaluate', problem = {}, code = '' } = body || {};

  const userMsg =
`MODE: ${mode}

PROBLEM
title: ${problem.title}
topic: ${problem.topicName} (${problem.topic})
signature: ${problem.sig}
prompt: ${problem.prompt}
constraints: ${(problem.constraints||[]).join('; ')}
known recurring slips for this topic: ${problem.playbookSlips||'none'}

TEST CASES
${(problem.tests||[]).map((t,i)=>`#${i+1} input: ${t.in}  expected: ${t.out}`).join('\n') || '(none)'}

CANDIDATE SUBMISSION (C++):
\`\`\`cpp
${code}
\`\`\`

Return ONLY the JSON object specified for MODE: ${mode}.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{ 'content-type':'application/json', 'x-api-key':key, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({
        model:'claude-sonnet-4-6',
        max_tokens:1024,
        system:[{ type:'text', text:RUBRIC, cache_control:{ type:'ephemeral' } }],
        messages:[{ role:'user', content:userMsg }]
      })
    });
    const data = await r.json();
    if(data.error){ res.status(502).json({ error: data.error.message || 'anthropic error' }); return; }
    const text = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
    const parsed = extractJSON(text);
    if(!parsed){ res.status(200).json(mode==='run'?{ results:[], compileError:'judge returned unparseable output' }:{ verdict:'Reviewed', score:50, hint:text.slice(0,400), tags:[] }); return; }
    if(parsed.tags) parsed.tags = parsed.tags.filter(t => CLOSED_TAGS.includes(t));
    res.status(200).json(parsed);
  } catch(e){
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
