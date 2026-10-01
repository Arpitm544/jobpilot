'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Check current session from backend cookie
  const checkUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
    } catch (err) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Multi-tab logout synchronization via BroadcastChannel
  useEffect(() => {
    checkUser();

    let channel;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      channel = new BroadcastChannel('jobpilot_auth_channel');
      channel.onmessage = (event) => {
        if (event.data?.type === 'LOGOUT') {
          setUser(null);
          router.replace('/');
        } else if (event.data?.type === 'LOGIN') {
          checkUser();
        }
      };
    }

    const handleAuthExpired = () => {
      setUser(null);
      if (channel) {
        channel.postMessage({ type: 'LOGOUT' });
      }
    };
    window.addEventListener('jobpilot:auth_expired', handleAuthExpired);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('jobpilot:auth_expired', handleAuthExpired);
    };
  }, [checkUser, router]);

  // Login handler: backend sets HTTP-only cookie automatically
  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      setUser(res.data.user);
      
      // Notify other tabs of login
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('jobpilot_auth_channel');
        channel.postMessage({ type: 'LOGIN' });
        channel.close();
      }
      return res.data.user;
    } finally {
      setIsLoading(false);
    }
  };

  // Signup / Register handler: backend sets HTTP-only cookie automatically
  const register = async (email, password, full_name) => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/register', { email, password, full_name });
      setUser(res.data.user);
      
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('jobpilot_auth_channel');
        channel.postMessage({ type: 'LOGIN' });
        channel.close();
      }
      return res.data.user;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout handler: calls backend POST /auth/logout, invalidates cookie, syncs tabs, redirects to /
  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      console.warn('Logout API error:', e);
    } finally {
      setUser(null);
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('jobpilot_auth_channel');
        channel.postMessage({ type: 'LOGOUT' });
        channel.close();
      }
      router.replace('/');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        loading: isLoading, // backwards compatibility
        isAuthenticated: !!user,
        login,
        register,
        signup: register,
        logout,
        refreshUser: checkUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
