import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { MapPin, Calendar, Users, Phone, Plus, Trash2, User } from 'lucide-react-native';
import { submitTripDetails } from '../api/trip-details';
import Storage from '../utils/storage';

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
}

interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  age: string;
  phone: string;
}

export default function TripDetails() {
  const [tripData, setTripData] = useState({
    destination: 'Jaipur',
    checkInDate: '',
    checkOutDate: '',
    accommodation: 'Sector 7',
    purpose: 'Tour',
    groupSize: '1',
  });

  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([
    { id: '1', name: '', relationship: '', phone: '' }
  ]);

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(false);

  const handleTripDataChange = (field: string, value: string) => {
    setTripData(prev => ({ ...prev, [field]: value }));
  };

  const addEmergencyContact = () => {
    const newContact: EmergencyContact = {
      id: Date.now().toString(),
      name: '',
      relationship: '',
      phone: ''
    };
    setEmergencyContacts(prev => [...prev, newContact]);
  };

  const removeEmergencyContact = (id: string) => {
    if (emergencyContacts.length > 1) {
      setEmergencyContacts(prev => prev.filter(contact => contact.id !== id));
    }
  };

  const updateEmergencyContact = (id: string, field: string, value: string) => {
    setEmergencyContacts(prev =>
      prev.map(contact =>
        contact.id === id ? { ...contact, [field]: value } : contact
      )
    );
  };

  const addFamilyMember = () => {
    const newMember: FamilyMember = {
      id: Date.now().toString(),
      name: '',
      relationship: '',
      age: '',
      phone: ''
    };
    setFamilyMembers(prev => [...prev, newMember]);
  };

  const removeFamilyMember = (id: string) => {
    setFamilyMembers(prev => prev.filter(member => member.id !== id));
  };

  const updateFamilyMember = (id: string, field: string, value: string) => {
    setFamilyMembers(prev =>
      prev.map(member =>
        member.id === id ? { ...member, [field]: value } : member
      )
    );
  };

  const validateForm = () => {
    const { destination, checkInDate, checkOutDate, accommodation, purpose } = tripData;
    
    if (!destination || !checkInDate || !checkOutDate || !accommodation || !purpose) {
      Alert.alert('Error', 'Please fill in all trip details');
      return false;
    }

    const hasValidEmergencyContact = emergencyContacts.some(contact => 
      contact.name && contact.relationship && contact.phone
    );

    if (!hasValidEmergencyContact) {
      Alert.alert('Error', 'Please add at least one complete emergency contact');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    // if (!validateForm()) return;

    setLoading(true);
    try {
      const token = await Storage.getItem('token');
      if(!token){
      console.log("No authentication token found");
      }
      const payload = {
        tripDets: tripData,
        emergencyContacts
      }
      const response  = await submitTripDetails(payload, token)

      if(response.success){
        Alert.alert(
        'Digital ID Generated!',
        'Your Digital Tourist ID has been successfully created and is now ready for use. Welcome to the Smart Tourist Safety Network!',
        [
          {
            text: 'Continue to App',
            onPress: () => router.replace('/(tabs)')
          }
        ]
      );
      
    } 
    } catch (err:any) {
       console.error(err);
       Alert.alert('Error', err.message || 'Failed to submit trip details');
    }
    finally{
      setLoading(false)
    }

  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Trip Details</Text>
        <Text style={styles.subtitle}>Complete your travel information</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Trip Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trip Information</Text>
          
          <View style={styles.inputContainer}>
            <MapPin size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Destination (e.g., Shillong, Meghalaya)"
              value={tripData.destination}
              onChangeText={(value) => handleTripDataChange('destination', value)}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputContainer, styles.halfWidth]}>
              <Calendar size={20} color="#6B7280" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Check-in Date"
                value={tripData.checkInDate}
                onChangeText={(value) => handleTripDataChange('checkInDate', value)}
              />
            </View>
            <View style={[styles.inputContainer, styles.halfWidth]}>
              <Calendar size={20} color="#6B7280" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Check-out Date"
                value={tripData.checkOutDate}
                onChangeText={(value) => handleTripDataChange('checkOutDate', value)}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <MapPin size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Accommodation Details"
              value={tripData.accommodation}
              onChangeText={(value) => handleTripDataChange('accommodation', value)}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputContainer, styles.halfWidth]}>
              <Users size={20} color="#6B7280" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Group Size"
                value={tripData.groupSize}
                onChangeText={(value) => handleTripDataChange('groupSize', value)}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.inputContainer, styles.halfWidth]}>
              <TextInput
                style={styles.input}
                placeholder="Purpose of Visit"
                value={tripData.purpose}
                onChangeText={(value) => handleTripDataChange('purpose', value)}
              />
            </View>
          </View>
        </View>

        {/* Emergency Contacts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Emergency Contacts</Text>
            <TouchableOpacity style={styles.addButton} onPress={addEmergencyContact}>
              <Plus size={16} color="#1D4ED8" />
            </TouchableOpacity>
          </View>

          {emergencyContacts.map((contact, index) => (
            <View key={contact.id} style={styles.contactCard}>
              <View style={styles.contactHeader}>
                <Text style={styles.contactTitle}>Contact {index + 1}</Text>
                {emergencyContacts.length > 1 && (
                  <TouchableOpacity 
                    style={styles.removeButton}
                    onPress={() => removeEmergencyContact(contact.id)}
                  >
                    <Trash2 size={16} color="#DC2626" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.inputContainer}>
                <User size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  value={contact.name}
                  onChangeText={(value) => updateEmergencyContact(contact.id, 'name', value)}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputContainer, styles.halfWidth]}>
                  <TextInput
                    style={styles.input}
                    placeholder="Relationship"
                    value={contact.relationship}
                    onChangeText={(value) => updateEmergencyContact(contact.id, 'relationship', value)}
                  />
                </View>
                <View style={[styles.inputContainer, styles.halfWidth]}>
                  <Phone size={20} color="#6B7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Phone Number"
                    value={contact.phone}
                    onChangeText={(value) => updateEmergencyContact(contact.id, 'phone', value)}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Family Members */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Traveling Family Members</Text>
            <TouchableOpacity style={styles.addButton} onPress={addFamilyMember}>
              <Plus size={16} color="#1D4ED8" />
            </TouchableOpacity>
          </View>

          {familyMembers.length === 0 ? (
            <Text style={styles.emptyText}>No family members added. Tap + to add family members traveling with you.</Text>
          ) : (
            familyMembers.map((member, index) => (
              <View key={member.id} style={styles.contactCard}>
                <View style={styles.contactHeader}>
                  <Text style={styles.contactTitle}>Family Member {index + 1}</Text>
                  <TouchableOpacity 
                    style={styles.removeButton}
                    onPress={() => removeFamilyMember(member.id)}
                  >
                    <Trash2 size={16} color="#DC2626" />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputContainer}>
                  <User size={20} color="#6B7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    value={member.name}
                    onChangeText={(value) => updateFamilyMember(member.id, 'name', value)}
                  />
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputContainer, styles.halfWidth]}>
                    <TextInput
                      style={styles.input}
                      placeholder="Relationship"
                      value={member.relationship}
                      onChangeText={(value) => updateFamilyMember(member.id, 'relationship', value)}
                    />
                  </View>
                  <View style={[styles.inputContainer, styles.halfWidth]}>
                    <TextInput
                      style={styles.input}
                      placeholder="Age"
                      value={member.age}
                      onChangeText={(value) => updateFamilyMember(member.id, 'age', value)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Phone size={20} color="#6B7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Phone Number (optional)"
                    value={member.phone}
                    onChangeText={(value) => updateFamilyMember(member.id, 'phone', value)}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Generating Digital ID...' : 'Generate Digital Tourist ID'}
          </Text>
        </TouchableOpacity>
        
        <Text style={styles.footerNote}>
          Your information is encrypted and stored securely on the blockchain
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingTop: 80,
    paddingHorizontal: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1D4ED8',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  halfWidth: {
    flex: 1,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  contactCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 20,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  submitButton: {
    backgroundColor: '#1D4ED8',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footerNote: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
});