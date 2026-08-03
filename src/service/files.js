import api from './api';

export const uploadFile = async (fileObj, folderId = null) => {
    const formData = new FormData();
    formData.append('file', {
        uri: fileObj.uri,
        name: fileObj.name || 'upload',
        type: fileObj.type || 'application/octet-stream',
    });

    if (folderId) {
        formData.append('folderId', folderId);
    } else {
        formData.append('folderId', 'null');
    }

    const res = await api.post('files/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return res.data;
};

export const getFile = async (id) => {
    const res = await api.get(`files/${id}`);
    return res.data;
};

export const downloadFile = async (id) => {
    const res = await api.get(`files/${id}/download`);
    return res;
};

export const updateFile = async (id, name, folderId = undefined) => {
    const payload = { name };
    if (folderId !== undefined) payload.folderId = folderId;

    const res = await api.put(`files/${id}`, payload);
    return res.data;
};

export const deleteFile = async (id) => {
    const res = await api.delete(`files/${id}`);
    return res.data;
};
