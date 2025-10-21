import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../api/auth';
import Storage from '../utils/storage';

// --- (No changes to your User interface) ---
interface User {
  _id: string;
  name: string;
  email: string;
  roles: string[];
  org?: string;
  phone?: string;
  kycStatus?: 'not_started' | 'pending' | 'manual_review' | 'verified' | 'failed';
  digitalIdStatus?: 'not_generated' | 'active' | 'deactive' | '';
  walletId?: string;
  createdAt?: string;
}

// --- (Added logout to the context type) ---
interface AppContextType {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>; // 2. NEW: Added logout function
}

const AppContext = createContext<AppContextType>({
  user: null,
  loading: true,
  refreshUser: async () => {},
  logout: async () => {},
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const token = await Storage.getItem('token');
      if (!token) {
        setUser(null);
        return;
      }

      // Get fresh user data from server
      const response = await getMe();
      if (response.success) {
        const userData = response.data;
        setUser(userData);
        await Storage.setItem('user', JSON.stringify(userData));
      } else {
        throw new Error('Failed to fetch user data');
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
      setUser(null);
      await Storage.removeItem('token');
      await Storage.removeItem('user');
    }
  };

  // Load user data on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const cachedUser = await Storage.getItem('user');
        if (cachedUser) {
          setUser(JSON.parse(cachedUser));
        }
        await refreshUser(); // Always refresh to get latest data
      } catch (err) {
        console.error('Error loading initial data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // 2. NEW: A dedicated logout function
  const logout = async () => {
    setUser(null);
    await Storage.removeItem('user');
    await Storage.removeItem('token');
  };

  return (
    <AppContext.Provider value={{ user, loading, refreshUser, logout }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
