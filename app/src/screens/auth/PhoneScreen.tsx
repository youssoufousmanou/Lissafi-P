import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { register } from '../../auth/api';
import { Screen } from '../../components/Screen';
import { AuthStackParamList } from '../../navigation/types';
import { colors, spacing } from '../../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Phone'>;

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '');
}

export function PhoneScreen({ navigation, route }: Props) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const normalizedPhone = normalizePhone(phone);
  const fullPhone = `+237${normalizedPhone}`;

  async function submit() {
    if (normalizedPhone.length !== 9) {
      setError('Entrez un numéro camerounais valide à 9 chiffres.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await register(fullPhone, route.params.activityType);
      navigation.navigate('Otp', {
        identifier: response.identifier ?? fullPhone,
        phone: fullPhone,
        userId: response.userId ?? response.user?.id ?? response.user?.userId,
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Impossible de créer le compte.');
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
        <Text style={styles.subtitle}>Rejoignez la communauté des commerçants connectés.</Text>
      </View>

      <View style={styles.form}>
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
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <Pressable style={[styles.primaryButton, isSubmitting && styles.disabledButton]} onPress={submit} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color={colors.card} /> : <Text style={styles.primaryButtonText}>Rejoindre la communauté</Text>}
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('SignIn')}>
        <Text style={styles.secondaryButtonText}>J’ai déjà un compte !</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logoContainer: { alignItems: 'center', marginTop: spacing.xl, gap: spacing.sm },
  logoMark: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 32, height: 64, justifyContent: 'center', width: 64 },
  logoInitial: { color: colors.card, fontSize: 34, fontWeight: '800' },
  logoText: { color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: 1 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  form: { gap: spacing.sm, marginTop: spacing.xl },
  label: { color: colors.text, fontSize: 15, fontWeight: '700' },
  phoneRow: { flexDirection: 'row', gap: spacing.sm },
  prefixBox: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 14, borderWidth: 1, justifyContent: 'center', paddingHorizontal: spacing.md },
  prefixText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  phoneInput: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.text, flex: 1, fontSize: 18, padding: 14 },
  error: { color: '#dc2626', fontSize: 14 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 16, marginTop: spacing.md, padding: 16 },
  disabledButton: { opacity: 0.7 },
  primaryButtonText: { color: colors.card, fontSize: 16, fontWeight: '800' },
  secondaryButton: { alignItems: 'center', padding: spacing.md },
  secondaryButtonText: { color: colors.primaryDark, fontSize: 16, fontWeight: '700' },
});
