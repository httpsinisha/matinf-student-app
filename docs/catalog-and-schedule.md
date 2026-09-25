# Katalog, dokumenti i raspored

Verzije: MATINF Core 0.3.0, tema 0.2.0. Izvori provjereni 25.09.2026.

## Postavljanje na alwaysdata

1. WordPress → Dodaci → Dodaj novi → Otpremi dodatak: `wordpress/dist/matinf-core-0.3.0.zip`. Zamijeniti postojeći MATINF Core.
2. Izgled → Teme → Dodaj novu → Otpremi temu: `wordpress/dist/matinf-theme-0.2.0.zip`. Zamijeniti postojeću temu MATINF.
3. Kao Administrator otvoriti **Alati → MATINF katalog**. Pregledati opis uvoza i opciju arhiviranja. Pokrenuti **Uvezi katalog i napravi demo raspored**. Stranica uvozi manje grupe zapisa; ostaviti je otvorenu do potvrde. Ako se prekine, ponovo pokrenuti uvoz; završeni zapisi se ne dupliraju.
4. Preuzeti ponuđenu JSON kopiju prethodnih akademskih zapisa. Ona ne zamjenjuje punu kopiju baze i medija.
5. Osvježiti aplikaciju / ponovo je otvoriti. Programi zadržavaju postojeće ID-ove prema nazivu. Praćenje godina ostaje. Provjeriti pojedinačne predmete nakon arhiviranja starih oglednih predmeta.

Import ne šalje push poruke, ne mijenja profesorske objave i ne zahtijeva dijeljenje lozinke sa asistentom. Uvoz je dostupan samo Administratoru. Jednom dovršen katalog se ne prepisuje ponovnim klikom.

## Objavljivanje

U **MATINF podaci** otvoriti kartice programa, grupisane na osnovne, master i doktorske studije. Označiti proizvoljnu kombinaciju godina i pojedinačnih predmeta (postojeća granica 50 godina / 50 pojedinačnih predmeta). Nije potreban Ctrl. Za ciljanu publiku isključiti **Opšta objava za sve**. Ako nema ciljeva, objava ostaje opšta.

**Učitaj / dodaj dokumente** otvara WordPress Medije sa mogućnošću učitavanja sa računara i višestrukog izbora. Profesor može povezati svoje datoteke, Administrator sve datoteke koje može uređivati. Do 20 datoteka po objavi. Uklanjanje iz objave ne briše datoteku iz Medija. Dokumenti su javni kada se objava objavi. Ranije eksplicitno povezani dokumenti ostaju prikazani kao postojeći linkovi koje urednik može odznačiti; novi obrazac ne dodaje nasumičan dokument.

API dodaje `meta.attachments: [{id,title,url,mimeType}]` u objave. Android i tema prikazuju direktna dugmad za otvaranje datoteka.

## Podaci i granice tačnosti

`wordpress/plugins/matinf-core/data/catalog.json` sadrži provjerljive činjenice iz objavljenih nastavnih tabela: nazive, godinu, semestar, ECTS, časove predavanja/vježbi, izborne grupe i originalne linkove silabusa. Nije kopija kompletnog teksta svih vanjskih silabusa. Svaki predmet i program ima link ka zvaničnom izvoru.

| Program | Broj predmeta / izbornih opcija |
| --- | ---: |
| Diplomirani matematičar i informatičar | 46 |
| Diplomirani informatičar | 45 |
| Diplomirani profesor matematike i informatike | 41 |
| Matematička analiza i primjene | 8 |
| Algebra i geometrija | 13 |
| Doktor matematičkih nauka | 21 |

Sve alternative izbornih grupa su u katalogu. Časovi i ECTS opcija nasljeđuju podatke njihovog izbornog mjesta u zvaničnoj tabeli. Ogledni izbor daje 30 ECTS po semestru osnovnih i master studija. Doktorski predmeti su izborni i ne sabiraju se kao obavezni semestralni plan; zvanični izvor opisuje fleksibilan individualni plan i orijentacionu prvu godinu.

Preuzimanje: `node scripts/inspect-catalog.mjs`, zatim `node scripts/inspect-catalog.mjs --more`; prije toga sačuvati početnu stranicu u `artifacts/matinf-source.html`. Izrada provjerenih činjenica: `node scripts/build-catalog.mjs`. Sirove stranice i PDF za inspekciju su u ignorisanom `artifacts/catalog-source/`; distributivni JSON sadrži izvor za svaki program.

Struktura 35 profila prati javni pregled nastavnika i saradnika, uključujući gostujuće, stručne saradnike i penzionisane profesore. Imena i prezimena su izmišljena. Stvarne fotografije, privatne biografije i stvarne email adrese nisu pripisane izmišljenim identitetima. Raspodjela predmeta tim profilima je demonstracijska.

## Raspored

Android: **Početna → Moj raspored nastave** ili **Više → Moj raspored**. Izabrati osnovni program, godinu i zimski/ljetni semestar, pa pregledati sedmicu ili određeni dan. Izbor se pamti na uređaju odvojeno od pretplata za obavještenja. Dodir termina otvara predmet. Ranije učitan raspored se čuva za prikaz bez mreže.

Sajt: `/raspored/`, isti REST podaci i izbori. Endpoint: `GET /wp-json/matinf/v1/schedule?program_id=ID&year=1&semester=1`.

Raspored je **izmišljen za 2026/2027**, prema obliku postojećeg rasporeda informatike za ljetni semestar 2025/2026 sa zvanične stranice. Fond se uzima iz nastavnog plana (koji se u pojedinim stavkama razlikuje od objavljenog rasporeda), a jedan nastavni čas traje 45 minuta; između blokova je 15 minuta. Termini i demo sale su izmišljeni. Praksa i završni rad nemaju sedmične termine. Izborne grupe imaju unaprijed odabrane ogledne opcije; to nije studentska prijava izbornih predmeta. Napredno personalizovanje izbornih grupa nije uključeno u ovaj prikaz.
