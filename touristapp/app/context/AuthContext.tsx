import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../api/auth';
import Storage from '../utils/storage';

interface User {
  _id: string;
  name: string;
  email: string;
  roles: string[];
  org?: string;
  phone?: string;
  kycStatus?: 'not_started' | 'pending' | 'manual_review' | 'verified' | 'failed';
  digitalIdStatus?: 'not_generated' | 'active' | 'deactive';
  walletId?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  loading: true,
  login: async () => false,
  logout: async () => {},
  refreshUser: async () => {},
  isAuthenticated: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      // Import here to avoid circular dependency
      const { loginUser } = await import('../api/auth');
      const response = await loginUser(email, password);
      
      if (response.token && response.user) {
        await Storage.setItem('token', response.token);
        await Storage.setItem('user', JSON.stringify(response.user));
        setUser(response.user);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await Storage.removeItem('token');
      await Storage.removeItem('user');
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await getMe();
      const currentUser = response?.data;
      
      if (currentUser) {
        setUser(currentUser);
        await Storage.setItem('user', JSON.stringify(currentUser));
      } else {
        setUser(null);
        await Storage.removeItem('user');
        await Storage.removeItem('token');
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      // If refresh fails, try to load from storage
      try {
        const storedUser = await Storage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        } else {
          setUser(null);
        }
      } catch (storageError) {
        console.error('Failed to load user from storage:', storageError);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // First, try to load user from storage
        const storedUser = await Storage.getItem('user');
        const storedToken = await Storage.getItem('token');
        
        if (storedUser && storedToken) {
          setUser(JSON.parse(storedUser));
          // Then refresh from server
          await refreshUser();
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ 
      user, 
      setUser, 
      loading, 
      login, 
      logout, 
      refreshUser, 
      isAuthenticated 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;