/**
 * Event details screen
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchEventById } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Badge, Card, LoadingScreen, SectionHeader } from '../../components/UI';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

const fmtDate = (v) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? 'TBD' : d.toLocaleDateString([], { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
};

export default function EventDetailsScreen({ route }) {
  const { id } = route.params;
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetchEventById(id);
      setEvent(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading || !event) return <LoadingScreen />;

  return (
    <ScreenWrapper title={event.title || event.name} icon="calendar-outline">
      <Card style={styles.card}>
        {event.status && <Badge label={event.status} />}
        <View style={styles.row}>
          <Ionicons name="calendar-outline" size={16} color={colors.accentBlue} />
          <Text style={styles.value}>{fmtDate(event.date || event.startDate)}</Text>
        </View>
        {event.location && (
          <View style={styles.row}>
            <Ionicons name="location-outline" size={16} color={colors.accentBlue} />
            <Text style={styles.value}>{event.location}</Text>
          </View>
        )}
      </Card>

      {event.description && (
        <Card style={styles.card}>
          <SectionHeader title="About" icon="information-circle-outline" />
          <Text style={styles.body}>{event.description}</Text>
        </Card>
      )}

      {event.registrations?.length > 0 && (
        <Card style={styles.card}>
          <SectionHeader title="Registrations" icon="people-outline" />
          <Text style={styles.value}>{event.registrations.length} registered</Text>
        </Card>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  value: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  body: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 22 },
});
