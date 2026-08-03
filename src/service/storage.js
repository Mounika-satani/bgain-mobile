import AsyncStorage from '@react-native-async-storage/async-storage';

const memoryStorage = {};

const storage = {
    getItem: async (key) => {
        try {
            return await AsyncStorage.getItem(key);
        } catch (e) {
            console.warn('AsyncStorage.getItem failed, using memory fallback:', e.message);
            return memoryStorage[key] || null;
        }
    },
    setItem: async (key, value) => {
        try {
            await AsyncStorage.setItem(key, value);
        } catch (e) {
            console.warn('AsyncStorage.setItem failed, using memory fallback:', e.message);
            memoryStorage[key] = value;
        }
    },
    removeItem: async (key) => {
        try {
            await AsyncStorage.removeItem(key);
        } catch (e) {
            console.warn('AsyncStorage.removeItem failed, using memory fallback:', e.message);
            delete memoryStorage[key];
        }
    }
};

export default storage;
