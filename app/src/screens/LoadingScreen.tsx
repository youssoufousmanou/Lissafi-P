import { ActivityIndicator } from 'react-native';

import { Screen } from '../components/Screen';
import { colors } from '../theme/theme';

export function LoadingScreen() {
  return (
    <Screen>
      <ActivityIndicator color={colors.primary} size="large" />
    </Screen>
  );
}
