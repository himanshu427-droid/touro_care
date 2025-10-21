'use strict';
const axios = require('axios');
const logger = require('../utils/logger'); // Assuming you have a logger

const ML_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8080';
const TIMEOUT = parseInt(process.env.ML_TIMEOUT_MS || '5000', 10);

async function analyzeSequence(touristId, seq) {
  try {
    const latitudes = seq.map(d => d.lat);
    const longitudes = seq.map(d => d.lon);
    const timestamps = seq.map(d => d.ts);

    const resp = await axios.post(
      `${ML_URL}/predict/anomaly`,
      { latitudes, longitudes, timestamps },
      { timeout: TIMEOUT }
    );

    const response = resp.data;
    console.log("ML raw response:", JSON.stringify(response, null, 2));

    if (response.success && response.anomaly_score !== undefined) {
      return {
        success: true,
        isAnomaly: resp.data.isAnomaly,
        score: resp.data.anomaly_score
      };
    } 
  } catch (err) {
    logger.error(`ML service (analyzeSequence) error: ${err.message}`);
    // Return a safe default instead of crashing
    return { success: false, isAnomaly: false, score: 0 };
  }
}

async function checkGeofence(data) {
    try {
        const resp = await axios.post(`${ML_URL}/ingest/ping`, data, { timeout: TIMEOUT });
        return resp.data.actions || [];
    } catch(err) {
        logger.error(`ML service (checkGeofence) error: ${err.message}`);
        // Return a safe default
        return [];
    }
}

module.exports = { analyzeSequence, checkGeofence };
