const { Router } = require('express');
const Tenant = require('../models/Tenant');

const router = Router();

router.get('/', async (req, res) => {
  const tenants = await Tenant.find().sort({ createdAt: -1 });
  res.json(tenants);
});

router.post('/', async (req, res) => {
  const { tenantName } = req.body;
  if (!tenantName || !tenantName.trim()) {
    return res.status(400).json({ error: 'tenantName is required' });
  }
  const tenant = await Tenant.create({ tenantName: tenantName.trim() });
  res.status(201).json(tenant);
});

router.delete('/:id', async (req, res) => {
  const tenant = await Tenant.findByIdAndDelete(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  await require('../models/Domain').deleteMany({ tenantId: req.params.id });
  res.json({ message: 'Deleted' });
});

module.exports = router;
