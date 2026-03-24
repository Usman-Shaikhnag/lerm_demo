import { Dimensions, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

const { width } = Dimensions.get('window');
const KANBAN_GAP = 12;
const KANBAN_CARD_WIDTH = (width - 40 - KANBAN_GAP) / 2;

const CARD_MARGIN = 8;
const NUM_COLUMNS = 3;
const BOX_CARD_WIDTH = (width - 40 - CARD_MARGIN * (NUM_COLUMNS - 1) * 2) / NUM_COLUMNS;

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },

    /* ── Shared ── */
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

    /* ── View Toggle ── */
    viewToggle: {
        flexDirection: 'row',
        backgroundColor: COLORS.background,
        borderRadius: 10,
        padding: 3,
    },
    toggleBtn: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    toggleBtnActive: {
        backgroundColor: COLORS.primary,
    },

    /* ── Search ── */
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        marginHorizontal: 16,
        marginTop: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: COLORS.text,
        padding: 0,
    },

    /* ── Filter Bar ── */
    filterBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginTop: 10,
        backgroundColor: COLORS.card,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingVertical: 10,
    },
    filterButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        gap: 6,
    },
    filterButtonText: {
        fontSize: 13,
        color: COLORS.text,
        fontWeight: '500',
        flexShrink: 1,
    },
    filterDivider: {
        width: 1,
        height: '80%',
        backgroundColor: COLORS.border,
    },

    /* ── Bottom Sheet Modal ── */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.card,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 16,
        paddingBottom: 24,
        paddingHorizontal: 16,
        maxHeight: Dimensions.get('window').height * 0.7,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
    },
    modalOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border + '50',
    },
    modalOptionActive: {
        borderBottomWidth: 0,
        backgroundColor: COLORS.primary + '10',
        borderRadius: 8,
        paddingHorizontal: 8,
        marginHorizontal: -8,
    },
    modalOptionText: {
        fontSize: 15,
        color: COLORS.text,
    },
    modalOptionTextActive: {
        color: COLORS.primary,
        fontWeight: '600',
    },

    /* ── Count Row ── */
    countRow: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 6,
    },
    countText: {
        fontSize: 13,
        color: COLORS.textLight,
        fontWeight: '500',
    },

    /* ── Menu Items (App Detail) ── */
    menuList: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 30,
    },
    /* ── Box Grid (App Detail) ── */
    gridContainer: {
        paddingHorizontal: 20,
        paddingBottom: 30,
    },
    gridRow: {
        justifyContent: "flex-start",
        gap: CARD_MARGIN * 2,
        marginBottom: CARD_MARGIN * 2,
    },
    menuCard: {
        width: BOX_CARD_WIDTH,
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 12,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
    menuCardIconContainer: {
        width: 52,
        height: 52,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 10,
    },
    menuCardName: {
        fontSize: 12,
        fontWeight: "600",
        color: COLORS.text,
        textAlign: "center",
        lineHeight: 16,
    },
    menuCardModel: {
        fontSize: 10,
        color: COLORS.textLight,
        textAlign: "center",
        marginTop: 3,
    },
    sectionHeaderRow: {
        paddingTop: 16,
        paddingBottom: 8,
        paddingHorizontal: 4,
        backgroundColor: COLORS.background, // stickiness works better with bg color
    },
    sectionHeaderText: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textLight,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.card,
        padding: 14,
        borderRadius: 12,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    menuIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: COLORS.primary + '12',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    menuTextContainer: {
        flex: 1,
    },
    menuName: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.text,
    },
    menuModel: {
        fontSize: 12,
        color: COLORS.textLight,
        marginTop: 2,
    },

    /* ── List View ── */
    listContainer: {
        paddingHorizontal: 16,
        paddingBottom: 30,
    },
    listRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.card,
        padding: 14,
        borderRadius: 12,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    listRowMain: {
        flex: 1,
    },
    listRowTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 6,
    },
    listRowFields: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    listFieldChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    listFieldLabel: {
        fontSize: 11,
        color: COLORS.textLight,
        marginRight: 4,
    },
    listFieldValue: {
        fontSize: 11,
        color: COLORS.text,
        fontWeight: '500',
        maxWidth: 100,
    },

    /* ── Kanban View ── */
    kanbanRow: {
        justifyContent: 'space-between',
        paddingHorizontal: 0,
        marginBottom: KANBAN_GAP,
    },
    kanbanGroupWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: KANBAN_GAP,
        paddingTop: 6,
    },
    kanbanGroupCardWrapper: {
        width: KANBAN_CARD_WIDTH,
        marginBottom: KANBAN_GAP,
    },
    kanbanCard: {
        width: KANBAN_CARD_WIDTH,
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: COLORS.border + '80', // semi-transparent border
    },
    kanbanHeader: {
        marginBottom: 12,
    },
    kanbanTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.text,
        lineHeight: 20,
    },
    kanbanBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 8,
    },
    kanbanBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    kanbanBody: {
        gap: 6,
    },
    kanbanFieldText: {
        fontSize: 12,
        color: COLORS.textLight,
        lineHeight: 16,
    },

    /* ── Empty / Footer ── */
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 15,
        color: COLORS.textLight,
        marginTop: 10,
    },
    footerLoader: {
        paddingVertical: 16,
        alignItems: 'center',
    },

    /* ── FAB ── */
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 6,
    },
});
