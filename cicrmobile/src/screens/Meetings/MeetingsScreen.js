/**
 * Meetings screen – list of upcoming and past meetings.
 * Mirrors cicrfrontend/src/pages/Meetings.jsx.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchMeetings } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Avatar, Card, EmptyState, LoadingScreen } from '../../components/UI';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const fmtDate = (v) => {
  const d = new Date(v);
  if (isNaN(d.getTime())) return 'TBD';
  return d.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' });
};

const fmtTime = (v) => {
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function MeetingsScreen() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('upcoming');

  const load = useCallback(async () => {
    try {
      const res = await fetchMeetings();
      setMeetings(Array.isArray(res.data) ? res.data : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    const up = [];
    const pa = [];
    meetings.forEach((m) => {
      const d = new Date(m.date || m.scheduledAt);
      (d > now ? up : pa).push(m);
    });
    up.sort((a, b) => new Date(a.date || a.scheduledAt) - new Date(b.date || b.scheduledAt));
    pa.sort((a, b) => new Date(b.date || b.scheduledAt) - new Date(a.date || a.scheduledAt));
    return { upcoming: up, past: pa };
  }, [meetings]);

  const list = tab === 'upcoming' ? upcoming : past;

  if (loading) return <LoadingScreen />;

  return (
    <ScreenWrapper title="Meetings" subtitle={`${meetings.length} total`} icon="calendar-outline" scrollable={false}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, tab === 'upcoming' && styles.tabActive]} onPress={() => setTab('upcoming')}>
          <Text style={[styles.tabText, tab === 'upcoming' && styles.tabTextActive]}>Upcoming ({upcoming.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'past' && styles.tabActive]} onPress={() => setTab('past')}>
          <Text style={[styles.tabText, tab === 'past' && styles.tabTextActive]}>Past ({past.length})</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={list}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accentBlue} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={<EmptyState icon="calendar-outline" title={tab === 'upcoming' ? 'No upcoming meetings' : 'No past meetings'} />}
        renderItem={({ item }) => (
          <Card style={styles.meetingCard}>
            <View style={styles.meetingRow}>
              <View style={styles.dateBox}>
                <Text style={styles.dateDay}>{new Date(item.date || item.scheduledAt).getDate()}</Text>
                <Text style={styles.dateMonth}>
                  {new Date(item.date || item.scheduledAt).toLocaleDateString([], { month: 'short' })}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.meetingTitle} numberOfLines={1}>{item.title || item.agenda}</Text>
                <View style={styles.meetingMeta}>
                  <Ionicons name="time-outline" size={13} color={colors.textTertiary} />
                  <Text style={styles.metaText}>{fmtTime(item.date || item.scheduledAt)}</Text>
                </View>
                {item.description ? (
                  <Text style={styles.meetingDesc} numberOfLines={2}>{item.description}</Text>
                ) : null}
                {item.attendees?.length > 0 && (
                  <View style={styles.attendees}>
                    <Ionicons name="people-outline" size={13} color={colors.textTertiary} />
                    <Text style={styles.metaText}>{item.attendees.length} attendees</Text>
                  </View>
                )}
              </View>
            </View>
            {item.link && (
              <View style={styles.linkRow}>
                <Ionicons name="link-outline" size={14} color={colors.accentBlue} />
                <Text style={styles.linkText} numberOfLines={1}>{item.link}</Text>
              </View>
            )}
          </Card>
        )}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    marginBottom: spacing.lg,
    padding: 3,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm - 2, alignItems: 'center' },
  tabActive: { backgroundColor: colors.accentBlue },
  tabText: { color: colors.textTertiary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  tabTextActive: { color: colors.white },
  meetingCard: { marginBottom: spacing.md },
  meetingRow: { flexDirection: 'row', gap: spacing.md },
  dateBox: {
    width: 50,
    height: 54,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(56,189,248,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: { color: colors.accentBlue, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  dateMonth: { color: colors.accentBlue, fontSize: fontSize.xs, fontWeight: fontWeight.medium, textTransform: 'uppercase' },
  meetingTitle: { color: colors.textPrimary, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  meetingMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { color: colors.textTertiary, fontSize: fontSize.xs },
  meetingDesc: { color: colors.textTertiary, fontSize: fontSize.sm, marginTop: spacing.xs },
  attendees: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  linkText: { color: colors.accentBlue, fontSize: fontSize.xs, flex: 1 },
});
