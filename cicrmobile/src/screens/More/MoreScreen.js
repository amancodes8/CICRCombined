/**
 * More screen – hub linking to secondary features (Inventory, Learning, Programs, Members, etc.)
 * Mirrors the web app's sidebar navigation for features not in bottom tabs.
 */
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Card } from '../../components/UI';
import useAuth from '../../hooks/useAuth';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const MENU_ITEMS = [
  { key: 'Members', icon: 'people-outline', label: 'Members', color: colors.blue, desc: 'View team directory' },
  { key: 'Communication', icon: 'chatbox-ellipses-outline', label: 'Communication', color: colors.cyan, desc: 'Club messaging channel' },
  { key: 'Inventory', icon: 'cube-outline', label: 'Inventory', color: colors.amber, desc: 'Component tracking' },
  { key: 'LearningHub', icon: 'school-outline', label: 'Learning Hub', color: colors.emerald, desc: 'Tracks & submissions' },
  { key: 'ProgramsHub', icon: 'trophy-outline', label: 'Programs Hub', color: colors.purple, desc: 'Quests & badges' },
  { key: 'Hierarchy', icon: 'git-branch-outline', label: 'Tasks', color: colors.cyan, desc: 'Task management' },
  { key: 'AIChat', icon: 'sparkles-outline', label: 'AI Assistant', color: colors.accentBlue, desc: 'Ask about CICR' },
  { key: 'Guidelines', icon: 'book-outline', label: 'Guidelines', color: colors.rose, desc: 'Club rules & policies' },
  { key: 'Notifications', icon: 'notifications-outline', label: 'Notifications', color: colors.rose, desc: 'Your alerts' },
];

const ADMIN_ITEMS = [
  { key: 'AdminPanel', icon: 'settings-outline', label: 'Admin Panel', color: colors.amber, desc: 'User & system management' },
];

export default function MoreScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const isAdmin = ['admin', 'head'].includes((user?.role || '').toLowerCase());

  const items = isAdmin ? [...MENU_ITEMS, ...ADMIN_ITEMS] : MENU_ITEMS;

  return (
    <ScreenWrapper title="More" subtitle="All features" icon="apps-outline">
      {items.map((item) => (
        <TouchableOpacity key={item.key} activeOpacity={0.7} onPress={() => navigation.navigate(item.key)}>
          <Card style={styles.menuCard}>
            <View style={styles.menuRow}>
              <View style={[styles.iconCircle, { backgroundColor: item.color + '18' }]}>
                <Ionicons name={item.icon} size={22} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuDesc}>{item.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </View>
          </Card>
        </TouchableOpacity>
      ))}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  menuCard: { marginBottom: spacing.sm },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { color: colors.textPrimary, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  menuDesc: { color: colors.textTertiary, fontSize: fontSize.xs, marginTop: 1 },
});
