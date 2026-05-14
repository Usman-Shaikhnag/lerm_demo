import React, { useState, useEffect, useCallback } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import * as SecureStore from 'expo-secure-store';

interface Option {
    id: number | string;
    name: string;
}

interface Many2oneSelectProps {
    label: string;
    value: Option | null;
    model: string;
    domain?: any[];
    onChange: (value: Option | null) => void;
    readonly?: boolean;
}

export default function Many2oneSelect({ label, value, model, domain = [], onChange, readonly = false }: Many2oneSelectProps) {
    const [modalVisible, setModalVisible] = useState(false);
    const [search, setSearch] = useState('');
    const [options, setOptions] = useState<Option[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchOptions = useCallback(async (query: string = '') => {
        try {
            setLoading(true);
            const sessionId = await SecureStore.getItemAsync('session_id');
            const serverUrl = await SecureStore.getItemAsync('server_url');
            if (!sessionId || !serverUrl) return;

            const response = await fetch(`${serverUrl}/mobile/name_search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `session_id=${sessionId}`,
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    params: {
                        model,
                        query,
                        domain,
                        limit: 30
                    }
                }),
            });
            const data = await response.json();
            if (data.result?.success) {
                setOptions(data.result.records || []);
            }
        } catch (err) {
            console.error('Error fetching options for', model, err);
        } finally {
            setLoading(false);
        }
    }, [model, domain]);

    // Fetch initial empty query if opened
    useEffect(() => {
        if (modalVisible) {
            fetchOptions('');
        }
    }, [modalVisible, fetchOptions]);

    useEffect(() => {
        if (!modalVisible) return;
        const delaySearch = setTimeout(() => {
            fetchOptions(search);
        }, 500);
        return () => clearTimeout(delaySearch);
    }, [search, modalVisible, fetchOptions]);

    return (
        <View style={styles.container}>
            <Text style={styles.label}>{label}</Text>
            <TouchableOpacity
                style={[styles.inputBox, readonly && styles.inputBoxReadonly]}
                activeOpacity={readonly ? 1 : 0.7}
                onPress={() => !readonly && setModalVisible(true)}
            >
                <Text style={value ? styles.inputText : styles.placeholderText} numberOfLines={1}>
                    {value ? value.name : 'Select...'}
                </Text>
                {!readonly && <Ionicons name="chevron-down" size={18} color={COLORS.textLight} />}
            </TouchableOpacity>

            <Modal
                visible={modalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color={COLORS.text} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Search {label}</Text>
                    </View>
                    <View style={styles.searchBlock}>
                        <Ionicons name="search" size={18} color={COLORS.textLight} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Type to search..."
                            value={search}
                            onChangeText={setSearch}
                            autoFocus
                        />
                        {loading && <ActivityIndicator size="small" color={COLORS.primary} />}
                    </View>

                    <FlatList
                        data={options}
                        keyExtractor={item => String(item.id)}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.optionItem}
                                onPress={() => {
                                    onChange(item);
                                    setModalVisible(false);
                                }}
                            >
                                <Text style={styles.optionText}>{item.name}</Text>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                            !loading ? (
                                <Text style={styles.emptyText}>No results found.</Text>
                            ) : null
                        }
                    />
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        color: COLORS.textLight,
        marginBottom: 6,
        fontWeight: '500',
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        height: 44,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        backgroundColor: COLORS.white,
    },
    inputBoxReadonly: {
        backgroundColor: COLORS.background,
    },
    inputText: {
        flex: 1,
        fontSize: 15,
        color: COLORS.text,
    },
    placeholderText: {
        flex: 1,
        fontSize: 15,
        color: '#A0AAB5',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
        paddingTop: Platform.OS === 'ios' ? 40 : 0,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        backgroundColor: COLORS.white,
    },
    closeBtn: {
        padding: 4,
        marginRight: 8,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text,
    },
    searchBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        margin: 16,
        paddingHorizontal: 12,
        height: 40,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 15,
        color: COLORS.text,
    },
    optionItem: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        backgroundColor: COLORS.white,
    },
    optionText: {
        fontSize: 16,
        color: COLORS.text,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        fontSize: 15,
        color: COLORS.textLight,
    }
});
