import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';

interface DocumentPickerFieldProps {
    label: string;
    fileName: string | null;
    readonly: boolean;
    onSelect: (base64: string | null, name: string | null) => void;
}

export default function DocumentPickerField({ label, fileName, readonly, onSelect }: DocumentPickerFieldProps) {
    const [loading, setLoading] = useState(false);

    const handlePickDocument = async () => {
        if (readonly) return;
        try {
            setLoading(true);
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*', // Allow all files
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const file = result.assets[0];
                const base64 = await FileSystem.readAsStringAsync(file.uri, {
                    encoding: FileSystem.EncodingType.Base64,
                });
                onSelect(base64, file.name);
            }
        } catch (error) {
            console.error('Error picking document:', error);
            Alert.alert('Error', 'Failed to pick document.');
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        if (readonly) return;
        onSelect(null, null);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.inputWrapper}>
                <TouchableOpacity
                    style={[styles.input, readonly && styles.readonlyInput]}
                    onPress={handlePickDocument}
                    disabled={readonly || loading}
                >
                    <Ionicons name="document-attach-outline" size={20} color={readonly ? COLORS.textLight : COLORS.primary} style={styles.icon} />
                    <Text style={[styles.text, !fileName && styles.placeholderText, readonly && styles.readonlyText]} numberOfLines={1}>
                        {loading ? 'Processing...' : (fileName || 'Select a file to attach...')}
                    </Text>
                </TouchableOpacity>
                {fileName && !readonly && (
                    <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
                        <Ionicons name="close-circle" size={20} color={COLORS.textLight} />
                    </TouchableOpacity>
                )}
            </View>
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
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 44,
        backgroundColor: '#fff',
    },
    readonlyInput: {
        backgroundColor: COLORS.background,
    },
    icon: {
        marginRight: 8,
    },
    text: {
        flex: 1,
        fontSize: 15,
        color: COLORS.text,
    },
    placeholderText: {
        color: COLORS.textLight,
        fontStyle: 'italic',
    },
    readonlyText: {
        color: COLORS.textLight,
    },
    clearBtn: {
        marginLeft: 8,
        padding: 4,
    },
});
