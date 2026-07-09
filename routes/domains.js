const { Router } = require('express');
const crypto = require('crypto');
const dns = require('node:dns/promises');
const Domain = require('../models/Domain');
const Tenant = require('../models/Tenant');
const normalizeDomain = require('../utils/normalizeDomain');
const parseDomain = require('../utils/parseDomain');

const router = Router();

const validStatuses = ['pending', 'dns_verified', 'active', 'inactive', 'failed'];

router.get('/:tenantId', async (req, res) => {
  const tenant = await Tenant.findById(req.params.tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  let domains = await Domain.find({ tenantId: req.params.tenantId }).sort({ createdAt: -1 });

  for (const d of domains) {
    if (!d.verificationToken) {
      d.verificationToken = crypto.randomUUID();
      await d.save();
    }
  }

  const prefix = process.env.VERIFICATION_PREFIX || 'smartdeliver-verification';
  const serverIp = process.env.SERVER_IP || '';
  const cnameTarget = process.env.CNAME_TARGET || '';

  const enriched = domains.map(d => {
    const parsed = parseDomain(d.domain);
    const txtHost = parsed.isApex
      ? '_smartdeliver-verify'
      : `_smartdeliver-verify.${parsed.subdomain}`;
    return {
      ...d.toObject(),
      isApex: parsed.isApex,
      subdomain: parsed.subdomain,
      apexDomain: parsed.apexDomain,
      txtRecordHost: txtHost,
      txtRecordName: '_smartdeliver-verify',
      txtRecordValue: `${prefix}=${d.verificationToken}`,
      cnameHost: parsed.subdomain || ''
    };
  });

  res.json({
    tenant: { _id: tenant._id, tenantName: tenant.tenantName },
    serverIp,
    cnameTarget,
    domains: enriched
  });
});

router.post('/', async (req, res) => {
  const { domain, tenantId } = req.body;
  if (!domain || !domain.trim()) {
    return res.status(400).json({ error: 'domain is required' });
  }
  if (!tenantId) {
    return res.status(400).json({ error: 'tenantId is required' });
  }
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    return res.status(400).json({ error: 'Invalid tenant' });
  }
  const normalized = normalizeDomain(domain);
  const exists = await Domain.findOne({ domain: normalized });
  if (exists) {
    return res.status(409).json({ error: 'Domain already assigned to a tenant' });
  }
  const doc = await Domain.create({ domain: normalized, tenantId });
  res.status(201).json(doc);
});

router.patch('/:id', async (req, res) => {
  const { status, force } = req.body;
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  const doc = await Domain.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Domain not found' });

  const prefix = process.env.VERIFICATION_PREFIX || 'smartdeliver-verification';
  const serverIp = process.env.SERVER_IP || '';
  const cnameTarget = process.env.CNAME_TARGET || '';

  if (status === 'dns_verified' && !force) {
    const parsed = parseDomain(doc.domain);
    const expectedTxt = `${prefix}=${doc.verificationToken}`;
    const txtFqdn = `_smartdeliver-verify.${doc.domain}`;
    const errors = [];

    let txtRecords;
    try {
      txtRecords = await dns.resolveTxt(txtFqdn);
    } catch {
      errors.push(`No TXT record found at ${txtFqdn}. Add a TXT record with value "${expectedTxt}" at your DNS provider.`);
    }

    if (txtRecords) {
      const txtValues = txtRecords.flat().map(s => s.replace(/"/g, '').trim());
      if (!txtValues.includes(expectedTxt)) {
        errors.push(`TXT record at ${txtFqdn} does not match. Expected: "${expectedTxt}". Found: ${txtValues.join(', ')}`);
      }
    }

    if (parsed.isApex) {
      let aRecords;
      try {
        aRecords = await dns.resolve4(parsed.apexDomain);
      } catch {
        errors.push(`No A record found for ${parsed.apexDomain}. Add an A record pointing to ${serverIp}.`);
      }
      if (aRecords && !aRecords.includes(serverIp)) {
        errors.push(`A record for ${parsed.apexDomain} points to ${aRecords.join(', ')}, expected ${serverIp}.`);
      }
    } else {
      const cnameFqdn = `${parsed.subdomain}.${parsed.apexDomain}`;
      let cnameRecords;
      try {
        cnameRecords = await dns.resolveCname(cnameFqdn);
      } catch {
        errors.push(`No CNAME record found at ${cnameFqdn}. Add a CNAME record pointing to ${cnameTarget}.`);
      }
      if (cnameRecords && !cnameRecords.includes(cnameTarget)) {
        errors.push(`CNAME record at ${cnameFqdn} points to ${cnameRecords.join(', ')}, expected ${cnameTarget}.`);
      }
    }

    if (errors.length) {
      doc.status = 'failed';
      doc.lastVerificationError = errors.join(' ');
      await doc.save();
      return res.status(400).json({
        error: 'DNS verification failed',
        detail: errors.join('\n'),
        domainStatus: 'failed'
      });
    }

    doc.status = 'dns_verified';
    doc.lastVerificationError = undefined;
    await doc.save();
    return res.json(doc);
  }

  if (status === 'active' && !force) {
    if (doc.status !== 'dns_verified') {
      return res.status(400).json({
        error: 'Cannot activate',
        detail: 'Domain must be DNS verified before activation. Current status: ' + doc.status
      });
    }
    doc.status = 'active';
    await doc.save();
    return res.json(doc);
  }

  doc.status = status;
  await doc.save();
  res.json(doc);
});

router.delete('/:id', async (req, res) => {
  const doc = await Domain.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Domain not found' });
  res.json({ message: 'Deleted' });
});

module.exports = router;
