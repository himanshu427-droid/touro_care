'use strict';

// --- Imports ---
const { submitTransaction, evaluateTransaction } = require('../services/fabricService');
const DigitalId = require('../models/digitalId.model');
const Location = require('../models/location.model');
const SosAlert = require('../models/alert.model.js');
const mlService = require('../services/mlService.js');
const User = require('../models/user.model.js');
const KycRequest = require('../models/kyc.model.js');
const { encryptObject, decryptObject } = require('../utils/hash');
const { customAlphabet } = require('nanoid');
const nano = customAlphabet('1234567890abcdef', 10);

const DEFAULT_ORG = 'org1';
const DEFAULT_IDENTITY = process.env.ORG_ISSUER_ID || 'admin';

// --- Helper Functions ---

/**
 * @description Creates a non-sensitive summary of the itinerary for the blockchain.
 * This was the key missing function causing your "days remaining" issue.
 */
function makeItinerarySummary(itinerary) {
    if (!itinerary || !Array.isArray(itinerary.destinations) || itinerary.destinations.length === 0) {
        return { destinations: [] };
    }
    return {
        destinations: itinerary.destinations.map(dest => ({
            country: dest.country,
            city: dest.city,
            startDate: dest.startDate,
            endDate: dest.endDate,
        })),
    };
}

/**
 * @description A wrapper for submitting blockchain transactions to handle errors.
 */
async function safeSubmit(org, identity, transactionName, ...args) {
    try {
        const result = await submitTransaction(org, identity, transactionName, ...args);
        return result;
    } catch (error) {
        console.error(`Blockchain transaction ${transactionName} failed:`, error.message);
        throw new Error(`Blockchain transaction failed: ${error.message}`);
    }
}

/**
 * @description Calculates a basic safety score. Can be expanded later.
 */
async function calculateInitialSafetyScore(itinerary) {
    // For now, a default score. This could be enhanced based on trip destinations.
    return 75;
}


// ---------- Main Controller Functions ----------

/**
 * @description Registers a new tourist trip or updates an existing one.
 */
exports.registerTourist = async (req, res, next) => {
    try {
        const user = req.user;
        const { org = DEFAULT_ORG, identity = DEFAULT_IDENTITY, expiryAt, itinerary = {}, emergencyContacts = [], deviceId } = req.body;
        const walletId = user?.walletId;

        if (!walletId || !expiryAt) {
            return res.status(400).json({ success: false, message: 'walletId and expiryAt are required' });
        }

        const primaryKyc = await KycRequest.findOne({ touristId: walletId, status: { $in: ['approved', 'auto_approved'] } }).lean();
        if (!primaryKyc) {
            return res.status(403).json({ success: false, message: 'Primary KYC for this tourist is not approved' });
        }

        const itinerarySummary = makeItinerarySummary(itinerary);
        const securityScore = await calculateInitialSafetyScore(itinerarySummary);
        const existingDigitalId = await DigitalId.findOne({ walletId: walletId });

        if (existingDigitalId) {
            // --- UPDATE LOGIC for existing trip ---
            existingDigitalId.itineraryEncrypted = encryptObject(itinerary);
            existingDigitalId.emergencyContactsEncrypted = encryptObject(emergencyContacts);
            existingDigitalId.itinerarySummary = itinerarySummary;
            existingDigitalId.expiryAt = new Date(expiryAt);
            existingDigitalId.securityScore = securityScore;
            if (deviceId) existingDigitalId.devices.addToSet({ deviceId, registeredAt: new Date(), lastActive: new Date() });
            await existingDigitalId.save();

            await safeSubmit(org, identity, 'UpdateTripDetails', walletId, JSON.stringify(itinerarySummary), JSON.stringify(emergencyContacts), new Date(expiryAt).toISOString());
            return res.json({ success: true, message: 'Trip details updated successfully', data: { digitalId: walletId } });
        }

        // --- CREATE LOGIC for new trip ---
        const digitalIdData = {
            digitalId: walletId, walletId, kycRequestId: primaryKyc._id, kycHash: primaryKyc.kycHash,
            itineraryEncrypted: encryptObject(itinerary),
            emergencyContactsEncrypted: encryptObject(emergencyContacts),
            itinerarySummary, status: 'registered', expiryAt: new Date(expiryAt), securityScore,
            devices: deviceId ? [{ deviceId, registeredAt: new Date(), lastActive: new Date() }] : []
        };

        const chainRes = await safeSubmit(org, identity, 'RegisterTourist', walletId, primaryKyc.kycHash, JSON.stringify(itinerarySummary), JSON.stringify(emergencyContacts), new Date(expiryAt).toISOString());
        digitalIdData.chainTx = JSON.parse(chainRes.toString());
        await DigitalId.create(digitalIdData);
        await User.findByIdAndUpdate(user._id, { digitalIdStatus: 'active' });

        return res.json({ success: true, message: 'Tourist registered successfully', data: { digitalId: walletId } });

    } catch (err) {
        console.error('registerTourist error:', err);
        return next(err);
    }
};

/**
 * @description Verifies a tourist's ID, combining blockchain and database info.
 */
exports.verifyTourist = async (req, res, next) => {
    try {
        const { touristId } = req.params;
        if (!touristId) return res.status(400).json({ success: false, message: 'touristId is required' });

        const [chainResult, mongoResult] = await Promise.all([
            evaluateTransaction(DEFAULT_ORG, DEFAULT_IDENTITY, 'VerifyTourist', touristId).catch(() => null),
            DigitalId.findOne({ digitalId: touristId }).lean().catch(() => null)
        ]);

        if (!mongoResult) return res.status(404).json({ success: false, message: 'Tourist not found in the central database.' });

        res.json({
            success: true,
            data: {
                blockchain: chainResult ? JSON.parse(chainResult.toString()) : { error: "Could not retrieve blockchain data." },
                additionalInfo: {
                    securityScore: mongoResult.securityScore,
                    lastKnownLocation: mongoResult.lastKnownLocation,
                    kycStatus: mongoResult.status === 'registered' ? 'verified' : mongoResult.status,
                    fullItinerary: decryptObject(mongoResult.itineraryEncrypted),
                    emergencyContacts: decryptObject(mongoResult.emergencyContactsEncrypted)
                }
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @description Receives and processes location updates from a tourist.
 */
exports.locationUpdate = async (req, res, next) => {
    try {
        const { locations, deviceId } = req.body;
        const touristId = req.user.walletId;
        if (!locations || !Array.isArray(locations) || locations.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid location data provided.' });
        }

        const latestLoc = locations[locations.length - 1];
        const locationDoc = new Location({ touristId, deviceId, coordinates: [latestLoc.lon, latestLoc.lat], timestamp: new Date(latestLoc.ts) });
        await locationDoc.save();

        await DigitalId.findOneAndUpdate({ walletId: touristId }, {
            $set: { lastKnownLocation: locationDoc._id, 'devices.$[elem].lastActive': new Date() },
            $inc: { locationChecks: 1 }
        }, { arrayFilters: [{ 'elem.deviceId': deviceId }] });

        // Asynchronously check for geofence/anomaly without blocking the response
        mlService.checkGeofence({ touristId, lat: latestLoc.lat, lon: latestLoc.lon }).catch(err => console.error("ML Service check failed:", err));

        res.json({ success: true, message: 'Location received' });
    } catch (err) {
        next(err);
    }
};

/**
 * @description Initiates an SOS alert.
 */
exports.sosAlert = async (req, res, next) => {
    try {
        const { location, message } = req.body;
        const touristId = req.user.walletId;
        const newAlert = new SosAlert({
            touristId,
            location: { type: 'Point', coordinates: [location.lon, location.lat] },
            message: message || 'Emergency SOS initiated!',
            severity: 'danger', status: 'active'
        });
        await newAlert.save();
        res.status(201).json({ success: true, message: 'SOS alert initiated.', alertId: newAlert._id });
    } catch (error) {
        next(error);
    }
};

/**
 * @description Gets dashboard statistics for the logged-in tourist.
 */
exports.getTouristStats = async (req, res, next) => {
    try {
        const touristId = req.user.walletId;
        const digitalId = await DigitalId.findOne({ walletId: touristId }).lean();
        if (!digitalId || !digitalId.itinerarySummary) {
            return res.status(404).json({ success: false, message: 'No trip details found.' });
        }

        const itinerary = digitalId.itinerarySummary?.destinations || [];
        let daysRemaining = 0;
        if (itinerary.length > 0) {
            const endDates = itinerary.map(d => new Date(d.endDate).getTime());
            const lastEndDate = new Date(Math.max(...endDates));
            daysRemaining = Math.ceil((lastEndDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        }

        res.json({
            success: true,
            data: {
                daysRemaining: Math.max(0, daysRemaining),
                placesVisited: itinerary.length,
                safetyChecks: digitalId.locationChecks || 0,
                emergencyContacts: (decryptObject(digitalId.emergencyContactsEncrypted) || []).length,
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @description Gets a list of alerts for the logged-in tourist.
 */
exports.getAlerts = async (req, res, next) => {
    try {
        const touristId = req.user.walletId;
        const alerts = await SosAlert.find({ touristId }).sort({ createdAt: -1 }).limit(15).lean();
        res.json({ success: true, data: alerts });
    } catch (error) {
        next(error);
    }
};

// --- Other Functions (Placeholder for your existing code) ---
exports.submitFeedback = async (req, res, next) => { res.json({ success: true, message: "Feedback submitted (Not Implemented)" }); };
exports.fileEFIR = async (req, res, next) => { res.json({ success: true, message: "e-FIR filed (Not Implemented)" }); };
exports.getTouristDetails = async (req, res, next) => { res.json({ success: true, message: "Details fetched (Not Implemented)" }); };
exports.updateTouristStatus = async (req, res, next) => { res.json({ success: true, message: "Status updated (Not Implemented)" }); };
exports.respondToSOS = async (req, res, next) => { res.json({ success: true, message: "SOS responded (Not Implemented)" }); };

module.exports = exports;