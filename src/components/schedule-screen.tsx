import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Catalog, Related, siteUrl, useContent } from '@/lib/content-api';
import { Preferences, scheduleFollowing } from '@/lib/onboarding-model';
import { useReminders } from '@/lib/reminders';

type Exam = { id?: string; startsAt?: string; course: Related; courseId: number; year: number; period: string; date: string; start: string; room: string; staff: Related | null };
export type Schedule = { demo: boolean; academicYear: string; note: string; program: Related; year: number; semester: number; exams?: Exam[]; graduateExams?: Exam[]; items: { course: Related; staff: Related | null; courseId: number; day: number; start: string; end: string; room: string; kind: string }[] };
const days = ['Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak'];
const key = `@matinf/schedule-selection:${siteUrl}`;
function Choice({ title, selected, onPress }: { title: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[s.chip, selected && s.selected]}><Text style={[s.chipText, selected && { color: 'white' }]}>{title}</Text></Pressable>;
}
export function ScheduleScreen({ catalog, preferences, openCourse, initial }: { catalog: Catalog; preferences: Preferences; openCourse: (id: number) => void; initial?: { programId?: number; year?: number; scheduleMode?: 'exams' | 'graduate'; examId?: string } }) {
  const programs = catalog.programs;
  const followed = scheduleFollowing(preferences, programs, catalog.courses);
  const [selection, setSelection] = useState({ programId: initial?.programId || followed.programId, year: initial?.year || followed.year, semester: 1 });
  const reminders = useReminders();
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [day, setDay] = useState(() => { const day = new Date().getDay(); return day > 0 && day < 6 ? day : 0; });
  const [mode, setMode] = useState<'classes' | 'exams' | 'graduate'>(initial?.scheduleMode || 'classes');
  const [period, setPeriod] = useState('');
  useEffect(() => {
    if (!initial?.programId) setSelection(value => ({ ...value, ...followed }));
  }, [followed.programId, followed.year]);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(key).then(raw => {
      if (!raw || !active) return;
      const value = JSON.parse(raw);
      // Only the semester survives reopening. Program/year follow saved choices,
      // including installations with the old independent schedule selection.
      if ([1, 2].includes(value.semester)) setSelection(current => ({ ...current, semester: value.semester }));
    }).catch(() => undefined).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (loaded) void AsyncStorage.setItem(key, JSON.stringify({ semester: selection.semester })).catch(() => undefined); }, [loaded, selection.semester]);
  const program = programs.find(item => item.id === selection.programId);
  const resource = useContent<Schedule>(`/schedule?program_id=${selection.programId}&year=${selection.year}&semester=${selection.semester}`);
  const data = resource.data?.program?.id === selection.programId && resource.data.year === selection.year && resource.data.semester === selection.semester ? resource.data : null;
  const exams = mode === 'graduate' ? (data?.graduateExams || []).filter(exam => exam.year === 4) : data?.exams || [];
  useEffect(() => {
    if (!data || resource.loading || resource.error) return;
    if (data.exams) void reminders.reconcile(data.exams, selection.programId, selection.year, false).catch(() => {});
    if (data.graduateExams) void reminders.reconcile(data.graduateExams, selection.programId, 4, true).catch(() => {});
  }, [data, resource.loading, resource.error, reminders.reconcile]);
  async function changeReminder(exam: Exam, minutes?: number) {
    setBusy(true);
    try {
      const scope = `${selection.programId}:${mode === 'graduate' ? 'graduate' : selection.year}`;
      if (minutes) await reminders.add(exam, selection.programId, mode === 'graduate' ? 4 : selection.year, mode === 'graduate', minutes);
      else await reminders.cancel(`${scope}:${exam.id}`);
    } catch (error) { Alert.alert('Podsjetnik', error instanceof Error ? error.message : 'Podsjetnik nije sačuvan. Pokušajte ponovo.'); }
    finally { setBusy(false); }
  }
  function chooseReminder(exam: Exam) {
    Alert.alert('Podsjetnik za ispit', exam.course.title, [
      { text: 'Sat prije', onPress: () => void changeReminder(exam, 60) },
      { text: 'Dan prije', onPress: () => void changeReminder(exam, 1440) },
      { text: 'Odustani', style: 'cancel' },
    ]);
  }
  const periods = [...new Set(exams.map(item => item.period))];
  const activePeriod = periods.includes(period) ? period : exams.find(exam => exam.id === initial?.examId)?.period || periods[0];
  return <ScrollView contentContainerStyle={s.page} refreshControl={<RefreshControl refreshing={resource.loading} onRefresh={() => void resource.refresh()} />}>
    <Text style={s.eyebrow}>ORGANIZUJTE SVOJU SEDMICU</Text><Text style={s.title}>Moj raspored</Text>
    <Text style={s.description}>Vaši časovi, ispiti i podsjetnici na jednom mjestu.</Text>
    <View style={s.row}>{([['classes', 'Nastava'], ['exams', 'Ispiti'], ['graduate', 'Apsolventi']] as const).map(([value, title]) => <Choice key={value} title={title} selected={mode === value} onPress={() => { setMode(value); setPeriod(''); }} />)}</View>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={s.selector}><Text style={s.small}>STUDIJSKI IZBOR · {expanded ? 'Zatvori' : 'Promijeni'}</Text><Text style={s.bold}>{program?.title || 'Izaberite program'}</Text><Text style={s.small}>{mode === 'graduate' ? 'Predmeti 4. godine' : `${selection.year}. godina · ${selection.semester === 1 ? 'Zimski' : 'Ljetni'} semestar`} · {data?.academicYear || '2026/2027'}</Text></Pressable>
    {expanded && <View style={s.selectionPanel}><Text style={s.small}>Privremeni pregled drugog rasporeda. Praćenje ostaje sačuvano.</Text>{programs.map(item => <Choice key={item.id} title={item.title} selected={item.id === selection.programId} onPress={() => { setSelection(value => ({ ...value, programId: item.id, year: 1 })); }} />)}
    {mode !== 'graduate' && <View style={s.row}>{Array.from({ length: program?.meta.durationYears || 0 }, (_, index) => index + 1).map(year => <Choice key={year} title={`${year}. godina`} selected={selection.year === year} onPress={() => setSelection(value => ({ ...value, year }))} />)}</View>}
    {mode === 'classes' && <View style={s.row}>{['Zimski semestar', 'Ljetni semestar'].map((title, i) => <Choice key={title} title={title} selected={selection.semester === i + 1} onPress={() => setSelection(value => ({ ...value, semester: i + 1 }))} />)}</View>}
    <Pressable accessibilityRole="button" onPress={() => setExpanded(false)} style={s.done}><Text style={{ color: 'white', fontWeight: '700' }}>Prikaži raspored</Text></Pressable></View>}
    {mode === 'classes' && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>{['Sve', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet'].map((name, i) => <Choice key={name} title={name} selected={day === i} onPress={() => setDay(i)} />)}</ScrollView>}
    {mode === 'graduate' && <View style={s.notice}><Text style={s.bold}>Apsolventski rokovi · predmeti četvrte godine</Text><Text style={s.small}>Za studente koji su odslušali svu nastavu. Prikazani su samo objavljeni apsolventski termini.</Text></View>}
    {mode !== 'classes' && <><View style={s.row}>{periods.map(value => <Choice key={value} title={value} selected={activePeriod === value} onPress={() => setPeriod(value)} />)}</View>{exams.filter(exam => exam.period === activePeriod).map(exam => {
      const record = reminders.records.find(row => row.key === `${selection.programId}:${mode === 'graduate' ? 'graduate' : selection.year}:${exam.id}`);
      return <View key={exam.id || `${exam.courseId}-${exam.date}`} style={[s.event, { flexDirection: 'column', gap: 6 }]}>
        <Pressable accessibilityRole="button" onPress={() => openCourse(exam.courseId)}><Text style={s.kind}>{exam.date.split('-').reverse().join('.')}. · {exam.start} · {exam.year}. godina</Text><Text style={s.bold}>{exam.course.title}</Text><Text style={s.small}>{exam.room} · {exam.staff?.title}</Text></Pressable>
        {record && <Text style={s.small}>Podsjetnik: {record.minutes === 60 ? 'sat' : 'dan'} prije ispita</Text>}
        {Platform.OS === 'android' ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => record ? void changeReminder(exam) : chooseReminder(exam)}><Text style={s.link}>{busy ? 'Čuvanje…' : record ? 'Otkaži podsjetnik' : 'Podsjeti me'}</Text></Pressable> : <Text style={s.small}>Podsjetnici su dostupni u Android aplikaciji.</Text>}
      </View>;
    })}{data && !exams.length && <Text style={s.small}>Ispitni termini još nisu dostupni. Osvježite raspored nakon ažuriranja sajta.</Text>}</>}
    {resource.loading && !data && <ActivityIndicator color="#6955ce" />}
    {resource.error && <View style={s.notice}><Text style={s.bold}>{data ? 'Sačuvan raspored — provjerite da li je ažuran.' : resource.missing ? 'Raspored još nije dostupan na sajtu.' : resource.error}</Text><Pressable accessibilityRole="button" onPress={() => void resource.refresh()}><Text style={s.link}>Pokušaj ponovo</Text></Pressable></View>}
    {data && mode === 'classes' && days.map((name, i) => {
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
  selectionPanel: { backgroundColor: 'white', padding: 15, borderRadius: 20, marginBottom: 12 }, done: { backgroundColor: '#7057d9', padding: 14, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  page: { padding: 20, paddingBottom: 35, backgroundColor: '#f6f6fa', minHeight: '100%' }, eyebrow: { color: '#6955ce', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontSize: 29, fontWeight: '800', color: '#13264c', marginVertical: 12 }, description: { fontSize: 13, color: '#62718a', lineHeight: 23, marginBottom: 16 },
  notice: { backgroundColor: '#fff5dc', padding: 15, borderRadius: 15, gap: 6, marginBottom: 16 }, bold: { color: '#172b50', fontSize: 16, fontWeight: '600', lineHeight: 23 }, small: { color: '#64748b', fontSize: 13, lineHeight: 20 },
  selector: { padding: 17, backgroundColor: '#efebfb', borderRadius: 21, gap: 5, marginVertical: 12 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  chip: { backgroundColor: 'white', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 23, marginVertical: 3, minHeight: 44 }, selected: { backgroundColor: '#6955ce', borderColor: '#6955ce' }, chipText: { color: '#334b70', fontSize: 14 },
  day: { fontSize: 21, color: '#172b50', fontWeight: '700', marginTop: 18, marginBottom: 10 }, event: { backgroundColor: 'white', flexDirection: 'row', gap: 14, padding: 18, borderWidth: 1, borderColor: '#eeedf5', borderRadius: 22, marginBottom: 10 },
  time: { width: 60, borderRightWidth: 2, borderColor: '#e8e1fb', paddingRight: 10 }, timeText: { color: '#6955ce', fontSize: 16, fontWeight: '700' }, kind: { color: '#6955ce', fontSize: 12, marginBottom: 4 }, link: { color: '#6955ce', paddingVertical: 12 },
});
