import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useReminders } from '@/lib/reminders';

export function RemindersScreen({ openSchedule }: { openSchedule: (value: { programId: number; year: number; scheduleMode: 'graduate' | 'exams'; examId: string }) => void }) {
  const reminders = useReminders();
  return <ScrollView contentContainerStyle={s.page}>
    <Text style={s.title}>Moji podsjetnici</Text>
    <Text style={s.description}>Podsjetnik uključite uz termin u rasporedu ispita. Promjene termina provjeravaju se kada otvorite aplikaciju i imate internet vezu.</Text>
    {!reminders.records.length && <Text style={s.description}>Nemate uključenih podsjetnika.</Text>}
    {[...reminders.records].sort((a, b) => a.fireAt - b.fireAt).map(record => <View key={record.key} style={s.card}>
      <Text style={s.name}>{record.title}</Text>
      <Text style={s.description}>{new Date(record.startsAt).toLocaleString('sr-Latn', { timeZone: 'Europe/Sarajevo', dateStyle: 'medium', timeStyle: 'short' })} · {record.room}</Text>
      <Text style={s.description}>{record.minutes === 60 ? 'Sat' : 'Dan'} prije ispita{record.fireAt <= Date.now() ? ' · vrijeme podsjetnika je prošlo' : ''}</Text>
      <Pressable accessibilityRole="button" onPress={() => openSchedule({ programId: record.programId, year: record.year, scheduleMode: record.graduate ? 'graduate' : 'exams', examId: record.examId })}><Text style={s.action}>Otvori raspored</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => void reminders.cancel(record.key).catch(error => Alert.alert('Podsjetnik', error.message))}><Text style={s.action}>Otkaži podsjetnik</Text></Pressable>
    </View>)}
  </ScrollView>;
}
const s = StyleSheet.create({ page: { padding: 22, backgroundColor: '#f6f6fa', minHeight: '100%' }, title: { fontSize: 28, fontWeight: '800', color: '#13264c' }, description: { color: '#62718a', lineHeight: 22, marginVertical: 8 }, card: { backgroundColor: 'white', padding: 18, borderRadius: 16, marginTop: 16 }, name: { color: '#172b50', fontSize: 17, fontWeight: '700' }, action: { color: '#6955ce', paddingVertical: 13, fontWeight: '600' } });
