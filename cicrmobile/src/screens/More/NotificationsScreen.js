/**
 * Notifications screen
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Card, EmptyState, LoadingScreen } from '../../components/UI';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

const timeAgo = (v) => {
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchNotifications();
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    } catch {
      // silent
    }
  };

  const handleReadAll = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // silent
    }
  };

  if (loading) return <LoadingScreen />;

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <ScreenWrapper title="Notifications" subtitle={unread > 0 ? `${unread} unread` : 'All caught up'} icon="notifications-outline" scrollable={false}>
      {unread > 0 && (
        <TouchableOpacity style={styles.readAllBtn} onPress={handleReadAll}>
          <Ionicons name="checkmark-done-outline" size={16} color={colors.accentBlue} />
          <Text style={styles.readAllText}>Mark all as read</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accentBlue} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={<EmptyState icon="notifications-off-outline" title="No notifications" />}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => !item.read && handleRead(item._id)} activeOpacity={0.7}>
            <Card style={[styles.card, !item.read && styles.unreadCard]}>
              <View style={styles.row}>
                <View style={[styles.dot, item.read && styles.dotRead]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.message}>{item.message || item.title}</Text>
                  <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  readAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
    marginBottom: spacing.md,
  },
  readAllText: { color: colors.accentBlue, fontSize: fontSize.sm },
  card: { marginBottom: spacing.sm },
  unreadCard: { borderColor: colors.accentBlue + '30' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentBlue, marginTop: 6 },
  dotRead: { backgroundColor: colors.textTertiary, opacity: 0.3 },
  message: { color: colors.textPrimary, fontSize: fontSize.sm },
  time: { color: colors.textTertiary, fontSize: fontSize.xs, marginTop: 2 },
});
