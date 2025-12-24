import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rmi.tellerreport',
  appName: 'RMI Teller Report',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchFadeOutDuration: 300,
    },
  },
  server: {
    androidScheme: 'https',
    iosScheme: 'ionic',
  },
};

export default config;
