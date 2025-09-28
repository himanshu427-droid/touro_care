import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MapPin, TriangleAlert as AlertTriangle, Shield, Clock, Navigation, Activity, Users, Phone } from 'lucide-react-native';
import * as Location from 'expo-location';
import { useAppContext } from '../context/AppContext';

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  timestamp: Date;
}

interface SafetyAlert {
  id: string;
  type: 'warning' | 'info' | 'danger';
  message: string;
  time: string;
  location?: string;
}

interface TripStats {
  daysRemaining: number;
  placesVisited: number;
  safetyChecks: number;
  emergencyContacts: number;
}

export default function Dashboard() {
  const { user } = useAppContext();
  const [location, setLocation] = useState<LocationData | null>(null);
  const [safetyScore, setSafetyScore] = useState(85);
  const [isTracking, setIsTracking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [locationHistory, setLocationHistory] = useState<LocationData[]>([]);
  
  const [alerts, setAlerts] = useState<SafetyAlert[]>([
    {
      id: '1',
      type: 'info',
      message: 'Welcome to Shillong! You are in a safe tourist zone.',
      time: '10:30 AM',
      location: 'Police Bazar, Shillong'
    },
    {
      id: '2',
      type: 'warning', 
      message: 'Approaching restricted area near Umiam Lake after 6 PM.',
      time: '10:25 AM',
      location: 'Umiam Lake Road'
    }
  ]);

  const [tripStats] = useState<TripStats>({
    daysRemaining: 5,
    placesVisited: 3,
    safetyChecks: 12,
    emergencyContacts: 2
  });

  useEffect(() => {
    getLocation();
    const interval = setInterval(() => {
      if (isTracking) {
        getLocation();
      }
    }, 30000); // Update every 30 seconds when tracking

    return () => clearInterval(interval);
  }, [isTracking]);

  const getLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required for safety monitoring.');
        return;
      }

      let locationResult = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const newLocation: LocationData = {
        latitude: locationResult.coords.latitude,
        longitude: locationResult.coords.longitude,
        address: 'Shillong, Meghalaya, India',
        timestamp: new Date()
      };
      
      setLocation(newLocation);
      
      // Add to location history
      setLocationHistory(prev => [newLocation, ...prev.slice(0, 9)]); // Keep last 10 locations
      
      // Simulate safety score calculation based on location
      const newScore = Math.floor(Math.random() * 20) + 75; // Random score between 75-95
      setSafetyScore(newScore);
      
    } catch (error) {
      console.log('Error getting location:', error);
    }
  };

  const toggleTracking = () => {
    setIsTracking(!isTracking);
    Alert.alert(
      isTracking ? 'Tracking Disabled' : 'Tracking Enabled',
      isTracking 
        ? 'Real-time location sharing has been disabled. Your safety monitoring is now limited.'
        : 'Your location is now being shared with emergency contacts and authorities for safety monitoring.'
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await getLocation();
    // Simulate fetching new alerts
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const getSafetyColor = (score: number) => {
    if (score >= 80) return '#16A34A';
    if (score >= 60) return '#F59E0B';
    return '#DC2626';
  };

  const getSafetyStatus = (score: number) => {
    if (score >= 80) return 'Safe';
    if (score >= 60) return 'Caution';
    return 'High Risk';
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'danger': return '#DC2626';
      case 'warning': return '#F59E0B';
      default: return '#1D4ED8';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Welcome back, {user?.name?.split(' ')[0] || 'Tourist'}</Text>
            <Text style={styles.headerSubtitle}>Tourist ID: {user?.walletId || 'TID-NE-2024-001523'}</Text>
          </View>
          <View style={styles.headerIcon}>
            <Shield size={24} color="#FFFFFF" />
          </View>
        </View>

        {/* Trip Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{tripStats.daysRemaining}</Text>
            <Text style={styles.statLabel}>Days Left</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{tripStats.placesVisited}</Text>
            <Text style={styles.statLabel}>Places Visited</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{tripStats.safetyChecks}</Text>
            <Text style={styles.statLabel}>Safety Checks</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{tripStats.emergencyContacts}</Text>
            <Text style={styles.statLabel}>Emergency Contacts</Text>
          </View>
        </View>

        {/* Safety Score Card */}
        <View style={styles.card}>
          <View style={styles.scoreHeader}>
            <Shield size={24} color={getSafetyColor(safetyScore)} />
            <View style={styles.scoreInfo}>
              <Text style={styles.cardTitle}>Safety Score</Text>
              <Text style={[styles.safetyStatus, { color: getSafetyColor(safetyScore) }]}>
                {getSafetyStatus(safetyScore)}
              </Text>
            </View>
          </View>
          <View style={styles.scoreContainer}>
            <Text style={[styles.scoreText, { color: getSafetyColor(safetyScore) }]}>
              {safetyScore}
            </Text>
            <Text style={styles.scoreLabel}>/ 100</Text>
          </View>
          <Text style={styles.scoreDescription}>
            Based on current location, time, weather conditions, and travel patterns
          </Text>
          <View style={[styles.scoreBar, { backgroundColor: '#F3F4F6' }]}>
            <View 
              style={[
                styles.scoreProgress, 
                { 
                  width: `${safetyScore}%`, 
                  backgroundColor: getSafetyColor(safetyScore) 
                }
              ]} 
            />
          </View>
        </View>

        {/* Current Location */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MapPin size={20} color="#1D4ED8" />
            <Text style={styles.cardTitle}>Current Location</Text>
            <View style={[styles.trackingIndicator, { backgroundColor: isTracking ? '#10B981' : '#6B7280' }]} />
          </View>
          {location ? (
            <View>
              <Text style={styles.locationText}>{location.address}</Text>
              <Text style={styles.coordinates}>
                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </Text>
              <Text style={styles.lastUpdate}>
                Last updated: {formatTime(location.timestamp)}
              </Text>
              <TouchableOpacity 
                style={[
                  styles.trackingButton,
                  isTracking && styles.trackingButtonActive
                ]} 
                onPress={toggleTracking}
              >
                <Navigation size={16} color={isTracking ? '#FFFFFF' : '#1D4ED8'} />
                <Text style={[
                  styles.trackingButtonText, 
                  { color: isTracking ? '#FFFFFF' : '#1D4ED8' }
                ]}>
                  {isTracking ? 'Tracking Active' : 'Enable Tracking'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.loadingContainer}>
              <Activity size={20} color="#6B7280" />
              <Text style={styles.loadingText}>Getting your location...</Text>
            </View>
          )}
        </View>

        {/* Recent Alerts */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <AlertTriangle size={20} color="#F59E0B" />
            <Text style={styles.cardTitle}>Safety Alerts</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          {alerts.map((alert) => (
            <View key={alert.id} style={styles.alertItem}>
              <View style={[styles.alertDot, { backgroundColor: getAlertColor(alert.type) }]} />
              <View style={styles.alertContent}>
                <Text style={styles.alertMessage}>{alert.message}</Text>
                <View style={styles.alertMeta}>
                  <Clock size={12} color="#6B7280" />
                  <Text style={styles.alertTime}>{alert.time}</Text>
                  {alert.location && (
                    <>
                      <Text style={styles.alertSeparator}>•</Text>
                      <MapPin size={12} color="#6B7280" />
                      <Text style={styles.alertLocation}>{alert.location}</Text>
                    </>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Location History */}
        {locationHistory.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MapPin size={20} color="#8B5CF6" />
              <Text style={styles.cardTitle}>Recent Locations</Text>
            </View>
            {locationHistory.slice(0, 3).map((loc, index) => (
              <View key={index} style={styles.historyItem}>
                <View style={styles.historyDot} />
                <View style={styles.historyContent}>
                  <Text style={styles.historyLocation}>{loc.address}</Text>
                  <Text style={styles.historyTime}>
                    {formatTime(loc.timestamp)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity style={[styles.actionButton, styles.emergencyButton]}>
              <Shield size={20} color="#FFFFFF" />
              <Text style={styles.emergencyButtonText}>Emergency Help</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.reportButton]}>
              <AlertTriangle size={20} color="#1D4ED8" />
              <Text style={styles.reportButtonText}>Report Issue</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.quickActions}>
            <TouchableOpacity style={[styles.actionButton, styles.contactButton]}>
              <Phone size={20} color="#10B981" />
              <Text style={styles.contactButtonText}>Call Helpline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.updateButton]}>
              <Users size={20} color="#F59E0B" />
              <Text style={styles.updateButtonText}>Update Trip</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: '#1D4ED8',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#BFDBFE',
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1D4ED8',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
    flex: 1,
  },
  viewAllText: {
    fontSize: 14,
    color: '#1D4ED8',
    fontWeight: '500',
  },
  trackingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreInfo: {
    marginLeft: 12,
    flex: 1,
  },
  safetyStatus: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  scoreText: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  scoreLabel: {
    fontSize: 18,
    color: '#6B7280',
    marginLeft: 4,
  },
  scoreDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  scoreBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreProgress: {
    height: '100%',
    borderRadius: 4,
  },
  locationText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
    marginBottom: 4,
  },
  coordinates: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  lastUpdate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    marginLeft: 8,
  },
  trackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1D4ED8',
    backgroundColor: '#FFFFFF',
  },
  trackingButtonActive: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
  },
  trackingButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertMessage: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 6,
    lineHeight: 20,
  },
  alertMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  alertTime: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  alertSeparator: {
    fontSize: 12,
    color: '#D1D5DB',
    marginHorizontal: 4,
  },
  alertLocation: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8B5CF6',
    marginRight: 12,
  },
  historyContent: {
    flex: 1,
  },
  historyLocation: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  historyTime: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  emergencyButton: {
    backgroundColor: '#DC2626',
  },
  emergencyButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  reportButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#1D4ED8',
  },
  reportButtonText: {
    color: '#1D4ED8',
    fontWeight: '600',
    fontSize: 14,
  },
  contactButton: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  contactButtonText: {
    color: '#10B981',
    fontWeight: '600',
    fontSize: 14,
  },
  updateButton: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  updateButtonText: {
    color: '#F59E0B',
    fontWeight: '600',
    fontSize: 14,
  },
});