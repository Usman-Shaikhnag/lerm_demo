import { StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },

    /* ── Header ── */
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        marginHorizontal: 8,
    },
    saveButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    saveButtonDisabled: {
        backgroundColor: COLORS.primary + '80',
    },
    saveButtonText: {
        color: COLORS.white,
        fontWeight: '600',
        fontSize: 14,
    },

    /* ── Status Bar (Header Buttons) ── */
    statusBar: {
        backgroundColor: COLORS.white,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    statusBarButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    actionButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.white,
    },
    actionButtonPrimary: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    actionButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.text,
    },
    actionButtonTextPrimary: {
        color: COLORS.white,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: COLORS.primary + '18',
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.primary,
        textTransform: 'uppercase',
    },

    /* ── Form Body ── */
    scrollContainer: {
        padding: 16,
        paddingBottom: 40,
    },

    /* ── Section (Group) ── */
    section: {
        backgroundColor: COLORS.white,
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
        borderWidth: 1,
        borderColor: COLORS.border + '40',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.primary,
        marginBottom: 14,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    /* ── Notebook / Tabs ── */
    notebook: {
        marginBottom: 16,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 4,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border + '40',
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
    },
    tabActive: {
        backgroundColor: COLORS.primary,
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textLight,
    },
    tabTextActive: {
        color: COLORS.white,
    },
    tabContent: {
        backgroundColor: COLORS.white,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border + '40',
    },

    /* ── Separator ── */
    separator: {
        marginVertical: 16,
    },
    separatorLine: {
        height: 1,
        backgroundColor: COLORS.border,
    },
    separatorText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textLight,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    /* ── Form Fields ── */
    formGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textLight,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    labelRequired: {
        color: COLORS.primary,
    },

    /* ── Inputs ── */
    input: {
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 11,
        fontSize: 15,
        color: COLORS.text,
    },
    inputReadonly: {
        backgroundColor: COLORS.border + '30',
        borderColor: COLORS.border + '50',
        color: COLORS.textLight,
    },
    inputError: {
        borderColor: '#E74C3C',
    },
    errorText: {
        color: '#E74C3C',
        fontSize: 12,
        marginTop: 4,
    },

    /* ── Boolean / Switch ── */
    switchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },

    /* ── Pickers (Selection / Many2one proxy) ── */
    pickerContainer: {
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 10,
        overflow: 'hidden',
    },
    picker: {
        height: 50,
        width: '100%',
    },

    /* ── Inline Button (inside form body) ── */
    inlineButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: COLORS.primary + '10',
        borderWidth: 1,
        borderColor: COLORS.primary + '30',
        marginBottom: 12,
        alignItems: 'center',
    },
    inlineButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.primary,
    },

    /* ── Shared States ── */
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        padding: 30,
    },
    loadingText: {
        marginTop: 14,
        fontSize: 14,
        color: COLORS.textLight,
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text,
        marginTop: 12,
    },
    retryBtn: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 20,
        marginTop: 16,
    },
    retryBtnText: {
        color: COLORS.white,
        fontWeight: '600',
        fontSize: 14,
    },
});
