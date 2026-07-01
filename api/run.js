// /api/run — optional real compilation via Judge0 (RapidAPI).
// Reads JUDGE0_RAPIDAPI_KEY from env. Only used when the Judge0 toggle is on
// AND the problem ships a harness. Otherwise the app falls back to /api/judge run mode.

module.exports = async (req, res) => {
  if(req.method !== 'POST'){ res.status(405).json({ error:'POST only' }); return; }
  const key = process.env.JUDGE0_RAPIDAPI_KEY;
  if(!key){ res.status(500).json({ error:'JUDGE0_RAPIDAPI_KEY not set in Vercel env' }); return; }

  let body = req.body;
  if(typeof body === 'string'){ try { body = JSON.parse(body); } catch(_){ body = {}; } }
  const { source = '', stdin = '' } = body || {};

  try {
    const r = await fetch('https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true', {
      method:'POST',
      headers:{
        'content-type':'application/json',
        'X-RapidAPI-Key': key,
        'X-RapidAPI-Host':'judge0-ce.p.rapidapi.com'
      },
      body: JSON.stringify({ source_code: source, language_id: 54 /* C++ (GCC 9.2.0) */, stdin })
    });
    const data = await r.json();
    res.status(200).json({
      stdout: data.stdout || '',
      stderr: data.stderr || '',
      compile_output: data.compile_output || '',
      status: data.status && data.status.description || 'unknown'
    });
  } catch(e){
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
