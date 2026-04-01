import { COLORS } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
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
    invisible?: string;
    is_stat_button?: boolean;
    stat_field?: string;
    statusbar_visible?: string;
    children?: LayoutNode[];
    pages?: LayoutNode[];
}

/**
 * Evaluate an Odoo 17 invisible expression against current record values.
 * Handles common patterns:
 *   - field_name == 'value' / field_name != 'value'
 *   - field_name in ('a', 'b') / field_name not in ('a', 'b')
 *   - field_name (truthy) / not field_name
 *   - compound: expr1 and expr2, expr1 or expr2
 * Returns true if the element should be HIDDEN.
 * Defaults to false (visible) if expression can't be parsed.
 */
function evaluateInvisible(expr: string | undefined, values: Record<string, any>): boolean {
    if (!expr) return false;

    try {
        // Handle Odoo <= 16 domain-style modifiers (JSON array)
        if (expr.startsWith('[')) {
            const domain = JSON.parse(expr);
            // Simple domain: [["field", "=", "value"]] — evaluate each tuple with AND
            return domain.every((condition: any) => {
                if (!Array.isArray(condition) || condition.length !== 3) return false;
                const [field, op, val] = condition;
                const recordVal = values[field];
                // Resolve many2one values
                const rv = Array.isArray(recordVal) ? recordVal[0] : recordVal;
                switch (op) {
                    case '=': case '==': return rv == val;
                    case '!=': case '<>': return rv != val;
                    case 'in': return Array.isArray(val) && val.includes(rv);
                    case 'not in': return Array.isArray(val) && !val.includes(rv);
                    default: return false;
                }
            });
        }

        // Split by ' or ' first, then ' and ' within each branch
        const orParts = expr.split(/\s+or\s+/);
        if (orParts.length > 1) {
            return orParts.some(part => evaluateInvisible(part.trim(), values));
        }

        const andParts = expr.split(/\s+and\s+/);
        if (andParts.length > 1) {
            return andParts.every(part => evaluateInvisible(part.trim(), values));
        }

        // Single expression
        const trimmed = expr.trim();

        // "field_name not in ('a', 'b', 'c')"  or  "field_name not in ['a', 'b']"
        let match = trimmed.match(/^(\w+)\s+not\s+in\s+[\(\[](.+?)[\)\]]$/);
        if (match) {
            const fieldVal = resolveVal(values[match[1]]);
            const items = parseListItems(match[2]);
            return !items.includes(fieldVal);
        }

        // "field_name in ('a', 'b', 'c')"  or  "field_name in ['a', 'b']"
        match = trimmed.match(/^(\w+)\s+in\s+[\(\[](.+?)[\)\]]$/);
        if (match) {
            const fieldVal = resolveVal(values[match[1]]);
            const items = parseListItems(match[2]);
            return items.includes(fieldVal);
        }

        // "field_name != 'value'" or 'field_name != "value"'
        match = trimmed.match(/^(\w+)\s*!=\s*['"](.+?)['"]$/);
        if (match) {
            return resolveVal(values[match[1]]) !== match[2];
        }

        // "field_name == 'value'" or "field_name = 'value'"
        match = trimmed.match(/^(\w+)\s*={1,2}\s*['"](.+?)['"]$/);
        if (match) {
            return resolveVal(values[match[1]]) === match[2];
        }

        // "field_name != True/False" or numeric comparisons
        match = trimmed.match(/^(\w+)\s*!=\s*(True|False|\d+)$/i);
        if (match) {
            const fieldVal = values[match[1]];
            const cmpVal = parseLiteral(match[2]);
            return fieldVal != cmpVal;
        }

        match = trimmed.match(/^(\w+)\s*={1,2}\s*(True|False|\d+)$/i);
        if (match) {
            const fieldVal = values[match[1]];
            const cmpVal = parseLiteral(match[2]);
            return fieldVal == cmpVal;
        }

        // "not field_name" (falsy check — invisible when field is falsy)
        match = trimmed.match(/^not\s+(\w+)$/);
        if (match) {
            return !values[match[1]];
        }

        // "field_name" (truthy check — invisible when field is truthy)
        match = trimmed.match(/^(\w+)$/);
        if (match) {
            return !!values[match[1]];
        }

    } catch (e) {
        console.warn('Could not evaluate invisible expression:', expr, e);
    }
    return false; // Default: visible
}

function resolveVal(v: any): any {
    // Many2one values come as [id, name] — use the id for comparison
    if (Array.isArray(v)) return v[0];
    if (v === false || v === null || v === undefined) return false;
    return v;
}

function parseListItems(s: string): any[] {
    return s.split(',').map(item => {
        const t = item.trim().replace(/^['"]|['"]$/g, '');
        return t === 'True' ? true : t === 'False' ? false : isNaN(Number(t)) ? t : Number(t);
    });
}

function parseLiteral(s: string): any {
    if (s.toLowerCase() === 'true') return true;
    if (s.toLowerCase() === 'false') return false;
    const n = Number(s);
    return isNaN(n) ? s : n;
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
    const handleButtonAction = async (btnName: string, btnType: string, recordIdOverride?: number, modelOverride?: string) => {
        const targetId = recordIdOverride !== undefined ? recordIdOverride : parseInt(record_id || '0', 10);
        const targetModel = modelOverride || model;

        if (!targetId) {
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
                        model: targetModel,
                        method: btnName,
                        args: [[targetId]],
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
                const actionModel = result.res_model;
                const actionTitle = result.name || title || actionModel;
                const actionId = result.res_id;
                const actionContext = result.context || {};

                if (result.target === 'new') {
                    // It's a wizard — navigate to the form screen for the wizard model
                    router.push({
                        pathname: '/record-form',
                        params: {
                            model: actionModel,
                            title: actionTitle,
                            ...(actionId ? { record_id: String(actionId) } : {}),
                            wizard_context: JSON.stringify(actionContext),
                        }
                    });
                }
                else {
                    // It's a list action — navigate to the records list for that model
                    // Pass domain if available so only related records are shown
                    router.push({
                        pathname: '/records',
                        params: {
                            model: actionModel,
                            title: actionTitle,
                            ...(result.domain ? { action_domain: JSON.stringify(result.domain) } : {}),
                        }
                    });
                }
            } else if (result && typeof result === 'object' && result.type === 'ir.actions.report') {
                // It's a report download action
                try {
                    const reportName = result.report_name;
                    const reportType = result.report_type || 'qweb-pdf';
                    
                    // Odoo report routes are typically /report/pdf/report_name/id
                    const ext = reportType === 'qweb-html' ? 'html' : 'pdf';
                    const routeType = reportType === 'qweb-html' ? 'html' : 'pdf';
                    // We must pass the report context or data if provided, but URL access is simplest
                    const url = `${serverUrl}/report/${routeType}/${reportName}/${targetId}`;
                    
                    // @ts-ignore
                    const fileUri = `${FileSystem.documentDirectory || 'file:///tmp/'}${reportName.replace(/\./g, '_')}_${targetId}.${ext}`;

                    Alert.alert('Downloading', 'Please wait while the report downloads...');

                    const downloadRes = await FileSystem.downloadAsync(url, fileUri, {
                        headers: {
                            'Cookie': `session_id=${sessionId}`,
                            'ngrok-skip-browser-warning': 'true',
                        }
                    });

                    if (downloadRes.status !== 200) {
                        throw new Error(`Server returned ${downloadRes.status} when downloading the report.`);
                    }

                    if (await Sharing.isAvailableAsync()) {
                        await Sharing.shareAsync(downloadRes.uri, {
                            mimeType: reportType === 'qweb-html' ? 'text/html' : 'application/pdf',
                            dialogTitle: `View ${reportName}`,
                        });
                    } else {
                        Alert.alert('Saved', `Report saved to: ${downloadRes.uri}`);
                    }
                } catch (reportErr: any) {
                    console.error('Error downloading report:', reportErr);
                    Alert.alert('Download Failed', reportErr.message);
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
    const renderField = (key: string, field: FieldSchema, node?: LayoutNode) => {
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
            
            // Check if there is an embedded tree view in this field's layout node
            let treeNode = node?.children?.find(c => c.type === 'tree');
            let inlineButtons: LayoutNode[] = [];
            
            if (treeNode && treeNode.children) {
                inlineButtons = treeNode.children.filter(c => c.type === 'button');
            }

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
                                    <View
                                        key={`${key}-${idx}`}
                                        style={{
                                            paddingVertical: 10,
                                            borderBottomWidth: idx < relatedIds.length - 1 ? 1 : 0,
                                            borderBottomColor: COLORS.border + '40',
                                        }}
                                    >
                                        <TouchableOpacity
                                            style={{
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
                                            <Text style={{ color: COLORS.text, fontSize: 14, flex: 1, fontWeight: '500' }} numberOfLines={2}>
                                                {String(itemName)}
                                            </Text>
                                            <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
                                        </TouchableOpacity>
                                        
                                        {/* Inline tree buttons (e.g., Duplicate, Delete) */}
                                        {inlineButtons.length > 0 && (
                                            <View style={{ flexDirection: 'row', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
                                                {inlineButtons.map((btn, bIdx) => (
                                                    <TouchableOpacity
                                                        key={`ibtn-${bIdx}`}
                                                        style={[
                                                            styles.actionButton, 
                                                            { paddingVertical: 6, paddingHorizontal: 12, minWidth: 0, flex: 0 },
                                                            btn.btn_class?.includes('btn-danger') && { backgroundColor: '#ffebee', borderWidth: 1, borderColor: '#f44336' },
                                                        ]}
                                                        onPress={() => {
                                                            // For x2many inline buttons, the action runs on the specific row's record
                                                            // We pass the tree element's ID and its related model
                                                            handleButtonAction(btn.name || '', btn.btn_type || 'object', Number(itemId), field.relation);
                                                        }}
                                                    >
                                                        <Text style={[
                                                            styles.actionButtonText, 
                                                            { fontSize: 12 },
                                                            btn.btn_class?.includes('btn-danger') && { color: '#d32f2f' }
                                                        ]}>
                                                            {btn.string || btn.name}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </View>
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

        // Check dynamic visibility — if invisible evaluates to true, skip
        if (node.invisible && evaluateInvisible(node.invisible, values)) {
            return null;
        }

        switch (node.type) {
            case 'header': {
                // Filter children by visibility
                const visibleChildren = (node.children || []).filter(
                    child => !child.invisible || !evaluateInvisible(child.invisible, values)
                );
                if (visibleChildren.length === 0) return null;

                return (
                    <View key={`header-${index}`} style={styles.statusBar}>
                        <View style={styles.statusBarButtons}>
                            {visibleChildren.map((child, i) => {
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
                                    
                                    // If we have an explicit statusbar_visible list (from backend)
                                    if (child.statusbar_visible && fieldSchema?.selection) {
                                        const visibleKeys = child.statusbar_visible.split(',').map((s: string) => s.trim());
                                        
                                        // Ensure the current value is in the sequence, even if not explicitly listed in visibleKeys
                                        let sequenceKeys = [...visibleKeys];
                                        if (val && !sequenceKeys.includes(val)) {
                                            sequenceKeys.push(val);
                                        }

                                        // Try to order by the selection options order if possible
                                        const selectionKeys = fieldSchema.selection.map(([k]) => k);
                                        sequenceKeys.sort((a, b) => {
                                            const idxA = selectionKeys.indexOf(a);
                                            const idxB = selectionKeys.indexOf(b);
                                            if (idxA === -1 && idxB === -1) return 0;
                                            if (idxA === -1) return 1;
                                            if (idxB === -1) return -1;
                                            return idxA - idxB;
                                        });

                                        const activeIndex = sequenceKeys.indexOf(val);

                                        return (
                                            <ScrollView 
                                                key={`status-${i}`} 
                                                horizontal 
                                                showsHorizontalScrollIndicator={false}
                                                style={{flexDirection: 'row', marginLeft: 8}}
                                                contentContainerStyle={{alignItems: 'center'}}
                                            >
                                                {sequenceKeys.map((stepKey, stepIdx) => {
                                                    const match = fieldSchema.selection!.find(([k]) => k === stepKey);
                                                    const stepLabel = match ? match[1] : stepKey;
                                                    const isActive = stepIdx <= activeIndex;
                                                    const isCurrent = stepIdx === activeIndex;
                                                    
                                                    return (
                                                        <View key={stepKey} style={{flexDirection: 'row', alignItems: 'center'}}>
                                                            <View style={[
                                                                styles.statusBadge, 
                                                                isActive ? {backgroundColor: COLORS.primary} : {backgroundColor: COLORS.border, opacity: 0.5},
                                                                isCurrent ? {borderWidth: 2, borderColor: '#a0c4ff'} : {}
                                                            ]}>
                                                                <Text style={[styles.statusBadgeText, isActive ? {color: '#fff'} : {color: '#333'}]}>
                                                                    {stepLabel}
                                                                </Text>
                                                            </View>
                                                            {stepIdx < sequenceKeys.length - 1 && (
                                                                <Ionicons name="chevron-forward" size={16} color={COLORS.border} style={{marginHorizontal: 4}} />
                                                            )}
                                                        </View>
                                                    );
                                                })}
                                            </ScrollView>
                                        );
                                    }

                                    // Fallback to single badge
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
                // Filter pages by visibility
                const visiblePages = (node.pages || []).filter(
                    page => !page.invisible || !evaluateInvisible(page.invisible, values)
                );
                if (visiblePages.length === 0) return null;

                const currentTabIndex = activeTab[notebookKey] || 0;
                const safeTabIndex = currentTabIndex < visiblePages.length ? currentTabIndex : 0;
                const activePage = visiblePages[safeTabIndex];

                return (
                    <View key={notebookKey} style={styles.notebook}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={styles.tabBar}>
                                {visiblePages.map((page, i) => (
                                    <TouchableOpacity
                                        key={`tab-${i}`}
                                        style={[styles.tab, safeTabIndex === i && styles.tabActive]}
                                        onPress={() => setActiveTab(prev => ({ ...prev, [notebookKey]: i }))}
                                    >
                                        <Text style={[styles.tabText, safeTabIndex === i && styles.tabTextActive]}>
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
                // Stat buttons show count + label (e.g. "5 Samples")
                if (node.is_stat_button && node.stat_field) {
                    const statValue = values[node.stat_field];
                    return (
                        <TouchableOpacity
                            key={`btn-${index}`}
                            style={[styles.inlineButton, { flexDirection: 'column', alignItems: 'center', minWidth: 80, paddingVertical: 12 }]}
                            onPress={() => handleButtonAction(node.name || '', node.btn_type || 'object')}
                        >
                            <Text style={[styles.inlineButtonText, { fontSize: 20, fontWeight: 'bold' }]}>
                                {statValue !== undefined && statValue !== null && statValue !== false ? String(statValue) : '0'}
                            </Text>
                            <Text style={[styles.inlineButtonText, { fontSize: 12, marginTop: 2 }]}>
                                {node.string || node.name}
                            </Text>
                        </TouchableOpacity>
                    );
                }

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
                return renderField(node.name || '', fieldSchema, node);
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
