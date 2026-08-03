import React from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../theme/colors';
import PageLoader from '../components/PageLoader';

const DetailRow = ({ icon, label, value, valueStyle }) => (
    <View style={styles.detailRow}>
        <View style={styles.detailIconWrap}>
            <Feather name={icon} size={17} color={COLORS.primaryLight} />
        </View>
        <View style={styles.detailInfo}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={[styles.detailValue, valueStyle]}>{value}</Text>
        </View>
    </View>
);

const ProfileScreen = ({ navigation }) => {
    const { user, logout } = useAuth();

    const displayName = user?.name || (user?.email ? user.email.split('@')[0] : 'User');
    const activeUser = {
        name: displayName,
        email: user?.email || '—',
        role: user?.role || 'viewer',
        id: user?.id || '—',
    };

    const handleLogout = () => {
        logout();
    };

    if (!user) {
        return <PageLoader message="Loading profile..." />;
    }

    return (
        <ScrollView style={styles.root} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Banner & Avatar */}
            <View style={styles.banner}>

                <View style={styles.avatarWrap}>
                    <Text style={styles.avatarLetter}>{activeUser.name.charAt(0).toUpperCase()}</Text>
                </View>

            </View>

            {/* Details Card */}
            <View style={styles.card}>
                <Text style={styles.cardSectionTitle}>Account Details</Text>
                <DetailRow icon="user" label="Full Name" value={activeUser.name} />
                <View style={styles.divider} />
                <DetailRow icon="mail" label="Email Address" value={activeUser.email} />
                <View style={styles.divider} />
                <DetailRow icon="shield" label="Assigned Role" value={activeUser.role.charAt(0).toUpperCase() + activeUser.role.slice(1)} />
                <View style={styles.divider} />
                <DetailRow
                    icon="check-circle"
                    label="Account Status"
                    value="Active"
                    valueStyle={{ color: COLORS.success }}
                />
            </View>



            {/* Logout */}
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
                <Feather name="log-out" size={18} color={COLORS.danger} />
                <Text style={styles.logoutText}>Sign Out of Account</Text>
            </TouchableOpacity>

            {/* Footer */}
            <View style={styles.footer}>
                <Feather name="shield" size={13} color={'black'} />
                <Text style={styles.footerText}> Protected by end-to-end role authorization and token security.</Text>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bg },
    scroll: { paddingBottom: 36 },

    banner: {
        alignItems: 'center', paddingTop: 20, paddingBottom: 15,
        backgroundColor: COLORS.bgCard, marginBottom: 16,
        borderBottomWidth: 1, borderColor: COLORS.border,
        position: 'relative', overflow: 'hidden',
    },
    avatarWrap: {
        width: 88, height: 88, borderRadius: 44,
        backgroundColor: COLORS.primary,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: COLORS.primary, shadowOpacity: 0.5, shadowRadius: 20, elevation: 12,
        borderWidth: 3, borderColor: COLORS.primaryDark,

    },
    avatarLetter: { fontSize: 38, fontWeight: '800', color: '#fff' },
    profileName: { fontSize: 22, fontWeight: '800', color: COLORS.textWhite },
    profileEmail: { fontSize: 13, color: COLORS.textMuted, marginTop: 4, marginBottom: 10 },
    roleBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20,
    },
    roleBadgeAdmin: { backgroundColor: '#f3e8ff' },
    roleBadgeViewer: { backgroundColor: '#ecfeff' },
    roleBadgeText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },

    card: {
        marginHorizontal: 20, marginBottom: 14,
        backgroundColor: COLORS.bgCard, borderRadius: 16,
        borderWidth: 1, borderColor: COLORS.border, padding: 16,
    },
    cardSectionTitle: {
        fontSize: 11, fontWeight: '700', color: COLORS.textMuted,
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14,
    },

    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    detailIconWrap: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: COLORS.primary + '22',
        alignItems: 'center', justifyContent: 'center',
    },
    detailInfo: { flex: 1 },
    detailLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
    detailValue: { fontSize: 15, color: COLORS.text, fontWeight: '600', marginTop: 2 },
    divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 2 },

    sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    sessionText: { flex: 1, fontSize: 14, color: COLORS.text },
    sessionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },

    logoutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        marginHorizontal: 20, borderRadius: 14, paddingVertical: 14,
        backgroundColor: COLORS.danger + '18',
        borderWidth: 1.5, borderColor: COLORS.danger + '50',
        marginBottom: 24,
    },
    logoutText: { fontSize: 15, fontWeight: '700', color: COLORS.danger },

    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
    footerText: { fontSize: 11, color: 'black', textAlign: 'center' },
});

export default ProfileScreen;
