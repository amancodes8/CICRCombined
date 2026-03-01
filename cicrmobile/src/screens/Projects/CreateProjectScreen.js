/**
 * Create Project screen – form to submit a new project.
 * Mirrors cicrfrontend/src/pages/CreateProject.jsx.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { createProject, fetchDirectoryMembers } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Card, PrimaryButton } from '../../components/UI';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const STATUSES = ['Planning', 'Active', 'Completed', 'On-Hold'];

function InputField({ icon, label, value, onChangeText, placeholder, multiline, keyboardType }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        {icon && <Ionicons name={icon} size={16} color={colors.textTertiary} style={{ marginRight: spacing.sm }} />}
        <TextInput
          style={[styles.input, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          autoCorrect={false}
          autoCapitalize="none"
          keyboardType={keyboardType || 'default'}
        />
      </View>
    </View>
  );
}

export default function CreateProjectScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    status: 'Planning',
    repoUrl: '',
    tags: '',
  });

  const set = useCallback((key, val) => setForm((p) => ({ ...p, [key]: val })), []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchDirectoryMembers();
        setMembers(Array.isArray(res.data) ? res.data : res.data?.result || []);
      } catch { /* silent */ }
    })();
  }, []);

  const filteredMembers = members.filter((m) => {
    if (!memberSearch.trim()) return false;
    const q = memberSearch.toLowerCase();
    return ((m.name || '').toLowerCase().includes(q) || (m.collegeId || '').toLowerCase().includes(q))
      && !selectedMembers.find((a) => a._id === m._id);
  }).slice(0, 5);

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim()) return Alert.alert('Error', 'Project name is required.');
    if (!form.description.trim()) return Alert.alert('Error', 'Description is required.');

    setLoading(true);
    try {
      const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
      await createProject({
        name: form.name.trim(),
        description: form.description.trim(),
        status: form.status,
        repoUrl: form.repoUrl.trim(),
        tags,
        team: selectedMembers.map((m) => m._id),
      });
      Alert.alert('Success', 'Project created!');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to create project.');
    } finally {
      setLoading(false);
    }
  }, [form, selectedMembers, navigation]);

  return (
    <ScreenWrapper title="Create Project" subtitle="Start something new" icon="rocket-outline">
      <Card style={styles.card}>
        <InputField icon="text-outline" label="Project Name" value={form.name} onChangeText={(v) => set('name', v)} placeholder="My awesome project" />
        <InputField icon="document-text-outline" label="Description" value={form.description} onChangeText={(v) => set('description', v)} placeholder="What does this project do?" multiline />

        {/* Status selector */}
        <View style={styles.field}>
          <Text style={styles.label}>Status</Text>
          <View style={styles.statusRow}>
            {STATUSES.map((s) => (
              <TouchableOpacity key={s} style={[styles.statusChip, form.status === s && styles.statusChipActive]} onPress={() => set('status', s)}>
                <Text style={[styles.statusText, form.status === s && styles.statusTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <InputField icon="logo-github" label="Repo URL" value={form.repoUrl} onChangeText={(v) => set('repoUrl', v)} placeholder="https://github.com/..." keyboardType="url" />
        <InputField icon="pricetags-outline" label="Tags (comma-separated)" value={form.tags} onChangeText={(v) => set('tags', v)} placeholder="react, iot, python" />

        {/* Team members */}
        <View style={styles.field}>
          <Text style={styles.label}>Team Members</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="people-outline" size={16} color={colors.textTertiary} style={{ marginRight: spacing.sm }} />
            <TextInput
              style={styles.input}
              placeholder="Search members..."
              placeholderTextColor={colors.textTertiary}
              value={memberSearch}
              onChangeText={setMemberSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
          {filteredMembers.map((m) => (
            <TouchableOpacity key={m._id} style={styles.memberRow} onPress={() => { setSelectedMembers((p) => [...p, m]); setMemberSearch(''); }}>
              <Text style={styles.memberName}>{m.name}</Text>
              <Text style={styles.memberCid}>{m.collegeId}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedMembers.length > 0 && (
          <View style={styles.chipsRow}>
            {selectedMembers.map((a) => (
              <TouchableOpacity key={a._id} style={styles.chip} onPress={() => setSelectedMembers((p) => p.filter((x) => x._id !== a._id))}>
                <Text style={styles.chipText}>{a.name}</Text>
                <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Card>

      <PrimaryButton title={loading ? 'Creating...' : 'Create Project'} onPress={handleSubmit} loading={loading} icon="add-circle-outline" style={{ marginTop: spacing.lg }} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  field: { marginBottom: spacing.lg },
  label: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.medium, marginBottom: spacing.xs },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface3, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, color: colors.textPrimary, fontSize: fontSize.base, paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statusChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.borderSubtle },
  statusChipActive: { backgroundColor: 'rgba(56,189,248,0.18)', borderColor: colors.accentBlue },
  statusText: { color: colors.textTertiary, fontSize: fontSize.sm },
  statusTextActive: { color: colors.accentBlue, fontWeight: fontWeight.semibold },
  memberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface3, borderRadius: radius.sm, marginTop: spacing.xs },
  memberName: { color: colors.textPrimary, fontSize: fontSize.sm },
  memberCid: { color: colors.textTertiary, fontSize: fontSize.xs },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(56,189,248,0.12)', borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipText: { color: colors.accentBlue, fontSize: fontSize.xs, fontWeight: fontWeight.medium },
});
