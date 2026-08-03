import React, { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet,
    TextInput, Modal, Alert, FlatList, ActivityIndicator,
    Keyboard,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { listAllUsers, createUserByAdmin, deleteUserByAdmin } from '../service/auth';
import PageLoader from '../components/PageLoader';
import CustomAlertModal from '../components/CustomAlertModal';

const INITIAL_USERS = [
    { id: '1', email: 'admin@bgain.io', role: 'admin', date: 'Jan 15, 2024' },
    { id: '2', email: 'sarah.johnson@bgain.io', role: 'viewer', date: 'Feb 3, 2024' },
    { id: '3', email: 'mike.chen@bgain.io', role: 'admin', date: 'Feb 18, 2024' },
    { id: '4', email: 'emily.r@bgain.io', role: 'viewer', date: 'Mar 7, 2024' },
    { id: '5', email: 'david.l@bgain.io', role: 'viewer', date: 'Mar 22, 2024' },
    { id: '6', email: 'ops@bgain.io', role: 'admin', date: 'Apr 1, 2024' },
];

const CreateUserModal = ({ visible, onClose, onCreate, existingEmails }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('viewer');
    const [error, setError] = useState('');
    const [kbHeight, setKbHeight] = useState(0);

    useEffect(() => {
        const show = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height));
        const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
        return () => { show.remove(); hide.remove(); };
    }, []);

    const reset = () => { setEmail(''); setPassword(''); setRole('viewer'); setError(''); };

    const handleCreate = () => {
        if (!email.trim()) { setError('Email is required'); return; }
        if (!/\S+@\S+\.\S+/.test(email)) { setError('Enter a valid email address'); return; }
        if (existingEmails.includes(email.toLowerCase())) { setError('An account with this email already exists'); return; }
        if (!password || password.length < 6) { setError('Password must be at least 6 characters'); return; }
        onCreate({ email: email.trim(), password, role });
        reset();
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => { reset(); onClose(); }}>
                <View style={[styles.modalCard, { marginBottom: kbHeight }]}>
                    <View style={styles.modalHeader}>
                        <View style={[styles.modalIconWrap, { backgroundColor: COLORS.primary + '33' }]}>
                            <Feather name="user-plus" size={20} color={COLORS.primaryLight} />
                        </View>
                        <View>
                            <Text style={styles.modalTitle}>Create New Account</Text>
                            <Text style={styles.modalSub}>Add Admin or Viewer user</Text>
                        </View>
                        <TouchableOpacity onPress={() => { reset(); onClose(); }} style={{ marginLeft: 'auto' }}>
                            <Feather name="x" size={20} color={COLORS.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {!!error && (
                        <View style={styles.errorBox}>
                            <Feather name="alert-circle" size={15} color={COLORS.danger} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    {/* Email */}
                    <Text style={styles.fieldLabel}>Email Address</Text>
                    <View style={styles.inputWrap}>
                        <Feather name="mail" size={16} color={COLORS.textMuted} />
                        <TextInput
                            style={styles.input}
                            placeholder="user@organization.com"
                            placeholderTextColor={COLORS.textMuted}
                            value={email}
                            onChangeText={t => { setEmail(t); setError(''); }}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    {/* Password */}
                    <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Initial Password</Text>
                    <View style={styles.inputWrap}>
                        <Feather name="key" size={16} color={COLORS.textMuted} />
                        <TextInput
                            style={styles.input}
                            placeholder="At least 6 characters"
                            placeholderTextColor={COLORS.textMuted}
                            value={password}
                            onChangeText={t => { setPassword(t); setError(''); }}
                            secureTextEntry
                        />
                    </View>

                    {/* Role */}
                    <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Assigned Role</Text>
                    <View style={styles.roleRow}>
                        <TouchableOpacity
                            style={[styles.roleChip, role === 'viewer' && styles.roleChipActive]}
                            onPress={() => setRole('viewer')}
                        >
                            <Feather name="eye" size={15} color={role === 'viewer' ? '#fff' : COLORS.textMuted} />
                            <Text style={[styles.roleChipText, role === 'viewer' && { color: '#fff' }]}>Viewer</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.roleChip, role === 'admin' && styles.roleChipActive]}
                            onPress={() => setRole('admin')}
                        >
                            <Feather name="shield" size={15} color={role === 'admin' ? '#fff' : COLORS.textMuted} />
                            <Text style={[styles.roleChipText, role === 'admin' && { color: '#fff' }]}>Admin</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.modalFooter}>
                        <TouchableOpacity style={styles.btnCancel} onPress={() => { reset(); onClose(); }}>
                            <Text style={styles.btnCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.btnPrimary} onPress={handleCreate}>
                            <Feather name="user-plus" size={15} color="#fff" />
                            <Text style={styles.btnPrimaryText}>Create User</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const UsersScreen = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState('');
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [showCreate, setShowCreate] = useState(false);
    const [toast, setToast] = useState(null);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const LIMIT = 5;

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchUsers = async (fetchPage = 1) => {
        try {
            setLoading(true);
            setFetchError('');
            const data = await listAllUsers(fetchPage, LIMIT);
            const formatted = (data.users || []).map(u => ({
                ...u,
                date: new Date(u.createdAt).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                })
            }));
            setUsers(formatted);
            setHasMore(data.hasMore);
            setTotal(data.total || 0);
            setPage(fetchPage);
        } catch (err) {
            console.error('Error fetching users:', err);
            setFetchError(err.response?.data?.error || 'Failed to load users.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers(1);
    }, []);

    const handlePrev = () => {
        if (page > 1) {
            fetchUsers(page - 1);
        }
    };

    const handleNext = () => {
        if (hasMore) {
            fetchUsers(page + 1);
        }
    };

    const [alertConfig, setAlertConfig] = useState(null);

    const showAlert = (title, message, type = 'error', onConfirm = null) => {
        setAlertConfig({ visible: true, title, message, type, onConfirm });
    };

    const handleCreate = async ({ email, password, role }) => {
        try {
            const data = await createUserByAdmin(email, password, role);
            const newUser = {
                ...data.user,
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            };
            setUsers(p => [newUser, ...p]);
            showAlert('User Created', `Account for "${email}" with role "${role.toUpperCase()}" created successfully.`, 'success');
        } catch (err) {
            const msg = err.response?.data?.error || 'Failed to create user.';
            showAlert('User Creation Error', msg, 'error');
        }
    };

    const handleDelete = (user) => {
        showAlert(
            'Delete Account',
            `Are you sure you want to delete "${user.email}"? They will immediately lose access to the workspace.`,
            'warning',
            async () => {
                try {
                    await deleteUserByAdmin(user.id);
                    setUsers(p => p.filter(u => u.id !== user.id));
                    showAlert('Account Deleted', `User account ${user.email} was permanently deleted.`, 'info');
                } catch (err) {
                    const msg = err.response?.data?.error || 'Failed to delete user.';
                    showAlert('Deletion Error', msg, 'error');
                }
            }
        );
    };

    const filtered = users.filter(u => {
        const matchSearch = (u.email || '').toLowerCase().includes(search.toLowerCase());
        const matchRole = roleFilter === 'all' || u.role === roleFilter;
        return matchSearch && matchRole;
    });

    const totalPages = Math.ceil(total / LIMIT) || 1;

    return (
        <View style={styles.root}>
            {/* Toast */}
            {toast && (
                <View style={[styles.toast, toast.type === 'error' ? styles.toastError : styles.toastSuccess]}>
                    <Feather name={toast.type === 'error' ? 'x-circle' : 'check-circle'} size={15} color="#fff" />
                    <Text style={styles.toastText}>{toast.msg}</Text>
                </View>
            )}

            {/* Header */}
            <View style={styles.pageHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.pageTitle}>User Management</Text>
                    <Text style={styles.pageSub}>Create & manage Admins and Viewers</Text>
                </View>
                <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
                    <Feather name="user-plus" size={16} color="#fff" />
                    <Text style={styles.createBtnText}>Create</Text>
                </TouchableOpacity>
            </View>

            {/* Search & Filter */}
            <View style={styles.toolbar}>
                <View style={styles.searchWrap}>
                    <Feather name="search" size={15} color={COLORS.textMuted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by email…"
                        placeholderTextColor={COLORS.textMuted}
                        value={search}
                        onChangeText={setSearch}
                    />
                    {!!search && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Feather name="x" size={14} color={COLORS.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Role Chips */}
            <View style={styles.filterRow}>
                {['all', 'admin', 'viewer'].map(r => (
                    <TouchableOpacity
                        key={r}
                        style={[styles.filterChip, roleFilter === r && styles.filterChipActive]}
                        onPress={() => setRoleFilter(r)}
                    >
                        <Text style={[styles.filterChipText, roleFilter === r && styles.filterChipTextActive]}>
                            {r === 'all' ? `All (${users.length})` : r === 'admin' ? `Admins (${users.filter(u => u.role === 'admin').length})` : `Viewers (${users.filter(u => u.role === 'viewer').length})`}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* User List */}
            <FlatList
                data={filtered}
                keyExtractor={u => u.id}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    loading ? (
                        <PageLoader message="Loading user accounts..." />
                    ) : fetchError ? (
                        <View style={styles.emptyState}>
                            <Feather name="x-circle" size={48} color={COLORS.danger} />
                            <Text style={styles.emptyTitle}>Failed to load users</Text>
                            <Text style={styles.emptyText}>{fetchError}</Text>
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Feather name="users" size={48} color={COLORS.border} />
                            <Text style={styles.emptyTitle}>No users found</Text>
                            <Text style={styles.emptyText}>{search ? `No results for "${search}"` : 'No users in this role'}</Text>
                        </View>
                    )
                }
                renderItem={({ item: u }) => (
                    <View style={styles.userCard}>
                        <View style={[styles.avatar, u.role === 'admin' ? styles.avatarAdmin : styles.avatarViewer]}>
                            <Text style={styles.avatarLetter}>{(u.email || 'U').charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={styles.userInfo}>
                            <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text>
                            <Text style={styles.userDate}>Joined {u.date}</Text>
                        </View>
                        <View style={styles.userRight}>
                            <View style={[styles.roleBadge, u.role === 'admin' ? styles.roleBadgeAdmin : styles.roleBadgeViewer]}>
                                <Feather name={u.role === 'admin' ? 'shield' : 'eye'} size={10} color={u.role === 'admin' ? '#7C3AED' : '#0891b2'} />
                                <Text style={[styles.roleBadgeText, u.role === 'admin' ? { color: '#7C3AED' } : { color: '#0891b2' }]}>
                                    {u.role}
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(u)}>
                                <Feather name="trash-2" size={15} color={COLORS.danger} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                ListFooterComponent={
                    !loading && !fetchError && totalPages > 1 ? (
                        <View style={styles.paginationRow}>
                            <TouchableOpacity
                                style={[styles.paginationBtn, page <= 1 && styles.paginationBtnDisabled]}
                                onPress={handlePrev}
                                disabled={page <= 1}
                            >
                                <Text style={styles.paginationBtnText}>← Prev</Text>
                            </TouchableOpacity>
                            <Text style={styles.paginationInfo}>
                                Page {page} of {totalPages}
                            </Text>
                            <TouchableOpacity
                                style={[styles.paginationBtn, !hasMore && styles.paginationBtnDisabled]}
                                onPress={handleNext}
                                disabled={!hasMore}
                            >
                                <Text style={styles.paginationBtnText}>Next →</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null
                }
            />

            <CreateUserModal
                visible={showCreate}
                onClose={() => setShowCreate(false)}
                onCreate={handleCreate}
                existingEmails={users.map(u => (u.email || '').toLowerCase())}
            />

            {alertConfig && (
                <CustomAlertModal
                    visible={alertConfig.visible}
                    title={alertConfig.title}
                    message={alertConfig.message}
                    type={alertConfig.type}
                    onClose={() => setAlertConfig(null)}
                    onConfirm={alertConfig.onConfirm}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bg },

    toast: {
        position: 'absolute', top: 60, left: 20, right: 20, zIndex: 999,
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
    },
    toastSuccess: { backgroundColor: '#0d6e44' },
    toastError: { backgroundColor: '#7f1d1d' },
    toastText: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },

    pageHeader: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10,
    },
    pageTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textWhite },
    pageSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
    createBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: COLORS.primary, borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 9,
        shadowColor: COLORS.primary, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5,
    },
    createBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

    toolbar: { paddingHorizontal: 20, paddingBottom: 10 },
    searchWrap: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: COLORS.bgInput, borderRadius: 12, borderWidth: 1,
        borderColor: COLORS.border, paddingHorizontal: 12, height: 42,
    },
    searchInput: { flex: 1, color: COLORS.text, fontSize: 14 },

    filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 10 },
    filterChip: {
        paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
        backgroundColor: COLORS.bgInput, borderWidth: 1, borderColor: COLORS.border,
    },
    filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    filterChipText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
    filterChipTextActive: { color: '#fff' },

    list: { paddingHorizontal: 20, paddingBottom: 30 },
    userCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: COLORS.bgCard, borderRadius: 14,
        borderWidth: 1, borderColor: COLORS.border,
        padding: 14, marginBottom: 10,
    },
    avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    avatarAdmin: { backgroundColor: '#3b1d8a' },
    avatarViewer: { backgroundColor: '#164e63' },
    avatarLetter: { color: '#fff', fontSize: 17, fontWeight: '800' },
    userInfo: { flex: 1 },
    userEmail: { fontSize: 13, fontWeight: '600', color: COLORS.text },
    userDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
    userRight: { alignItems: 'flex-end', gap: 8 },
    roleBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
    },
    roleBadgeAdmin: { backgroundColor: '#f3e8ff' },
    roleBadgeViewer: { backgroundColor: '#ecfeff' },
    roleBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    deleteBtn: {
        padding: 6, borderRadius: 8,
        backgroundColor: COLORS.danger + '22',
    },

    emptyState: { alignItems: 'center', paddingTop: 60 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textMuted, marginTop: 16 },
    emptyText: { fontSize: 13, color: COLORS.border, marginTop: 6 },

    overlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
    modalCard: {
        backgroundColor: COLORS.bgCard,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 20, paddingBottom: 36,
        borderTopWidth: 1, borderColor: COLORS.border,
    },
    modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    modalIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textWhite },
    modalSub: { fontSize: 12, color: COLORS.textMuted },
    errorBox: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#fee2e2', borderRadius: 10, padding: 10,
        marginBottom: 12, borderWidth: 1, borderColor: '#fca5a5',
    },
    errorText: { color: COLORS.danger, fontSize: 13, flex: 1 },
    fieldLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    inputWrap: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: COLORS.bgInput, borderRadius: 12, borderWidth: 1.5,
        borderColor: COLORS.border, paddingHorizontal: 14, height: 46,
    },
    input: { flex: 1, color: COLORS.text, fontSize: 15 },
    roleRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    roleChip: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
        backgroundColor: COLORS.bgInput, borderColor: COLORS.border,
    },
    roleChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    roleChipText: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
    modalFooter: { flexDirection: 'row', gap: 10 },
    btnCancel: {
        flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
        paddingVertical: 12, alignItems: 'center',
    },
    btnCancelText: { color: COLORS.textMuted, fontWeight: '600', fontSize: 14 },
    btnPrimary: {
        flex: 2, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
        backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12,
    },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    paginationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 20,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        marginTop: 10,
    },
    paginationBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: COLORS.bgHover,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    paginationBtnDisabled: {
        opacity: 0.5,
    },
    paginationBtnText: {
        color: COLORS.primaryLight,
        fontWeight: '600',
        fontSize: 13,
    },
    paginationInfo: {
        fontSize: 13,
        color: COLORS.textMuted,
        fontWeight: '600',
    },
});

export default UsersScreen;
