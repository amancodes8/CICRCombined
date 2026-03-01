/**
 * Auth screen – Login / Register / Forgot Password
 * Mirrors cicrfrontend/src/pages/Auth.jsx with the same fields and flow.
 */
import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { login, register, resetPasswordWithCode, resetPasswordWithOtp, sendPasswordResetOtp } from '../../api';
import useAuth from '../../hooks/useAuth';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const MODES = { login: 'login', signup: 'signup', forgot: 'forgot' };

export default function AuthScreen() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState(MODES.login);
  const [loading, setLoading] = useState(false);
  const [forgotMethod, setForgotMethod] = useState('emailOtp');
  const [otpSent, setOtpSent] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    collegeId: '',
    inviteCode: '',
    otp: '',
    resetCode: '',
    newPassword: '',
  });

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const resetForm = () => {
    setForm({ name: '', email: '', password: '', collegeId: '', inviteCode: '', otp: '', resetCode: '', newPassword: '' });
    setOtpSent(false);
  };

  const switchMode = (m) => {
    setMode(m);
    resetForm();
  };

  const handleLogin = useCallback(async () => {
    if (!form.email || !form.password) return Alert.alert('Error', 'Email and password are required.');
    setLoading(true);
    try {
      const res = await login({ email: form.email, password: form.password });
      await signIn(res.data.token, res.data);
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed.';
      const code = err.response?.data?.code;
      if (code === 'ACCOUNT_PENDING_APPROVAL') {
        Alert.alert('Pending', 'Your account is pending admin approval.');
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setLoading(false);
    }
  }, [form, signIn]);

  const handleRegister = useCallback(async () => {
    if (!form.name || !form.email || !form.password || !form.collegeId) {
      return Alert.alert('Error', 'All fields are required.');
    }
    setLoading(true);
    try {
      await register(form);
      Alert.alert('Success', 'Registration submitted. Wait for admin approval.');
      switchMode(MODES.login);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }, [form]);

  const handleForgot = useCallback(async () => {
    setLoading(true);
    try {
      if (forgotMethod === 'emailOtp') {
        if (!otpSent) {
          await sendPasswordResetOtp({ email: form.email, collegeId: form.collegeId });
          setOtpSent(true);
          Alert.alert('OTP Sent', 'Check your email for the OTP code.');
        } else {
          await resetPasswordWithOtp({
            email: form.email,
            collegeId: form.collegeId,
            otp: form.otp,
            newPassword: form.newPassword,
          });
          Alert.alert('Success', 'Password has been reset.');
          switchMode(MODES.login);
        }
      } else {
        await resetPasswordWithCode({
          collegeId: form.collegeId,
          resetCode: form.resetCode,
          newPassword: form.newPassword,
        });
        Alert.alert('Success', 'Password has been reset.');
        switchMode(MODES.login);
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Reset failed.');
    } finally {
      setLoading(false);
    }
  }, [form, forgotMethod, otpSent]);

  const InputRow = ({ icon, placeholder, value, onChangeText, secure, autoCapitalize }) => (
    <View style={styles.inputWrap}>
      <Ionicons name={icon} size={18} color={colors.textTertiary} style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        autoCapitalize={autoCapitalize || 'none'}
        autoCorrect={false}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.surface0} />
      <LinearGradient colors={[colors.surface0, colors.surface2, colors.surface0]} style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.logoCircle}>
              <Ionicons name="rocket" size={32} color={colors.accentBlue} />
            </View>
            <Text style={styles.brandName}>CICR Connect</Text>
            <Text style={styles.brandSub}>
              {mode === MODES.login ? 'Sign in to your account' : mode === MODES.signup ? 'Create a new account' : 'Reset your password'}
            </Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {mode === MODES.login && (
              <>
                <InputRow icon="mail-outline" placeholder="Email or College ID" value={form.email} onChangeText={(v) => set('email', v)} />
                <InputRow icon="lock-closed-outline" placeholder="Password" value={form.password} onChangeText={(v) => set('password', v)} secure />
                <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin} disabled={loading} activeOpacity={0.8}>
                  <Text style={styles.primaryBtnText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => switchMode(MODES.forgot)} style={styles.linkBtn}>
                  <Text style={styles.linkText}>Forgot password?</Text>
                </TouchableOpacity>
              </>
            )}

            {mode === MODES.signup && (
              <>
                <InputRow icon="person-outline" placeholder="Full Name" value={form.name} onChangeText={(v) => set('name', v)} autoCapitalize="words" />
                <InputRow icon="mail-outline" placeholder="Email" value={form.email} onChangeText={(v) => set('email', v)} />
                <InputRow icon="id-card-outline" placeholder="College ID" value={form.collegeId} onChangeText={(v) => set('collegeId', v)} />
                <InputRow icon="lock-closed-outline" placeholder="Password" value={form.password} onChangeText={(v) => set('password', v)} secure />
                <InputRow icon="key-outline" placeholder="Invite Code" value={form.inviteCode} onChangeText={(v) => set('inviteCode', v)} />
                <TouchableOpacity style={styles.primaryBtn} onPress={handleRegister} disabled={loading} activeOpacity={0.8}>
                  <Text style={styles.primaryBtnText}>{loading ? 'Registering…' : 'Register'}</Text>
                </TouchableOpacity>
              </>
            )}

            {mode === MODES.forgot && (
              <>
                <View style={styles.methodToggle}>
                  <TouchableOpacity
                    style={[styles.methodBtn, forgotMethod === 'emailOtp' && styles.methodBtnActive]}
                    onPress={() => { setForgotMethod('emailOtp'); setOtpSent(false); }}
                  >
                    <Text style={[styles.methodText, forgotMethod === 'emailOtp' && styles.methodTextActive]}>Email OTP</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.methodBtn, forgotMethod === 'adminCode' && styles.methodBtnActive]}
                    onPress={() => { setForgotMethod('adminCode'); setOtpSent(false); }}
                  >
                    <Text style={[styles.methodText, forgotMethod === 'adminCode' && styles.methodTextActive]}>Admin Code</Text>
                  </TouchableOpacity>
                </View>

                {forgotMethod === 'emailOtp' ? (
                  <>
                    <InputRow icon="mail-outline" placeholder="Email" value={form.email} onChangeText={(v) => set('email', v)} />
                    <InputRow icon="id-card-outline" placeholder="College ID" value={form.collegeId} onChangeText={(v) => set('collegeId', v)} />
                    {otpSent && (
                      <>
                        <InputRow icon="keypad-outline" placeholder="OTP Code" value={form.otp} onChangeText={(v) => set('otp', v)} />
                        <InputRow icon="lock-closed-outline" placeholder="New Password" value={form.newPassword} onChangeText={(v) => set('newPassword', v)} secure />
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <InputRow icon="id-card-outline" placeholder="College ID" value={form.collegeId} onChangeText={(v) => set('collegeId', v)} />
                    <InputRow icon="key-outline" placeholder="Admin Reset Code" value={form.resetCode} onChangeText={(v) => set('resetCode', v)} />
                    <InputRow icon="lock-closed-outline" placeholder="New Password" value={form.newPassword} onChangeText={(v) => set('newPassword', v)} secure />
                  </>
                )}
                <TouchableOpacity style={styles.primaryBtn} onPress={handleForgot} disabled={loading} activeOpacity={0.8}>
                  <Text style={styles.primaryBtnText}>
                    {loading ? 'Processing…' : forgotMethod === 'emailOtp' && !otpSent ? 'Send OTP' : 'Reset Password'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.switchRow}>
              {mode !== MODES.login && (
                <TouchableOpacity onPress={() => switchMode(MODES.login)} style={styles.linkBtn}>
                  <Text style={styles.linkText}>Back to Sign In</Text>
                </TouchableOpacity>
              )}
              {mode === MODES.login && (
                <TouchableOpacity onPress={() => switchMode(MODES.signup)} style={styles.linkBtn}>
                  <Text style={styles.linkText}>Create an account</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface0 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  brand: { alignItems: 'center', marginBottom: spacing['3xl'] },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(56,189,248,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  brandName: { color: colors.textPrimary, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold },
  brandSub: { color: colors.textTertiary, fontSize: fontSize.sm, marginTop: spacing.xs },
  card: {
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.xl,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  inputIcon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.base,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryBtnText: { color: colors.white, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  linkBtn: { alignItems: 'center', marginTop: spacing.md },
  linkText: { color: colors.accentBlue, fontSize: fontSize.sm },
  switchRow: { alignItems: 'center', marginTop: spacing.lg },
  methodToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface3,
    borderRadius: radius.sm,
    marginBottom: spacing.lg,
    padding: 3,
  },
  methodBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm - 2, alignItems: 'center' },
  methodBtnActive: { backgroundColor: colors.accentBlue },
  methodText: { color: colors.textTertiary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  methodTextActive: { color: colors.white },
});
