import { NavigatorScreenParams } from '@react-navigation/native';

export type ActivityType = 'COMMERCE_GENERAL' | 'MECANIQUE' | 'ALIMENTATION' | 'SERVICES' | 'COIFFURE' | 'AUTRE';

export type AuthStackParamList = {
  Phone: {
    activityType: ActivityType;
  };
  Otp: {
    identifier: string;
    phone: string;
    userId?: string | number;
  };
  Pin: {
    identifier: string;
    userId?: string | number;
  };
  Onboarding: undefined;
  SignIn: undefined;
};

export type OperationType = 'VENTE' | 'ACHAT' | 'DEPENSE' | 'RECETTE';

export type OperationsStackParamList = {
  OperationsList:
    | {
        initialOperationType?: OperationType;
      }
    | undefined;
  OperationForm:
    | {
        operationId?: string | number;
        initialOperationType?: OperationType;
      }
    | undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Operations: NavigatorScreenParams<OperationsStackParamList> | undefined;
  Stock: undefined;
  Profile: undefined;
};
