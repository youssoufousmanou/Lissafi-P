import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { HomeScreen } from '../screens/HomeScreen';
import { OperationsScreen } from '../features/operations/OperationsScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { StockScreen } from '../features/stock/StockScreen';
import { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: true }}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Accueil' }} />
      <Tab.Screen name="Operations" component={OperationsScreen} options={{ title: 'Opérations' }} />
      <Tab.Screen name="Stock" component={StockScreen} options={{ title: 'Stock' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
}
