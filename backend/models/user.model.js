'use strict';
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, unique: true, required: true, index: true },
  passwordHash: { type: String }, 
  roles: { type: [String], default: ['tourist'] }, // tourist, issuer, police, admin, tourism
  walletId: { type: String },
  org: { type: String, enum: ['org1','org2'], default: 'org1' },
  phone: { type: String },

  // Quick frontend status fields
  kycStatus: { 
    type: String, 
    enum: ['not_started', 'pending', 'manual_review', 'verified', 'failed'], 
    default: 'not_started' 
  },
  digitalIdStatus: { 
    type: String, 
    enum: ['not_generated', 'active','deactive'], 
    default: 'not_generated' 

  },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);

