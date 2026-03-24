import { Dimensions, StyleSheet } from "react-native";
import { COLORS } from "../../constants/colors";

const { width } = Dimensions.get("window");
const CARD_MARGIN = 8;
const NUM_COLUMNS = 3;
const CARD_WIDTH = (width - 40 - CARD_MARGIN * (NUM_COLUMNS - 1) * 2) / NUM_COLUMNS;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  /* ── Loading / Error screens ── */
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    padding: 30,
  },
  illustration: {
    width: 180,
    height: 180,
    resizeMode: "contain",
    marginBottom: 10,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: COLORS.textLight,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 16,
  },
  errorSubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 280,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "600",
  },
  signOutLink: {
    marginTop: 16,
    padding: 8,
  },
  signOutLinkText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "500",
  },

  /* ── Dashboard Header ── */
  dashboardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  headerLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: 12,
  },
  welcomeContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 1,
  },
  usernameText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },

  /* ── Section Header ── */
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  appCount: {
    fontSize: 13,
    color: COLORS.textLight,
    fontWeight: "500",
    backgroundColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
  },

  /* ── Apps Grid ── */
  gridContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  gridRow: {
    justifyContent: "flex-start",
    gap: CARD_MARGIN * 2,
    marginBottom: CARD_MARGIN * 2,
  },
  appCard: {
    width: CARD_WIDTH,
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
  appIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  appName: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "center",
    lineHeight: 16,
  },
  appCategory: {
    fontSize: 10,
    color: COLORS.textLight,
    textAlign: "center",
    marginTop: 3,
  },

  /* ── Empty State ── */
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 12,
  },
  emptyStateText: {
    color: COLORS.textLight,
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 260,
    lineHeight: 20,
  },

  /* ── Legacy (kept for compatibility) ── */
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "600",
  },
});