// api/kyc.ts
import axios from "axios";

const API_BASE =
  // process.env.EXPO_PUBLIC_API_URL?.concat("/api/kyc") ||
  // "https://3f45c820ded9.ngrok-free.app/api/kyc";
  "http://localhost:4000/api/kyc"

// Create instance
const kycApi = axios.create({
  baseURL: API_BASE,
});

// Helper for auth headers
const authHeaders = (token?: string) => ({
  Authorization: token ? `Bearer ${token}` : "",
});

// ------------------ Submit KYC ------------------
export const submitKyc = async (data: any, token: any) => {
  const formData = new FormData();

  // Required fields
  if (data.name) formData.append("name", data.name);
  if (data.dob) formData.append("dob", data.dob);
  if (data.nationality) formData.append("nationality", data.nationality);
  if (data.aadhaarNumber) formData.append("aadhaarNumber", data.aadhaarNumber);
  if (data.passportNumber) formData.append("passportNumber", data.passportNumber);

  // Append uploaded files
  if (data.documents && data.documents.length > 0) {
    data.documents.forEach((doc: any) => {
      if (doc.uri) {
        const uriParts = doc.uri.split("/");
        const fileName = uriParts[uriParts.length - 1];
        formData.append("documents", {
          uri: doc.uri,
          name: fileName,
          type: doc.type === "photo" ? "image/jpeg" : "application/pdf",
        } as any);
      }
    });
  }

  const res = await kycApi.post("/submit", formData, {
    headers: {
      ...authHeaders(token),
      "Content-Type": "multipart/form-data",
    },
  });

  return res.data;
};

// ------------------ Verify OTP ------------------
export const verifyOtpKyc = async (
  data: { otp: string; requestId: string },
  token: string
) => {
  const res = await kycApi.post("/verify-otp", data, {
    headers: authHeaders(token),
  });
  return res.data;
};

// ------------------ Get KYC by Tourist ------------------
export const getKycByTourist = async (touristId: string, token: string) => {
  const res = await kycApi.get(`/tourist/${touristId}`, {
    headers: authHeaders(token),
  });
  return res.data;
};

// ------------------ Review KYC ------------------
export const reviewKyc = async (
  requestId: string,
  data: { status: "approved" | "rejected"; comment?: string },
  token: string
) => {
  const res = await kycApi.post(`/review/${requestId}`, data, {
    headers: authHeaders(token),
  });
  return res.data;
};

export default {
  submitKyc,
  verifyOtpKyc,
  getKycByTourist,
  reviewKyc,
};
