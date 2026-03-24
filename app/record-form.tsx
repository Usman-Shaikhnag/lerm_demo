import { COLORS } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { styles } from '../assets/styles/form.styles.js';

interface FieldSchema {
    type: string;
    string: string;
    required: boolean;
    readonly: boolean;
    selection?: [string, string][];
    relation?: string;
}

interface LayoutNode {
    type: string;
    name?: string;
    string?: string;
    widget?: string;
    btn_type?: string;
    btn_class?: string;
    children?: LayoutNode[];
    pages?: LayoutNode[];
}

export default function RecordForm() {
    const router = useRouter();
    const { model, record_id, title, wizard_context } = useLocalSearchParams<{ model: string; record_id?: string; title?: string; wizard_context?: string }>();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(false);

    const [schema, setSchema] = useState<Record<string, FieldSchema>>({});
    const [layout, setLayout] = useState<LayoutNode[]>([]);
    const [values, setValues] = useState<Record<string, any>>({});
    const [activeTab, setActiveTab] = useState<Record<string, number>>({});

    // ── Fetch schema + layout + record data ──
    useEffect(() => {
        let isMounted = true;
        const initForm = async () => {
            try {
                setLoading(true);
                setError(false);

                const sessionId = await SecureStore.getItemAsync('session_id');
                const serverUrl = await SecureStore.getItemAsync('server_url');

                if (!sessionId || !serverUrl) {
                    router.replace('/sign-in');
                    return;
                }

                const headers = {
                    'Content-Type': 'application/json',
                    'Cookie': `session_id=${sessionId}`,
                    'ngrok-skip-browser-warning': 'true',
                };

                // 1. Fetch Schema + Layout
                const schemaRes = await fetch(`${serverUrl}/mobile/model_fields`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ jsonrpc: '2.0', params: { model } }),
                });

                const schemaData = await schemaRes.json();
                if (!schemaData.result?.success) {
                    throw new Error(schemaData.result?.error || 'Failed to fetch schema');
                }

                if (isMounted) {
                    setSchema(schemaData.result.fields);
                    setLayout(schemaData.result.layout || []);
                }

                // 2. If editing, fetch record data
                if (record_id) {
                    const dataRes = await fetch(`${serverUrl}/mobile/record_read`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ jsonrpc: '2.0', params: { model, id: parseInt(record_id, 10) } }),
                    });

                    const dataData = await dataRes.json();
                    if (!dataData.result?.success) {
                        throw new Error(dataData.result?.error || 'Failed to fetch record data');
                    }

                    if (isMounted) setValues(dataData.result.data || {});
                }

            } catch (err) {
                console.error('Error initializing form:', err);
                if (isMounted) setError(true);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        if (model) initForm();
        return () => { isMounted = false; };
    }, [model, record_id, router]);

    // ── Save ──
    const handleSave = async () => {
        try {
            setSaving(true);
            const sessionId = await SecureStore.getItemAsync('session_id');
            const serverUrl = await SecureStore.getItemAsync('server_url');

            const endpoint = record_id ? '/mobile/record_update' : '/mobile/record_create';
            const params: any = { model, values };
            if (record_id) params.id = parseInt(record_id, 10);

            // Pass context if creating a wizard
            if (!record_id && wizard_context) {
                try {
                    params.context = JSON.parse(wizard_context);
                } catch (e) {
                    console.error("Failed to parse wizard context:", e);
                }
            }

            const response = await fetch(`${serverUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `session_id=${sessionId}`,
                    'ngrok-skip-browser-warning': 'true',
                },
                body: JSON.stringify({ jsonrpc: '2.0', params }),
            });

            const data = await response.json();
            if (data.result?.success) {
                Alert.alert('Success', data.result.message, [
                    { text: 'OK', onPress: () => router.back() }
                ]);
            } else {
                throw new Error(data.result?.error || 'Failed to save record');
            }
        } catch (err: any) {
            console.error('Error saving record:', err);
            Alert.alert('Error', err.message);
        } finally {
            setSaving(false);
        }
    };

    // ── Call Odoo button method ──
    const handleButtonAction = async (btnName: string, btnType: string) => {
        if (!record_id) {
            Alert.alert('Info', 'Please save the record first before using actions.');
            return;
        }
        try {
            const sessionId = await SecureStore.getItemAsync('session_id');
            const serverUrl = await SecureStore.getItemAsync('server_url');

            const response = await fetch(`${serverUrl}/web/dataset/call_button`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `session_id=${sessionId}`,
                    'ngrok-skip-browser-warning': 'true',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                        model,
                        method: btnName,
                        args: [[parseInt(record_id, 10)]],
                        kwargs: {},
                    },
                }),
            });

            const data = await response.json();
            if (data.error) {
                Alert.alert('Error', data.error.data?.message || data.error.message || 'Action failed');
                return;
            }

            const result = data.result;

            // Check if the button returned a wizard / action
            if (result && typeof result === 'object' && result.type === 'ir.actions.act_window') {
                const wizardModel = result.res_model;
                const wizardTitle = result.name || 'Wizard';
                const wizardId = result.res_id;

                if (result.target === 'new') {
                    // It's a wizard — navigate to the form screen for the wizard model
                    router.push({
                        pathname: '/record-form',
                        params: {
                            model: wizardModel,
                            title: wizardTitle,
                            ...(wizardId ? { record_id: String(wizardId) } : {}),
                            wizard_context: JSON.stringify(result.context || {}),
                        }
                    });
                } else {
                    // It's a regular action — navigate to the records list for that model
                    router.push({
                        pathname: '/records',
                        params: { model: wizardModel, title: wizardTitle }
                    });
                }
            } else {
                // No action returned, just refresh
                Alert.alert('Success', 'Action completed', [
                    { text: 'OK', onPress: () => router.back() }
                ]);
            }
        } catch (err: any) {
            Alert.alert('Error', err.message);
        }
    };

    const updateValue = (key: string, val: any) => {
        setValues(prev => ({ ...prev, [key]: val }));
    };

    // ── Field Renderer ──
    const renderField = (key: string, field: FieldSchema) => {
        if (field.type === 'binary') {
            const value = values[key];
            const isReadonly = field.readonly || key === 'id';
            return (
                <View key={key} style={styles.formGroup}>
                    <Text style={[styles.label, field.required && styles.labelRequired]}>
                        {field.string}
                    </Text>
                    {value ? (
                        <Image
                            source={{ uri: `data:image/png;base64,${value}` }}
                            style={{ width: '100%', height: 250, resizeMode: 'contain', backgroundColor: COLORS.border + '30', borderRadius: 8, marginTop: 8 }}
                        />
                    ) : (
                        <Text style={{ color: COLORS.textLight, fontSize: 13, fontStyle: 'italic' }}>No image/file</Text>
                    )}
                </View>
            );
        }

        // ── One2many / Many2many — render as embedded list ──
        if (field.type === 'one2many' || field.type === 'many2many') {
            const relatedIds: any[] = values[key] || [];
            return (
                <View key={key} style={styles.formGroup}>
                    <Text style={[styles.label, field.required && styles.labelRequired]}>
                        {field.string}
                    </Text>
                    <View style={styles.section}>
                        {relatedIds.length === 0 ? (
                            <Text style={{ color: COLORS.textLight, fontSize: 13, fontStyle: 'italic' }}>No records</Text>
                        ) : (
                            relatedIds.slice(0, 20).map((item: any, idx: number) => {
                                // item can be an ID (number) or [id, name] tuple
                                const itemId = Array.isArray(item) ? item[0] : item;
                                const itemName = Array.isArray(item) ? item[1] : `Record #${item}`;
                                return (
                                    <TouchableOpacity
                                        key={`${key}-${idx}`}
                                        style={{
                                            paddingVertical: 10,
                                            borderBottomWidth: idx < relatedIds.length - 1 ? 1 : 0,
                                            borderBottomColor: COLORS.border + '40',
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                        }}
                                        onPress={() => {
                                            if (field.relation) {
                                                router.push({
                                                    pathname: '/record-form',
                                                    params: {
                                                        model: field.relation,
                                                        record_id: String(itemId),
                                                        title: String(itemName),
                                                    }
                                                });
                                            }
                                        }}
                                    >
                                        <Text style={{ color: COLORS.text, fontSize: 14, flex: 1 }} numberOfLines={1}>
                                            {String(itemName)}
                                        </Text>
                                        <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
                                    </TouchableOpacity>
                                );
                            })
                        )}
                        {relatedIds.length > 20 && (
                            <Text style={{ color: COLORS.textLight, fontSize: 12, marginTop: 8 }}>
                                + {relatedIds.length - 20} more records
                            </Text>
                        )}
                        <TouchableOpacity
                            style={[styles.actionButton, styles.actionButtonPrimary, { alignSelf: 'flex-start', marginTop: 16 }]}
                            onPress={() => {
                                if (field.relation) {
                                    const defaultField = `default_${model.replace(/\./g, '_')}_id`;
                                    const ctx = { [defaultField]: parseInt(record_id || '0', 10) };

                                    // if it's attach forms in ELN, they might just want parameter_id and eln_id 
                                    const wizardCtx = Object.keys(wizard_context ? JSON.parse(wizard_context) : {}).length > 0
                                        ? JSON.parse(wizard_context as string || '{}')
                                        : ctx;

                                    router.push({
                                        pathname: '/record-form',
                                        params: {
                                            model: field.relation,
                                            title: `New ${field.string}`,
                                            wizard_context: JSON.stringify(wizardCtx),
                                        }
                                    });
                                }
                            }}
                        >
                            <Text style={styles.actionButtonTextPrimary}>+ Add {field.string}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        const value = values[key];
        const isReadonly = field.readonly || key === 'id';

        if (field.type === 'many2one') {
            const displayVal = Array.isArray(value) ? value[1] : (value || '');
            return (
                <View key={key} style={styles.formGroup}>
                    <Text style={[styles.label, field.required && styles.labelRequired]}>
                        {field.string} {field.required ? '*' : ''}
                    </Text>
                    <TextInput style={[styles.input, styles.inputReadonly]} value={String(displayVal)} editable={false} />
                </View>
            );
        }

        if (field.type === 'boolean') {
            return (
                <View key={key} style={styles.formGroup}>
                    <Text style={[styles.label, field.required && styles.labelRequired]}>
                        {field.string}
                    </Text>
                    <View style={styles.switchContainer}>
                        <Text style={{ color: COLORS.text }}>{value ? 'Yes' : 'No'}</Text>
                        <Switch
                            value={!!value}
                            onValueChange={(val) => updateValue(key, val)}
                            trackColor={{ false: COLORS.border, true: COLORS.primary + '80' }}
                            thumbColor={value ? COLORS.primary : '#f4f3f4'}
                            disabled={isReadonly}
                        />
                    </View>
                </View>
            );
        }

        if (field.type === 'selection' && field.selection) {
            return (
                <View key={key} style={styles.formGroup}>
                    <Text style={[styles.label, field.required && styles.labelRequired]}>
                        {field.string} {field.required ? '*' : ''}
                    </Text>
                    <View style={[styles.pickerContainer, isReadonly && { backgroundColor: COLORS.border + '30' }]}>
                        <Picker
                            selectedValue={value || ''}
                            onValueChange={(itemValue) => updateValue(key, itemValue)}
                            enabled={!isReadonly}
                            style={styles.picker}
                        >
                            <Picker.Item label="Select..." value="" color={COLORS.textLight} />
                            {field.selection.map(([optVal, optLabel]) => (
                                <Picker.Item key={optVal} label={optLabel} value={optVal} />
                            ))}
                        </Picker>
                    </View>
                </View>
            );
        }

        const isNumeric = ['integer', 'float', 'monetary'].includes(field.type);

        return (
            <View key={key} style={styles.formGroup}>
                <Text style={[styles.label, field.required && styles.labelRequired]}>
                    {field.string} {field.required ? '*' : ''}
                </Text>
                <TextInput
                    style={[styles.input, isReadonly && styles.inputReadonly]}
                    value={value !== null && value !== undefined && value !== false ? String(value) : ''}
                    onChangeText={(val) => {
                        if (isNumeric) {
                            updateValue(key, val === '' ? '' : Number(val));
                        } else {
                            updateValue(key, val);
                        }
                    }}
                    editable={!isReadonly}
                    keyboardType={isNumeric ? 'numeric' : 'default'}
                    multiline={field.type === 'text' || field.type === 'html'}
                    numberOfLines={field.type === 'text' || field.type === 'html' ? 4 : 1}
                    textAlignVertical={field.type === 'text' || field.type === 'html' ? 'top' : 'center'}
                />
            </View>
        );
    };

    // ── Recursive Layout Renderer ──
    const renderNode = (node: LayoutNode, index: number): React.ReactNode => {
        if (!node) return null;

        switch (node.type) {
            case 'header': {
                return (
                    <View key={`header-${index}`} style={styles.statusBar}>
                        <View style={styles.statusBarButtons}>
                            {node.children?.map((child, i) => {
                                if (child.type === 'button') {
                                    const isPrimary = child.btn_class?.includes('btn-primary') || child.btn_class?.includes('oe_highlight');
                                    return (
                                        <TouchableOpacity
                                            key={`hbtn-${i}`}
                                            style={[styles.actionButton, isPrimary && styles.actionButtonPrimary]}
                                            onPress={() => handleButtonAction(child.name || '', child.btn_type || 'object')}
                                        >
                                            <Text style={[styles.actionButtonText, isPrimary && styles.actionButtonTextPrimary]}>
                                                {child.string || child.name}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                }
                                if (child.type === 'status_field' && child.name) {
                                    const fieldSchema = schema[child.name];
                                    const val = values[child.name];
                                    let displayVal = '';
                                    if (fieldSchema?.type === 'selection' && fieldSchema.selection) {
                                        const match = fieldSchema.selection.find(([k]) => k === val);
                                        displayVal = match ? match[1] : String(val || '');
                                    } else {
                                        displayVal = String(val || '');
                                    }
                                    return (
                                        <View key={`status-${i}`} style={styles.statusBadge}>
                                            <Text style={styles.statusBadgeText}>{displayVal}</Text>
                                        </View>
                                    );
                                }
                                return null;
                            })}
                        </View>
                    </View>
                );
            }

            case 'group': {
                return (
                    <View key={`group-${index}`} style={styles.section}>
                        {node.string ? <Text style={styles.sectionTitle}>{node.string}</Text> : null}
                        {node.children?.map((child, i) => renderNode(child, i))}
                    </View>
                );
            }

            case 'notebook': {
                const notebookKey = `nb-${index}`;
                const currentTabIndex = activeTab[notebookKey] || 0;
                const pages = node.pages || [];
                const activePage = pages[currentTabIndex];

                return (
                    <View key={notebookKey} style={styles.notebook}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={styles.tabBar}>
                                {pages.map((page, i) => (
                                    <TouchableOpacity
                                        key={`tab-${i}`}
                                        style={[styles.tab, currentTabIndex === i && styles.tabActive]}
                                        onPress={() => setActiveTab(prev => ({ ...prev, [notebookKey]: i }))}
                                    >
                                        <Text style={[styles.tabText, currentTabIndex === i && styles.tabTextActive]}>
                                            {page.string || `Tab ${i + 1}`}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                        {activePage && (
                            <View style={styles.tabContent}>
                                {activePage.children?.map((child, i) => renderNode(child, i))}
                            </View>
                        )}
                    </View>
                );
            }

            case 'separator': {
                return (
                    <View key={`sep-${index}`} style={styles.separator}>
                        {node.string ? <Text style={styles.separatorText}>{node.string}</Text> : null}
                        <View style={styles.separatorLine} />
                    </View>
                );
            }

            case 'button': {
                return (
                    <TouchableOpacity
                        key={`btn-${index}`}
                        style={styles.inlineButton}
                        onPress={() => handleButtonAction(node.name || '', node.btn_type || 'object')}
                    >
                        <Text style={styles.inlineButtonText}>{node.string || node.name}</Text>
                    </TouchableOpacity>
                );
            }

            case 'field': {
                const fieldSchema = schema[node.name || ''];
                if (!fieldSchema) return null;
                return renderField(node.name || '', fieldSchema);
            }

            case 'container': {
                return (
                    <View key={`cont-${index}`}>
                        {node.children?.map((child, i) => renderNode(child, i))}
                    </View>
                );
            }

            case 'page': {
                return (
                    <View key={`page-${index}`}>
                        {node.children?.map((child, i) => renderNode(child, i))}
                    </View>
                );
            }

            default:
                return null;
        }
    };

    // ── Loading / Error States ──
    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading form...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centerContainer}>
                <Ionicons name="alert-circle-outline" size={48} color={COLORS.textLight} />
                <Text style={styles.errorTitle}>Failed to load form</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
                    <Text style={styles.retryBtnText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // ── Separate header nodes (render outside scroll) from body nodes ──
    const headerNodes = layout.filter(n => n.type === 'header');
    const bodyNodes = layout.filter(n => n.type !== 'header');

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            {/* Top Nav Bar */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {title || (record_id ? `Edit ${model}` : `New ${model}`)}
                </Text>
                <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                        <Text style={styles.saveButtonText}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Status Bar (header buttons + state badge) */}
            {headerNodes.map((node, i) => renderNode(node, i))}

            {/* Form Body */}
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                {bodyNodes.map((node, i) => renderNode(node, i))}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
