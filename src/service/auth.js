import api from './api';

export const loginUser = async (email, password, role) => {
    const res = await api.post('auth/sessions', { email, password, role });
    return res.data;
};

export const signupUser = async (email, password, role = 'viewer') => {
    const res = await api.post('auth/accounts', { email, password, role });
    return res.data;
};

export const getProfile = async () => {
    const res = await api.get('auth/profile');
    return res.data;
};

export const listAllUsers = async (page = 1, limit = 5) => {
    const res = await api.get('auth/accounts', { params: { page, limit } });
    return res.data;
};

export const createUserByAdmin = async (email, password, role) => {
    const res = await api.post('auth/accounts/create', { email, password, role });
    return res.data;
};

export const deleteUserByAdmin = async (id) => {
    const res = await api.delete(`auth/accounts/${id}`);
    return res.data;
};
