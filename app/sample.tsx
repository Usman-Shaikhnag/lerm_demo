import Many2oneSelect from '@/components/Many2oneSelect';
import { COLORS } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';

let Notifications: any = null;
if (Constants.appOwnership !== 'expo') {
    try {
        Notifications = require('expo-notifications');
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
            }),
        });
    } catch (e) {
        console.warn("expo-notifications not available", e);
    }
}

import DocumentCaptureField from '@/components/DocumentCaptureField';
import DocumentPickerField from '@/components/DocumentPickerField';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const FIELD_NAMES = [
    'kes_no',
    'srf_id',
    'department_id',
    'discipline_id',
    'group_id',
    'material_id',
    'grade_id',
    'size_id',
    'brand',
    'client_sample_id',
    'sample_condition',
    'scope',
    'sample_description',
    'lab_location',
    'sample_received_date',
    'casting',
    'casting_date',
    'days_casting',
    'date_casting',
    'witness',
    'has_witness',
    'uom_id',
    'quantity_received',
    'quantity_consumed',
    'quantity_discarded',
    'quantity_balance',
    'state',
    'eln_id',
    'attachment',
    'attachment_name'
];

const SAMPLE_CONDITION_OPTIONS = [
    { value: 'satisfactory', label: 'Satisfactory' },
    { value: 'non_satisfactory', label: 'Non-Satisfactory' },
];

const SCOPE_OPTIONS = [
    { value: 'nabl', label: 'NABL' },
    { value: 'non_nabl', label: 'Non-NABL' },
];

const DAYS_CASTING_OPTIONS = [
    { value: '1', label: '1 Days' },
    { value: '3', label: '3 Days' },
    { value: '7', label: '7 Days' },
    { value: '14', label: '14 Days' },
    { value: '21', label: '21 Days' },
    { value: '28', label: '28 Days' },
    { value: '45', label: '45 Days' },
    { value: '56', label: '56 Days' },
    { value: '112', label: '112 Days' },
];

function SelectionField({ label, options, value, onChange, readonly }: any) {
    return (
        <View style={styles.inputContainer}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.chipRow}>
                {options.map((opt: any) => {
                    const active = value === opt.value;
                    return (
                        <TouchableOpacity
                            key={opt.value}
                            disabled={readonly}
                            style={[styles.chip, active && styles.chipActive]}
                            onPress={() => onChange(opt.value)}
                        >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

export default function SampleForm() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const recordId = params.record_id ? parseInt(params.record_id as string) : 0;

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Allotment Modal State
    const [allotmentModalVisible, setAllotmentModalVisible] = useState(false);
    const [isReallocation, setIsReallocation] = useState(false);
    const [allotmentTechnician, setAllotmentTechnician] = useState<any>(null);
    const [allocationType, setAllocationType] = useState('sample');
    const [reallocationMode, setReallocationMode] = useState('full');
    const [parameterAssignments, setParameterAssignments] = useState<any>({});

    // Actions menu
    const [actionsExpanded, setActionsExpanded] = useState(false);

    // UI state
    const [showReceivedDatePicker, setShowReceivedDatePicker] = useState(false);
    const [showCastingDatePicker, setShowCastingDatePicker] = useState(false);

    // Store current values
    const [record, setRecord] = useState<any>({});

    // Readonly condition: edit only if state is 1-allotment_pending or new
    // Assuming new samples can be created here (recordId === 0)
    const isReadonly = recordId !== 0 && record.state !== '1-allotment_pending';

    useEffect(() => {
        if (!Notifications) return;

        (async () => {
            try {
                const { status } = await Notifications.getPermissionsAsync();
                if (status !== 'granted') {
                    await Notifications.requestPermissionsAsync();
                }
            } catch (e) {
                console.warn("Notifications permission error", e);
            }
        })();

        let subscription: any;
        try {
            subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
                const fileUri = response.notification.request.content.data?.fileUri;
                if (fileUri && Platform.OS === 'android') {
                    IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                        data: fileUri,
                        flags: 1,
                        type: 'application/pdf'
                    }).catch(err => {
                        Alert.alert("Error", "Could not open file. You may need a PDF viewer installed.");
                    });
                }
            });
        } catch (e) {
            console.warn("Notifications listener error", e);
        }

        return () => {
            if (subscription) subscription.remove();
        };
    }, []);

    const fetchRecord = useCallback(async () => {
        if (!recordId) return;
        try {
            setLoading(true);
            const sessionId = await SecureStore.getItemAsync('session_id');
            const serverUrl = await SecureStore.getItemAsync('server_url');

            const response = await fetch(`${serverUrl}/mobile/record_read`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `session_id=${sessionId}`
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    params: {
                        model: 'lerm.srf.sample',
                        id: recordId
                    }
                })
            });
            const data = await response.json();
            if (data.result?.success) {
                const fetched = data.result.data;
                const parsedRecord: any = { ...fetched };

                // M2O conversions
                ['srf_id', 'discipline_id', 'group_id', 'material_id', 'grade_id', 'size_id', 'lab_location', 'uom_id'].forEach(field => {
                    if (Array.isArray(parsedRecord[field]) && parsedRecord[field].length === 2) {
                        parsedRecord[field] = {
                            id: parsedRecord[field][0],
                            name: parsedRecord[field][1]
                        };
                    } else {
                        parsedRecord[field] = null;
                    }
                });

                setRecord(parsedRecord);
            } else {
                Alert.alert('Error', data.result?.error || 'Failed to load record.');
            }
        } catch (err) {
            console.error('Fetch error:', err);
            Alert.alert('Error', 'An error occurred while loading.');
        } finally {
            setLoading(false);
        }
    }, [recordId]);

    useEffect(() => {
        if (recordId) {
            fetchRecord();
        } else {
            setRecord({
                state: '1-allotment_pending',
                sample_condition: 'satisfactory',
                scope: 'nabl',
                sample_received_date: new Date().toISOString().split('T')[0],
            });
        }
    }, [recordId, fetchRecord]);

    const handleFieldChange = (field: string, value: any) => {
        setRecord((prev: any) => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const sessionId = await SecureStore.getItemAsync('session_id');
            const serverUrl = await SecureStore.getItemAsync('server_url');

            const valuesToSave: any = {};
            FIELD_NAMES.forEach(f => {
                if (['kes_no', 'state', 'department_id', 'quantity_received', 'quantity_consumed', 'quantity_discarded', 'quantity_balance', 'uom_id', 'srf_id'].includes(f)) return;
                const val = record[f];
                if (val && typeof val === 'object' && val.id !== undefined) {
                    valuesToSave[f] = val.id;
                } else if (val !== undefined && val !== null) {
                    // For selection fields that might be boolean false or 0
                    if (f === 'days_casting' && val) {
                        valuesToSave[f] = String(val);
                    } else {
                        valuesToSave[f] = val;
                    }
                } else {
                    valuesToSave[f] = false; // Reset field if null
                }
            });

            const endpoint = recordId ? '/mobile/record_update' : '/mobile/record_create';
            const bodyParams: any = { model: 'lerm.srf.sample', values: valuesToSave };
            if (recordId) bodyParams.id = recordId;

            const response = await fetch(`${serverUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `session_id=${sessionId}`
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    params: bodyParams
                })
            });

            const data = await response.json();
            if (data.result?.success) {
                Alert.alert('Success', 'Sample saved successfully.');
                if (!recordId) {
                    router.replace({ pathname: '/record-form', params: { model: 'lerm.srf.sample', record_id: data.result.id } });
                } else {
                    fetchRecord();
                }
            } else {
                Alert.alert('Error', data.result?.error || 'Failed to save.');
            }
        } catch (err) {
            console.error('Save error:', err);
            Alert.alert('Error', 'An error occurred while saving.');
        } finally {
            setSaving(false);
        }
    };

    const openAllotmentModal = (reallot: boolean) => {
        setIsReallocation(reallot);
        setAllotmentTechnician(null);
        setAllocationType('sample');
        setReallocationMode('full');
        setParameterAssignments({});
        setAllotmentModalVisible(true);
    };

    const handleAllotSubmit = async () => {
        if (allocationType === 'sample' && !allotmentTechnician) {
            Alert.alert("Error", "Please select a technician.");
            return;
        }

        if (allocationType === 'parameter') {
            const hasAssignment = Object.values(parameterAssignments).some(val => !!val);
            if (!hasAssignment) {
                Alert.alert("Error", "Please assign at least one parameter.");
                return;
            }
        }

        try {
            setActionLoading(true);
            setAllotmentModalVisible(false);
            const sessionId = await SecureStore.getItemAsync('session_id');
            const serverUrl = await SecureStore.getItemAsync('server_url');

            const paramsPayload: any = {
                sample_id: recordId,
                is_reallocation: isReallocation,
                allocation_type: allocationType,
                reallocation_mode: reallocationMode,
            };

            if (allocationType === 'sample') {
                paramsPayload.technician_id = typeof allotmentTechnician === 'object' ? allotmentTechnician?.id : allotmentTechnician;
            } else {
                const assignments = Object.keys(parameterAssignments)
                    .filter(paramId => !!parameterAssignments[paramId])
                    .map(paramId => {
                        const t = parameterAssignments[paramId];
                        const techId = typeof t === 'object' ? t?.id : t;
                        return {
                            parameter_id: parseInt(paramId),
                            technician_id: techId
                        };
                    });
                paramsPayload.parameters_assignment = assignments;
            }

            const response = await fetch(`${serverUrl}/mobile/allot_sample`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Cookie': `session_id=${sessionId}` },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    params: paramsPayload
                })
            });

            const data = await response.json();
            if (data.result?.success) {
                Alert.alert('Success', `Sample ${isReallocation ? 'Re-alloted' : 'Alloted'} successfully.`);
                fetchRecord();
            } else {
                throw new Error(data.result?.error || "Failed to allot sample.");
            }

        } catch (err: any) {
            console.error('Allotment error:', err);
            Alert.alert('Error', err.message || 'An error occurred during allotment.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleAction = async (methodName: string, actionName: string) => {
        Alert.alert(
            `Confirm ${actionName}`,
            `Are you sure you want to ${actionName.toLowerCase()} this sample?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setActionLoading(true);
                            const sessionId = await SecureStore.getItemAsync('session_id');
                            const serverUrl = await SecureStore.getItemAsync('server_url');

                            const response = await fetch(`${serverUrl}/mobile/call_button`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Cookie': `session_id=${sessionId}`
                                },
                                body: JSON.stringify({
                                    jsonrpc: '2.0',
                                    params: {
                                        model: 'lerm.srf.sample',
                                        id: recordId,
                                        method: methodName
                                    }
                                })
                            });

                            const data = await response.json();
                            if (data.result?.success) {
                                Alert.alert('Success', `${actionName} completed successfully.`);
                                fetchRecord();
                            } else {
                                Alert.alert('Error', data.result?.error || `Failed to ${actionName.toLowerCase()}.`);
                            }
                        } catch (err) {
                            console.error('Action error:', err);
                            Alert.alert('Error', 'An error occurred during the action.');
                        } finally {
                            setActionLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleDownloadReport = async (method: string) => {
        try {
            setActionLoading(true);
            const sessionId = await SecureStore.getItemAsync('session_id');
            const serverUrl = await SecureStore.getItemAsync('server_url');

            // 1. Call print method to get report_name and data
            const response = await fetch(`${serverUrl}/mobile/call_button`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `session_id=${sessionId}`
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    params: {
                        model: 'lerm.srf.sample',
                        id: recordId,
                        method: method
                    }
                })
            });

            const data = await response.json();
            if (data.result?.success && data.result?.report_name) {
                const reportName = data.result.report_name;
                const reportData = data.result.data || {};

                // 2. Fetch the PDF as base64 using the JSON-RPC render_pdf endpoint
                const renderRes = await fetch(`${serverUrl}/mobile/render_pdf`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': `session_id=${sessionId}`
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        params: {
                            report_name: reportName,
                            id: recordId,
                            model_name: 'lerm.srf.sample',
                            data: reportData
                        }
                    })
                });

                const renderData = await renderRes.json();

                if (renderData.result?.success && renderData.result?.pdf_base64) {
                    const filename = renderData.result.filename || `${(record.kes_no || 'report').replace(/[/\\?%*:|"<>]/g, '-')}.pdf`;

                    if (Platform.OS === 'android') {
                        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                        if (permissions.granted) {
                            try {
                                const newFileUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, filename, 'application/pdf');
                                await FileSystem.writeAsStringAsync(newFileUri, renderData.result.pdf_base64, {
                                    encoding: FileSystem.EncodingType.Base64,
                                });
                                if (Notifications) {
                                    try {
                                        await Notifications.scheduleNotificationAsync({
                                            content: {
                                                title: "Download Complete",
                                                body: `Report saved as ${filename}. Tap to open.`,
                                                data: { fileUri: newFileUri },
                                            },
                                            trigger: null,
                                        });
                                    } catch (e) {
                                        console.warn("Failed to schedule notification", e);
                                        Alert.alert('Success', 'Report downloaded successfully to your chosen folder!');
                                    }
                                } else {
                                    // Fallback for Expo Go
                                    Alert.alert(
                                        'Success',
                                        'Report downloaded successfully.',
                                        [
                                            { text: 'OK', style: 'cancel' },
                                            {
                                                text: 'Open Report',
                                                onPress: () => {
                                                    IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                                                        data: newFileUri,
                                                        flags: 1,
                                                        type: 'application/pdf'
                                                    }).catch(err => {
                                                        Alert.alert("Error", "Could not open file. You may need a PDF viewer installed.");
                                                    });
                                                }
                                            }
                                        ]
                                    );
                                }
                            } catch (e: any) {
                                Alert.alert('Error', 'Failed to save file: ' + e.message);
                            }
                        } else {
                            Alert.alert('Cancelled', 'Download cancelled. Permission is required to save the file.');
                        }
                    } else {
                        // iOS fallback
                        const fileUri = FileSystem.documentDirectory + filename;
                        await FileSystem.writeAsStringAsync(fileUri, renderData.result.pdf_base64, {
                            encoding: FileSystem.EncodingType.Base64,
                        });
                        if (await Sharing.isAvailableAsync()) {
                            await Sharing.shareAsync(fileUri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
                        } else {
                            Alert.alert('Success', 'Report downloaded to: ' + fileUri);
                        }
                    }
                } else {
                    Alert.alert('Error', renderData.result?.error || 'Failed to render PDF.');
                }
            } else {
                Alert.alert('Error', data.result?.error || 'Failed to get report template.');
            }
        } catch (err) {
            console.error('Download error:', err);
            Alert.alert('Error', 'An error occurred while downloading the report.');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading Sample Form...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {recordId ? (record.kes_no || `Sample #${recordId}`) : 'New Sample'}
                </Text>
                {!isReadonly && (
                    <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveButton}>
                        {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
                {record.state && (
                    <View style={styles.statusBar}>
                        <Text style={styles.statusText}>
                            STATUS: {record.state.toUpperCase().replace('-', ' ')}
                        </Text>
                    </View>
                )}

                {recordId !== 0 && record.eln_id && (
                    <TouchableOpacity
                        style={[styles.elnLinkButton, { backgroundColor: COLORS.primary }]}
                        onPress={() => {
                            const elnId = Array.isArray(record.eln_id) ? record.eln_id[0] : record.eln_id;
                            const elnName = Array.isArray(record.eln_id) ? record.eln_id[1] : `ELN #${elnId}`;
                            router.push({
                                pathname: '/record-form',
                                params: { model: 'lerm.eln', record_id: String(elnId), title: String(elnName) }
                            });
                        }}
                    >
                        <Ionicons name="document-text-outline" size={18} color={COLORS.white} />
                        <Text style={[styles.elnLinkText, { color: COLORS.white }]}>Open ELN → {Array.isArray(record.eln_id) ? record.eln_id[1] : `#${record.eln_id}`}</Text>
                        <Ionicons name="chevron-forward" size={16} color={COLORS.white} />
                    </TouchableOpacity>
                )}

                {recordId !== 0 && (() => {
                    const actions: { label: string; icon: string; color: string; onPress: () => void }[] = [];

                    if (['1-allotment_pending', '7-partially-alloted'].includes(record.state)) {
                        actions.push({ label: 'Allot Sample', icon: 'person-add-outline', color: COLORS.primary, onPress: () => openAllotmentModal(false) });
                    }
                    if (record.state !== '1-allotment_pending') {
                        actions.push({ label: 'Re-Allot', icon: 'swap-horizontal-outline', color: '#F57C00', onPress: () => openAllotmentModal(true) });
                    }
                    // Print buttons corresponding to Odoo XML
                    actions.push({ label: 'Print Datasheet', icon: 'document-text-outline', color: '#1976D2', onPress: () => handleDownloadReport('print_datasheet') });

                    if (record.print_button_visible) {
                        actions.push({ label: 'Print NABL Report', icon: 'download-outline', color: '#1976D2', onPress: () => handleDownloadReport('print_nabl_report') });
                    }
                    if (record.state === '4-in_report') {
                        actions.push({ label: 'Print Non-NABL Report', icon: 'download-outline', color: '#1976D2', onPress: () => handleDownloadReport('print_non_nabl_report') });
                    }
                    if (record.state === '3-pending_verification' || record.state === '5-pending_approval') {
                        const method = record.state === '3-pending_verification' ? 'approve_sample' : 'approve_pending_sample';
                        actions.push({ label: 'Approve', icon: 'checkmark-circle-outline', color: '#2E7D32', onPress: () => handleAction(method, 'Approve') });
                        actions.push({ label: 'Reject', icon: 'close-circle-outline', color: '#C62828', onPress: () => handleAction('reject_sample', 'Reject') });
                    }
                    if (['1-allotment_pending', '2-alloted', '3-pending_verification', '4-in_report', '5-pending_approval'].includes(record.state)) {
                        actions.push({ label: 'Cancel Sample', icon: 'trash-outline', color: COLORS.textLight, onPress: () => handleAction('cancel_sample', 'Cancel Sample') });
                    }

                    if (actions.length === 0) return null;

                    return (
                        <View style={styles.actionsContainer}>
                            <TouchableOpacity style={[styles.actionsToggle, { backgroundColor: COLORS.primary }]} onPress={() => setActionsExpanded(!actionsExpanded)}>
                                <Ionicons name="ellipsis-horizontal-circle-outline" size={20} color={COLORS.white} />
                                <Text style={[styles.actionsToggleText, { color: COLORS.white }]}>Actions ({actions.length})</Text>
                                <Ionicons name={actionsExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.white} />
                            </TouchableOpacity>
                            {actionsExpanded && (
                                <View style={styles.actionsMenu}>
                                    {actions.map((action, idx) => (
                                        <TouchableOpacity
                                            key={idx}
                                            style={styles.actionMenuItem}
                                            onPress={() => { setActionsExpanded(false); action.onPress(); }}
                                            disabled={actionLoading}
                                        >
                                            <Ionicons name={action.icon as any} size={20} color={action.color} />
                                            <Text style={[styles.actionMenuItemText, { color: action.color }]}>{action.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                    );
                })()}

                <Text style={styles.sectionHeader}>Material Details</Text>
                <View style={styles.group}>
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Sample ID (KES No)</Text>
                        <TextInput style={styles.readonlyInput} value={record.kes_no || ''} editable={false} placeholder="New" />
                    </View>

                    <Many2oneSelect label="SRF" model="lerm.civil.srf" value={record.srf_id || null} onChange={(val) => handleFieldChange('srf_id', val)} readonly={true} />
                    <Many2oneSelect label="Discipline" model="lerm_civil.discipline" value={record.discipline_id || null} onChange={(val) => handleFieldChange('discipline_id', val)} readonly={true} />
                    <Many2oneSelect label="Group" model="lerm_civil.group" value={record.group_id || null} onChange={(val) => handleFieldChange('group_id', val)} readonly={true} />
                    <Many2oneSelect label="Material" model="product.template" value={record.material_id || null} onChange={(val) => handleFieldChange('material_id', val)} readonly={true} />

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Brand</Text>
                        <TextInput style={[styles.input, styles.readonlyInput]} value={record.brand || ''} onChangeText={(t) => handleFieldChange('brand', t)} editable={false} />
                    </View>

                    <Many2oneSelect label="Grade" model="lerm.grade.line" value={record.grade_id || null} onChange={(val) => handleFieldChange('grade_id', val)} readonly={true} />
                    <Many2oneSelect label="Size" model="lerm.size.line" value={record.size_id || null} onChange={(val) => handleFieldChange('size_id', val)} readonly={true} />
                </View>

                <Text style={styles.sectionHeader}>Sample Information</Text>
                <View style={styles.group}>
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Client Sample ID</Text>
                        <TextInput style={[styles.input, styles.readonlyInput]} value={record.client_sample_id || ''} onChangeText={(t) => handleFieldChange('client_sample_id', t)} editable={false} />
                    </View>

                    <SelectionField label="Sample Condition" options={SAMPLE_CONDITION_OPTIONS} value={record.sample_condition} onChange={(val: string) => handleFieldChange('sample_condition', val)} readonly={isReadonly} />
                    <SelectionField label="Scope" options={SCOPE_OPTIONS} value={record.scope} onChange={(val: string) => handleFieldChange('scope', val)} readonly={isReadonly} />

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Sample Received Date (YYYY-MM-DD)</Text>
                        <TouchableOpacity disabled={isReadonly} onPress={() => setShowReceivedDatePicker(true)}>
                            <View pointerEvents="none">
                                <TextInput style={[styles.input, isReadonly && styles.readonlyInput]} value={record.sample_received_date || ''} editable={false} placeholder="YYYY-MM-DD" />
                            </View>
                        </TouchableOpacity>
                        {showReceivedDatePicker && (
                            <DateTimePicker
                                value={record.sample_received_date ? new Date(record.sample_received_date) : new Date()}
                                mode="date"
                                display="default"
                                onChange={(event, selectedDate) => {
                                    setShowReceivedDatePicker(Platform.OS === 'ios');
                                    if (selectedDate && event.type !== 'dismissed') {
                                        const yyyy = selectedDate.getFullYear();
                                        const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                        const dd = String(selectedDate.getDate()).padStart(2, '0');
                                        handleFieldChange('sample_received_date', `${yyyy}-${mm}-${dd}`);
                                    }
                                }}
                            />
                        )}
                    </View>

                    <Many2oneSelect label="Lab Location" model="lerm.lab.location" value={record.lab_location || null} onChange={(val) => handleFieldChange('lab_location', val)} readonly={isReadonly} />

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Sample Description</Text>
                        <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }, isReadonly && styles.readonlyInput]} value={record.sample_description || ''} onChangeText={(t) => handleFieldChange('sample_description', t)} multiline editable={!isReadonly} />
                    </View>

                    <DocumentPickerField
                        label="Attachment"
                        fileName={record.attachment_name || null}
                        readonly={isReadonly}
                        onSelect={(base64, name) => {
                            handleFieldChange('attachment', base64);
                            handleFieldChange('attachment_name', name);
                        }}
                    />
                </View>

                <Text style={styles.sectionHeader}>Casting & Witness</Text>
                <View style={styles.group}>
                    <View style={[styles.inputContainer, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                        <Text style={styles.label}>Has Witness</Text>
                        <Switch value={record.has_witness || false} onValueChange={(val) => handleFieldChange('has_witness', val)} trackColor={{ true: COLORS.primary }} disabled={isReadonly} />
                    </View>

                    {record.has_witness && (
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Witness Name</Text>
                            <TextInput style={[styles.input, isReadonly && styles.readonlyInput]} value={record.witness || ''} onChangeText={(t) => handleFieldChange('witness', t)} editable={!isReadonly} />
                        </View>
                    )}

                    <View style={[styles.inputContainer, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                        <Text style={styles.label}>Casting Required</Text>
                        <Switch value={record.casting || false} onValueChange={(val) => handleFieldChange('casting', val)} trackColor={{ true: COLORS.primary }} disabled={isReadonly} />
                    </View>

                    {record.casting && (
                        <>
                            <SelectionField label="Days of Testing" options={DAYS_CASTING_OPTIONS} value={record.days_casting ? String(record.days_casting) : ''} onChange={(val: string) => handleFieldChange('days_casting', val)} readonly={isReadonly} />

                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Date of Casting (YYYY-MM-DD)</Text>
                                <TouchableOpacity disabled={isReadonly} onPress={() => setShowCastingDatePicker(true)}>
                                    <View pointerEvents="none">
                                        <TextInput style={[styles.input, isReadonly && styles.readonlyInput]} value={record.date_casting || ''} editable={false} placeholder="YYYY-MM-DD" />
                                    </View>
                                </TouchableOpacity>
                                {showCastingDatePicker && (
                                    <DateTimePicker
                                        value={record.date_casting ? new Date(record.date_casting) : new Date()}
                                        mode="date"
                                        display="default"
                                        onChange={(event, selectedDate) => {
                                            setShowCastingDatePicker(Platform.OS === 'ios');
                                            if (selectedDate && event.type !== 'dismissed') {
                                                const yyyy = selectedDate.getFullYear();
                                                const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                                const dd = String(selectedDate.getDate()).padStart(2, '0');
                                                handleFieldChange('date_casting', `${yyyy}-${mm}-${dd}`);
                                            }
                                        }}
                                    />
                                )}
                            </View>
                        </>
                    )}
                </View>

                {recordId !== 0 && (
                    <>
                        <Text style={styles.sectionHeader}>Quantities</Text>
                        <View style={styles.group}>
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>UOM</Text>
                                <TextInput style={styles.readonlyInput} value={record.uom_id?.name || ''} editable={false} />
                            </View>
                            <View style={styles.quantityRow}>
                                <View style={styles.quantityCol}>
                                    <Text style={styles.label}>Received</Text>
                                    <TextInput style={styles.readonlyInput} value={String(record.quantity_received || 0)} editable={false} />
                                </View>
                                <View style={styles.quantityCol}>
                                    <Text style={styles.label}>Consumed</Text>
                                    <TextInput style={styles.readonlyInput} value={String(record.quantity_consumed || 0)} editable={false} />
                                </View>
                            </View>
                            <View style={styles.quantityRow}>
                                <View style={styles.quantityCol}>
                                    <Text style={styles.label}>Discarded</Text>
                                    <TextInput style={styles.readonlyInput} value={String(record.quantity_discarded || 0)} editable={false} />
                                </View>
                                <View style={styles.quantityCol}>
                                    <Text style={styles.label}>Balance</Text>
                                    <TextInput style={styles.readonlyInput} value={String(record.quantity_balance || 0)} editable={false} />
                                </View>
                            </View>
                        </View>
                    </>
                )}

                {recordId !== 0 && (
                    <>
                        <Text style={styles.sectionHeader}>FTP Documents</Text>
                        <View style={styles.group}>
                            <DocumentCaptureField
                                label="Report"
                                model="lerm.srf.sample"
                                recordId={recordId}
                                fieldName="report_path"
                                currentPath={record.report_path || null}
                                readonly={false}
                                allowMultiple={true}
                                onUploadSuccess={(path) => handleFieldChange('report_path', path)}
                            />
                            <DocumentCaptureField
                                label="Datasheet"
                                model="lerm.srf.sample"
                                recordId={recordId}
                                fieldName="datasheet_path"
                                currentPath={record.datasheet_path || null}
                                readonly={false}
                                allowMultiple={true}
                                onUploadSuccess={(path) => handleFieldChange('datasheet_path', path)}
                            />
                        </View>
                    </>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Allotment Modal */}
            <Modal visible={allotmentModalVisible} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{isReallocation ? "Re-Allot Sample" : "Allot Sample"}</Text>
                            <TouchableOpacity onPress={() => setAllotmentModalVisible(false)}>
                                <Ionicons name="close" size={24} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            {/* Toggle Allocation Type */}
                            <SelectionField
                                label="Allocate By"
                                options={[{ label: 'Sample', value: 'sample' }, { label: 'Parameter', value: 'parameter' }]}
                                value={allocationType}
                                onChange={setAllocationType}
                            />

                            {/* Toggle Reallocation Mode if reallot */}
                            {isReallocation && (
                                <SelectionField
                                    label="Reallocation Mode"
                                    options={[{ label: 'Full', value: 'full' }, { label: 'Partial', value: 'partial' }]}
                                    value={reallocationMode}
                                    onChange={setReallocationMode}
                                />
                            )}

                            {allocationType === 'sample' ? (
                                <View style={styles.inputContainer}>
                                    <Many2oneSelect
                                        label="Select Technician"
                                        model="res.users"
                                        value={allotmentTechnician}
                                        onChange={setAllotmentTechnician}
                                    />
                                </View>
                            ) : (
                                <View style={styles.inputContainer}>
                                    <Text style={styles.label}>Assign Parameters</Text>
                                    {(record.parameters || []).map((param: any) => {
                                        let paramId, paramName;
                                        if (Array.isArray(param)) {
                                            paramId = param[0];
                                            paramName = param[1];
                                        } else if (typeof param === 'object' && param !== null) {
                                            paramId = param.id || param.parameter_id || param.name;
                                            paramName = param.name || param.display_name || param.parameter_name || `Parameter #${paramId}`;
                                        } else {
                                            paramId = param;
                                            paramName = `Parameter #${param}`;
                                        }
                                        return (
                                            <View key={paramId} style={{ marginBottom: 12 }}>
                                                <Many2oneSelect
                                                    label={String(paramName)}
                                                    model="res.users"
                                                    value={parameterAssignments[paramId] || null}
                                                    onChange={(val) => setParameterAssignments((prev: any) => ({ ...prev, [paramId]: val }))}
                                                />
                                            </View>
                                        );
                                    })}
                                    {(!record.parameters || record.parameters.length === 0) && (
                                        <Text style={{ color: COLORS.textLight, fontStyle: 'italic' }}>No parameters found.</Text>
                                    )}
                                </View>
                            )}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setAllotmentModalVisible(false)}>
                                <Text style={styles.modalCancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalSaveBtn, ((allocationType === 'sample' && !allotmentTechnician) || actionLoading) && { opacity: 0.6 }]}
                                onPress={handleAllotSubmit}
                                disabled={(allocationType === 'sample' && !allotmentTechnician) || actionLoading}
                            >
                                {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSaveBtnText}>{isReallocation ? "Re-Allot" : "Allot"}</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
    loadingText: { marginTop: 12, color: COLORS.text, fontSize: 16 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, paddingTop: Platform.OS === 'ios' ? 56 : 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    backButton: { padding: 4, marginRight: 10 },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: 'bold', color: COLORS.text },
    saveButton: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    saveButtonText: { color: '#fff', fontWeight: 'bold' },
    formContainer: { padding: 16 },
    statusBar: { backgroundColor: COLORS.primary + '20', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, marginBottom: 16, alignItems: 'center' },
    statusText: { fontWeight: 'bold', color: COLORS.primary },
    sectionHeader: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: 12, textTransform: 'uppercase' },
    group: { backgroundColor: COLORS.white, borderRadius: 10, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
    inputContainer: { marginBottom: 16 },
    label: { fontSize: 14, color: COLORS.textLight, marginBottom: 6, fontWeight: '500' },
    input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, height: 44, fontSize: 15, color: COLORS.text },
    readonlyInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, height: 44, fontSize: 15, color: COLORS.textLight, backgroundColor: COLORS.background },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff' },
    chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { fontSize: 13, color: COLORS.text },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    quantityRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    quantityCol: { flex: 0.48 },
    actionButton: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, flex: 1, alignItems: 'center', minWidth: '30%' },
    actionButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
    modalContent: { backgroundColor: COLORS.background, borderRadius: 12, overflow: 'hidden', maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
    modalBody: { padding: 16 },
    modalFooter: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface, gap: 12 },
    modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
    modalSaveBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center' },
    modalCancelBtnText: { color: COLORS.text, fontWeight: '600', fontSize: 16 },
    modalSaveBtnText: { color: COLORS.white, fontWeight: '600', fontSize: 16 },
    elnLinkButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary + '12', borderWidth: 1, borderColor: COLORS.primary + '40', borderRadius: 10, padding: 14, marginBottom: 16, gap: 10 },
    elnLinkText: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.primary },
    actionsContainer: { marginBottom: 16, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
    actionsToggle: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: COLORS.surface, gap: 8 },
    actionsToggleText: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.primary },
    actionsMenu: { backgroundColor: COLORS.background },
    actionMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 12 },
    actionMenuItemText: { fontSize: 15, fontWeight: '500' },
});
