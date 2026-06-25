import { Button, StyleSheet, Text } from 'react-native';

import { useAuth } from '../../auth/AuthContext';
import { Screen } from '../../components/Screen';
import { colors } from '../../theme/theme';

export function ProfileScreen() {
  const { signOut } = useAuth();

  return (
    <Screen>
      <Text style={styles.title}>Profil</Text>
      <Text style={styles.text}>Gérez votre compte et les paramètres de la boutique.</Text>
      <Button title="Se déconnecter" onPress={signOut} color={colors.primaryDark} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  text: {
    color: colors.muted,
    fontSize: 16,
  },
});
