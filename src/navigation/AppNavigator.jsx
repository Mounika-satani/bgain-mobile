import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Keyboard, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

import DashboardScreen from '../screens/DashboardScreen';
import FilesScreen from '../screens/FilesScreen';
import UsersScreen from '../screens/UsersScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TabButton = ({ label, icon, isFocused, onPress }) => (
    <TouchableOpacity
        style={styles.tabBtn}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <View style={[styles.tabIconWrap, isFocused && styles.tabIconWrapActive]}>
            <Feather
                name={icon}
                size={isFocused ? 21 : 20}
                color={isFocused ? '#fff' : COLORS.tabInactive}
            />
        </View>
        <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
            {label}
        </Text>
    </TouchableOpacity>
);

const tabConfig = {
    Dashboard: { icon: 'grid', label: 'Dashboard' },
    Files: { icon: 'folder', label: 'Files' },
    Users: { icon: 'users', label: 'Users' },
    Profile: { icon: 'user', label: 'Profile' },
};

const CustomTabBar = ({ state, descriptors, navigation }) => {
    const [keyboardVisible, setKeyboardVisible] = React.useState(false);

    React.useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
        const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    if (keyboardVisible) return null;

    return (
        <View style={styles.tabBar}>
            {state.routes.map((route, index) => {
                const isFocused = state.index === index;
                const tab = tabConfig[route.name] || { icon: 'help-circle', label: route.name };
                const onPress = () => {
                    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                    if (!isFocused && !event.defaultPrevented) {
                        navigation.navigate(route.name);
                    }
                };
                return (
                    <TabButton
                        key={route.key}
                        label={tab.label}
                        icon={tab.icon}
                        isFocused={isFocused}
                        onPress={onPress}
                    />
                );
            })}
        </View>
    );
};

const MainTabNavigator = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    return (
        <Tab.Navigator
            tabBar={props => <CustomTabBar {...props} />}
            screenOptions={{
                headerShown: false,
            }}
        >
            <Tab.Screen
                name="Dashboard"
                component={DashboardScreen}
            />
            <Tab.Screen
                name="Files"
                component={FilesScreen}
            />
            {isAdmin && (
                <Tab.Screen
                    name="Users"
                    component={UsersScreen}
                />
            )}
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
            />
        </Tab.Navigator>
    );
};

const AppNavigator = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabNavigator} />
    </Stack.Navigator>
);

const styles = StyleSheet.create({
    tabBar: {
        flexDirection: 'row',
        backgroundColor: COLORS.tabBg,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        paddingBottom: 18,
        paddingTop: 8,
        paddingHorizontal: 8,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 12,
    },
    tabBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    tabIconWrap: {
        width: 44,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabIconWrapActive: {
        backgroundColor: COLORS.primary,
        width: 52,
        shadowColor: COLORS.primary,
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 4,
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: COLORS.tabInactive,
    },
    tabLabelActive: {
        color: COLORS.primaryLight,
        fontWeight: '700',
    },

    headerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: COLORS.primary + '22',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.primary + '44',
    },
    headerBadgeText: {
        fontSize: 11,
        color: COLORS.primaryLight,
        fontWeight: '700',
    },
});

export default AppNavigator;
