/**
 * Projects list screen – mirrors cicrfrontend/src/pages/Projects.jsx
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchProjects } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Badge, Card, EmptyState, LoadingScreen } from '../../components/UI';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const STATUS_OPTIONS = ['all', 'Planning', 'Active', 'On-Hold', 'Delayed', 'Awaiting Review', 'Completed', 'Archived', 'Ongoing'];

const clamp = (v) => Math.max(0, Math.min(100, Number(v) || 0));

export default function ProjectsScreen() {
  const navigation = useNavigation();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      const res = await fetchProjects();
      setProjects(Array.isArray(res.data) ? res.data : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let list = projects;
    if (statusFilter !== 'all') list = list.filter((p) => p.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => (p.name || p.title || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
    }
    return list;
  }, [projects, statusFilter, search]);

  if (loading) return <LoadingScreen />;

  return (
    <ScreenWrapper title="Projects" subtitle={`${projects.length} total`} icon="folder-open-outline" scrollable={false}>
      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search projects…"
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filters */}
      <FlatList
        horizontal
        data={STATUS_OPTIONS}
        keyExtractor={(i) => i}
        showsHorizontalScrollIndicator={false}
        style={styles.filterList}
        contentContainerStyle={{ paddingRight: spacing.lg }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === item && styles.filterChipActive]}
            onPress={() => setStatusFilter(item)}
          >
            <Text style={[styles.filterText, statusFilter === item && styles.filterTextActive]}>
              {item === 'all' ? 'All' : item}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Projects list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accentBlue} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={<EmptyState icon="folder-outline" title="No projects found" subtitle="Try adjusting your filters" />}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('ProjectDetails', { id: item._id })}>
            <Card style={styles.projectCard}>
              <View style={styles.projectHeader}>
                <Text style={styles.projectName} numberOfLines={1}>{item.name || item.title}</Text>
                <Badge label={item.status || 'Active'} />
              </View>
              {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${clamp(item.progress)}%` }]} />
              </View>
              <View style={styles.meta}>
                <View style={styles.metaItem}>
                  <Ionicons name="people-outline" size={13} color={colors.textTertiary} />
                  <Text style={styles.metaText}>{item.team?.length || 0} members</Text>
                </View>
                <Text style={styles.metaText}>{clamp(item.progress)}%</Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.base,
    paddingVertical: spacing.sm,
    marginLeft: spacing.sm,
  },
  filterList: { marginBottom: spacing.md, maxHeight: 40 },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginRight: spacing.sm,
  },
  filterChipActive: { backgroundColor: colors.accentBlue, borderColor: colors.accentBlue },
  filterText: { color: colors.textSecondary, fontSize: fontSize.sm },
  filterTextActive: { color: colors.white, fontWeight: fontWeight.medium },
  projectCard: { marginBottom: spacing.md },
  projectHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  projectName: { color: colors.textPrimary, fontSize: fontSize.base, fontWeight: fontWeight.semibold, flex: 1, marginRight: spacing.sm },
  desc: { color: colors.textTertiary, fontSize: fontSize.sm, marginBottom: spacing.sm },
  progressTrack: { height: 4, backgroundColor: colors.surface4, borderRadius: 2, overflow: 'hidden', marginTop: spacing.sm },
  progressFill: { height: 4, backgroundColor: colors.accentBlue, borderRadius: 2 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: colors.textTertiary, fontSize: fontSize.xs },
});
