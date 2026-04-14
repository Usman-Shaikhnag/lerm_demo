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

// Map menu names to Ionicon names
function getMenuIcon(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('order') || n.includes('sale') || n.includes('quotation')) return 'cart-outline';
    if (n.includes('product')) return 'cube-outline';
    if (n.includes('customer') || n.includes('partner') || n.includes('people')) return 'people-outline';
    if (n.includes('report') || n.includes('analysis') || n.includes('dashboard')) return 'bar-chart-outline';
    if (n.includes('configuration') || n.includes('setting')) return 'settings-outline';
    if (n.includes('invoice') || n.includes('bill') || n.includes('payment')) return 'card-outline';
    if (n.includes('stock') || n.includes('inventory') || n.includes('warehouse')) return 'business-outline';
    if (n.includes('delivery') || n.includes('ship')) return 'airplane-outline';
    if (n.includes('purchase')) return 'bag-add-outline';
    if (n.includes('manufacturing') || n.includes('work')) return 'construct-outline';
    if (n.includes('maintenance')) return 'build-outline';
    if (n.includes('quality')) return 'shield-checkmark-outline';
    return 'folder-outline';
}

// Color palette for menu boxes
const MENU_COLORS = [
    '#6A1B9A', '#0277BD', '#00695C', '#EF6C00',
    '#C62828', '#283593', '#AD1457', '#4527A0',
];

function getMenuColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return MENU_COLORS[Math.abs(hash) % MENU_COLORS.length];
}

export default function AppDetail() {
    const router = useRouter();
    const { menu_id, app_name } = useLocalSearchParams<{ menu_id: string; app_name: string }>();
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
                throw new Error(data.result?.error || 'Failed to fetch menus');
            }
        } catch (err: any) {
            console.error('Error fetching menus:', err);
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

        if (menu.model === 'board.board') {
            Alert.alert('Unsupported', 'Odoo Dashboards are composed of custom XML views and do not contain queryable records. They are not currently supported in the standard mobile interface.');
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
        const iconName = getMenuIcon(item.name);
        const color = getMenuColor(item.name);

        return (
            <TouchableOpacity
                style={styles.menuCard}
                onPress={() => handleMenuPress(item)}
                activeOpacity={0.7}
            >
                <View style={[styles.menuCardIconContainer, { backgroundColor: color + '12' }]}>
                    <Ionicons name={iconName as any} size={28} color={color} />
                </View>
                <Text style={styles.menuCardName} numberOfLines={2}>
                    {item.name}
                </Text>
                {item.has_children ? (
                    <Text style={styles.menuCardModel} numberOfLines={1}>
                        {item.children.length} submenus
                    </Text>
                ) : (
                    item.model ? (
                        <Text style={styles.menuCardModel} numberOfLines={1}>
                            {item.model}
                        </Text>
                    ) : null
                )}
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading menus...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centerContainer}>
                <Ionicons name="cloud-offline-outline" size={48} color={COLORS.textLight} />
                <Text style={styles.errorTitle}>Failed to load menus</Text>
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
                    {app_name || 'App'}
                </Text>
                <View style={{ width: 40 }} />
            </View>

            <FlatList
                data={menus}
                renderItem={renderMenuItem}
                keyExtractor={(item) => item.id.toString()}
                numColumns={3}
                style={{ marginTop: 10 }}
                columnWrapperStyle={styles.gridRow}
                contentContainerStyle={styles.gridContainer}
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
                        <Text style={styles.errorTitle}>No menu items found</Text>
                    </View>
                }
            />
        </View>
    );
}
