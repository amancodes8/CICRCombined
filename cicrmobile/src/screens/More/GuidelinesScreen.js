/**
 * Guidelines screen – club rules and guidelines.
 * Mirrors cicrfrontend/src/pages/Guidelines.jsx.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Card } from '../../components/UI';
import { colors, fontSize, fontWeight, spacing, radius } from '../../theme';

const SECTIONS = [
  {
    icon: 'shield-checkmark-outline',
    title: 'Code of Conduct',
    color: colors.blue,
    items: [
      'Be respectful and professional in all interactions',
      'No harassment, discrimination, or bullying',
      'Keep discussions constructive and inclusive',
      'Respect intellectual property and give proper credit',
    ],
  },
  {
    icon: 'git-branch-outline',
    title: 'Project Guidelines',
    color: colors.emerald,
    items: [
      'All projects must be approved by a Team Lead or Admin',
      'Keep project descriptions and progress updated regularly',
      'Use meaningful commit messages and branch naming',
      'Document your work for future members',
    ],
  },
  {
    icon: 'chatbubbles-outline',
    title: 'Communication',
    color: colors.purple,
    items: [
      'Use the official communication channels for club-related discussions',
      'Tag relevant people when seeking help or feedback',
      'Avoid spamming or off-topic messages in official channels',
      'Respond to messages and tasks in a timely manner',
    ],
  },
  {
    icon: 'calendar-outline',
    title: 'Meetings & Events',
    color: colors.amber,
    items: [
      'Attend scheduled meetings or notify in advance if unable',
      'Be punctual and prepared for meetings',
      'Participate actively in events and workshops',
      'Help organize and volunteer for club events',
    ],
  },
  {
    icon: 'cube-outline',
    title: 'Inventory & Resources',
    color: colors.cyan,
    items: [
      'Handle borrowed equipment with care',
      'Return items on time and in good condition',
      'Report damaged or lost items immediately',
      'Do not remove items without proper check-out',
    ],
  },
  {
    icon: 'warning-outline',
    title: 'Warnings & Actions',
    color: colors.rose,
    items: [
      'Violations may result in warnings from admins',
      'Accumulating warnings can lead to restricted access',
      'Serious violations may result in removal from the club',
      'All actions are logged for transparency',
    ],
  },
];

export default function GuidelinesScreen() {
  return (
    <ScreenWrapper title="Guidelines" subtitle="Club rules & expectations" icon="book-outline">
      {SECTIONS.map((section) => (
        <Card key={section.title} style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: section.color + '18' }]}>
              <Ionicons name={section.icon} size={20} color={section.color} />
            </View>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
          {section.items.map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <Ionicons name="checkmark-circle" size={16} color={section.color} style={{ marginTop: 2 }} />
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}
        </Card>
      ))}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  iconCircle: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  itemRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, paddingLeft: spacing.xs },
  itemText: { color: colors.textSecondary, fontSize: fontSize.sm, flex: 1, lineHeight: 20 },
});
