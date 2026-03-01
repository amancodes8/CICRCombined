/**
 * Project details screen – mirrors cicrfrontend/src/pages/ProjectDetails.jsx
 * With add update, progress update, delete, and review navigation.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { addProjectUpdate, deleteProject, fetchProjectById, updateProjectProgress } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Avatar, Badge, Card, LoadingScreen, PrimaryButton, SectionHeader } from '../../components/UI';
import useAuth from '../../hooks/useAuth';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const fmtDate = (v) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? 'TBD' : d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function ProjectDetailsScreen({ route }) {
  const { id } = route.params;
  const navigation = useNavigation();
  const { user } = useAuth();
  const isAdmin = (user?.role || '').toLowerCase() === 'admin';
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUpdate, setShowUpdate] = useState(false);
  const [updateText, setUpdateText] = useState('');
  const [updateType, setUpdateType] = useState('Comment');
  const [saving, setSaving] = useState(false);

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

  const canManage = isAdmin || project?.lead?._id === user?._id || project?.lead === user?._id;

  const handleAddUpdate = async () => {
    if (!updateText.trim()) return;
    setSaving(true);
    try {
      const { data } = await addProjectUpdate(id, { text: updateText.trim(), type: updateType });
      setProject(data);
      setUpdateText(''); setShowUpdate(false);
    } catch (err) { Alert.alert('Error', err.response?.data?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  const handleProgressUpdate = () => {
    Alert.prompt?.('Update Progress', 'Enter progress % (0-100):', async (val) => {
      const num = Number(val);
      if (isNaN(num) || num < 0 || num > 100) return Alert.alert('Error', 'Enter 0-100.');
      try {
        const { data } = await updateProjectProgress(id, { progress: num });
        setProject(data);
      } catch (err) { Alert.alert('Error', err.response?.data?.message || 'Failed.'); }
    }, 'plain-text', String(Math.round(Number(project?.progress) || 0))) ||
    Alert.alert('Progress', 'Use the web app to update progress on Android.');
  };

  const handleDelete = () => {
    Alert.alert('Delete Project', 'This can\'t be undone.', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteProject(id); navigation.goBack(); } catch (err) { Alert.alert('Error', err.response?.data?.message || 'Failed.'); } } },
    ]);
  };

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
              <Badge label={u.type || 'Comment'} style={{ marginBottom: 4 }} />
              <Text style={styles.updateText}>{u.text || u.content}</Text>
              <Text style={styles.updateDate}>{fmtDate(u.createdAt || u.date)}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* Action buttons */}
      {canManage && (
        <Card style={styles.sectionCard}>
          <SectionHeader title="Actions" icon="build-outline" />
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionChip} onPress={() => setShowUpdate(true)}>
              <Ionicons name="chatbox-outline" size={16} color={colors.accentBlue} />
              <Text style={[styles.actionChipText, { color: colors.accentBlue }]}>Add Update</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionChip} onPress={handleProgressUpdate}>
              <Ionicons name="trending-up-outline" size={16} color={colors.emerald} />
              <Text style={[styles.actionChipText, { color: colors.emerald }]}>Progress</Text>
            </TouchableOpacity>
            {isAdmin && (
              <>
                <TouchableOpacity style={styles.actionChip} onPress={() => navigation.navigate('ProjectReview', { id })}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={colors.purple} />
                  <Text style={[styles.actionChipText, { color: colors.purple }]}>Review</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionChip} onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={16} color={colors.rose} />
                  <Text style={[styles.actionChipText, { color: colors.rose }]}>Delete</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Card>
      )}

      {/* Add Update Modal */}
      <Modal visible={showUpdate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Project Update</Text>
            <View style={styles.chipRow}>
              {['Comment', 'Blocker', 'Achievement', 'Status'].map((t) => (
                <TouchableOpacity key={t} style={[styles.typeChip, updateType === t && styles.typeChipActive]} onPress={() => setUpdateType(t)}>
                  <Text style={[styles.typeChipText, updateType === t && styles.typeChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.modalTextarea}
              placeholder="Write your update..."
              placeholderTextColor={colors.textTertiary}
              value={updateText}
              onChangeText={setUpdateText}
              multiline
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity onPress={() => setShowUpdate(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <PrimaryButton title={saving ? 'Saving…' : 'Submit'} onPress={handleAddUpdate} disabled={saving || !updateText.trim()} />
            </View>
          </View>
        </View>
      </Modal>
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
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.surface3 },
  actionChipText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: spacing.lg },
  modalContent: { backgroundColor: colors.surface2, borderRadius: radius.lg, padding: spacing.lg },
  modalTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  typeChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.surface3 },
  typeChipActive: { backgroundColor: colors.accentBlue },
  typeChipText: { color: colors.textTertiary, fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  typeChipTextActive: { color: colors.white },
  modalTextarea: {
    backgroundColor: colors.surface3, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderSubtle,
    color: colors.textPrimary, fontSize: fontSize.base, padding: spacing.md, minHeight: 100, textAlignVertical: 'top',
  },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  cancelText: { color: colors.textTertiary, fontSize: fontSize.base },
});
