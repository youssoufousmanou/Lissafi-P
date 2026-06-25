import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { HomeScreen } from '../screens/HomeScreen';
import { OperationsNavigator } from '../features/operations/OperationsNavigator';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { StockScreen } from '../features/stock/StockScreen';
import { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: true }}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Accueil' }} />
      <Tab.Screen name="Operations" component={OperationsNavigator} options={{ headerShown: false, title: 'Opérations' }} />
      <Tab.Screen name="Stock" component={StockScreen} options={{ title: 'Stock' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
}
