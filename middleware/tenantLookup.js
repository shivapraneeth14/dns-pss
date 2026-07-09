const Domain = require('../models/Domain');
const normalizeDomain = require('../utils/normalizeDomain');

module.exports = async function tenantLookup(req, res, next) {
  const raw = req.headers.host || '';
  const host = raw.split(':')[0];
  const normalized = normalizeDomain(host);

  if (!normalized) return next();

  try {
    const domain = await Domain.findOne({ domain: normalized }).populate('tenantId');
    if (!domain) {
      req.tenantStatus = 'unknown';
      return next();
    }
    const tenantName = domain.tenantId?.tenantName || 'Unknown';

    if (domain.status === 'active' && domain.tenantId && domain.tenantId.status === 'active') {
      req.tenant = domain.tenantId;
      req.tenantStatus = 'active';
    } else if (domain.status === 'dns_verified') {
      req.tenantStatus = 'dns_verified';
      req.tenantName = tenantName;
    } else if (domain.status === 'inactive') {
      req.tenantStatus = 'inactive';
      req.tenantName = tenantName;
    } else if (domain.status === 'pending') {
      req.tenantStatus = 'pending';
      req.tenantName = tenantName;
    } else if (domain.status === 'failed') {
      req.tenantStatus = 'failed';
      req.tenantName = tenantName;
    } else {
      req.tenantStatus = 'unknown';
    }
  } catch (err) {
    req.tenantStatus = 'unknown';
  }
  next();
};
