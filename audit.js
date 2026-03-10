// api/audit.js — Vercel serverless function
// Proxies report generation to Anthropic, keeping API key server-side

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

function sanitise(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"'&\/]/g, '').trim().slice(0, 500);
}

function sanitisePayload(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) clean[k] = v.map(sanitise);
    else clean[k] = sanitise(String(v ?? ''));
  }
  return clean;
}

function buildPrompt(d) {
  return `Generate a Kenya DPA compliance audit report for this SME:

Business: ${d.bizName}
Industry: ${d.industry}
Employees: ${d.employees}

AI Tools Used: ${(d.aiTools || []).join(', ')}${d.otherTools ? ', ' + d.otherTools : ''}

Personal Data Fed into AI Tools: ${d.dataTypes && d.dataTypes.length ? d.dataTypes.join(', ') : 'None / Public data only'}
Data Storage Location: ${d.dataStorage}

Privacy Policy Status: ${d.privacyPolicy}
Data Subject Consent Mechanism: ${d.consent}
Internal Staff AI Policy: ${d.staffPolicy}

Prior Compliance History: ${d.priorAudit}
Primary Concern: ${d.mainConcern}
${d.additionalContext ? 'Additional Context: ' + d.additionalContext : ''}

Generate the compliance report JSON as instructed.`;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server misconfiguration' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const data = sanitisePayload(body);

  // Basic required field check
  if (!data.bizName || !data.industry || !data.aiTools) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `You are an expert AI compliance auditor specialising in Kenya's Data Protection Act (DPA) 2019 and AI governance.
You generate structured compliance audit reports for Kenya SMEs.
You MUST respond with ONLY valid JSON, no markdown, no code blocks, no preamble.
The JSON must follow this exact structure:
{
  "overallScore": <number 0-100>,
  "riskLevel": "<high|medium|low>",
  "executiveSummary": "<2-3 sentence plain English summary>",
  "findings": [
    {
      "title": "<finding title>",
      "risk": "<high|medium|low>",
      "description": "<detailed explanation referencing Kenya DPA sections where applicable>"
    }
  ],
  "recommendations": [
    {
      "title": "<action title>",
      "description": "<specific actionable step>",
      "timeline": "<e.g. Within 2 weeks | Within 1 month | Within 3 months>"
    }
  ]
}
Generate 4-6 findings and 5-6 recommendations based on the audit data. Be specific to Kenya law and context. Reference actual DPA 2019 sections (e.g. Section 25, Section 30) where relevant.`,
        messages: [{ role: 'user', content: buildPrompt(data) }]
      })
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      console.error('Anthropic error:', err);
      return res.status(502).json({ error: 'AI service error' });
    }

    const result = await upstream.json();
    const text = (result.content || []).map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();

    let report;
    try {
      report = JSON.parse(clean);
    } catch {
      return res.status(502).json({ error: 'AI returned invalid JSON', raw: clean.slice(0, 200) });
    }

    return res.status(200).json(report);

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
