/**
 * Hierarchy / Tasks screen – with create, status update, delete.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createHierarchyTask, deleteHierarchyTask, fetchHierarchyTasks, updateHierarchyTask } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Badge, Card, EmptyState, LoadingScreen, PrimaryButton } from '../../components/UI';
import useAuth from '../../hooks/useAuth';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const STATUSES = ['Open', 'In Progress', 'Completed', 'Blocked'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

const fmtDate = (v) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { day: '2-digit', month: 'short' });
};

export default function HierarchyScreen() {
  const { user } = useAuth();
  const canManage = ['admin', 'head', 'teamLead'].includes((user?.role || '').toLowerCase()) || Number(user?.year) >= 2;
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState('Medium');
  const [newDueDate, setNewDueDate] = useState('');
  const [saving, setSaving] = useState(false);

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

  const handleCreate = async () => {
    if (!newTitle.trim()) return Alert.alert('Error', 'Title required.');
    setSaving(true);
    try {
      await createHierarchyTask({ title: newTitle.trim(), description: newDesc.trim(), priority: newPriority, dueDate: newDueDate || undefined });
      setShowCreate(false); setNewTitle(''); setNewDesc(''); setNewDueDate('');
      load();
    } catch (err) { Alert.alert('Error', err.response?.data?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  const handleStatus = (task) => {
    const opts = STATUSES.filter((s) => s !== task.status).map((s) => ({ text: s, onPress: async () => { try { await updateHierarchyTask(task._id, { status: s }); load(); } catch (e) { Alert.alert('Error', e.response?.data?.message || 'Failed.'); } } }));
    Alert.alert('Update Status', `Current: ${task.status}`, [...opts, { text: 'Cancel', style: 'cancel' }]);
  };

  const handleDelete = (task) => {
    Alert.alert('Delete Task', `Delete "${task.title}"?`, [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteHierarchyTask(task._id); load(); } catch (e) { Alert.alert('Error', e.response?.data?.message || 'Failed.'); } } },
    ]);
  };

  if (loading) return <LoadingScreen />;

  return (
    <ScreenWrapper title="Tasks" subtitle={`${tasks.length} tasks`} icon="git-branch-outline" scrollable={false}>
      {canManage && (
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Ionicons name="add-circle-outline" size={18} color={colors.white} />
          <Text style={styles.addBtnText}>New Task</Text>
        </TouchableOpacity>
      )}

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
            {canManage && (
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleStatus(item)}>
                  <Ionicons name="swap-horizontal" size={14} color={colors.accentBlue} />
                  <Text style={[styles.actionBtnText, { color: colors.accentBlue }]}>Status</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item)}>
                  <Ionicons name="trash-outline" size={14} color={colors.rose} />
                  <Text style={[styles.actionBtnText, { color: colors.rose }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        )}
      />

      {/* Create Task Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Task</Text>
            <TextInput style={styles.modalInput} placeholder="Title *" placeholderTextColor={colors.textTertiary} value={newTitle} onChangeText={setNewTitle} />
            <TextInput style={[styles.modalInput, { minHeight: 70, textAlignVertical: 'top' }]} placeholder="Description" placeholderTextColor={colors.textTertiary} value={newDesc} onChangeText={setNewDesc} multiline />
            <View style={styles.chipRow}>
              {PRIORITIES.map((p) => (
                <TouchableOpacity key={p} style={[styles.chip, newPriority === p && styles.chipActive]} onPress={() => setNewPriority(p)}>
                  <Text style={[styles.chipText, newPriority === p && styles.chipTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.modalInput} placeholder="Due date (YYYY-MM-DD)" placeholderTextColor={colors.textTertiary} value={newDueDate} onChangeText={setNewDueDate} />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <PrimaryButton title={saving ? 'Creating…' : 'Create'} onPress={handleCreate} disabled={saving} />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 6,
    backgroundColor: colors.accentBlue, borderRadius: radius.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.md,
  },
  addBtnText: { color: colors.white, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  card: { marginBottom: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  title: { color: colors.textPrimary, fontSize: fontSize.base, fontWeight: fontWeight.medium, flex: 1, marginRight: spacing.sm },
  desc: { color: colors.textTertiary, fontSize: fontSize.sm },
  meta: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: colors.textTertiary, fontSize: fontSize.xs },
  actionRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtnText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: spacing.lg },
  modalContent: { backgroundColor: colors.surface2, borderRadius: radius.lg, padding: spacing.lg },
  modalTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: spacing.md },
  modalInput: {
    backgroundColor: colors.surface3, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderSubtle,
    color: colors.textPrimary, fontSize: fontSize.base, paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm, marginBottom: spacing.sm,
  },
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.surface3 },
  chipActive: { backgroundColor: colors.accentBlue },
  chipText: { color: colors.textTertiary, fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  chipTextActive: { color: colors.white },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  cancelText: { color: colors.textTertiary, fontSize: fontSize.base },
});
