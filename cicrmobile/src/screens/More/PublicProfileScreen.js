/**
 * Public Profile screen – view another member's profile.
 * Mirrors cicrfrontend/src/pages/PublicProfile.jsx.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchPublicProfile, fetchMemberInsights } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Avatar, Badge, Card, EmptyState, KpiTile, LoadingScreen } from '../../components/UI';
import { colors, fontSize, fontWeight, spacing, radius } from '../../theme';

export default function PublicProfileScreen({ route }) {
  const { collegeId } = route.params || {};
  const [profile, setProfile] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [pRes, iRes] = await Promise.all([
        fetchPublicProfile(collegeId),
        fetchMemberInsights(collegeId).catch(() => null),
      ]);
      setProfile(pRes.data?.result || pRes.data);
      if (iRes) setInsights(iRes.data?.result || iRes.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [collegeId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingScreen />;
  if (!profile) return <ScreenWrapper title="Profile"><EmptyState icon="person-outline" title="Profile not found" /></ScreenWrapper>;

  const social = profile.socialLinks || {};

  return (
    <ScreenWrapper title={profile.name || 'Profile'} subtitle={profile.collegeId} icon="person-outline">
      <Card style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Avatar name={profile.name} size={64} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.sub}>{profile.collegeId}</Text>
            <View style={styles.badgeRow}>
              <Badge label={profile.role || 'Member'} tone={profile.role === 'admin' ? 'active' : 'planning'} />
              {profile.year && <Badge label={`Year ${profile.year}`} />}
              {profile.branch && <Badge label={profile.branch} />}
            </View>
          </View>
        </View>
      </Card>

      {/* Insights KPIs */}
      {insights && (
        <View style={styles.kpiRow}>
          <KpiTile label="Projects" value={insights.projectCount ?? 0} icon="folder-open-outline" tone="blue" />
          <KpiTile label="Posts" value={insights.postCount ?? 0} icon="chatbubbles-outline" tone="purple" />
          <KpiTile label="Tasks" value={insights.taskCount ?? 0} icon="checkmark-circle-outline" tone="emerald" />
        </View>
      )}

      {/* Details */}
      <Card style={styles.detailCard}>
        {profile.email && (
          <View style={styles.detailRow}>
            <Ionicons name="mail-outline" size={16} color={colors.textTertiary} />
            <Text style={styles.detailText}>{profile.email}</Text>
          </View>
        )}
        {profile.phone && (
          <View style={styles.detailRow}>
            <Ionicons name="call-outline" size={16} color={colors.textTertiary} />
            <Text style={styles.detailText}>{profile.phone}</Text>
          </View>
        )}
        {profile.batch && (
          <View style={styles.detailRow}>
            <Ionicons name="school-outline" size={16} color={colors.textTertiary} />
            <Text style={styles.detailText}>Batch {profile.batch}</Text>
          </View>
        )}
      </Card>

      {/* Social links */}
      {(social.github || social.linkedin || social.portfolio) && (
        <Card style={styles.detailCard}>
          <Text style={styles.sectionTitle}>Social</Text>
          {social.github ? (
            <View style={styles.detailRow}>
              <Ionicons name="logo-github" size={16} color={colors.textTertiary} />
              <Text style={[styles.detailText, { color: colors.accentBlue }]} onPress={() => Linking.openURL(`https://github.com/${social.github}`)}>{social.github}</Text>
            </View>
          ) : null}
          {social.linkedin ? (
            <View style={styles.detailRow}>
              <Ionicons name="logo-linkedin" size={16} color={colors.textTertiary} />
              <Text style={[styles.detailText, { color: colors.accentBlue }]} onPress={() => Linking.openURL(`https://linkedin.com/in/${social.linkedin}`)}>{social.linkedin}</Text>
            </View>
          ) : null}
          {social.portfolio ? (
            <View style={styles.detailRow}>
              <Ionicons name="globe-outline" size={16} color={colors.textTertiary} />
              <Text style={[styles.detailText, { color: colors.accentBlue }]} onPress={() => Linking.openURL(social.portfolio)}>{social.portfolio}</Text>
            </View>
          ) : null}
        </Card>
      )}

      {/* Projects */}
      {profile.projects?.length > 0 && (
        <Card style={styles.detailCard}>
          <Text style={styles.sectionTitle}>Projects</Text>
          {profile.projects.map((p, i) => (
            <View key={p._id || i} style={styles.projectRow}>
              <Text style={styles.projectName}>{p.name}</Text>
              <Badge label={p.status || 'Active'} tone={p.status?.toLowerCase()} />
            </View>
          ))}
        </Card>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  headerCard: { marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  name: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  sub: { color: colors.textTertiary, fontSize: fontSize.sm, marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  kpiRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  detailCard: { marginBottom: spacing.md },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  detailText: { color: colors.textSecondary, fontSize: fontSize.sm, flex: 1 },
  sectionTitle: { color: colors.textPrimary, fontSize: fontSize.base, fontWeight: fontWeight.semibold, marginBottom: spacing.md },
  projectRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  projectName: { color: colors.textPrimary, fontSize: fontSize.sm, flex: 1, marginRight: spacing.sm },
});
