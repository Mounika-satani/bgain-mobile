import api from './api';

export const getDashboardOverview = async () => {
    const res = await api.get('dashboard/overview');
    return res.data;
};
