import { useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const colors = { navy: "#26334b", blue: "#6955ce", body: "#4d5b78", pale: "#efebfb" };

// Clip only the original illustration/logo from the supplied design, preserving
// their pixels until standalone brand assets are available. All UI is native.
function Artwork({ region, width }: { region: "logo" | "hero"; width: number }) {
  const rect = region === "logo"
    ? { x: 156, y: 210, width: 86, height: 97 }
    : { x: 177, y: 365, width: 588, height: 506 };
  const scale = width / rect.width;
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants"
      style={{ width, height: rect.height * scale, overflow: "hidden" }}>
      <Image source={require("../../assets/images/onboarding/artwork-source.png")}
        resizeMode="stretch" fadeDuration={0}
        style={{ position: "absolute", width: 941 * scale, height: 1672 * scale, left: -rect.x * scale, top: -rect.y * scale }} />
    </View>
  );
}

type Props = { onContinue: () => void; onSkip: () => void };

export function OnboardingScreen({ onContinue, onSkip }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const scale = Math.min(width / 393, 1.25);
  const [infoVisible, setInfoVisible] = useState(false);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: 16 * scale, paddingTop: 40 * scale }]}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.content, { maxWidth: 491 }]}>
          <View style={[styles.header, fontScale > 1.2 && { flexDirection: "column", alignItems: "flex-start" }]}>
            <View style={styles.brand} accessibilityLabel="MATINF. Matematika. Informatika. Budućnost.">
              <Image source={require("../../assets/images/matinf-logo.png")} style={{ width: 65 * scale, height: 65 * scale }} resizeMode="contain" />
              <View style={{ marginLeft: 12 * scale }}>
                <Text style={[styles.brandName, { fontSize: 24 * scale, lineHeight: 27 * scale }]}>MATINF</Text>
                <Text style={[styles.tagline, { fontSize: 11 * scale, lineHeight: 14 * scale }]}>{"Matematika. Informatika.\nBudućnost."}</Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Opciono. Više informacija o podešavanju"
              onPress={() => setInfoVisible(true)} hitSlop={8}
              style={({ pressed }) => [styles.optional, { paddingHorizontal: 12 * scale, gap: 9 * scale, minHeight: 34 * scale }, pressed && styles.pressed]}>
              <Text style={[styles.optionalText, { fontSize: 14 * scale }]}>Opciono</Text>
              <View style={[styles.infoIcon, { width: 17 * scale, height: 17 * scale, borderRadius: 9 * scale }]}>
                <Text style={[styles.infoLetter, { fontSize: 13 * scale, lineHeight: 15 * scale }]}>i</Text>
              </View>
            </Pressable>
          </View>
          <View style={[styles.hero, { marginTop: 34 * scale }]}>
            <Artwork region="hero" width={336 * scale} />
          </View>
          <Text accessibilityRole="header" style={[styles.title, { fontSize: 46 * scale, lineHeight: 49 * scale, marginTop: 28 * scale }]}>
            {"Pratite važne\ninformacije"}
          </Text>
          <Text style={[styles.description, { fontSize: 20 * scale, lineHeight: 26.5 * scale, marginTop: 21 * scale }]}>
            {fontScale <= 1.05
              ? "Odaberite studijski program, godinu\nili predmete za koje želite da primate\nobavještenja."
              : "Odaberite studijski program, godinu ili predmete za koje želite da primate obavještenja."}
          </Text>
          <View style={[styles.footer, { paddingTop: 27 * scale, paddingBottom: 18 * scale }]}>
            <View accessible accessibilityLabel="Korak 1 od 3" style={[styles.dots, { gap: 13 * scale, marginBottom: 20 * scale }]}>
              {[0, 1, 2].map((step) => <View key={step} style={{ width: 10 * scale, height: 10 * scale, borderRadius: 5 * scale, backgroundColor: step === 0 ? colors.blue : "#ced7e7" }} />)}
            </View>
            <Pressable accessibilityRole="button" onPress={onContinue}
              style={({ pressed }) => [styles.primary, { minHeight: 55 * scale, borderRadius: 13 * scale }, pressed && styles.pressed]}>
              <Text style={[styles.primaryText, { fontSize: 20 * scale }]}>Nastavi</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onSkip}
              style={({ pressed }) => [styles.skip, { minHeight: 50 * scale, marginTop: 5 * scale }, pressed && styles.pressed]}>
              <Text style={[styles.skipText, { fontSize: 20 * scale }]}>Preskoči</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      <Modal visible={infoVisible} transparent animationType="fade" onRequestClose={() => setInfoVisible(false)}>
        <View style={styles.scrim}>
          <View style={styles.dialog} accessibilityViewIsModal>
            <Text accessibilityRole="header" style={styles.dialogTitle}>Podešavanje je opciono</Text>
            <Text style={styles.dialogBody}>Možete preskočiti ovaj korak. Obavještenja i izbor programa ili predmeta možete podesiti kasnije u podešavanjima.</Text>
            <Pressable accessibilityRole="button" style={styles.dialogClose} onPress={() => setInfoVisible(false)}>
              <Text style={styles.primaryText}>U redu</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
  scroll: { flexGrow: 1, alignItems: "center" },
  content: { width: "100%", flexGrow: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  brand: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  brandName: { color: colors.navy, fontWeight: "800", includeFontPadding: false, letterSpacing: 0.2 },
  tagline: { color: "#354568", marginTop: 2, includeFontPadding: false },
  optional: { backgroundColor: colors.pale, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  optionalText: { color: "#3e4c68", fontWeight: "500", includeFontPadding: false },
  infoIcon: { borderWidth: 1.5, borderColor: "#3e4c68", alignItems: "center", justifyContent: "center" },
  infoLetter: { color: "#3e4c68", fontWeight: "700", includeFontPadding: false },
  hero: { alignItems: "center" },
  title: { textAlign: "center", color: colors.navy, fontWeight: "700", letterSpacing: -1.1, includeFontPadding: false },
  description: { textAlign: "center", color: colors.body, includeFontPadding: false },
  footer: { marginTop: "auto" },
  dots: { flexDirection: "row", alignSelf: "center" },
  primary: { backgroundColor: colors.blue, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, paddingVertical: 10 },
  primaryText: { color: "#ffffff", fontSize: 18, fontWeight: "500", includeFontPadding: false },
  skip: { alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  skipText: { color: "#6955ce", includeFontPadding: false },
  pressed: { opacity: 0.75 },
  scrim: { flex: 1, backgroundColor: "#26334b66", justifyContent: "center", alignItems: "center", padding: 28 },
  dialog: { backgroundColor: "#fff", borderRadius: 24, padding: 24, maxWidth: 420, width: "100%" },
  dialogTitle: { color: colors.navy, fontSize: 24, fontWeight: "700" },
  dialogBody: { color: colors.body, fontSize: 17, lineHeight: 25, marginVertical: 20 },
  dialogClose: { backgroundColor: colors.blue, padding: 14, borderRadius: 12, alignItems: "center" },
});
