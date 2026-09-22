import { Platform } from 'react-native';

// Native-driver animations aren't supported by react-native-web; fall back to JS there.
export const useNative = Platform.OS !== 'web';
