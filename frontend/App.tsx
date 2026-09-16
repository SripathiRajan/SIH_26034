import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';

import { PRAMAN_LOGO_BASE64 } from './src/assets/pramanLogoBase64';

export default function App() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'PRAMAN';

      const setFavicon = () => {
        let links = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']");
        if (links.length === 0) {
          const newLink = document.createElement('link');
          newLink.rel = 'shortcut icon';
          document.head.appendChild(newLink);
          links = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']");
        }

        links.forEach((link) => {
          link.type = 'image/png';
          link.href = PRAMAN_LOGO_BASE64;
        });
      };

      setFavicon();
      const interval = setInterval(setFavicon, 1000);
      return () => clearInterval(interval);
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor="#F4F6F9" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
