import type { ConfigContext } from 'expo/config';
import { withAndroidManifest } from 'expo/config-plugins';

export default ({ config }: ConfigContext) => withAndroidManifest(config, (mod) => {
  const backend = process.env.EXPO_PUBLIC_WORDPRESS_URL || 'http://127.0.0.1:9400';
  const local = /^http:\/\/(127\.0\.0\.1|localhost|10\.0\.2\.2)(:\d+)?\/?$/.test(backend);
  if (!local && !backend.startsWith('https://')) throw new Error('Public WordPress URLs must use HTTPS.');
  const application = mod.modResults.manifest.application?.[0];
  if (application) application.$['android:usesCleartextTraffic'] = local ? 'true' : 'false';
  return mod;
});
