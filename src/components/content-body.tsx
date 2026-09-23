import { parseDocument } from 'htmlparser2';
import { Alert, Image, Linking, StyleSheet, Text, View } from 'react-native';
import { siteUrl } from '@/lib/content-api';
import type { ReactNode } from 'react';
type DOMNode = ReturnType<typeof parseDocument>['children'][number];

export function safeUrl(value: string): string | null {
  try { const url = new URL(value, siteUrl); return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export async function openUrl(value: string) {
  const url = safeUrl(value);
  if (!url) return;
  try { await Linking.openURL(url); } catch { Alert.alert('Link nije otvoren', 'Na uređaju nije dostupna aplikacija za ovaj link.'); }
}
export function ContentBody({ html }: { html: string }) {
  function render(node: DOMNode, index: number, inline = false): ReactNode {
    if (node.type === 'text') return inline ? node.data : node.data.trim() ? <Text key={index} style={styles.body}>{node.data}</Text> : null;
    if (!('name' in node) || !('children' in node)) return null;
    const name = node.name;
    if (['script', 'style', 'iframe', 'object'].includes(name)) return null;
    if (name === 'img') {
      const url = safeUrl(node.attribs.src || '');
      return url && /^https?:/.test(url) ? <Image key={index} accessibilityLabel={node.attribs.alt || 'Slika uz objavu'} source={{ uri: url }} style={styles.image} resizeMode="contain" /> : null;
    }
    if (name === 'br') return '\n';
    const children = node.children.map((child, i) => render(child, i, !['ul', 'ol', 'div', 'blockquote'].includes(name)));
    if (['ul', 'ol', 'div', 'blockquote'].includes(name)) return <View key={index} style={name === 'blockquote' ? styles.quote : undefined}>{children}</View>;
    return <Text key={index} style={[
      !inline && styles.body, ['h2', 'h3', 'h4'].includes(name) && styles.heading,
      ['strong', 'b'].includes(name) && styles.bold, ['em', 'i'].includes(name) && styles.italic,
      name === 'a' && styles.link,
    ]} accessibilityRole={name === 'a' ? 'link' : undefined} onPress={name === 'a' ? () => void openUrl(node.attribs.href || '') : undefined}>
      {name === 'li' ? '•  ' : ''}{children}
    </Text>;
  }
  return <View>{parseDocument(html).children.map((node, index) => render(node, index))}</View>;
}
const styles = StyleSheet.create({
  body: { color: '#455572', fontSize: 16, lineHeight: 25, marginBottom: 15 },
  heading: { color: '#10254c', fontSize: 21, fontWeight: '700', marginTop: 13, marginBottom: 12 },
  bold: { fontWeight: '700' }, italic: { fontStyle: 'italic' }, link: { color: '#1754d1', textDecorationLine: 'underline' },
  quote: { borderLeftWidth: 3, borderLeftColor: '#1d58cf', paddingLeft: 16, marginVertical: 12 },
  image: { width: '100%', height: 220, borderRadius: 16, marginVertical: 12 },
});
