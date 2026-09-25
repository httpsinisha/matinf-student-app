import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Image, Linking, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Catalog, Collection, Content, levelLabel, loadCatalog, Page, Related, siteUrl, useContent } from '@/lib/content-api';
import { parsePreferences, Preferences } from '@/lib/onboarding-model';
import { changePushPreference, useDismissPostNotifications, usePush } from '@/lib/push';
import type { PushDestination } from '@/lib/push-model';
import { ContentBody, openUrl } from './content-body';
import { OnboardingFlow } from './onboarding-flow';
import { ScheduleScreen } from './schedule-screen';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Tab = 'home' | 'announcements' | 'courses' | 'staff' | 'more';
type Screen = { collection: Collection | 'schedule'; id?: number; programId?: number; year?: number };
type Navigate = (screen: Screen) => void;
const labels: Record<Collection | 'schedule', string> = { schedule: 'Raspored nastave', news: 'Novosti', announcements: 'Notifikacije', programs: 'Studijski programi', courses: 'Predmeti', staff: 'Nastavno osoblje', documents: 'Dokumenti', pages: 'Informacije' };
const icons: Record<Collection, IconName> = { news: 'newspaper-outline', announcements: 'notifications-outline', programs: 'school-outline', courses: 'book-outline', staff: 'people-outline', documents: 'document-text-outline', pages: 'information-circle-outline' };
const tabs: { key: Tab; name: string; icon: IconName }[] = [
  { key: 'home', name: 'Početna', icon: 'home-outline' }, { key: 'announcements', name: 'Notifikacije', icon: 'notifications-outline' },
  { key: 'courses', name: 'Predmeti', icon: 'book-outline' }, { key: 'staff', name: 'Osoblje', icon: 'people-outline' }, { key: 'more', name: 'Više', icon: 'grid-outline' },
];
function Icon({ name, color = '#2057ce', size = 23 }: { name: IconName; color?: string; size?: number }) { return <Ionicons name={name} color={color} size={size} />; }
function Action({ title, onPress, secondary = false }: { title: string; onPress: () => void; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.action, secondary && s.actionSecondary, pressed && s.pressed]}><Text style={[s.actionText, secondary && { color: '#1d54c7' }]}>{title}</Text></Pressable>;
}
function Chip({ title, selected = false, onPress }: { title: string; selected?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[s.chip, selected && s.chipSelected]}><Text numberOfLines={1} style={[s.chipText, selected && { color: 'white' }]}>{title}</Text></Pressable>;
}
function Heading({ title, onPress }: { title: string; onPress?: () => void }) {
  return <View style={s.sectionHeading}><Text style={s.sectionTitle}>{title}</Text>{onPress && <Pressable accessibilityRole="button" accessibilityLabel={`Prikaži sve: ${title}`} onPress={onPress} hitSlop={10}><Text style={s.blue}>Vidi sve →</Text></Pressable>}</View>;
}
function Empty({ title = 'Još nema sadržaja', text = 'Nove objave će se pojaviti nakon što ih nastavnik objavi na sajtu.' }: { title?: string; text?: string }) {
  return <View style={s.empty}><View style={s.emptyIcon}><Icon name="file-tray-outline" size={34} /></View><Text style={s.cardTitle}>{title}</Text><Text style={s.centerText}>{text}</Text></View>;
}
function Notice({ resource }: { resource: { loading: boolean; offline: boolean; error: string | null; data: unknown; savedAt: string | null; refresh: () => Promise<void> } }) {
  if (resource.loading && !resource.data) return <View style={s.loading}><ActivityIndicator color="#2057ce" /><Text style={s.muted}>Učitavanje sadržaja…</Text></View>;
  if (!resource.error) return null;
  return <View accessibilityRole="alert" style={s.notice}><Icon name={resource.data ? 'cloud-offline-outline' : 'alert-circle-outline'} color="#946115" /><View style={s.flex}><Text style={s.noticeTitle}>{resource.data ? 'Prikazan je sačuvan sadržaj' : resource.error}</Text><Text style={s.small}>{resource.data ? `Posljednje učitavanje: ${date(resource.savedAt || '')}. Podaci mogu biti zastarjeli.` : 'Povežite se sa internetom ili pokušajte kasnije.'}</Text><Pressable accessibilityRole="button" onPress={() => void resource.refresh()} style={s.retry}><Text style={s.blue}>Pokušaj ponovo</Text></Pressable></View></View>;
}
function date(value: string) { return value ? new Date(value).toLocaleDateString('sr-Latn', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
function following(preferences: Preferences) {
  return `following=true&program_years=${encodeURIComponent(preferences.programYears.join(','))}&course_ids=${encodeURIComponent(preferences.courseIds.join(','))}`;
}
function followingLabel(preferences: Preferences, catalog: Catalog) {
  return [...preferences.programYears.map(value => {
    const [id, year] = value.split(':');
    return `${catalog.programs.find(item => String(item.id) === id)?.title ?? 'Program ' + id} · ${year}. godina`;
  }), ...preferences.courseIds.map(id => catalog.courses.find(item => String(item.id) === id)?.title ?? 'Predmet ' + id)].join('\n') || 'Samo opšta obavještenja. Izaberite godinu ili predmete.';
}
function Card({ item, navigate, compact = false }: { item: Content; navigate: Navigate; compact?: boolean }) {
  const staff = item.type === 'staff';
  return <Pressable accessibilityRole="button" accessibilityLabel={item.title} onPress={() => navigate({ collection: item.type, id: item.id })} style={({ pressed }) => [s.card, pressed && s.pressed]}>
    <View style={s.cardRow}>
      {staff ? <View style={s.avatar}>{item.image ? <Image source={{ uri: item.image.url }} style={s.avatarImage} /> : <Text style={s.initials}>{item.title.split(' ').map(part => part[0]).slice(0, 2).join('')}</Text>}</View>
        : item.image ? <Image source={{ uri: item.image.url }} style={s.thumbnail} /> : item.type !== 'announcements' && <View style={s.squareIcon}><Icon name={icons[item.type]} /></View>}
      <View style={s.flex}>
        {item.meta.important && <View style={s.important}><Text style={s.importantText}>●  Važno</Text></View>}
        <Text style={s.cardTitle}>{item.title}</Text>
        {staff ? <Text style={s.meta}>{item.meta.academicTitle}</Text> : item.type === 'courses' ? <Text style={s.meta}>{item.meta.year}. godina · {item.meta.semester}. semestar</Text>
          : item.type === 'programs' ? <Text style={s.meta}>{levelLabel[item.meta.level || '']} · {item.meta.durationYears} god.</Text>
            : <Text style={s.meta}>{item.type === 'documents' ? 'PDF / dokument' : date(item.publishedAt)}</Text>}
        {!compact && !staff && <Text numberOfLines={2} style={s.excerpt}>{item.excerpt}</Text>}
        {item.type === 'courses' && <Text numberOfLines={1} style={s.small}>{item.relations.program?.title}</Text>}
      </View>
      <Icon name="chevron-forward" size={18} color="#8897af" />
    </View>
  </Pressable>;
}

export function MatinfApp() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [ready, setReady] = useState(false);
  const [catalog, setCatalog] = useState<Catalog>({ programs: [], courses: [] });
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [setup, setSetup] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [stack, setStack] = useState<Screen[]>([]);
  const [pushBusy, setPushBusy] = useState(false);
  const openPush = useCallback((destination: PushDestination) => { setSetup(false); setTab('announcements'); setStack([destination]); }, []);
  const push = usePush(preferences, openPush);
  async function togglePush() {
    if (!preferences || pushBusy) return;
    setPushBusy(true);
    try {
      const next = await changePushPreference(preferences, !preferences.notificationsRequested);
      await AsyncStorage.setItem('@matinf/onboarding/v1', JSON.stringify(next));
      setPreferences(next);
    } catch { Alert.alert('Obavještenja', 'Promjena nije sačuvana. Pokušajte ponovo.'); }
    finally { setPushBusy(false); }
  }
  const refreshCatalog = useCallback(async () => {
    setCatalogLoading(true);
    const key = `@matinf/catalog/v1:${siteUrl}`;
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached) { try { setCatalog(JSON.parse(cached)); } catch { /* Reload corrupted cache. */ } }
      const result = await loadCatalog();
      setCatalog(result); setCatalogError(false);
      await AsyncStorage.setItem(key, JSON.stringify(result));
    } catch { setCatalogError(true); } finally { setCatalogLoading(false); }
  }, []);
  useEffect(() => {
    AsyncStorage.getItem('@matinf/onboarding/v1').then(raw => {
      const value = parsePreferences(raw);
      setPreferences(value ? value.backend === siteUrl ? value : { ...value, selectedProgramId: undefined, programYears: [], courseIds: [], backend: siteUrl } : null);
    }).catch(() => undefined).finally(() => setReady(true));
    void refreshCatalog();
  }, [refreshCatalog]);
  useEffect(() => {
    if (!preferences || catalogLoading || catalogError || !catalog.programs.length) return;
    const programYears = preferences.programYears.filter(value => {
      const [id, year] = value.split(':').map(Number);
      return catalog.programs.some(item => item.id === id && year >= 1 && year <= (item.meta.durationYears || 0));
    });
    const courseIds = preferences.courseIds.filter(id => catalog.courses.some(item => String(item.id) === id));
    if (programYears.length !== preferences.programYears.length || courseIds.length !== preferences.courseIds.length) {
      const next = { ...preferences, programYears, courseIds };
      setPreferences(next);
      void AsyncStorage.setItem('@matinf/onboarding/v1', JSON.stringify(next)).catch(() => undefined);
    }
  }, [catalog, catalogLoading, catalogError, preferences]);
  const goBack = useCallback(() => { setStack(value => value.slice(0, -1)); }, []);
  useEffect(() => {
    if (setup || !preferences) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length) { goBack(); return true; }
      if (tab !== 'home') { setTab('home'); return true; }
      return false;
    });
    return () => listener.remove();
  }, [goBack, preferences, setup, stack.length, tab]);
  const navigate: Navigate = screen => setStack(value => [...value, screen]);
  const edit = () => { setSetup(true); void refreshCatalog(); };
  if (!ready) return <SafeAreaView style={s.splash}><ActivityIndicator color="#2057ce" /></SafeAreaView>;
  if (!preferences || setup) {
    if (catalogLoading && !catalog.programs.length) return <SafeAreaView style={s.splash}><ActivityIndicator color="#2057ce" /><Text style={s.muted}>Učitavanje studijskih programa…</Text><Action title="Nastavi bez čekanja" secondary onPress={() => setCatalogLoading(false)} /></SafeAreaView>;
    return <OnboardingFlow editMode={setup} onCancel={() => setSetup(false)} onDone={value => { setPreferences(value); setSetup(false); }}
      programs={catalog.programs.map(item => ({ id: String(item.id), name: item.title, years: item.meta.durationYears || 1, level: levelLabel[item.meta.level || ''] || '' }))}
      courses={catalog.courses.map(item => ({ id: String(item.id), name: item.title, programId: String(item.meta.programId), year: item.meta.year || 1 }))} />;
  }
  const screen = stack[stack.length - 1];
  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
    <View style={s.topbar}>
      {screen ? <Pressable accessibilityRole="button" accessibilityLabel="Nazad" onPress={goBack} style={s.headerButton}><Icon name="arrow-back" color="#142b52" /></Pressable> : <View style={s.brandIcon}><Icon name="school" color="white" size={22} /></View>}
      <View style={s.flex}><Text numberOfLines={1} style={s.wordmark}>{screen ? labels[screen.collection] : 'MATINF'}</Text>{!screen && <Text style={s.brandSubtitle}>Matematika. Informatika. Budućnost.</Text>}</View>
      <Pressable accessibilityRole="button" accessibilityLabel="Podesi praćenje" onPress={edit} style={s.headerButton}><Icon name="options-outline" color="#142b52" /></Pressable>
    </View>
    <View style={s.flex}>
      {screen?.collection === 'schedule' ? <ScheduleScreen catalog={catalog} preferences={preferences} openCourse={id => navigate({ collection: 'courses', id })} /> : screen ? screen.id ? <Detail key={`${screen.collection}/${screen.id}`} screen={screen} navigate={navigate} preferences={preferences} edit={edit} /> : <Listing key={`${screen.collection}/${screen.programId}/${screen.year}`} screen={screen} navigate={navigate} preferences={preferences} catalog={catalog} edit={edit} />
        : tab === 'home' ? <Home preferences={preferences} navigate={navigate} edit={edit} catalog={catalog} />
          : tab === 'more' ? <More navigate={navigate} edit={edit} preferences={preferences} catalogError={catalogError} refreshCatalog={refreshCatalog} push={push} togglePush={togglePush} pushBusy={pushBusy} />
            : <Listing key={tab} screen={{ collection: tab }} navigate={navigate} preferences={preferences} catalog={catalog} edit={edit} />}
    </View>
    <View style={s.tabs}>{tabs.map(item => <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: tab === item.key && !screen }} accessibilityLabel={item.name}
      onPress={() => { setTab(item.key); setStack([]); }} style={s.tab}>
      <View style={[s.tabIcon, tab === item.key && s.activeTab]}><Icon name={item.icon} size={22} color={tab === item.key ? '#1d54c7' : '#77849a'} /></View>
      <Text numberOfLines={1} style={[s.tabLabel, tab === item.key && s.blue]}>{item.name}</Text>
    </Pressable>)}</View>
  </SafeAreaView>;
}

function Home({ preferences, navigate, edit, catalog }: { preferences: Preferences; navigate: Navigate; edit: () => void; catalog: Catalog }) {
  const notices = useContent<Page>(`/content/feed?per_page=3&${following(preferences)}`);
  const news = useContent<Page>('/content/news?per_page=3');
  return <ScrollView contentContainerStyle={s.page} refreshControl={<RefreshControl refreshing={notices.loading && !!notices.data} onRefresh={() => { void notices.refresh(); void news.refresh(); }} />}>
    <View style={s.welcome}><View><Text style={s.eyebrow}>VAŠ AKADEMSKI PROSTOR</Text><Text style={s.pageTitle}>Dobro došli.</Text></View><View style={s.welcomeIcon}><Icon name="sparkles-outline" size={29} /></View></View>
    <View style={s.hero}><View style={s.heroCircle} /><Text style={s.heroTag}>MATINF · INFORMACIJE NA DLANU</Text><Text style={s.heroTitle}>Znanje povezuje{ '\n' }ljude.</Text><Text style={s.heroText}>Sve o studijama, predmetima i ljudima{ '\n' }na jednom mjestu.</Text><Pressable accessibilityRole="button" onPress={() => navigate({ collection: 'programs' })} style={s.heroLink}><Text style={s.heroLinkText}>Istraži studijske programe</Text><Icon name="arrow-forward" color="white" size={20} /></Pressable></View>
    <View style={s.shortcuts}>{(['programs', 'courses', 'staff', 'documents'] as Collection[]).map(type => <Pressable key={type} accessibilityRole="button" onPress={() => navigate({ collection: type })} style={s.shortcut}><View style={s.shortcutIcon}><Icon name={icons[type]} /></View><Text style={s.shortcutLabel}>{type === 'programs' ? 'Studije' : type === 'staff' ? 'Osoblje' : labels[type]}</Text></Pressable>)}</View>
    <Pressable accessibilityRole="button" onPress={edit} style={s.followCard}><Icon name="filter-outline" /><View style={s.flex}><Text style={s.followTitle}>Prilagođeno vama</Text><Text style={s.small}>{followingLabel(preferences, catalog)}</Text></View><Icon name="chevron-forward" size={18} /></Pressable>
    <Action title="Moj raspored nastave" onPress={() => navigate({ collection: 'schedule' })} />
    <Heading title="Najnovija obavještenja" onPress={() => navigate({ collection: 'announcements' })} />
    <Notice resource={notices} />
    {notices.data?.items.map(item => <Card key={item.id} item={item} navigate={navigate} />)}
    {!notices.loading && notices.data?.items.length === 0 && <Empty title="Sve ste pregledali" text="Trenutno nema objava za vaš izbor. Opšta obavještenja uvijek su uključena." />}
    <Heading title="Novosti sa sajta" onPress={() => navigate({ collection: 'news' })} />
    <Text style={s.small}>Sve novosti, bez filtriranja prema vašem izboru studija.</Text>
    <Notice resource={news} />{news.data?.items.map(item => <Card key={item.id} item={item} navigate={navigate} compact />)}
    <View style={s.stats}><View><Text style={s.statValue}>{catalog.programs.length}</Text><Text style={s.small}>programa studija</Text></View><View style={s.statDivider} /><View><Text style={s.statValue}>{catalog.courses.length}</Text><Text style={s.small}>predmeta u katalogu</Text></View></View>
    <Text style={s.demo}>Nezvanična akademska demonstracija</Text>
  </ScrollView>;
}

function Listing({ screen, navigate, preferences, catalog, edit }: { screen: Screen; navigate: Navigate; preferences: Preferences; catalog: Catalog; edit: () => void }) {
  const collection = screen.collection;
  const [personal, setPersonal] = useState(true);
  const [program, setProgram] = useState(screen.programId || 0);
  const [year, setYear] = useState(screen.year || 0);
  const [page, setPage] = useState(1);
  const resource = useContent<Page>(`/content/${collection === 'announcements' ? 'feed' : collection}?per_page=15&page=${page}${collection === 'announcements' && personal ? '&' + following(preferences) : ''}${collection === 'courses' && program ? '&program_id=' + program : ''}${collection === 'courses' && year ? '&year=' + year : ''}`);
  const duration = catalog.programs.find(item => item.id === program)?.meta.durationYears || 4;
  return <ScrollView contentContainerStyle={s.page} refreshControl={<RefreshControl refreshing={resource.loading && !!resource.data} onRefresh={() => void resource.refresh()} />}>
    <Text style={s.eyebrow}>{collection === 'announcements' ? 'BUDITE U TOKU' : 'ISTRAŽITE MATINF'}</Text><Text style={s.pageTitle}>{labels[collection]}</Text>
    <Text style={s.description}>{collection === 'announcements' ? 'Objave profesora i administracije, prema vašem izboru studija i predmeta.' : collection === 'staff' ? 'Upoznajte nastavnike, njihove oblasti rada i predmete koje izvode.' : collection === 'courses' ? 'Nastavni sadržaji, povezani nastavnici i dokumenti za svaki predmet.' : collection === 'programs' ? 'Pronađite svoj put kroz osnovne, master i doktorske studije.' : collection === 'documents' ? 'Nastavni planovi i materijali dostupni sa sajta.' : 'Informacije iz naše akademske zajednice.'}</Text>
    {collection === 'announcements' && <><View style={s.chipRow}><Chip title="Za mene" selected={personal} onPress={() => { setPersonal(true); setPage(1); }} /><Chip title="Sve objave" selected={!personal} onPress={() => { setPersonal(false); setPage(1); }} /><Chip title="Moj izbor" onPress={edit} /></View><Text style={s.small}>Objave možete pregledati i bez uključene push dostave.</Text></>}
    {collection === 'courses' && <><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}><Chip title="Svi programi" selected={!program} onPress={() => { setProgram(0); setYear(0); setPage(1); }} />{catalog.programs.map(item => <Chip key={item.id} title={item.title} selected={program === item.id} onPress={() => { setProgram(item.id); setYear(0); setPage(1); }} />)}</ScrollView><View style={s.chipRow}><Chip title="Sve godine" selected={!year} onPress={() => { setYear(0); setPage(1); }} />{Array.from({ length: duration }, (_, index) => <Chip key={index} title={`${index + 1}.`} selected={year === index + 1} onPress={() => { setYear(index + 1); setPage(1); }} />)}</View></>}
    <Notice resource={resource} />
    {collection === 'announcements' && personal && <View style={s.notice}><Text style={s.small}>Pratite:{'\n'}{followingLabel(preferences, catalog)}</Text></View>}
    {resource.data && <Text style={s.resultCount}>{resource.data.total} {collection === 'staff' ? 'profila' : 'stavki'} · Stranica {page}</Text>}
    {resource.data?.items.map(item => <Card key={item.id} item={item} navigate={navigate} />)}
    {!resource.loading && resource.data?.items.length === 0 && <Empty text={collection === 'announcements' ? 'Nema obavještenja za izabrane godine i predmete. Promijenite izbor ili pregledajte sve objave.' : 'Za ovaj izbor još nema objavljenog sadržaja.'} />}
    {!!resource.data && resource.data.totalPages > 1 && <View style={s.pagination}>{page > 1 && <Action title="← Prethodna" secondary onPress={() => setPage(page - 1)} />}{page < resource.data.totalPages && <Action title="Sljedeća →" onPress={() => setPage(page + 1)} />}</View>}
  </ScrollView>;
}

function Detail({ screen, navigate, preferences, edit }: { screen: Screen; navigate: Navigate; preferences: Preferences; edit: () => void }) {
  const resource = useContent<Content>(`/content/${screen.collection}/${screen.id}`);
  const item = resource.data;
  useDismissPostNotifications(item && (item.type === 'news' || item.type === 'announcements') ? item.id : undefined);
  const relation = (related: Related) => <Pressable key={`${related.type}/${related.id}`} accessibilityRole="button" onPress={() => navigate({ collection: related.type, id: related.id })} style={s.relation}><View style={s.squareIcon}><Icon name={icons[related.type]} /></View><Text style={[s.cardTitle, s.flex]}>{related.title}</Text><Icon name="chevron-forward" size={18} /></Pressable>;
  const subscribed = item?.type === 'courses' && (preferences.courseIds.includes(String(item.id)) || preferences.programYears.includes(`${item.meta.programId}:${item.meta.year}`));
  return <ScrollView contentContainerStyle={s.page} refreshControl={<RefreshControl refreshing={resource.loading && !!item} onRefresh={() => void resource.refresh()} />}>
    <Notice resource={resource} />
    {resource.missing && <Empty title="Sadržaj nije dostupan" text="Objava je uklonjena ili više nije javna. Vratite se na listu da pronađete druge sadržaje." />}
    {item && <>
      {item.image && <Image source={{ uri: item.image.url }} accessibilityLabel={item.image.alt} style={s.detailImage} />}
      <View style={s.detailTop}><Text style={s.eyebrow}>{labels[item.type].toUpperCase()}</Text><Pressable accessibilityRole="button" accessibilityLabel="Podijeli" onPress={() => void Share.share({ message: `${item.title}\n${item.url}` }).catch(() => Alert.alert('Dijeljenje nije dostupno'))} style={s.headerButton}><Icon name="share-social-outline" /></Pressable></View>
      <Text style={s.detailTitle}>{item.title}</Text>
      {['news', 'announcements'].includes(item.type) && <Text style={s.meta}>{date(item.publishedAt)}{item.meta.authorName ? ` · ${item.meta.authorName}` : ''}</Text>}
      {item.type === 'staff' && <><Text style={s.description}>{item.meta.academicTitle}</Text>{item.meta.email && <Action title="Pošalji email" onPress={() => void openUrl(`mailto:${item.meta.email}`)} />}</>}
      {item.type === 'programs' && <View style={s.infoStrip}><Icon name="school-outline" /><Text style={s.infoText}>{levelLabel[item.meta.level || '']} · {item.meta.durationYears} godine · {item.meta.ects} ECTS</Text></View>}
      {item.type === 'courses' && <><View style={s.infoStrip}><Icon name="calendar-outline" /><Text style={s.infoText}>{item.meta.year}. godina · {item.meta.semester}. semestar</Text></View>{item.relations.program && relation(item.relations.program)}<Pressable accessibilityRole="button" onPress={edit} style={s.followCard}><Icon name={subscribed ? 'checkmark-circle' : 'notifications-outline'} color={subscribed ? '#148356' : '#2057ce'} /><View style={s.flex}><Text style={s.followTitle}>{subscribed ? 'Pratite ovaj predmet' : 'Pratite objave ovog predmeta'}</Text><Text style={s.small}>Promijenite izbor godina i predmeta</Text></View><Icon name="chevron-forward" size={18} /></Pressable></>}
      <View style={s.bodyCard}><ContentBody html={item.bodyHtml} /></View>
      {!!item.meta.attachments?.length && <><Heading title="Dokumenti uz objavu" />{item.meta.attachments.map(file => <Action key={file.id} title={`Otvori: ${file.title}`} onPress={() => void openUrl(file.url)} />)}</>}
      {item.type === 'programs' && <><Heading title="Godine studija" />{Array.from({ length: item.meta.durationYears || 0 }, (_, index) => <Pressable key={index} accessibilityRole="button" onPress={() => navigate({ collection: 'courses', programId: item.id, year: index + 1 })} style={s.relation}><View style={s.yearNumber}><Text style={s.blue}>{index + 1}</Text></View><Text style={[s.cardTitle, s.flex]}>{index + 1}. godina studija</Text><Icon name="chevron-forward" size={18} /></Pressable>)}</>}
      {!!item.relations.staff?.length && <><Heading title="Nastavno osoblje" />{item.relations.staff.map(relation)}</>}
      {!!item.relations.courses?.length && item.type !== 'programs' && <><Heading title="Predmeti" />{item.relations.courses.map(relation)}</>}
      {!!item.relations.documents?.length && <><Heading title="Dokumenti i materijali" />{item.relations.documents.map(relation)}</>}
      {item.type === 'documents' && item.meta.fileUrl && <Action title="Otvori dokument ↗" onPress={() => void openUrl(item.meta.fileUrl!)} />}
      <Pressable accessibilityRole="link" onPress={() => void openUrl(item.url)} style={s.websiteLink}><Icon name="globe-outline" size={19} /><Text style={s.blue}>Pogledaj na WordPress sajtu</Text></Pressable>
      <Text style={s.demo}>Ažurirano {date(item.updatedAt)} · Nezvanični demo</Text>
    </>}
  </ScrollView>;
}

function More({ navigate, edit, preferences, catalogError, refreshCatalog, push, togglePush, pushBusy }: { navigate: Navigate; edit: () => void; preferences: Preferences; catalogError: boolean; refreshCatalog: () => Promise<void>; push: ReturnType<typeof usePush>; togglePush: () => void; pushBusy: boolean }) {
  const pages = useContent<Page>('/content/pages?per_page=50');
  function row(title: string, subtitle: string, icon: IconName, action: () => void) {
    return <Pressable key={title} accessibilityRole="button" onPress={action} style={s.relation}><View style={s.squareIcon}><Icon name={icon} /></View><View style={s.flex}><Text style={s.cardTitle}>{title}</Text><Text style={s.small}>{subtitle}</Text></View><Icon name="chevron-forward" size={18} color="#8c9ab0" /></Pressable>;
  }
  return <ScrollView contentContainerStyle={s.page}>
    <Text style={s.eyebrow}>SVE NA JEDNOM MJESTU</Text><Text style={s.pageTitle}>Istražite više.</Text><Text style={s.description}>Studijske informacije, materijali i vaša podešavanja.</Text>
    <Heading title="Informacije" />
    {row('Moj raspored', 'Program, godina, semestar i sedmični termini', 'calendar-outline', () => navigate({ collection: 'schedule' }))}
    {row('Studijski programi', 'Osnovne, master i doktorske studije', 'school-outline', () => navigate({ collection: 'programs' }))}
    {row('Novosti', 'Aktuelnosti iz akademske zajednice', 'newspaper-outline', () => navigate({ collection: 'news' }))}
    {row('Dokumenti', 'Nastavni planovi i materijali', 'document-text-outline', () => navigate({ collection: 'documents' }))}
    <Notice resource={pages} />{pages.data?.items.map(item => row(item.title, item.excerpt.slice(0, 70), item.slug === 'kontakt' ? 'mail-outline' : 'information-circle-outline', () => navigate({ collection: 'pages', id: item.id })))}
    <Heading title="Vaša aplikacija" />
    {row('Praćenje i obavještenja', `${preferences.programYears.length} godina · ${preferences.courseIds.length} predmeta`, 'options-outline', edit)}
    <View style={s.notice}><Icon name="notifications-outline" /><View style={s.flex}><Text style={s.noticeTitle}>Push obavještenja</Text><Text accessibilityLiveRegion="polite" style={s.small}>{push.message}</Text><Text style={s.small}>Izbor studija i predmeta ostaje sačuvan i kada isključite push.</Text></View></View>
    <Pressable accessibilityRole="button" disabled={pushBusy} onPress={togglePush} style={s.action}><Text style={s.actionText}>{pushBusy ? 'Čuvanje…' : preferences.notificationsRequested ? 'Isključi push obavještenja' : 'Uključi push obavještenja'}</Text></Pressable>
    {['error', 'stopping', 'paused'].includes(push.status) && <Action title="Pokušaj povezivanje ponovo" secondary onPress={push.retry} />}
    {push.status === 'denied' && <Action title="Otvori Android podešavanja" secondary onPress={() => void Linking.openSettings()} />}
    {catalogError && row('Osvježi studijski katalog', 'Veza sa sajtom nije uspjela', 'refresh-outline', () => void refreshCatalog())}
    {row('Otvori WordPress sajt', 'Javni sadržaj i prijava za nastavnike', 'globe-outline', () => void openUrl(siteUrl))}
    <View style={s.about}><Icon name="school" size={38} /><Text style={s.aboutTitle}>MATINF</Text><Text style={s.centerText}>Matematika. Informatika. Budućnost.</Text><Text style={s.demo}>Nezvanična akademska demonstracija{ '\n' }Verzija 1.0.0 · Sadržaj uređivan u WordPress-u</Text></View>
  </ScrollView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' }, splash: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 18, padding: 25 }, flex: { flex: 1 },
  topbar: { paddingHorizontal: 20, height: 70, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#edf1f8' },
  brandIcon: { backgroundColor: '#2057ce', width: 41, height: 43, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  wordmark: { fontSize: 23, fontWeight: '800', color: '#112650', letterSpacing: -.5 }, brandSubtitle: { fontSize: 9, color: '#6e7f99', marginTop: 3 },
  headerButton: { minWidth: 42, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  page: { padding: 21, paddingBottom: 30, backgroundColor: '#f7f9fd', minHeight: '100%', maxWidth: 740, width: '100%', alignSelf: 'center' },
  eyebrow: { color: '#4672bb', fontWeight: '700', fontSize: 10, letterSpacing: 1.5, marginBottom: 7 },
  pageTitle: { color: '#12274c', fontSize: 29, fontWeight: '800', letterSpacing: -.8 },
  description: { color: '#6d7e98', fontSize: 14, lineHeight: 22, marginTop: 10, marginBottom: 20 },
  welcome: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5, marginBottom: 21 },
  welcomeIcon: { backgroundColor: '#ebf1ff', width: 48, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: '#143b91', padding: 23, borderRadius: 22, overflow: 'hidden', marginBottom: 22 },
  heroCircle: { position: 'absolute', width: 210, height: 210, borderRadius: 105, borderWidth: 30, borderColor: '#2353ac', right: -95, top: -38 },
  heroTag: { color: '#a9c6ff', fontSize: 8, fontWeight: '700', letterSpacing: 1.6 }, heroTitle: { color: 'white', fontSize: 31, fontWeight: '700', lineHeight: 37, marginTop: 15 },
  heroText: { color: '#d2def6', fontSize: 12, lineHeight: 20, marginTop: 12 }, heroLink: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18, minHeight: 30 }, heroLinkText: { color: 'white', fontSize: 12, fontWeight: '700' },
  shortcuts: { flexDirection: 'row', gap: 10, marginBottom: 22 }, shortcut: { flex: 1, alignItems: 'center', gap: 9 }, shortcutIcon: { width: '100%', height: 57, borderRadius: 16, backgroundColor: 'white', borderWidth: 1, borderColor: '#e5ebf5', justifyContent: 'center', alignItems: 'center' }, shortcutLabel: { fontSize: 11, color: '#354766', fontWeight: '600' },
  followCard: { backgroundColor: '#eaf1ff', borderColor: '#dce7fb', borderWidth: 1, borderRadius: 15, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 15, marginTop: 4 }, followTitle: { fontSize: 13, fontWeight: '700', color: '#274c8c', marginBottom: 4 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 17, marginBottom: 14 }, sectionTitle: { color: '#142c54', fontSize: 18, fontWeight: '700', flexShrink: 1 }, blue: { color: '#2057ce', fontWeight: '600', fontSize: 12 },
  card: { backgroundColor: 'white', borderWidth: 1, borderColor: '#e6ecf6', borderRadius: 17, padding: 16, marginBottom: 11 }, cardRow: { flexDirection: 'row', alignItems: 'center', gap: 13 }, cardTitle: { color: '#1a3157', fontSize: 15, fontWeight: '700', lineHeight: 21 }, meta: { color: '#8592a7', fontSize: 11, marginTop: 6, lineHeight: 17 }, excerpt: { color: '#62728f', fontSize: 12, lineHeight: 19, marginTop: 8 },
  important: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, backgroundColor: '#fff0ed', marginBottom: 8 }, importantText: { color: '#cc5346', fontSize: 9, fontWeight: '700' },
  squareIcon: { width: 43, height: 46, borderRadius: 12, backgroundColor: '#eff4fc', alignItems: 'center', justifyContent: 'center' }, thumbnail: { width: 62, height: 68, borderRadius: 11 },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#e7eefb', alignItems: 'center', justifyContent: 'center' }, initials: { fontSize: 20, color: '#365fa8', fontWeight: '600' }, avatarImage: { width: 58, height: 58, borderRadius: 29 },
  small: { color: '#71819b', fontSize: 11, lineHeight: 17 }, muted: { color: '#71819b', fontSize: 14 },
  stats: { marginTop: 20, marginBottom: 14, padding: 20, flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#edf2fb', borderRadius: 17 }, statValue: { color: '#204d9e', fontSize: 26, fontWeight: '700', marginBottom: 4 }, statDivider: { width: 1, backgroundColor: '#d6e0f1' },
  demo: { color: '#91a0b5', fontSize: 10, lineHeight: 18, textAlign: 'center', marginTop: 16 }, tabs: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#e6ecf4', paddingTop: 7, paddingBottom: 5, backgroundColor: 'white' }, tab: { flex: 1, alignItems: 'center', minHeight: 57, gap: 4 }, tabIcon: { borderRadius: 12, width: 47, height: 30, alignItems: 'center', justifyContent: 'center' }, activeTab: { backgroundColor: '#eaf1ff' }, tabLabel: { color: '#8290a5', fontSize: 9, fontWeight: '600' },
  chipRow: { flexDirection: 'row', gap: 8, marginVertical: 10 }, chip: { borderRadius: 10, backgroundColor: '#eaf0f9', paddingHorizontal: 13, paddingVertical: 11, maxWidth: 240, minHeight: 41 }, chipSelected: { backgroundColor: '#2159ce' }, chipText: { color: '#607491', fontSize: 12, fontWeight: '600' }, resultCount: { fontSize: 11, color: '#8997ac', marginBottom: 12, marginTop: 13 },
  loading: { alignItems: 'center', gap: 12, padding: 30 }, notice: { flexDirection: 'row', gap: 10, backgroundColor: '#fff5df', borderRadius: 13, padding: 15, marginVertical: 12 }, noticeTitle: { fontSize: 12, lineHeight: 19, fontWeight: '700', color: '#765726', marginBottom: 4 }, retry: { paddingVertical: 12 }, empty: { alignItems: 'center', padding: 26, backgroundColor: 'white', borderRadius: 17, gap: 13, marginVertical: 10 }, emptyIcon: { backgroundColor: '#edf2fb', padding: 17, borderRadius: 23 }, centerText: { color: '#7b8ba3', fontSize: 13, lineHeight: 21, textAlign: 'center' },
  action: { backgroundColor: '#2057ce', minHeight: 48, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginVertical: 8 }, actionSecondary: { backgroundColor: '#e9effb' }, actionText: { color: 'white', fontSize: 14, fontWeight: '600' }, pagination: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 15 }, pressed: { opacity: .7 },
  detailTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, detailTitle: { color: '#162d55', fontSize: 28, lineHeight: 35, fontWeight: '800', letterSpacing: -.5, marginBottom: 10 }, detailImage: { width: '100%', height: 220, borderRadius: 18, marginBottom: 20 }, infoStrip: { flexDirection: 'row', gap: 9, alignItems: 'center', backgroundColor: '#e9f1fd', padding: 13, borderRadius: 12, marginVertical: 16 }, infoText: { color: '#2d5996', fontSize: 13, lineHeight: 20, flex: 1 }, bodyCard: { marginTop: 22 }, relation: { flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 15, padding: 15, backgroundColor: 'white', borderWidth: 1, borderColor: '#e4ebf5', marginBottom: 10 }, yearNumber: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#eaf1ff', alignItems: 'center', justifyContent: 'center' }, websiteLink: { flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', paddingVertical: 20, marginTop: 12 }, about: { alignItems: 'center', paddingTop: 32, paddingBottom: 10, gap: 8 }, aboutTitle: { color: '#183564', fontSize: 24, fontWeight: '800' },
});
