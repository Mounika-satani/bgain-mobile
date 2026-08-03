import axios from 'axios';
import AsyncStorage from './storage';
import { Platform } from 'react-native';

export const BASE_URL = Platform.OS === 'android'
    ? 'https://bgain-backend-1.onrender.com/api/'
    : 'http://localhost:8000/api/';

const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

let onUnauthorized = null;

export const registerUnauthorizedHandler = (handler) => {
    onUnauthorized = handler;
};

api.interceptors.request.use(
    async (config) => {
        const publicRoutes = ['auth/sessions'];
        const isPublicRoute = config.url ? publicRoutes.some(route => config.url.includes(route)) : false;

        if (!isPublicRoute) {
            try {
                const token = await AsyncStorage.getItem('userToken');
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
            } catch (error) {
                console.error('Error fetching token from AsyncStorage:', error);
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response) {
            if (error.response.status === 401) {
                if (error.config && error.config.url && error.config.url.includes('auth/sessions')) {
                    return Promise.reject(error);
                }

                console.log('Session expired or unauthorized. Redirecting to login.');

                try {
                    await AsyncStorage.removeItem('userToken');
                    await AsyncStorage.removeItem('adminData');
                } catch (storageError) {
                    console.error('Error clearing storage:', storageError);
                }

                if (onUnauthorized) {
                    onUnauthorized();
                }
            } else if (error.response.status === 403) {
                console.log('Access denied: Subscription missing or restricted.');

                if (onUnauthorized) {
                    onUnauthorized(true);
                }
            }
        }
        return Promise.reject(error);
    }
);

export default api;
