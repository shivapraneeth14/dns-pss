require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const tenantLookup = require('./middleware/tenantLookup');
const tenantRoutes = require('./routes/tenants');
const domainRoutes = require('./routes/domains');

const app = express();

app.use(express.json());

app.use('/api/tenants', tenantRoutes);
app.use('/api/domains', domainRoutes);

// Redirect root to admin, serve admin static files
const adminDir = path.join(__dirname, 'public', 'admin');
app.get('/', (req, res) => res.redirect('/admin/'));
app.get(['/admin', '/admin/*'], (req, res) => {
  let filePath;
  if (req.path === '/admin' || req.path === '/admin/') {
    filePath = path.join(adminDir, 'index.html');
  } else {
    filePath = path.join(__dirname, 'public', req.path.replace(/^\//, ''));
  }
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Not found');
  }
});

app.get('/api/tenant', tenantLookup, (req, res) => {
  if (req.tenant) {
    return res.json({
      tenant: req.tenant.tenantName,
      domain: req.headers.host?.split(':')[0] || '',
      status: 'active'
    });
  }
  const statusMessages = {
    inactive: 'Domain disabled',
    pending: 'Domain pending verification',
    dns_verified: 'Domain DNS verified — awaiting activation',
    failed: 'Domain verification failed'
  };
  res.status(404).json({
    error: statusMessages[req.tenantStatus] || 'No tenant found for this domain'
  });
});

app.use('*', tenantLookup, (req, res) => {
  const domain = req.headers.host?.split(':')[0] || '';

  if (req.tenant) {
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${req.tenant.tenantName}</title>
<style>
  body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f5f5f5}
  .card{background:#fff;padding:3rem;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.1);text-align:center;max-width:500px}
  h1{color:#1a1a2e;margin:0 0 .5rem}.domain{color:#666;font-size:.9rem;margin-bottom:1.5rem}
  .badge{display:inline-block;padding:.25rem .75rem;border-radius:999px;font-size:.8rem;font-weight:600;background:#d4edda;color:#155724}
  .footer{font-size:.75rem;color:#999;margin-top:2rem}
</style></head>
<body><div class="card">
  <h1>Welcome ${req.tenant.tenantName}</h1>
  <p class="domain">${domain}</p>
  <p><span class="badge">Active</span></p>
  <p class="footer">Multi-Tenant POC — Custom Domain Resolution</p>
</div></body></html>`);
  }

  if (req.tenantStatus === 'inactive') {
    return res.status(403).send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Domain Disabled</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f5f5f5}
.card{background:#fff;padding:3rem;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.1);text-align:center}
h1{color:#dc3545;margin:0 0 .5rem}p{color:#666}</style></head>
<body><div class="card">
  <h1>Domain Disabled</h1>
  <p>The domain <strong>${domain}</strong> is currently disabled.</p>
</div></body></html>`);
  }

  if (req.tenantStatus === 'pending') {
    return res.status(403).send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Domain Pending</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f5f5f5}
.card{background:#fff;padding:3rem;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.1);text-align:center}
h1{color:#ffc107;margin:0 0 .5rem}p{color:#666}</style></head>
<body><div class="card">
  <h1>Domain Pending Verification</h1>
  <p>The domain <strong>${domain}</strong> has not been verified yet.</p>
</div></body></html>`);
  }

  if (req.tenantStatus === 'dns_verified') {
    return res.status(403).send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>DNS Verified</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f5f5f5}
.card{background:#fff;padding:3rem;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.1);text-align:center}
h1{color:#17a2b8;margin:0 0 .5rem}p{color:#666}</style></head>
<body><div class="card">
  <h1>DNS Verified</h1>
  <p>The domain <strong>${domain}</strong> is verified. Awaiting activation.</p>
</div></body></html>`);
  }

  if (req.tenantStatus === 'failed') {
    return res.status(403).send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Verification Failed</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f5f5f5}
.card{background:#fff;padding:3rem;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.1);text-align:center}
h1{color:#dc3545;margin:0 0 .5rem}p{color:#666}</style></head>
<body><div class="card">
  <h1>Verification Failed</h1>
  <p>The domain <strong>${domain}</strong> failed DNS verification.</p>
</div></body></html>`);
  }

  res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Unknown Domain</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f5f5f5}
.card{background:#fff;padding:3rem;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.1);text-align:center}
h1{color:#6c757d;margin:0 0 .5rem}p{color:#666}</style></head>
<body><div class="card">
  <h1>Unknown Domain</h1>
  <p>No tenant found for <strong>${domain}</strong>.</p>
</div></body></html>`);
});

module.exports = app;