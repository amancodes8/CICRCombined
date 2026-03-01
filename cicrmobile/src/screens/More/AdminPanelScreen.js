/**
 * Full Admin Panel screen – user management, invite codes, audit logs, issues, applications.
 * Mirrors cicrfrontend AdminPanel with all tabs.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchMembers, updateUserByAdmin, deleteUser,
  fetchPendingAdminActions, approveAdminAction,
  fetchAuditLogs,
  generateInvite, generatePasswordResetCode,
  broadcastNotification,
  fetchAdminIssues, updateIssueTicket,
  fetchApplications, updateApplication, sendApplicationInvite,
} from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Avatar, Badge, Card, EmptyState, LoadingScreen, PrimaryButton } from '../../components/UI';
import useAuth from '../../hooks/useAuth';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const TABS = [
  { key: 'users', label: 'Users', icon: 'people-outline' },
  { key: 'pending', label: 'Pending', icon: 'hourglass-outline' },
  { key: 'issues', label: 'Issues', icon: 'alert-circle-outline' },
  { key: 'apps', label: 'Applications', icon: 'document-text-outline' },
  { key: 'invite', label: 'Invite', icon: 'mail-outline' },
  { key: 'audit', label: 'Audit', icon: 'list-outline' },
  { key: 'broadcast', label: 'Notify', icon: 'megaphone-outline' },
];

const ROLES = ['member', 'teamLead', 'head', 'admin'];

export default function AdminPanelScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const [users, setUsers] = useState([]);
  const [pendingActions, setPendingActions] = useState([]);
  const [issues, setIssues] = useState([]);
  const [applications, setApplications] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const [inviteResult, setInviteResult] = useState(null);
  const [inviteMaxUses, setInviteMaxUses] = useState('1');
  const [inviteExpDays, setInviteExpDays] = useState('7');

  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');

  const load = useCallback(async () => {
    try {
      if (tab === 'users') {
        const res = await fetchMembers();
        setUsers(Array.isArray(res.data) ? res.data : res.data?.result || []);
      } else if (tab === 'pending') {
        const res = await fetchPendingAdminActions();
        setPendingActions(Array.isArray(res.data) ? res.data : res.data?.result || []);
      } else if (tab === 'issues') {
        const res = await fetchAdminIssues();
        setIssues(Array.isArray(res.data) ? res.data : res.data?.result || []);
      } else if (tab === 'apps') {
        const res = await fetchApplications();
        setApplications(Array.isArray(res.data) ? res.data : res.data?.result || []);
      } else if (tab === 'audit') {
        const res = await fetchAuditLogs();
        setAuditLogs(Array.isArray(res.data) ? res.data : res.data?.result || res.data?.logs || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [tab]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const handleUserAction = (u, action) => {
    if (action === 'approve') {
      Alert.alert('Approve?', `Approve ${u.name}?`, [
        { text: 'Cancel' },
        { text: 'Approve', onPress: async () => { await updateUserByAdmin(u._id, { approvalStatus: 'Approved', isVerified: true }); load(); } },
      ]);
    } else if (action === 'reject') {
      Alert.alert('Reject?', `Reject ${u.name}?`, [
        { text: 'Cancel' },
        { text: 'Reject', style: 'destructive', onPress: async () => { await updateUserByAdmin(u._id, { approvalStatus: 'Rejected' }); load(); } },
      ]);
    } else if (action === 'delete') {
      Alert.alert('Delete?', `Delete ${u.name}? This can't be undone.`, [
        { text: 'Cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => { await deleteUser(u._id); load(); } },
      ]);
    } else if (action === 'resetPw') {
      (async () => {
        try {
          const res = await generatePasswordResetCode(u._id);
          const code = res.data?.resetCode || res.data?.code || 'Generated';
          Alert.alert('Reset Code', `Code for ${u.name}: ${code}`);
        } catch (err) { Alert.alert('Error', err.response?.data?.message || 'Failed.'); }
      })();
    }
  };

  const handleRoleChange = (u) => {
    const currentIdx = ROLES.indexOf(u.role);
    const nextRole = ROLES[(currentIdx + 1) % ROLES.length];
    Alert.alert('Change Role', `Set ${u.name} to "${nextRole}"?`, [
      { text: 'Cancel' },
      { text: 'Yes', onPress: async () => { await updateUserByAdmin(u._id, { role: nextRole }); load(); } },
    ]);
  };

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter((u) => (u.name || '').toLowerCase().includes(q) || (u.collegeId || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
  }, [users, search]);

  const handleGenInvite = async () => {
    try {
      const res = await generateInvite({ maxUses: Number(inviteMaxUses) || 1, expiresInDays: Number(inviteExpDays) || 7 });
      setInviteResult(res.data);
    } catch (err) { Alert.alert('Error', err.response?.data?.message || 'Failed.'); }
  };

  const handleBroadcast = async () => {
    if (!broadcastTitle.trim()) return Alert.alert('Error', 'Title required.');
    try {
      await broadcastNotification({ title: broadcastTitle.trim(), message: broadcastBody.trim() });
      Alert.alert('Sent', 'Broadcast sent to all users!');
      setBroadcastTitle(''); setBroadcastBody('');
    } catch (err) { Alert.alert('Error', err.response?.data?.message || 'Failed.'); }
  };

  const handleIssueAction = (issue, status) => {
    Alert.alert(`${status}?`, `Mark issue as ${status}?`, [
      { text: 'Cancel' },
      { text: 'Yes', onPress: async () => { await updateIssueTicket(issue._id, { status }); load(); } },
    ]);
  };

  const handleAppAction = (app, status) => {
    (async () => {
      try {
        await updateApplication(app._id, { status });
        if (status === 'Accepted') await sendApplicationInvite(app._id).catch(() => {});
        load();
      } catch (err) { Alert.alert('Error', err.response?.data?.message || 'Failed.'); }
    })();
  };

  const handleApproveAction = (action) => {
    Alert.alert('Approve?', 'Approve this admin action?', [
      { text: 'Cancel' },
      { text: 'Approve', onPress: async () => { await approveAdminAction(action._id); load(); } },
    ]);
  };

  const renderTabContent = () => {
    if (loading) return <LoadingScreen />;

    switch (tab) {
      case 'users':
        return (
          <>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
              <TextInput style={styles.searchInput} placeholder="Search users..." placeholderTextColor={colors.textTertiary} value={search} onChangeText={setSearch} autoCapitalize="none" />
            </View>
            <FlatList
              data={filteredUsers}
              keyExtractor={(u) => u._id}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accentBlue} />}
              contentContainerStyle={{ paddingBottom: 100 }}
              ListEmptyComponent={<EmptyState icon="people-outline" title="No users found" />}
              renderItem={({ item: u }) => (
                <Card style={styles.userCard}>
                  <View style={styles.userRow}>
                    <Avatar name={u.name} size={36} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName}>{u.name}</Text>
                      <Text style={styles.userSub}>{u.collegeId} · {u.email}</Text>
                      <View style={styles.badgeRow}>
                        <Badge label={u.role} tone={u.role === 'admin' ? 'active' : 'planning'} />
                        <Badge label={u.approvalStatus || 'Pending'} tone={u.approvalStatus === 'Approved' ? 'completed' : u.approvalStatus === 'Rejected' ? 'on-hold' : 'awaiting review'} />
                      </View>
                    </View>
                  </View>
                  <View style={styles.actionRow}>
                    {u.approvalStatus !== 'Approved' && (
                      <TouchableOpacity style={styles.actionBtn} onPress={() => handleUserAction(u, 'approve')}>
                        <Ionicons name="checkmark-circle" size={18} color={colors.emerald} />
                      </TouchableOpacity>
                    )}
                    {u.approvalStatus !== 'Rejected' && (
                      <TouchableOpacity style={styles.actionBtn} onPress={() => handleUserAction(u, 'reject')}>
                        <Ionicons name="close-circle" size={18} color={colors.rose} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleRoleChange(u)}>
                      <Ionicons name="swap-horizontal" size={18} color={colors.amber} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleUserAction(u, 'resetPw')}>
                      <Ionicons name="key-outline" size={18} color={colors.purple} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleUserAction(u, 'delete')}>
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </Card>
              )}
            />
          </>
        );

      case 'pending':
        return (
          <FlatList
            data={pendingActions}
            keyExtractor={(a) => a._id}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accentBlue} />}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={<EmptyState icon="checkmark-done-outline" title="No pending actions" />}
            renderItem={({ item: action }) => (
              <Card style={styles.userCard}>
                <Text style={styles.userName}>{action.type || 'Admin Action'}</Text>
                <Text style={styles.userSub}>{action.description || JSON.stringify(action.payload || {}).slice(0, 100)}</Text>
                <Text style={styles.userSub}>By: {action.requestedBy?.name || 'Unknown'}</Text>
                <PrimaryButton title="Approve" onPress={() => handleApproveAction(action)} style={{ marginTop: spacing.sm }} />
              </Card>
            )}
          />
        );

      case 'issues':
        return (
          <FlatList
            data={issues}
            keyExtractor={(i) => i._id}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accentBlue} />}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={<EmptyState icon="alert-circle-outline" title="No issues" />}
            renderItem={({ item: issue }) => (
              <Card style={styles.userCard}>
                <View style={styles.userRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{issue.title || issue.subject}</Text>
                    <Text style={styles.userSub} numberOfLines={2}>{issue.description || issue.message}</Text>
                    <View style={styles.badgeRow}>
                      <Badge label={issue.status || 'Open'} tone={issue.status?.toLowerCase()} />
                      <Badge label={issue.priority || 'Normal'} />
                    </View>
                    <Text style={styles.userSub}>By: {issue.createdBy?.name || issue.user?.name || 'Unknown'}</Text>
                  </View>
                </View>
                <View style={styles.actionRow}>
                  {issue.status !== 'Resolved' && (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleIssueAction(issue, 'Resolved')}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.emerald} />
                      <Text style={[styles.actionLabel, { color: colors.emerald }]}>Resolve</Text>
                    </TouchableOpacity>
                  )}
                  {issue.status !== 'Closed' && (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleIssueAction(issue, 'Closed')}>
                      <Ionicons name="close-circle" size={18} color={colors.rose} />
                      <Text style={[styles.actionLabel, { color: colors.rose }]}>Close</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            )}
          />
        );

      case 'apps':
        return (
          <FlatList
            data={applications}
            keyExtractor={(a) => a._id}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accentBlue} />}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={<EmptyState icon="document-text-outline" title="No applications" />}
            renderItem={({ item: app }) => (
              <Card style={styles.userCard}>
                <Text style={styles.userName}>{app.name || 'Applicant'}</Text>
                <Text style={styles.userSub}>{app.email}</Text>
                <Text style={styles.userSub}>{app.motivation?.slice(0, 120)}</Text>
                <Badge label={app.status || 'Pending'} tone={app.status?.toLowerCase()} />
                <View style={styles.actionRow}>
                  {app.status !== 'Accepted' && (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleAppAction(app, 'Accepted')}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.emerald} />
                      <Text style={[styles.actionLabel, { color: colors.emerald }]}>Accept</Text>
                    </TouchableOpacity>
                  )}
                  {app.status !== 'Rejected' && (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleAppAction(app, 'Rejected')}>
                      <Ionicons name="close-circle" size={18} color={colors.rose} />
                      <Text style={[styles.actionLabel, { color: colors.rose }]}>Reject</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            )}
          />
        );

      case 'invite':
        return (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Generate Invite Code</Text>
            <View style={styles.inputWrap}>
              <TextInput style={styles.inputField} placeholder="Max uses (default: 1)" placeholderTextColor={colors.textTertiary} value={inviteMaxUses} onChangeText={setInviteMaxUses} keyboardType="numeric" />
            </View>
            <View style={[styles.inputWrap, { marginTop: spacing.sm }]}>
              <TextInput style={styles.inputField} placeholder="Expires in days (default: 7)" placeholderTextColor={colors.textTertiary} value={inviteExpDays} onChangeText={setInviteExpDays} keyboardType="numeric" />
            </View>
            <PrimaryButton title="Generate" onPress={handleGenInvite} icon="key-outline" style={{ marginTop: spacing.md }} />
            {inviteResult && (
              <View style={styles.resultBox}>
                <Text style={styles.resultLabel}>Invite Code:</Text>
                <Text selectable style={styles.resultCode}>{inviteResult.code || inviteResult.inviteCode || JSON.stringify(inviteResult)}</Text>
              </View>
            )}
          </Card>
        );

      case 'audit':
        return (
          <FlatList
            data={auditLogs}
            keyExtractor={(l, i) => l._id || String(i)}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accentBlue} />}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={<EmptyState icon="list-outline" title="No audit logs" />}
            renderItem={({ item: log }) => (
              <Card style={styles.logCard}>
                <Text style={styles.logAction}>{log.action}</Text>
                <Text style={styles.logDetail}>{log.details || JSON.stringify(log.metadata || {}).slice(0, 120)}</Text>
                <Text style={styles.logMeta}>{log.performedBy?.name || 'System'} · {new Date(log.createdAt).toLocaleString()}</Text>
              </Card>
            )}
          />
        );

      case 'broadcast':
        return (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Broadcast Notification</Text>
            <View style={styles.inputWrap}>
              <TextInput style={styles.inputField} placeholder="Title" placeholderTextColor={colors.textTertiary} value={broadcastTitle} onChangeText={setBroadcastTitle} />
            </View>
            <View style={[styles.inputWrap, { marginTop: spacing.sm }]}>
              <TextInput style={[styles.inputField, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="Message body" placeholderTextColor={colors.textTertiary} value={broadcastBody} onChangeText={setBroadcastBody} multiline />
            </View>
            <PrimaryButton title="Send Broadcast" onPress={handleBroadcast} icon="megaphone-outline" style={{ marginTop: spacing.md }} />
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <ScreenWrapper title="Admin Panel" subtitle="Management tools" icon="settings-outline" scrollable={false}>
      <View style={styles.tabStrip}>
        <FlatList
          data={TABS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(t) => t.key}
          renderItem={({ item: t }) => (
            <TouchableOpacity style={[styles.tabChip, tab === t.key && styles.tabChipActive]} onPress={() => setTab(t.key)}>
              <Ionicons name={t.icon} size={14} color={tab === t.key ? colors.white : colors.textTertiary} />
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
      <View style={{ flex: 1 }}>{renderTabContent()}</View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  tabStrip: { marginBottom: spacing.md },
  tabChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, backgroundColor: colors.surface3,
    marginRight: spacing.sm,
  },
  tabChipActive: { backgroundColor: colors.accentBlue },
  tabText: { color: colors.textTertiary, fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  tabTextActive: { color: colors.white },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface3, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, marginBottom: spacing.md,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: fontSize.sm, paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm, marginLeft: spacing.sm },
  userCard: { marginBottom: spacing.sm },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  userName: { color: colors.textPrimary, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  userSub: { color: colors.textTertiary, fontSize: fontSize.xs, marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  card: { marginBottom: spacing.md },
  sectionTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.semibold, marginBottom: spacing.md },
  inputWrap: { backgroundColor: colors.surface3, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderSubtle, paddingHorizontal: spacing.md },
  inputField: { color: colors.textPrimary, fontSize: fontSize.base, paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm },
  resultBox: { marginTop: spacing.lg, padding: spacing.md, backgroundColor: 'rgba(52,211,153,0.08)', borderRadius: radius.sm },
  resultLabel: { color: colors.emerald, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  resultCode: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: spacing.xs },
  logCard: { marginBottom: spacing.sm },
  logAction: { color: colors.accentBlue, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  logDetail: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2 },
  logMeta: { color: colors.textTertiary, fontSize: 10, marginTop: spacing.xs },
});
