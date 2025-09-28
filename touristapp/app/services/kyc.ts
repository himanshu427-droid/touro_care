import axios from 'axios';
import Storage from '../utils/storage';

const API_BASE = 'http://localhost:4000/api'; // Update with your backend URL

export interface KYCSubmissionData {
  name: string;
  dob: string;
  nationality?: string;
  aadhaarNumber?: string;
  passportNumber?: string;
  documents?: Array<{
    uri: string;
    name: string;
    type: 'photo' | 'document';
  }>;
}

export interface KYCResponse {
  success: boolean;
  message?: string;
  data?: {
    requestId: string;
    message: string;
  };
}

export interface OTPVerificationData {
  requestId: string;
  otp: string;
}

class KYCService {
  private async getAuthHeaders() {
    const token = await Storage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private async getMultipartHeaders() {
    const token = await Storage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    };
  }

  async submitKyc(data: KYCSubmissionData): Promise<KYCResponse> {
    try {
      const formData = new FormData();

      // Add text fields
      if (data.name) formData.append('name', data.name);
      if (data.dob) formData.append('dob', data.dob);
      if (data.nationality) formData.append('nationality', data.nationality);
      if (data.aadhaarNumber) formData.append('aadhaarNumber', data.aadhaarNumber);
      if (data.passportNumber) formData.append('passportNumber', data.passportNumber);

      // Add documents
      if (data.documents && data.documents.length > 0) {
        data.documents.forEach((doc, index) => {
          formData.append('documents', {
            uri: doc.uri,
            name: doc.name,
            type: doc.type === 'photo' ? 'image/jpeg' : 'application/pdf',
          } as any);
        });
      }

      const headers = await this.getMultipartHeaders();
      const response = await axios.post(`${API_BASE}/kyc/submit`, formData, { headers });

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('KYC submission error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to submit KYC',
      };
    }
  }

  async verifyOtp(data: OTPVerificationData): Promise<KYCResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.post(`${API_BASE}/kyc/verify-otp`, data, { headers });

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('OTP verification error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to verify OTP',
      };
    }
  }

  async getKycStatus(touristId: string): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(`${API_BASE}/kyc/tourist/${touristId}`, { headers });
      return response.data;
    } catch (error: any) {
      console.error('Get KYC status error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Mock functions for demo purposes
  async submitKycDemo(data: KYCSubmissionData): Promise<KYCResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mock validation
    if (!data.name || !data.dob) {
      return {
        success: false,
        message: 'Name and date of birth are required',
      };
    }

    if (!data.aadhaarNumber && !data.passportNumber) {
      return {
        success: false,
        message: 'Either Aadhaar number or passport number is required',
      };
    }

    // Mock successful response
    return {
      success: true,
      data: {
        requestId: `KYC-${Date.now()}`,
        message: 'KYC submitted successfully. OTP sent to your registered mobile number.',
      },
    };
  }

  async verifyOtpDemo(data: OTPVerificationData): Promise<KYCResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Mock OTP validation (accept any 6-digit OTP for demo)
    if (data.otp.length !== 6) {
      return {
        success: false,
        message: 'Please enter a valid 6-digit OTP',
      };
    }

    return {
      success: true,
      data: {
        requestId: data.requestId,
        message: 'KYC verified successfully! You can now proceed to trip registration.',
      },
    };
  }
}

// Export functions for backward compatibility
export const submitKyc = async (data: KYCSubmissionData): Promise<KYCResponse> => {
  const service = new KYCService();
  return service.submitKycDemo(data); // Use demo version for now
};

export const verifyOtpKyc = async (data: OTPVerificationData): Promise<KYCResponse> => {
  const service = new KYCService();
  return service.verifyOtpDemo(data); // Use demo version for now
};

export default new KYCService();