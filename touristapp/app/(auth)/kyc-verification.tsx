import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CreditCard, CheckCircle, Upload, Camera, FileText, User, Calendar } from 'lucide-react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAppContext } from '../context/AppContext';
import Storage from '../utils/storage';

interface Document {
  uri: string;
  name: string;
  type: 'photo' | 'document';
}

export default function KYCVerification() {
  const { user, refreshUser } = useAppContext();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    dob: '',
    aadhaarNumber: '',
    passportNumber: '',
    nationality: 'India',
    otp: '',
  });

  const handleSubmitKyc = async () => {
    const { name, dob, aadhaarNumber, passportNumber, nationality } = formData;
    
    if (!name || !dob || (!aadhaarNumber && !passportNumber)) {
      return Alert.alert('Error', 'Please fill all required fields');
    }

    setLoading(true);
    try {
      // Simulate KYC submission
      const mockResponse = {
        success: true,
        data: {
          requestId: `KYC-${Date.now()}`,
          message: 'KYC submitted successfully. OTP sent to your registered mobile number.',
        }
      };

      if (mockResponse.success && mockResponse.data?.requestId) {
        setRequestId(mockResponse.data.requestId);
        setCurrentStep(2);
        startOtpTimer();
        Alert.alert('Success', mockResponse.data.message);
      } else {
        Alert.alert('Error', 'KYC submission failed');
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.message || 'Failed to submit KYC');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!formData.otp || !requestId) return Alert.alert('Error', 'Enter OTP');
    
    setLoading(true);
    try {
      // Simulate OTP verification
      const mockResponse = {
        success: true,
        data: {
          message: 'KYC verified successfully! You can now proceed to trip registration.',
        }
      };

      if (mockResponse.success) {
        setCurrentStep(3);
        // Update user context to reflect KYC verification
        await refreshUser();
        Alert.alert('Success', mockResponse.data?.message || 'KYC Verified');
      } else {
        Alert.alert('Error', 'OTP verification failed');
        setCurrentStep(1);
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      const newDoc: Document = {
        uri: result.assets[0].uri,
        name: `photo_${Date.now()}.jpg`,
        type: 'photo'
      };
      setDocuments(prev => [...prev, newDoc]);
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets[0]) {
      const newDoc: Document = {
        uri: result.assets[0].uri,
        name: result.assets[0].name || `document_${Date.now()}`,
        type: 'document'
      };
      setDocuments(prev => [...prev, newDoc]);
    }
  };

  const removeDocument = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const startOtpTimer = () => {
    setOtpTimer(60);
    const timerInterval = setInterval(() => {
      setOtpTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resendOtp = () => {
    if (otpTimer > 0) return;
    Alert.alert('OTP', 'OTP resent successfully');
    startOtpTimer();
  };

  const proceedToTripDetails = () => {
    router.push('/(auth)/trip-details');
  };

  const renderStepContent = () => {
    if (currentStep === 1) {
      return (
        <View style={styles.stepContent}>
          <View style={styles.stepHeader}>
            <View style={styles.stepIcon}>
              <User size={24} color="#4F46E5" />
            </View>
            <Text style={styles.stepTitle}>Identity Verification</Text>
            <Text style={styles.stepDescription}>
              Provide your identity details for KYC verification
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <View style={styles.inputContainer}>
                <User size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Date of Birth *</Text>
              <View style={styles.inputContainer}>
                <Calendar size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={formData.dob}
                  onChangeText={(text) => setFormData({ ...formData, dob: text })}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nationality</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Country"
                  value={formData.nationality}
                  onChangeText={(text) => setFormData({ ...formData, nationality: text })}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Aadhaar Number (Indian Citizens)</Text>
              <View style={styles.inputContainer}>
                <CreditCard size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter 12-digit Aadhaar number"
                  value={formData.aadhaarNumber}
                  onChangeText={(text) => setFormData({ ...formData, aadhaarNumber: text })}
                  keyboardType="numeric"
                  maxLength={12}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Passport Number (Foreign Nationals)</Text>
              <View style={styles.inputContainer}>
                <FileText size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter passport number"
                  value={formData.passportNumber}
                  onChangeText={(text) => setFormData({ ...formData, passportNumber: text })}
                />
              </View>
            </View>

            {/* Document Upload Section */}
            <View style={styles.documentSection}>
              <Text style={styles.sectionTitle}>Supporting Documents</Text>
              <Text style={styles.sectionDescription}>
                Upload clear photos of your ID documents for verification
              </Text>

              <View style={styles.uploadButtons}>
                <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                  <Camera size={20} color="#4F46E5" />
                  <Text style={styles.uploadButtonText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.uploadButton} onPress={pickDocument}>
                  <Upload size={20} color="#4F46E5" />
                  <Text style={styles.uploadButtonText}>Upload File</Text>
                </TouchableOpacity>
              </View>

              {documents.length > 0 && (
                <View style={styles.documentsPreview}>
                  {documents.map((doc, index) => (
                    <View key={index} style={styles.documentItem}>
                      <View style={styles.documentInfo}>
                        {doc.type === 'photo' ? (
                          <Image source={{ uri: doc.uri }} style={styles.documentThumbnail} />
                        ) : (
                          <View style={styles.documentIcon}>
                            <FileText size={20} color="#6B7280" />
                          </View>
                        )}
                        <Text style={styles.documentName} numberOfLines={1}>
                          {doc.name}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.removeButton}
                        onPress={() => removeDocument(index)}
                      >
                        <Text style={styles.removeButtonText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.submitBtn, (!formData.name || !formData.dob || (!formData.aadhaarNumber && !formData.passportNumber)) && styles.submitBtnDisabled]} 
            onPress={handleSubmitKyc}
            disabled={loading || (!formData.name || !formData.dob || (!formData.aadhaarNumber && !formData.passportNumber))}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Submit for Verification</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    if (currentStep === 2) {
      return (
        <View style={styles.stepContent}>
          <View style={styles.stepHeader}>
            <View style={styles.stepIcon}>
              <CheckCircle size={24} color="#10B981" />
            </View>
            <Text style={styles.stepTitle}>OTP Verification</Text>
            <Text style={styles.stepDescription}>
              Enter the OTP sent to your registered mobile number
            </Text>
          </View>

          <View style={styles.otpContainer}>
            <TextInput
              style={styles.otpInput}
              placeholder="Enter 6-digit OTP"
              value={formData.otp}
              onChangeText={(text) => setFormData({ ...formData, otp: text })}
              keyboardType="numeric"
              maxLength={6}
              textAlign="center"
            />
            <Text style={styles.otpTimer}>
              {otpTimer > 0 ? `Resend OTP in ${otpTimer}s` : 'OTP expired'}
            </Text>
          </View>

          <TouchableOpacity 
            style={[styles.submitBtn, !formData.otp && styles.submitBtnDisabled]} 
            onPress={handleVerifyOtp}
            disabled={loading || !formData.otp}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Verify OTP</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.resendBtn, otpTimer > 0 && styles.resendBtnDisabled]} 
            onPress={resendOtp}
            disabled={otpTimer > 0}
          >
            <Text style={[styles.resendText, otpTimer > 0 && styles.resendTextDisabled]}>
              Resend OTP
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (currentStep === 3) {
      return (
        <View style={styles.stepContent}>
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <CheckCircle size={48} color="#10B981" />
            </View>
            <Text style={styles.successTitle}>KYC Verified Successfully!</Text>
            <Text style={styles.successDescription}>
              Your identity has been verified. You can now proceed to register your trip details and generate your Digital Tourist ID.
            </Text>
            
            <View style={styles.nextStepsContainer}>
              <Text style={styles.nextStepsTitle}>Next Steps:</Text>
              <View style={styles.nextStepItem}>
                <Text style={styles.stepNumber}>1</Text>
                <Text style={styles.stepText}>Complete trip registration</Text>
              </View>
              <View style={styles.nextStepItem}>
                <Text style={styles.stepNumber}>2</Text>
                <Text style={styles.stepText}>Generate Digital Tourist ID</Text>
              </View>
              <View style={styles.nextStepItem}>
                <Text style={styles.stepNumber}>3</Text>
                <Text style={styles.stepText}>Start safe traveling</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.continueBtn} onPress={proceedToTripDetails}>
              <Text style={styles.continueText}>Continue to Trip Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return null;
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBar style="dark" />
      
      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(currentStep / 3) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>Step {currentStep} of 3</Text>
      </View>

      {renderStepContent()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flexGrow: 1, 
    padding: 20, 
    backgroundColor: '#f9fafb' 
  },
  progressContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  stepContent: { 
    flex: 1 
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  stepIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  form: {
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  documentSection: {
    marginTop: 24,
    padding: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4F46E5',
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4F46E5',
  },
  documentsPreview: {
    gap: 8,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  documentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  documentThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 12,
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  documentName: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    fontSize: 16,
    color: '#DC2626',
    fontWeight: 'bold',
  },
  otpContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  otpInput: {
    width: 200,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4F46E5',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    letterSpacing: 8,
    marginBottom: 16,
  },
  otpTimer: {
    fontSize: 14,
    color: '#6B7280',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  successDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  nextStepsContainer: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    padding: 20,
    borderRadius: 12,
    marginBottom: 32,
  },
  nextStepsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  nextStepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 'bold',
    lineHeight: 24,
    marginRight: 12,
  },
  stepText: {
    fontSize: 14,
    color: '#374151',
  },
  submitBtn: { 
    backgroundColor: '#4F46E5', 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnDisabled: {
    backgroundColor: '#9CA3AF',
    shadowColor: '#6B7280',
  },
  submitText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  resendBtn: { 
    marginTop: 16, 
    alignItems: 'center',
    paddingVertical: 12,
  },
  resendBtnDisabled: {
    opacity: 0.5,
  },
  resendText: { 
    color: '#4F46E5', 
    fontWeight: '600',
    fontSize: 16,
  },
  resendTextDisabled: {
    color: '#9CA3AF',
  },
  continueBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});