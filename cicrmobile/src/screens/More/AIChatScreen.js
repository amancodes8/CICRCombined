/**
 * AI Assistant / CICR Chat – mirrors cicrfrontend CicrAssistant component.
 * Uses askCicrAssistant API to get AI-generated answers about CICR.
 */
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { askCicrAssistant } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Avatar, Card } from '../../components/UI';
import useAuth from '../../hooks/useAuth';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const BOT_WELCOME = 'Ask me about CICR society, member contributions, roles, projects, and events.';

export default function AIChatScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([{ role: 'bot', text: BOT_WELCOME }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  const scrollEnd = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 100);
  }, []);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const newMsgs = [...messages, { role: 'user', text: question }];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);
    scrollEnd();

    try {
      const { data } = await askCicrAssistant({ question });
      setMessages((prev) => [...prev, { role: 'bot', text: data.answer || 'No response available.' }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: err.response?.data?.answer || err.response?.data?.message || 'Assistant request failed.' },
      ]);
    } finally {
      setLoading(false);
      scrollEnd();
    }
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <View style={styles.botAvatar}>
            <Ionicons name="sparkles" size={16} color={colors.white} />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.text}</Text>
        </View>
        {isUser && <Avatar name={user?.name} size={30} />}
      </View>
    );
  };

  return (
    <ScreenWrapper title="CICR AI Assistant" subtitle="Ask anything" icon="sparkles-outline" scrollable={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderMessage}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.chatList}
          onContentSizeChange={scrollEnd}
        />
        {loading && (
          <View style={styles.typingRow}>
            <View style={styles.botAvatar}>
              <Ionicons name="sparkles" size={16} color={colors.white} />
            </View>
            <View style={styles.typingBubble}>
              <ActivityIndicator size="small" color={colors.accentBlue} />
            </View>
          </View>
        )}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.chatInput}
            placeholder="Ask about CICR..."
            placeholderTextColor={colors.textTertiary}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline
            maxLength={500}
          />
          <TouchableOpacity style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]} onPress={handleSend} disabled={!input.trim() || loading}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="send" size={18} color={colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  chatList: { paddingBottom: spacing.md },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginBottom: spacing.md },
  msgRowUser: { flexDirection: 'row', justifyContent: 'flex-end' },
  botAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.accentBlue,
    alignItems: 'center', justifyContent: 'center',
  },
  bubble: { maxWidth: '75%', padding: spacing.md, borderRadius: radius.lg },
  bubbleBot: { backgroundColor: colors.surface3, borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: colors.accentBlue, borderBottomRightRadius: 4 },
  bubbleText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
  bubbleTextUser: { color: colors.white },
  typingRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginBottom: spacing.md, paddingHorizontal: spacing.sm },
  typingBubble: { backgroundColor: colors.surface3, padding: spacing.md, borderRadius: radius.lg },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSubtle,
  },
  chatInput: {
    flex: 1,
    backgroundColor: colors.surface3,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.accentBlue,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
});
