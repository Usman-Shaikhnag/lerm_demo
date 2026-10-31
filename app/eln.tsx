import DocumentCaptureField from '@/components/DocumentCaptureField';
import DocumentPickerField from '@/components/DocumentPickerField';
import Many2oneSelect from '@/components/Many2oneSelect';
import { COLORS } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
    'eln_id',
    'srf_id',
    'sample_id',
    'srf_date',
    'kes_no',
    'discipline',
    'group',
    'material',
    'grade_id',
    'size_id',
    'technician',
    'start_date',
    'end_date',
    'has_witness',
    'witness_name',
    'casting',
    'casting_date',
    'remarks',
    'state',
    'attachment',
    'attachment_name',
    'is_product_based_calculation'
];

export default function ELNForm() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const recordId = params.record_id ? parseInt(params.record_id as string) : 0;

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // UI state
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);

    // Store current values
    const [record, setRecord] = useState<any>({});

    const isReadonly = recordId !== 0 && !['1-draft', '5-alloted'].includes(record.state);

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
                        model: 'lerm.eln',
                        id: recordId
                    }
                })
            });
            const data = await response.json();
            if (data.result?.success) {
                const fetched = data.result.data;
                const parsedRecord: any = { ...fetched };

                // M2O conversions
                ['srf_id', 'sample_id', 'discipline', 'group', 'material', 'grade_id', 'size_id', 'technician'].forEach(field => {
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
                state: '1-draft',
                start_date: new Date().toISOString().split('T')[0],
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
                if (['eln_id', 'kes_no', 'state', 'srf_date', 'casting_date'].includes(f)) return;
                const val = record[f];
                if (val && typeof val === 'object' && val.id !== undefined) {
                    valuesToSave[f] = val.id;
                } else if (val !== undefined && val !== null) {
                    valuesToSave[f] = val;
                } else {
                    valuesToSave[f] = false; // Reset field if null
                }
            });

            const endpoint = recordId ? '/mobile/record_update' : '/mobile/record_create';
            const bodyParams: any = { model: 'lerm.eln', values: valuesToSave };
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
                Alert.alert('Success', 'ELN saved successfully.');
                if (!recordId) {
                    router.replace({ pathname: '/record-form', params: { model: 'lerm.eln', record_id: data.result.id } });
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

    const handleOpenForm = async () => {
        try {
            setActionLoading(true);
            const sessionId = await SecureStore.getItemAsync('session_id');
            const serverUrl = await SecureStore.getItemAsync('server_url');

            const response = await fetch(`${serverUrl}/mobile/call_button`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Cookie': `session_id=${sessionId}` },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    params: { model: 'lerm.eln', id: recordId, method: 'open_product_based_form' }
                })
            });

            const data = await response.json();
            if (data.result?.success && data.result?.res_model) {
                router.push({
                    pathname: '/record-form',
                    params: {
                        model: data.result.res_model,
                        record_id: data.result.res_id ? String(data.result.res_id) : undefined
                    }
                });
            } else {
                Alert.alert('Error', data.result?.error || 'Failed to open form. Make sure the record has a sample attached.');
            }
        } catch (err) {
            console.error('Open Form error:', err);
            Alert.alert('Error', 'An error occurred opening the form.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleAction = async (methodName: string, actionName: string) => {
        Alert.alert(
            `Confirm ${actionName}`,
            `Are you sure you want to ${actionName.toLowerCase()} this ELN?`,
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
                                        model: 'lerm.eln',
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

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading ELN Form...</Text>
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
                    {recordId ? (record.eln_id || `ELN #${recordId}`) : 'New ELN'}
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

                {recordId !== 0 && ['1-draft', '4-rejected'].includes(record.state) && (
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                        <TouchableOpacity onPress={() => handleAction('confirm_eln', 'Confirm')} disabled={actionLoading} style={styles.actionButton}>
                            {actionLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.actionButtonText}>Confirm ELN</Text>}
                        </TouchableOpacity>
                    </View>
                )}

                <Text style={styles.sectionHeader}>ELN Details</Text>
                <View style={styles.group}>
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>ELN ID</Text>
                        <TextInput style={styles.readonlyInput} value={record.eln_id || ''} editable={false} placeholder="New" />
                    </View>

                    <Many2oneSelect label="SRF" model="lerm.civil.srf" value={record.srf_id || null} onChange={(val) => handleFieldChange('srf_id', val)} readonly={isReadonly} />
                    <Many2oneSelect label="Sample" model="lerm.srf.sample" value={record.sample_id || null} onChange={(val) => handleFieldChange('sample_id', val)} readonly={isReadonly} />

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>SRF Date</Text>
                        <TextInput style={styles.readonlyInput} value={record.srf_date || ''} editable={false} />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>KES No (UID)</Text>
                        <TextInput style={styles.readonlyInput} value={record.kes_no || ''} editable={false} />
                    </View>

                    <Many2oneSelect label="Discipline" model="lerm_civil.discipline" value={record.discipline || null} onChange={(val) => handleFieldChange('discipline', val)} readonly={isReadonly} />
                    <Many2oneSelect label="Group" model="lerm_civil.group" value={record.group || null} onChange={(val) => handleFieldChange('group', val)} readonly={isReadonly} />
                    <Many2oneSelect label="Material" model="product.template" value={record.material || null} onChange={(val) => handleFieldChange('material', val)} readonly={isReadonly} />
                    <Many2oneSelect label="Grade" model="lerm.grade.line" value={record.grade_id || null} onChange={(val) => handleFieldChange('grade_id', val)} readonly={isReadonly} />
                    <Many2oneSelect label="Size" model="lerm.size.line" value={record.size_id || null} onChange={(val) => handleFieldChange('size_id', val)} readonly={isReadonly} />
                    <Many2oneSelect label="Technician" model="res.users" value={record.technician || null} onChange={(val) => handleFieldChange('technician', val)} readonly={isReadonly} />

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

                <Text style={styles.sectionHeader}>Test Schedule</Text>
                <View style={styles.group}>
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Start Date (YYYY-MM-DD)</Text>
                        <TouchableOpacity disabled={isReadonly} onPress={() => setShowStartDatePicker(true)}>
                            <View pointerEvents="none">
                                <TextInput style={[styles.input, isReadonly && styles.readonlyInput]} value={record.start_date || ''} editable={false} placeholder="YYYY-MM-DD" />
                            </View>
                        </TouchableOpacity>
                        {showStartDatePicker && (
                            <DateTimePicker
                                value={record.start_date ? new Date(record.start_date) : new Date()}
                                mode="date"
                                display="default"
                                onChange={(event, selectedDate) => {
                                    setShowStartDatePicker(Platform.OS === 'ios');
                                    if (selectedDate && event.type !== 'dismissed') {
                                        const yyyy = selectedDate.getFullYear();
                                        const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                        const dd = String(selectedDate.getDate()).padStart(2, '0');
                                        handleFieldChange('start_date', `${yyyy}-${mm}-${dd}`);
                                    }
                                }}
                            />
                        )}
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>End Date (YYYY-MM-DD)</Text>
                        <TouchableOpacity disabled={isReadonly} onPress={() => setShowEndDatePicker(true)}>
                            <View pointerEvents="none">
                                <TextInput style={[styles.input, isReadonly && styles.readonlyInput]} value={record.end_date || ''} editable={false} placeholder="YYYY-MM-DD" />
                            </View>
                        </TouchableOpacity>
                        {showEndDatePicker && (
                            <DateTimePicker
                                value={record.end_date ? new Date(record.end_date) : new Date()}
                                mode="date"
                                display="default"
                                onChange={(event, selectedDate) => {
                                    setShowEndDatePicker(Platform.OS === 'ios');
                                    if (selectedDate && event.type !== 'dismissed') {
                                        const yyyy = selectedDate.getFullYear();
                                        const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                        const dd = String(selectedDate.getDate()).padStart(2, '0');
                                        handleFieldChange('end_date', `${yyyy}-${mm}-${dd}`);
                                    }
                                }}
                            />
                        )}
                    </View>
                </View>

                {recordId !== 0 && record.is_product_based_calculation && (
                    <View style={{ marginBottom: 20 }}>
                        <TouchableOpacity onPress={handleOpenForm} disabled={actionLoading} style={[styles.actionButton, { backgroundColor: COLORS.primary, paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', gap: 8 }]}>
                            {actionLoading ? <ActivityIndicator size="small" color="#fff" /> : (
                                <>
                                    <Ionicons name="document-text-outline" size={20} color="#fff" />
                                    <Text style={[styles.actionButtonText, { fontSize: 16 }]}>Open Form</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                <Text style={styles.sectionHeader}>Casting & Witness</Text>
                <View style={styles.group}>
                    <View style={[styles.inputContainer, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                        <Text style={styles.label}>Has Witness</Text>
                        <Switch value={record.has_witness || false} onValueChange={(val) => handleFieldChange('has_witness', val)} trackColor={{ true: COLORS.primary }} disabled={isReadonly} />
                    </View>

                    {record.has_witness && (
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Witness Name</Text>
                            <TextInput style={[styles.input, isReadonly && styles.readonlyInput]} value={record.witness_name || ''} onChangeText={(t) => handleFieldChange('witness_name', t)} editable={!isReadonly} />
                        </View>
                    )}

                    <View style={[styles.inputContainer, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                        <Text style={styles.label}>Casting Required</Text>
                        <Switch value={record.casting || false} onValueChange={(val) => handleFieldChange('casting', val)} trackColor={{ true: COLORS.primary }} disabled={true} />
                    </View>

                    {record.casting && (
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Casting Date</Text>
                            <TextInput style={styles.readonlyInput} value={record.casting_date || ''} editable={false} />
                        </View>
                    )}
                </View>

                <Text style={styles.sectionHeader}>Remarks</Text>
                <View style={styles.group}>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={[styles.input, { height: 100, textAlignVertical: 'top' }, isReadonly && styles.readonlyInput]}
                            value={record.remarks || ''}
                            onChangeText={(t) => handleFieldChange('remarks', t)}
                            multiline
                            editable={!isReadonly}
                            placeholder="Enter remarks here..."
                        />
                    </View>
                </View>

                {recordId !== 0 && (
                    <>
                        <Text style={styles.sectionHeader}>FTP Documents</Text>
                        <View style={styles.group}>
                            <DocumentCaptureField
                                label="Witness Photo"
                                model="lerm.eln"
                                recordId={recordId}
                                fieldName="witness_path"
                                currentPath={record.witness_path || null}
                                readonly={false}
                                allowMultiple={false}
                                onUploadSuccess={(path) => handleFieldChange('witness_path', path)}
                            />
                            <DocumentCaptureField
                                label="Attachment"
                                model="lerm.eln"
                                recordId={recordId}
                                fieldName="attachment_path"
                                currentPath={record.attachment_path || null}
                                readonly={false}
                                allowMultiple={true}
                                onUploadSuccess={(path) => handleFieldChange('attachment_path', path)}
                            />
                        </View>
                    </>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
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
    actionButton: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, flex: 1, alignItems: 'center', minWidth: '30%' },
    actionButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
