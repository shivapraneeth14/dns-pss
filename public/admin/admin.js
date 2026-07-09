async function loadTenants() {
  const res = await fetch('/api/tenants');
  const tenants = await res.json();
  const tbody = document.querySelector('#tenant-table tbody');
  tbody.innerHTML = tenants.length
    ? tenants.map(t => `<tr>
      <td><strong>${escapeHtml(t.tenantName)}</strong></td>
      <td><span class="badge badge-${t.status}">${t.status}</span></td>
      <td class="actions">
        <a href="tenant.html?id=${t._id}" class="btn btn-primary btn-sm">View Domains</a>
        <button class="btn btn-danger btn-sm" onclick="deleteTenant('${t._id}')">Delete</button>
      </td>
    </tr>`).join('')
    : '<tr><td colspan="3" class="empty">No tenants yet. Create one above.</td></tr>';
}

async function deleteTenant(id) {
  if (!confirm('Delete this tenant and all its domains?')) return;
  await fetch(`/api/tenants/${id}`, { method: 'DELETE' });
  loadTenants();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.getElementById('create-tenant').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = e.target.tenantName;
  const res = await fetch('/api/tenants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantName: input.value })
  });
  if (res.ok) {
    input.value = '';
    loadTenants();
  } else {
    const data = await res.json();
    document.getElementById('error-msg').textContent = data.error || 'Error creating tenant';
  }
});

loadTenants();
