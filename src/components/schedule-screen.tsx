import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Catalog, Related, siteUrl, useContent } from '@/lib/content-api';
import type { Preferences } from '@/lib/onboarding-model';

type Schedule = { demo: boolean; academicYear: string; note: string; program: Related; year: number; semester: number; items: { course: Related; staff: Related | null; courseId: number; day: number; start: string; end: string; room: string; kind: string }[] };
const days = ['Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak'];
const key = `@matinf/schedule-selection:${siteUrl}`;
function Choice({ title, selected, onPress }: { title: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[s.chip, selected && s.selected]}><Text style={[s.chipText, selected && { color: 'white' }]}>{title}</Text></Pressable>;
}
export function ScheduleScreen({ catalog, preferences, openCourse }: { catalog: Catalog; preferences: Preferences; openCourse: (id: number) => void }) {
  const programs = catalog.programs.filter(item => item.meta.level === 'undergraduate');
  const followed = preferences.programYears.find(value => programs.some(item => String(item.id) === value.split(':')[0]));
  const [selection, setSelection] = useState({ programId: Number(followed?.split(':')[0]) || programs[0]?.id || 0, year: Number(followed?.split(':')[1]) || 1, semester: 1 });
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [day, setDay] = useState(0);
  useEffect(() => {
    if (!programs.length) return;
    let active = true;
    setSelection(value => programs.some(item => item.id === value.programId) ? value : { programId: Number(followed?.split(':')[0]) || programs[0].id, year: Number(followed?.split(':')[1]) || 1, semester: 1 });
    AsyncStorage.getItem(key).then(raw => {
      if (!raw || !active) return;
      const value = JSON.parse(raw);
      if (programs.some(item => item.id === value.programId && value.year >= 1 && value.year <= (item.meta.durationYears || 0)) && [1, 2].includes(value.semester)) setSelection(value);
    }).catch(() => undefined).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [catalog.programs]);
  useEffect(() => { if (loaded && selection.programId) void AsyncStorage.setItem(key, JSON.stringify(selection)).catch(() => undefined); }, [loaded, selection]);
  const program = programs.find(item => item.id === selection.programId);
  const resource = useContent<Schedule>(`/schedule?program_id=${selection.programId}&year=${selection.year}&semester=${selection.semester}`);
  const data = resource.data?.program?.id === selection.programId && resource.data.year === selection.year && resource.data.semester === selection.semester ? resource.data : null;
  return <ScrollView contentContainerStyle={s.page} refreshControl={<RefreshControl refreshing={resource.loading} onRefresh={() => void resource.refresh()} />}>
    <Text style={s.eyebrow}>ORGANIZUJTE SVOJU SEDMICU</Text><Text style={s.title}>Moj raspored</Text>
    <Text style={s.description}>Osnovne studije · predavanja i vježbe. Izbor rasporeda se čuva odvojeno od praćenja obavještenja.</Text>
    <View style={s.notice}><Text style={s.bold}>Demonstracijski raspored · 2026/2027</Text><Text style={s.small}>Termini, sale i raspodjela nastavnika su izmišljeni. Izborni predmeti predstavljaju ogledni izbor; praksa i završni rad se dogovaraju posebno.</Text></View>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={s.selector}><Text style={s.small}>Studijski program</Text><Text style={s.bold}>{program?.title || 'Izaberite program'} {expanded ? '−' : '+'}</Text></Pressable>
    {expanded && programs.map(item => <Choice key={item.id} title={item.title} selected={item.id === selection.programId} onPress={() => { setSelection(value => ({ ...value, programId: item.id, year: 1 })); setExpanded(false); }} />)}
    <View style={s.row}>{Array.from({ length: program?.meta.durationYears || 0 }, (_, index) => index + 1).map(year => <Choice key={year} title={`${year}. godina`} selected={selection.year === year} onPress={() => setSelection(value => ({ ...value, year }))} />)}</View>
    <View style={s.row}>{['Zimski semestar', 'Ljetni semestar'].map((title, i) => <Choice key={title} title={title} selected={selection.semester === i + 1} onPress={() => setSelection(value => ({ ...value, semester: i + 1 }))} />)}</View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>{['Sedmica', ...days].map((name, i) => <Choice key={name} title={name} selected={day === i} onPress={() => setDay(i)} />)}</ScrollView>
    {resource.loading && !data && <ActivityIndicator color="#2057ce" />}
    {resource.error && <View style={s.notice}><Text style={s.bold}>{data ? 'Sačuvan raspored — provjerite da li je ažuran.' : resource.missing ? 'Raspored još nije dostupan na sajtu.' : resource.error}</Text><Pressable accessibilityRole="button" onPress={() => void resource.refresh()}><Text style={s.link}>Pokušaj ponovo</Text></Pressable></View>}
    {data && days.map((name, i) => {
      if (day && day !== i + 1) return null;
      const events = data.items.filter(event => event.day === i + 1);
      return <View key={name}><Text style={s.day}>{name}</Text>{!events.length && <Text style={s.small}>Nema planirane nastave.</Text>}{events.map((event, index) => <Pressable key={`${event.courseId}-${event.kind}-${index}`} accessibilityRole="button" onPress={() => openCourse(event.courseId)} style={s.event}>
        <View style={s.time}><Text style={s.timeText}>{event.start}</Text><Text style={s.small}>{event.end}</Text></View>
        <View style={{ flex: 1 }}><Text style={s.kind}>{event.kind}</Text><Text style={s.bold}>{event.course.title}</Text><Text style={s.small}>{event.room}</Text><Text style={s.small}>{event.staff?.title || 'Nastavnik nije naveden'}</Text></View>
      </Pressable>)}</View>;
    })}
  </ScrollView>;
}
const s = StyleSheet.create({
  page: { padding: 22, paddingBottom: 40 }, eyebrow: { color: '#2057ce', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontSize: 32, fontWeight: '800', color: '#13264c', marginVertical: 12 }, description: { fontSize: 15, color: '#62718a', lineHeight: 23, marginBottom: 16 },
  notice: { backgroundColor: '#fff5dc', padding: 15, borderRadius: 15, gap: 6, marginBottom: 16 }, bold: { color: '#172b50', fontSize: 16, fontWeight: '600', lineHeight: 23 }, small: { color: '#64748b', fontSize: 13, lineHeight: 20 },
  selector: { padding: 16, backgroundColor: '#f0f5ff', borderRadius: 14, gap: 6 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  chip: { borderWidth: 1, borderColor: '#dce5f2', padding: 11, borderRadius: 12, marginVertical: 3 }, selected: { backgroundColor: '#2057ce', borderColor: '#2057ce' }, chipText: { color: '#334b70', fontSize: 14 },
  day: { fontSize: 21, color: '#172b50', fontWeight: '700', marginTop: 18, marginBottom: 10 }, event: { flexDirection: 'row', gap: 14, padding: 15, borderWidth: 1, borderColor: '#e1e8f2', borderRadius: 16, marginBottom: 10 },
  time: { width: 48 }, timeText: { color: '#2057ce', fontSize: 16, fontWeight: '700' }, kind: { color: '#2057ce', fontSize: 12, marginBottom: 4 }, link: { color: '#2057ce', paddingVertical: 12 },
});
