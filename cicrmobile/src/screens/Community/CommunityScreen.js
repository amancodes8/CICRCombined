/**
 * Community screen – discussion posts feed with like & create.
 * Mirrors cicrfrontend/src/pages/Community.jsx.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createPost, fetchPosts, likePost } from '../../api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Avatar, Card, EmptyState, LoadingScreen } from '../../components/UI';
import useAuth from '../../hooks/useAuth';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const formatDate = (v) => {
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
};

export default function CommunityScreen() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchPosts();
      setPosts(Array.isArray(res.data) ? res.data : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePost = async () => {
    if (!newPost.trim()) return;
    setPosting(true);
    try {
      await createPost({ content: newPost.trim() });
      setNewPost('');
      load();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to create post.');
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (id) => {
    try {
      await likePost(id);
      setPosts((prev) =>
        prev.map((p) => {
          if (p._id !== id) return p;
          const liked = p.likes?.includes(user?._id);
          return {
            ...p,
            likes: liked
              ? (p.likes || []).filter((uid) => uid !== user?._id)
              : [...(p.likes || []), user?._id],
          };
        })
      );
    } catch {
      // silent
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <ScreenWrapper title="Community" subtitle="Discussions & posts" icon="chatbubbles-outline" scrollable={false}>
      {/* New post */}
      <Card style={styles.composeCard}>
        <View style={styles.composeRow}>
          <Avatar name={user?.name} size={36} />
          <TextInput
            style={styles.composeInput}
            placeholder="What's on your mind?"
            placeholderTextColor={colors.textTertiary}
            value={newPost}
            onChangeText={setNewPost}
            multiline
            maxLength={1000}
          />
        </View>
        <TouchableOpacity
          style={[styles.postBtn, !newPost.trim() && styles.postBtnDisabled]}
          onPress={handlePost}
          disabled={posting || !newPost.trim()}
        >
          <Ionicons name="send" size={16} color={colors.white} />
          <Text style={styles.postBtnText}>{posting ? 'Posting…' : 'Post'}</Text>
        </TouchableOpacity>
      </Card>

      {/* Feed */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accentBlue} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={<EmptyState icon="chatbubble-outline" title="No posts yet" subtitle="Be the first to share something!" />}
        renderItem={({ item }) => {
          const liked = item.likes?.includes(user?._id);
          return (
            <Card style={styles.postCard}>
              <View style={styles.postHeader}>
                <Avatar name={item.author?.name || item.authorName} size={36} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={styles.postAuthor}>{item.author?.name || item.authorName || 'Member'}</Text>
                  <Text style={styles.postTime}>{formatDate(item.createdAt)}</Text>
                </View>
              </View>
              <Text style={styles.postContent}>{item.content || item.body}</Text>
              <View style={styles.postActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(item._id)}>
                  <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? colors.rose : colors.textTertiary} />
                  <Text style={[styles.actionText, liked && { color: colors.rose }]}>{item.likes?.length || 0}</Text>
                </TouchableOpacity>
              </View>
            </Card>
          );
        }}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  composeCard: { marginBottom: spacing.lg },
  composeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  composeInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.base,
    minHeight: 40,
    maxHeight: 100,
  },
  postBtn: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentBlue,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  postBtnDisabled: { opacity: 0.5 },
  postBtnText: { color: colors.white, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  postCard: { marginBottom: spacing.md },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  postAuthor: { color: colors.textPrimary, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  postTime: { color: colors.textTertiary, fontSize: fontSize.xs },
  postContent: { color: colors.textSecondary, fontSize: fontSize.base, lineHeight: 22 },
  postActions: { flexDirection: 'row', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: spacing.lg },
  actionText: { color: colors.textTertiary, fontSize: fontSize.sm },
});
