import * as Location from 'expo-location';
import Storage from '../utils/storage';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: Date;
  address?: string;
}

export interface LocationUpdate {
  touristId: string;
  deviceId: string;
  locations: Array<{
    lat: number;
    lon: number;
    speed?: number;
    accuracy?: number;
    ts: string;
  }>;
}

class LocationService {
  private watchId: Location.LocationSubscription | null = null;
  private isTracking = false;
  private locationHistory: LocationData[] = [];

  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        return false;
      }

      // Request background location permission for continuous tracking
      const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus.status !== 'granted') {
        console.log('Background location permission denied');
      }

      return true;
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  async getCurrentLocation(): Promise<LocationData | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return null;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        timestamp: new Date(),
      };

      // Try to get address
      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude: locationData.latitude,
          longitude: locationData.longitude,
        });

        if (addresses.length > 0) {
          const addr = addresses[0];
          locationData.address = `${addr.city || addr.district || ''}, ${addr.region || ''}, ${addr.country || ''}`.trim();
        }
      } catch (error) {
        console.log('Error getting address:', error);
      }

      return locationData;
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  async startTracking(callback: (location: LocationData) => void): Promise<boolean> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return false;

      if (this.isTracking) {
        console.log('Location tracking already active');
        return true;
      }

      this.watchId = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 30000, // Update every 30 seconds
          distanceInterval: 10, // Update every 10 meters
        },
        (location) => {
          const locationData: LocationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
            timestamp: new Date(),
          };

          this.locationHistory.push(locationData);
          
          // Keep only last 50 locations
          if (this.locationHistory.length > 50) {
            this.locationHistory = this.locationHistory.slice(-50);
          }

          callback(locationData);
          this.sendLocationUpdate(locationData);
        }
      );

      this.isTracking = true;
      await Storage.setItem('locationTracking', 'true');
      console.log('Location tracking started');
      return true;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      return false;
    }
  }

  async stopTracking(): Promise<void> {
    try {
      if (this.watchId) {
        this.watchId.remove();
        this.watchId = null;
      }
      this.isTracking = false;
      await Storage.setItem('locationTracking', 'false');
      console.log('Location tracking stopped');
    } catch (error) {
      console.error('Error stopping location tracking:', error);
    }
  }

  private async sendLocationUpdate(location: LocationData): Promise<void> {
    try {
      const user = await Storage.getJsonItem('user');
      const token = await Storage.getItem('token');
      
      if (!user || !token) return;

      const locationUpdate: LocationUpdate = {
        touristId: user.walletId || user._id,
        deviceId: 'mobile-app', // You can generate a unique device ID
        locations: [{
          lat: location.latitude,
          lon: location.longitude,
          speed: 0, // You can calculate speed from previous locations
          accuracy: location.accuracy,
          ts: location.timestamp.toISOString(),
        }]
      };

      // Send to backend (implement your API call here)
      console.log('Sending location update:', locationUpdate);
      
      // Example API call:
      // await axios.post('/api/tourist/location', locationUpdate, {
      //   headers: { Authorization: `Bearer ${token}` }
      // });

    } catch (error) {
      console.error('Error sending location update:', error);
    }
  }

  getLocationHistory(): LocationData[] {
    return [...this.locationHistory];
  }

  isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  async getStoredTrackingPreference(): Promise<boolean> {
    try {
      const stored = await Storage.getItem('locationTracking');
      return stored === 'true';
    } catch (error) {
      return false;
    }
  }

  calculateDistance(loc1: LocationData, loc2: LocationData): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (loc1.latitude * Math.PI) / 180;
    const φ2 = (loc2.latitude * Math.PI) / 180;
    const Δφ = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
    const Δλ = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  calculateSpeed(loc1: LocationData, loc2: LocationData): number {
    const distance = this.calculateDistance(loc1, loc2);
    const timeDiff = (loc2.timestamp.getTime() - loc1.timestamp.getTime()) / 1000; // seconds
    return timeDiff > 0 ? distance / timeDiff : 0; // m/s
  }
}

export default new LocationService();