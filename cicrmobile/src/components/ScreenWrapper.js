/**
 * Page wrapper with consistent header that mirrors the web app's PageHeader component.
 */
import { Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing } from '../theme';

export default function ScreenWrapper({ title, subtitle, icon, children, scrollable = true, noPadding }) {
  const header = (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {icon && (
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={22} color={colors.accentBlue} />
          </View>
        )}
        <View>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
    </View>
  );

  const content = scrollable ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, noPadding && { padding: 0 }]}
      showsVerticalScrollIndicator={false}
    >
      {header}
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, noPadding && { padding: 0 }, { flex: 1 }]}>
      {header}
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.surface0} />
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface0,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing['5xl'] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(56,189,248,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  subtitle: { color: colors.textTertiary, fontSize: fontSize.sm, marginTop: 2 },
});
