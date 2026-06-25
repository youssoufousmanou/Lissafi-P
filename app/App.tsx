import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';

import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { MainTabs } from './src/navigation/MainTabs';
import { LoadingScreen } from './src/screens/LoadingScreen';
import { theme } from './src/theme/theme';

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return isAuthenticated ? <MainTabs /> : <AuthNavigator />;
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer theme={theme.navigation}>
        <RootNavigator />
        <StatusBar style="auto" />
      </NavigationContainer>
    </AuthProvider>
  );
}
