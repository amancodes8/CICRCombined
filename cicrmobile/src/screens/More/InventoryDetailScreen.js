/**
 * Inventory Detail screen – single item view with issue/adjust/edit actions.
 * Mirrors cicrfrontend/src/pages/InventoryDetail.jsx.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchInventory, issueInventoryItem, adjustInventoryStockById, deleteInventoryItem } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Badge, Card, EmptyState, LoadingScreen, PrimaryButton } from '../../components/UI';
import useAuth from '../../hooks/useAuth';
import { colors, fontSize, fontWeight, spacing, radius } from '../../theme';
import { useNavigation } from '@react-navigation/native';

export default function InventoryDetailScreen({ route }) {
  const { itemId } = route.params || {};
  const { user } = useAuth();
  const navigation = useNavigation();
  const isAdmin = ['admin', 'head'].includes((user?.role || '').toLowerCase());
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [issueTarget, setIssueTarget] = useState('');
  const [issueQty, setIssueQty] = useState('1');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchInventory();
      const list = Array.isArray(res.data) ? res.data : res.data?.result || [];
      const found = list.find((i) => i._id === itemId);
      setItem(found || null);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [itemId]);

  useEffect(() => { load(); }, [load]);

  const handleIssue = useCallback(async () => {
    if (!issueTarget.trim()) return Alert.alert('Error', 'Enter a college ID to issue to.');
    setBusy(true);
    try {
      await issueInventoryItem({ itemId, issuedTo: issueTarget.trim(), quantity: Number(issueQty) || 1 });
      Alert.alert('Success', 'Item issued!');
      setIssueTarget('');
      setIssueQty('1');
      load();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Issue failed.');
    } finally { setBusy(false); }
  }, [issueTarget, issueQty, itemId, load]);

  const handleAdjust = useCallback(async () => {
    if (!adjustQty) return Alert.alert('Error', 'Enter adjustment quantity.');
    setBusy(true);
    try {
      await adjustInventoryStockById(itemId, { quantity: Number(adjustQty), reason: adjustReason.trim() });
      Alert.alert('Success', 'Stock adjusted!');
      setAdjustQty('');
      setAdjustReason('');
      load();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Adjust failed.');
    } finally { setBusy(false); }
  }, [adjustQty, adjustReason, itemId, load]);

  const handleDelete = useCallback(() => {
    Alert.alert('Delete item?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteInventoryItem(itemId);
            Alert.alert('Deleted', 'Item removed.');
            navigation.goBack();
          } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Delete failed.');
          }
        }
      },
    ]);
  }, [itemId, navigation]);

  if (loading) return <LoadingScreen />;
  if (!item) return <ScreenWrapper title="Item"><EmptyState icon="cube-outline" title="Item not found" /></ScreenWrapper>;

  return (
    <ScreenWrapper title={item.name} subtitle={item.category || 'Uncategorized'} icon="cube-outline">
      <Card style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{item.name}</Text>
        </View>
        {item.description && (
          <View style={styles.row}>
            <Text style={styles.label}>Description</Text>
            <Text style={styles.value}>{item.description}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Category</Text>
          <Badge label={item.category || 'General'} />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Stock</Text>
          <Text style={[styles.value, { color: (item.quantity ?? item.stock ?? 0) > 0 ? colors.emerald : colors.danger }]}>
            {item.quantity ?? item.stock ?? 0}
          </Text>
        </View>
        {item.location && (
          <View style={styles.row}>
            <Text style={styles.label}>Location</Text>
            <Text style={styles.value}>{item.location}</Text>
          </View>
        )}
      </Card>

      {/* Issue to member */}
      {isAdmin && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Issue to Member</Text>
          <View style={styles.inputWrap}>
            <TextInput style={styles.input} placeholder="College ID" placeholderTextColor={colors.textTertiary} value={issueTarget} onChangeText={setIssueTarget} autoCapitalize="none" />
          </View>
          <View style={[styles.inputWrap, { marginTop: spacing.sm }]}>
            <TextInput style={styles.input} placeholder="Quantity" placeholderTextColor={colors.textTertiary} value={issueQty} onChangeText={setIssueQty} keyboardType="numeric" />
          </View>
          <PrimaryButton title={busy ? 'Issuing...' : 'Issue'} onPress={handleIssue} loading={busy} style={{ marginTop: spacing.md }} />
        </Card>
      )}

      {/* Adjust stock */}
      {isAdmin && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Adjust Stock</Text>
          <View style={styles.inputWrap}>
            <TextInput style={styles.input} placeholder="Quantity (+/-)" placeholderTextColor={colors.textTertiary} value={adjustQty} onChangeText={setAdjustQty} keyboardType="numeric" />
          </View>
          <View style={[styles.inputWrap, { marginTop: spacing.sm }]}>
            <TextInput style={styles.input} placeholder="Reason (optional)" placeholderTextColor={colors.textTertiary} value={adjustReason} onChangeText={setAdjustReason} />
          </View>
          <PrimaryButton title={busy ? 'Adjusting...' : 'Adjust'} onPress={handleAdjust} loading={busy} style={{ marginTop: spacing.md }} />
        </Card>
      )}

      {/* Issue history */}
      {item.issueHistory?.length > 0 && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Issue History</Text>
          {item.issueHistory.map((h, i) => (
            <View key={i} style={styles.historyRow}>
              <Ionicons name="person-outline" size={14} color={colors.textTertiary} />
              <Text style={styles.historyText}>
                {h.issuedTo?.name || h.issuedTo || 'Unknown'} — qty {h.quantity || 1}
              </Text>
              <Text style={styles.historyDate}>{new Date(h.issuedAt || h.createdAt).toLocaleDateString()}</Text>
            </View>
          ))}
        </Card>
      )}

      {isAdmin && (
        <PrimaryButton title="Delete Item" onPress={handleDelete} icon="trash-outline" style={{ marginTop: spacing.md, backgroundColor: colors.danger }} />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  label: { color: colors.textTertiary, fontSize: fontSize.sm },
  value: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  sectionTitle: { color: colors.textPrimary, fontSize: fontSize.base, fontWeight: fontWeight.semibold, marginBottom: spacing.md },
  inputWrap: { backgroundColor: colors.surface3, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderSubtle, paddingHorizontal: spacing.md },
  input: { color: colors.textPrimary, fontSize: fontSize.base, paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  historyText: { color: colors.textSecondary, fontSize: fontSize.sm, flex: 1 },
  historyDate: { color: colors.textTertiary, fontSize: fontSize.xs },
});
