import { Href, Link } from 'expo-router';
import { type ComponentProps } from 'react';
import { Linking } from 'react-native';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: Href & string };

export function ExternalLink({ href, ...rest }: Props) {
  return (
    <Link
      target="_blank"
      {...rest}
      href={href}
      onPress={async (event) => {
        if (process.env.EXPO_OS !== 'web') {
          // Prevent the default behavior of linking to the default browser on native.
          event.preventDefault();
          try {
            // eslint-disable-next-line import/no-unresolved
            const mod = await import('expo-web-browser');
            await mod.openBrowserAsync(href);
          } catch {
            // Fallback to plain Linking if expo-web-browser isn't installed
            Linking.openURL(href);
          }
        }
      }}
    />
  );
}
