'use strict';
const crypto = require('crypto');
const KycRequest = require('../models/kyc.model');
const User = require('../models/user.model');
const { generateOtp } = require('../services/otpService');
const adhaarDB = require('../config/adhar.json');

// Mask Aadhaar: show only last 4 digits
function maskAadhaar(aadhaarNumber) {
  if (aadhaarNumber.length < 4) return 'XXXX';
  return `XXX-XXX-XXX-${aadhaarNumber.slice(-4)}`;
}

// Compute SHA256 hash for Aadhaar + name + dob
function computeKycHash(aadhaarNumber, name, dob) {
  return crypto.createHash('sha256').update(`${aadhaarNumber}|${name}|${dob}`).digest('hex');
}

// In-memory OTP store for demo
const otpStore = {};

/**
 * Submit KYC
 */
exports.submitKyc = async (req, res, next) => {
  try {
    const user = req.user;
    const { aadhaarNumber, passportNumber, name, dob } = req.body;

    if ((!aadhaarNumber && !passportNumber) || !name || !dob) {
      console.error('Validation failed: Missing Aadhaar/Passport or name/dob');
      return res.status(400).json({
        success: false,
        message: 'aadhaarNumber or passportNumber (with name, dob) required'
      });
    }

    const idNumber = aadhaarNumber || passportNumber;
    const idType = aadhaarNumber ? 'aadhaar' : 'passport';
    const kycHash = computeKycHash(idNumber, name, dob);

    const existingKyc = await KycRequest.findOne({
      touristId: user.walletId,
      kycHash,
      status: { $in: ['approved', 'auto_approved'] }
    });

    if (existingKyc) {
      console.warn(`KYC already verified for ${idType}: ${idNumber}`);
      return res.status(400).json({
        success: false,
        message: `This ${idType} is already verified for you`
      });
    }

    let status = 'pending';
    let autoResult = null;
    let documents = req.files?.map(f => ({
      filename: f.originalname,
      mimetype: f.mimetype,
      url: f.path
    })) || [];

    let record = null;

    if (aadhaarNumber) {
      record = adhaarDB.find(a => a.aadhaarNumber === aadhaarNumber);

      if (!record || record.name !== name || record.dob !== dob) {
        if (!documents.length) {
          console.error('Aadhaar mismatch & no documents provided');
          return res.status(400).json({
            success: false,
            message: 'Proof documents required for manual review'
          });
        }
        autoResult = { reason: 'Aadhaar details mismatch', proofProvided: true };
        await User.findByIdAndUpdate(user._id, { kycStatus: 'manual_review' });
        console.log(`Aadhaar mismatch for ${aadhaarNumber}, sent for manual review.`);
      } else {
        const otp = generateOtp();
        otpStore[kycHash] = {
          otp,
          touristId: user.walletId,
          expires: Date.now() + 5 * 60 * 1000
        };
        await User.findByIdAndUpdate(user._id, { kycStatus: 'pending' });
        console.log(`Demo OTP for ${aadhaarNumber}: ${otp}`);
      }
    } else {
      if (!documents.length) {
        console.error('Passport submitted without proof documents');
        return res.status(400).json({
          success: false,
          message: 'Passport requires proof documents for review'
        });
      }
      autoResult = { reason: 'Passport verification requires manual review', proofProvided: true };
      await User.findByIdAndUpdate(user._id, { kycStatus: 'manual_review' });
    }

    const kycDoc = await KycRequest.create({
      requestId: `KYC-${Date.now()}`,
      touristId: user.walletId,
      userId: user._id,
      payload: {
        idType,
        idNumber: aadhaarNumber ? maskAadhaar(aadhaarNumber) : `PASSPORT-${idNumber}`,
        name,
        dob
      },
      documents,
      kycHash,
      status,
      autoResult,
      createdAt: new Date()
    });

    return res.json({
      success: true,
      message: aadhaarNumber && record && record.name === name && record.dob === dob
        ? 'OTP sent to linked mobile number'
        : 'Details sent for manual review with proof documents',
      requestId: kycDoc.requestId
    });

  } catch (err) {
    console.error('submitKyc error:', err.stack || err);
    next(err);
  }
};

/**
 * Verify OTP
 */
exports.verifyOtpKyc = async (req, res, next) => {
  try {
    const user = req.user;
    const { requestId, otp } = req.body;

    if (!requestId || !otp) {
      console.error('verifyOtpKyc: Missing requestId or otp');
      return res.status(400).json({ success: false, message: 'requestId and otp required' });
    }

    const kycDoc = await KycRequest.findOne({ requestId, touristId: user.walletId });
    if (!kycDoc) {
      console.warn(`KYC request not found: ${requestId}`);
      return res.status(404).json({ success: false, message: 'KYC request not found' });
    }

    const storedOtp = otpStore[kycDoc.kycHash];
    if (!storedOtp || storedOtp.touristId !== user.walletId || Date.now() > storedOtp.expires) {
      console.warn('OTP expired or invalid for:', kycDoc.kycHash);
      return res.status(400).json({ success: false, message: 'OTP expired or invalid' });
    }

    if (storedOtp.otp !== otp) {
      console.warn(`Incorrect OTP entered for: ${kycDoc.kycHash}`);
      return res.status(400).json({ success: false, message: 'Incorrect OTP' });
    }

    kycDoc.status = 'approved';
    kycDoc.updatedAt = new Date();
    await kycDoc.save();

    await User.findByIdAndUpdate(user._id, { kycStatus: 'verified' });
    delete otpStore[kycDoc.kycHash];

    return res.json({ success: true, message: 'KYC verified successfully', requestId });

  } catch (err) {
    console.error('verifyOtpKyc error:', err.stack || err);
    next(err);
  }
};

/**
 * List pending KYC requests
 */
exports.listPending = async (req, res, next) => {
  try {
    const list = await KycRequest.find({ status: 'pending' });
    res.json({ success: true, pending: list });
  } catch (err) {
    console.error('listPending error:', err.stack || err);
    next(err);
  }
};

/**
 * Review KYC manually
 */

exports.review = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { status, comment } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      console.error('Invalid review status:', status);
      return res.status(400).json({ message: 'Invalid status' });
    }

    const kycDoc = await KycRequest.findOne({ requestId });
    if (!kycDoc) {
      console.warn(`KYC request not found for review: ${requestId}`);
      return res.status(404).json({ message: 'KYC request not found' });
    }

    kycDoc.status = status;
    kycDoc.reviewComment = comment || '';
    kycDoc.reviewerId = req.user._id;
    kycDoc.updatedAt = new Date();
    await kycDoc.save();

    if (status === 'approved') {
      await User.findByIdAndUpdate(kycDoc.userId, { kycStatus: 'verified' }, { new: true });
    } else if (status === 'rejected') {
      await User.findByIdAndUpdate(kycDoc.userId, { kycStatus: 'failed' }, { new: true });
    }

    res.json({ success: true, kyc: kycDoc });
  } catch (err) {
    console.error('review error:', err.stack || err);
    next(err);
  }
};

/**
 * Get KYC by touristId
 */
exports.getByTourist = async (req, res, next) => {
  try {
    const { touristId } = req.params;
    const kycs = await KycRequest.find({ touristId }).sort({ createdAt: -1 });
    if (!kycs.length) {
      console.warn(`No KYC found for touristId: ${touristId}`);
      return res.status(404).json({ message: 'KYC not found' });
    }

    res.json({ success: true, kycs });
  } catch (err) {
    console.error('getByTourist error:', err.stack || err);
    next(err);
  }
};
