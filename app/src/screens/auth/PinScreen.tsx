import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { normalizeAuthSession, setPassword } from '../../auth/api';
import { useAuth } from '../../auth/AuthContext';
import { Screen } from '../../components/Screen';
import { AuthStackParamList } from '../../navigation/types';
import { colors, spacing } from '../../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Pin'>;

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export function PinScreen({ route }: Props) {
  const { signIn } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(nextPin: string) {
    const userId = route.params.userId ?? route.params.identifier;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await setPassword(userId, nextPin);
      const session = normalizeAuthSession(response);

      if (!session) {
        throw new Error('Réponse de connexion incomplète.');
      }

      await signIn(session);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Impossible de définir le PIN.');
      setPin('');
    } finally {
      setIsSubmitting(false);
    }
  }

  function pressKey(key: string) {
    if (!key || isSubmitting) {
      return;
    }

    if (key === '⌫') {
      setPin((currentPin) => currentPin.slice(0, -1));
      return;
    }

    setPin((currentPin) => {
      const nextPin = `${currentPin}${key}`.slice(0, 4);

      if (nextPin.length === 4) {
        void submit(nextPin);
      }

      return nextPin;
    });
  }

  return (
    <Screen>
      <Text style={styles.title}>Créez votre PIN</Text>
      <Text style={styles.subtitle}>Choisissez 4 chiffres pour sécuriser l’accès à votre compte.</Text>
      <View style={styles.dotsRow}>
        {[0, 1, 2, 3].map((index) => (
          <View key={index} style={[styles.dot, index < pin.length && styles.activeDot]} />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {isSubmitting ? <ActivityIndicator color={colors.primary} /> : null}
      <View style={styles.keyboard}>
        {KEYS.map((key, index) => (
          <Pressable key={`${key}-${index}`} style={[styles.key, !key && styles.emptyKey]} onPress={() => pressKey(key)} disabled={!key || isSubmitting}>
            <Text style={styles.keyText}>{key}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginTop: spacing.xl, textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  dotsRow: { flexDirection: 'row', gap: spacing.md, justifyContent: 'center', marginVertical: spacing.xl },
  dot: { backgroundColor: colors.border, borderRadius: 10, height: 18, width: 18 },
  activeDot: { backgroundColor: colors.primary },
  error: { color: '#dc2626', fontSize: 14, textAlign: 'center' },
  keyboard: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center', marginTop: 'auto' },
  key: { alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border, borderRadius: 36, borderWidth: 1, height: 72, justifyContent: 'center', width: 72 },
  emptyKey: { backgroundColor: 'transparent', borderWidth: 0 },
  keyText: { color: colors.text, fontSize: 26, fontWeight: '800' },
});
