import type { ConfigContext } from 'expo/config';
import { withAndroidManifest } from 'expo/config-plugins';
import { existsSync, readFileSync } from 'node:fs';

export default ({ config }: ConfigContext) => {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || config.extra?.eas?.projectId;
  if (projectId && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(projectId)) throw new Error('Expo Project ID must be a UUID.');
  const google = existsSync('./google-services.json');
  if (google) {
    const services = JSON.parse(readFileSync('./google-services.json', 'utf8'));
    if (!services.client?.some((client: any) => client.client_info?.android_client_info?.package_name === config.android?.package)) throw new Error('Firebase Android package must match com.matinf.demo.');
    config.android = { ...config.android, googleServicesFile: './google-services.json' };
  }
  config.extra = { ...config.extra, matinfPushConfigured: !!projectId && google, ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}) };
  return withAndroidManifest(config, (mod) => {
  const backend = process.env.EXPO_PUBLIC_WORDPRESS_URL || 'http://127.0.0.1:9400';
  const local = /^http:\/\/(127\.0\.0\.1|localhost|10\.0\.2\.2)(:\d+)?\/?$/.test(backend);
  if (!local && !backend.startsWith('https://')) throw new Error('Public WordPress URLs must use HTTPS.');
  const application = mod.modResults.manifest.application?.[0];
  if (application) application.$['android:usesCleartextTraffic'] = local ? 'true' : 'false';
  return mod;
  });
};
