/**
 * Events screen – list & details of events.
 * Mirrors cicrfrontend/src/pages/Events.jsx.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchEvents } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Badge, Card, EmptyState, LoadingScreen } from '../../components/UI';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const fmtDate = (v) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? 'TBD' : d.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

export default function EventsScreen() {
  const navigation = useNavigation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchEvents();
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingScreen />;

  return (
    <ScreenWrapper title="Events" subtitle={`${events.length} events`} icon="calendar-outline" scrollable={false}>
      <FlatList
        data={events}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accentBlue} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={<EmptyState icon="calendar-outline" title="No events yet" subtitle="Check back later" />}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('EventDetails', { id: item._id })}>
            <Card style={styles.eventCard}>
              <View style={styles.dateStrip}>
                <Text style={styles.dateStripDay}>{new Date(item.date || item.startDate).getDate()}</Text>
                <Text style={styles.dateStripMonth}>
                  {new Date(item.date || item.startDate).toLocaleDateString([], { month: 'short' }).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle} numberOfLines={1}>{item.title || item.name}</Text>
                {item.description ? <Text style={styles.eventDesc} numberOfLines={2}>{item.description}</Text> : null}
                <View style={styles.eventMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={13} color={colors.textTertiary} />
                    <Text style={styles.metaText}>{fmtDate(item.date || item.startDate)}</Text>
                  </View>
                  {item.location && (
                    <View style={styles.metaItem}>
                      <Ionicons name="location-outline" size={13} color={colors.textTertiary} />
                      <Text style={styles.metaText}>{item.location}</Text>
                    </View>
                  )}
                </View>
                {item.status && <Badge label={item.status} style={{ marginTop: spacing.sm }} />}
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  eventCard: { marginBottom: spacing.md, flexDirection: 'row', gap: spacing.md },
  dateStrip: {
    width: 50,
    height: 58,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(167,139,250,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateStripDay: { color: colors.purple, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  dateStripMonth: { color: colors.purple, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  eventTitle: { color: colors.textPrimary, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  eventDesc: { color: colors.textTertiary, fontSize: fontSize.sm, marginTop: 2 },
  eventMeta: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: colors.textTertiary, fontSize: fontSize.xs },
});
