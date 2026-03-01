/**
 * Programs Hub screen
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchProgramOverview } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Card, KpiTile, LoadingScreen } from '../../components/UI';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

export default function ProgramsHubScreen() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchProgramOverview();
      setOverview(res.data || {});
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingScreen />;

  const stats = [
    { label: 'Quests', value: overview?.quests?.total ?? 0, icon: 'flag-outline', tone: 'purple' },
    { label: 'Badges', value: overview?.badges?.total ?? 0, icon: 'ribbon-outline', tone: 'amber' },
    { label: 'Mentorship', value: overview?.mentorRequests?.total ?? 0, icon: 'people-outline', tone: 'blue' },
    { label: 'Ideas', value: overview?.ideas?.total ?? 0, icon: 'bulb-outline', tone: 'emerald' },
  ];

  return (
    <ScreenWrapper title="Programs Hub" subtitle="Quests, badges & more" icon="trophy-outline">
      <FlatList
        data={[1]}
        keyExtractor={() => 'programs'}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accentBlue} />}
        renderItem={() => (
          <View>
            <View style={styles.kpiRow}>
              <KpiTile label={stats[0].label} value={stats[0].value} icon={stats[0].icon} tone={stats[0].tone} />
              <KpiTile label={stats[1].label} value={stats[1].value} icon={stats[1].icon} tone={stats[1].tone} />
            </View>
            <View style={styles.kpiRow}>
              <KpiTile label={stats[2].label} value={stats[2].value} icon={stats[2].icon} tone={stats[2].tone} />
              <KpiTile label={stats[3].label} value={stats[3].value} icon={stats[3].icon} tone={stats[3].tone} />
            </View>

            {/* Sections */}
            {overview?.recentQuests?.length > 0 && (
              <Card style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Quests</Text>
                {overview.recentQuests.slice(0, 5).map((q, idx) => (
                  <View key={q._id || idx} style={styles.questRow}>
                    <Ionicons name="flag-outline" size={16} color={colors.purple} />
                    <Text style={styles.questText}>{q.title || q.name}</Text>
                  </View>
                ))}
              </Card>
            )}
          </View>
        )}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  kpiRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  section: { marginTop: spacing.md },
  sectionTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.semibold, marginBottom: spacing.sm },
  questRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  questText: { color: colors.textSecondary, fontSize: fontSize.sm, flex: 1 },
});
