# MATINF — APK za fizički telefon

Izrada: `powershell -ExecutionPolicy Bypass -File scripts/build-android-phone.ps1`.
Rezultat: `artifacts/build/MATINF-phone.apk`; log: `artifacts/build/android-phone.log`.

APK sadrži ARM64 biblioteke za fizički telefon i x86_64 za emulator. JavaScript je ugrađen u release paket: Expo Go i pokrenut Metro nisu potrebni. Koristi javni HTTPS WordPress sajt `https://sinisa.alwaysdata.net` i postojeći Expo/Firebase projekat. Potpisan je lokalnim razvojnim ključem za direktno testiranje, a ne za objavu u prodavnici.

Prebaciti APK na telefon, otvoriti ga iz aplikacije Datoteke i dozvoliti instalaciju iz tog izvora ako Android to zatraži. Po pokretanju izabrati praćenje i, po želji, dozvoliti obavještenja.

Provjere na telefonu:

- Sačuvati program/godinu i otvoriti Moj raspored: nastava i ispiti treba da odgovaraju prvom sačuvanom izboru.
- Dodati drugi program/godinu: prvi izabrani ostaje početni raspored.
- Apsolventski pregled: početno šest termina za tri predmeta četvrte godine. Profesor može promijeniti objavljene termine kroz WordPress → Raspored.
- Otvoriti ispit i uključiti podsjetnik sat ili dan ranije. U Više → Moji podsjetnici provjeriti termin i otkazivanje. Potreban je Core 0.5.0.
- Na osoblju, predmetima, obavještenjima i početnoj skrolovati, otvoriti detalj i vratiti se: mjesto i filteri treba da ostanu sačuvani. Provjeriti i prelazak između donjih tabova.
- Otvoriti obavještenje pa provjeriti filter Nepročitane. Pročitane objave ostaju u pregledu Sve.
- Otvoriti objavu sa PDF prilogom i provjeriti otvaranje dokumenta.
- Ako su obavještenja uključena, objaviti novu ciljanu objavu kroz profesora i provjeriti prijem i otvaranje na telefonu.

Za nove funkcije zamijeniti plugin paketom `wordpress/dist/matinf-core-0.5.0.zip`, a za novi logo sajta temu paketom `wordpress/dist/matinf-theme-0.4.0.zip`. Nije potreban ponovni uvoz kataloga. Administratorov ulazak u kontrolnu tablu pokreće jednokratno ažuriranje 35 imena uz očuvanje ID-jeva i veza sa predmetima.

Podsjetnici su lokalni Android termini, nezavisni od prekidača za push objave. Aplikacija provjerava izmjene sa sajta pri ponovnom otvaranju i osvježavanju rasporeda; bez veze zadržava posljednji zakazani podsjetnik. Vrijeme ispita koristi zonu Europe/Sarajevo. Android može odložiti dostavu radi štednje baterije.
