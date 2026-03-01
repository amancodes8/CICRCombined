/**
 * Admin Panel screen – simplified for mobile.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Card } from '../../components/UI';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

export default function AdminPanelScreen() {
  return (
    <ScreenWrapper title="Admin Panel" subtitle="Management tools" icon="settings-outline">
      <Card style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="information-circle-outline" size={24} color={colors.accentBlue} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.title}>Admin features</Text>
            <Text style={styles.desc}>
              Full admin management (user approval, audit logs, invite codes, etc.) is available on the web dashboard for the best experience.
            </Text>
          </View>
        </View>
      </Card>

      <Card style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="globe-outline" size={24} color={colors.purple} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.title}>Web Dashboard</Text>
            <Text style={styles.desc}>Visit the CICR Connect web app for full admin capabilities including user management, audit logs, and system configuration.</Text>
          </View>
        </View>
      </Card>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { color: colors.textPrimary, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  desc: { color: colors.textTertiary, fontSize: fontSize.sm, marginTop: spacing.xs, lineHeight: 20 },
});
