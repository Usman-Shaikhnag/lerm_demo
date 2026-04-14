import { COLORS } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { styles } from '../assets/styles/home.styles';

interface OdooApp {
  name: string;
  display_name: string;
  summary: string;
  category: string;
  icon: string;
  menu_id?: number;
}

// Color palette for app card letter avatars
const AVATAR_COLORS = [
  '#6A1B9A', '#0277BD', '#00695C', '#EF6C00',
  '#C62828', '#283593', '#AD1457', '#4527A0',
  '#00838F', '#2E7D32', '#F9A825', '#D84315',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Map known categories/modules to Ionicon names
function getAppIcon(app: OdooApp): string {
  const name = app.name.toLowerCase();
  const cat = app.category.toLowerCase();
  if (name.includes('lerm civil')) return 'custom-lerm-civil';
  if (name.includes('sale') || cat.includes('sales')) return 'cart-outline';
  if (name.includes('purchase') || cat.includes('purchase')) return 'bag-outline';
  if (name.includes('account') || name.includes('invoic') || cat.includes('accounting')) return 'calculator-outline';
  if (name.includes('stock') || name.includes('inventory') || cat.includes('warehouse')) return 'cube-outline';
  if (name.includes('hr') || name.includes('employee') || cat.includes('human')) return 'people-outline';
  if (name.includes('project') || cat.includes('project')) return 'clipboard-outline';
  if (name.includes('crm') || cat.includes('crm')) return 'megaphone-outline';
  if (name.includes('website') || cat.includes('website')) return 'globe-outline';
  if (name.includes('mail') || name.includes('discuss')) return 'chatbubbles-outline';
  if (name.includes('calendar') || cat.includes('calendar')) return 'calendar-outline';
  if (name.includes('contact') || cat.includes('contact')) return 'person-outline';
  if (name.includes('fleet') || cat.includes('fleet')) return 'car-outline';
  if (name.includes('manufacture') || name.includes('mrp') || cat.includes('manufacturing')) return 'construct-outline';
  if (name.includes('maintenance')) return 'build-outline';
  if (name.includes('quality')) return 'checkmark-circle-outline';
  if (name.includes('survey')) return 'document-text-outline';
  if (name.includes('lunch')) return 'restaurant-outline';
  if (name.includes('note')) return 'create-outline';
  if (name.includes('board') || name.includes('dashboard')) return 'bar-chart-outline';
  if (name.includes('setting') || name.includes('base')) return 'settings-outline';
  return 'apps-outline';
}

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apps, setApps] = useState<OdooApp[]>([]);
  const [userName, setUserName] = useState('');
  const [networkError, setNetworkError] = useState(false);

  const fetchApps = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setNetworkError(false);

      const sessionId = await SecureStore.getItemAsync('session_id');
      const serverUrl = await SecureStore.getItemAsync('server_url');

      if (!sessionId || !serverUrl) {
        router.replace('/sign-in');
        return;
      }

      const response = await fetch(`${serverUrl}/mobile/installed_apps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          params: {},
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.result?.success) {
        const fetchedApps = data.result.apps || [];
        const visibleApps = fetchedApps.filter(
          (app: OdooApp) => app.display_name.trim().toLowerCase() !== 'settings'
        );
        setApps(visibleApps);
        setUserName(data.result.user_name || '');
      } else {
        // Session might be expired
        const errorMsg = data.result?.error || data.error?.message || '';
        if (errorMsg.includes('session') || errorMsg.includes('Session')) {
          Alert.alert('Session Expired', 'Please sign in again.');
          handleSignOut();
          return;
        }
        throw new Error(errorMsg || 'Failed to fetch apps');
      }
    } catch (err: any) {
      console.error('Error fetching apps:', err);
      setNetworkError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  const handleSignOut = async () => {
    try {
      await SecureStore.deleteItemAsync('email');
      await SecureStore.deleteItemAsync('password');
      await SecureStore.deleteItemAsync('server_url');
      await SecureStore.deleteItemAsync('uid');
      await SecureStore.deleteItemAsync('session_id');
      await SecureStore.deleteItemAsync('database');
      router.replace('/sign-in');
    } catch (error) {
      console.error('Sign-out error:', error);
      Alert.alert('Error', 'Failed to sign out.');
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchApps(true);
  }, [fetchApps]);

  const renderAppCard = ({ item }: { item: OdooApp }) => {
    const avatarColor = getAvatarColor(item.display_name);
    const iconName = getAppIcon(item);

    return (
      <TouchableOpacity
        style={styles.appCard}
        activeOpacity={0.7}
        onPress={() => {
          if (item.menu_id) {
            router.push({
              pathname: '/app-detail',
              params: {
                menu_id: item.menu_id.toString(),
                app_name: item.display_name,
              },
            });
          } else {
            Alert.alert('Unavailable', 'This app cannot be opened directly.');
          }
        }}
      >
        <View style={iconName === 'custom-lerm-civil' ? styles.appIconContainer : [styles.appIconContainer, { backgroundColor: avatarColor + '18' }]}>
          {iconName === 'custom-lerm-civil' ? (
            <Image
              source={require('../assets/images/lerm_app.png')}
              style={{ width: 52, height: 52, resizeMode: 'contain', borderRadius: 14 }}
            />
          ) : (
            <Ionicons name={iconName as any} size={28} color={avatarColor} />
          )}
        </View>
        <Text style={styles.appName} numberOfLines={2}>
          {item.display_name}
        </Text>
        {item.category ? (
          <Text style={styles.appCategory} numberOfLines={1}>
            {item.category}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Image
          source={require('../assets/images/lerm_logo.png')}
          style={styles.illustration}
        />
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
        <Text style={styles.loadingText}>Loading your apps...</Text>
      </View>
    );
  }

  // Network error state
  if (networkError) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="cloud-offline-outline" size={64} color={COLORS.textLight} />
        <Text style={styles.errorTitle}>Connection Error</Text>
        <Text style={styles.errorSubtext}>
          Unable to reach the server. Please check your connection and try again.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchApps()}>
          <Ionicons name="refresh-outline" size={20} color={COLORS.white} />
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.signOutLink} onPress={handleSignOut}>
          <Text style={styles.signOutLinkText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.dashboardHeader}>
        <View style={styles.headerLeft}>
          <Image
            source={require('../assets/images/lerm_logo.png')}
            style={styles.headerLogo}
          />
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.usernameText}>{userName}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Section title */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Installed Apps</Text>
        <Text style={styles.appCount}>{apps.length} apps</Text>
      </View>

      {/* Apps grid */}
      <FlatList
        data={apps}
        renderItem={renderAppCard}
        keyExtractor={(item) => item.name}
        numColumns={3}
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
          <View style={styles.emptyState}>
            <Ionicons name="apps-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.emptyStateTitle}>No Apps Found</Text>
            <Text style={styles.emptyStateText}>
              No installed applications were found on your server.
            </Text>
          </View>
        }
      />
    </View>
  );
}