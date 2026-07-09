const mongoose = require('mongoose');
const crypto = require('crypto');

const domainSchema = new mongoose.Schema({
  domain: { type: String, required: true, unique: true, lowercase: true, trim: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  status: { type: String, enum: ['pending', 'dns_verified', 'active', 'inactive', 'failed'], default: 'pending' },
  verificationToken: { type: String, default: () => crypto.randomUUID() }
}, { timestamps: true });

module.exports = mongoose.model('Domain', domainSchema);
