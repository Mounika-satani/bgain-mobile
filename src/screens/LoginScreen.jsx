import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, ActivityIndicator, KeyboardAvoidingView,
    Platform, Animated, Easing,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../theme/colors';
import { loginUser, signupUser } from '../service/auth';
import CustomAlertModal from '../components/CustomAlertModal';

const RoleCard = ({ label, icon, description, selected, onPress }) => (
    <TouchableOpacity
        style={[styles.roleCard, selected && styles.roleCardSelected]}
        onPress={onPress}
        activeOpacity={0.8}
    >
        <View style={[styles.roleIconWrap, selected && styles.roleIconSelected]}>
            <Feather name={icon} size={20} color={selected ? '#fff' : COLORS.textMuted} />
        </View>
        <View style={styles.roleCardText}>
            <Text style={[styles.roleCardLabel, selected && styles.roleCardLabelActive]}>{label}</Text>
            <Text style={styles.roleCardDesc}>{description}</Text>
        </View>
        {selected && <Feather name="check-circle" size={18} color={COLORS.primary} />}
    </TouchableOpacity>
);

const LoginScreen = () => {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('admin');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showPw, setShowPw] = useState(false);
    const [alertConfig, setAlertConfig] = useState(null);

    const showAlert = (title, message, type = 'error', onConfirm = null) => {
        setAlertConfig({ visible: true, title, message, type, onConfirm });
    };

    const handleSubmit = async () => {
        if (!email.trim() || !password) {
            showAlert('Required Fields Missing', 'Please enter both your email address and password.', 'warning');
            return;
        }
        setLoading(true);
        try {
            let data;
            if (isSignUp) {
                data = await signupUser(email.trim(), password, role);
                showAlert('Account Created!', `Your ${role.toUpperCase()} account has been created successfully.`, 'success', () => {
                    login(data.token, data.user);
                });
            } else {
                data = await loginUser(email.trim(), password, role);
                showAlert(
                    'Welcome Back!',
                    `Signed in as ${role.toUpperCase()} — ${email.trim()}`,
                    'success',
                    () => { login(data.token, data.user); }
                );
            }
        } catch (e) {
            console.error('Auth error:', e);
            const errMsg = e.response?.data?.error || 'Authentication failed. Please check your credentials.';
            showAlert('Authentication Error', errMsg, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Hero */}
                <View style={styles.hero}>
                    <View style={styles.logoWrap}>
                        <Text style={styles.logoLetter}>B</Text>
                    </View>
                    <Text style={styles.heroTitle}>Bgain Secure</Text>
                    <Text style={styles.heroSub}>Storage Management System</Text>
                </View>

                {/* Card */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{isSignUp ? 'Create Account' : 'Welcome Back'}</Text>
                    <Text style={styles.cardSub}>
                        {isSignUp
                            ? 'Register a new account in Bgain'
                            : 'Sign in to your secure storage workspace'}
                    </Text>

                    {/* Alerts */}


                    {/* Role Selection */}
                    <Text style={styles.fieldLabel}>Select Account Role</Text>
                    <RoleCard
                        label="Administrator"
                        icon="shield"
                        description="Full CRUD access — files, folders & users"
                        selected={role === 'admin'}
                        onPress={() => setRole('admin')}
                    />
                    <RoleCard
                        label="Viewer"
                        icon="eye"
                        description="Browse, preview & download only"
                        selected={role === 'viewer'}
                        onPress={() => setRole('viewer')}
                    />

                    {/* Email */}
                    <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Email Address</Text>
                    <View style={styles.inputWrap}>
                        <Feather name="mail" size={17} color={COLORS.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder={role === 'admin' ? 'admin@example.com' : 'user@example.com'}
                            placeholderTextColor={COLORS.textMuted}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    {/* Password */}
                    <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Password</Text>
                    <View style={styles.inputWrap}>
                        <Feather name="lock" size={17} color={COLORS.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={[styles.input, { paddingRight: 44 }]}
                            placeholder="••••••••"
                            placeholderTextColor={COLORS.textMuted}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPw}
                        />
                        <TouchableOpacity style={styles.peekBtn} onPress={() => setShowPw(!showPw)}>
                            <Feather name={showPw ? 'eye-off' : 'eye'} size={16} color={COLORS.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {/* Submit */}
                    <TouchableOpacity
                        style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                        onPress={handleSubmit}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <>
                                <Text style={styles.submitBtnText}>
                                    {isSignUp
                                        ? `Sign Up as ${role === 'admin' ? 'Admin' : 'Viewer'}`
                                        : `Sign In as ${role === 'admin' ? 'Admin' : 'Viewer'}`}
                                </Text>
                                <Feather name="arrow-right" size={18} color="#fff" style={{ marginLeft: 8 }} />
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Toggle Mode */}
                    <TouchableOpacity
                        style={styles.toggleBtn}
                        onPress={() => setIsSignUp(!isSignUp)}
                    >
                        <Text style={styles.toggleText}>
                            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                            <Text style={styles.toggleLink}>{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
                        </Text>
                    </TouchableOpacity>

                    {/* Footer */}
                    <View style={styles.cardFooter}>
                        <Feather name="shield" size={13} color={COLORS.textMuted} />
                        <Text style={styles.footerText}> Protected by end-to-end role authorization</Text>
                    </View>
                </View>
            </ScrollView>

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
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bg },
    scroll: { flexGrow: 1, paddingBottom: 32 },

    hero: { alignItems: 'center', paddingTop: 60, paddingBottom: 28 },
    logoWrap: {
        width: 72, height: 72, borderRadius: 24,
        backgroundColor: COLORS.primary,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: COLORS.primary, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10,
        marginBottom: 14,
    },
    logoLetter: { fontSize: 36, fontWeight: '800', color: '#fff' },
    heroTitle: { fontSize: 24, fontWeight: '800', color: COLORS.textWhite, letterSpacing: 0.5 },
    heroSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },

    card: {
        marginHorizontal: 18, borderRadius: 20,
        backgroundColor: COLORS.bgCard,
        borderWidth: 1, borderColor: COLORS.border,
        padding: 22,
        shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, elevation: 8,
    },
    cardTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textWhite },
    cardSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 4, marginBottom: 16 },

    alertError: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#fee2e2', borderRadius: 10,
        borderWidth: 1, borderColor: '#fca5a5',
        padding: 12, marginBottom: 14,
    },
    alertSuccess: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#d1fae5', borderRadius: 10,
        borderWidth: 1, borderColor: '#a7f3d0',
        padding: 12, marginBottom: 14,
    },
    alertText: { flex: 1, fontSize: 13, color: COLORS.danger },

    roleCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        padding: 14, borderRadius: 12, marginBottom: 8,
        backgroundColor: COLORS.bgInput, borderWidth: 1.5, borderColor: COLORS.border,
    },
    roleCardSelected: { borderColor: COLORS.primary, backgroundColor: '#f3e8ff' },
    roleIconWrap: {
        width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.bgHover,
        alignItems: 'center', justifyContent: 'center',
    },
    roleIconSelected: { backgroundColor: COLORS.primary },
    roleCardText: { flex: 1 },
    roleCardLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text },
    roleCardLabelActive: { color: COLORS.primaryLight },
    roleCardDesc: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

    fieldLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    inputWrap: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: COLORS.bgInput, borderRadius: 12,
        borderWidth: 1.5, borderColor: COLORS.border,
        paddingHorizontal: 14,
    },
    inputIcon: { marginRight: 10 },
    input: {
        flex: 1, height: 48, fontSize: 15,
        color: COLORS.text,
    },
    peekBtn: { padding: 8 },

    submitBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: COLORS.primary, borderRadius: 14,
        paddingVertical: 16, marginTop: 20,
        shadowColor: COLORS.primary, shadowOpacity: 0.45, shadowRadius: 12, elevation: 6,
    },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

    toggleBtn: { alignItems: 'center', marginTop: 18 },
    toggleText: { fontSize: 13, color: COLORS.textMuted },
    toggleLink: { color: COLORS.primaryLight, fontWeight: '700' },

    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
    footerText: { fontSize: 11, color: COLORS.textMuted },
});

export default LoginScreen;
