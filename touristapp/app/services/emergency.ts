import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Alert, Linking } from 'react-native';
import Storage from '../utils/storage';
import LocationService from './location';

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
  type: 'family' | 'friend' | 'authority';
}

export interface EmergencyAlert {
  id: string;
  type: 'sos' | 'medical' | 'security' | 'geofence';
  message: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  timestamp: Date;
  status: 'sent' | 'acknowledged' | 'resolved';
  contacts: string[];
}

class EmergencyService {
  private emergencyContacts: EmergencyContact[] = [
    { name: 'Local Police', phone: '100', relationship: 'Authority', type: 'authority' },
    { name: 'Tourist Helpline', phone: '1363', relationship: 'Authority', type: 'authority' },
    { name: 'Medical Emergency', phone: '108', relationship: 'Authority', type: 'authority' },
  ];

  private alertHistory: EmergencyAlert[] = [];

  async triggerPanicAlert(message?: string): Promise<boolean> {
    try {
      // Haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      // Get current location
      const location = await LocationService.getCurrentLocation();
      if (!location) {
        Alert.alert('Error', 'Unable to get your current location for emergency alert');
        return false;
      }

      // Create emergency alert
      const alert: EmergencyAlert = {
        id: `EMERGENCY-${Date.now()}`,
        type: 'sos',
        message: message || 'Emergency assistance required',
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
        },
        timestamp: new Date(),
        status: 'sent',
        contacts: this.emergencyContacts.map(c => c.phone),
      };

      // Add to history
      this.alertHistory.unshift(alert);

      // Send to backend
      await this.sendEmergencyAlert(alert);

      // Notify emergency contacts
      await this.notifyEmergencyContacts(alert);

      return true;
    } catch (error) {
      console.error('Error triggering panic alert:', error);
      return false;
    }
  }

  private async sendEmergencyAlert(alert: EmergencyAlert): Promise<void> {
    try {
      const user = await Storage.getJsonItem('user');
      const token = await Storage.getItem('token');

      if (!user || !token) {
        console.log('No user or token found for emergency alert');
        return;
      }

      const payload = {
        touristId: user.walletId || user._id,
        deviceId: 'mobile-app',
        location: alert.location,
        message: alert.message,
        type: alert.type,
        timestamp: alert.timestamp.toISOString(),
      };

      // Send to your backend API
      console.log('Sending emergency alert to backend:', payload);
      
      // Example API call:
      // await axios.post('/api/tourist/sos', payload, {
      //   headers: { Authorization: `Bearer ${token}` }
      // });

    } catch (error) {
      console.error('Error sending emergency alert to backend:', error);
    }
  }

  private async notifyEmergencyContacts(alert: EmergencyAlert): Promise<void> {
    try {
      // For demo purposes, we'll show an alert
      // In a real app, you might send SMS or push notifications
      
      const contactList = this.emergencyContacts
        .map(c => `${c.name}: ${c.phone}`)
        .join('\n');

      Alert.alert(
        'Emergency Alert Sent',
        `Your emergency alert has been sent to:\n\n${contactList}\n\nLocation: ${alert.location.address || 'Current Location'}\n\nHelp is on the way. Stay calm and stay visible.`,
        [
          {
            text: 'Call Police (100)',
            onPress: () => this.makeEmergencyCall('100'),
          },
          {
            text: 'I\'m Safe Now',
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      console.error('Error notifying emergency contacts:', error);
    }
  }

  async makeEmergencyCall(phoneNumber: string): Promise<void> {
    try {
      const url = `tel:${phoneNumber}`;
      const canOpen = await Linking.canOpenURL(url);
      
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to make phone call');
      }
    } catch (error) {
      console.error('Error making emergency call:', error);
      Alert.alert('Error', 'Failed to initiate call');
    }
  }

  async addEmergencyContact(contact: EmergencyContact): Promise<void> {
    this.emergencyContacts.push(contact);
    await Storage.setJsonItem('emergencyContacts', this.emergencyContacts);
  }

  async removeEmergencyContact(phone: string): Promise<void> {
    this.emergencyContacts = this.emergencyContacts.filter(c => c.phone !== phone);
    await Storage.setJsonItem('emergencyContacts', this.emergencyContacts);
  }

  getEmergencyContacts(): EmergencyContact[] {
    return [...this.emergencyContacts];
  }

  getAlertHistory(): EmergencyAlert[] {
    return [...this.alertHistory];
  }

  async checkGeofenceViolation(location: LocationData): Promise<boolean> {
    try {
      // This would typically call your ML backend to check geofences
      // For demo, we'll simulate a geofence check
      
      // Example: Check if location is in a restricted area
      const restrictedAreas = [
        { lat: 25.5788, lng: 91.8933, radius: 1000, name: 'Restricted Military Zone' },
        { lat: 25.4670, lng: 91.3662, radius: 500, name: 'Protected Forest Area' },
      ];

      for (const area of restrictedAreas) {
        const distance = this.calculateDistance(
          { latitude: location.latitude, longitude: location.longitude, timestamp: new Date() },
          { latitude: area.lat, longitude: area.lng, timestamp: new Date() }
        );

        if (distance <= area.radius) {
          // Trigger geofence alert
          await this.triggerGeofenceAlert(area.name, location);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking geofence:', error);
      return false;
    }
  }

  private calculateDistance(loc1: { latitude: number; longitude: number }, loc2: { latitude: number; longitude: number }): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (loc1.latitude * Math.PI) / 180;
    const φ2 = (loc2.latitude * Math.PI) / 180;
    const Δφ = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
    const Δλ = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private async triggerGeofenceAlert(areaName: string, location: LocationData): Promise<void> {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    
    Alert.alert(
      'Geofence Alert',
      `You are approaching a restricted area: ${areaName}. Please maintain safe distance and follow local guidelines.`,
      [
        { text: 'Understood', style: 'default' },
        { text: 'Get Directions Away', onPress: () => this.getDirectionsAway(location) },
      ]
    );
  }

  private async getDirectionsAway(location: LocationData): Promise<void> {
    try {
      // Open maps app with current location
      const url = `maps:?q=${location.latitude},${location.longitude}`;
      const canOpen = await Linking.canOpenURL(url);
      
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        // Fallback to Google Maps web
        const googleMapsUrl = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
        await Linking.openURL(googleMapsUrl);
      }
    } catch (error) {
      console.error('Error opening maps:', error);
    }
  }

  async reportIncident(type: string, description: string, location?: LocationData): Promise<boolean> {
    try {
      const currentLocation = location || await LocationService.getCurrentLocation();
      
      if (!currentLocation) {
        Alert.alert('Error', 'Unable to get location for incident report');
        return false;
      }

      const incident = {
        id: `INCIDENT-${Date.now()}`,
        type,
        description,
        location: currentLocation,
        timestamp: new Date(),
        reportedBy: await Storage.getJsonItem('user'),
      };

      // Send to backend
      console.log('Reporting incident:', incident);
      
      // Show confirmation
      Alert.alert(
        'Incident Reported',
        'Your incident report has been submitted to the authorities. Reference ID: ' + incident.id,
        [{ text: 'OK' }]
      );

      return true;
    } catch (error) {
      console.error('Error reporting incident:', error);
      return false;
    }
  }

  async getTouristHelplineNumbers(): Promise<EmergencyContact[]> {
    return [
      { name: 'Tourist Helpline', phone: '1363', relationship: 'Government', type: 'authority' },
      { name: 'Police Emergency', phone: '100', relationship: 'Authority', type: 'authority' },
      { name: 'Medical Emergency', phone: '108', relationship: 'Authority', type: 'authority' },
      { name: 'Fire Emergency', phone: '101', relationship: 'Authority', type: 'authority' },
      { name: 'Women Helpline', phone: '1091', relationship: 'Authority', type: 'authority' },
      { name: 'Child Helpline', phone: '1098', relationship: 'Authority', type: 'authority' },
    ];
  }
}

export default new EmergencyService();