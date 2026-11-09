import type { CapacitorConfig } from '@capacitor/cli';

// Change appId to a reverse-domain name you own before publishing to a store.
const config: CapacitorConfig = {
  appId: 'com.lastweather.prototype',
  appName: 'The Last Weather',
  webDir: 'dist',
  backgroundColor: '#0b121d',
  android: {
    backgroundColor: '#0b121d',
  },
  ios: {
    backgroundColor: '#0b121d',
    contentInset: 'never',
  },
};

export default config;
