// touristapp/app/(tabs)/index.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, RefreshControl, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MapPin, TriangleAlert as AlertTriangle, Shield, Clock, Navigation, Activity, Users, Phone } from 'lucide-react-native';
import * as Location from 'expo-location';
import { useAppContext } from '../context/AppContext';
import { useRouter, Link } from 'expo-router';
import { getDashboardStats, getAlerts, verifyTourist, updateLocation, triggerEmergency, reportIssue } from '../api/tourist';

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
  const router = useRouter();
  const { user } = useAppContext();
  const [location, setLocation] = useState<LocationData | null>(null);
  const [safetyScore, setSafetyScore] = useState(85);
  const [isTracking, setIsTracking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [locationHistory, setLocationHistory] = useState<LocationData[]>([]);
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [tripStats, setTripStats] = useState<TripStats>({
    daysRemaining: 5,
    placesVisited: 3,
    safetyChecks: 12,
    emergencyContacts: 2
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLocation();
    const interval = setInterval(() => {
      if (isTracking) {
        getLocation();
      }
    }, 30000); // Update every 30 seconds when tracking

    return () => clearInterval(interval);
  }, [isTracking]);

  // Load initial data
  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    console.log('Loading dashboard data for user:', user);
    
    setLoading(true);
    setError(null);

    try {
      // Always start with fallback data
      const fallbackStats = {
        daysRemaining: 5,
        placesVisited: 3,
        safetyChecks: 12,
        emergencyContacts: 2
      };
      
      setTripStats(fallbackStats);
      setSafetyScore(75);
      setAlerts([]);

      // If no user or walletId, use fallback data only
      if (!user?.walletId) {
        console.log('No walletId found, using fallback data only');
        setLoading(false);
        return;
      }

      console.log('Fetching data for walletId:', user.walletId);

      // Try to fetch data with shorter timeout and better error handling
      const fetchWithTimeout = async (apiCall: () => Promise<any>, timeoutMs: number = 5000) => {
        return Promise.race([
          apiCall(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
          )
        ]);
      };

      // Fetch data with individual timeouts
      const [statsRes, alertsRes, verificationRes] = await Promise.allSettled([
        fetchWithTimeout(() => getDashboardStats(), 5000).catch(err => {
          console.error('Stats fetch failed:', err);
          return { success: false, data: fallbackStats };
        }),
        fetchWithTimeout(() => getAlerts(), 5000).catch(err => {
          console.error('Alerts fetch failed:', err);
          return { success: false, data: [] };
        }),
        fetchWithTimeout(() => verifyTourist(user.walletId), 5000).catch(err => {
          console.error('Verification failed:', err);
          return { success: false, data: { additionalInfo: { securityScore: 75 } } };
        })
      ]);

      console.log('API responses:', { statsRes, alertsRes, verificationRes });

      // Update stats if successful
      if (statsRes.status === 'fulfilled' && statsRes.value?.success && statsRes.value.data) {
        setTripStats(statsRes.value.data);
        console.log('Updated stats from API');
      } else {
        console.log('Using fallback stats');
      }

      // Update alerts if successful
      if (alertsRes.status === 'fulfilled' && alertsRes.value?.success && alertsRes.value.data) {
        setAlerts(alertsRes.value.data.map(formatAlert));
        console.log('Updated alerts from API');
      } else {
        console.log('Using fallback alerts');
      }

      // Update safety score if successful
      if (verificationRes.status === 'fulfilled' && 
          verificationRes.value?.success && 
          verificationRes.value.data?.additionalInfo?.securityScore) {
        setSafetyScore(verificationRes.value.data.additionalInfo.securityScore);
        console.log('Updated safety score from API');
      } else {
        console.log('Using fallback safety score');
      }

    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
      setError(error.message);
      
      // Keep fallback data even on error
      console.log('Using fallback data due to error');
    } finally {
      setLoading(false);
    }
  };

  const formatAlert = (alert: any) => ({
    id: alert._id || alert.id || Math.random().toString(),
    type: alert.severity || alert.type || 'info',
    message: alert.message || 'No message',
    time: new Date(alert.createdAt || Date.now()).toLocaleTimeString(),
    location: alert.location?.address || 'Unknown',
  });

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
        timestamp: new Date()
      };
      
      // Update location on server (don't block on this)
      updateLocation({
        lat: newLocation.latitude,
        lon: newLocation.longitude,
        ts: newLocation.timestamp.toISOString(),
        deviceId: 'Device07'
      }).catch(err => console.error('Location update failed:', err));

      setLocation(newLocation);
      
      // Add to location history
      setLocationHistory(prev => [newLocation, ...prev.slice(0, 9)]);
      
    } catch (error) {
      console.error('Error getting location:', error);
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
    await loadDashboardData();
    setRefreshing(false);
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

  // Handle emergency button
  const handleEmergency = async () => {
    let currentPosition = location;
    if (!currentPosition) {
      Alert.alert("Locating...", "Getting your current position for the SOS call.");
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is required to send an SOS alert.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      currentPosition = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, timestamp: new Date() };
      setLocation(currentPosition);
    }

    Alert.alert(
      'Confirm SOS',
      'Are you sure you want to send an emergency alert to authorities and your contacts?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'YES, I NEED HELP',
          onPress: async () => {
            try {
              await triggerEmergency({
                location: { lat: currentPosition!.latitude, lon: currentPosition!.longitude },
                message: 'SOS from Touro-Care App!'
            });
              Alert.alert('SOS Sent!', 'Help is on the way. Your emergency contacts and local authorities have been notified.');
            } catch (e) {
              Alert.alert('SOS Failed', 'Could not send the alert. Please try again or call for help directly.');
            }
          },
          style: 'destructive'
        }
      ]
    );
  };

  // Handle report issue
  const handleReportIssue = () => {
    router.push('/(auth)/report-issue' as any);
  };

  // Handle call helpline
  const handleCallHelpline = () => {
    Linking.openURL('tel:+911234567890');
  };

  // Handle trip update
  const handleUpdateTrip = () => {
    router.push('/(auth)/trip-details');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1D4ED8" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

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

        {/* Error Banner */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>
              ⚠️ Using offline data. Some features may be limited.
            </Text>
          </View>
        )}

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
              <Text style={styles.locationText}>{location.address || 'Location acquired'}</Text>
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
          {alerts.length > 0 ? alerts.map((alert) => (
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
          )) : (
            <Text style={styles.noAlertsText}>No recent alerts</Text>
          )}
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
                  <Text style={styles.historyLocation}>{loc.address || 'Location acquired'}</Text>
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
            <TouchableOpacity 
              style={[styles.actionButton, styles.emergencyButton]}
              onPress={handleEmergency}
            >
              <Shield size={20} color="#FFFFFF" />
              <Text style={styles.emergencyButtonText}>Emergency Help</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.reportButton]}
              onPress={handleReportIssue}
            >
              <AlertTriangle size={20} color="#1D4ED8" />
              <Text style={styles.reportButtonText}>Report Issue</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.contactButton]}
              onPress={handleCallHelpline}
            >
              <Phone size={20} color="#10B981" />
              <Text style={styles.contactButtonText}>Call Helpline</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.updateButton]}
              onPress={handleUpdateTrip}
            >
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
  centered: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 20
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center'
  },
  errorBanner: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B'
  },
  errorBannerText: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '500'
  },
  noAlertsText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20
  },
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