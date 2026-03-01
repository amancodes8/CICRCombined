/**
 * Meetings screen – list of upcoming and past meetings.
 * Mirrors cicrfrontend/src/pages/Meetings.jsx.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { deleteMeeting, fetchMeetings } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Avatar, Card, EmptyState, LoadingScreen } from '../../components/UI';
import useAuth from '../../hooks/useAuth';
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
  const navigation = useNavigation();
  const { user } = useAuth();
  const canSchedule = ['admin', 'head', 'teamLead'].includes((user?.role || '').toLowerCase()) || Number(user?.year) >= 2;
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

  const handleDelete = (m) => {
    Alert.alert('Delete Meeting', `Delete "${m.title || m.agenda}"?`, [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteMeeting(m._id); load(); } catch (err) { Alert.alert('Error', err.response?.data?.message || 'Failed.'); } } },
    ]);
  };

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
      {/* Schedule button */}
      {canSchedule && (
        <TouchableOpacity style={styles.scheduleBtn} onPress={() => navigation.navigate('ScheduleMeeting')}>
          <Ionicons name="add-circle-outline" size={18} color={colors.white} />
          <Text style={styles.scheduleBtnText}>Schedule Meeting</Text>
        </TouchableOpacity>
      )}
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
            {canSchedule && (
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                <Ionicons name="trash-outline" size={14} color={colors.rose} />
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
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
  scheduleBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 6,
    backgroundColor: colors.accentBlue, borderRadius: radius.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.md,
  },
  scheduleBtnText: { color: colors.white, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end',
    marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSubtle,
  },
  deleteBtnText: { color: colors.rose, fontSize: fontSize.xs },
});
