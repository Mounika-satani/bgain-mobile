import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';

const CustomAlertModal = ({ visible, title, message, type = 'info', onClose, onConfirm, confirmText = 'OK', cancelText = 'Cancel' }) => {
    if (!visible) return null;

    const config = {
        success: { icon: 'check-circle', color: '#10b981', bg: '#10b98122' },
        error: { icon: 'alert-triangle', color: '#f87171', bg: '#f8717122' },
        warning: { icon: 'alert-circle', color: '#f59e0b', bg: '#f59e0b22' },
        info: { icon: 'info', color: COLORS.primaryLight, bg: COLORS.primary + '22' },
    }[type] || { icon: 'info', color: COLORS.primaryLight, bg: COLORS.primary + '22' };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity activeOpacity={1} style={styles.alertCard}>
                    <View style={[styles.iconWrap, { backgroundColor: config.bg }]}>
                        <Feather name={config.icon} size={28} color={config.color} />
                    </View>

                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>

                    <View style={styles.actionsRow}>
                        {onConfirm && (
                            <TouchableOpacity style={styles.btnCancel} onPress={onClose}>
                                <Text style={styles.btnCancelText}>{cancelText}</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[
                                styles.btnConfirm,
                                { backgroundColor: config.color },
                                !onConfirm && { width: '100%' }
                            ]}
                            onPress={() => {
                                if (onConfirm) onConfirm();
                                else onClose();
                            }}
                        >
                            <Text style={styles.btnConfirmText}>{confirmText}</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: COLORS.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    alertCard: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: COLORS.bgCard,
        borderRadius: 20,
        padding: 22,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    iconWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justify: 'center',
        marginBottom: 14,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.textWhite,
        textAlign: 'center',
        marginBottom: 6,
    },
    message: {
        fontSize: 13,
        color: COLORS.textMuted,
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 20,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
    },
    btnCancel: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
    },
    btnCancelText: {
        color: COLORS.textMuted,
        fontWeight: '600',
        fontSize: 14,
    },
    btnConfirm: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    btnConfirmText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
});

export default CustomAlertModal;
