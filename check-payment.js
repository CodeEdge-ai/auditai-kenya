// api/check-payment.js
// Polls IntaSend for the real-time status of an STK Push invoice.
// Called by the frontend every 3 seconds after STK push is initiated.

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// Simple per-process rate limit: max 60 checks per invoice_id per hour
const checks = new Map();

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const publishableKey = process.env.INTASEND_PUBLISHABLE_KEY;
  const secretKey      = process.env.INTASEND_SECRET_KEY;
  const isTest         = process.env.INTASEND_TEST !== 'false';

  if (!publishableKey || !secretKey) {
    return res.status(500).json({ error: 'Payment service not configured.' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const invoiceId = String(body.invoice_id || '').replace(/[^A-Z0-9a-z\-_]/g, '').slice(0, 50);
  if (!invoiceId) return res.status(400).json({ error: 'Missing invoice_id' });

  // Rate limiting per invoice_id
  const now = Date.now();
  const rec = checks.get(invoiceId) || { count: 0, first: now };
  if (now - rec.first > 60 * 60 * 1000) {
    checks.set(invoiceId, { count: 1, first: now });
  } else {
    rec.count++;
    if (rec.count > 60) {
      return res.status(429).json({ state: 'FAILED', error: 'Too many status checks.' });
    }
    checks.set(invoiceId, rec);
  }

  const baseUrl = isTest
    ? 'https://sandbox.intasend.com'
    : 'https://payment.intasend.com';

  try {
    const upstream = await fetch(`${baseUrl}/api/v1/payment/status/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-IntaSend-Public-API-Key': publishableKey,
        'Authorization': `Bearer ${secretKey}`
      },
      body: JSON.stringify({
        public_key: publishableKey,
        invoice_id: invoiceId
      })
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error('IntaSend status error:', JSON.stringify(data));
      return res.status(502).json({ state: 'FAILED', error: 'Status check failed.' });
    }

    // IntaSend states: PENDING | PROCESSING | COMPLETE | FAILED | RETRY
    const rawState   = (data?.invoice?.state || 'PENDING').toUpperCase();
    const state      = rawState; // PENDING | PROCESSING | COMPLETE | FAILED | RETRY | CANCELLED
    const paid       = state === 'COMPLETE';
    const failReason = data?.invoice?.failed_reason || '';

    return res.status(200).json({ state, paid, failed_reason: failReason });

  } catch (err) {
    console.error('check-payment error:', err);
    return res.status(500).json({ state: 'FAILED', error: 'Status service unavailable.' });
  }
}
