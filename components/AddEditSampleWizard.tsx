import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
    Modal,
    Switch,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import * as SecureStore from 'expo-secure-store';

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

// ─── Help Components ────────────────────────────────────────────────────────
function SelectionField({ label, options, value, onChange, readonly }: any) {
    return (
        <View style={wizStyles.fieldContainer}>
            <Text style={wizStyles.label}>{label}</Text>
            <View style={wizStyles.chipRow}>
                {options.map((opt: any) => {
                    const active = value === opt.value;
                    return (
                        <TouchableOpacity
                            key={opt.value}
                            disabled={readonly}
                            style={[wizStyles.chip, active && wizStyles.chipActive]}
                            onPress={() => onChange(opt.value)}
                        >
                            <Text style={[wizStyles.chipText, active && wizStyles.chipTextActive]}>{opt.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

function WizardDropdown({ label, options, value, onChange, placeholder, readonly }: any) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredOptions = React.useMemo(() => {
        if (!searchQuery) return options;
        return options.filter((opt: any) => opt.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [options, searchQuery]);

    const handleClose = () => {
        setOpen(false);
        setSearchQuery('');
    };

    return (
        <View style={wizStyles.fieldContainer}>
            <Text style={wizStyles.label}>{label}</Text>
            <TouchableOpacity
                style={[wizStyles.dropdownButton, readonly && { backgroundColor: COLORS.background }]}
                onPress={() => !readonly && setOpen(true)}
                disabled={readonly}
            >
                <Text style={[wizStyles.dropdownText, !value && { color: COLORS.textLight }]}>
                    {value ? value.name : (placeholder || 'Select...')}
                </Text>
                <Ionicons name="chevron-down" size={18} color={COLORS.textLight} />
            </TouchableOpacity>

            <Modal visible={open} transparent animationType="slide">
                <View style={wizStyles.dropdownOverlay}>
                    <View style={wizStyles.dropdownModal}>
                        <View style={wizStyles.dropdownHeader}>
                            <Text style={wizStyles.dropdownTitle}>{label}</Text>
                            <TouchableOpacity onPress={handleClose}>
                                <Ionicons name="close" size={24} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>
                        {options.length > 5 && (
                            <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 8, paddingHorizontal: 10 }}>
                                    <Ionicons name="search" size={18} color={COLORS.textLight} />
                                    <TextInput
                                        style={{ flex: 1, height: 40, marginLeft: 8, color: COLORS.text }}
                                        placeholder="Search..."
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        autoCorrect={false}
                                    />
                                    {searchQuery.length > 0 && (
                                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                                            <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        )}
                        <ScrollView style={{ maxHeight: 400 }} keyboardShouldPersistTaps="handled">
                            {filteredOptions.length === 0 ? (
                                <Text style={{ padding: 20, color: COLORS.textLight, textAlign: 'center' }}>No options found</Text>
                            ) : (
                                filteredOptions.map((opt: any) => (
                                    <TouchableOpacity
                                        key={opt.id}
                                        style={[wizStyles.dropdownItem, value?.id === opt.id && wizStyles.dropdownItemActive]}
                                        onPress={() => { onChange(opt); handleClose(); }}
                                    >
                                        <Text style={[wizStyles.dropdownItemText, value?.id === opt.id && { color: COLORS.primary, fontWeight: '600' }]}>
                                            {opt.name}
                                        </Text>
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function MultiSelectTags({ label, options, selectedIds, onChange, readonly }: any) {
    const [open, setOpen] = useState(false);

    const toggleItem = (id: number) => {
        if (readonly) return;
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter((i: number) => i !== id));
        } else {
            onChange([...selectedIds, id]);
        }
    };

    return (
        <View style={wizStyles.fieldContainer}>
            <Text style={wizStyles.label}>{label}</Text>
            <TouchableOpacity disabled={readonly} style={[wizStyles.dropdownButton, readonly && { backgroundColor: COLORS.background }]} onPress={() => setOpen(true)}>
                <Text style={[wizStyles.dropdownText, selectedIds.length === 0 && { color: COLORS.textLight }]}>
                    {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Select parameters...'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={COLORS.textLight} />
            </TouchableOpacity>

            {selectedIds.length > 0 && (
                <View style={wizStyles.tagsContainer}>
                    {selectedIds.map((id: number) => {
                        const opt = options.find((o: any) => o.id === id);
                        if (!opt && readonly) {
                            return (
                                <View key={id} style={wizStyles.tag}>
                                    <Text style={wizStyles.tagText} numberOfLines={1}>ID: {id}</Text>
                                </View>
                            );
                        }
                        return opt ? (
                            <View key={id} style={wizStyles.tag}>
                                <Text style={wizStyles.tagText} numberOfLines={1}>{opt.name}</Text>
                                {!readonly && (
                                    <TouchableOpacity onPress={() => toggleItem(id)}>
                                        <Ionicons name="close-circle" size={16} color={COLORS.primary} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : null;
                    })}
                </View>
            )}

            <Modal visible={open} transparent animationType="slide">
                <View style={wizStyles.dropdownOverlay}>
                    <View style={wizStyles.dropdownModal}>
                        <View style={wizStyles.dropdownHeader}>
                            <Text style={wizStyles.dropdownTitle}>{label}</Text>
                            <TouchableOpacity onPress={() => setOpen(false)}>
                                <Ionicons name="close" size={24} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 400 }}>
                            {options.length === 0 ? (
                                <Text style={{ padding: 20, color: COLORS.textLight, textAlign: 'center' }}>No parameters available. Select a material first.</Text>
                            ) : (
                                options.map((opt: any) => {
                                    const isSelected = selectedIds.includes(opt.id);
                                    return (
                                        <TouchableOpacity
                                            key={opt.id}
                                            style={[wizStyles.dropdownItem, isSelected && wizStyles.dropdownItemActive]}
                                            onPress={() => toggleItem(opt.id)}
                                        >
                                            <Ionicons
                                                name={isSelected ? 'checkbox' : 'square-outline'}
                                                size={20}
                                                color={isSelected ? COLORS.primary : COLORS.textLight}
                                                style={{ marginRight: 10 }}
                                            />
                                            <Text style={[wizStyles.dropdownItemText, isSelected && { color: COLORS.primary }]}>
                                                {opt.name}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </ScrollView>
                        <TouchableOpacity style={wizStyles.doneButton} onPress={() => setOpen(false)}>
                            <Text style={wizStyles.doneButtonText}>Done ({selectedIds.length})</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ─── Main Wizard Component ──────────────────────────────────────────────────
export default function AddEditSampleWizard({ visible, onClose, srfId, editMode, editSampleId, onSampleSaved, isConfirmed }: any) {
    const [submitting, setSubmitting] = useState(false);
    const [loadingOptions, setLoadingOptions] = useState(false);
    const [loadingData, setLoadingData] = useState(false);

    // Dropdown options
    const [disciplines, setDisciplines] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [materials, setMaterials] = useState<any[]>([]);
    const [grades, setGrades] = useState<any[]>([]);
    const [sizes, setSizes] = useState<any[]>([]);
    const [parameters, setParameters] = useState<any[]>([]);
    const [labLocations, setLabLocations] = useState<any[]>([]);

    // Form state
    const [discipline, setDiscipline] = useState<any | null>(null);
    const [group, setGroup] = useState<any | null>(null);
    const [material, setMaterial] = useState<any | null>(null);
    const [grade, setGrade] = useState<any | null>(null);
    const [size, setSize] = useState<any | null>(null);
    const [selectedParamIds, setSelectedParamIds] = useState<number[]>([]);
    const [labLocation, setLabLocation] = useState<any | null>(null);

    const [brand, setBrand] = useState('');
    const [sampleQty, setSampleQty] = useState('1');
    const [sampleCondition, setSampleCondition] = useState('satisfactory');
    const [scope, setScope] = useState('nabl');
    const [casting, setCasting] = useState(false);
    const [daysCasting, setDaysCasting] = useState('3');
    const [dateCasting, setDateCasting] = useState('');
    const [sampleDescription, setSampleDescription] = useState('');
    const [gradeRequired, setGradeRequired] = useState(false);

    const [showCastingDatePicker, setShowCastingDatePicker] = useState(false);

    // Fetch wizard data (cascading options)
    const fetchWizardData = useCallback(async (disciplineId?: number, groupId?: number, materialId?: number) => {
        try {
            setLoadingOptions(true);
            const sessionId = await SecureStore.getItemAsync('session_id');
            const serverUrl = await SecureStore.getItemAsync('server_url');

            const response = await fetch(`${serverUrl}/mobile/sample_wizard_data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `session_id=${sessionId}`
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    params: {
                        srf_id: srfId,
                        discipline_id: disciplineId || false,
                        group_id: groupId || false,
                        material_id: materialId || false,
                    }
                })
            });

            const data = await response.json();
            if (data.result?.success) {
                const d = data.result.data;
                if (d.disciplines) setDisciplines(d.disciplines);
                if (d.groups) setGroups(d.groups);
                else if (!disciplineId) setGroups([]);
                if (d.materials) setMaterials(d.materials);
                else if (!groupId) setMaterials([]);
                if (d.grades) setGrades(d.grades);
                else if (!materialId) setGrades([]);
                if (d.sizes) setSizes(d.sizes);
                else if (!materialId) setSizes([]);
                if (d.parameters) setParameters(d.parameters);
                else if (!materialId) setParameters([]);
                if (d.grade_required !== undefined) setGradeRequired(d.grade_required);
                if (d.lab_locations) setLabLocations(d.lab_locations);
            }
        } catch (err) {
            console.error('fetchWizardData error:', err);
        } finally {
            setLoadingOptions(false);
        }
    }, [srfId]);

    // Fetch existing sample data for edit mode
    const fetchSampleData = useCallback(async () => {
        if (!editSampleId) return;
        try {
            setLoadingData(true);
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
                        id: parseInt(editSampleId)
                    }
                })
            });

            const data = await response.json();
            if (data.result?.success) {
                const s = data.result.data;

                // Load initial options for disciplines and then trigger cascades
                await fetchWizardData(s.discipline_id?.[0], s.group_id?.[0], s.material_id?.[0]);

                if (s.discipline_id) setDiscipline({ id: s.discipline_id[0], name: s.discipline_id[1] });
                if (s.group_id) setGroup({ id: s.group_id[0], name: s.group_id[1] });
                if (s.material_id) setMaterial({ id: s.material_id[0], name: s.material_id[1] });
                if (s.grade_id) setGrade({ id: s.grade_id[0], name: s.grade_id[1] });
                if (s.size_id) setSize({ id: s.size_id[0], name: s.size_id[1] });
                if (s.lab_location) setLabLocation({ id: s.lab_location[0], name: s.lab_location[1] });

                if (s.parameters && Array.isArray(s.parameters)) setSelectedParamIds(s.parameters);
                
                setBrand(s.brand || '');
                setSampleCondition(s.sample_condition || 'satisfactory');
                setScope(s.scope || 'nabl');
                setCasting(s.casting || false);
                setDaysCasting(s.days_casting ? String(s.days_casting) : '3');
                setDateCasting(s.date_casting || '');
                setSampleDescription(s.sample_description || '');
            }
        } catch (err) {
            console.error('fetchSampleData error:', err);
            Alert.alert('Error', 'Failed to load sample data.');
        } finally {
            setLoadingData(false);
        }
    }, [editSampleId, fetchWizardData]);

    useEffect(() => {
        if (visible) {
            if (editMode && editSampleId) {
                fetchSampleData();
            } else {
                fetchWizardData();
                // Reset form
                setDiscipline(null); setGroup(null); setMaterial(null);
                setGrade(null); setSize(null); setSelectedParamIds([]);
                setLabLocation(null); setBrand(''); setSampleQty('1');
                setSampleCondition('satisfactory'); setScope('nabl');
                setCasting(false); setDaysCasting('3'); setDateCasting('');
                setSampleDescription(''); setGradeRequired(false);
                setGroups([]); setMaterials([]); setGrades([]);
                setSizes([]); setParameters([]);
            }
        }
    }, [visible, editMode, editSampleId]);

    const handleDisciplineChange = (val: any) => {
        setDiscipline(val);
        setGroup(null); setMaterial(null); setGrade(null); setSize(null);
        setSelectedParamIds([]);
        setGroups([]); setMaterials([]); setGrades([]); setSizes([]); setParameters([]);
        if (val) fetchWizardData(val.id);
    };

    const handleGroupChange = (val: any) => {
        setGroup(val);
        setMaterial(null); setGrade(null); setSize(null);
        setSelectedParamIds([]);
        setMaterials([]); setGrades([]); setSizes([]); setParameters([]);
        if (val && discipline) fetchWizardData(discipline.id, val.id);
    };

    const handleMaterialChange = (val: any) => {
        setMaterial(val);
        setGrade(null); setSize(null); setSelectedParamIds([]);
        setGrades([]); setSizes([]); setParameters([]);
        if (val?.casting_required) setCasting(true);
        if (val && discipline && group) fetchWizardData(discipline.id, group.id, val.id);
    };

    const handleSubmit = async () => {
        if (!discipline) return Alert.alert('Validation', 'Discipline is required.');
        if (!material) return Alert.alert('Validation', 'Material is required.');
        if (selectedParamIds.length === 0) return Alert.alert('Validation', 'At least one Parameter is required.');
        if (gradeRequired && !grade) return Alert.alert('Validation', 'Grade is required for this material.');
        const qty = parseInt(sampleQty) || 0;
        if (!editMode && qty <= 0) return Alert.alert('Validation', 'Sample Quantity must be greater than zero.');

        try {
            setSubmitting(true);
            const sessionId = await SecureStore.getItemAsync('session_id');
            const serverUrl = await SecureStore.getItemAsync('server_url');

            const endpoint = editMode ? '/mobile/update_sample' : '/mobile/add_sample';
            const params: any = {
                srf_id: srfId,
                discipline_id: discipline.id,
                group_id: group?.id || false,
                material_id: material.id,
                parameter_ids: selectedParamIds,
                grade_id: grade?.id || false,
                size_id: size?.id || false,
                brand,
                sample_condition: sampleCondition,
                scope,
                casting,
                days_casting: daysCasting,
                date_casting: dateCasting || false,
                sample_description: sampleDescription,
                lab_location_id: labLocation?.id || false,
            };

            if (editMode) {
                params.sample_id = editSampleId;
            } else {
                params.sample_qty = qty;
            }

            const response = await fetch(`${serverUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `session_id=${sessionId}`
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    params
                })
            });

            const data = await response.json();
            if (data.result?.success) {
                Alert.alert('Success', data.result.message || `Sample ${editMode ? 'updated' : 'added'}.`);
                onSampleSaved();
                onClose();
            } else {
                Alert.alert('Error', data.result?.error || `Failed to ${editMode ? 'update' : 'add'} sample.`);
            }
        } catch (err) {
            console.error('Submit sample error:', err);
            Alert.alert('Error', `An error occurred while ${editMode ? 'updating' : 'adding'} the sample.`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={wizStyles.container}>
                <View style={wizStyles.header}>
                    <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                        <Ionicons name="close" size={26} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={wizStyles.headerTitle}>{editMode ? 'Edit Sample' : 'Add Sample'}</Text>
                    {!isConfirmed && (
                        <TouchableOpacity
                            style={[wizStyles.submitBtn, submitting && { opacity: 0.6 }]}
                            onPress={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={wizStyles.submitBtnText}>Save</Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                {(loadingOptions || loadingData) && (
                    <View style={{ padding: 8, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={COLORS.primary} />
                    </View>
                )}

                <ScrollView contentContainerStyle={wizStyles.formBody} keyboardShouldPersistTaps="handled">
                    <Text style={wizStyles.sectionTitle}>Material Details</Text>
                    <View style={wizStyles.card}>
                        <WizardDropdown label="Discipline *" options={disciplines} value={discipline} onChange={handleDisciplineChange} placeholder="Select discipline" readonly={isConfirmed} />
                        <WizardDropdown label="Group" options={groups} value={group} onChange={handleGroupChange} placeholder="Select group" readonly={isConfirmed} />
                        <WizardDropdown label="Material *" options={materials} value={material} onChange={handleMaterialChange} placeholder="Select material" readonly={isConfirmed} />
                        <View style={wizStyles.fieldContainer}>
                            <Text style={wizStyles.label}>Brand</Text>
                            <TextInput style={wizStyles.input} value={brand} onChangeText={setBrand} placeholder="Enter brand" editable={!isConfirmed} />
                        </View>
                        <WizardDropdown label={gradeRequired ? 'Grade *' : 'Grade'} options={grades} value={grade} onChange={setGrade} placeholder="Select grade" readonly={isConfirmed} />
                        <WizardDropdown label="Size" options={sizes} value={size} onChange={setSize} placeholder="Select size" readonly={isConfirmed} />
                    </View>

                    <Text style={wizStyles.sectionTitle}>Parameters *</Text>
                    <View style={wizStyles.card}>
                        <MultiSelectTags label="Parameters" options={parameters} selectedIds={selectedParamIds} onChange={setSelectedParamIds} readonly={isConfirmed} />
                    </View>

                    <Text style={wizStyles.sectionTitle}>Sample Info</Text>
                    <View style={wizStyles.card}>
                        {!editMode && (
                            <View style={wizStyles.fieldContainer}>
                                <Text style={wizStyles.label}>Sample Quantity</Text>
                                <TextInput
                                    style={wizStyles.input}
                                    value={sampleQty}
                                    onChangeText={setSampleQty}
                                    keyboardType="numeric"
                                    placeholder="1"
                                    editable={!isConfirmed}
                                />
                            </View>
                        )}

                        <SelectionField label="Sample Condition" options={SAMPLE_CONDITION_OPTIONS} value={sampleCondition} onChange={setSampleCondition} readonly={isConfirmed} />
                        <SelectionField label="Scope" options={SCOPE_OPTIONS} value={scope} onChange={setScope} readonly={isConfirmed} />
                        <WizardDropdown label="Lab Location" options={labLocations} value={labLocation} onChange={setLabLocation} placeholder="Select lab" readonly={isConfirmed} />

                        <View style={wizStyles.fieldContainer}>
                            <Text style={wizStyles.label}>Sample Description</Text>
                            <TextInput
                                style={[wizStyles.input, { height: 80, textAlignVertical: 'top' }]}
                                value={sampleDescription}
                                onChangeText={setSampleDescription}
                                multiline
                                placeholder="Enter description..."
                                editable={!isConfirmed}
                            />
                        </View>
                    </View>

                    <Text style={wizStyles.sectionTitle}>Casting</Text>
                    <View style={wizStyles.card}>
                        <View style={[wizStyles.fieldContainer, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                            <Text style={wizStyles.label}>Casting</Text>
                            <Switch value={casting} onValueChange={setCasting} trackColor={{ true: COLORS.primary }} disabled={isConfirmed} />
                        </View>

                        {casting && (
                            <>
                                <SelectionField label="Days of Testing" options={DAYS_CASTING_OPTIONS} value={daysCasting} onChange={setDaysCasting} readonly={isConfirmed} />
                                <View style={wizStyles.fieldContainer}>
                                    <Text style={wizStyles.label}>Date of Casting</Text>
                                    <TouchableOpacity disabled={isConfirmed} onPress={() => setShowCastingDatePicker(true)}>
                                        <View pointerEvents="none">
                                            <TextInput
                                                style={wizStyles.input}
                                                value={dateCasting}
                                                editable={false}
                                                placeholder="YYYY-MM-DD"
                                            />
                                        </View>
                                    </TouchableOpacity>
                                    {showCastingDatePicker && (
                                        <DateTimePicker
                                            value={dateCasting ? new Date(dateCasting) : new Date()}
                                            mode="date"
                                            display="default"
                                            onChange={(event, selectedDate) => {
                                                setShowCastingDatePicker(Platform.OS === 'ios');
                                                if (selectedDate && event.type !== 'dismissed') {
                                                    const yyyy = selectedDate.getFullYear();
                                                    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                                    const dd = String(selectedDate.getDate()).padStart(2, '0');
                                                    setDateCasting(`${yyyy}-${mm}-${dd}`);
                                                }
                                            }}
                                        />
                                    )}
                                </View>
                            </>
                        )}
                    </View>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </View>
        </Modal>
    );
}

const wizStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, paddingTop: Platform.OS === 'ios' ? 56 : 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginLeft: 12 },
    submitBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
    submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    formBody: { padding: 16 },
    sectionTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    card: { backgroundColor: COLORS.white, borderRadius: 10, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
    fieldContainer: { marginBottom: 14 },
    label: { fontSize: 13, color: COLORS.textLight, marginBottom: 5, fontWeight: '500' },
    input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, height: 44, fontSize: 15, color: COLORS.text, backgroundColor: '#fff' },
    dropdownButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, height: 44, backgroundColor: '#fff' },
    dropdownText: { fontSize: 15, color: COLORS.text, flex: 1 },
    dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    dropdownModal: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '60%' },
    dropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    dropdownTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text },
    dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
    dropdownItemActive: { backgroundColor: COLORS.primary + '10' },
    dropdownItemText: { fontSize: 15, color: COLORS.text },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff' },
    chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { fontSize: 13, color: COLORS.text },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 },
    tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary + '15', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, gap: 4 },
    tagText: { fontSize: 12, color: COLORS.primary, fontWeight: '500', maxWidth: 150 },
    doneButton: { backgroundColor: COLORS.primary, margin: 16, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
    doneButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
