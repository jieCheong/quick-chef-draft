import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.quickchef.app',
    appName: 'QuickChef',
    webDir: 'dist',

    server: {
        androidScheme: 'https',
    },
};

export default config;