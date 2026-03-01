/**
 * Shared UI primitives that mirror the web app's glass-card, badge, and header styles.
 */
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, radius, shadow, spacing } from '../theme';

/* ─── Glass Card ──────────────────────────────────────── */
export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/* ─── Section header ──────────────────────────────────── */
export function SectionHeader({ title, icon, onAction, actionLabel }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        {icon && <Ionicons name={icon} size={18} color={colors.accentBlue} />}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {onAction && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.sectionAction}>{actionLabel || 'See all'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ─── Status Badge ────────────────────────────────────── */
const badgeColors = {
  active: { bg: 'rgba(56,189,248,0.12)', text: colors.cyan },
  planning: { bg: 'rgba(96,165,250,0.12)', text: colors.blue },
  completed: { bg: 'rgba(52,211,153,0.12)', text: colors.emerald },
  'on-hold': { bg: 'rgba(248,113,113,0.12)', text: colors.rose },
  delayed: { bg: 'rgba(248,113,113,0.12)', text: colors.rose },
  'awaiting review': { bg: 'rgba(251,191,36,0.12)', text: colors.amber },
  ongoing: { bg: 'rgba(56,189,248,0.12)', text: colors.cyan },
  open: { bg: 'rgba(96,165,250,0.12)', text: colors.blue },
  resolved: { bg: 'rgba(52,211,153,0.12)', text: colors.emerald },
};

export function Badge({ label, tone }) {
  const key = (tone || label || '').toLowerCase();
  const color = badgeColors[key] || { bg: 'rgba(148,163,184,0.12)', text: colors.textSecondary };
  return (
    <View style={[styles.badge, { backgroundColor: color.bg }]}>
      <Text style={[styles.badgeText, { color: color.text }]}>
        {label}
      </Text>
    </View>
  );
}

/* ─── Primary Button ──────────────────────────────────── */
export function PrimaryButton({ title, onPress, loading: isLoading, icon, style }) {
  return (
    <TouchableOpacity
      style={[styles.primaryBtn, style]}
      onPress={onPress}
      disabled={isLoading}
      activeOpacity={0.8}
    >
      {isLoading ? (
        <ActivityIndicator color={colors.white} size="small" />
      ) : (
        <View style={styles.btnInner}>
          {icon && <Ionicons name={icon} size={18} color={colors.white} style={{ marginRight: 8 }} />}
          <Text style={styles.primaryBtnText}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/* ─── Empty State ─────────────────────────────────────── */
export function EmptyState({ icon, title, subtitle }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon || 'document-text-outline'} size={48} color={colors.textTertiary} />
      <Text style={styles.emptyTitle}>{title || 'Nothing here yet'}</Text>
      {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
    </View>
  );
}

/* ─── Loading Spinner ─────────────────────────────────── */
export function LoadingScreen() {
  return (
    <View style={styles.loadingScreen}>
      <ActivityIndicator size="large" color={colors.accentBlue} />
    </View>
  );
}

/* ─── KPI Tile (Dashboard) ────────────────────────────── */
const kpiTones = {
  blue: colors.blue,
  emerald: colors.emerald,
  amber: colors.amber,
  purple: colors.purple,
  cyan: colors.cyan,
  rose: colors.rose,
};

export function KpiTile({ label, value, icon, tone }) {
  const accent = kpiTones[tone] || colors.accentBlue;
  return (
    <View style={[styles.kpiTile, { borderColor: accent + '30' }]}>
      <View style={[styles.kpiIconWrap, { backgroundColor: accent + '18' }]}>
        <Ionicons name={icon || 'stats-chart'} size={20} color={accent} />
      </View>
      <Text style={styles.kpiValue}>{value ?? '—'}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

/* ─── Avatar ──────────────────────────────────────────── */
export function Avatar({ name, size = 40 }) {
  const initials = (name || '')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
  const raw = name || 'user';
  let hash = 0;
  for (let i = 0; i < raw.length; i++) hash = raw.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hue}, 60%, 35%)` },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    ...shadow.soft,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  sectionAction: { color: colors.accentBlue, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, textTransform: 'capitalize' },
  primaryBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: colors.white, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  btnInner: { flexDirection: 'row', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: spacing['4xl'] },
  emptyTitle: { color: colors.textSecondary, fontSize: fontSize.base, fontWeight: fontWeight.medium, marginTop: spacing.md },
  emptySubtitle: { color: colors.textTertiary, fontSize: fontSize.sm, marginTop: spacing.xs, textAlign: 'center' },
  loadingScreen: { flex: 1, backgroundColor: colors.surface0, justifyContent: 'center', alignItems: 'center' },
  kpiTile: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    flex: 1,
    minWidth: 140,
  },
  kpiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  kpiValue: { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  kpiLabel: { color: colors.textTertiary, fontSize: fontSize.xs, marginTop: 2 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.textPrimary, fontWeight: fontWeight.semibold },
});
