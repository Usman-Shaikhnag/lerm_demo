import { COLORS } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { WebView } from 'react-native-webview';

export default function Dashboard() {
    const router = useRouter();
    const { action_id, title } = useLocalSearchParams<{ action_id: string; title: string }>();
    const [loading, setLoading] = useState(true);
    const [serverUrl, setServerUrl] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const webViewRef = useRef<WebView>(null);

    useEffect(() => {
        const loadCredentials = async () => {
            const url = await SecureStore.getItemAsync('server_url');
            const sid = await SecureStore.getItemAsync('session_id');
            setServerUrl(url);
            setSessionId(sid);
        };
        loadCredentials();
    }, []);

    if (!serverUrl || !sessionId) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    // Construct the Odoo action URL
    // We use the #action=ID fragment to load the specific dashboard action
    const dashboardUrl = `${serverUrl}/web#action=${action_id}`;

    // Script to inject the session cookie before the page loads
    const injectedJavaScript = `
        (function() {
            document.cookie = "session_id=${sessionId}; path=/; expires=Fri, 31 Dec 9999 23:59:59 GMT";
            // Optional: Hide Odoo navbar and sidebar for a cleaner look
            const style = document.createElement('style');
            style.innerHTML = '.o_main_navbar, .o_navbar, .o_sub_menu { display: none !important; } .o_action_manager { top: 0 !important; }';
            document.head.appendChild(style);
        })();
        true; // note: this is required for some reason
    `;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {title || 'Dashboard'}
                </Text>
                <TouchableOpacity
                    onPress={() => webViewRef.current?.reload()}
                    style={styles.backButton}
                >
                    <Ionicons name="refresh" size={20} color={COLORS.text} />
                </TouchableOpacity>
            </View>

            <View style={styles.webviewContainer}>
                <WebView
                    ref={webViewRef}
                    source={{ uri: dashboardUrl }}
                    injectedJavaScript={injectedJavaScript}
                    onLoadEnd={() => setLoading(false)}
                    style={{ flex: 1 }}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    startInLoadingState={true}
                    renderLoading={() => (
                        <View style={styles.loadingOverlay}>
                            <ActivityIndicator size="large" color={COLORS.primary} />
                            <Text style={styles.loadingText}>Loading Dashboard...</Text>
                        </View>
                    )}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        marginHorizontal: 8,
    },
    webviewContainer: {
        flex: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        zIndex: 1,
    },
    loadingText: {
        marginTop: 10,
        color: COLORS.textLight,
        fontSize: 14,
    },
});
