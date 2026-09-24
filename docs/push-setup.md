# MATINF Android push

Push kod povezuje WordPress → Expo → Firebase Cloud Messaging → Android. Stvarna dostava se potvrđuje tek kada nova objava stigne na emulator i dodir otvori njen detalj.

## Projekti

- Expo Project ID: `370f402c-255a-4990-b120-39a8812ea99c` (u `.env`).
- Firebase Project ID: `matinf-e8e3b`.
- Android package/application identifier: `com.matinf.demo`.
- Firebase Android `google-services.json` ide u glavni folder projekta, izuzet je iz Gita.
- Privatni Firebase service-account JSON ide direktno u Expo Android credentials → **FCM V1 service account key**. Ne ide u aplikaciju, WordPress ili Git.
- Za Expo čarobnjak pripremljen je zaseban RSA-2048/SHA256 JKS: `artifacts/build/matinf-upload.jks`, alias `matinf`. Nasumične lozinke su u `artifacts/build/matinf-upload-credentials.txt`. Oba fajla su privatna, izuzeta iz Gita; napraviti rezervnu kopiju. Lokalna emulator APK i dalje koristi postojeći razvojni ključ radi nadogradnje instalacije. Promjena potpisa finalne APK zahtijeva poseban dogovor i migraciju instalacije.

Firebase Spark ne zahtijeva karticu, a FCM je besplatan: [Firebase cjenovnik](https://firebase.google.com/pricing). Cloud Functions, Firestore i Firebase hosting nisu potrebni. Android gradimo lokalno.

Uputstvo za razlikovanje dva Firebase JSON fajla i dodavanje FCM V1 ključa: [Expo FCM credentials](https://docs.expo.dev/push-notifications/fcm-credentials/). Ako koristite postojeći service account, provjerite njegovu ulogu Firebase Cloud Messaging API Admin.

## WordPress

1. Ažurirati `matinf-core` paketom `wordpress/dist/matinf-core.zip` (verzija 0.2.0). Zamijeniti postojeći plugin; bazu i objave ne brisati. Tema se ne mijenja.
2. Administrator otvara **Tools/Alati → MATINF push**.
3. Kliknuti **Provjeri HTTPS vezu**. Ovo provjerava pristup Expo servisu bez slanja poruke.
4. Uključiti **Uključi push dostavu** i sačuvati.
5. U alwaysdata **Advanced → Scheduled tasks** dodati command zadatak svake minute (`* * * * *`):

   ```sh
   curl --fail --silent --show-error --max-time 50 'https://sinisa.alwaysdata.net/wp-cron.php?doing_wp_cron' > /dev/null
   ```

   [Alwaysdata zakazani zadaci](https://help.alwaysdata.com/en/docs/web-hosting/tasks/). Bez redovnog pozivanja crona dostava može čekati sljedeću posjetu sajtu. Hosting vremensko ograničenje može uticati na velike redove; aplikacija je predviđena za mali demonstracijski projekat.

## Android

Nakon promjene Firebase konfiguracije ili native paketa potrebni su `npx expo prebuild --platform android --no-install` i novi native build. Prebuild u ovoj verziji ponovo generiše Android folder; skripte `android`/`ios` zadržati kao `expo start --android` / `expo start --ios`.

Pokrenuti `powershell -ExecutionPolicy Bypass -File scripts/build-android-preview.ps1` i instalirati `artifacts/build/MATINF-emulator-preview.apk`. Ovo je x86_64 APK za emulator, ne finalni Redmi APK. Emulator mora imati Google Play servise. Expo Go ne podržava ovaj Android push tok.

U aplikaciji otvoriti **Više → Uključi push obavještenja**, odobriti Android dozvolu i sačekati status povezivanja. Izbor studija i predmeta šalje se pri uključivanju, promjeni izbora i povratku u aplikaciju. Isključivanje šalje odjavu; ako nema mreže, aplikacija jasno prikazuje da odjava još nije potvrđena i pokušava ponovo kada se veza vrati.

## Provjera stvarne dostave

1. Sačuvati program/godinu u aplikaciji i provjeriti da je status push-a uključen.
2. Profesor pravi **novu** objavu u Novosti ili Obavještenja, bira odgovarajuću publiku i ostavlja označeno **Pošalji push obavještenje…**.
3. Poslati aplikaciju u pozadinu dugmetom Home (Android `force-stop` sprečava normalnu dostavu dok se aplikacija ponovo ne otvori).
4. Objaviti i sačekati obradu crona. Dodir poruke mora otvoriti baš tu objavu.
5. Ponoviti za nepovezanu godinu (bez poruke), isključen push (bez poruke), opštu objavu i predmet uključen praćenjem godine.
6. Provjeriti otvaranje nakon uklanjanja aplikacije iz recent apps, te ažuriranje objave bez ponovnog slanja.
7. U WordPress dijagnostici provjeriti red i potvrde. Expo potvrde se provjeravaju nakon 15 minuta. Status **FCM/APNs prihvatio** znači prihvatanje od transportnog servisa, ne potvrdu prikaza na ekranu.

## Ako piše InvalidCredentials

Provjeriti **Expo project → Credentials → Android → com.matinf.demo → Service Credentials → FCM V1 service account key**. Google service account dodat za Google Play submission u početnom čarobnjaku nije isto što i FCM V1 dodjela. Na FCM V1 mjestu izabrati/učitati privatni ključ iz Firebase projekta `matinf-e8e3b`. Ako je već dodijeljen, provjeriti da nije opozvan, da pripada istom projektu kao `google-services.json`, da je Firebase Cloud Messaging API uključen i da service account ima ulogu Firebase Cloud Messaging API Admin. Privatni JSON ne slati u razgovor.

Poslije ispravke napraviti novu ciljanu probnu objavu s označenim push-om. Poslovi koji su trajno završili s `InvalidCredentials` ostaju u istoriji i ne šalju se automatski ponovo. Obična izmjena stare objave takođe ne pokreće novo slanje.

## Implementacija i granice

Od verzije 0.2.1 plugin šalje vidljive push poruke s `priority: high`. Android tada pokušava bržu dostavu i kada uređaj miruje; trenutno stizanje nije garantovano. Ovo zahtijeva samo ažuriranje WordPress plugin-a, bez novog APK-a. Priprema reda i slanje su zasebni cron događaji: uz zakazani zadatak svake minute mogu se obraditi u dvije uzastopne obrade. Provjera potvrda nakon 15 minuta ne odlaže samo slanje. [Firebase prioritet dostave](https://firebase.google.com/docs/cloud-messaging/android-message-priority).

Registracije su u privatnoj WordPress tabeli, bez javnog čitanja. Nasumičan ključ instalacije čuva se u Android SecureStore; server čuva njegov SHA-256 sažetak. Svaka instalacija može promijeniti ili isključiti samo sebe. Rotacija tokena ne mijenja studijski izbor. Nema emaila ni studentskih naloga.

Red ima jedinstven par objava/instalacija, provjerava aktuelnu publiku i odjavu prije slanja, šalje do 25 poruka po obradi, ponavlja privremene greške do pet pokušaja i obrađuje potvrde. Nevažeći tokeni se isključuju. Mrežni prekid nakon slanja, a prije prijema odgovora, može izazvati ponovljenu poruku; dostava nije exactly-once. Izmjene i ponovno objavljivanje već obrađene objave ne stvaraju novo slanje. Uključivanje plugin-a ne šalje stare objave.

Istorija poslova se briše nakon 30 dana, registracije bez osvježavanja nakon 90 dana. Opcioni Expo access token za enhanced security se podešava isključivo na serveru kroz `MATINF_EXPO_ACCESS_TOKEN` u `wp-config.php`; ne stavlja se u `EXPO_PUBLIC_*` varijable.

Lokalni testovi koriste simulirane Expo odgovore, nikada stvarne testne tokene za slanje. Oni ne zamjenjuju navedenu provjeru stvarne dostave. [Expo delivery i receipts](https://docs.expo.dev/push-notifications/sending-notifications/).
