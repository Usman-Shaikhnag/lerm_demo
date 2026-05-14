import { COLORS } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { WebView } from 'react-native-webview';
import SRFForm from './srf';
import SampleForm from './sample';
import ELNForm from './eln';

export default function RecordForm() {
    const router = useRouter();
    const { model, record_id, title, action_id } = useLocalSearchParams<{ model: string; record_id?: string; title?: string; action_id?: string }>();

    const [loading, setLoading] = useState(true);
    const [webviewUrl, setWebviewUrl] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [serverUrl, setServerUrl] = useState('');
    const [error, setError] = useState(false);
    const [webviewLoading, setWebviewLoading] = useState(true);
    const webviewRef = useRef<WebView>(null);

    if (model === 'lerm.civil.srf') {
        return <SRFForm />;
    }
    
    if (model === 'lerm.srf.sample') {
        return <SampleForm />;
    }

    if (model === 'lerm.eln') {
        return <ELNForm />;
    }

    useEffect(() => {
        const init = async () => {
            try {
                const sid = await SecureStore.getItemAsync('session_id');
                const sUrl = await SecureStore.getItemAsync('server_url');

                if (!sid || !sUrl) {
                    router.replace('/sign-in');
                    return;
                }

                setSessionId(sid);
                setServerUrl(sUrl);

                // Build the Odoo web URL for the form view
                // action_id is critical — without it Odoo may load the wrong form
                let url = `${sUrl}/web#model=${model}&view_type=form`;
                if (action_id) {
                    url += `&action=${action_id}`;
                }
                if (record_id) {
                    url += `&id=${record_id}`;
                }

                setWebviewUrl(url);
                setLoading(false);
            } catch (err) {
                console.error('Error initializing webview:', err);
                setError(true);
                setLoading(false);
            }
        };

        if (model) init();
    }, [model, record_id, router]);

    const handleReportDownload = async (url: string) => {
        try {
            const sid = await SecureStore.getItemAsync('session_id');
            const sUrl = await SecureStore.getItemAsync('server_url');
            if (!sid || !sUrl) return;

            // Ensure absolute URL
            const fullUrl = url.startsWith('http') ? url : `${sUrl}${url}`;

            // Extract a reasonable filename
            const urlPath = fullUrl.split('?')[0];
            let filename = urlPath.split('/').pop() || 'report.pdf';
            if (!filename.includes('.')) {
                filename += '.pdf';
            }
            const localUri = FileSystem.documentDirectory + filename;

            console.log('Downloading report from:', fullUrl);

            const downloadResult = await FileSystem.downloadAsync(fullUrl, localUri, {
                headers: {
                    'Cookie': `session_id=${sid}`,
                },
            });

            if (downloadResult.status === 200) {
                Alert.alert(
                    'Download Complete',
                    'Report has been downloaded successfully. What would you like to do?',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Share',
                            onPress: async () => {
                                if (await Sharing.isAvailableAsync()) {
                                    await Sharing.shareAsync(downloadResult.uri, {
                                        mimeType: 'application/pdf',
                                        dialogTitle: 'Share PDF Report'
                                    });
                                } else {
                                    Alert.alert('Error', 'Sharing is not available on this device.');
                                }
                            }
                        },
                        {
                            text: 'View',
                            onPress: async () => {
                                if (Platform.OS === 'android') {
                                    try {
                                        const contentUri = await FileSystem.getContentUriAsync(downloadResult.uri);
                                        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                                            data: contentUri,
                                            flags: 1,
                                            type: 'application/pdf',
                                        });
                                    } catch (e) {
                                        console.error('IntentLauncher error:', e);
                                        Alert.alert('Error', 'No app found to open PDFs. Try sharing instead.');
                                    }
                                } else {
                                    if (await Sharing.isAvailableAsync()) {
                                        await Sharing.shareAsync(downloadResult.uri, {
                                            UTI: 'com.adobe.pdf',
                                            mimeType: 'application/pdf',
                                        });
                                    } else {
                                        Alert.alert('Download Complete', 'Report saved.');
                                    }
                                }
                            }
                        }
                    ]
                );
            } else {
                console.error('Download failed with status:', downloadResult.status);
                alert('Error: Download failed (status ' + downloadResult.status + ')');
            }
        } catch (err) {
            console.error('Download error:', err);
            alert('Error: Failed to download report');
        }
    };

    const handlePrintButtonClick = async (model: string, recordId: number, methodName: string) => {
        try {
            const sid = await SecureStore.getItemAsync('session_id');
            const sUrl = await SecureStore.getItemAsync('server_url');
            if (!sid || !sUrl) return;

            setWebviewLoading(true); // Show loading bar while generating

            const downloadResponse = await fetch(`${sUrl}/mobile/download_report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `session_id=${sid}`,
                },
                body: JSON.stringify({
                    params: {
                        model: model,
                        id: recordId,
                        method: methodName,
                    }
                }),
            });

            const rawResult = await downloadResponse.json();
            const downloadResult = rawResult.result || rawResult;

            setWebviewLoading(false);

            console.log("Download result check:", downloadResult.success ? "Success" : "Failed", downloadResult.error);

            if (!downloadResult.success) {
                alert('Error: ' + (downloadResult.error || 'Failed to generate report'));
                return;
            }

            if (downloadResult.pdf_base64) {
                const defaultFileName = downloadResult.filename || 'report.pdf';
                const baseDir = FileSystem.documentDirectory + 'LERM/';
                
                // Ensure LERM directory exists in document directory
                const dirInfo = await FileSystem.getInfoAsync(baseDir);
                if (!dirInfo.exists) {
                    await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
                }

                const localUri = baseDir + defaultFileName;
                
                await FileSystem.writeAsStringAsync(localUri, downloadResult.pdf_base64, {
                    encoding: FileSystem.EncodingType.Base64,
                });

                Alert.alert(
                    'Download Complete',
                    'Report has been downloaded successfully. What would you like to do?',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Share',
                            onPress: async () => {
                                if (await Sharing.isAvailableAsync()) {
                                    await Sharing.shareAsync(localUri, {
                                        mimeType: 'application/pdf',
                                        dialogTitle: 'Share PDF Report'
                                    });
                                } else {
                                    Alert.alert('Error', 'Sharing is not available on this device.');
                                }
                            }
                        },
                        {
                            text: 'View',
                            onPress: async () => {
                                if (Platform.OS === 'android') {
                                    try {
                                        const cUri = await FileSystem.getContentUriAsync(localUri);
                                        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                                            data: cUri,
                                            flags: 1,
                                            type: 'application/pdf',
                                        });
                                    } catch (e) {
                                        console.error('IntentLauncher error:', e);
                                        Alert.alert('Error', 'No app found to open PDFs. Try sharing instead.');
                                    }
                                } else {
                                    if (await Sharing.isAvailableAsync()) {
                                        await Sharing.shareAsync(localUri, {
                                            UTI: 'com.adobe.pdf',
                                            mimeType: 'application/pdf',
                                        });
                                    } else {
                                        Alert.alert('Download Complete', 'Report saved.');
                                    }
                                }
                            }
                        }
                    ]
                );
            } else {
                alert('Error: No PDF content returned');
            }
        } catch (err) {
            setWebviewLoading(false);
            console.error('Print error:', err);
            alert('Error: Failed to generate report');
        }
    };    // JavaScript to inject into the WebView to improve mobile experience
    const injectedJS = `
        (function() {
            // Add meta viewport for proper scaling
            var meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
            document.getElementsByTagName('head')[0].appendChild(meta);

            // Add custom CSS for better mobile rendering
            var style = document.createElement('style');
            style.textContent = \`
                /* Hide Odoo's own navbar/menu since we have our own */
                .o_main_navbar, .o_navbar {
                    display: none !important;
                }
                /* Remove left sidebar/menu */
                .o_action_manager {
                    padding-top: 0 !important;
                }
                .o_menu_brand, .o_menu_sections, .o_menu_systray {
                    display: none !important;
                }
                /* Make the content full width */
                .o_content {
                    padding: 8px !important;
                }
                /* Better form styling on mobile */
                .o_form_view .o_form_sheet {
                    padding: 8px !important;
                    margin: 0 !important;
                    max-width: 100% !important;
                }
                .o_form_view .o_form_sheet_bg {
                    padding: 0 !important;
                }
                /* Make chatter section more compact */
                .o_FormRenderer_chatterContainer {
                    max-width: 100% !important;
                }
                /* Improve form group layout on narrow screens */
                .o_group .o_group_col_6 {
                    width: 100% !important;
                }
                /* Better button appearance */
                .o_statusbar_buttons .btn {
                    font-size: 13px !important;
                    padding: 6px 12px !important;
                }
                body {
                    overflow-x: hidden !important;
                }
            \`;
            document.head.appendChild(style);

            // Intercept print/report button clicks in the form header
            // We use capture phase to get it before Odoo's own click handlers
            document.addEventListener('click', function(e) {
                var btn = e.target.closest('.o_statusbar_buttons button[name], button.oe_stat_button[name]');
                if (!btn) return;

                var btnName = btn.getAttribute('name') || '';
                // Only intercept report-related buttons
                var reportButtons = ['print_nabl_report', 'print_non_nabl_report', 'print_datasheet'];
                if (reportButtons.indexOf(btnName) === -1) return;

                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

        // Get the current record model and ID from React Native
                var activeModel = '${model}';
                var activeId = '${record_id || ''}';
                
                // Fallback to URL parsing if somehow they are empty
                try {
                    var href = window.location.href || '';
                    var modelMatch = href.match(/model=([^&#]+)/);
                    var idMatch = href.match(/[&?#]id=([^&#]+)/);
                    if (!activeModel && modelMatch) activeModel = decodeURIComponent(modelMatch[1]);
                    if (!activeId && idMatch) activeId = idMatch[1];
                } catch(ex) {}

                if (!activeModel || !activeId) {
                    alert('Could not determine record context. Please save the record first.');
                    return;
                }

                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'print_report',
                    method: btnName,
                    model: activeModel,
                    id: activeId
                }));
            }, true);

            // Also intercept form submissions to /report/download as fallback
            var origSubmit = HTMLFormElement.prototype.submit;
            HTMLFormElement.prototype.submit = function() {
                var action = this.action || '';
                if (action.indexOf('/report/download') !== -1 || action.indexOf('/report/pdf') !== -1) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'report_download',
                        url: action
                    }));
                    return;
                }
                return origSubmit.call(this);
            };
        })();
        true;
    `;

    if (loading) {
        return (
            <View style={localStyles.centerContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={localStyles.loadingText}>Loading form...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={localStyles.centerContainer}>
                <Ionicons name="alert-circle-outline" size={48} color={COLORS.textLight} />
                <Text style={localStyles.errorTitle}>Failed to load form</Text>
                <TouchableOpacity style={localStyles.retryBtn} onPress={() => router.back()}>
                    <Text style={localStyles.retryBtnText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={localStyles.container}>
            {/* Top Nav Bar */}
            <View style={localStyles.header}>
                <TouchableOpacity onPress={() => router.back()} style={localStyles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={localStyles.headerTitle} numberOfLines={1}>
                    {title || (record_id ? `Edit ${model}` : `New ${model}`)}
                </Text>
                <TouchableOpacity
                    onPress={() => webviewRef.current?.reload()}
                    style={localStyles.reloadButton}
                >
                    <Ionicons name="reload" size={20} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            {/* WebView Loading Indicator */}
            {webviewLoading && (
                <View style={localStyles.webviewLoadingBar}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={localStyles.webviewLoadingText}>Loading LERM form...</Text>
                </View>
            )}

            {/* WebView */}
            <WebView
                ref={webviewRef}
                source={{
                    uri: webviewUrl,
                    headers: {
                        'Cookie': `session_id=${sessionId}`,
                    },
                }}
                style={localStyles.webview}
                injectedJavaScript={injectedJS}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={false}
                sharedCookiesEnabled={true}
                thirdPartyCookiesEnabled={true}
                onLoadStart={() => setWebviewLoading(true)}
                onLoadEnd={() => setWebviewLoading(false)}
                onMessage={(event) => {
                    try {
                        const data = JSON.parse(event.nativeEvent.data);
                        console.log('WebView message:', data.type, data.url || data.method);
                        if (data.type === 'report_download') {
                            // Intercepted from form.submit() or <a> click for /report/download
                            handleReportDownload(data.url);
                        } else if (data.type === 'print_report' || data.type === 'print_button') {
                            const methodMap: Record<string, string> = {
                                'print_datasheet': 'print_datasheet',
                                'print_nabl_report': 'print_nabl_report',
                                'print_non_nabl_report': 'print_non_nabl_report',
                            };
                            const method = methodMap[data.method] || data.method;
                            handlePrintButtonClick(data.model, parseInt(data.id), method);
                        }
                    } catch (e) {
                        console.error('WebView message parse error:', e);
                    }
                }}
                onError={(syntheticEvent) => {
                    const { nativeEvent } = syntheticEvent;
                    console.error('WebView error:', nativeEvent);
                    setError(true);
                }}
                onHttpError={(syntheticEvent) => {
                    const { nativeEvent } = syntheticEvent;
                    console.error('WebView HTTP error:', nativeEvent.statusCode);
                    if (nativeEvent.statusCode === 403 || nativeEvent.statusCode === 401) {
                        router.replace('/sign-in');
                    }
                }}
                onShouldStartLoadWithRequest={(request) => {
                    const url = request.url;
                    // Intercept Odoo report/download URLs and handle as file downloads
                    if (
                        url.includes('/report/pdf/') ||
                        url.includes('/report/download/') ||
                        url.includes('/report/html/') ||
                        url.includes('download=true') ||
                        url.match(/\.(pdf|xlsx|xls|csv|zip)(\?|$)/)
                    ) {
                        console.log('Intercepted report URL:', url);
                        handleReportDownload(url);
                        return false; // Prevent WebView from navigating
                    }
                    return true;
                }}
                onFileDownload={({ nativeEvent }) => {
                    console.log('File download:', nativeEvent.downloadUrl);
                    handleReportDownload(nativeEvent.downloadUrl);
                }}
            />
        </View>
    );
}

const localStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingTop: Platform.OS === 'ios' ? 56 : 12,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        elevation: 2,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    backButton: {
        padding: 4,
        marginRight: 12,
    },
    headerTitle: {
        flex: 1,
        fontSize: 17,
        fontWeight: '600',
        color: COLORS.text,
    },
    reloadButton: {
        padding: 6,
        marginLeft: 8,
        borderRadius: 20,
        backgroundColor: COLORS.primary + '15',
    },
    webview: {
        flex: 1,
    },
    webviewLoadingBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        backgroundColor: COLORS.primary + '10',
        gap: 8,
    },
    webviewLoadingText: {
        fontSize: 13,
        color: COLORS.primary,
        fontWeight: '500',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        padding: 20,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 15,
        color: COLORS.textLight,
    },
    errorTitle: {
        marginTop: 12,
        fontSize: 17,
        fontWeight: '600',
        color: COLORS.text,
    },
    retryBtn: {
        marginTop: 16,
        paddingHorizontal: 24,
        paddingVertical: 10,
        backgroundColor: COLORS.primary,
        borderRadius: 8,
    },
    retryBtnText: {
        color: COLORS.white,
        fontSize: 15,
        fontWeight: '600',
    },
});
