/**
 * Communication screen – real-time chat stream.
 * Mirrors cicrfrontend/src/pages/Communication.jsx.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
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
  createCommunicationMessage,
  deleteCommunicationMessage,
  fetchCommunicationMessages,
} from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Avatar, EmptyState, LoadingScreen } from '../../components/UI';
import useAuth from '../../hooks/useAuth';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const POLL_INTERVAL = 5000;

const timeLabel = (v) => {
  const d = new Date(v);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const dayLabel = (v) => {
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const y = new Date(); y.setDate(now.getDate() - 1);
  const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, now)) return 'Today';
  if (same(d, y)) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' });
};

const dayKey = (v) => {
  const d = new Date(v);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export default function CommunicationScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);
  const pollRef = useRef(null);

  const isAdmin = ['admin', 'head', 'strictadmin'].includes((user?.role || '').toLowerCase());

  const load = useCallback(async (silent = false) => {
    try {
      const res = await fetchCommunicationMessages({ limit: 100, conversationId: 'admin-stream' });
      const items = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.items) ? res.data.items : [];
      setMessages(items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
    } catch { /* silent */ }
    finally {
      if (!silent) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    load();
    pollRef.current = setInterval(() => load(true), POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [load]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await createCommunicationMessage({ text: trimmed, conversationId: 'admin-stream' });
      setText('');
      await load(true);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  }, [text, load]);

  const handleDelete = useCallback((id) => {
    Alert.alert('Delete message?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteCommunicationMessage(id);
            setMessages((p) => p.filter((m) => m._id !== id));
          } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Delete failed.');
          }
        }
      },
    ]);
  }, []);

  // Build flat list data with day separators
  const listData = (() => {
    const result = [];
    let lastDay = '';
    messages.forEach((m) => {
      const dk = dayKey(m.createdAt);
      if (dk !== lastDay) {
        result.push({ _type: 'day', key: `day-${dk}`, label: dayLabel(m.createdAt) });
        lastDay = dk;
      }
      result.push({ ...m, _type: 'msg', key: m._id });
    });
    return result;
  })();

  if (loading) return <LoadingScreen />;

  const renderItem = ({ item }) => {
    if (item._type === 'day') {
      return (
        <View style={styles.dayRow}>
          <View style={styles.dayLine} />
          <Text style={styles.dayText}>{item.label}</Text>
          <View style={styles.dayLine} />
        </View>
      );
    }

    const sender = item.sender || {};
    const isMine = sender._id === user?._id || sender.collegeId === user?.collegeId;
    const isAI = String(sender.collegeId || '').toLowerCase() === 'cicrai' || sender.isAI;

    return (
      <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
        {!isMine && <Avatar name={sender.name || 'User'} size={32} />}
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther, isAI && styles.bubbleAI]}>
          {!isMine && (
            <Text style={[styles.senderName, isAI && { color: colors.accentPurple }]}>
              {isAI ? '🤖 CICR AI' : sender.name || 'Unknown'}
            </Text>
          )}
          <Text style={styles.msgText}>{item.text}</Text>
          <View style={styles.msgMeta}>
            <Text style={styles.msgTime}>{timeLabel(item.createdAt)}</Text>
            {(isMine || isAdmin) && (
              <TouchableOpacity onPress={() => handleDelete(item._id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={13} color={colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={flatListRef}
        data={listData}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accentBlue} />}
        ListEmptyComponent={<EmptyState icon="chatbubbles-outline" title="No messages yet" subtitle="Start the conversation!" />}
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor={colors.textTertiary}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
          autoCorrect={false}
        />
        <TouchableOpacity style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]} onPress={handleSend} disabled={sending || !text.trim()}>
          <Ionicons name="send" size={20} color={text.trim() ? colors.white : colors.textTertiary} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface0 },
  listContent: { padding: spacing.md, paddingBottom: spacing.lg },
  dayRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md },
  dayLine: { flex: 1, height: 1, backgroundColor: colors.borderSubtle },
  dayText: { color: colors.textTertiary, fontSize: fontSize.xs, marginHorizontal: spacing.md },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.sm, gap: spacing.sm },
  msgRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', padding: spacing.md, borderRadius: radius.md },
  bubbleOther: { backgroundColor: colors.surface3, borderBottomLeftRadius: 4 },
  bubbleMine: { backgroundColor: 'rgba(56,189,248,0.18)', borderBottomRightRadius: 4 },
  bubbleAI: { backgroundColor: 'rgba(167,139,250,0.12)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)' },
  senderName: { color: colors.accentBlue, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, marginBottom: 2 },
  msgText: { color: colors.textPrimary, fontSize: fontSize.sm, lineHeight: 20 },
  msgMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm, marginTop: 4 },
  msgTime: { color: colors.textTertiary, fontSize: 10 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surface2,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.surface3,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.accentBlue,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.surface3 },
});
