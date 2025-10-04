'use strict';

const crypto = require('crypto');
const { customAlphabet } = require('nanoid');
const { submitTransaction, evaluateTransaction } = require('../services/fabricService');
const KycRequest = require('../models/kyc.model');
const DigitalId = require('../models/digitalId.model');
const Location = require('../models/location.model');
const SosAlert = require('../models/alert.model');
const Feedback = require('../models/feedback.model');
const EFIR = require('../models/fir.model');
const mlService = require('../services/mlService.js');
const Anomaly = require('../models/anomoly.model');
const NotificationService = require('../services/notificationService');
const User = require('../models/user.model.js');

const nano = customAlphabet('0123456789ABCDEF', 8); // 8-char suffix
const AES_KEY = process.env.AES_256_KEY;
const DEFAULT_ORG = 'org1';
const DEFAULT_IDENTITY = process.env.ORG_ISSUER_ID || 'admin';

// ---------- AES Helpers ----------
function getAesKeyBuffer() {
    if (!AES_KEY) throw new Error('AES_256_KEY env var not set');
    if (/^[0-9a-fA-F]{64}$/.test(AES_KEY)) return Buffer.from(AES_KEY, 'hex');
    return Buffer.from(AES_KEY, 'base64');
}

function encryptObject(obj) {
    const key = getAesKeyBuffer();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const plaintext = Buffer.from(JSON.stringify(obj), 'utf8');
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { iv: iv.toString('hex'), data: encrypted.toString('hex'), tag: tag.toString('hex') };
}

function decryptObject(encryptedObj) {
    const key = getAesKeyBuffer();
    const iv = Buffer.from(encryptedObj.iv, 'hex');
    const encryptedData = Buffer.from(encryptedObj.data, 'hex');
    const tag = Buffer.from(encryptedObj.tag, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
}

function makeItinerarySummary(itinerary = {}) {
    const destinations = Array.isArray(itinerary.destinations)
        ? itinerary.destinations.map(d => ({ location: d.location, startDate: d.startDate, endDate: d.endDate }))
        : [];
    return { destinations };
}

// Retry helper for MVCC conflicts
async function safeSubmit(org, identity, fn, ...args) {
    let attempt = 0;
    while (attempt < 3) {
        try {
            return await submitTransaction(org, identity, fn, ...args);
        } catch (err) {
            if (err.transactionCode === 'MVCC_READ_CONFLICT' || (err.message && err.message.includes('MVCC_READ_CONFLICT'))) {
                attempt++;
                console.warn(`Retrying ${fn} due to MVCC conflict (attempt ${attempt})`);
                await new Promise(r => setTimeout(r, 500 * attempt));
            } else throw err;
        }
    }
    throw new Error(`MVCC conflict after ${attempt} retries`);
}

// ---------- Tourist Registration ----------
exports.registerTourist = async (req, res, next) => {
    try {
        const user = req.user; // Authenticated user
        const { org = DEFAULT_ORG, identity = DEFAULT_IDENTITY, expiryAt, itinerary = {}, emergencyContacts = [], deviceId } = req.body;
        const walletId = user?.walletId;

        if (!walletId || !expiryAt) {
            return res.status(400).json({ success: false, message: 'walletId and expiryAt are required' });
        }

        // Check primary KYC
        const primaryKyc = await KycRequest.findOne({
            touristId: walletId,
            status: { $in: ['approved', 'auto_approved'] }
        }).lean();

        if (!primaryKyc) {
            return res.status(403).json({ success: false, message: 'Primary KYC not approved' });
        }

        const primaryDigitalId = walletId;

        // Check if already registered
        const existingDigitalId = await DigitalId.findOne({ digitalId: primaryDigitalId });
        if (existingDigitalId && existingDigitalId.status !== 'expired') {
            return res.json({
                success: true,
                message: 'Tourist already registered',
                data: { digitalId: primaryDigitalId }
            });
        }

        // Encrypt sensitive data
        const itineraryEnc = encryptObject(itinerary);
        const contactsEnc = encryptObject(emergencyContacts);
        const itinerarySummary = makeItinerarySummary(itinerary);

        // Initial safety score
        const securityScore = await calculateInitialSafetyScore(itinerarySummary);

        // Create digital ID doc
        const digitalIdData = {
            digitalId: primaryDigitalId,
            walletId,
            kycRequestId: primaryKyc._id,
            kycHash: primaryKyc.kycHash,
            itineraryEncrypted: itineraryEnc,
            emergencyContactsEncrypted: contactsEnc,
            itinerarySummary,
            status: 'registered',
            expiryAt: new Date(expiryAt),
            securityScore,
            devices: deviceId ? [{
                deviceId,
                registeredAt: new Date(),
                lastActive: new Date()
            }] : []
        };

        // Register on blockchain - Updated for new smart contract
        const chainRes = await safeSubmit(
            org,
            identity,
            'RegisterTourist',
            primaryDigitalId,
            primaryKyc.kycHash,
            JSON.stringify(itinerarySummary),
            JSON.stringify(emergencyContacts),
            new Date(expiryAt).toISOString()
            
            // JSON.stringify({ securityScore, registeredAt: new Date().toISOString() })
        );

        const parsedChain = JSON.parse(chainRes.toString());
        digitalIdData.chainTx = parsedChain;

        // Save in MongoDB
        const digitalIdDoc = await DigitalId.create(digitalIdData);
        
        // Update user's digitalIdStatus to 'active'
        await User.findByIdAndUpdate(user._id, { digitalIdStatus: 'active' });

        return res.json({
            success: true,
            message: 'Tourist registered successfully',
            data: {
                digitalId: primaryDigitalId,
                expiryAt: digitalIdDoc.expiryAt,
                securityScore: digitalIdDoc.securityScore
            }
        });

    } catch (err) {
        console.error('registerTourist error:', err);
        return next(err);
    }
};



// ---------- Location Update ----------
exports.locationUpdate = async (req, res, next) => {
    try {
          const user = req.user;
          const touristId=user?.walletId;

          
         const {
            org = DEFAULT_ORG,
            identity = DEFAULT_IDENTITY,
            deviceId,
            locations
        } = req.body;

        if (  !Array.isArray(locations) || locations.length !== 1) {
            return res.status(400).json({
                success: false,
                message: 'touristId & exactly 1 location object are required'
            });
        }

        const loc = locations[0];
        const ts = loc.ts ? new Date(loc.ts) : new Date();

        // Save current location
        const locationData = new Location({
            touristId,
            deviceId,
            lat: loc.lat,
            lon: loc.lon,
            speed: loc.speed,
            ts
        });
        await locationData.save();

        // Record location event on blockchain
        const eventId = `LOC_${Date.now()}_${nano()}`;
        const locationEvent = {
            lat: loc.lat,
            lon: loc.lon,
            speed: loc.speed,
            ts: ts.toISOString(),
            deviceId,
            accuracy: loc.accuracy || null
        };

        await safeSubmit(
            org,
            identity,
            'RecordLocation',
            eventId,
            touristId,
            JSON.stringify(locationEvent)
        );

        // Update last known location in digital ID
        await DigitalId.updateOne(
            { digitalId: touristId },
            { 
                $set: { 
                    lastKnownLocation: {
                        lat: loc.lat,
                        lon: loc.lon,
                        timestamp: ts
                    }
                },
                $addToSet: { devices: { deviceId, lastActive: new Date() } }
            }
        );

        // Get last 21 records for anomaly detection
        const recent = await Location.find({ touristId })
            .sort({ ts: -1 })
            .limit(21);

        const seq = recent
            .reverse()
            .map(d => ({
                lat: d.lat,
                lon: d.lon,
                speed: d.speed,
                ts: d.ts
            }));

        const lastPoint = seq.at(-1);

        // Check geofence
        const geofences = await mlService.checkGeofence({
            touristId, 
            lat: lastPoint.lat,
            lon: lastPoint.lon
        });

        let anomaly = null;

        // Run anomaly detection only if we have 21 or more points
        if (seq.length >= 21) {
            const mlResult = await mlService.analyzeSequence(touristId, seq);
            if (mlResult?.isAnomaly) {
                anomaly = {
                    type: 'ANOMALY',
                    score: mlResult.score,
                    ts: new Date()
                };
                
                // Record anomaly on blockchain
                const anomalyEventId = `ANOM_${Date.now()}_${nano()}`;
                await safeSubmit(
                    org,
                    identity,
                    'RecordAnomaly',
                    anomalyEventId,
                    touristId,
                    JSON.stringify({
                        ...anomaly,
                        sequenceLength: seq.length,
                        locations: seq.slice(-5) // Store last 5 locations
                    })
                );

                await Anomaly.create({
                    touristId,
                    details: anomaly,
                    seq
                });

                // Notify authorities about anomaly
                await NotificationService.notifyAuthorities({
                    touristId,
                    type: 'ANOMALY_DETECTED',
                    location: { lat: lastPoint.lat, lon: lastPoint.lon },
                    score: mlResult.score,
                    timestamp: new Date()
                });
            }
        }

        return res.json({
            success: true,
            anomaly,
            geofences
        });

    } catch (err) {
        console.error('locationUpdate error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ---------- SOS Alert ----------
exports.sosAlert = async (req, res, next) => {
    try {
        const touristId = req.user?.walletId;
        const { deviceId, location, message } = req.body;
        
        if (!touristId) {
            return res.status(400).json({ success: false, message: 'touristId is required' });
        }

        // Get tourist details
        const tourist = await DigitalId.findOne({ digitalId: touristId });
        if (!tourist) {
            return res.status(404).json({ success: false, message: 'Tourist not found' });
        }

        // Create SOS alert
        const sosAlert = new SosAlert({
            touristId,
            deviceId,
            location: location || tourist.lastKnownLocation,
            message,
            respondedBy: null,
            responseTime: null
        });
        await sosAlert.save();

        // Record SOS event on blockchain
        const eventId = `SOS_${Date.now()}_${nano()}`;
        const sosEvent = {
            
            alertId: sosAlert._id.toString(),
            location: location || tourist.lastKnownLocation,
            message,
            deviceId,
            ts: new Date().toISOString()
        };

        await safeSubmit(
            DEFAULT_ORG,
            DEFAULT_IDENTITY,
            'RecordSOS',
            eventId,
            touristId,
            JSON.stringify(sosEvent)
        );

        // Notify emergency contacts
        const emergencyContacts = decryptObject(tourist.emergencyContactsEncrypted);
        for (const contact of emergencyContacts) {
            await NotificationService.notifyEmergencyContact(
                contact, 
                touristId, 
                location || tourist.lastKnownLocation,
                message
            );
        }

        // Notify authorities
        await NotificationService.notifyAuthorities({
            touristId,
            type: 'SOS_ALERT',
            location: location || tourist.lastKnownLocation,
            message,
            timestamp: new Date(),
            emergencyContacts
        });

        return res.json({
            success: true,
            message: 'SOS alert triggered successfully',
            alertId: sosAlert._id
        });

    } catch (err) {
        console.error('sosAlert error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ---------- Submit Feedback ----------
exports.submitFeedback = async (req, res, next) => {
    try {
        const touristId = req.user?.walletId;
        const { rating, comments, category } = req.body;
        
        if (!touristId || !rating) {
            return res.status(400).json({ success: false, message: 'touristId and rating are required' });
        }

        const feedback = new Feedback({
            touristId,
            rating,
            comments,
            category,
            status: 'submitted'
        });
        await feedback.save();

        // Record feedback event on blockchain
        const eventId = `FB_${Date.now()}_${nano()}`;
        const feedbackEvent = {
            feedbackId: feedback._id.toString(),
            rating,
            category,
            ts: new Date().toISOString()
        };

        await safeSubmit(
            DEFAULT_ORG,
            DEFAULT_IDENTITY,
            'RecordFeedback',
            eventId,
            touristId,
            JSON.stringify(feedbackEvent)
        );

        return res.json({
            success: true,
            message: 'Feedback submitted successfully',
            feedbackId: feedback._id
        });

    } catch (err) {
        console.error('submitFeedback error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ---------- File e-FIR ----------
exports.fileEFIR = async (req, res, next) => {
  try {
    const touristId = req.user?.walletId;
    const { incidentDetails, location, dateTime } = req.body;
    const evidenceFile = req.file; // optional

    if (!touristId || !incidentDetails) {
      return res.status(400).json({ 
        success: false, 
        message: 'touristId and incidentDetails are required' 
      });
    }

    const dateTimeObj = dateTime ? new Date(dateTime) : new Date();
    if (isNaN(dateTimeObj.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid dateTime format' });
    }

    const efirId = `EFIR_${Date.now()}`;

    const efir = new EFIR({
      touristId,
      efirId,
      incidentDetails,
      location,
      dateTime: dateTimeObj,
      status: 'submitted',
      assignedTo: null,
      resolution: null,
      evidence: evidenceFile ? evidenceFile.path : null // save file path if uploaded
    });

    await efir.save();

    const eventId = `EFIR_${Date.now()}_${nano()}`;
    const efirEvent = {
      efirId: efir.efirId,
      incidentDetails: typeof incidentDetails === 'string' ? incidentDetails : JSON.stringify(incidentDetails),
      location,
      dateTime: dateTimeObj.toISOString(),
      ts: new Date().toISOString(),
      evidence: evidenceFile ? evidenceFile.originalname : null
    };

    await safeSubmit(
      DEFAULT_ORG,
      DEFAULT_IDENTITY,
      'RecordEFIR',
      eventId,
      touristId,
      JSON.stringify(efirEvent)
    );

    return res.json({
      success: true,
      message: 'e-FIR filed successfully',
      efirId: efir.efirId
    });

  } catch (err) {
    console.error('fileEFIR error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ---------- Verify Tourist (for authorities) ----------
exports.verifyTourist = async (req, res, next) => {
    try {
        const { touristId } = req.params;
        const { org = DEFAULT_ORG, identity = DEFAULT_IDENTITY } = req.query;

        if (!touristId) {
            return res.status(400).json({ success: false, message: 'touristId is required' });
        }

        // Check on blockchain
        const result = await evaluateTransaction(org, identity, 'VerifyTourist', touristId);
        let parsed;
        try { 
            parsed = JSON.parse(result.toString()); 
        } catch { 
            parsed = result.toString(); 
        }

        // Get additional details from MongoDB
        const touristDetails = await DigitalId.findOne({ digitalId: touristId });
        
        res.json({ 
            success: true, 
            data: {
                blockchain: parsed,
                additionalInfo: touristDetails ? {
                    securityScore: touristDetails.securityScore,
                    lastKnownLocation: touristDetails.lastKnownLocation,
                    devices: touristDetails.devices
                } : null
            }
        });
    } catch (err) {
        next(err);
    }
};

// ---------- Update Tourist Status (for authorities) ----------
exports.updateTouristStatus = async (req, res, next) => {
    try {
        const { touristId, status, reason, changedBy } = req.body;
        const { org = DEFAULT_ORG, identity = DEFAULT_IDENTITY } = req.query;

        if (!touristId || !status) {
            return res.status(400).json({ success: false, message: 'touristId and status are required' });
        }

        let transactionName;
        let args = [touristId];

        switch (status) {
            case 'suspended':
                transactionName = 'SuspendTourist';
                if (reason) args.push(reason);
                break;
            case 'revoked':
                transactionName = 'RevokeTourist';
                if (reason) args.push(reason);
                break;
            case 'active':
                transactionName = 'ReinstateTourist';
                break;
            default:
                return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        // Update on blockchain
        const result = await safeSubmit(org, identity, transactionName, ...args);
        const parsed = JSON.parse(result.toString());

        // Update in MongoDB
        await DigitalId.updateOne(
            { digitalId: touristId },
            { 
                $set: { status, updatedAt: new Date() },
                $push: {
                    statusHistory: {
                        status,
                        reason: reason || null,
                        changedAt: new Date(),
                        changedBy: changedBy || identity
                    }
                }
            }
        );

        // Update user's digitalIdStatus if status is revoked or suspended
        if (status === 'revoked' || status === 'suspended') {
            await User.findOneAndUpdate(
                { walletId: touristId },
                { digitalIdStatus: 'deactive' }
            );
        } else if (status === 'active') {
            await User.findOneAndUpdate(
                { walletId: touristId },
                { digitalIdStatus: 'active' }
            );
        }

        res.json({ 
            success: true, 
            message: `Tourist status updated to ${status}`,
            data: parsed
        });

    } catch (err) {
        next(err);
    }
};

// ---------- Respond to SOS (for authorities) ----------
exports.respondToSOS = async (req, res, next) => {
    try {
        const { alertId, response, officerId } = req.body;
        
        if (!alertId || !officerId) {
            return res.status(400).json({ success: false, message: 'alertId and officerId are required' });
        }

        const sosAlert = await SosAlert.findById(alertId);
        if (!sosAlert) {
            return res.status(404).json({ success: false, message: 'SOS alert not found' });
        }

        sosAlert.status = 'responded';
        sosAlert.respondedBy = officerId;
        sosAlert.responseTime = new Date() - sosAlert.createdAt;
        sosAlert.responseDetails = response;

        await sosAlert.save();

        // Notify tourist that help is on the way
        await NotificationService.notifyTourist({
            touristId: sosAlert.touristId,
            type: 'SOS_RESPONSE',
            message: `Help is on the way. ${response}`,
            officerId
        });

        return res.json({
            success: true,
            message: 'SOS response recorded successfully',
            responseTime: sosAlert.responseTime
        });

    } catch (err) {
        console.error('respondToSOS error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ---------- Get Tourist Details (for authorities) ----------
exports.getTouristDetails = async (req, res, next) => {
    try {
        const { touristId } = req.params;
        
        if (!touristId) {
            return res.status(400).json({ success: false, message: 'touristId is required' });
        }

        // Get from MongoDB
        const tourist = await DigitalId.findOne({ digitalId: touristId });
        if (!tourist) {
            return res.status(404).json({ success: false, message: 'Tourist not found' });
        }

        // Get from blockchain
        let blockchainData = null;
        try {
            const result = await evaluateTransaction(DEFAULT_ORG, DEFAULT_IDENTITY, 'GetTourist', touristId);
            blockchainData = JSON.parse(result.toString());
        } catch (err) {
            console.warn('Could not fetch blockchain data:', err.message);
        }

        // Get recent events from blockchain
        let recentEvents = [];
        try {
            const query = {
                selector: {
                    touristId: touristId
                },
                sort: [{ createdAt: 'desc' }],
                limit: 10
            };
            const eventsResult = await evaluateTransaction(DEFAULT_ORG, DEFAULT_IDENTITY, 'QueryTourists', JSON.stringify(query));
            recentEvents = JSON.parse(eventsResult.toString());
        } catch (err) {
            console.warn('Could not fetch recent events:', err.message);
        }

        // Get recent locations
        const recentLocations = await Location.find({ touristId })
            .sort({ ts: -1 })
            .limit(10);

        // Get recent alerts
        const recentAlerts = await SosAlert.find({ touristId })
            .sort({ createdAt: -1 })
            .limit(5);

        return res.json({
            success: true,
            data: {
                digitalId: tourist,
                blockchain: blockchainData,
                recentEvents,
                recentLocations,
                recentAlerts
            }
        });

    } catch (err) {
        console.error('getTouristDetails error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ---------- Query Tourists (for authorities) ----------
exports.queryTourists = async (req, res, next) => {
    try {
        const { query, org = DEFAULT_ORG, identity = DEFAULT_IDENTITY } = req.body;

        if (!query) {
            return res.status(400).json({ success: false, message: 'Query is required' });
        }

        // Execute query on blockchain
        const result = await evaluateTransaction(org, identity, 'QueryTourists', JSON.stringify(query));
        const tourists = JSON.parse(result.toString());

        res.json({
            success: true,
            data: tourists,
            count: tourists.length
        });

    } catch (err) {
        console.error('queryTourists error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ---------- Get Tourist History (for authorities) ----------
exports.getTouristHistory = async (req, res, next) => {
    try {
        const { touristId } = req.params;
        const { org = DEFAULT_ORG, identity = DEFAULT_IDENTITY } = req.query;

        if (!touristId) {
            return res.status(400).json({ success: false, message: 'touristId is required' });
        }

        // Get history from blockchain
        const result = await evaluateTransaction(org, identity, 'GetTouristHistory', touristId);
        const history = JSON.parse(result.toString());

        res.json({
            success: true,
            data: history,
            count: history.length
        });

    } catch (err) {
        console.error('getTouristHistory error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ---------- Helper Functions ----------
async function calculateInitialSafetyScore(itinerary) {
    // Implement logic based on:
    // - Risk level of destinations
    // - Time of travel
    // - Duration of stay
    // - Other factors
    return 75; // Default medium score
}


module.exports = exports;