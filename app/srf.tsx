import Many2oneSelect from '@/components/Many2oneSelect';
import { COLORS } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import AddEditSampleWizard from '@/components/AddEditSampleWizard';
import DocumentPickerField from '@/components/DocumentPickerField';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const FIELD_NAMES = [
    'srf_id',
    'srf_date',
    'customer',
    'contact_person',
    'site_address',
    'client_refrence',
    'name_work',
    'client',
    'contractor',
    'billing_customer',
    'consultant_name1',
    'state',
    'samples',
    'attachment',
    'attachment_name'
];

export default function SRFForm() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const recordId = params.record_id ? parseInt(params.record_id as string) : 0;

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    
    // Wizard state
    const [showSampleWizard, setShowSampleWizard] = useState(false);
    const [wizardEditMode, setWizardEditMode] = useState(false);
    const [wizardEditSampleId, setWizardEditSampleId] = useState<string | null>(null);

    // Store current values. Many2one is stored as {id, name}
    const [record, setRecord] = useState<any>({});
    // Store domains for constrained Many2ones
    const [domains, setDomains] = useState<any>({});

    const [isEditMode, setIsEditMode] = useState(false);

    const isConfirmed = record.state === '2-confirm' && !isEditMode;

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
                        model: 'lerm.civil.srf',
                        id: recordId
                    }
                })
            });
            const data = await response.json();
            if (data.result?.success) {
                const fetched = data.result.data;
                // Convert arrays [id, name] to {id, name} for Many2oneSelect
                const parsedRecord: any = { ...fetched };
                ['customer', 'contact_person', 'name_work', 'contractor', 'billing_customer'].forEach(field => {
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
            // Setup defaults for a new record if needed
            setRecord({
                srf_date: new Date().toISOString().split('T')[0], // default to today
                state: '1-draft'
            });
        }
    }, [recordId, fetchRecord]);

    // Handle standard generic fields
    const handleFieldChange = (field: string, value: any) => {
        setRecord((prev: any) => ({ ...prev, [field]: value }));
    };

    // Handle Many2one specifically, and trigger Odoo onchange if needed
    const handleMany2oneChange = async (field: string, value: any) => {
        const newRecord = { ...record, [field]: value };
        setRecord(newRecord);

        // Odoo compute properties on SRF:
        if (field === 'customer' || field === 'name_work' || field === 'contact_person') {
            await triggerOnChange(field, newRecord);
        }
    };

    const triggerOnChange = async (fieldName: string, currentRecordContext: any) => {
        try {
            const sessionId = await SecureStore.getItemAsync('session_id');
            const serverUrl = await SecureStore.getItemAsync('server_url');

            // Determine which compute/onchange methods to trigger manually based on lerm_mobile backend implementation
            let methodsToCall: string[] = [];
            if (fieldName === 'contact_person') {
                methodsToCall = ['_compute_site_address'];
            } else if (fieldName === 'customer') {
                methodsToCall = ['_compute_name_work', 'compute_client'];
            } else if (fieldName === 'name_work') {
                methodsToCall = ['_onchange_name_work', '_compute_consultant_name1', '_onchange_name_client', '_compute_name_client1'];
            }

            // Format values for the backend trigger
            const valuesForBackend: any = {};
            FIELD_NAMES.forEach(f => {
                const val = currentRecordContext[f];
                if (val && typeof val === 'object' && val.id) {
                    valuesForBackend[f] = val.id;
                } else {
                    valuesForBackend[f] = val || false;
                }
            });

            const response = await fetch(`${serverUrl}/mobile/onchange`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `session_id=${sessionId}`
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    params: {
                        model: 'lerm.civil.srf',
                        record_id: recordId,
                        values: valuesForBackend,
                        field_name: fieldName,
                        field_names: FIELD_NAMES,
                        methods_to_call: methodsToCall
                    }
                })
            });

            const data = await response.json();
            if (data.result?.success) {
                // Apply changes
                if (data.result.changes) {
                    const changes = data.result.changes;
                    setRecord((prev: any) => {
                        const updated = { ...prev };
                        Object.keys(changes).forEach(k => {
                            // Convert Many2one responses [id, name] back to {id, name}
                            if (Array.isArray(changes[k]) && changes[k].length === 2 && typeof changes[k][0] === 'number') {
                                updated[k] = { id: changes[k][0], name: changes[k][1] };
                            } else {
                                updated[k] = changes[k];
                            }
                        });
                        return updated;
                    });
                }
                // Apply any new dynamic domains
                if (data.result.domain) {
                    setDomains((prev: any) => ({ ...prev, ...data.result.domain }));
                }
            }
        } catch (err) {
            console.error('Trigger onchange error:', err);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const sessionId = await SecureStore.getItemAsync('session_id');
            const serverUrl = await SecureStore.getItemAsync('server_url');

            // Prepare Values
            const valuesToSave: any = {};
            FIELD_NAMES.forEach(f => {
                if (['srf_id', 'state', 'samples', 'site_address', 'client'].includes(f)) return; // Skipped readonly/complex fields
                const val = record[f];
                if (val && typeof val === 'object' && val.id !== undefined) {
                    valuesToSave[f] = val.id;
                } else if (val !== undefined && val !== null) {
                    valuesToSave[f] = val;
                }
            });

            const endpoint = recordId ? '/mobile/record_update' : '/mobile/record_create';
            const bodyParams: any = { model: 'lerm.civil.srf', values: valuesToSave };
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
                Alert.alert('Success', 'SRF Form saved successfully.');
                if (!recordId) {
                    // Go to edit mode
                    router.replace({ pathname: '/record-form', params: { model: 'lerm.civil.srf', record_id: data.result.id } });
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

    const handleConfirm = async () => {
        Alert.alert(
            'Confirm SRF',
            'Are you sure you want to confirm this SRF? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setConfirming(true);
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
                                        model: 'lerm.civil.srf',
                                        id: recordId,
                                        method: 'confirm_srf'
                                    }
                                })
                            });

                            const data = await response.json();
                            if (data.result?.success) {
                                Alert.alert('Success', 'SRF confirmed successfully.');
                                fetchRecord();
                            } else {
                                Alert.alert('Error', data.result?.error || 'Failed to confirm SRF.');
                            }
                        } catch (err) {
                            console.error('Confirm error:', err);
                            Alert.alert('Error', 'An error occurred while confirming.');
                        } finally {
                            setConfirming(false);
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
                <Text style={styles.loadingText}>Loading SRF Form...</Text>
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
                    {recordId ? `SRF ${record.srf_id || ''}` : 'New SRF'}
                </Text>
                {!isConfirmed && (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        {recordId !== 0 && record.state !== '2-confirm' && (
                            <TouchableOpacity onPress={handleConfirm} disabled={confirming} style={styles.confirmButton}>
                                {confirming ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.confirmButtonText}>Confirm</Text>}
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveButton}>
                            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
                        </TouchableOpacity>
                    </View>
                )}
                {recordId !== 0 && record.state === '2-confirm' && !isEditMode && (
                    <TouchableOpacity onPress={() => setIsEditMode(true)} style={styles.saveButton}>
                        <Text style={styles.saveButtonText}>Edit SRF</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Form ScrollView */}
            <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">

                {/* Status Bar */}
                <View style={[styles.statusBar, record.state === '2-confirm' && styles.statusConfirmed]}>
                    <Text style={[styles.statusText, record.state === '2-confirm' && styles.statusTextConfirmed]}>
                        STATUS: {record.state === '2-confirm' ? 'CONFIRMED' : 'DRAFT'}
                    </Text>
                </View>

                {/* Group 1 */}
                <Text style={styles.sectionHeader}>SRF Details</Text>
                <View style={styles.group}>
                    {/* SRF ID */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>SRF ID</Text>
                        <TextInput style={styles.readonlyInput} value={record.srf_id || ''} editable={false} placeholder="New" />
                    </View>

                    {/* SRF Date */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>SRF Date (YYYY-MM-DD)</Text>
                        <TouchableOpacity disabled={isConfirmed} onPress={() => setShowDatePicker(true)}>
                            <View pointerEvents="none">
                                <TextInput
                                    style={[styles.input, isConfirmed && styles.readonlyInput]}
                                    value={record.srf_date || ''}
                                    editable={false}
                                    placeholder="YYYY-MM-DD"
                                />
                            </View>
                        </TouchableOpacity>

                        {showDatePicker && (
                            <DateTimePicker
                                value={record.srf_date ? new Date(record.srf_date) : new Date()}
                                mode="date"
                                display="default"
                                onChange={(event, selectedDate) => {
                                    setShowDatePicker(Platform.OS === 'ios');
                                    if (selectedDate && event.type !== 'dismissed') {
                                        const yyyy = selectedDate.getFullYear();
                                        const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                        const dd = String(selectedDate.getDate()).padStart(2, '0');
                                        handleFieldChange('srf_date', `${yyyy}-${mm}-${dd}`);
                                    }
                                }}
                            />
                        )}
                    </View>

                    {/* Customer */}
                    <Many2oneSelect
                        label="Customer"
                        model="res.partner"
                        value={record.customer || null}
                        onChange={(val) => handleMany2oneChange('customer', val)}
                        readonly={isConfirmed}
                    />

                    {/* Contact Person */}
                    <Many2oneSelect
                        label="Contact Person"
                        model="res.partner"
                        domain={domains.contact_person || (record.contact_site_ids ? [['id', 'in', record.contact_site_ids]] : [])}
                        value={record.contact_person || null}
                        onChange={(val) => handleMany2oneChange('contact_person', val)}
                        readonly={isConfirmed}
                    />

                    {/* Site Address */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Site Address</Text>
                        <TextInput
                            style={styles.readonlyInput}
                            value={record.site_address || ''}
                            editable={false}
                            multiline
                        />
                    </View>

                    {/* Client Reference */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Client Reference Letter</Text>
                        <TextInput
                            style={[styles.input, isConfirmed && styles.readonlyInput]}
                            value={record.client_refrence || ''}
                            onChangeText={(t) => handleFieldChange('client_refrence', t)}
                            editable={!isConfirmed}
                        />
                    </View>
                </View>

                {/* Group 2 */}
                <Text style={styles.sectionHeader}>Secondary Details</Text>
                <View style={styles.group}>
                    {/* Name Work */}
                    <Many2oneSelect
                        label="Name of Work"
                        model="res.partner.project"
                        domain={domains.name_work || (record.name_works ? [['id', 'in', record.name_works]] : [])}
                        value={record.name_work || null}
                        onChange={(val) => handleMany2oneChange('name_work', val)}
                        readonly={isConfirmed}
                    />

                    {/* Client */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Client</Text>
                        <TextInput
                            style={styles.readonlyInput}
                            value={record.client || ''}
                            editable={false}
                        />
                    </View>

                    {/* Contractor */}
                    <Many2oneSelect
                        label="Contractor"
                        model="lerm.contractor.line"
                        domain={domains.contractor || (record.contractor_ids ? [['id', 'in', record.contractor_ids]] : [])}
                        value={record.contractor || null}
                        onChange={(val) => handleFieldChange('contractor', val)}
                        readonly={isConfirmed}
                    />

                    {/* Billing Customer */}
                    <Many2oneSelect
                        label="Billing Customer"
                        model="res.partner"
                        value={record.billing_customer || null}
                        onChange={(val) => handleFieldChange('billing_customer', val)}
                        readonly={isConfirmed}
                    />

                    {/* Consultant Name 1 */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Consultant Name</Text>
                        <TextInput
                            style={[styles.input, isConfirmed && styles.readonlyInput]}
                            value={record.consultant_name1 || ''}
                            onChangeText={(t) => handleFieldChange('consultant_name1', t)}
                            editable={!isConfirmed}
                        />
                    </View>
                    
                    <DocumentPickerField 
                        label="Attachment" 
                        fileName={record.attachment_name || null} 
                        readonly={isConfirmed} 
                        onSelect={(base64, name) => {
                            handleFieldChange('attachment', base64);
                            handleFieldChange('attachment_name', name);
                        }} 
                    />
                </View>

                {/* Samples */}
                {recordId !== 0 && (
                    <View style={styles.samplesContainer}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={[styles.sectionHeader, { marginBottom: 0 }]}>Samples</Text>
                            {!isConfirmed && (
                                <TouchableOpacity 
                                    style={styles.addSampleButton}
                                    onPress={() => {
                                        setWizardEditMode(false);
                                        setWizardEditSampleId(null);
                                        setShowSampleWizard(true);
                                    }}
                                >
                                    <Ionicons name="add" size={16} color="#fff" />
                                    <Text style={styles.addSampleButtonText}>Add Sample</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        {Array.isArray(record.samples) && record.samples.length > 0 ? (
                            record.samples.map((sample: any, idx: number) => {
                                const sampleId = Array.isArray(sample) ? sample[0] : sample.id;
                                const sampleName = Array.isArray(sample) && sample.length > 1 ? sample[1] : (sample.display_name || `Sample #${sampleId || idx}`);
                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        style={styles.sampleRow}
                                        activeOpacity={0.6}
                                        onPress={() => {
                                            if (isConfirmed) {
                                                // Read-only navigate to default
                                                router.push({
                                                    pathname: '/record-form',
                                                    params: {
                                                        model: 'lerm.srf.sample',
                                                        record_id: String(sampleId),
                                                        title: sampleName,
                                                    }
                                                });
                                            } else {
                                                // Edit via native wizard
                                                setWizardEditMode(true);
                                                setWizardEditSampleId(String(sampleId));
                                                setShowSampleWizard(true);
                                            }
                                        }}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.sampleName}>{sampleName}</Text>
                                        </View>
                                        {isConfirmed ? (
                                            <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
                                        ) : (
                                            <Ionicons name="pencil" size={18} color={COLORS.primary} />
                                        )}
                                    </TouchableOpacity>
                                )
                            })
                        ) : (
                            <Text style={styles.noSamplesText}>No samples attached.</Text>
                        )}
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            <AddEditSampleWizard 
                visible={showSampleWizard}
                onClose={() => setShowSampleWizard(false)}
                srfId={recordId}
                editMode={wizardEditMode}
                editSampleId={wizardEditSampleId}
                onSampleSaved={fetchRecord}
                isConfirmed={isConfirmed}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background
    },
    loadingText: {
        marginTop: 12,
        color: COLORS.text,
        fontSize: 16
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
    },
    backButton: {
        padding: 4,
        marginRight: 10,
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    saveButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    confirmButton: {
        backgroundColor: '#1CA350',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    confirmButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    formContainer: {
        padding: 16,
    },
    statusBar: {
        backgroundColor: COLORS.primary + '20',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginBottom: 16,
        alignItems: 'center'
    },
    statusConfirmed: {
        backgroundColor: '#E8FAEF' // green-ish
    },
    statusText: {
        fontWeight: 'bold',
        color: COLORS.primary
    },
    statusTextConfirmed: {
        color: '#1CA350'
    },
    sectionHeader: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 12,
        textTransform: 'uppercase',
    },
    group: {
        backgroundColor: COLORS.white,
        borderRadius: 10,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    inputContainer: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        color: COLORS.textLight,
        marginBottom: 6,
        fontWeight: '500',
    },
    input: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 44,
        fontSize: 15,
        color: COLORS.text,
    },
    readonlyInput: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 44,
        fontSize: 15,
        color: COLORS.textLight,
        backgroundColor: COLORS.background,
    },
    samplesContainer: {
        marginTop: 10,
    },
    sampleRow: {
        backgroundColor: COLORS.white,
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 10,
    },
    sampleName: {
        fontSize: 15,
        color: COLORS.text,
        fontWeight: '500'
    },
    noSamplesText: {
        color: COLORS.textLight,
        fontStyle: 'italic',
        marginTop: 8
    },
    addSampleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4
    },
    addSampleButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600'
    }
});