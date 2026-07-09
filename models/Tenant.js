const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  tenantName: { type: String, required: true, trim: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('Tenant', tenantSchema);
