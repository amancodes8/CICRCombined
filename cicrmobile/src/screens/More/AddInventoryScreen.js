/**
 * Add Inventory Item screen – form to add new inventory.
 * Mirrors cicrfrontend/src/pages/AddComponent.jsx.
 */
import { useCallback, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { addInventoryItem } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Card, PrimaryButton } from '../../components/UI';
import { colors, fontSize, fontWeight, spacing, radius } from '../../theme';

function InputField({ icon, label, value, onChangeText, placeholder, keyboardType, multiline }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        {icon && <Ionicons name={icon} size={16} color={colors.textTertiary} style={{ marginRight: spacing.sm }} />}
        <TextInput
          style={[styles.input, multiline && { minHeight: 70, textAlignVertical: 'top' }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          value={value}
          onChangeText={onChangeText}
          autoCorrect={false}
          autoCapitalize="none"
          keyboardType={keyboardType || 'default'}
          multiline={multiline}
        />
      </View>
    </View>
  );
}

export default function AddInventoryScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    quantity: '',
    location: '',
  });

  const set = useCallback((key, val) => setForm((p) => ({ ...p, [key]: val })), []);

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim()) return Alert.alert('Error', 'Name is required.');
    setLoading(true);
    try {
      await addInventoryItem({
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        quantity: Number(form.quantity) || 0,
        location: form.location.trim(),
      });
      Alert.alert('Success', 'Item added to inventory!');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to add item.');
    } finally {
      setLoading(false);
    }
  }, [form, navigation]);

  return (
    <ScreenWrapper title="Add Item" subtitle="New inventory component" icon="add-circle-outline">
      <Card style={styles.card}>
        <InputField icon="text-outline" label="Name" value={form.name} onChangeText={(v) => set('name', v)} placeholder="Arduino Uno" />
        <InputField icon="document-text-outline" label="Description" value={form.description} onChangeText={(v) => set('description', v)} placeholder="Description (optional)" multiline />
        <InputField icon="pricetag-outline" label="Category" value={form.category} onChangeText={(v) => set('category', v)} placeholder="Microcontroller, Sensor, etc." />
        <InputField icon="layers-outline" label="Quantity" value={form.quantity} onChangeText={(v) => set('quantity', v)} placeholder="10" keyboardType="numeric" />
        <InputField icon="location-outline" label="Location" value={form.location} onChangeText={(v) => set('location', v)} placeholder="Lab A, Shelf 3" />
      </Card>

      <PrimaryButton title={loading ? 'Adding...' : 'Add Item'} onPress={handleSubmit} loading={loading} icon="add-circle-outline" style={{ marginTop: spacing.lg }} />
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
});
