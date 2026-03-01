/**
 * Inventory screen – list of components/items with navigation to detail/add.
 * Mirrors cicrfrontend/src/pages/Inventory.jsx.
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchInventory } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Badge, Card, EmptyState, LoadingScreen } from '../../components/UI';
import useAuth from '../../hooks/useAuth';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function InventoryScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const isAdmin = ['admin', 'head'].includes((user?.role || '').toLowerCase());
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
      {isAdmin && (
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddInventory')}>
            <Ionicons name="add-circle-outline" size={18} color={colors.white} />
            <Text style={styles.addBtnText}>Add Item</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.myBtn} onPress={() => navigation.navigate('MyInventory')}>
            <Ionicons name="person-outline" size={16} color={colors.accentBlue} />
            <Text style={styles.myBtnText}>My Items</Text>
          </TouchableOpacity>
        </View>
      )}
      {!isAdmin && (
        <TouchableOpacity style={[styles.myBtn, { alignSelf: 'flex-end', marginBottom: spacing.md }]} onPress={() => navigation.navigate('MyInventory')}>
          <Ionicons name="person-outline" size={16} color={colors.accentBlue} />
          <Text style={styles.myBtnText}>My Items</Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accentBlue} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={<EmptyState icon="cube-outline" title="No inventory items" />}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('InventoryDetail', { id: item._id })}>
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
          </TouchableOpacity>
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
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.accentBlue, borderRadius: radius.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
  },
  addBtnText: { color: colors.white, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  myBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.accentBlue, borderRadius: radius.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
  },
  myBtnText: { color: colors.accentBlue, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
});
