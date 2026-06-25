import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { OperationsStackParamList } from '../../navigation/types';
import { OperationFormScreen } from './OperationFormScreen';
import { OperationsScreen } from './OperationsScreen';

const Stack = createNativeStackNavigator<OperationsStackParamList>();

export function OperationsNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="OperationsList" component={OperationsScreen} options={{ title: 'Opérations' }} />
      <Stack.Screen name="OperationForm" component={OperationFormScreen} options={{ title: 'Ajouter une opération' }} />
    </Stack.Navigator>
  );
}
