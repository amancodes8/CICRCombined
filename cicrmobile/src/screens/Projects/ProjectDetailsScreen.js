/**
 * Project details screen – mirrors cicrfrontend/src/pages/ProjectDetails.jsx
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchProjectById } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Avatar, Badge, Card, LoadingScreen, SectionHeader } from '../../components/UI';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

const fmtDate = (v) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? 'TBD' : d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function ProjectDetailsScreen({ route }) {
  const { id } = route.params;
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetchProjectById(id);
      setProject(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading || !project) return <LoadingScreen />;

  const progress = Math.max(0, Math.min(100, Number(project.progress) || 0));

  return (
    <ScreenWrapper title={project.name || project.title} subtitle={project.status} icon="folder-open-outline">
      <Card style={styles.topCard}>
        <View style={styles.statusRow}>
          <Badge label={project.status || 'Active'} />
          <Text style={styles.progressLabel}>{progress}% complete</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </Card>

      {project.description ? (
        <Card style={styles.sectionCard}>
          <SectionHeader title="Description" icon="document-text-outline" />
          <Text style={styles.body}>{project.description}</Text>
        </Card>
      ) : null}

      <Card style={styles.sectionCard}>
        <SectionHeader title="Timeline" icon="calendar-outline" />
        <View style={styles.dateRow}>
          <View style={styles.dateItem}>
            <Ionicons name="flag-outline" size={14} color={colors.emerald} />
            <Text style={styles.dateLabel}>Start</Text>
            <Text style={styles.dateValue}>{fmtDate(project.startDate)}</Text>
          </View>
          <View style={styles.dateItem}>
            <Ionicons name="checkmark-circle-outline" size={14} color={colors.rose} />
            <Text style={styles.dateLabel}>Deadline</Text>
            <Text style={styles.dateValue}>{fmtDate(project.endDate || project.deadline)}</Text>
          </View>
        </View>
      </Card>

      {project.team?.length > 0 && (
        <Card style={styles.sectionCard}>
          <SectionHeader title="Team" icon="people-outline" />
          {project.team.map((member, idx) => (
            <View key={member._id || idx} style={styles.memberRow}>
              <Avatar name={member.name} size={34} />
              <View style={{ marginLeft: spacing.sm }}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberRole}>{member.role || 'Member'}</Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      {project.updates?.length > 0 && (
        <Card style={styles.sectionCard}>
          <SectionHeader title="Updates" icon="chatbox-outline" />
          {project.updates.slice(0, 5).map((u, idx) => (
            <View key={idx} style={styles.updateItem}>
              <Text style={styles.updateText}>{u.text || u.content}</Text>
              <Text style={styles.updateDate}>{fmtDate(u.createdAt || u.date)}</Text>
            </View>
          ))}
        </Card>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  topCard: { marginBottom: spacing.md },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  progressLabel: { color: colors.textTertiary, fontSize: fontSize.sm },
  progressTrack: { height: 6, backgroundColor: colors.surface4, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.accentBlue, borderRadius: 3 },
  sectionCard: { marginBottom: spacing.md },
  body: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 22 },
  dateRow: { flexDirection: 'row', gap: spacing.xl },
  dateItem: { alignItems: 'center', gap: 4 },
  dateLabel: { color: colors.textTertiary, fontSize: fontSize.xs },
  dateValue: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  memberName: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  memberRole: { color: colors.textTertiary, fontSize: fontSize.xs },
  updateItem: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  updateText: { color: colors.textSecondary, fontSize: fontSize.sm },
  updateDate: { color: colors.textTertiary, fontSize: fontSize.xs, marginTop: 2 },
});
