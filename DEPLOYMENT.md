# AuditAI Kenya — Vercel Deployment Guide

## Project Structure

```
auditai/
├── public/
│   └── index.html        ← Full frontend (landing, form, payment, report)
├── api/
│   ├── audit.js          ← Serverless: generates compliance report via Claude
│   └── verify.js         ← Serverless: verifies M-Pesa transaction codes
├── vercel.json           ← Routing + security headers config
├── package.json          ← Project metadata
└── .env.example          ← Environment variables template
```

---

## Prerequisites

- A free account at vercel.com
- A free account at github.com
- Your Anthropic API key from console.anthropic.com
- Git installed on your computer (or use GitHub web upload)

---

## Step 1 — Update Your M-Pesa Details

Open `public/index.html` and find the CONFIG block near the bottom (inside `<script>`):

```js
const CONFIG = {
  mpesaNumber: '0712 345 678',   // ← Replace with YOUR M-Pesa number
  mpesaName:   'AuditAI Kenya',  // ← Replace with YOUR name as on M-Pesa
  maxPayAttempts: 3
};
```

Save the file.

---

## Step 2 — Push to GitHub

### Option A: GitHub Desktop (easiest)
1. Download GitHub Desktop from desktop.github.com
2. File → New Repository → name it `auditai-kenya`
3. Drag the entire `auditai` folder contents into the repo folder
4. Click "Commit to main" → "Push origin"

### Option B: Command Line
```bash
cd auditai
git init
git add .
git commit -m "Initial deploy"
gh repo create auditai-kenya --public --push --source=.
```

### Option C: GitHub Web Upload
1. Go to github.com → New repository → name: `auditai-kenya`
2. Click "uploading an existing file"
3. Drag all files/folders in — maintain the folder structure
4. Click "Commit changes"

---

## Step 3 — Deploy on Vercel

1. Go to vercel.com and sign in with your GitHub account
2. Click **"Add New → Project"**
3. Find and select your `auditai-kenya` repository → click **"Import"**
4. Vercel will auto-detect the settings — **do not change anything**
5. Click **"Deploy"** — wait ~60 seconds

Your site is now live at: `https://auditai-kenya.vercel.app`

---

## Step 4 — Add Environment Variables (CRITICAL)

Without this step, the AI features will not work.

1. In Vercel dashboard → click your project → **Settings → Environment Variables**
2. Add these one at a time:

| Variable Name       | Value                          |
|---------------------|--------------------------------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` (your full key)   |
| `MPESA_NAME`        | Your name as registered on M-Pesa |
| `ALLOWED_ORIGIN`    | `*` (or your custom domain later) |

3. Click **"Save"** after each one
4. Go to **Deployments** → click the three dots on the latest deploy → **"Redeploy"**

---

## Step 5 — Test Everything

Open your Vercel URL and test this exact flow:

- [ ] Landing page loads correctly
- [ ] "Start Your Free Audit" button works
- [ ] Step 1: fill in all fields → Continue works
- [ ] Step 2: select AI tools → checkboxes highlight → Continue works
- [ ] Step 3: select data types → select storage → Continue works
- [ ] Step 4: select all three radio questions → Continue works
- [ ] Step 5: select concern + prior audit → "Generate My Report" goes to Payment screen
- [ ] Payment screen shows your M-Pesa number and name correctly
- [ ] Enter a test code like `QK4X8Y2M1N` → AI verifies → loading screen appears
- [ ] Report generates and renders with findings + recommendations
- [ ] Print / Save PDF button works
- [ ] "New Audit" resets everything and returns to Step 1

---

## Step 6 — Add a Custom Domain (Optional)

1. Buy a domain at Namecheap, Google Domains, or Kenya's KENIC (`.co.ke`)
   - Suggested: `auditai.co.ke` or `auditaikenya.com`
2. Vercel dashboard → Settings → Domains → Add your domain
3. Copy the DNS records Vercel gives you
4. Paste them into your domain registrar's DNS settings
5. Wait 10–30 minutes for propagation

---

## Step 7 — Lock Down to Your Domain (Optional but Recommended)

Once you have a custom domain, update the `ALLOWED_ORIGIN` environment variable:

```
ALLOWED_ORIGIN = https://auditai.co.ke
```

This prevents anyone else from calling your API routes.

---

## Ongoing: How Payments Work

1. Customer fills audit form → lands on payment screen
2. Customer pays KES 10,000 to your M-Pesa number
3. M-Pesa sends customer an SMS with a transaction code (e.g. `QK4X8Y2M1N`)
4. Customer enters that code on the payment screen
5. Claude AI verifies the code format → unlocks the report
6. Report generates via Claude → customer downloads/prints it
7. You receive the KES 10,000 directly in your M-Pesa — no intermediary

**Note:** The AI verifies code format, not the actual M-Pesa API. For full payment verification, upgrade to Safaricom Daraja API integration (Phase 2).

---

## Troubleshooting

**Report says "AI service error"**
→ Check your `ANTHROPIC_API_KEY` in Vercel environment variables. Make sure there are no spaces.

**Payment screen shows "Loading…" for M-Pesa details**
→ You need to update the CONFIG block in `public/index.html` with your actual details.

**Functions return 500 errors**
→ Check Vercel dashboard → Functions tab → view logs for the specific error.

**Custom domain not working**
→ DNS changes take up to 48 hours. Check propagation at dnschecker.org.

---

## Cost Estimate

| Service | Cost |
|---------|------|
| Vercel Hosting | Free (Hobby plan covers this entirely) |
| Anthropic API (Claude) | ~$0.015 per audit report generated |
| Domain (.co.ke) | ~KES 1,500/year |
| **Total per audit sold** | ~KES 15 in API costs, KES 10,000 revenue |

**Margin: ~99.85% per report.**
