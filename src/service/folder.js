import api from './api';

export const browseFolder = async (folderId = null, page = 1, limit = 50, search = '') => {
    const params = { page, limit };
    if (folderId) params.folderId = folderId;
    if (search) params.search = search;

    const res = await api.get('folders', { params });
    return res.data;
};

export const getFolderTree = async () => {
    const res = await api.get('folders/tree');
    return res.data;
};

export const createFolder = async (name, parentId = null) => {
    const res = await api.post('folders', { name, parentId });
    return res.data;
};

export const updateFolder = async (id, name, parentId = undefined) => {
    const payload = { name };
    if (parentId !== undefined) payload.parentId = parentId;

    const res = await api.put(`folders/${id}`, payload);
    return res.data;
};

export const deleteFolder = async (id) => {
    const res = await api.delete(`folders/${id}`);
    return res.data;
};
