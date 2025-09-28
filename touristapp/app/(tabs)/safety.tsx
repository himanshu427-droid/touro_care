import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Alert, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Shield, Phone, MapPin, Users, Siren, TriangleAlert as AlertTriangle, Clock, CircleCheck as CheckCircle, FileText, Camera } from 'lucide-react-native';
import EmergencyService from '../services/emergency';
import LocationService from '../services/location';
import * as Haptics from 'expo-haptics';

interface EmergencyContact {
  name: string;
  number: string;
  type: 'police' | 'medical' | 'family' | 'embassy' | 'authority';
}

interface EmergencyLog {
  id: string;
  type: string;
  timestamp: string;
  status: 'sent' | 'acknowledged' | 'resolved';
  location?: string;
}

export default function Safety() {
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [panicPressed, setPanicPressed] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadEmergencyContacts();
    return () => {
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    };
  }, []);

  const loadEmergencyContacts = async () => {
    try {
      const contacts = await EmergencyService.getTouristHelplineNumbers();
      setEmergencyContacts(contacts.map(c => ({
        name: c.name,
        number: c.phone,
        type: c.type as any,
      })));
    } catch (error) {
      console.error('Error loading emergency contacts:', error);
    }
  };

  const emergencyLogs: EmergencyLog[] = [
    {
      id: '1',
      type: 'Location Check',
      timestamp: '2024-01-15 14:30',
      status: 'resolved',
      location: 'Police Bazar, Shillong'
    },
    {
      id: '2',
      type: 'Safety Alert',
      timestamp: '2024-01-15 10:15',
      status: 'acknowledged',
      location: 'Umiam Lake'
    }
  ];

  const startPanicSequence = () => {
    setPanicPressed(true);
    setCountdown(3);
    
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    // Start countdown
    let count = 3;
    const countdownInterval = setInterval(() => {
      count--;
      setCountdown(count);
      
      if (count <= 0) {
        clearInterval(countdownInterval);
        triggerEmergency();
      }
    }, 1000);

    countdownRef.current = countdownInterval;

    // Scale animation for button
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const cancelPanicSequence = () => {
    if (countdownRef.current) {
      clearTimeout(countdownRef.current);
      countdownRef.current = null;
    }
    setPanicPressed(false);
    setCountdown(0);
    scaleAnim.setValue(1);
  };

  const triggerEmergency = async () => {
    setEmergencyActive(true);
    setPanicPressed(false);
    
    // Start pulsing animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Trigger emergency alert
    const success = await EmergencyService.triggerPanicAlert('Emergency assistance required - Panic button activated');
    
    if (success) {
      // Continue with emergency sequence
      setTimeout(() => {
        if (emergencyActive) {
          Alert.alert(
            'Emergency Response Active',
            'Your emergency alert has been sent to:\n\n• Local Police (100)\n• Tourist Helpline (1363)\n• Your emergency contacts\n\nHelp is on the way. Stay calm and stay visible.',
            [
              {
                text: 'I\'m Safe Now',
                onPress: cancelEmergency,
                style: 'cancel'
              },
              {
                text: 'Call Police Now',
                onPress: () => EmergencyService.makeEmergencyCall('100'),
                style: 'default'
              }
            ]
          );
        }
      }, 1000);
    } else {
      setEmergencyActive(false);
      Alert.alert('Error', 'Failed to send emergency alert. Please try calling emergency services directly.');
    }
  };

  const cancelEmergency = () => {
    setEmergencyActive(false);
    setPanicPressed(false);
    setCountdown(0);
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
    scaleAnim.setValue(1);
    
    if (countdownRef.current) {
      clearTimeout(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const callEmergencyNumber = (contact: EmergencyContact) => {
    Alert.alert(
      `Call ${contact.name}?`,
      `This will dial ${contact.number}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => EmergencyService.makeEmergencyCall(contact.number)
        }
      ]
    );
  };

  const reportIncident = () => {
    Alert.alert(
      'Report Incident',
      'What type of incident would you like to report?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Theft/Crime', onPress: () => handleIncidentReport('theft') },
        { text: 'Medical Emergency', onPress: () => handleIncidentReport('medical') },
        { text: 'Safety Concern', onPress: () => handleIncidentReport('safety') },
        { text: 'Other', onPress: () => handleIncidentReport('other') },
      ]
    );
  };

  const handleIncidentReport = async (type: string) => {
    const success = await EmergencyService.reportIncident(type, `${type} incident reported via mobile app`);
    if (success) {
      Alert.alert('Report Submitted', 'Your incident report has been submitted to the authorities.');
    }
  };

  const getContactIcon = (type: EmergencyContact['type']) => {
    switch (type) {
      case 'police': 
      case 'authority': 
        return <Shield size={20} color="#1D4ED8" />;
      case 'medical': return <Phone size={20} color="#DC2626" />;
      case 'family': return <Users size={20} color="#16A34A" />;
      case 'embassy': return <MapPin size={20} color="#F59E0B" />;
      default: return <Phone size={20} color="#6B7280" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle size={16} color="#16A34A" />;
      case 'acknowledged': return <Clock size={16} color="#F59E0B" />;
      case 'sent': return <AlertTriangle size={16} color="#DC2626" />;
      default: return <Clock size={16} color="#6B7280" />;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, emergencyActive && styles.emergencyHeader]}>
          <Text style={styles.headerTitle}>
            {emergencyActive ? '🚨 EMERGENCY ACTIVE' : 'Emergency Safety'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {emergencyActive ? 'Help is being dispatched to your location' : 'Tourist Safety & Emergency Response'}
          </Text>
        </View>

        {/* Panic Button */}
        <View style={styles.panicContainer}>
          <Animated.View style={[
            styles.panicButtonContainer,
            { transform: [{ scale: emergencyActive ? pulseAnim : scaleAnim }] }
          ]}>
            <TouchableOpacity
              style={[
                styles.panicButton,
                emergencyActive && styles.panicButtonActive,
                panicPressed && styles.panicButtonPressed
              ]}
              onPress={emergencyActive ? cancelEmergency : startPanicSequence}
              onPressOut={panicPressed && !emergencyActive ? cancelPanicSequence : undefined}
              activeOpacity={0.8}
            >
              <Siren size={48} color="#FFFFFF" />
              <Text style={styles.panicButtonText}>
                {emergencyActive ? 'CANCEL\nEMERGENCY' : 
                 panicPressed ? `RELEASING IN\n${countdown}` : 
                 'PANIC\nBUTTON'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
          <Text style={styles.panicDescription}>
            {emergencyActive 
              ? 'Emergency alert is active. Tap to cancel if you are safe.'
              : panicPressed
              ? 'Release button to cancel emergency alert'
              : 'Press and hold for 3 seconds to send emergency alert with your location to police and emergency contacts.'
            }
          </Text>
        </View>

        {/* Emergency Status */}
        {emergencyActive && (
          <View style={styles.emergencyStatus}>
            <View style={styles.statusHeader}>
              <AlertTriangle size={20} color="#DC2626" />
              <Text style={styles.statusTitle}>Emergency Response Status</Text>
            </View>
            <View style={styles.statusItems}>
              <View style={styles.statusItem}>
                <CheckCircle size={16} color="#16A34A" />
                <Text style={styles.statusText}>Location sent to authorities</Text>
              </View>
              <View style={styles.statusItem}>
                <CheckCircle size={16} color="#16A34A" />
                <Text style={styles.statusText}>Emergency contacts notified</Text>
              </View>
              <View style={styles.statusItem}>
                <Clock size={16} color="#F59E0B" />
                <Text style={styles.statusText}>Police dispatch in progress</Text>
              </View>
              <View style={styles.statusItem}>
                <Clock size={16} color="#F59E0B" />
                <Text style={styles.statusText}>Estimated arrival: 8-12 minutes</Text>
              </View>
            </View>
          </View>
        )}

        {/* Quick Emergency Actions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Emergency Actions</Text>
          <View style={styles.emergencyActions}>
            <TouchableOpacity 
              style={[styles.emergencyActionButton, styles.policeButton]}
              onPress={() => callEmergencyNumber({ name: 'Police', number: '100', type: 'police' })}
            >
              <Shield size={20} color="#FFFFFF" />
              <Text style={styles.emergencyActionText}>Call Police</Text>
              <Text style={styles.emergencyActionNumber}>100</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.emergencyActionButton, styles.medicalButton]}
              onPress={() => callEmergencyNumber({ name: 'Medical', number: '108', type: 'medical' })}
            >
              <Phone size={20} color="#FFFFFF" />
              <Text style={styles.emergencyActionText}>Medical</Text>
              <Text style={styles.emergencyActionNumber}>108</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.emergencyActionButton, styles.helplineButton]}
              onPress={() => callEmergencyNumber({ name: 'Tourist Helpline', number: '1363', type: 'authority' })}
            >
              <Users size={20} color="#FFFFFF" />
              <Text style={styles.emergencyActionText}>Tourist Help</Text>
              <Text style={styles.emergencyActionNumber}>1363</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Report Incident */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Report Incident</Text>
          <View style={styles.reportActions}>
            <TouchableOpacity style={styles.reportButton} onPress={reportIncident}>
              <FileText size={20} color="#1D4ED8" />
              <Text style={styles.reportButtonText}>File Incident Report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.reportButton}>
              <Camera size={20} color="#1D4ED8" />
              <Text style={styles.reportButtonText}>Report with Photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Emergency Contacts */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Emergency Contacts</Text>
          {emergencyContacts.map((contact, index) => (
            <TouchableOpacity
              key={index}
              style={styles.contactItem}
              onPress={() => callEmergencyNumber(contact)}
            >
              {getContactIcon(contact.type)}
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactNumber}>{contact.number}</Text>
              </View>
              <Phone size={20} color="#6B7280" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Safety Tips */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Safety Guidelines</Text>
          <View style={styles.safetyTips}>
            <View style={styles.tipItem}>
              <Text style={styles.tipNumber}>1</Text>
              <Text style={styles.tipText}>
                Always inform someone about your travel plans and expected return time.
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipNumber}>2</Text>
              <Text style={styles.tipText}>
                Stay in well-lit, populated areas, especially during evening hours.
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipNumber}>3</Text>
              <Text style={styles.tipText}>
                Keep your digital ID and emergency contacts easily accessible.
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipNumber}>4</Text>
              <Text style={styles.tipText}>
                Follow local guidelines and respect restricted area warnings.
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipNumber}>5</Text>
              <Text style={styles.tipText}>
                Enable location tracking for real-time safety monitoring.
              </Text>
            </View>
          </View>
        </View>

        {/* Emergency Logs */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Activity</Text>
          {emergencyLogs.map((log) => (
            <View key={log.id} style={styles.logItem}>
              <View style={styles.logHeader}>
                {getStatusIcon(log.status)}
                <Text style={styles.logType}>{log.type}</Text>
                <Text style={styles.logTime}>{log.timestamp}</Text>
              </View>
              {log.location && (
                <Text style={styles.logLocation}>📍 {log.location}</Text>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#DC2626',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  emergencyHeader: {
    backgroundColor: '#991B1B',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#FCA5A5',
  },
  panicContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  panicButtonContainer: {
    marginBottom: 20,
  },
  panicButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  panicButtonActive: {
    backgroundColor: '#991B1B',
  },
  panicButtonPressed: {
    backgroundColor: '#7F1D1D',
  },
  panicButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  panicDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  emergencyStatus: {
    backgroundColor: '#FEF2F2',
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
    marginLeft: 8,
  },
  statusItems: {
    gap: 8,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  emergencyActions: {
    flexDirection: 'row',
    gap: 12,
  },
  emergencyActionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 4,
  },
  policeButton: {
    backgroundColor: '#1D4ED8',
  },
  medicalButton: {
    backgroundColor: '#DC2626',
  },
  helplineButton: {
    backgroundColor: '#16A34A',
  },
  emergencyActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emergencyActionNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  reportActions: {
    gap: 12,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reportButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1D4ED8',
    marginLeft: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  contactNumber: {
    fontSize: 12,
    color: '#6B7280',
  },
  safetyTips: {
    gap: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1D4ED8',
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 'bold',
    lineHeight: 24,
    marginRight: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  logItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  logType: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginLeft: 8,
    flex: 1,
  },
  logTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  logLocation: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 24,
  },
});