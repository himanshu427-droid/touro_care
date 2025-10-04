import axios from "axios";
import Storage from '../utils/storage'; // adjust the path
// const API_BASE = "https://00e741d4f06e.ngrok-free.app/api"; // change to your backend URL (or ngrok if testing on phone)
const API_BASE = "http://localhost:4000"; 
// LOGIN
export const loginUser = async (email: string, password: string) => {
  try {
    const response = await axios.post(`${API_BASE}/api/auth/login`, { email, password });
    const token = response.data?.token;
    if (token) {
      await Storage.setItem('token', token); // save securely
    }
    return response.data;
  } catch (err) {
    console.error('Login failed', err);
    throw err;
  }
};

// REGISTER
// api/auth.ts
export const registerUser = async (payload: { name: string; email: string; password: string; phone?: string }) => {
  try {
    const response = await axios.post(`${API_BASE}/api/auth/register`, payload);

    const token = response.data?.token;
    if (token) {
      // Store the token securely
      await Storage.setItem("token", token);
    }

    return response.data;
  } catch (err: any) {
    console.error("Registration failed", err.response?.data || err.message);
    throw err;
  }
};

// GET CURRENT USER
export const getMe = async () => {
  const token = await Storage.getItem('token');
  if (!token) throw new Error('No token found');

  const response = await axios.get(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};