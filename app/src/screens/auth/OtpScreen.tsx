import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { resendOtp, verifyOtp } from '../../auth/api';
import { Screen } from '../../components/Screen';
import { AuthStackParamList } from '../../navigation/types';
import { colors, spacing } from '../../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Otp'>;

export function OtpScreen({ navigation, route }: Props) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputs = useRef<Array<TextInput | null>>([]);
  const token = digits.join('');

  function updateDigit(value: string, index: number) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const nextDigits = [...digits];
    nextDigits[index] = digit;
    setDigits(nextDigits);

    if (digit && index < inputs.current.length - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  async function submit(nextToken = token) {
    if (nextToken.length !== 6) {
      setError('Entrez le code reçu par SMS.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await verifyOtp(route.params.identifier, nextToken);
      navigation.navigate('Pin', {
        identifier: route.params.identifier,
        userId: response.userId ?? response.user?.id ?? response.user?.userId ?? route.params.userId,
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Code OTP invalide.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resend() {
    setMessage(null);
    setError(null);

    try {
      await resendOtp(route.params.identifier);
      setMessage('Un nouveau code a été envoyé.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Impossible de renvoyer le code.');
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Vérification OTP</Text>
      <Text style={styles.subtitle}>Saisissez le code à 6 chiffres envoyé au {route.params.phone}.</Text>
      <View style={styles.otpRow}>
        {digits.map((digit, index) => (
          <TextInput
            key={index}
            ref={(input) => {
              inputs.current[index] = input;
            }}
            style={styles.otpInput}
            keyboardType="number-pad"
            maxLength={1}
            value={digit}
            onChangeText={(value) => updateDigit(value, index)}
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
                inputs.current[index - 1]?.focus();
              }
            }}
          />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Pressable style={[styles.primaryButton, isSubmitting && styles.disabledButton]} onPress={() => submit()} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color={colors.card} /> : <Text style={styles.primaryButtonText}>Continuer</Text>}
      </Pressable>
      <Pressable style={styles.linkButton} onPress={resend}>
        <Text style={styles.linkText}>Renvoyer le code</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginTop: spacing.xl },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  otpRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between', marginTop: spacing.xl },
  otpInput: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.text, flex: 1, fontSize: 24, fontWeight: '800', paddingVertical: 14, textAlign: 'center' },
  error: { color: '#dc2626', fontSize: 14 },
  message: { color: colors.primary, fontSize: 14 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 16, marginTop: spacing.lg, padding: 16 },
  disabledButton: { opacity: 0.7 },
  primaryButtonText: { color: colors.card, fontSize: 16, fontWeight: '800' },
  linkButton: { alignItems: 'center', padding: spacing.md },
  linkText: { color: colors.primaryDark, fontSize: 16, fontWeight: '700' },
});
