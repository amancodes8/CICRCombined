/**
 * Profile screen – mirrors cicrfrontend/src/pages/Profile.jsx
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { changePassword, updateProfile } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Avatar, Card, PrimaryButton, SectionHeader } from '../../components/UI';
import useAuth from '../../hooks/useAuth';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function ProfileScreen() {
  const { user, signOut, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', bio: '' });
  const [saving, setSaving] = useState(false);

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({ name: user.name || '', phone: user.phone || '', bio: user.bio || '' });
    }
  }, [user]);

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));
  const setPw = (key, val) => setPwForm((p) => ({ ...p, [key]: val }));

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateProfile(form);
      await refreshUser();
      setEditing(false);
      Alert.alert('Success', 'Profile updated.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Update failed.');
    } finally {
      setSaving(false);
    }
  }, [form, refreshUser]);

  const handleChangePassword = useCallback(async () => {
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      return Alert.alert('Error', 'Passwords do not match.');
    }
    setPwSaving(true);
    try {
      await changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      Alert.alert('Success', 'Password changed.');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Change failed.');
    } finally {
      setPwSaving(false);
    }
  }, [pwForm]);

  return (
    <ScreenWrapper title="Profile" subtitle={user?.role || 'Member'} icon="person-outline">
      {/* Profile Card */}
      <Card style={styles.profileCard}>
        <View style={styles.profileTop}>
          <Avatar name={user?.name} size={64} />
          <View style={{ flex: 1, marginLeft: spacing.lg }}>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            {user?.collegeId && <Text style={styles.userId}>ID: {user.collegeId}</Text>}
          </View>
        </View>
        {user?.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
        <View style={styles.infoGrid}>
          {user?.phone && (
            <View style={styles.infoItem}>
              <Ionicons name="call-outline" size={14} color={colors.textTertiary} />
              <Text style={styles.infoText}>{user.phone}</Text>
            </View>
          )}
          {user?.role && (
            <View style={styles.infoItem}>
              <Ionicons name="shield-outline" size={14} color={colors.textTertiary} />
              <Text style={styles.infoText}>{user.role}</Text>
            </View>
          )}
        </View>
      </Card>

      {/* Edit Profile */}
      <Card style={styles.section}>
        <SectionHeader
          title="Edit Profile"
          icon="create-outline"
          onAction={() => setEditing(!editing)}
          actionLabel={editing ? 'Cancel' : 'Edit'}
        />
        {editing && (
          <>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={(v) => set('name', v)} placeholderTextColor={colors.textTertiary} />
            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={form.phone} onChangeText={(v) => set('phone', v)} placeholderTextColor={colors.textTertiary} keyboardType="phone-pad" />
            <Text style={styles.label}>Bio</Text>
            <TextInput style={[styles.input, { minHeight: 60 }]} value={form.bio} onChangeText={(v) => set('bio', v)} multiline placeholderTextColor={colors.textTertiary} />
            <PrimaryButton title={saving ? 'Saving…' : 'Save Changes'} onPress={handleSave} loading={saving} style={{ marginTop: spacing.md }} />
          </>
        )}
      </Card>

      {/* Change Password */}
      <Card style={styles.section}>
        <SectionHeader title="Change Password" icon="lock-closed-outline" />
        <TextInput style={styles.input} placeholder="Current Password" value={pwForm.currentPassword} onChangeText={(v) => setPw('currentPassword', v)} secureTextEntry placeholderTextColor={colors.textTertiary} />
        <TextInput style={styles.input} placeholder="New Password" value={pwForm.newPassword} onChangeText={(v) => setPw('newPassword', v)} secureTextEntry placeholderTextColor={colors.textTertiary} />
        <TextInput style={styles.input} placeholder="Confirm Password" value={pwForm.confirmPassword} onChangeText={(v) => setPw('confirmPassword', v)} secureTextEntry placeholderTextColor={colors.textTertiary} />
        <PrimaryButton title={pwSaving ? 'Changing…' : 'Change Password'} onPress={handleChangePassword} loading={pwSaving} style={{ marginTop: spacing.md }} />
      </Card>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={() => {
        Alert.alert('Sign Out', 'Are you sure?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Out', style: 'destructive', onPress: signOut },
        ]);
      }}>
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  profileCard: { marginBottom: spacing.md },
  profileTop: { flexDirection: 'row', alignItems: 'center' },
  userName: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  userEmail: { color: colors.textSecondary, fontSize: fontSize.sm },
  userId: { color: colors.textTertiary, fontSize: fontSize.xs, marginTop: 2 },
  bio: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: spacing.md, lineHeight: 20 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.md },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  infoText: { color: colors.textSecondary, fontSize: fontSize.sm },
  section: { marginBottom: spacing.md },
  label: { color: colors.textTertiary, fontSize: fontSize.xs, fontWeight: fontWeight.medium, marginTop: spacing.sm, marginBottom: 4 },
  input: {
    backgroundColor: colors.surface3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    color: colors.textPrimary,
    fontSize: fontSize.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.danger + '30',
    backgroundColor: colors.dangerBg,
  },
  signOutText: { color: colors.danger, fontSize: fontSize.base, fontWeight: fontWeight.medium },
});
