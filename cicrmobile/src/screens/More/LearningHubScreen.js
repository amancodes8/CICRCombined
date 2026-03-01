/**
 * Learning Hub screen
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchLearningTracks } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Badge, Card, EmptyState, LoadingScreen } from '../../components/UI';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

export default function LearningHubScreen() {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchLearningTracks();
      setTracks(Array.isArray(res.data) ? res.data : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingScreen />;

  return (
    <ScreenWrapper title="Learning Hub" subtitle={`${tracks.length} tracks`} icon="school-outline" scrollable={false}>
      <FlatList
        data={tracks}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accentBlue} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={<EmptyState icon="school-outline" title="No learning tracks" subtitle="Check back soon" />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.header}>
              <View style={styles.iconWrap}>
                <Ionicons name="book-outline" size={20} color={colors.emerald} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title || item.name}</Text>
                {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
              </View>
            </View>
            <View style={styles.meta}>
              {item.tasks?.length > 0 && (
                <View style={styles.metaItem}>
                  <Ionicons name="list-outline" size={13} color={colors.textTertiary} />
                  <Text style={styles.metaText}>{item.tasks.length} tasks</Text>
                </View>
              )}
              {item.status && <Badge label={item.status} />}
            </View>
          </Card>
        )}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(52,211,153,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.textPrimary, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  desc: { color: colors.textTertiary, fontSize: fontSize.sm, marginTop: 2 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: colors.textTertiary, fontSize: fontSize.xs },
});
