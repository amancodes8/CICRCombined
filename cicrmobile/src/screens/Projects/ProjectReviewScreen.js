/**
 * Project Review screen – admin quality review / verdict panel.
 * Mirrors cicrfrontend/src/pages/ProjectReview.jsx.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addProjectUpdate, fetchProjectById, updateProjectStatus } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Badge, Card, KpiTile, LoadingScreen, PrimaryButton, SectionHeader } from '../../components/UI';
import useAuth from '../../hooks/useAuth';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const REVIEW_STATUSES = ['Planning', 'Active', 'On-Hold', 'Delayed', 'Awaiting Review', 'Completed', 'Archived', 'Ongoing'];

const fmtDate = (v) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? 'TBD' : d.toLocaleString();
};

export default function ProjectReviewScreen({ route, navigation }) {
  const { id } = route.params;
  const { user } = useAuth();
  const isAdmin = ['admin'].includes((user?.role || '').toLowerCase());

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewStatus, setReviewStatus] = useState('Awaiting Review');
  const [reviewNote, setReviewNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await fetchProjectById(id);
      setProject(data);
      setReviewStatus(String(data?.status || 'Awaiting Review'));
    } catch { setProject(null); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const blockers = useMemo(() => (project?.updates || []).filter((r) => String(r.type || '').toLowerCase() === 'blocker'), [project?.updates]);

  const readiness = useMemo(() => {
    if (!project) return 0;
    const checks = [
      Number(project.progress || 0) >= 100,
      Array.isArray(project.components) && project.components.length > 0,
      !!project.lead,
      !!project.guide,
      Array.isArray(project.team) && project.team.length > 0,
      blockers.length === 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [project, blockers.length]);

  const orderedHistory = useMemo(
    () => [...(project?.statusHistory || [])].sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt)),
    [project?.statusHistory],
  );

  const submitVerdict = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      const { data } = await updateProjectStatus(id, { status: reviewStatus, note: reviewNote });
      setProject(data);
      setReviewStatus(String(data?.status || reviewStatus));
      setReviewNote('');
      Alert.alert('Success', reviewStatus === 'Completed' ? 'Project marked as completed.' : 'Review verdict applied.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to apply verdict.');
    } finally { setSaving(false); }
  };

  const postNote = async () => {
    if (!isAdmin || !reviewNote.trim()) return;
    setSaving(true);
    try {
      const { data } = await addProjectUpdate(id, { type: 'Status', text: `Review note: ${reviewNote.trim()}` });
      setProject(data);
      setReviewNote('');
      Alert.alert('Saved', 'Review note logged.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to add note.');
    } finally { setSaving(false); }
  };

  if (loading) return <LoadingScreen />;
  if (!project) {
    return (
      <ScreenWrapper title="Review" icon="shield-checkmark-outline">
        <Card><Text style={{ color: colors.rose, fontSize: fontSize.sm }}>Project not found or not visible.</Text></Card>
      </ScreenWrapper>
    );
  }

  const toneColor = (v) => {
    if (v >= 80) return colors.emerald;
    if (v >= 60) return colors.amber;
    return colors.rose;
  };

  return (
    <ScreenWrapper title="Project Review" subtitle={project.name || project.title} icon="shield-checkmark-outline">
      {/* Metrics */}
      <View style={styles.kpiRow}>
        <Card style={styles.kpiCard}>
          <Text style={[styles.kpiVal, { color: toneColor(readiness) }]}>{readiness}%</Text>
          <Text style={styles.kpiLabel}>Readiness</Text>
        </Card>
        <Card style={styles.kpiCard}>
          <Text style={[styles.kpiVal, { color: toneColor(Number(project.progress || 0)) }]}>{Math.round(Number(project.progress || 0))}%</Text>
          <Text style={styles.kpiLabel}>Progress</Text>
        </Card>
        <Card style={styles.kpiCard}>
          <Text style={[styles.kpiVal, { color: blockers.length === 0 ? colors.emerald : colors.rose }]}>{blockers.length}</Text>
          <Text style={styles.kpiLabel}>Blockers</Text>
        </Card>
      </View>

      {/* Info */}
      <Card style={styles.section}>
        <Badge label={project.status || 'Active'} />
        <Text style={styles.projInfo}>Lead: {project.lead?.name || 'N/A'} · Guide: {project.guide?.name || 'N/A'}</Text>
        <Text style={styles.projInfo}>Event: {project.event?.title || 'Internal'}</Text>
      </Card>

      {/* Timeline */}
      <Card style={styles.section}>
        <SectionHeader title="Review Timeline" icon="time-outline" />
        {orderedHistory.length === 0 ? (
          <Text style={styles.empty}>No timeline entries yet.</Text>
        ) : (
          orderedHistory.map((row, idx) => (
            <View key={idx} style={styles.timelineItem}>
              <View style={styles.timelineHeader}>
                <Badge label={row.status} />
                <Text style={styles.timelineDate}>{fmtDate(row.changedAt)}</Text>
              </View>
              <Text style={styles.timelineName}>{row.changedBy?.name || 'Admin'}</Text>
              {row.note ? <Text style={styles.timelineNote}>{row.note}</Text> : null}
            </View>
          ))
        )}
      </Card>

      {/* Verdict Panel */}
      <Card style={styles.section}>
        <SectionHeader title="Verdict Panel" icon="shield-checkmark-outline" />
        {isAdmin ? (
          <>
            <Text style={styles.fieldLabel}>Review Decision</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              {REVIEW_STATUSES.map((s) => (
                <TouchableOpacity key={s} style={[styles.statusChip, reviewStatus === s && styles.statusChipActive]} onPress={() => setReviewStatus(s)}>
                  <Text style={[styles.statusChipText, reviewStatus === s && styles.statusChipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Review Note</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Quality review notes, concerns, sign-off reason..."
              placeholderTextColor={colors.textTertiary}
              value={reviewNote}
              onChangeText={setReviewNote}
              multiline
            />

            <View style={styles.btnRow}>
              <PrimaryButton title={saving ? 'Saving…' : 'Apply Verdict'} onPress={submitVerdict} icon="checkmark-circle-outline" disabled={saving} />
              <TouchableOpacity style={styles.secondaryBtn} onPress={postNote} disabled={saving || !reviewNote.trim()}>
                <Text style={styles.secondaryBtnText}>Save Note</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <Text style={styles.empty}>Review verdict is restricted to administrators.</Text>
        )}
      </Card>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  kpiRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  kpiCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  kpiVal: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  kpiLabel: { color: colors.textTertiary, fontSize: fontSize.xs, marginTop: 2 },
  section: { marginBottom: spacing.md },
  projInfo: { color: colors.textTertiary, fontSize: fontSize.sm, marginTop: spacing.xs },
  empty: { color: colors.textTertiary, fontSize: fontSize.sm },
  timelineItem: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineDate: { color: colors.textTertiary, fontSize: fontSize.xs },
  timelineName: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 4 },
  timelineNote: { color: colors.textTertiary, fontSize: fontSize.sm, marginTop: 2 },
  fieldLabel: { color: colors.textTertiary, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, marginBottom: spacing.xs },
  statusChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, backgroundColor: colors.surface3, marginRight: spacing.sm,
  },
  statusChipActive: { backgroundColor: colors.accentBlue },
  statusChipText: { color: colors.textTertiary, fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  statusChipTextActive: { color: colors.white },
  noteInput: {
    backgroundColor: colors.surface3, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderSubtle,
    color: colors.textPrimary, fontSize: fontSize.sm, padding: spacing.md, minHeight: 100,
    textAlignVertical: 'top', marginBottom: spacing.md,
  },
  btnRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  secondaryBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderSubtle },
  secondaryBtnText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
});
