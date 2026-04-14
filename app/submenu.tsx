import { COLORS } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { styles } from '../assets/styles/records.styles.js';

interface MenuItem {
    id: number;
    name: string;
    model: string;
    action_id: number | null;
    action_type: string;
    children: MenuItem[];
    has_children: boolean;
}

export default function Submenu() {
    const router = useRouter();
    const { menu_id, title } = useLocalSearchParams<{ menu_id: string; title: string }>();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [menus, setMenus] = useState<MenuItem[]>([]);
    const [error, setError] = useState(false);

    const fetchMenus = useCallback(async (isRefresh = false) => {
        try {
            if (!isRefresh) setLoading(true);
            setError(false);

            const sessionId = await SecureStore.getItemAsync('session_id');
            const serverUrl = await SecureStore.getItemAsync('server_url');

            if (!sessionId || !serverUrl) {
                router.replace('/sign-in');
                return;
            }

            const response = await fetch(`${serverUrl}/mobile/app_menus`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `session_id=${sessionId}`,
                    'ngrok-skip-browser-warning': 'true',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    params: { menu_id: parseInt(menu_id) },
                }),
            });

            const data = await response.json();

            if (data.result?.success) {
                setMenus(data.result.menus || []);
            } else {
                throw new Error(data.result?.error || 'Failed to fetch submenus');
            }
        } catch (err: any) {
            console.error('Error fetching submenus:', err);
            setError(true);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [menu_id, router]);

    useEffect(() => {
        fetchMenus();
    }, [fetchMenus]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchMenus(true);
    }, [fetchMenus]);

    const handleMenuPress = (menu: MenuItem) => {
        if (menu.has_children) {
            // Recursive navigation for nested submenus
            router.push({
                pathname: '/submenu',
                params: {
                    menu_id: menu.id.toString(),
                    title: menu.name,
                },
            });
            return;
        }

        if (menu.action_type === 'ir.actions.client') {
            router.push({
                pathname: '/dashboard',
                params: {
                    action_id: menu.action_id?.toString(),
                    title: menu.name,
                },
            });
            return;
        }

        if (!menu.model) {
            Alert.alert('No Data', 'This menu item has no associated records.');
            return;
        }

        router.push({
            pathname: '/records',
            params: {
                model: menu.model,
                title: menu.name,
                ...(menu.action_id ? { action_id: menu.action_id.toString() } : {}),
            },
        });
    };

    const renderMenuItem = ({ item }: { item: MenuItem }) => {
        return (
            <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleMenuPress(item)}
                activeOpacity={0.6}
            >
                <View style={styles.menuIconContainer}>
                    <Ionicons
                        name={item.has_children ? "folder-outline" : "document-text-outline"}
                        size={20}
                        color={COLORS.primary}
                    />
                </View>
                <View style={styles.menuTextContainer}>
                    <Text style={styles.menuName}>{item.name}</Text>
                    {item.model ? (
                        <Text style={styles.menuModel}>{item.model}</Text>
                    ) : (
                        item.has_children ? <Text style={styles.menuModel}>{item.children?.length || 0} items</Text> : null
                    )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading submenus...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centerContainer}>
                <Ionicons name="cloud-offline-outline" size={48} color={COLORS.textLight} />
                <Text style={styles.errorTitle}>Failed to load submenus</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => fetchMenus()}>
                    <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {title || 'Submenu'}
                </Text>
                <View style={{ width: 40 }} />
            </View>

            <FlatList
                data={menus}
                renderItem={renderMenuItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.menuList}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[COLORS.primary]}
                        tintColor={COLORS.primary}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.centerContainer}>
                        <Ionicons name="folder-open-outline" size={48} color={COLORS.textLight} />
                        <Text style={styles.errorTitle}>No items found</Text>
                    </View>
                }
            />
        </View>
    );
}
