'use strict';

const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateWalletId } = require('../services/fabricService.js'); 

// Utility to determine default org based on roles
function defaultOrg(roles) {
  if (roles.includes('police') || roles.includes('admin2')) return 'Org2';
  return 'Org1';
}

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, roles = ['tourist'], org, phone, walletId: preWalletId } = req.body;

    if (!email || !password) 
      return res.status(400).json({ message: 'email & password required' });

    const existing = await User.findOne({ email });
    if (existing) 
      return res.status(400).json({ message: 'email already exists' });

    const passwordHash = await bcrypt.hash(password, 10);

    // Determine org
    const userOrg = org || defaultOrg(roles);

    let walletId;

    if (roles.includes('tourist')) {
      // Always auto-generate for tourists
      try {
        walletId = await generateWalletId(userOrg, roles);
      } catch (err) {
        console.error('Error generating wallet for tourist:', err);
        return res.status(500).json({ message: 'Failed to generate wallet for tourist' });
      }
    } else {
      // Admin / Police: use pre-generated if provided, otherwise generate
      if (preWalletId) {
        walletId = preWalletId;
      } else {
        try {
          walletId = await generateWalletId(userOrg, roles);
        } catch (err) {
          console.error('Error generating wallet:', err);
          return res.status(500).json({ message: 'Failed to generate wallet' });
        }
      }
    }

    const user = await User.create({ 
      name, 
      email, 
      passwordHash, 
      roles, 
      walletId, 
      org: userOrg, 
      phone 
    });

    const token = jwt.sign(
      { 
        id: user._id, 
        email: user.email, 
        roles: user.roles, 
        walletId: user.walletId, 
        org: user.org 
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({ 
      token, 
      user: { email: user.email, id: user._id, roles: user.roles, org: user.org, walletId: user.walletId } 
    });

  } catch (err) {
    console.log(err);
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'email & password required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, email: user.email, roles: user.roles, walletId: user.walletId, org: user.org }, 
      process.env.JWT_SECRET, 
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({ token, user: { email: user.email, id: user._id, roles: user.roles, org: user.org, walletId: user.walletId } });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    // If you are not blacklisting tokens, just return success
    // Client must delete token locally
    res.json({ success: true, message: "Logged out successfully" });

    // OPTIONAL: If you want to blacklist the token
    // You would push req.token (from middleware) into a blacklist DB or cache
  } catch (err) {
    next(err);
  }
};


