/**
 * Schedule Meeting screen – create a new meeting.
 * Mirrors cicrfrontend/src/pages/ScheduleMeeting.jsx.
 */
import { useCallback, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { scheduleMeeting, fetchDirectoryMembers } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Card, PrimaryButton } from '../../components/UI';
import useAuth from '../../hooks/useAuth';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';
import { useEffect } from 'react';

function InputField({ icon, label, value, onChangeText, placeholder, multiline, keyboardType }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <Ionicons name={icon} size={16} color={colors.textTertiary} style={{ marginRight: spacing.sm }} />
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

export default function ScheduleMeetingScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    link: '',
    attendeeSearch: '',
  });
  const [selectedAttendees, setSelectedAttendees] = useState([]);

  const set = useCallback((key, val) => setForm((p) => ({ ...p, [key]: val })), []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchDirectoryMembers();
        const list = Array.isArray(res.data) ? res.data : res.data?.result || [];
        setMembers(list);
      } catch { /* silent */ }
    })();
  }, []);

  const filteredMembers = members.filter((m) => {
    if (!form.attendeeSearch.trim()) return false;
    const q = form.attendeeSearch.toLowerCase();
    return (
      (m.name || '').toLowerCase().includes(q) ||
      (m.collegeId || '').toLowerCase().includes(q)
    ) && !selectedAttendees.find((a) => a._id === m._id);
  }).slice(0, 5);

  const handleSubmit = useCallback(async () => {
    if (!form.title.trim()) return Alert.alert('Error', 'Title is required.');
    if (!form.date.trim()) return Alert.alert('Error', 'Date is required (YYYY-MM-DD).');

    setLoading(true);
    try {
      const dateStr = form.date.trim() + (form.time.trim() ? `T${form.time.trim()}` : 'T09:00');
      await scheduleMeeting({
        title: form.title.trim(),
        description: form.description.trim(),
        date: new Date(dateStr).toISOString(),
        link: form.link.trim(),
        attendees: selectedAttendees.map((a) => a._id),
      });
      Alert.alert('Success', 'Meeting scheduled!');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to schedule meeting.');
    } finally {
      setLoading(false);
    }
  }, [form, selectedAttendees, navigation]);

  return (
    <ScreenWrapper title="Schedule Meeting" subtitle="Create a new meeting" icon="calendar-outline">
      <Card style={styles.card}>
        <InputField icon="text-outline" label="Title" value={form.title} onChangeText={(v) => set('title', v)} placeholder="Meeting title" />
        <InputField icon="document-text-outline" label="Description" value={form.description} onChangeText={(v) => set('description', v)} placeholder="What's this meeting about?" multiline />
        <InputField icon="calendar-outline" label="Date (YYYY-MM-DD)" value={form.date} onChangeText={(v) => set('date', v)} placeholder="2026-03-15" keyboardType="numbers-and-punctuation" />
        <InputField icon="time-outline" label="Time (HH:MM)" value={form.time} onChangeText={(v) => set('time', v)} placeholder="14:00" keyboardType="numbers-and-punctuation" />
        <InputField icon="link-outline" label="Meeting Link" value={form.link} onChangeText={(v) => set('link', v)} placeholder="https://meet.google.com/..." keyboardType="url" />

        {/* Attendee search */}
        <View style={styles.field}>
          <Text style={styles.label}>Add Attendees</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="people-outline" size={16} color={colors.textTertiary} style={{ marginRight: spacing.sm }} />
            <TextInput
              style={styles.input}
              placeholder="Search by name or college ID"
              placeholderTextColor={colors.textTertiary}
              value={form.attendeeSearch}
              onChangeText={(v) => set('attendeeSearch', v)}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
          {filteredMembers.map((m) => (
            <TouchableOpacity key={m._id} style={styles.memberRow} onPress={() => {
              setSelectedAttendees((p) => [...p, m]);
              set('attendeeSearch', '');
            }}>
              <Text style={styles.memberName}>{m.name}</Text>
              <Text style={styles.memberCid}>{m.collegeId}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedAttendees.length > 0 && (
          <View style={styles.chipsRow}>
            {selectedAttendees.map((a) => (
              <TouchableOpacity key={a._id} style={styles.chip} onPress={() => setSelectedAttendees((p) => p.filter((x) => x._id !== a._id))}>
                <Text style={styles.chipText}>{a.name}</Text>
                <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Card>

      <PrimaryButton title={loading ? 'Scheduling...' : 'Schedule Meeting'} onPress={handleSubmit} loading={loading} icon="add-circle-outline" style={{ marginTop: spacing.lg }} />
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
  input: {
    flex: 1, color: colors.textPrimary, fontSize: fontSize.base,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
  },
  memberRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    backgroundColor: colors.surface3, borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
  memberName: { color: colors.textPrimary, fontSize: fontSize.sm },
  memberCid: { color: colors.textTertiary, fontSize: fontSize.xs },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(56,189,248,0.12)', borderRadius: radius.full,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  chipText: { color: colors.accentBlue, fontSize: fontSize.xs, fontWeight: fontWeight.medium },
});
