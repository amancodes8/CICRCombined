/**
 * Inventory screen – list of components/items.
 * Mirrors cicrfrontend/src/pages/Inventory.jsx.
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchInventory } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Badge, Card, EmptyState, LoadingScreen } from '../../components/UI';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

export default function InventoryScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchInventory();
      setItems(Array.isArray(res.data) ? res.data : []);
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
    <ScreenWrapper title="Inventory" subtitle={`${items.length} items`} icon="cube-outline" scrollable={false}>
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accentBlue} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={<EmptyState icon="cube-outline" title="No inventory items" />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconWrap}>
                <Ionicons name="hardware-chip-outline" size={20} color={colors.amber} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name || item.componentName}</Text>
                {item.category && <Text style={styles.category}>{item.category}</Text>}
              </View>
              <View style={styles.stockBadge}>
                <Text style={styles.stockText}>{item.quantity ?? item.stock ?? 0}</Text>
                <Text style={styles.stockLabel}>in stock</Text>
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
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(251,191,36,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: colors.textPrimary, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  category: { color: colors.textTertiary, fontSize: fontSize.xs, marginTop: 1 },
  stockBadge: { alignItems: 'center' },
  stockText: { color: colors.emerald, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  stockLabel: { color: colors.textTertiary, fontSize: fontSize.xs },
});
