function parseDomain(domain) {
  if (!domain || typeof domain !== 'string') {
    return { isApex: true, subdomain: null, apexDomain: '' };
  }
  const parts = domain.toLowerCase().trim().split('.');
  if (parts.length <= 2) {
    return { isApex: true, subdomain: null, apexDomain: domain };
  }
  const subdomain = parts[0];
  const apexDomain = parts.slice(1).join('.');
  return { isApex: false, subdomain, apexDomain };
}

module.exports = parseDomain;
