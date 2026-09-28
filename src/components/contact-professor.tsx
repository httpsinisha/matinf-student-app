import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiUrl, useContent } from '@/lib/content-api';

type ContactConfig = { enabled: boolean; testMode: boolean };
export function ContactProfessor({ staffId }: { staffId: number }) {
  const config = useContent<ContactConfig>(`/contact/config?staffId=${staffId}`);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(''); const [email, setEmail] = useState('');
  const [subject, setSubject] = useState(''); const [message, setMessage] = useState('');
  const [requestId, setRequestId] = useState(''); const [code, setCode] = useState('');
  const [status, setStatus] = useState(''); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false);
  const pending = useRef(false);
  if (!config.data?.enabled) return null;
  const send = async () => {
    if (pending.current) return;
    if (!requestId && (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !subject.trim() || !message.trim())) {
      setStatus('Unesite ime, ispravan mejl, naslov i poruku.'); return;
    }
    if (requestId && !/^\d{6}$/.test(code)) { setStatus('Unesite šestocifreni kod iz mejla.'); return; }
    pending.current = true; setBusy(true); setStatus('');
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(`${apiUrl}/contact/${requestId ? 'confirm' : 'request'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify(requestId ? { requestId, code } : { staffId, name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Slanje nije uspjelo.');
      setStatus(result.message);
      if (result.sent) { setSent(true); setMessage(''); setCode(''); }
      else { setRequestId(result.requestId); setCode(''); }
    } catch (error) {
      setStatus(error instanceof Error && error.name === 'AbortError' ? 'Server nije odgovorio na vrijeme. Provjerite mejl prije ponavljanja.' : error instanceof Error ? error.message : 'Provjerite internet vezu.');
    } finally { clearTimeout(timer); pending.current = false; setBusy(false); }
  };
  const editable = !busy && !requestId && !sent;
  return <View style={styles.container}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.button}><Text style={styles.buttonText}>{open ? 'Zatvori obrazac' : 'Pošalji mejl profesoru'}</Text></Pressable>
    {open && <View style={styles.form}>
      <Text style={styles.heading}>Poruka profesoru</Text>
      {config.data.testMode && <Text style={styles.note}>Probni režim: poruka ide na zajedničku probnu adresu profesora. Vašu adresu potvrđujete kodom iz mejla.</Text>}
      <Text style={styles.note}>Potvrdite svoj mejl kodom prije slanja. Profesor dobija vaše ime, adresu i poruku, a vi kopiju.</Text>
      <Text style={styles.label}>Vaše ime</Text><TextInput accessibilityLabel="Vaše ime" style={styles.input} value={name} onChangeText={setName} editable={editable} maxLength={100} autoComplete="name" />
      <Text style={styles.label}>Vaš mejl</Text><TextInput accessibilityLabel="Vaš mejl" style={styles.input} value={email} onChangeText={setEmail} editable={editable} maxLength={254} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
      <Text style={styles.label}>Naslov</Text><TextInput accessibilityLabel="Naslov poruke" style={styles.input} value={subject} onChangeText={setSubject} editable={editable} maxLength={150} />
      {!sent && <><Text style={styles.label}>Poruka</Text><TextInput accessibilityLabel="Poruka profesoru" style={[styles.input, styles.message]} value={message} onChangeText={setMessage} editable={editable} multiline maxLength={5000} textAlignVertical="top" /></>}
      {!!requestId && !sent && <><Text style={styles.label}>Kod iz mejla (važi 10 minuta)</Text><TextInput accessibilityLabel="Kod iz mejla" style={styles.input} value={code} onChangeText={setCode} editable={!busy} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" /></>}
      {!!status && <Text accessibilityLiveRegion="polite" style={styles.note}>{status}</Text>}
      {busy && <ActivityIndicator color="#2057ce" />}
      {!sent && <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void send()} style={[styles.button, busy && { opacity: 0.5 }]}><Text style={styles.buttonText}>{requestId ? 'Potvrdi i pošalji' : 'Nastavi — pošalji kod'}</Text></Pressable>}
      {!!requestId && !sent && <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setRequestId(''); setCode(''); setStatus(''); }} style={styles.secondary}><Text style={styles.link}>Izmijeni poruku / novi kod</Text></Pressable>}
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  container: { marginVertical: 14 }, form: { padding: 16, borderRadius: 16, backgroundColor: '#f2f6fd', marginTop: 12, gap: 8 },
  heading: { fontSize: 21, fontWeight: '700', color: '#16294b' }, note: { fontSize: 14, lineHeight: 21, color: '#425574', marginVertical: 5 },
  label: { color: '#243954', fontWeight: '600', marginTop: 7 }, input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#cbd5e3', borderRadius: 10, padding: 12, fontSize: 16, color: '#16294b' },
  message: { minHeight: 140 }, button: { backgroundColor: '#2057ce', borderRadius: 12, padding: 15, alignItems: 'center' }, buttonText: { color: 'white', fontWeight: '700', fontSize: 15 },
  secondary: { padding: 12, alignItems: 'center' }, link: { color: '#2057ce', fontWeight: '600' },
});
