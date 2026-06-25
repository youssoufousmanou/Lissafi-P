import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, StyleSheet, Text } from 'react-native';

import { Screen } from '../components/Screen';
import { AuthStackParamList } from '../navigation/types';
import { colors } from '../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

export function OnboardingScreen({ navigation }: Props) {
  return (
    <Screen>
      <Text style={styles.title}>Lissafi-P</Text>
      <Text style={styles.subtitle}>
        Gérez vos ventes, produits et mouvements de stock depuis votre téléphone.
      </Text>
      <Button title="Commencer" onPress={() => navigation.navigate('SignIn')} color={colors.primary} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 18,
    lineHeight: 26,
  },
});
