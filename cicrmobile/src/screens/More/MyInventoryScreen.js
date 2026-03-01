/**
 * My Inventory screen – items issued to the current user.
 * Mirrors cicrfrontend/src/pages/MyInventory.jsx.
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchInventory } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Card, EmptyState, LoadingScreen } from '../../components/UI';
import useAuth from '../../hooks/useAuth';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

export default function MyInventoryScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchInventory();
      const all = Array.isArray(res.data) ? res.data : res.data?.result || [];
      // Filter items that have been issued to current user
      const mine = [];
      all.forEach((item) => {
        (item.issueHistory || []).forEach((h) => {
          const issuedId = h.issuedTo?._id || h.issuedTo;
          const issuedCid = h.issuedTo?.collegeId;
          if (issuedId === user?._id || issuedCid === user?.collegeId) {
            mine.push({ ...item, issuedQty: h.quantity || 1, issuedAt: h.issuedAt || h.createdAt });
          }
        });
      });
      setItems(mine);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingScreen />;

  return (
    <ScreenWrapper title="My Items" subtitle={`${items.length} issued`} icon="cube-outline" scrollable={false}>
      <FlatList
        data={items}
        keyExtractor={(item, i) => `${item._id}-${i}`}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accentBlue} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={<EmptyState icon="cube-outline" title="No items issued to you" subtitle="Request items from an admin" />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconWrap}>
                <Ionicons name="cube" size={20} color={colors.amber} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{item.category || 'Uncategorized'} · Qty: {item.issuedQty}</Text>
                {item.issuedAt && <Text style={styles.date}>Issued: {new Date(item.issuedAt).toLocaleDateString()}</Text>}
              </View>
            </View>
          </Card>
        )}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(251,191,36,0.12)', alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.textPrimary, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  meta: { color: colors.textTertiary, fontSize: fontSize.xs, marginTop: 2 },
  date: { color: colors.textTertiary, fontSize: fontSize.xs, marginTop: 2 },
});
