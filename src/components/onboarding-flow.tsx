import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { siteUrl } from "@/lib/content-api";
import { followedCourses, parsePreferences, Preferences, restoreProgramId, toggleSelection } from "@/lib/onboarding-model";
import { OnboardingScreen } from "./onboarding-screen";

const storageKey = "@matinf/onboarding/v1";

function Button({ title, onPress, secondary = false, disabled = false }: {
  title: string; onPress: () => void; secondary?: boolean; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, (pressed || disabled) && { opacity: 0.55 }]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>
  </Pressable>;
}

export function OnboardingFlow({ programs, courses, onDone, onCancel, editMode = false }: {
  programs: { id: string; name: string; level: string; years: number }[];
  courses: { id: string; name: string; programId: string; year: number }[];
  onDone: (value: Preferences) => void;
  onCancel?: () => void;
  editMode?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(editMode ? 1 : 0);
  const [saved, setSaved] = useState<Preferences | null>(null);
  const [editing, setEditing] = useState(editMode);
  const [programId, setProgramId] = useState(programs[0]?.id || '');
  const [programYears, setProgramYears] = useState<string[]>([]);
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  const levels = [...new Set(['Osnovne studije', 'Master studije', 'Doktorske studije', ...programs.map(item => item.level)])].filter(level => programs.some(item => item.level === level));
  const orderedPrograms = levels.flatMap(level => programs.filter(item => item.level === level));

  useEffect(() => {
    AsyncStorage.getItem(storageKey).then((raw) => {
      const value = parsePreferences(raw);
      setSaved(value);
      setProgramId(restoreProgramId(value?.backend === siteUrl ? value : null, orderedPrograms, courses));
      if (value?.backend === siteUrl) {
        setProgramYears(value.programYears.filter(id => programs.some(program => id.startsWith(program.id + ':') && Number(id.split(':')[1]) <= program.years)));
        setCourseIds(value.courseIds.filter(id => courses.some(course => course.id === id)));
      }
    }).catch(() => setError("Nije moguće učitati podešavanja. Pokušajte ponovo."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (busyRef.current) return true;
      if (saved && !editing) return false;
      if (editing && step === 1) { onCancel?.(); return true; }
      if (step > 0) { setStep((value) => value - 1); return true; }
      if (editing) { onCancel?.(); return true; }
      return false;
    });
    return () => listener.remove();
  }, [step, saved, editing, onCancel]);

  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [step]);

  async function finish(requestNotifications: boolean, clearSelections = false, preserveNotifications = false) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    let permission: Preferences["permission"] = "not-requested";
    try {
      if (requestNotifications) {
        try {
          if (Platform.OS === "web" || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) permission = "unavailable";
          else {
            // Import only in a native app build: the package's root module
            // reports an error when loaded in Android Expo Go (SDK 53+).
            const notifications: typeof import("expo-notifications") = require("expo-notifications");
            if (Platform.OS === "android") await notifications.setNotificationChannelAsync("academic", {
              name: "Akademska obavještenja", importance: notifications.AndroidImportance.DEFAULT,
            });
            const current = await notifications.getPermissionsAsync();
            const result = current.granted || !current.canAskAgain ? current : await notifications.requestPermissionsAsync();
            permission = result.granted ? "granted" : "denied";
          }
        } catch { permission = "unavailable"; }
      }
      const value: Preferences = {
        version: 1, completed: true,
        programYears: clearSelections ? [] : programYears,
        courseIds: clearSelections ? [] : courseIds,
        notificationsRequested: requestNotifications, permission,
        syncStatus: requestNotifications ? "pending" : "not-needed",
        backend: siteUrl, selectedProgramId: programId,
        ...(preserveNotifications && saved ? { notificationsRequested: saved.notificationsRequested, permission: saved.permission, syncStatus: saved.syncStatus } : {}),
      };
      await AsyncStorage.setItem(storageKey, JSON.stringify(value));
      setSaved(value);
      setProgramYears(value.programYears);
      setCourseIds(value.courseIds);
      setEditing(false);
      onDone(value);
    } catch {
      setError("Podešavanja nisu sačuvana. Pokušajte ponovo.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.loading}><ActivityIndicator color="#6955ce" accessibilityLabel="Učitavanje podešavanja" /></SafeAreaView>;

  if (step === 0 && (!saved || editing)) return <View style={{ flex: 1 }}>
    <OnboardingScreen onContinue={() => { setError(null); setStep(1); }} onSkip={() => void finish(false, true)} />
    {error && <View style={styles.banner}><Text accessibilityRole="alert" style={styles.error}>{error}</Text></View>}
    {busy && <View style={styles.busyOverlay}><ActivityIndicator color="#6955ce" /></View>}
  </View>;

  const complete = !!saved && !editing;
  const effectiveCourses = followedCourses(programYears, courseIds, courses);
  const followedPrograms = orderedPrograms.filter(item => programYears.some(id => id.startsWith(item.id + ':')) || effectiveCourses.some(course => course.programId === item.id));
  const selectionCount = programYears.length + courseIds.length;

  return <SafeAreaView style={styles.safe}>
    <ScrollView key={complete ? "complete" : step} ref={scroll} contentContainerStyle={styles.page}>
      <View style={styles.topbar}>
        <Text style={styles.wordmark}>MATINF</Text>
        <Text style={styles.badge}>Opciono</Text>
      </View>
      {!complete && <Pressable accessibilityRole="button" onPress={() => editMode && step === 1 ? onCancel?.() : setStep((value) => Math.max(0, value - 1))} disabled={busy} style={styles.back}>
        <Text style={styles.link}>‹  Nazad</Text>
      </Pressable>}
      <Text style={styles.eyebrow}>{complete ? "DOBRO DOŠLI" : editMode ? "PODEŠAVANJA PRAĆENJA" : `KORAK ${step + 1} OD 3`}</Text>
      <Text accessibilityRole="header" style={styles.title}>{complete ? "Sve je spremno\nza početak." : step === 1 ? "Šta želite\nda pratite?" : "Budite u toku."}</Text>
      <Text style={styles.description}>{complete
        ? "Vaš izbor je sačuvan na ovom uređaju. Možete ga promijeniti u bilo kom trenutku."
        : step === 1 ? "Odaberite godine studija, pojedinačne predmete ili oboje."
          : "Dozvolite obavještenja o važnim informacijama i sadržajima koje pratite."}</Text>

      {complete ? <>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vaša podešavanja</Text>
          <Text style={styles.cardText}>Godine studija: {saved.programYears.length}{"\n"}Ukupno predmeta: {effectiveCourses.length}</Text>
          <Text style={styles.cardText}>{!saved.notificationsRequested ? "Obavještenja su isključena."
            : saved.permission === "granted" ? "Dozvola za obavještenja je odobrena. Status povezivanja dostupan je u odjeljku Više."
              : saved.permission === "denied" ? "Obavještenja nisu dozvoljena. Dozvolu možete promijeniti u podešavanjima uređaja."
                : "Dozvola za obavještenja trenutno nije dostupna. Vaš izbor je sačuvan."}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Novosti i obavještenja</Text>
          <Text style={styles.cardText}>Trenutno nema dostupnih objava.</Text>
        </View>
        <Button title="Podesi praćenje" onPress={() => { setStep(1); setEditing(true); }} />
        <Button title="Pogledaj uvod" secondary onPress={() => { setStep(0); setEditing(true); }} />
        <Text style={styles.demo}>Nezvanična akademska demonstracija</Text>
      </> : step === 1 ? <>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vaš izbor za praćenje</Text>
          <Text accessibilityLiveRegion="polite" style={styles.cardText}>Programi: {followedPrograms.length} · Godine: {programYears.length} · Predmeti: {effectiveCourses.length}</Text>
          {followedPrograms.map(item => {
            const years = programYears.filter(id => id.startsWith(item.id + ':')).map(id => id.split(':')[1]);
            const extra = courses.filter(course => course.programId === item.id && courseIds.includes(course.id) && !programYears.includes(`${course.programId}:${course.year}`));
            return <View key={item.id} style={styles.summaryProgram}>
              <Text style={styles.hint}>{item.level}</Text>
              <Text style={styles.programName}>{item.name}</Text>
              {!!years.length && <Text style={styles.cardText}>Godine: {years.join(', ')} · svi njihovi predmeti</Text>}
              {!!extra.length && <Text style={styles.cardText}>Dodatni predmeti: {extra.map(course => course.name).join(', ')}</Text>}
              <Pressable accessibilityRole="button" accessibilityLabel={`Ukloni praćenje: ${item.name}`} onPress={() => {
                setProgramYears(values => values.filter(id => !id.startsWith(item.id + ':')));
                setCourseIds(values => values.filter(id => !courses.some(course => course.id === id && course.programId === item.id)));
              }} style={styles.edit}><Text style={styles.link}>Ukloni praćenje programa</Text></Pressable>
            </View>;
          })}
          {!selectionCount && <Text style={styles.cardText}>Samo opšta obavještenja. Označite godinu ili predmet ispod.</Text>}
          <Text style={styles.hint}>Promjene se primjenjuju kada sačuvate izbor.</Text>
          {editMode && <Button title={busy ? "Čuvanje…" : "Sačuvaj izbor"} disabled={busy} onPress={() => void finish(false, false, true)} />}
        </View>
        <Text style={styles.section}>Dodajte ili uredite praćenja</Text>
        <Text style={styles.hint}>Možete pratiti više programa sa različitih nivoa studija. Otvorite karticu i označite godine ili pojedinačne predmete.</Text>
        {!programs.length && <Text style={styles.error}>Katalog trenutno nije dostupan. Možete nastaviti bez izbora i podesiti praćenje kasnije.</Text>}
        {levels.map(level => <View key={level}>
          <Text accessibilityRole="header" style={styles.section}>{level}</Text>
          {programs.filter(item => item.level === level).map(item => {
            const expanded = programId === item.id;
            const years = programYears.filter(id => id.startsWith(item.id + ':')).map(id => id.split(':')[1]);
            const count = effectiveCourses.filter(course => course.programId === item.id).length;
            const following = years.length > 0 || count > 0;
            return <View key={item.id} style={[styles.programCard, following && styles.followedCard]}>
              <Pressable accessibilityLabel={item.name} accessibilityRole="button" accessibilityState={{ expanded }}
                onPress={() => setProgramId(expanded ? '' : item.id)} style={styles.programHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.programName}>{item.name}</Text>
                  <Text style={[styles.hint, following && styles.followedText]}>{following ? `✓ Pratite · Godine: ${years.join(', ') || '—'} · Predmeti: ${count}` : 'Ne pratite ovaj program'}</Text>
                </View>
                <Text style={styles.check}>{expanded ? '−' : '+'}</Text>
              </Pressable>
              {expanded && <View style={styles.programBody}>
                <Text style={styles.section}>Godina studija</Text>
                <Text style={styles.hint}>Izabrana godina uključuje sve njene predmete i obavještenja. Za praćenje samo pojedinih predmeta ostavite godinu neoznačenu.</Text>
                <View style={styles.years}>{Array.from({ length: item.years }, (_, i) => i + 1).map(year => {
                  const id = `${item.id}:${year}`;
                  const checked = programYears.includes(id);
                  return <Pressable key={id} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={`${year}. godina, ${item.name}`}
                    onPress={() => setProgramYears(values => toggleSelection(values, id))} style={[styles.year, checked && styles.selected]}>
                    <Text style={styles.programName}>{checked ? '✓ ' : ''}{year}. godina</Text>
                  </Pressable>;
                })}</View>
                <Text style={styles.section}>Predmeti</Text>
                {courses.filter(course => course.programId === item.id).map(course => {
                  const included = programYears.includes(`${course.programId}:${course.year}`);
                  const checked = included || courseIds.includes(course.id);
                  return <Pressable key={course.id} accessibilityRole="checkbox" accessibilityLabel={course.name} accessibilityState={{ checked, disabled: included }} disabled={included}
                    onPress={() => setCourseIds(values => toggleSelection(values, course.id))} style={[styles.program, checked && styles.selected]}>
                    <View style={{ flex: 1 }}><Text style={styles.programName}>{course.name}</Text>
                      <Text style={styles.hint}>{course.year}. godina{included ? ' · Uključeno praćenjem godine' : ''}</Text></View>
                    <Text style={styles.check}>{checked ? '✓' : '+'}</Text>
                  </Pressable>;
                })}
              </View>}
            </View>;
          })}
        </View>)}
        <Text accessibilityLiveRegion="polite" style={styles.selectionSummary}>Ukupno: {followedPrograms.length} programa · {programYears.length} godina studija · {effectiveCourses.length} predmeta</Text>
        {editMode ? <>
          <Button title={busy ? "Čuvanje…" : "Sačuvaj izbor"} disabled={busy} onPress={() => void finish(false, false, true)} />
          <Button title="Podešavanja dozvole za obavještenja" secondary disabled={busy} onPress={() => setStep(2)} />
        </> : <>
          <Button title="Nastavi" onPress={() => setStep(2)} />
          <Button title="Preskoči izbor" secondary onPress={() => { setProgramYears([]); setCourseIds([]); setStep(2); }} />
        </>}
      </> : <>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vaš izbor</Text>
          {programYears.map((id) => { const [pid, year] = id.split(":"); return <Text key={id} style={styles.cardText}>{programs.find((item) => item.id === pid)?.name ?? pid} · {year}. godina</Text>; })}
          {courseIds.map((id) => <Text key={id} style={styles.cardText}>{courses.find((course) => course.id === id)?.name ?? id}</Text>)}
          {!selectionCount && <Text style={styles.cardText}>Samo opšta obavještenja. Niste izabrali godine ili predmete.</Text>}
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => setStep(1)} style={styles.edit}><Text style={styles.link}>Promijeni izbor</Text></Pressable>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vi odlučujete</Text>
          <Text style={styles.cardText}>Dozvolu ćemo zatražiti tek kada pritisnete dugme ispod. Možete nastaviti i bez obavještenja.</Text>
        </View>
        <View accessible accessibilityLabel="Korak 3 od 3" style={styles.dots}>{[0, 1, 2].map((index) => <View key={index} style={[styles.dot, index === 2 && styles.activeDot]} />)}</View>
        <Button title={busy ? "Čuvanje…" : "Dozvoli obavještenja"} disabled={busy} onPress={() => void finish(true)} />
        <Button title="Ne sada" secondary disabled={busy} onPress={() => void finish(false)} />
      </>}
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "white" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "white" },
  page: { padding: 24, paddingTop: 30, width: "100%", maxWidth: 540, alignSelf: "center", flexGrow: 1 },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  wordmark: { color: "#26334b", fontWeight: "800", fontSize: 26 },
  badge: { color: "#4d5b78", backgroundColor: "#efebfb", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 },
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center", marginBottom: 12 },
  link: { color: "#6955ce", fontSize: 17, fontWeight: "500" },
  eyebrow: { color: "#6955ce", fontSize: 12, fontWeight: "700", letterSpacing: 2, marginBottom: 10 },
  title: { color: "#26334b", fontSize: 38, lineHeight: 44, fontWeight: "700", letterSpacing: -1 },
  description: { color: "#4d5b78", fontSize: 18, lineHeight: 27, marginTop: 14, marginBottom: 24 },
  section: { color: "#26334b", fontWeight: "700", fontSize: 20, marginTop: 14, marginBottom: 8 },
  hint: { color: "#64708a", fontSize: 13, lineHeight: 20, marginBottom: 6 },
  program: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#dfe6f1", padding: 14, borderRadius: 16, marginVertical: 5, minHeight: 64 },
  selected: { borderColor: "#6955ce", backgroundColor: "#edf4ff" },
  programName: { color: "#172951", fontSize: 16, lineHeight: 22, fontWeight: "500" },
  programCard: { borderWidth: 1, borderColor: '#dfe6f1', borderRadius: 16, marginVertical: 6, overflow: 'hidden' },
  followedCard: { borderColor: '#6955ce' },
  programHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#f6f6fa', minHeight: 80 },
  programBody: { padding: 14, borderTopWidth: 1, borderTopColor: '#dfe6f1' },
  followedText: { color: '#6955ce', marginTop: 6 },
  summaryProgram: { borderTopWidth: 1, borderTopColor: '#dfe6f1', paddingTop: 12, marginTop: 8 },
  years: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 8 },
  year: { borderWidth: 1, borderColor: "#dfe6f1", padding: 12, borderRadius: 12, minHeight: 48 },
  check: { fontSize: 24, color: "#6955ce" },
  selectionSummary: { color: "#4d5b78", fontSize: 14, textAlign: "center", marginVertical: 20 },
  button: { backgroundColor: "#6955ce", borderRadius: 14, minHeight: 56, padding: 14, alignItems: "center", justifyContent: "center", marginTop: 10 },
  buttonText: { color: "white", fontSize: 18, fontWeight: "500", textAlign: "center" },
  secondary: { backgroundColor: "transparent" },
  secondaryText: { color: "#6955ce" },
  card: { backgroundColor: "#f2effa", borderRadius: 20, padding: 22, marginBottom: 18 },
  cardTitle: { color: "#26334b", fontSize: 20, fontWeight: "700", marginBottom: 8 },
  cardText: { color: "#4d5b78", fontSize: 16, lineHeight: 25, marginBottom: 8 },
  edit: { minHeight: 44, justifyContent: "center", marginTop: 4 },
  dots: { flexDirection: "row", gap: 12, justifyContent: "center", marginVertical: 24 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#ced7e7" },
  activeDot: { backgroundColor: "#6955ce" },
  demo: { color: "#64708a", textAlign: "center", fontSize: 12, marginTop: 30 },
  error: { color: "#ac2538", fontSize: 15, textAlign: "center", padding: 12 },
  banner: { position: "absolute", top: 30, left: 16, right: 16, backgroundColor: "#fff2f3", borderRadius: 12 },
  busyOverlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff99" },
});
