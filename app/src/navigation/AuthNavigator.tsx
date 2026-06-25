import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { OnboardingScreen } from '../screens/OnboardingScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { OtpScreen } from '../screens/auth/OtpScreen';
import { PhoneScreen } from '../screens/auth/PhoneScreen';
import { PinScreen } from '../screens/auth/PinScreen';
import { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator initialRouteName="Phone">
      <Stack.Screen name="Phone" component={PhoneScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Otp" component={OtpScreen} options={{ title: 'Code OTP' }} />
      <Stack.Screen name="Pin" component={PinScreen} options={{ title: 'PIN' }} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ title: 'Bienvenue' }} />
      <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: 'Connexion' }} />
    </Stack.Navigator>
  );
}
