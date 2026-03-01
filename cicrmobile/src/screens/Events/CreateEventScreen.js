/**
 * Create Event screen – admin-only event creation form.
 */
import { useState } from 'react';
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
import { createEvent } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Card, PrimaryButton } from '../../components/UI';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const TYPES = ['Hackathon', 'Workshop', 'Seminar', 'Competition', 'Meeting', 'Other'];

export default function CreateEventScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('Workshop');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return Alert.alert('Error', 'Title is required.');
    setSaving(true);
    try {
      await createEvent({
        title: title.trim(),
        description: description.trim(),
        type,
        location: location.trim(),
        startTime: startDate || undefined,
        endTime: endDate || undefined,
      });
      Alert.alert('Success', 'Event created!');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to create event.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenWrapper title="Create Event" icon="calendar-outline">
      <Card style={styles.card}>
        <Text style={styles.label}>Title *</Text>
        <TextInput style={styles.input} placeholder="Event title" placeholderTextColor={colors.textTertiary} value={title} onChangeText={setTitle} />

        <Text style={styles.label}>Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          {TYPES.map((t) => (
            <TouchableOpacity key={t} style={[styles.chip, type === t && styles.chipActive]} onPress={() => setType(t)}>
              <Text style={[styles.chipText, type === t && styles.chipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>Location</Text>
        <TextInput style={styles.input} placeholder="Location" placeholderTextColor={colors.textTertiary} value={location} onChangeText={setLocation} />

        <Text style={styles.label}>Start Date (YYYY-MM-DD)</Text>
        <TextInput style={styles.input} placeholder="2025-01-15" placeholderTextColor={colors.textTertiary} value={startDate} onChangeText={setStartDate} />

        <Text style={styles.label}>End Date (YYYY-MM-DD)</Text>
        <TextInput style={styles.input} placeholder="2025-01-16" placeholderTextColor={colors.textTertiary} value={endDate} onChangeText={setEndDate} />

        <Text style={styles.label}>Description</Text>
        <TextInput style={[styles.input, styles.textArea]} placeholder="Event description..." placeholderTextColor={colors.textTertiary} value={description} onChangeText={setDescription} multiline />

        <PrimaryButton title={saving ? 'Creating…' : 'Create Event'} onPress={handleSubmit} icon="add-circle-outline" disabled={saving} style={{ marginTop: spacing.md }} />
      </Card>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  label: { color: colors.textTertiary, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    backgroundColor: colors.surface3, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderSubtle,
    color: colors.textPrimary, fontSize: fontSize.base, paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.surface3, marginRight: spacing.sm },
  chipActive: { backgroundColor: colors.accentBlue },
  chipText: { color: colors.textTertiary, fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  chipTextActive: { color: colors.white },
});
