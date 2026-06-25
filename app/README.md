# Application mobile Lissafi-P

Projet mobile React Native avec Expo et TypeScript.

## Démarrage

```bash
npm install
npm run start
```

## Configuration

Copier `.env.example` vers `.env` et ajuster l'URL de l'API si nécessaire :

```bash
EXPO_PUBLIC_API_URL=https://lissafi-p-production.up.railway.app/api/v1
```

### URL API

L'application utilise l'API Railway en production par défaut : `https://lissafi-p-production.up.railway.app/api/v1`.

Pour tester une API locale, remplacez `EXPO_PUBLIC_API_URL` par l'adresse accessible depuis votre appareil, puis redémarrez Expo.

## Structure

- `src/api/` : client HTTP centralisé.
- `src/auth/` : contexte et logique d'authentification.
- `src/navigation/` : flow onboarding/auth et tabs principales.
- `src/features/` : domaines fonctionnels de l'application.
