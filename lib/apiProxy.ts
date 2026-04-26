import Constants from 'expo-constants';
import { Platform } from 'react-native';

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function extractHost(value?: string | null): string | null {
  if (!value) return null;
  const host = value.split(':')[0]?.trim();
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  return host;
}

function resolveExpoHost(): string | null {
  const candidates = [
    Constants.expoConfig?.hostUri,
    (Constants as any).expoGoConfig?.debuggerHost,
    (Constants as any).manifest?.debuggerHost,
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost,
  ];

  for (const candidate of candidates) {
    const host = extractHost(candidate);
    if (host) return host;
  }

  return null;
}

export function getApiProxyBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_PROXY_URL?.trim();
  if (configured) return normalizeBaseUrl(configured);

  const expoHost = resolveExpoHost();
  if (expoHost) {
    return `http://${expoHost}:3000`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }

  return 'http://localhost:3000';
}
