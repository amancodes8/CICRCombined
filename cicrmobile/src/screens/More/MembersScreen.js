/**
 * Members directory screen
 */
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchDirectoryMembers } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Avatar, Badge, Card, EmptyState, LoadingScreen } from '../../components/UI';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function MembersScreen() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetchDirectoryMembers();
      setMembers(Array.isArray(res.data) ? res.data : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? members.filter((m) => (m.name || '').toLowerCase().includes(search.toLowerCase()) || (m.email || '').toLowerCase().includes(search.toLowerCase()))
    : members;

  if (loading) return <LoadingScreen />;

  return (
    <ScreenWrapper title="Members" subtitle={`${members.length} members`} icon="people-outline" scrollable={false}>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search members…"
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id || item.collegeId}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accentBlue} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={<EmptyState icon="people-outline" title="No members found" />}
        renderItem={({ item }) => (
          <Card style={styles.memberCard}>
            <View style={styles.memberRow}>
              <Avatar name={item.name} size={42} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.email}>{item.email}</Text>
                {item.collegeId && <Text style={styles.id}>ID: {item.collegeId}</Text>}
              </View>
              {item.role && <Badge label={item.role} tone={item.role.toLowerCase() === 'admin' ? 'active' : undefined} />}
            </View>
          </Card>
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
  memberCard: { marginBottom: spacing.sm },
  memberRow: { flexDirection: 'row', alignItems: 'center' },
  name: { color: colors.textPrimary, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  email: { color: colors.textTertiary, fontSize: fontSize.xs },
  id: { color: colors.textTertiary, fontSize: fontSize.xs, marginTop: 1 },
});
