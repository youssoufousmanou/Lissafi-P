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

export type MainTabParamList = {
  Home: undefined;
  Operations: undefined;
  Stock: undefined;
  Profile: undefined;
};
