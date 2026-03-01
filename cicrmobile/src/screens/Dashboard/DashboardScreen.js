/**
 * Dashboard screen – KPIs, upcoming meetings, recent projects, community posts.
 * Mirrors cicrfrontend/src/pages/Dashboard.jsx.
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchMeetings, fetchMyInsights, fetchPosts, fetchProjects } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Avatar, Badge, Card, EmptyState, KpiTile, LoadingScreen, SectionHeader } from '../../components/UI';
import useAuth from '../../hooks/useAuth';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

const formatDate = (v) => {
  const d = new Date(v);
  if (isNaN(d.getTime())) return 'TBD';
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function DashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({
    insights: {},
    projects: [],
    meetings: [],
    posts: [],
  });

  const load = useCallback(async () => {
    try {
      const [ins, proj, meet, post] = await Promise.all([
        fetchMyInsights().catch(() => ({ data: {} })),
        fetchProjects().catch(() => ({ data: [] })),
        fetchMeetings().catch(() => ({ data: [] })),
        fetchPosts().catch(() => ({ data: [] })),
      ]);
      setData({
        insights: ins.data || {},
        projects: Array.isArray(proj.data) ? proj.data : [],
        meetings: Array.isArray(meet.data) ? meet.data : [],
        posts: Array.isArray(post.data) ? post.data : [],
      });
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) return <LoadingScreen />;

  const upcomingMeetings = data.meetings
    .filter((m) => new Date(m.date || m.scheduledAt) > new Date())
    .sort((a, b) => new Date(a.date || a.scheduledAt) - new Date(b.date || b.scheduledAt))
    .slice(0, 3);

  const recentProjects = data.projects.slice(0, 4);
  const recentPosts = data.posts.slice(0, 3);

  return (
    <ScreenWrapper title={`Welcome${user?.name ? ', ' + user.name.split(' ')[0] : ''}`} subtitle="Here's your overview" icon="grid-outline">
      <FlatList
        data={[1]}
        keyExtractor={() => 'dashboard'}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBlue} colors={[colors.accentBlue]} />}
        renderItem={() => (
          <View>
            {/* KPIs */}
            <View style={styles.kpiRow}>
              <KpiTile label="Projects" value={data.projects.length} icon="folder-open-outline" tone="blue" />
              <KpiTile label="Meetings" value={data.meetings.length} icon="calendar-outline" tone="purple" />
            </View>
            <View style={styles.kpiRow}>
              <KpiTile label="Posts" value={data.posts.length} icon="chatbubbles-outline" tone="cyan" />
              <KpiTile
                label="Completed"
                value={data.projects.filter((p) => (p.status || '').toLowerCase() === 'completed').length}
                icon="checkmark-circle-outline"
                tone="emerald"
              />
            </View>

            {/* Upcoming Meetings */}
            <View style={styles.section}>
              <SectionHeader title="Upcoming Meetings" icon="calendar-outline" onAction={() => navigation.navigate('Meetings')} />
              {upcomingMeetings.length === 0 ? (
                <Card><Text style={styles.muted}>No upcoming meetings</Text></Card>
              ) : (
                upcomingMeetings.map((m) => (
                  <Card key={m._id} style={styles.meetingCard}>
                    <View style={styles.meetingRow}>
                      <View style={styles.meetingIconWrap}>
                        <Ionicons name="videocam-outline" size={18} color={colors.purple} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.meetingTitle} numberOfLines={1}>{m.title || m.agenda}</Text>
                        <Text style={styles.meetingDate}>
                          <Ionicons name="time-outline" size={12} color={colors.textTertiary} />{' '}
                          {formatDate(m.date || m.scheduledAt)}
                        </Text>
                      </View>
                    </View>
                  </Card>
                ))
              )}
            </View>

            {/* Recent Projects */}
            <View style={styles.section}>
              <SectionHeader title="Projects" icon="folder-open-outline" onAction={() => navigation.navigate('Projects')} />
              {recentProjects.length === 0 ? (
                <EmptyState icon="folder-outline" title="No projects yet" />
              ) : (
                recentProjects.map((p) => (
                  <TouchableOpacity
                    key={p._id}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('ProjectDetails', { id: p._id })}
                  >
                    <Card style={styles.projectCard}>
                      <View style={styles.projectHeader}>
                        <Text style={styles.projectName} numberOfLines={1}>{p.name || p.title}</Text>
                        <Badge label={p.status || 'Active'} />
                      </View>
                      {p.description ? (
                        <Text style={styles.projectDesc} numberOfLines={2}>{p.description}</Text>
                      ) : null}
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${Math.min(100, p.progress || 0)}%` }]} />
                      </View>
                      <Text style={styles.progressText}>{p.progress || 0}% complete</Text>
                    </Card>
                  </TouchableOpacity>
                ))
              )}
            </View>

            {/* Recent Discussions */}
            <View style={styles.section}>
              <SectionHeader title="Discussions" icon="chatbubbles-outline" onAction={() => navigation.navigate('Community')} />
              {recentPosts.length === 0 ? (
                <Card><Text style={styles.muted}>No discussions yet</Text></Card>
              ) : (
                recentPosts.map((p) => (
                  <Card key={p._id} style={styles.postCard}>
                    <View style={styles.postHeader}>
                      <Avatar name={p.author?.name || p.authorName} size={32} />
                      <View style={{ flex: 1, marginLeft: spacing.sm }}>
                        <Text style={styles.postAuthor}>{p.author?.name || p.authorName || 'Member'}</Text>
                        <Text style={styles.postTime}>{formatDate(p.createdAt)}</Text>
                      </View>
                    </View>
                    <Text style={styles.postContent} numberOfLines={3}>{p.content || p.body}</Text>
                    <View style={styles.postActions}>
                      <View style={styles.postStat}>
                        <Ionicons name="heart-outline" size={14} color={colors.rose} />
                        <Text style={styles.postStatText}>{p.likes?.length || 0}</Text>
                      </View>
                    </View>
                  </Card>
                ))
              )}
            </View>
          </View>
        )}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  kpiRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  section: { marginTop: spacing.xl },
  muted: { color: colors.textTertiary, fontSize: fontSize.sm },
  meetingCard: { marginBottom: spacing.sm },
  meetingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  meetingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(167,139,250,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meetingTitle: { color: colors.textPrimary, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  meetingDate: { color: colors.textTertiary, fontSize: fontSize.xs, marginTop: 2 },
  projectCard: { marginBottom: spacing.sm },
  projectHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  projectName: { color: colors.textPrimary, fontSize: fontSize.base, fontWeight: fontWeight.semibold, flex: 1, marginRight: spacing.sm },
  projectDesc: { color: colors.textTertiary, fontSize: fontSize.sm, marginBottom: spacing.sm },
  progressTrack: { height: 4, backgroundColor: colors.surface4, borderRadius: 2, overflow: 'hidden', marginTop: spacing.sm },
  progressFill: { height: 4, backgroundColor: colors.accentBlue, borderRadius: 2 },
  progressText: { color: colors.textTertiary, fontSize: fontSize.xs, marginTop: 4 },
  postCard: { marginBottom: spacing.sm },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  postAuthor: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  postTime: { color: colors.textTertiary, fontSize: fontSize.xs },
  postContent: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
  postActions: { flexDirection: 'row', marginTop: spacing.sm },
  postStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postStatText: { color: colors.textTertiary, fontSize: fontSize.xs },
});
