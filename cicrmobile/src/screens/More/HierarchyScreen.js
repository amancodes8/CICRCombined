/**
 * Hierarchy / Tasks screen
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchHierarchyTasks } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Badge, Card, EmptyState, LoadingScreen } from '../../components/UI';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

const fmtDate = (v) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { day: '2-digit', month: 'short' });
};

export default function HierarchyScreen() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchHierarchyTasks();
      setTasks(Array.isArray(res.data) ? res.data : []);
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
    <ScreenWrapper title="Tasks" subtitle={`${tasks.length} tasks`} icon="git-branch-outline" scrollable={false}>
      <FlatList
        data={tasks}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accentBlue} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={<EmptyState icon="checkbox-outline" title="No tasks" subtitle="All caught up!" />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <Badge label={item.status || 'Open'} />
            </View>
            {item.description && <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>}
            <View style={styles.meta}>
              {item.priority && (
                <View style={styles.metaItem}>
                  <Ionicons name="alert-circle-outline" size={13} color={colors.textTertiary} />
                  <Text style={styles.metaText}>{item.priority}</Text>
                </View>
              )}
              {item.dueDate && (
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={13} color={colors.textTertiary} />
                  <Text style={styles.metaText}>{fmtDate(item.dueDate)}</Text>
                </View>
              )}
            </View>
          </Card>
        )}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  title: { color: colors.textPrimary, fontSize: fontSize.base, fontWeight: fontWeight.medium, flex: 1, marginRight: spacing.sm },
  desc: { color: colors.textTertiary, fontSize: fontSize.sm },
  meta: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: colors.textTertiary, fontSize: fontSize.xs },
});
