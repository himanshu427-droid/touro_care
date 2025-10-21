import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { useAppContext } from '../context/AppContext';
import { verifyTourist } from '../api/tourist';
import QRCodeSVG from 'react-native-qrcode-svg'; // Import the QR code library
import { User, ShieldCheck, MapPin, Phone, Calendar, Plane } from 'lucide-react-native';

// Define an interface for the data we expect
interface DigitalIdData {
  blockchain: any;
  additionalInfo: any;
}

export default function DigitalIdPage() {
  const { user } = useAppContext();
  const [idData, setIdData] = useState<DigitalIdData | null>(null);
  const [loading, setLoading] = useState(true);

  // Function to fetch the digital ID data from the backend
  const fetchIdData = async () => {
    if (!user?.walletId) {
      Alert.alert("Error", "Could not find user information. Please log in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await verifyTourist(user.walletId);
      if (response.success) {
        setIdData(response.data);
      } else {
        throw new Error(response.message || "Failed to fetch digital ID.");
      }
    } catch (error: any) {
      console.error("Error fetching digital ID:", error);
      Alert.alert("Error", `Could not load your Digital ID: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIdData();
  }, [user]); // Re-fetch if the user context changes

  // A helper component for rendering sections
  const InfoSection = ({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );

  // Render a loading spinner while data is being fetched
  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#1D4ED8" /></View>;
  }

  // Render a message if no data could be loaded
  if (!idData) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Could not load Digital ID.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchIdData}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- MODIFY THE RENDER LOGIC ---
  const { blockchain, additionalInfo } = idData;
  // Use the new detailed data from the 'additionalInfo' object
  const personalInfo = blockchain?.personalInfo || {};
  const itinerary = additionalInfo?.fullItinerary?.destinations || [];
  const contacts = additionalInfo?.emergencyContacts || [];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerCard}>
        <View style={styles.headerInfo}>
          <User size={40} color="#1D4ED8" />
          <View>
            <Text style={styles.name}>{personalInfo.name || 'N/A'}</Text>
            <Text style={styles.nationality}>Nationality: {personalInfo.nationality || 'N/A'}</Text>
          </View>
        </View>
        <View style={styles.qrCodeContainer}>
          {/* The QR code will contain the tourist's unique walletId */}
          <QRCodeSVG value={user?.walletId || 'invalid-id'} size={100} />
        </View>
      </View>

      <InfoSection title="Verification Status" icon={<ShieldCheck size={20} color="#10B981" />}>
        <Text style={[styles.status, { color: additionalInfo?.kycStatus === 'verified' ? '#10B981' : '#F59E0B' }]}>
          {additionalInfo?.kycStatus === 'verified' ? 'KYC Verified' : 'Verification Pending'}
        </Text>
        <Text style={styles.infoText}>Security Score: {additionalInfo?.securityScore || 'N/A'}</Text>
      </InfoSection>

      <InfoSection title="Trip Itinerary" icon={<Plane size={20} color="#3B82F6" />}>
        {itinerary.length > 0 ? itinerary.map((dest: any, index: number) => (
          <View key={index} style={styles.itemRow}>
            <MapPin size={16} color="#6B7280" style={styles.itemIcon} />
            <Text style={styles.infoText}>{dest.city}, {dest.country}</Text>
            <Text style={styles.dateText}>({new Date(dest.startDate).toLocaleDateString()} - {new Date(dest.endDate).toLocaleDateString()})</Text>
          </View>
        )) : <Text style={styles.infoText}>No itinerary found.</Text>}
      </InfoSection>

      <InfoSection title="Emergency Contacts" icon={<Phone size={20} color="#EF4444" />}>
        {contacts.length > 0 ? contacts.map((contact: any, index: number) => (
          <View key={index} style={styles.itemRow}>
            <User size={16} color="#6B7280" style={styles.itemIcon} />
            <Text style={styles.infoText}>{contact.name} ({contact.relationship})</Text>
            <Text style={styles.dateText}>{contact.phone}</Text>
          </View>
        )) : <Text style={styles.infoText}>No emergency contacts added.</Text>}
      </InfoSection>
    </ScrollView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  errorText: { fontSize: 16, color: '#4B5563', marginBottom: 20 },
  retryButton: { backgroundColor: '#1D4ED8', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  retryButtonText: { color: 'white', fontWeight: 'bold' },
  headerCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  name: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  nationality: { fontSize: 14, color: '#4B5563' },
  qrCodeContainer: {
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 8,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#374151' },
  sectionContent: { gap: 8 },
  infoText: { fontSize: 16, color: '#4B5563' },
  status: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  itemIcon: { marginRight: 8 },
  dateText: { marginLeft: 8, fontSize: 14, color: '#6B7280' },
});