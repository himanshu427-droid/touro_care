// touristapp/app/(tabs)/settings.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from "expo-router"
import { 
  Settings as SettingsIcon, 
  Globe, 
  Shield, 
  Bell, 
  MapPin, 
  User, 
  LogOut,
  ChevronRight,
  Moon,
  Volume2
} from 'lucide-react-native';
import Storage from "../utils/storage"; 
import { useAppContext } from '../context/AppContext';

interface SettingsOption {
  id: string;
  title: string;
  subtitle?: string;
  type: 'switch' | 'select' | 'action';
  value?: boolean | string;
  icon: React.ReactNode;
}

export default function Settings() {
  const { user, loading, logout } = useAppContext();
  const [locationTracking, setLocationTracking] = useState(true);
  const [emergencyAlerts, setEmergencyAlerts] = useState(true);
  const [voiceAlerts, setVoiceAlerts] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('English');

  const languages = [
    'English', 'हिंदी (Hindi)', 'অসমীয়া (Assamese)', 
    'বাংলা (Bengali)', 'मैथिली (Maithili)', 'मणिपुरी (Manipuri)',
    'मिज़ो (Mizo)', 'नागा (Nagamese)', 'नेपाली (Nepali)', 
    'ওড়িয়া (Odia)', 'संथाली (Santali)', 'ত্রিপুরি (Tripuri)'
  ];

  const settingsData: SettingsOption[] = [
    {
      id: 'location',
      title: 'Location Tracking',
      subtitle: 'Allow real-time location monitoring for safety',
      type: 'switch',
      value: locationTracking,
      icon: <MapPin size={20} color="#1D4ED8" />
    },
    {
      id: 'alerts',
      title: 'Emergency Alerts',
      subtitle: 'Receive safety and geo-fencing notifications',
      type: 'switch',
      value: emergencyAlerts,
      icon: <Bell size={20} color="#DC2626" />
    },
    {
      id: 'voice',
      title: 'Voice Alerts',
      subtitle: 'Enable voice notifications for accessibility',
      type: 'switch',
      value: voiceAlerts,
      icon: <Volume2 size={20} color="#16A34A" />
    },
    {
      id: 'darkmode',
      title: 'Dark Mode',
      subtitle: 'Use dark theme for better visibility',
      type: 'switch',
      value: darkMode,
      icon: <Moon size={20} color="#6B7280" />
    }
  ];

  const handleLanguageSelect = () => {
    Alert.alert(
      'Select Language',
      'Choose your preferred language',
      languages.map(lang => ({
        text: lang,
        onPress: () => setSelectedLanguage(lang)
      }))
    );
  };

  const handleProfileUpdate = () => {
    Alert.alert(
      'Update Profile',
      'This will open the profile update form where you can modify your personal information, emergency contacts, and travel details.',
      [{ text: 'OK' }]
    );
  };

  const handlePrivacySettings = () => {
    Alert.alert(
      'Privacy & Security',
      'Configure your privacy settings, data sharing preferences, and view blockchain verification details.',
      [{ text: 'OK' }]
    );
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const handleSwitchToggle = (id: string, value: boolean) => {
    switch (id) {
      case 'location':
        setLocationTracking(value);
        if (!value) {
          Alert.alert(
            'Location Tracking Disabled',
            'Warning: Disabling location tracking will reduce the effectiveness of safety monitoring and emergency response.',
            [{ text: 'Understood' }]
          );
        }
        break;
      case 'alerts':
        setEmergencyAlerts(value);
        break;
      case 'voice':
        setVoiceAlerts(value);
        break;
      case 'darkmode':
        setDarkMode(value);
        break;
    }
  };

  // Show loading while context is loading
  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#1D4ED8" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  // Only redirect if we're sure there's no user and no token
  useEffect(() => {
    const checkAuth = async () => {
      const token = await Storage.getItem('token');
      if (!loading && !user && !token) {
        router.replace('/(auth)/login');
      }
    };
    checkAuth();
  }, [loading, user]);

  const renderUserInfo = () => {
    if (!user) {
      return (
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.profileImageContainer}>
              <User size={32} color="#6B7280" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>Loading user...</Text>
              <Text style={styles.profileId}>Please wait</Text>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.profileImageContainer}>
            <User size={32} color="#6B7280" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user.name}</Text>
            <Text style={styles.profileId}>ID: {user.walletId}</Text>
            <Text style={[
              styles.profileStatus,
              { color: user.kycStatus === 'verified' ? '#16A34A' : '#DC2626' }
            ]}>
              {user.kycStatus === 'verified' ? '✓ Verified Tourist' : 'Verification Pending'}
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.updateButton} 
          onPress={handleProfileUpdate}
        >
          <Text style={styles.updateButtonText}>Update Profile</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Configure your safety preferences</Text>
        </View>

        {/* User Profile Section */}
        {renderUserInfo()}

        {/* Language Selection */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.languageSelector} onPress={handleLanguageSelect}>
            <Globe size={20} color="#1D4ED8" />
            <View style={styles.selectorContent}>
              <Text style={styles.selectorTitle}>Language / भाषा</Text>
              <Text style={styles.selectorValue}>{selectedLanguage}</Text>
            </View>
            <ChevronRight size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Settings Options */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Safety & Notifications</Text>
          {settingsData.map((setting) => (
            <View key={setting.id} style={styles.settingItem}>
              {setting.icon}
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>{setting.title}</Text>
                {setting.subtitle && (
                  <Text style={styles.settingSubtitle}>{setting.subtitle}</Text>
                )}
              </View>
              <Switch
                value={setting.value as boolean}
                onValueChange={(value) => handleSwitchToggle(setting.id, value)}
                trackColor={{ false: '#E5E7EB', true: '#BFDBFE' }}
                thumbColor={setting.value ? '#1D4ED8' : '#FFFFFF'}
              />
            </View>
          ))}
        </View>

        {/* Additional Options */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account & Security</Text>
          
          <TouchableOpacity style={styles.actionItem} onPress={handlePrivacySettings}>
            <Shield size={20} color="#16A34A" />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Privacy & Security</Text>
              <Text style={styles.actionSubtitle}>Blockchain verification, data sharing</Text>
            </View>
            <ChevronRight size={20} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem}>
            <Bell size={20} color="#F59E0B" />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Emergency Contacts</Text>
              <Text style={styles.actionSubtitle}>Manage your emergency contact list</Text>
            </View>
            <ChevronRight size={20} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem}>
            <MapPin size={20} color="#8B5CF6" />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Trip Management</Text>
              <Text style={styles.actionSubtitle}>View and modify travel itinerary</Text>
            </View>
            <ChevronRight size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* App Information */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Information</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email || 'Not available'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{user?.phone || 'Not available'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>KYC Status</Text>
              <Text style={[styles.infoValue, { color: user?.kycStatus === 'verified' ? '#16A34A' : '#DC2626' }]}>
                {user?.kycStatus?.replace('_', ' ').toUpperCase() || 'NOT STARTED'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Joined</Text>
              <Text style={styles.infoValue}>
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color="#DC2626" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            🇮🇳 Government of India{'\n'}
            Ministry of Development of North Eastern Region
          </Text>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center'
  },
  header: {
    backgroundColor: '#1D4ED8',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
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
  profileCard: {
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
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  profileId: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  profileStatus: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '500',
  },
  updateButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  updateButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1D4ED8',
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  selectorContent: {
    flex: 1,
    marginLeft: 12,
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  selectorValue: {
    fontSize: 14,
    color: '#6B7280',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingContent: {
    flex: 1,
    marginLeft: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  actionContent: {
    flex: 1,
    marginLeft: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoGrid: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#DC2626',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
  }
});