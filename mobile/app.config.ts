import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Lo fijo de la app está en app.json; acá, lo que depende de cómo se arma.
 *
 * Un APK de prueba que habla con la PC por la red local usa http, que
 * Android bloquea en las apps instaladas: solo en ese caso se permite. Con
 * el backend publicado (https) queda bloqueado, como corresponde.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const api = process.env.EXPO_PUBLIC_API_URL ?? '';
  return {
    ...config,
    name: config.name ?? 'KontaGo',
    slug: config.slug ?? 'kontago-mobile',
    plugins: [
      ...(config.plugins ?? []),
      ['expo-build-properties', { android: { usesCleartextTraffic: api.startsWith('http://') } }],
    ],
  };
};
