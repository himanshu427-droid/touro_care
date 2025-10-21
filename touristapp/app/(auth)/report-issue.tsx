import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { reportIssue } from '../api/tourist';
import * as Location from 'expo-location';

export default function ReportIssue() {
  const router = useRouter();
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      // Get current location
      const { status } = await Location.requestForegroundPermissionsAsync();
      let location;
      
      if (status === 'granted') {
        const position = await Location.getCurrentPositionAsync({});
        location = {
          lat: position.coords.latitude,
          lon: position.coords.longitude
        };
      }

      await reportIssue({
        incidentDetails: details,
        location,
        dateTime: new Date().toISOString()
      });

      Alert.alert(
        'Report Submitted',
        'Your report has been submitted successfully. Authorities will review it shortly.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Report an Issue</Text>
      <TextInput
        style={styles.input}
        multiline
        numberOfLines={6}
        placeholder="Describe the issue..."
        value={details}
        onChangeText={setDetails}
      />
      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading || !details.trim()}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Submitting...' : 'Submit Report'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    minHeight: 120,
    textAlignVertical: 'top'
  },
  button: {
    backgroundColor: '#1D4ED8',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center'
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF'
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  }
});