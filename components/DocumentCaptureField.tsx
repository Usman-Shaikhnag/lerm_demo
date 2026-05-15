import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';

const MAX_FILE_SIZE = 500 * 1024; // 500KB

interface DocumentCaptureFieldProps {
    /** Display label for the field */
    label: string;
    /** Odoo model name, e.g. 'lerm.srf.sample' */
    model: string;
    /** Active record ID */
    recordId: number;
    /** Field name on the model that stores the SFTP path, e.g. 'report_path' */
    fieldName: string;
    /** Current stored path value (to show existing upload status) */
    currentPath: string | null;
    /** Whether the field is readonly */
    readonly?: boolean;
    /** Callback after successful upload — receives the new path */
    onUploadSuccess?: (path: string) => void;
    /** Allow multiple image selection (will combine into PDF) */
    allowMultiple?: boolean;
}

interface CapturedImage {
    uri: string;
    base64?: string;
    width: number;
    height: number;
    fileSize?: number;
}

/**
 * Compress an image to be at most MAX_FILE_SIZE bytes.
 * Strategy: reduce JPEG quality in steps, then resize if still too large.
 */
async function compressImage(uri: string): Promise<{ uri: string; base64: string }> {
    let quality = 0.8;
    let currentUri = uri;
    let attempts = 0;

    while (attempts < 6) {
        const manipulated = await ImageManipulator.manipulateAsync(
            currentUri,
            attempts >= 3 ? [{ resize: { width: 1200 } }] : [], // resize after 3 quality attempts
            { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        const fileInfo = await FileSystem.getInfoAsync(manipulated.uri);
        const fileSize = (fileInfo as any).size || 0;

        if (fileSize <= MAX_FILE_SIZE || quality <= 0.1) {
            return { uri: manipulated.uri, base64: manipulated.base64! };
        }

        quality -= 0.15;
        if (quality < 0.1) quality = 0.1;
        currentUri = manipulated.uri;
        attempts++;
    }

    // Final fallback — heavy resize + minimum quality
    const final = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { compress: 0.1, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    return { uri: final.uri, base64: final.base64! };
}

/**
 * Combine multiple image base64 strings into a single PDF and return its base64.
 */
async function combineImagesToPdf(images: { base64: string }[]): Promise<{ base64: string; uri: string }> {
    const imgTags = images
        .map(
            (img) =>
                `<div style="page-break-after: always; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; padding: 0;">
                    <img src="data:image/jpeg;base64,${img.base64}" style="max-width: 100%; max-height: 100vh; object-fit: contain;" />
                </div>`
        )
        .join('\n');

    const html = `
        <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { margin: 0; padding: 0; }
                </style>
            </head>
            <body>${imgTags}</body>
        </html>
    `;

    const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792 });

    // Read the PDF as base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
    });

    return { base64, uri };
}

export default function DocumentCaptureField({
    label,
    model,
    recordId,
    fieldName,
    currentPath,
    readonly = false,
    onUploadSuccess,
    allowMultiple = true,
}: DocumentCaptureFieldProps) {
    const [images, setImages] = useState<CapturedImage[]>([]);
    const [uploading, setUploading] = useState(false);
    const [compressing, setCompressing] = useState(false);
    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewUri, setPreviewUri] = useState<string | null>(null);

    const pickFromCamera = async () => {
        if (readonly) return;
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Camera permission is needed to capture documents.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.9,
            base64: false,
        });

        if (!result.canceled && result.assets.length > 0) {
            const newImages = result.assets.map((a) => ({
                uri: a.uri,
                width: a.width,
                height: a.height,
                fileSize: a.fileSize,
            }));
            setImages((prev) => (allowMultiple ? [...prev, ...newImages] : newImages));
        }
    };

    const pickFromGallery = async () => {
        if (readonly) return;
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Gallery permission is needed to select documents.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.9,
            allowsMultipleSelection: allowMultiple,
            base64: false,
        });

        if (!result.canceled && result.assets.length > 0) {
            const newImages = result.assets.map((a) => ({
                uri: a.uri,
                width: a.width,
                height: a.height,
                fileSize: a.fileSize,
            }));
            setImages((prev) => (allowMultiple ? [...prev, ...newImages] : newImages));
        }
    };

    const removeImage = (index: number) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        if (images.length === 0) {
            Alert.alert('No Images', 'Please capture or select at least one image first.');
            return;
        }

        try {
            setCompressing(true);

            // Step 1: Compress all images
            const compressed: { uri: string; base64: string }[] = [];
            for (const img of images) {
                const result = await compressImage(img.uri);
                compressed.push(result);
            }

            let fileBase64: string;
            let fileName: string;

            if (compressed.length === 1) {
                // Single image — upload as JPEG
                fileBase64 = compressed[0].base64;
                fileName = `${fieldName}_${Date.now()}.jpg`;
            } else {
                // Multiple images — combine into PDF
                const pdf = await combineImagesToPdf(compressed);
                fileBase64 = pdf.base64;
                fileName = `${fieldName}_${Date.now()}.pdf`;
            }

            setCompressing(false);
            setUploading(true);

            // Step 2: Upload to Odoo controller
            const sessionId = await SecureStore.getItemAsync('session_id');
            const serverUrl = await SecureStore.getItemAsync('server_url');

            const response = await fetch(`${serverUrl}/mobile/ftp_upload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: `session_id=${sessionId}`,
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    params: {
                        model,
                        id: recordId,
                        field_name: fieldName,
                        file_data: fileBase64,
                        file_name: fileName,
                    },
                }),
            });

            const data = await response.json();

            if (data.result?.success) {
                Alert.alert('Upload Successful', `Document uploaded successfully.`);
                setImages([]);
                if (onUploadSuccess) {
                    onUploadSuccess(data.result.path);
                }
            } else {
                Alert.alert('Upload Failed', data.result?.error || 'An unknown error occurred.');
            }
        } catch (err: any) {
            console.error('Upload error:', err);
            Alert.alert('Error', err.message || 'An error occurred during upload.');
        } finally {
            setUploading(false);
            setCompressing(false);
        }
    };

    const handleDownload = async () => {
        if (!currentPath) return;
        try {
            setUploading(true);
            const sessionId = await SecureStore.getItemAsync('session_id');
            const serverUrl = await SecureStore.getItemAsync('server_url');

            const response = await fetch(`${serverUrl}/mobile/ftp_download`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: `session_id=${sessionId}`,
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    params: {
                        model,
                        id: recordId,
                        field_name: fieldName,
                    },
                }),
            });

            const data = await response.json();
            if (data.result?.success && data.result?.file_base64) {
                const isImage = !currentPath.endsWith('.pdf');
                const ext = isImage ? 'jpg' : 'pdf';
                const localUri = `${FileSystem.cacheDirectory}${fieldName}_download.${ext}`;
                await FileSystem.writeAsStringAsync(localUri, data.result.file_base64, {
                    encoding: FileSystem.EncodingType.Base64,
                });

                if (isImage) {
                    setPreviewUri(localUri);
                    setPreviewVisible(true);
                } else {
                    // For PDFs, share/open with external app
                    const Sharing = require('expo-sharing');
                    if (await Sharing.isAvailableAsync()) {
                        await Sharing.shareAsync(localUri, {
                            mimeType: 'application/pdf',
                            UTI: 'com.adobe.pdf',
                        });
                    } else {
                        Alert.alert('Downloaded', `File saved to: ${localUri}`);
                    }
                }
            } else {
                Alert.alert('Download Failed', data.result?.error || 'Could not download the file.');
            }
        } catch (err: any) {
            console.error('Download error:', err);
            Alert.alert('Error', err.message || 'An error occurred during download.');
        } finally {
            setUploading(false);
        }
    };

    const isProcessing = uploading || compressing;
    const statusLabel = compressing ? 'Compressing...' : uploading ? 'Uploading...' : '';

    return (
        <View style={styles.container}>
            {/* Label */}
            <Text style={styles.label}>{label}</Text>

            {/* Current path indicator */}
            {currentPath ? (
                <TouchableOpacity style={styles.existingPath} onPress={handleDownload} disabled={isProcessing}>
                    <Ionicons name="cloud-done-outline" size={18} color="#2E7D32" />
                    <Text style={styles.existingPathText} numberOfLines={1}>
                        {currentPath.split('/').pop()}
                    </Text>
                    <Ionicons name="download-outline" size={18} color={COLORS.primary} />
                </TouchableOpacity>
            ) : (
                <View style={styles.noUpload}>
                    <Ionicons name="cloud-upload-outline" size={16} color={COLORS.textLight} />
                    <Text style={styles.noUploadText}>No file uploaded yet</Text>
                </View>
            )}

            {/* Capture buttons */}
            {!readonly && (
                <View style={styles.buttonRow}>
                    <TouchableOpacity
                        style={[styles.captureBtn, styles.cameraBtn]}
                        onPress={pickFromCamera}
                        disabled={isProcessing}
                    >
                        <Ionicons name="camera-outline" size={20} color="#fff" />
                        <Text style={styles.captureBtnText}>Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.captureBtn, styles.galleryBtn]}
                        onPress={pickFromGallery}
                        disabled={isProcessing}
                    >
                        <Ionicons name="images-outline" size={20} color="#fff" />
                        <Text style={styles.captureBtnText}>Gallery</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Thumbnail preview strip */}
            {images.length > 0 && (
                <View style={styles.previewSection}>
                    <Text style={styles.previewCount}>
                        {images.length} image{images.length > 1 ? 's' : ''} selected
                        {images.length > 1 ? ' — will combine as PDF' : ''}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailStrip}>
                        {images.map((img, idx) => (
                            <View key={idx} style={styles.thumbnailWrapper}>
                                <TouchableOpacity
                                    onPress={() => {
                                        setPreviewUri(img.uri);
                                        setPreviewVisible(true);
                                    }}
                                >
                                    <Image source={{ uri: img.uri }} style={styles.thumbnail} />
                                </TouchableOpacity>
                                {!readonly && (
                                    <TouchableOpacity
                                        style={styles.removeBtn}
                                        onPress={() => removeImage(idx)}
                                        disabled={isProcessing}
                                    >
                                        <Ionicons name="close-circle" size={20} color="#E53935" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))}
                    </ScrollView>

                    {/* Upload button */}
                    {!readonly && (
                        <TouchableOpacity
                            style={[styles.uploadBtn, isProcessing && styles.uploadBtnDisabled]}
                            onPress={handleUpload}
                            disabled={isProcessing}
                        >
                            {isProcessing ? (
                                <View style={styles.uploadBtnContent}>
                                    <ActivityIndicator size="small" color="#fff" />
                                    <Text style={styles.uploadBtnText}>{statusLabel}</Text>
                                </View>
                            ) : (
                                <View style={styles.uploadBtnContent}>
                                    <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                                    <Text style={styles.uploadBtnText}>
                                        Upload {images.length > 1 ? 'as PDF' : 'to Server'}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Full-size image preview modal */}
            <Modal visible={previewVisible} transparent animationType="fade">
                <View style={styles.previewOverlay}>
                    <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewVisible(false)}>
                        <Ionicons name="close-circle" size={36} color="#fff" />
                    </TouchableOpacity>
                    {previewUri && (
                        <Image
                            source={{ uri: previewUri }}
                            style={styles.previewImage}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        color: COLORS.textLight,
        marginBottom: 8,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    existingPath: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        borderWidth: 1,
        borderColor: '#A5D6A7',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
        marginBottom: 8,
    },
    existingPathText: {
        flex: 1,
        fontSize: 13,
        color: '#2E7D32',
        fontWeight: '500',
    },
    noUpload: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
        marginBottom: 8,
        borderStyle: 'dashed',
    },
    noUploadText: {
        fontSize: 13,
        color: COLORS.textLight,
        fontStyle: 'italic',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 8,
    },
    captureBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    cameraBtn: {
        backgroundColor: COLORS.primary,
    },
    galleryBtn: {
        backgroundColor: '#546E7A',
    },
    captureBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    previewSection: {
        backgroundColor: COLORS.white,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 10,
    },
    previewCount: {
        fontSize: 12,
        color: COLORS.textLight,
        marginBottom: 8,
        fontWeight: '500',
    },
    thumbnailStrip: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    thumbnailWrapper: {
        marginRight: 10,
        position: 'relative',
    },
    thumbnail: {
        width: 72,
        height: 72,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    removeBtn: {
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: '#fff',
        borderRadius: 10,
    },
    uploadBtn: {
        backgroundColor: '#2E7D32',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    uploadBtnDisabled: {
        opacity: 0.6,
    },
    uploadBtnContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    uploadBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
    previewOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewClose: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 10,
    },
    previewImage: {
        width: '90%',
        height: '80%',
    },
});
