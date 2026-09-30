'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('jobpilot_access_token') : null;
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
    } catch (err) {
      console.error('Failed to fetch user:', err);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('jobpilot_access_token');
        localStorage.removeItem('jobpilot_refresh_token');
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { user: userData, tokens } = res.data;
    localStorage.setItem('jobpilot_access_token', tokens.access_token);
    localStorage.setItem('jobpilot_refresh_token', tokens.refresh_token);
    setUser(userData);
    return userData;
  };

  const register = async (email, password, full_name) => {
    const res = await api.post('/auth/register', { email, password, full_name });
    const { user: userData, tokens } = res.data;
    localStorage.setItem('jobpilot_access_token', tokens.access_token);
    localStorage.setItem('jobpilot_refresh_token', tokens.refresh_token);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('jobpilot_access_token');
    localStorage.removeItem('jobpilot_refresh_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser: checkUser }}>
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
