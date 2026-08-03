import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { COLORS } from '../theme/colors';

const PageLoader = ({ message = 'Loading...' }) => {
    return (
        <View style={styles.container}>
            <View style={styles.loaderCard}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                {!!message && <Text style={styles.loaderText}>{message}</Text>}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loaderCard: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        borderRadius: 16,
        backgroundColor: COLORS.bgCard,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 5,
    },
    loaderText: {
        marginTop: 12,
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textMuted,
    },
});

export default PageLoader;
