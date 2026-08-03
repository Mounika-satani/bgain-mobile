import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet,
    ActivityIndicator, RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../theme/colors';
import { getDashboardOverview } from '../service/dashboard';
import PageLoader from '../components/PageLoader';

const TOTAL_STORAGE_BYTES = 5 * 1024 * 1024 * 1024;

const fmtSize = (bytes) => {
    if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const inferType = (name = '') => {
    const ext = name.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return 'pdf';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image';
    if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
    if (['csv', 'xlsx', 'xls'].includes(ext)) return 'csv';
    if (['doc', 'docx'].includes(ext)) return 'doc';
    return 'file';
};


const StatCard = ({ label, value, sub, iconName, color }) => (
    <View style={[styles.statCard, { borderColor: color + '40' }]}>
        <View style={[styles.statIconWrap, { backgroundColor: color + '22' }]}>
            <Feather name={iconName} size={18} color={color} />
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statSub}>{sub}</Text>
    </View>
);

const FileRow = ({ file, onPress }) => {
    const type = inferType(file.name);
    const typeIcon = {
        pdf: { name: 'file-text', color: '#f87171' },
        image: { name: 'image', color: '#a78bfa' },
        video: { name: 'video', color: '#60a5fa' },
        csv: { name: 'database', color: '#34d399' },
        doc: { name: 'file', color: '#94a3b8' },
        file: { name: 'file', color: '#94a3b8' },
    }[type];

    return (
        <TouchableOpacity style={styles.fileRow} onPress={onPress} activeOpacity={0.7}>
            <View style={[styles.fileIconWrap, { backgroundColor: typeIcon.color + '22' }]}>
                <Feather name={typeIcon.name} size={16} color={typeIcon.color} />
            </View>
            <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                <Text style={styles.fileMeta}>
                    {fmtSize(file.size)} · {new Date(file.createdAt).toLocaleString()}
                </Text>
            </View>
            <Feather name="chevron-right" size={15} color={COLORS.textMuted} />
        </TouchableOpacity>
    );
};


const DashboardScreen = ({ navigation }) => {
    const { user } = useAuth();
    const displayName = user?.name || user?.email?.split('@')[0] || 'User';

    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const fetchOverview = useCallback(async (isRefresh = false) => {
        try {
            isRefresh ? setRefreshing(true) : setLoading(true);
            setError(null);
            const data = await getDashboardOverview();
            setOverview(data);
        } catch (err) {
            console.error('Dashboard fetch error:', err);
            setError('Failed to load dashboard data.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchOverview(); }, [fetchOverview]);

    const totalStorage = overview?.totalStorageBytes ?? 0;
    const usedPercent = Math.min((totalStorage / TOTAL_STORAGE_BYTES) * 100, 100).toFixed(0);
    const recentFiles = overview?.recentFiles ?? [];

    const stats = [
        {
            label: 'Storage',
            value: fmtSize(totalStorage),
            sub: 'Capacity used',
            iconName: 'hard-drive',
            color: COLORS.primary,
        },
        {
            label: 'Files',
            value: (overview?.totalFiles ?? '—').toLocaleString(),
            sub: 'Across network',
            iconName: 'file',
            color: COLORS.accent,
        },
        {
            label: 'Folders',
            value: (overview?.totalFolders ?? '—').toLocaleString(),
            sub: 'Root & nested',
            iconName: 'folder',
            color: COLORS.success,
        },
    ];

    return (
        <ScrollView
            style={styles.root}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => fetchOverview(true)}
                    tintColor={COLORS.primary}
                />
            }
        >
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.userName}>{displayName}</Text>
                </View>
                <TouchableOpacity style={styles.avatarBtn} onPress={() => navigation.navigate('Profile')}>
                    <Text style={styles.avatarLetter}>{displayName.charAt(0).toUpperCase()}</Text>
                </TouchableOpacity>
            </View>

            {/* Sub heading */}
            <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Overview</Text>
                <Text style={styles.sectionSub}>Here's what's happening with your storage</Text>
            </View>

            {/* Stats */}
            {loading ? (
                <PageLoader message="Loading dashboard overview..." />
            ) : error ? (
                <View style={styles.errorBox}>
                    <Feather name="alert-circle" size={16} color="#f87171" />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity onPress={() => fetchOverview()}>
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.statsRow}
                    >
                        {stats.map((s, i) => <StatCard key={i} {...s} />)}
                    </ScrollView>

                    {/* Storage Usage Bar */}
                    <View style={styles.card}>
                        <View style={styles.cardHeaderRow}>
                            <Feather name="pie-chart" size={15} color={COLORS.primary} />
                            <Text style={styles.cardTitle}>Storage Usage</Text>
                        </View>
                        <View style={styles.usageBar}>
                            <View style={[styles.usageFill, { width: `${usedPercent}%` }]} />
                        </View>
                        <View style={styles.usageLabels}>
                            <Text style={styles.usageLabel}>{fmtSize(totalStorage)} used</Text>
                            <Text style={styles.usageLabel}>{fmtSize(TOTAL_STORAGE_BYTES)} total</Text>
                        </View>
                    </View>

                    {/* Recent Activity */}
                    <View style={[styles.card, { marginBottom: 24 }]}>
                        <View style={styles.cardHeaderRow}>
                            <Feather name="clock" size={15} color={COLORS.primary} />
                            <Text style={styles.cardTitle}>Recent Activity</Text>
                            <TouchableOpacity style={styles.viewAllBtn} onPress={() => navigation.navigate('Files')}>
                                <Text style={styles.viewAllText}>View All</Text>
                            </TouchableOpacity>
                        </View>

                        {recentFiles.length === 0 ? (
                            <Text style={styles.emptyText}>No recent files.</Text>
                        ) : (
                            recentFiles.map(file => (
                                <FileRow
                                    key={file.id}
                                    file={file}
                                    onPress={() => navigation.navigate('Files')}
                                />
                            ))
                        )}
                    </View>
                </>
            )}
        </ScrollView>
    );
};


const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bg },
    scroll: { paddingBottom: 24 },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10,
    },
    greeting: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
    userName: { fontSize: 22, fontWeight: '800', color: COLORS.textWhite, marginTop: 2 },
    avatarBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
        shadowColor: COLORS.primary, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5,
    },
    avatarLetter: { fontSize: 16, fontWeight: '800', color: '#fff' },

    sectionHeaderRow: { paddingHorizontal: 20, marginBottom: 12, marginTop: 8 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
    sectionSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

    statsRow: { paddingLeft: 20, paddingRight: 8, paddingBottom: 4 },
    statCard: {
        width: 108,
        borderRadius: 14,
        padding: 12,
        marginRight: 10,
        backgroundColor: COLORS.bgCard, borderWidth: 1,
    },
    statIconWrap: {
        width: 34, height: 34,
        borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    },
    statValue: { fontSize: 17, fontWeight: '800', color: COLORS.textWhite },
    statLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted, marginTop: 3 },
    statSub: { fontSize: 9, color: COLORS.textMuted, marginTop: 2 },

    card: {
        marginHorizontal: 20, marginTop: 14,
        backgroundColor: COLORS.bgCard, borderRadius: 14,
        borderWidth: 1, borderColor: COLORS.border, padding: 14,
    },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
    cardTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.text },

    usageBar: { height: 7, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden' },
    usageFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 4 },
    usageLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
    usageLabel: { fontSize: 11, color: COLORS.textMuted },

    viewAllBtn: {
        paddingHorizontal: 10, paddingVertical: 3,
        backgroundColor: COLORS.bgHover, borderRadius: 20,
        borderWidth: 1, borderColor: COLORS.border,
    },
    viewAllText: { fontSize: 11, color: COLORS.primaryLight, fontWeight: '600' },

    fileRow: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
        borderTopWidth: 1, borderTopColor: COLORS.border,
    },
    fileIconWrap: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    fileInfo: { flex: 1 },
    fileName: { fontSize: 12, fontWeight: '600', color: COLORS.text },
    fileMeta: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },

    errorBox: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        marginHorizontal: 20, marginVertical: 16,
        backgroundColor: '#f871711a', borderRadius: 10, padding: 12,
        borderWidth: 1, borderColor: '#f8717140',
    },
    errorText: { flex: 1, fontSize: 12, color: '#f87171' },
    retryText: { fontSize: 12, color: COLORS.primaryLight, fontWeight: '700' },
    emptyText: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 16 },
});

export default DashboardScreen;
