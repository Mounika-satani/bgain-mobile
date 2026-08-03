import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '../service/storage';
import { registerUnauthorizedHandler } from '../service/api';

import PageLoader from '../components/PageLoader';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadStoredData = async () => {
            try {
                const storedToken = await AsyncStorage.getItem('userToken');
                const storedUser = await AsyncStorage.getItem('adminData');
                if (storedToken) setToken(storedToken);
                if (storedUser) setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error('Error loading stored auth data', e);
            } finally {
                setLoading(false);
            }
        };

        loadStoredData();
    }, []);

    useEffect(() => {
        registerUnauthorizedHandler(() => {
            logout();
        });
        return () => registerUnauthorizedHandler(null);
    }, []);

    const login = async (newToken, newUser) => {
        try {
            await AsyncStorage.setItem('userToken', newToken);
            await AsyncStorage.setItem('adminData', JSON.stringify(newUser));
        } catch (e) {
            console.error('Error saving auth data', e);
        }
        setToken(newToken);
        setUser(newUser);
    };

    const logout = async () => {
        try {
            await AsyncStorage.removeItem('userToken');
            await AsyncStorage.removeItem('adminData');
        } catch (e) {
            console.error('Error removing auth data', e);
        }
        setToken(null);
        setUser(null);
    };

    if (loading) {
        return <PageLoader message="Initializing application..." />;
    }

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
};
