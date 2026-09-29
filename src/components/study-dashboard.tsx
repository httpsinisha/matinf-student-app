import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Catalog, siteUrl, useContent } from '@/lib/content-api';
import { Preferences, scheduleFollowing } from '@/lib/onboarding-model';
import { dailyAgenda } from '@/lib/dashboard-model';
import type { Schedule } from './schedule-screen';

export function StudyDashboard({ catalog, preferences, active, refreshKey, openSchedule, openCourse, edit }: {
  catalog: Catalog; preferences: Preferences; active: boolean; refreshKey: number;
  openSchedule: (mode?: 'exams') => void; openCourse: (id: number) => void; edit: () => void;
}) {
  const chosen = scheduleFollowing(preferences, catalog.programs, catalog.courses);
  const [semester, setSemester] = useState(1);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    if (!active) return;
    setNow(new Date());
    void AsyncStorage.getItem(`@matinf/schedule-selection:${siteUrl}`).then(raw => {
      if (raw) { const value = JSON.parse(raw); if ([1, 2].includes(value.semester)) setSemester(value.semester); }
    }).catch(() => undefined);
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, [active, refreshKey]);
  const resource = useContent<Schedule>(`/schedule?program_id=${chosen.programId}&year=${chosen.year}&semester=${semester}`);
  useEffect(() => { if (active) void resource.refresh(); }, [active, refreshKey]);
  const data = resource.data?.program?.id === chosen.programId && resource.data.year === chosen.year && resource.data.semester === semester ? resource.data : null;
  const { today, next, running } = dailyAgenda(data?.items || [], now);
  const dayNames = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
  const nextDay = next ? next.offset === 0 ? 'Danas' : next.offset === 1 ? 'Sutra' : dayNames[next.day] : '';
  const exam = [...(data?.exams || [])].filter(item => item.startsAt && Date.parse(item.startsAt) > now.getTime()).sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!))[0];
  const program = catalog.programs.find(item => item.id === chosen.programId);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Promijeni praćenje" onPress={edit} style={s.selection}>
      <View style={s.icon}><Ionicons name="school-outline" size={20} color="#6955ce" /></View>
      <View style={{ flex: 1 }}><Text style={s.caption}>VAŠ STUDIJSKI IZBOR</Text><Text style={s.program}>{program?.title || 'Izaberite studijski program'}</Text><Text style={s.muted}>{chosen.year}. godina · {semester === 1 ? 'Zimski' : 'Ljetni'} semestar{preferences.programYears.length > 1 ? ` · +${preferences.programYears.length - 1} u praćenju` : ''}</Text></View>
      <Ionicons name="chevron-forward" size={18} color="#6955ce" />
    </Pressable>
    <Pressable accessibilityRole="button" onPress={() => next ? openCourse(next.courseId) : openSchedule()} style={s.hero}>
      <View pointerEvents="none" style={s.orbit} /><View style={s.heroTop}><Text style={s.heroLabel}>{running ? 'U TOKU' : 'SLJEDEĆE PREDAVANJE'}</Text><Ionicons name="school-outline" size={27} color="#e7e1ff" /></View>
      <Text style={s.heroTitle}>{next?.course.title || (resource.loading ? 'Učitavanje rasporeda…' : 'Vaš dan, vaš ritam.')}</Text>
      <Text style={s.heroTime}>{next ? `${nextDay} · ${next.start} – ${next.end}` : 'Otvorite raspored nastave'}</Text>
      {next && <View style={s.heroBottom}><Ionicons name="location-outline" size={16} color="white" /><Text style={s.heroMeta}>{next.room}</Text><Text style={s.heroMeta}>{next.staff?.title}</Text></View>}
    </Pressable>
    {resource.error && <Text accessibilityRole="alert" style={s.error}>{data ? 'Prikazan je sačuvan raspored. Povucite za osvježavanje.' : 'Raspored trenutno nije dostupan. Povucite za ponovni pokušaj.'}</Text>}
    <View style={s.heading}><Text style={s.title}>Danas na rasporedu</Text><Pressable accessibilityRole="button" onPress={() => openSchedule()} hitSlop={10}><Text style={s.link}>Cijeli raspored →</Text></Pressable></View>
    {today.length ? today.map((item, index) => <Pressable key={`${item.courseId}-${index}`} accessibilityRole="button" onPress={() => openCourse(item.courseId)} style={s.lesson}>
      <View style={s.time}><Text style={s.timeText}>{item.start}</Text><Text style={s.muted}>{item.end}</Text></View><View style={{ flex: 1 }}><Text style={s.lessonTitle}>{item.course.title}</Text><Text style={s.muted}>{item.room} · {item.kind}</Text></View>
    </Pressable>) : <View style={s.lesson}><Ionicons name="sunny-outline" size={24} color="#a87538" /><Text style={[s.muted, { flex: 1 }]}>{resource.loading ? 'Učitavanje današnjih termina…' : 'Danas nema zakazane nastave.'}</Text></View>}
    <Pressable accessibilityRole="button" onPress={() => openSchedule('exams')} style={s.exam}>
      <View style={s.examIcon}><Ionicons name="calendar-outline" size={26} color="#237c78" /></View><View style={{ flex: 1 }}><Text style={s.caption}>NAJBLIŽI ISPIT</Text><Text style={s.lessonTitle}>{exam?.course.title || 'Pregledajte ispitne rokove'}</Text><Text style={s.muted}>{exam ? `${exam.date.split('-').reverse().join('.')}. · ${exam.start} · ${exam.room}` : 'Termini i podsjetnici na jednom mjestu'}</Text></View><Ionicons name="chevron-forward" size={18} color="#237c78" />
    </Pressable>
  </>;
}
const s = StyleSheet.create({
  selection: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18, padding: 14, backgroundColor: '#efedf9', borderRadius: 19 }, icon: { backgroundColor: 'white', padding: 10, borderRadius: 14 }, caption: { fontSize: 9, letterSpacing: 1.1, fontWeight: '700', color: '#6f6990', marginBottom: 4 }, program: { color: '#29344d', fontWeight: '700', fontSize: 13, lineHeight: 18 }, muted: { color: '#737b8e', fontSize: 12, lineHeight: 18, marginTop: 3 },
  hero: { backgroundColor: '#7057d9', borderRadius: 27, padding: 23, overflow: 'hidden' }, orbit: { position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 28, borderColor: '#8068e3', right: -90, bottom: -90 }, heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, heroLabel: { color: '#eeeaff', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 }, heroTitle: { fontSize: 25, lineHeight: 32, fontWeight: '800', color: 'white', marginVertical: 13 }, heroTime: { color: 'white', fontSize: 15, fontWeight: '600' }, heroBottom: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginTop: 17 }, heroMeta: { color: '#eeeaff', fontSize: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 25, marginBottom: 13 }, title: { fontSize: 17, fontWeight: '700', color: '#26334b', flexShrink: 1 }, link: { fontSize: 11, color: '#6955ce', fontWeight: '600' }, lesson: { backgroundColor: 'white', borderRadius: 19, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 9 }, time: { borderRightWidth: 2, borderColor: '#e8e1fb', paddingRight: 12 }, timeText: { fontSize: 14, color: '#6955ce', fontWeight: '700' }, lessonTitle: { fontSize: 14, color: '#26334b', fontWeight: '700', lineHeight: 20 }, exam: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 17, borderRadius: 22, backgroundColor: '#e4f2ee', marginVertical: 14 }, examIcon: { backgroundColor: '#f5fbf9', padding: 12, borderRadius: 16 }, error: { fontSize: 12, color: '#93602c', marginTop: 10, lineHeight: 18 },
});
