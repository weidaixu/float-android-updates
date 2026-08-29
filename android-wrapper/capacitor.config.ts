import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.floatapp.mobile',
  appName: 'Float',
  webDir: 'www',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_float',
      iconColor: '#FF5C8A',
    },
  },
};

export default config;
