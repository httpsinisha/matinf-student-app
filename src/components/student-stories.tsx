import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DomUtils, parseDocument } from 'htmlparser2';
import { ContentBody, safeUrl } from './content-body';

const photos = [
  { source: require('../../assets/images/stories/software.jpg'), alt: 'Radni prostor sa računarom za razvoj softvera' },
  { source: require('../../assets/images/stories/library.jpg'), alt: 'Biblioteka i prostor za istraživanje' },
  { source: require('../../assets/images/stories/community.jpg'), alt: 'Zajedničko učenje i razmjena ideja' },
];
const plain = (html: string) => DomUtils.textContent(parseDocument(html)).trim();
function splitStories(html: string) {
  const parts = html.split(/(?=<h2\b)/i);
  const intro = parts.shift() || '';
  const stories = parts.flatMap(part => {
    const heading = part.match(/^<h2\b[^>]*>([\s\S]*?)<\/h2>/i);
    if (!heading) return [];
    let body = part.slice(heading[0].length);
    const title = body.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i);
    if (title) body = body.replace(title[0], '');
    const program = body.match(/<p\b[^>]*>\s*<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>\s*<\/p>/i);
    if (program) body = body.replace(program[0], '');
    const image = DomUtils.findOne(node => node.name === 'img', parseDocument(body).children, true);
    const url = image ? safeUrl(image.attribs.src || '') : null;
    if (image && url && /^https?:/.test(url)) body = body.replace(/<img\b[^>]*>/i, '');
    return [{ name: plain(heading[1]), title: title ? plain(title[1]) : '', program: program ? plain(program[1]) : '', body, image: url && /^https?:/.test(url) ? url : null, alt: image?.attribs.alt }];
  });
  return { intro, stories };
}
type Story = ReturnType<typeof splitStories>['stories'][number];
function StoryCard({ story, index }: { story: Story; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const fallback = photos[index % photos.length];
  const tone = ['#eee9fc', '#e4f2ef', '#fff0e6'][index % 3];
  return <View style={s.card}>
    <View style={s.cover}>
      <Image source={story.image && !imageFailed ? { uri: story.image } : fallback.source} onError={() => setImageFailed(true)} accessibilityLabel={story.image && !imageFailed ? story.alt || 'Fotografija uz studentsku priču' : fallback.alt} style={s.photo} resizeMode="cover" />
      <View style={s.photoBadge}><Ionicons name="sparkles-outline" color="#6955ce" size={14} /><Text style={s.badgeText}>STUDENTSKA PRIČA / {String(index + 1).padStart(2, '0')}</Text></View>
    </View>
    <View style={s.content}>
      <View style={s.identity}><View style={[s.avatar, { backgroundColor: tone }]}><Text style={s.initials}>{story.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('')}</Text></View><View style={{ flex: 1 }}><Text style={s.name}>{story.name}</Text>{!!story.program && <Text style={s.program}>{story.program}</Text>}</View></View>
      {!!story.title && <Text style={s.title}>{story.title}</Text>}
      {expanded ? <View style={s.body}><ContentBody html={story.body} /></View> : <Text numberOfLines={3} style={s.preview}>{plain(story.body)}</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? 'Sažmi priču' : 'Pročitaj priču'}: ${story.name}`} accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={s.read}><Text style={s.readText}>{expanded ? 'Sažmi priču' : 'Pročitaj priču'}</Text><Ionicons name={expanded ? 'chevron-up' : 'arrow-forward'} color="#6955ce" size={18} /></Pressable>
    </View>
  </View>;
}
export function StudentStories({ html }: { html: string }) {
  const { intro, stories } = useMemo(() => splitStories(html), [html]);
  if (!stories.length) return <ContentBody html={html} />;
  return <View><View style={s.intro}><ContentBody html={intro} /></View>{stories.map((story, index) => <StoryCard key={`${story.name}-${index}`} story={story} index={index} />)}</View>;
}
const s = StyleSheet.create({
  intro: { marginBottom: 8 }, card: { backgroundColor: 'white', borderRadius: 25, overflow: 'hidden', borderWidth: 1, borderColor: '#e9e6f1', marginBottom: 24 },
  cover: { position: 'relative' }, photo: { width: '100%', height: 195 }, photoBadge: { position: 'absolute', left: 16, bottom: 14, backgroundColor: '#ffffffed', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 7 }, badgeText: { color: '#544575', fontSize: 9, fontWeight: '700', letterSpacing: .8 },
  content: { padding: 20 }, identity: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 19 }, avatar: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, initials: { color: '#6955ce', fontSize: 16, fontWeight: '700' }, name: { color: '#26334b', fontWeight: '700', fontSize: 16 }, program: { color: '#79778b', fontSize: 12, lineHeight: 18, marginTop: 4 }, title: { color: '#26334b', fontSize: 21, lineHeight: 28, fontWeight: '800', marginBottom: 12, letterSpacing: -.4 }, preview: { color: '#6f788b', fontSize: 14, lineHeight: 23 }, body: { paddingTop: 2 }, read: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#eeebf5', marginTop: 17, paddingTop: 14, minHeight: 48 }, readText: { color: '#6955ce', fontSize: 13, fontWeight: '700' },
});
