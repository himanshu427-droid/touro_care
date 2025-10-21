// touristapp/app/api/tourist.ts

import axios from "axios";
import Storage from '../utils/storage';

// Use your machine's local IP address for testing on a physical device.
// For an emulator, 'localhost' or '10.0.2.2' usually works.
const API_BASE = "http://localhost:4000/api/tourist"; // <-- IMPORTANT: Change to your PC's IP address

const touristApi = axios.create({
  baseURL: API_BASE,
});

const authHeaders = async () => {
  const token = await Storage.getItem('token');
  return {
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json"
    }
  };
};

// Function to get dashboard stats
export const getDashboardStats = async () => {
  try {
    const response = await touristApi.get('/stats', await authHeaders());
    return response.data; // Should return { success, data: { ...stats } }
  } catch (error) {
    console.error('Error fetching stats:', error);
    return { success: false, data: {} };
  }
};

// Correct the alerts endpoint
export const getAlerts = async () => {
  try {
    const response = await touristApi.get('/alerts/list', await authHeaders());
    return response.data; // Should return { success, data: [...] }
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return { success: false, data: [] };
  }
};

// Fix the location update payload
export const updateLocation = async (locationData: { lat: number; lon: number; ts: string; deviceId: string; }) => {
  try {
    const payload = {
      locations: [{ lat: locationData.lat, lon: locationData.lon, ts: locationData.ts }],
      deviceId: locationData.deviceId
    };
    const response = await touristApi.post('/location', payload, await authHeaders());
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Location update error:', error);
    return { success: false };
  }
};

// SOS Alert function
export const triggerEmergency = async (data: { location: { lat: number; lon: number; }; message?: string; }) => {
  try {
    const response = await touristApi.post('/sos', data, await authHeaders());
    return response.data;
  } catch (error) {
    console.error('Error triggering emergency:', error);
    throw error; // Re-throw to be handled in the component
  }
};

// This function is for on-chain verification, not for getting all stats.
export const verifyTourist = async (touristId: string) => {
  try {
    const response = await touristApi.get(`/verify/${touristId}`, await authHeaders());
    return response.data;
  } catch (error) {
    console.error('Error verifying tourist:', error);
    return { success: false, message: 'Verification failed' };
  }
};

export const reportIssue = async (data: { incidentDetails: string; location?: { lat: number; lon: number; }; dateTime?: string; }) => {
    // This function seems okay, no changes needed for now.
    // ...
};