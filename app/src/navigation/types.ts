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

export type MainTabParamList = {
  Home: undefined;
  Operations:
    | {
        initialOperationType?: OperationType;
      }
    | undefined;
  Stock: undefined;
  Profile: undefined;
};
