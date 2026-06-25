import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { login, normalizeAuthSession } from '../auth/api';
import { useAuth } from '../auth/AuthContext';
import { Screen } from '../components/Screen';
import { colors, spacing } from '../theme/theme';

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '');
}

function normalizePin(pin: string) {
  return pin.replace(/\D/g, '').slice(0, 4);
}

export function SignInScreen() {
  const { signIn } = useAuth();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedPhone = normalizePhone(phone);
  const fullPhone = `+237${normalizedPhone}`;

  async function submit() {
    if (normalizedPhone.length !== 9) {
      setError('Entrez un numéro camerounais valide à 9 chiffres.');
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setError('Entrez votre PIN à 4 chiffres.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await login(fullPhone, pin);
      const session = normalizeAuthSession(response);

      if (!session) {
        throw new Error('Connexion impossible : réponse de session incomplète.');
      }

      await signIn(session);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Connexion refusée. Vérifiez votre numéro et votre PIN.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={styles.logoContainer}>
        <View style={styles.logoMark}>
          <Text style={styles.logoInitial}>L</Text>
        </View>
        <Text style={styles.logoText}>LISSAFI-P</Text>
        <Text style={styles.subtitle}>Connectez-vous à votre espace commerçant.</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Numéro de téléphone</Text>
          <View style={styles.phoneRow}>
            <View style={styles.prefixBox}>
              <Text style={styles.prefixText}>+237</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              placeholder="6XX XXX XXX"
              keyboardType="phone-pad"
              value={phone}
              maxLength={11}
              onChangeText={setPhone}
              placeholderTextColor={colors.muted}
              editable={!isSubmitting}
              autoComplete="tel"
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Code PIN</Text>
          <TextInput
            style={styles.input}
            placeholder="••••"
            keyboardType="number-pad"
            secureTextEntry
            value={pin}
            maxLength={4}
            onChangeText={(nextPin) => setPin(normalizePin(nextPin))}
            placeholderTextColor={colors.muted}
            editable={!isSubmitting}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <Pressable style={[styles.primaryButton, isSubmitting && styles.disabledButton]} onPress={submit} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color={colors.card} /> : <Text style={styles.primaryButtonText}>Se connecter</Text>}
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logoContainer: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
  logoMark: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 32, height: 64, justifyContent: 'center', width: 64 },
  logoInitial: { color: colors.card, fontSize: 34, fontWeight: '800' },
  logoText: { color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: 1 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  form: { gap: spacing.md, marginTop: spacing.xl },
  fieldGroup: { gap: spacing.sm },
  label: { color: colors.text, fontSize: 15, fontWeight: '700' },
  phoneRow: { flexDirection: 'row', gap: spacing.sm },
  prefixBox: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 14, borderWidth: 1, justifyContent: 'center', paddingHorizontal: spacing.md },
  prefixText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  phoneInput: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.text, flex: 1, fontSize: 18, padding: 14 },
  input: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.text, fontSize: 18, padding: 14 },
  error: { color: '#dc2626', fontSize: 14 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 16, marginTop: spacing.lg, padding: 16 },
  disabledButton: { opacity: 0.7 },
  primaryButtonText: { color: colors.card, fontSize: 16, fontWeight: '800' },
});
