import { useRouter } from 'expo-router';

// Back that can't dead-end: on a cold deep-link (empty stack) fall back home.
export function useGoBack() {
  const router = useRouter();
  return () => {
    if (router.canGoBack()) router.back();
    else router.dismissTo('/');
  };
}
