import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { AuthStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

type ActivityType = NonNullable<AuthStackParamList['Phone']>['activityType'];

type BusinessActivity = {
  icon: string;
  label: string;
  value: ActivityType;
};

const BUSINESS_ACTIVITIES: BusinessActivity[] = [
  { icon: '🛍️', label: 'Boutique / Commerce général', value: 'COMMERCE_GENERAL' },
  { icon: '🔧', label: 'Garage Mécanique', value: 'MECANIQUE' },
  { icon: '🍽️', label: 'Restauration', value: 'ALIMENTATION' },
  { icon: '💇🏾‍♀️', label: 'Salon de Beauté', value: 'COIFFURE' },
  { icon: '✨', label: 'Autre activité', value: 'AUTRE' },
];

export function OnboardingScreen({ navigation }: Props) {
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityType>(BUSINESS_ACTIVITIES[0].value);

  function continueToPhone() {
    navigation.navigate('Phone', { activityType: selectedActivityType });
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Inscription commerçant</Text>
        <Text style={styles.title}>Quel est votre métier ?</Text>
        <Text style={styles.subtitle}>Nous personnalisons Lissafi-P selon votre activité pour vous proposer les bons outils dès le départ.</Text>
      </View>

      <View style={styles.cardsContainer}>
        {BUSINESS_ACTIVITIES.map((activity) => {
          const isSelected = selectedActivityType === activity.value;

          return (
            <Pressable
              key={activity.value}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={[styles.activityCard, isSelected && styles.selectedActivityCard]}
              onPress={() => setSelectedActivityType(activity.value)}
            >
              <View style={[styles.iconContainer, isSelected && styles.selectedIconContainer]}>
                <Text style={styles.icon}>{activity.icon}</Text>
              </View>
              <View style={styles.activityTextContainer}>
                <Text style={styles.activityLabel}>{activity.label}</Text>
              </View>
              <View style={[styles.radio, isSelected && styles.selectedRadio]}>{isSelected ? <View style={styles.radioDot} /> : null}</View>
            </Pressable>
          );
        })}
      </View>

      <Pressable style={styles.primaryButton} onPress={continueToPhone}>
        <Text style={styles.primaryButtonText}>Suivant</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginTop: spacing.lg },
  eyebrow: { color: colors.primaryDark, fontSize: 14, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 32, fontWeight: '800', lineHeight: 38 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  cardsContainer: { gap: spacing.md, marginTop: spacing.md },
  activityCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  selectedActivityCard: {
    borderColor: colors.primary,
    borderWidth: 2,
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  iconContainer: { alignItems: 'center', backgroundColor: '#ecfeff', borderRadius: 16, height: 52, justifyContent: 'center', width: 52 },
  selectedIconContainer: { backgroundColor: '#ccfbf1' },
  icon: { fontSize: 26 },
  activityTextContainer: { flex: 1, gap: 2 },
  activityLabel: { color: colors.text, fontSize: 16, fontWeight: '800' },
  radio: { alignItems: 'center', borderColor: colors.border, borderRadius: 12, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 },
  selectedRadio: { borderColor: colors.primary },
  radioDot: { backgroundColor: colors.primary, borderRadius: 6, height: 12, width: 12 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 16, marginTop: 'auto', padding: 16 },
  primaryButtonText: { color: colors.card, fontSize: 16, fontWeight: '800' },
});
