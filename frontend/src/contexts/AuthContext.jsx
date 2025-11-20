import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null);

  // Auto-logout dopo 30 minuti di inattività
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minuti in millisecondi
  const [inactivityTimer, setInactivityTimer] = useState(null);

  // Carica token e user dal localStorage all'avvio
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem('accessToken');
        const storedRefreshToken = localStorage.getItem('refreshToken');

        if (storedToken) {
          setAccessToken(storedToken);

          // Verifica il token chiamando /api/auth/me
          try {
            const { data } = await authAPI.getMe(storedToken);
            setUser(data);
          } catch (error) {
            // Token non valido o scaduto, prova il refresh
            if (storedRefreshToken) {
              try {
                const { data } = await authAPI.refresh(storedRefreshToken);
                setAccessToken(data.accessToken);
                localStorage.setItem('accessToken', data.accessToken);

                // Riprova a caricare i dati utente
                const { data: userData } = await authAPI.getMe(data.accessToken);
                setUser(userData);
              } catch (refreshError) {
                // Refresh fallito, logout
                console.error('Refresh token failed:', refreshError);
                logout();
              }
            } else {
              logout();
            }
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Gestione auto-logout per inattività
  useEffect(() => {
    // Solo se l'utente è autenticato
    if (!user) {
      return;
    }

    const resetTimer = () => {
      // Cancella il timer precedente
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }

      // Imposta un nuovo timer
      const newTimer = setTimeout(() => {
        console.log('Auto-logout per inattività dopo 30 minuti');
        logout();
      }, INACTIVITY_TIMEOUT);

      setInactivityTimer(newTimer);
    };

    // Inizializza il timer
    resetTimer();

    // Eventi da monitorare per rilevare l'attività dell'utente
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    // Aggiungi event listeners
    events.forEach(event => {
      document.addEventListener(event, resetTimer);
    });

    // Cleanup: rimuovi event listeners e cancella il timer
    return () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [user, inactivityTimer]);

  const login = async (username, password) => {
    try {
      const { data } = await authAPI.login(username, password);

      // Salva i token
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);

      setAccessToken(data.accessToken);
      setUser(data.user);

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Errore durante il login'
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setAccessToken(null);
    setUser(null);
  };

  const refreshAccessToken = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      logout();
      return null;
    }

    try {
      const { data } = await authAPI.refresh(refreshToken);
      localStorage.setItem('accessToken', data.accessToken);
      setAccessToken(data.accessToken);
      return data.accessToken;
    } catch (error) {
      console.error('Refresh token error:', error);
      logout();
      return null;
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await authAPI.changePassword(accessToken, currentPassword, newPassword);
      return { success: true };
    } catch (error) {
      console.error('Change password error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Errore durante il cambio password'
      };
    }
  };

  // Utility functions
  const isAuthenticated = () => !!user && !!accessToken;

  const hasRole = (...roles) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const isSuperAdmin = () => user?.role === 'super_admin';
  const isAdmin = () => user?.role === 'admin' || user?.role === 'super_admin';
  const isGestore = () => hasRole('super_admin', 'admin', 'gestore');
  const isInquilino = () => user?.role === 'inquilino';

  const canAccessSection = (section) => {
    if (!user) return false;

    const permissions = {
      dashboard: ['super_admin', 'admin', 'gestore', 'inquilino'],
      readings: ['super_admin', 'admin', 'gestore'],
      bills: ['super_admin', 'admin', 'gestore'],
      reports: ['super_admin', 'admin', 'gestore', 'inquilino'],
      payments: ['super_admin', 'admin', 'gestore', 'inquilino'],
      settings: ['super_admin', 'admin'],
      users: ['super_admin', 'admin']
    };

    return permissions[section]?.includes(user.role) || false;
  };

  const value = {
    user,
    accessToken,
    loading,
    login,
    logout,
    refreshAccessToken,
    changePassword,
    isAuthenticated,
    hasRole,
    isSuperAdmin,
    isAdmin,
    isGestore,
    isInquilino,
    canAccessSection
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
