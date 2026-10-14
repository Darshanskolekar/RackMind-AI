import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { UserPersona, UserRole, PERSONAS } from '../types/auth';

interface AuthContextType {
  currentUser: UserPersona | null;
  isAuthenticated: boolean;
  loginAs: (personaKey: keyof typeof PERSONAS) => void;
  loginWithSSO: () => void;
  switchPersona: (personaKey: keyof typeof PERSONAS) => void;
  logout: () => void;
  hasPermission: (permissionKey: keyof UserPersona['permissions']) => boolean;
  role: UserRole | null;
}

const AUTH_STORAGE_KEY = 'rackmind_active_persona_v1';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Requirement 4: Zero-Trust Access Gate on initial visit or hard page refresh.
  // Never bypass authentication or auto-login to a default persona.
  const [currentUser, setCurrentUser] = useState<UserPersona | null>(null);

  useEffect(() => {
    if (currentUser) {
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, currentUser.id);
      } catch {
        // ignore
      }
    } else {
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }, [currentUser]);

  const loginAs = useCallback((personaKey: keyof typeof PERSONAS) => {
    const selected = PERSONAS[personaKey];
    if (selected) {
      setCurrentUser(selected);
    }
  }, []);

  const loginWithSSO = useCallback(() => {
    // 1-click BeyondCorp SSO logs in as Lead SRE Darshan
    setCurrentUser(PERSONAS.darshan);
  }, []);

  const switchPersona = useCallback((personaKey: keyof typeof PERSONAS) => {
    const selected = PERSONAS[personaKey];
    if (selected) {
      setCurrentUser(selected);
    }
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
  }, []);

  const hasPermission = useCallback((permissionKey: keyof UserPersona['permissions']) => {
    if (!currentUser) return false;
    return Boolean(currentUser.permissions[permissionKey]);
  }, [currentUser]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        loginAs,
        loginWithSSO,
        switchPersona,
        logout,
        hasPermission,
        role: currentUser?.role || null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
