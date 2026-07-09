const params = new URLSearchParams(window.location.search);
const tenantId = params.get('id');

if (!tenantId) {
  document.body.innerHTML = '<p style="color:red;padding:2rem">Missing tenant ID.</p>';
  throw new Error('No tenant ID');
}

let serverIp = '';
let cnameTarget = '';

const STATUS_ORDER = ['pending', 'dns_verified', 'active', 'inactive', 'failed'];

async function loadTenant() {
  const res = await fetch(`/api/domains/${tenantId}`);
  if (!res.ok) {
    document.body.innerHTML = '<p style="color:red;padding:2rem">Tenant not found.</p>';
    return;
  }
  const data = await res.json();
  serverIp = data.serverIp;
  cnameTarget = data.cnameTarget;
  document.getElementById('tenant-name').textContent = data.tenant.tenantName;

  const tbody = document.querySelector('#domain-table tbody');
  if (!data.domains.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty">No domains added yet.</td></tr>';
    return;
  }
  tbody.innerHTML = data.domains.map(d => `<tr>
    <td><code>${escapeHtml(d.domain)}</code></td>
    <td><span class="badge badge-${d.status}">${formatStatus(d.status)}</span></td>
    <td class="dns-records">
      ${(['pending', 'failed'].includes(d.status)) ? showRecords(d) : d.status === 'dns_verified' ? '<span class="badge badge-dns_verified">DNS Verified ✓</span>' : d.status === 'active' ? '<span class="badge badge-active">Active ✓</span>' : '<span class="badge badge-inactive">—</span>'}
    </td>
    <td class="actions">
      ${d.status === 'pending' ? `
        <button class="btn btn-primary btn-sm" onclick="verifyDns('${d._id}')">Verify DNS</button>
        <button class="btn btn-outline btn-sm" onclick="forceVerify('${d._id}')">Force Verify</button>
      ` : ''}
      ${d.status === 'failed' ? `
        <button class="btn btn-primary btn-sm" onclick="verifyDns('${d._id}')">Retry Verify</button>
        <button class="btn btn-outline btn-sm" onclick="forceVerify('${d._id}')">Force Verify</button>
      ` : ''}
      ${d.status === 'dns_verified' ? `
        <button class="btn btn-success btn-sm" onclick="activate('${d._id}')">Activate</button>
        <button class="btn btn-warning btn-sm" onclick="deactivate('${d._id}')">Deactivate</button>
      ` : ''}
      ${d.status === 'active' ? `
        <button class="btn btn-warning btn-sm" onclick="deactivate('${d._id}')">Deactivate</button>
      ` : ''}
      ${d.status === 'inactive' ? `
        <button class="btn btn-outline btn-sm" onclick="resetToPending('${d._id}')">Reactivate</button>
      ` : ''}
      <button class="btn btn-danger btn-sm" onclick="removeDomain('${d._id}')">Delete</button>
    </td>
  </tr>`).join('');
}

function formatStatus(s) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function showRecords(d) {
  const records = [
    { label: 'TXT', name: escapeHtml(d.txtRecordHost || '_smartdeliver-verify'), value: escapeHtml(d.txtRecordValue), note: 'ownership' }
  ];

  if (d.isApex) {
    records.push(
      { label: 'A', name: '@', value: escapeHtml(serverIp), note: 'root → IP' },
      { label: 'ALIAS', name: '@', value: escapeHtml(cnameTarget), note: 'root → target' }
    );
  } else {
    records.push(
      { label: 'A', name: '@', value: escapeHtml(serverIp), note: 'root → IP' },
      { label: 'CNAME', name: escapeHtml(d.cnameHost || d.subdomain), value: escapeHtml(cnameTarget), note: 'subdomain → target' },
      { label: 'ALIAS', name: '@', value: escapeHtml(cnameTarget), note: 'root → target' }
    );
  }

  return records.map(r => `
    <div class="record">
      <span class="record-label">${r.label}</span>
      <span class="record-name">${r.name}</span>
      <span class="record-arrow">→</span>
      <code class="record-value">${r.value}</code>
      <button class="btn-copy" onclick="copyToClipboard('${r.value}', this)" title="Copy">📋</button>
    </div>
  `).join('');
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text);
  const orig = btn.textContent;
  btn.textContent = '✅';
  setTimeout(() => btn.textContent = orig, 1500);
}

function showMsg(id, text, type) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = type;
  el.style.display = 'block';
}

async function verifyDns(id) {
  showMsg('error-msg', '', 'error');
  showMsg('success-msg', '', 'success');
  document.getElementById('error-msg').style.display = 'none';
  document.getElementById('success-msg').style.display = 'none';

  const res = await fetch(`/api/domains/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'dns_verified' })
  });
  const data = await res.json();
  if (res.ok) {
    showMsg('success-msg', 'DNS verification passed! Click Activate to go live.', 'success');
  } else {
    showMsg('error-msg', data.detail || data.error || 'DNS verification failed.', 'error');
  }
  loadTenant();
}

async function forceVerify(id) {
  const res = await fetch(`/api/domains/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'active', force: true })
  });
  if (res.ok) {
    showMsg('success-msg', 'Domain force-verified and activated!', 'success');
  }
  loadTenant();
}

async function activate(id) {
  showMsg('error-msg', '', 'error');
  showMsg('success-msg', '', 'success');
  document.getElementById('error-msg').style.display = 'none';
  document.getElementById('success-msg').style.display = 'none';

  const res = await fetch(`/api/domains/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'active' })
  });
  const data = await res.json();
  if (res.ok) {
    showMsg('success-msg', 'Domain activated! Traffic is now routing.', 'success');
  } else {
    showMsg('error-msg', data.detail || data.error || 'Activation failed.', 'error');
  }
  loadTenant();
}

async function deactivate(id) {
  const res = await fetch(`/api/domains/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'inactive' })
  });
  if (res.ok) {
    showMsg('success-msg', 'Domain deactivated.', 'success');
  }
  loadTenant();
}

async function resetToPending(id) {
  const res = await fetch(`/api/domains/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'pending' })
  });
  if (res.ok) {
    showMsg('success-msg', 'Domain reset to pending. Re-verify DNS.', 'success');
  }
  loadTenant();
}

async function removeDomain(id) {
  if (!confirm('Delete this domain?')) return;
  await fetch(`/api/domains/${id}`, { method: 'DELETE' });
  loadTenant();
}

function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.getElementById('add-domain').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = e.target.domain;
  const errEl = document.getElementById('error-msg');
  const successEl = document.getElementById('success-msg');
  errEl.style.display = 'none';
  successEl.style.display = 'none';

  const res = await fetch('/api/domains', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain: input.value, tenantId })
  });
  const data = await res.json();
  if (res.ok) {
    input.value = '';
    successEl.textContent = 'Domain added. DNS records generated below.';
    successEl.style.display = 'block';
    loadTenant();
  } else {
    errEl.textContent = data.error || 'Error adding domain.';
    errEl.style.display = 'block';
  }
});

loadTenant();
