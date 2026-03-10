// api/initiate-payment.js
// Triggers an M-Pesa STK Push via IntaSend.
// The customer gets a PIN prompt on their phone — no manual code entry needed.

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// Sanitise a phone number to IntaSend format: 2547XXXXXXXX
function normalisePhone(raw) {
  let p = String(raw || '').replace(/[\s\-+()]/g, '');
  // Handle 07... → 2547...
  if (p.startsWith('07') || p.startsWith('01')) p = '254' + p.slice(1);
  // Handle +254... already stripped above
  if (p.startsWith('254') && p.length === 12) return p;
  return null;
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const publishableKey = process.env.INTASEND_PUBLISHABLE_KEY;
  const secretKey      = process.env.INTASEND_SECRET_KEY;
  const isTest         = process.env.INTASEND_TEST !== 'false'; // default to sandbox

  if (!publishableKey || !secretKey) {
    return res.status(500).json({ error: 'Payment service not configured. Add INTASEND keys to environment variables.' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const phone = normalisePhone(body.phone);
  if (!phone) {
    return res.status(400).json({ error: 'Invalid phone number. Please use format: 07XX XXX XXX or +2547XX XXX XXX' });
  }

  const email   = String(body.email   || 'customer@auditai.co.ke').slice(0, 200);
  const bizName = String(body.bizName || 'AuditAI Customer').replace(/[<>"'&]/g, '').slice(0, 100);

  const baseUrl = isTest
    ? 'https://sandbox.intasend.com'
    : 'https://payment.intasend.com';

  try {
    const upstream = await fetch(`${baseUrl}/api/v1/payment/collection/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-IntaSend-Public-API-Key': publishableKey,
        'Authorization': `Bearer ${secretKey}`
      },
      body: JSON.stringify({
        public_key:   publishableKey,
        currency:     'KES',
        method:       'M-PESA',
        amount:       10000,
        phone_number: phone,
        email:        email,
        api_ref:      `AUDITAI-${Date.now()}`,
        name:         bizName,
        narrative:    'AuditAI Kenya — AI Compliance Report'
      })
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error('IntaSend STK error:', JSON.stringify(data));
      return res.status(502).json({
        error: data?.details?.[0]?.message || data?.detail || 'Payment initiation failed. Please try again.'
      });
    }

    // Return just what the frontend needs
    return res.status(200).json({
      invoice_id: data?.invoice?.invoice_id || data?.invoice?.id,
      state:      data?.invoice?.state || 'PENDING'
    });

  } catch (err) {
    console.error('initiate-payment error:', err);
    return res.status(500).json({ error: 'Payment service temporarily unavailable.' });
  }
}
