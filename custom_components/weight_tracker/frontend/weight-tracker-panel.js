/*
 * Weight Tracker – sidebar panel.
 * Plain web component without external dependencies (works offline).
 * Data arrives via the websocket subscription "weight_tracker/subscribe".
 */

const DAY = 864e5;

// Categorical person colors, fixed order (validated for CVD separation).
// Values that may go to the AI, grouped for the selection on "My details".
const AI_FIELDS = {
  profile: ["sex", "age", "height", "goal"],
  weight: ["weight", "trend", "change_7d", "change_30d", "change_total", "rate", "weekly", "bmi"],
  body: ["body_fat", "muscle_mass", "water", "bone_mass", "bmr", "protein", "visceral_fat", "metabolic_age", "skeletal_muscle", "body_score", "body_type", "heart_rate", "whtr"],
  fitness: ["activity", "tdee", "vo2max"],
};
const AI_FIELD_KEYS = Object.values(AI_FIELDS).flat();

// Right half of the body outlines (x from the centre line, y down, 0-400),
// mirrored and smoothed into the silhouette of the composition figure.
const FIGURES = {
  male: [[0, 6], [11, 7], [18, 15], [20, 28], [19, 42], [15, 53], [11, 60], [11, 70], [24, 75], [40, 79], [50, 87], [54, 100],
    [57, 130], [61, 160], [64, 190], [65, 210], [67, 226], [63, 240], [57, 243], [54, 234], [53, 214], [50, 190], [47, 160],
    [44, 130], [41, 112], [37, 135], [35, 160], [34, 182], [36, 205], [38, 222], [38, 245], [36, 280], [33, 312], [31, 345],
    [28, 372], [27, 382], [33, 392], [31, 398], [13, 398], [10, 390], [11, 372], [12, 340], [13, 300], [11, 262], [6, 236], [0, 228]],
  female: [[0, 0], [7, 1], [10, 7], [8, 13], [15, 15], [22, 24], [23, 38], [20, 50], [14, 58], [9, 63], [9, 72], [20, 76],
    [32, 80], [39, 88], [42, 100], [43, 128], [45, 158], [50, 184], [55, 204], [58, 220], [55, 236], [49, 238], [46, 228],
    [46, 208], [42, 186], [37, 160], [33, 132], [30, 112], [32, 134], [28, 154], [25, 170], [28, 188], [35, 205], [38, 222],
    [38, 250], [33, 290], [29, 322], [27, 350], [25, 374], [24, 384], [30, 394], [28, 398], [11, 398], [9, 390], [10, 372],
    [11, 344], [10, 306], [8, 268], [5, 246], [0, 240]],
};

// Closed smooth path (Catmull-Rom) through the mirrored outline, centred at x=100.
function figurePath(half) {
  const pts = [...half, ...half.slice(1, -1).reverse().map(([x, y]) => [-x, y])].map(([x, y]) => [100 + x, y]);
  const n = pts.length;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return `${d}Z`;
}

const COLORS = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
};

// Icons from Material Design Icons (Apache 2.0, pictogrammers.com), the set Home Assistant uses.
const ICONS = {
  scale: "M5,2H19A2,2 0 0,1 21,4V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V4A2,2 0 0,1 5,2M12,4A4,4 0 0,0 8,8H11.26L10.85,5.23L12.9,8H16A4,4 0 0,0 12,4M5,10V20H19V10H5Z",
  target: "M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12C22,10.84 21.79,9.69 21.39,8.61L19.79,10.21C19.93,10.8 20,11.4 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4C12.6,4 13.2,4.07 13.79,4.21L15.4,2.6C14.31,2.21 13.16,2 12,2M19,2L15,6V7.5L12.45,10.05C12.3,10 12.15,10 12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12C14,11.85 14,11.7 13.95,11.55L16.5,9H18L22,5H19V2M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12H16A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8V6Z",
  fire: "M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2M14.5 17.5C14.22 17.74 13.76 18 13.4 18.1C12.28 18.5 11.16 17.94 10.5 17.28C11.69 17 12.4 16.12 12.61 15.23C12.78 14.43 12.46 13.77 12.33 13C12.21 12.26 12.23 11.63 12.5 10.94C12.69 11.32 12.89 11.7 13.13 12C13.9 13 15.11 13.44 15.37 14.8C15.41 14.94 15.43 15.08 15.43 15.23C15.46 16.05 15.1 16.95 14.5 17.5H14.5Z",
  arm: "M3 18.34C3 18.34 4 7.09 7 3L12 4L11 7.09H9V14.25H10C12 11.18 16.14 10.06 18.64 11.18C21.94 12.71 21.64 17.32 18.64 19.36C16.24 21 9 22.43 3 18.34Z",
  check: "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z",
  restore: "M13,3A9,9 0 0,0 4,12H1L4.89,15.89L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3Z",
  pencil: "M14.06,9L15,9.94L5.92,19H5V18.08L14.06,9M17.66,3C17.41,3 17.15,3.1 16.96,3.29L15.13,5.12L18.88,8.87L20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18.17,3.09 17.92,3 17.66,3M14.06,6.19L3,17.25V21H6.75L17.81,9.94L14.06,6.19Z",
};
const icon = (name) => `<svg class="mdi" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;

// Overview cards: allowed sizes and the size they start with, in their default order.
const BOARD_CARDS = {
  main: { sizes: ["S", "M", "L", "XL"], size: "L" },
  score: { sizes: ["S", "M", "L"], size: "M" },
  ai: { sizes: ["S", "M", "L", "XL"], size: "M" },
  composition: { sizes: ["M", "L"], size: "L" },
  bodytype: { sizes: ["M", "L"], size: "L" },
  suggestions: { sizes: ["S", "M"], size: "M" },
  fat: { sizes: ["S", "M", "L"], size: "M" },
  muscle: { sizes: ["S", "M", "L"], size: "M" },
  metabolism: { sizes: ["S", "M", "L"], size: "M" },
  heart: { sizes: ["S", "M", "L"], size: "L" },
  indices: { sizes: ["S", "M", "L"], size: "M" },
};
const BOARD_ORDER = Object.keys(BOARD_CARDS);

// Values the history chart can show: key, unit, decimals, kg (follows the display unit).
const CHART_METRICS = [
  { key: "weight", unit: "kg", digits: 1, kg: true },
  { key: "bmi", unit: "", digits: 1 },
  { key: "body_fat", unit: "%", digits: 1 },
  { key: "fat_mass", unit: "kg", digits: 1, kg: true },
  { key: "lean_mass", unit: "kg", digits: 1, kg: true },
  { key: "muscle_mass", unit: "kg", digits: 1, kg: true },
  { key: "skeletal_muscle", unit: "kg", digits: 1, kg: true },
  { key: "water", unit: "%", digits: 1 },
  { key: "visceral_fat", unit: "", digits: 1 },
  { key: "protein", unit: "%", digits: 1 },
  { key: "bmr", unit: "kcal", digits: 0 },
  { key: "body_score", unit: "", digits: 0 },
  { key: "metabolic_age", unit: "", digits: 0 },
  { key: "heart_rate", unit: "bpm", digits: 0 },
  { key: "waist", unit: "cm", digits: 1 },
];

const RANGES = [
  { key: 30, de: "30 T", en: "30 d" },
  { key: 90, de: "90 T", en: "90 d" },
  { key: 365, de: "1 J", en: "1 y" },
  { key: 0, de: "Alles", en: "All" },
];

const TEXT = {
  de: {
    title: "Gewicht",
    noScale: "Noch keine Waage eingerichtet. Füge unter Einstellungen → Geräte & Dienste die Integration „Weight Tracker“ hinzu.",
    loading: "Lade Daten …",
    pendingTitle: (n) => (n === 1 ? "1 Messung wartet auf Zuordnung" : `${n} Messungen warten auf Zuordnung`),
    pendingHint: "Wer stand auf der Waage?",
    discard: "Verwerfen",
    trend: "Trend",
    d7: "7 Tage",
    d30: "30 Tage",
    perWeek: "pro Woche",
    total: "gesamt",
    bmi: "BMI",
    goal: "Ziel",
    goalLeft: (kg) => `noch ${kg}`,
    goalReached: "Ziel erreicht 🎉",
    goalEta: (d) => `voraussichtlich ${d}`,
    goalNoEta: "Prognose braucht mehr Messungen",
    noData: "Noch keine Messung",
    measured: "gemessen",
    history: "Verlauf",
    absolute: "Gewicht",
    relative: "Veränderung",
    chartEmpty: "Im gewählten Zeitraum gibt es keine Messungen.",
    forecast: "Prognose",
    calendar: "Kalender",
    calendarHint: "Jedes Kästchen ist ein Tag. Blau: Trend in Richtung Ziel, Rot: weg vom Ziel, Grau: kaum Veränderung, leer: nicht gewogen.",
    calendarStats: (days, best) => `${days} Tage mit Messung in 12 Monaten · längste Serie ${best} Tage`,
    calendarLegend: { good: "Richtung Ziel", bad: "weg vom Ziel", flat: "kaum Veränderung", none: "nicht gewogen" },
    weekdaysShort: ["Mo", "", "Mi", "", "Fr", "", ""],
    importExport: "Import & Export",
    importExportHint: "Exportiere deine Messungen als CSV (z. B. als Sicherung) oder übernimm alte Daten aus anderen Apps (Withings, Zepp/Mi Fit, Garmin, eigene Tabellen).",
    exportCsv: "⬇ CSV exportieren",
    importCsv: "⬆ CSV importieren",
    importPreview: (n, from, to, skipped) => `${n} Messungen von ${from} bis ${to}${skipped ? ` · ${skipped} Zeilen übersprungen` : ""}`,
    importColumns: (cols) => `Erkannte Spalten: ${cols}`,
    importNothing: "In dieser Datei wurden keine Gewichte gefunden. Sie braucht eine Spalte mit Datum und eine mit Gewicht.",
    importTarget: "Importieren für",
    importButton: "Importieren",
    importDone: (added, skipped) => `${added} Messungen importiert${skipped ? `, ${skipped} doppelte übersprungen` : ""}`,
    today: "Heute",
    measurement: "Messung",
    monthly: "Monatsdurchschnitt",
    month: "Monat",
    list: "Messungen",
    all: "Alle",
    date: "Datum",
    person: "Person",
    weight: "Gewicht",
    detected: "Erkannt",
    more: "Mehr anzeigen",
    deleteConfirm: (w, d) => `Messung ${w} vom ${d} endgültig löschen?`,
    deleteLabel: "Löschen",
    add: "Messung eintragen",
    addButton: "Eintragen",
    open: "offen",
    discarded: "verworfen",
    methods: {
      only_match: "automatisch",
      closest: "automatisch (nächste)",
      presence: "automatisch (anwesend)",
      manual: "manuell",
      no_match: "unklar",
      ambiguous: "unklar",
    },
    bmiCat: (b) => (b < 18.5 ? "Untergewicht" : b < 25 ? "Normalgewicht" : b < 30 ? "Übergewicht" : "Adipositas"),
    error: "Fehler",
    notMine: "Nicht ich (wieder offen)",
    pendingOption: "Offen",
    noAccess: "Für dich sind noch keine Daten freigegeben. Ein Administrator kann das im Panel „Gewicht“ unter „Freigaben“ einstellen.",
    access: "Freigaben",
    accessHint: "Wer darf welche Daten sehen? Admins sehen und bearbeiten immer alles. Die verknüpfte Person sieht ihre eigenen Daten und kann eigene Messungen zuordnen, eintragen und löschen.",
    user: "Benutzer",
    admin: "Admin",
    accNone: "kein Zugriff",
    accAdmin: "sieht alles",
    accView: "darf ansehen",
    accOwner: "ist diese Person",
    sensors: "Sensoren in HA",
    sensorsHint: "⚠️ Sensoren sind in Home Assistant für alle Benutzer sichtbar – auch wenn die Person im Panel nicht freigegeben ist.",
    saved: "Gespeichert",
    me: "Ich",
    petWarning: {
      fast_loss: (p) => `Nimmt schnell ab: ${p} % pro Woche`,
      fast_gain: (p) => `Nimmt schnell zu: ${p} % pro Woche`,
      loss_30d: (p) => `Hat in 30 Tagen ${p} % abgenommen`,
      gain_30d: (p) => `Hat in 30 Tagen ${p} % zugenommen`,
    },
    petWarningHint: "Ungewöhnlich schnelle Veränderungen können ein Warnzeichen sein – sprich am besten mit deiner Tierarztpraxis.",
    notifyPetWarnings: "Warnungen zu Haustieren (ungewöhnlich schnelle Gewichtsänderung)",
    petNotes: "Notizen",
    petNotesHint: "Tierarzt, Impfungen, Futterumstellung, Medikamente …",
    eventCategories: { vet: "🩺 Tierarzt", vaccination: "💉 Impfung", food: "🍽️ Futter", medication: "💊 Medikament", other: "📝 Sonstiges" },
    addNote: "Hinzufügen",
    notePlaceholderPet: "z. B. Zahnkontrolle, neues Trockenfutter",
    children: "Kinder",
    childrenHint: "Kinder und Babys wiegst du wie Haustiere: einmal allein, einmal mit dem Kind auf dem Arm. Statt eines Zielgewichts zeigt das Panel die Perzentile (WHO bis 2 Jahre, danach CDC).",
    addChild: "Kind hinzufügen",
    newChild: "Neues Kind",
    deleteChild: "Kind löschen",
    childBirthDate: "Geburtsdatum",
    childSexHint: "Für die Perzentilen (Mädchen und Jungen haben eigene Kurven).",
    childStartWeight: "Aktuelles Gewicht (ungefähr)",
    childAge: (months) => months < 1 ? `${Math.max(0, Math.round(months * 4.35))} Wochen` : months < 24 ? `${Math.floor(months)} ${Math.floor(months) === 1 ? "Monat" : "Monate"}` : `${Math.floor(months / 12)} Jahre`,
    percentile: (p) => `${p}. Perzentile`,
    percentileClass: { low: "unter der 3. Perzentile – bitte kinderärztlich abklären", high: "über der 97. Perzentile – bitte kinderärztlich abklären", normal: "im Normalbereich (3.–97. Perzentile)" },
    growthMissing: "Für die Perzentilen fehlen Geschlecht oder Geburtsdatum.",
    growthLegend: "Bänder: 3.–97. und 15.–85. Perzentile, gestrichelt: Median",
    unit: "Einheit",
    tabOverview: "Übersicht",
    tabMeasurements: "Messungen",
    tabSettings: "Einstellungen",
    scale: "Waage",
    scaleHint: "Welcher Sensor liefert das Gewicht, und wie streng wird zugeordnet?",
    name: "Name",
    source: "Gewichtssensor der Waage",
    minWeight: "Minimales Gewicht",
    minWeightHint: "Leichtere Werte (Taschen, Haustiere) werden ignoriert.",
    maxWeight: "Maximales Gewicht",
    tolerance: "Toleranz",
    toleranceHint: "So weit darf eine Messung vom bisherigen Gewicht abweichen. Wächst um 0,15 kg pro Tag ohne Messung.",
    margin: "Eindeutigkeits-Abstand",
    marginHint: "Passen mehrere Personen, muss die nächste um so viel näher liegen – sonst wird nachgefragt.",
    debounce: "Wartezeit bis Wert stabil",
    debounceHint: "Viele Waagen senden Zwischenwerte. Gespeichert wird der Wert, der so lange gleich bleibt.",
    save: "Speichern",
    cancel: "Abbrechen",
    persons: "Personen",
    personsHint: "Wer wird gewogen? Das Startgewicht hilft, die erste Messung richtig zu erkennen.",
    addPerson: "Person hinzufügen",
    newPerson: "Neue Person",
    edit: "Bearbeiten",
    deletePerson: "Person löschen",
    deletePersonConfirm: (name, n) => `Person „${name}“ und ${n === 1 ? "1 Messung" : `alle ${n} Messungen`} endgültig löschen?`,
    noPersonsAdmin: "Noch keine Personen angelegt.",
    toSettings: "Personen anlegen",
    startWeight: "Startgewicht",
    startWeightHint: "Ungefähres aktuelles Gewicht.",
    height: "Größe",
    heightHint: "Optional, für den BMI.",
    goalWeight: "Zielgewicht",
    goalWeightHint: "Optional, für Fortschritt und Prognose.",
    presence: "Anwesenheit",
    presenceHint: "Optional: die passende Person-Entität. Ist nur eine passende Person zu Hause, bekommt sie die Messung.",
    linkedUser: "Home-Assistant-Benutzer",
    linkedUserHint: "Dieser Benutzer sieht seine Daten und kann eigene Messungen zuordnen, eintragen und löschen.",
    none: "— keine —",
    noUser: "— kein Benutzer —",
    viewers: "Darf außerdem ansehen",
    viewersHint: "Nur lesen. Admins sehen immer alles.",
    noOtherUsers: "Keine weiteren Benutzer vorhanden.",
    createSensors: "Sensoren in Home Assistant anlegen",
    count: (n) => (n === 1 ? "1 Messung" : `${n} Messungen`),
    required: (label) => `Bitte „${label}“ ausfüllen.`,
    editProfile: "Daten bearbeiten",
    myData: "Meine Daten",
    pets: "Haustiere",
    pet: "Haustier",
    weighPet: (name) => `${name} wiegen`,
    weighAnyPet: "Haustier wiegen",
    petSessionTitle: (name) => `Haustier-Messung${name ? ` für ${name}` : ""} läuft`,
    petSessionHint: (name) => `Stell dich einmal allein auf die Waage und einmal mit ${name || "dem Tier"} auf dem Arm – die Reihenfolge ist egal.`,
    petSessionStep: (n) => `Messung ${n + 1} von 2`,
    petSessionLeft: (time) => `noch ${time}`,
    petSuggestion: "War das eine Haustier-Messung?",
    petSuggestionText: (pet, kg, who) => `${pet}: ${kg} (${who} mit ${pet} auf dem Arm)`,
    petYes: (name) => `Ja, ${name}`,
    petNo: "Nein, das war ich",
    petMeasurements: "Haustier-Messungen",
    carriedBy: "gewogen von",
    petNoData: "Noch keine Messung – tippe auf „Wiegen“.",
    species: "Tierart",
    speciesNames: { cat: "Katze", dog: "Hund", rabbit: "Kaninchen", guinea_pig: "Meerschweinchen", other: "Anderes" },
    addPet: "Haustier hinzufügen",
    newPet: "Neues Haustier",
    deletePet: "Haustier löschen",
    petsHint: "Haustiere wiegst du, indem du sie auf den Arm nimmst. Alle Benutzer sehen sie und dürfen sie wiegen.",
    petStartWeight: "Ungefähres Gewicht",
    petStartHint: "Hilft, die Haustier-Messung automatisch zu erkennen.",
    petMethods: { pet_session: "per Knopf", pet_auto: "automatisch erkannt", manual: "manuell" },
    profileHint: "Diese Angaben kannst du selbst ändern.",
    birthDate: "Geburtsmonat",
    birthMonthHint: "Monat und Jahr reichen für das Alter.",
    age: "Alter",
    ageMissing: "Geburtsmonat eintragen",
    sex: "Geschlecht",
    sexNames: { male: "Männlich", female: "Weiblich" },
    sexNone: "— keine Angabe —",
    sexHint: "Für Körperfett- und Taillen-Einstufung.",
    waist: "Taille",
    waistNew: "Neuer Taillenumfang",
    waistHint: "Auf Höhe des Bauchnabels messen, morgens, entspannt ausgeatmet.",
    whtr: "Taille/Größe",
    whtrClass: { low: "niedrig", healthy: "gesund", increased: "erhöht", high: "hoch" },
    whtrLine: (cm, ratio, cls) => `Taille ${cm} cm · Taille/Größe ${ratio} – ${cls}`,
    body: "Körperzusammensetzung",
    bodyHint: "Geschätzt aus der Impedanz deiner Waage – Richtwerte, keine medizinische Messung.",
    bodyScaleHint: "Von deiner Waage gemessen.",
    bodyMissing: (fields) => `Deine Waage misst auch die Körperzusammensetzung. Dafür fehlt noch: ${fields}.`,
    bodyFields: { sex: "Geschlecht", birth_month: "Geburtsmonat", height: "Größe" },
    bodyFat: "Körperfett",
    muscle: "Muskelmasse",
    water: "Körperwasser",
    bone: "Knochenmasse",
    bmr: "Grundumsatz",
    fatClass: { low: "niedrig", healthy: "gesund", high: "erhöht", very_high: "hoch" },
    fatRange: (lo, hi) => `Gesund für dich: ${lo}–${hi} %`,
    note: "Notiz",
    editNote: "Notiz bearbeiten",
    notePlaceholder: "z. B. nach dem Urlaub, krank, neues Training",
    scaleSensors: "Sensoren der Waage",
    scaleSensorsHint: "Welche Werte deine Waage an Home Assistant meldet. Nur das Gewicht ist nötig – alles andere nur, falls deine Waage es liefert.",
    muscleEntity: "Muskelmasse-Sensor",
    waterEntity: "Körperwasser-Sensor",
    boneEntity: "Knochenmasse-Sensor",
    bmrEntity: "Grundumsatz-Sensor",
    directHint: "Falls deine Waage diesen Wert direkt liefert – er ersetzt dann die Schätzung aus der Impedanz.",
    impedanceEntity: "Impedanz-Sensor",
    impedanceHint: "Nur falls deine Waage die Impedanz liefert (z. B. Xiaomi Body Composition Scale). Daraus werden Körperfett, Muskeln usw. geschätzt. Xiaomi S400: hier „Impedance Low“, unten „Impedance High“.",
    ovPersons: "Person wählen",
    infoAbout: (label) => `Was bedeutet „${label}“?`,
    scaleSuggestTitle: "Weitere Sensoren deiner Waage gefunden",
    scaleSuggestText: (list) => `Noch nicht eingetragen: ${list}.`,
    scaleSuggestApply: "Übernehmen und speichern",
    pulseMissingAdmin: "Kein Puls: Unter Einstellungen → Sensoren der Waage ist noch kein Herzfrequenz-Sensor eingetragen.",
    pulseWaiting: "Der Puls erscheint ab der nächsten Messung.",
    pulseMissing: "Kein Puls – die Waage misst ihn nicht oder er ist noch nicht eingerichtet.",
    tabHistory: "Verlauf",
    settingsTitle: "Einstellungen",
    personalSettings: "Persönlich",
    adminSettings: "Verwaltung",
    settingsFor: (name) => `für ${name}`,
    shareTitle: "Wer darf mich sehen",
    shareHint: "Wähle, wer deine Werte im Panel sehen darf. Admins sehen alle Daten. Freigegebene Personen können nur ansehen, nichts ändern.",
    shareNone: "Es gibt keine weiteren Benutzer.",
    dataTitle: "Daten exportieren und importieren",
    pendingBar: (n) => n === 1 ? "1 Messung wartet auf Zuordnung" : `${n} Messungen warten auf Zuordnung`,
    petBar: (n) => n === 1 ? "1 Haustier-Messung erkannt" : `${n} Haustier-Messungen erkannt`,
    showItems: "Anzeigen",
    hideItems: "Ausblenden",
    addOpen: "Eintragen",
    addTabMeasure: "Messung eintragen",
    addTabPet: "Haustier oder Kind wiegen",
    addPetHint: "Die nächsten zwei Wägungen gehören zusammen: einmal allein, einmal mit dem Tier oder Kind auf dem Arm.",
    closeLabel: "Schließen",
    last30: "Letzte 30 Tage",
    noHistory: "Noch kein Verlauf – dafür braucht es Messungen von Personen.",
    chartMetric: "Wert",
    chartMetrics: {
      weight: "Gewicht", bmi: "BMI", body_fat: "Körperfett", fat_mass: "Fettmasse", lean_mass: "Fettfreie Masse",
      muscle_mass: "Muskelmasse", skeletal_muscle: "Skelettmuskelmasse", water: "Körperwasser", visceral_fat: "Viszeralfett",
      protein: "Eiweiß", bmr: "Grundumsatz", body_score: "Körperbewertung", metabolic_age: "Körperalter", heart_rate: "Puls", waist: "Taille",
    },
    chartUnits: { body_score: "Punkte", metabolic_age: "Jahre" },
    chartNoMetric: (name) => `Noch keine Werte für „${name}“ in diesem Zeitraum.`,
    aiPrompt: "Anweisungen an die KI",
    aiPromptHint: "Was die KI tun soll und wie sie antwortet. Die freigegebenen Messwerte jeder Person werden automatisch darunter angehängt. Damit die Hinweise sauber angezeigt werden: erste Zeile eine Einschätzung, danach Empfehlungen als Zeilen mit „- “.",
    aiPromptReset: "Auf Standard zurücksetzen",
    cardNames: {
      main: "Gewicht", score: "Körperbewertung", ai: "KI-Hinweise", composition: "Körperzusammensetzung", bodytype: "Körpertyp",
      suggestions: "Vorschläge zum Gewicht", fat: "Fett und Wasser", muscle: "Muskeln und Knochen", metabolism: "Stoffwechsel",
      heart: "Herz und Fitness", indices: "Weitere Kennzahlen",
    },
    showMore: "Mehr",
    boardEdit: "Anpassen",
    boardDone: "Fertig",
    boardReset: "Zurücksetzen",
    hiddenCards: "Ausgeblendet",
    noHiddenCards: "Keine Karte ausgeblendet.",
    cardSize: (z) => `Größe ${z}`,
    moveEarlier: "Nach vorne",
    moveLater: "Nach hinten",
    hideCard: "Ausblenden",
    valuesTitle: "Körperwerte",
    valueGroupsExtra: { heart: "Herz und Fitness", indices: "Weitere Kennzahlen" },
    bmrMifflin: "Grundumsatz (Mifflin-St Jeor)",
    bmrKatch: "Grundumsatz (Katch-McArdle)",
    tdeeLabel: "Gesamtumsatz",
    hrMax: "Max. Herzfrequenz",
    hrReserve: "Herzfrequenzreserve",
    vo2max: "VO₂max (geschätzt)",
    zonesLabel: "Pulszonen",
    zoneNames: { health: "Gesundheit", fat_burn: "Fettverbrennung", aerobic: "Aerob", anaerobic: "Anaerob" },
    ponderal: "Ponderal-Index",
    bsa: "Körperoberfläche",
    broca: "Idealgewicht (Broca)",
    impedanceIndex: "Impedanz-Index",
    fatMassLabel: "Fettmasse",
    waterLiters: "Wassermenge",
    activity: "Aktivität",
    activityLevels: { "1.2": "Sitzend", "1.375": "Wenig aktiv", "1.55": "Mäßig aktiv", "1.725": "Sehr aktiv", "1.9": "Extrem aktiv" },
    activityHints: { "1.2": "Bürojob, kaum Sport", "1.375": "1–3× Sport pro Woche", "1.55": "3–5× Sport pro Woche", "1.725": "6–7× Sport pro Woche", "1.9": "körperliche Arbeit + Sport" },
    activityHint: "Für den Gesamtumsatz: wie aktiv dein Alltag ist.",
    bodyModel: "Formel für die Körperzusammensetzung",
    bodyModels: { standard: "Standard (wie Körperanalysewaagen)", sun: "Sun et al. 2003 (Studienformel)" },
    bodyModelHint: "Bestimmt, wie Körperfett, Wasser, Muskeln und Knochen aus der Impedanz berechnet werden. Standard ist auf Waagen abgestimmt, bei denen man mit den Füßen misst. Sun et al. ist eine veröffentlichte Studienformel aus Messungen von Hand zu Fuß; mit einer Fußwaage fällt das Körperfett damit meist niedriger aus.",
    valueGroups: { fat: "Fett und Wasser", muscle: "Muskeln und Knochen", metabolism: "Stoffwechsel" },
    sinceStart: (kg) => `seit Beginn ${kg}`,
    infoClose: "Schließen",
    infoYourRange: (lo, hi) => `Dein Standardbereich: ${lo}–${hi} %.`,
    segments: { muscle: "Muskelgewebe", essential_fat: "Essentielles Fett", storage_fat: "Speicherfett", bone: "Knochen", other: "Sonstiges" },
    info: {
      weight: "Dein aktuelles Gewicht. Ist die Messung als „mit Kleidung“ markiert, ist die Kleidung schon abgezogen. Das Gewicht schwankt von Tag zu Tag um 1–2 kg, je nachdem, was du gegessen und getrunken hast. Darum zeigt der Trend besser, wohin es geht.",
      trend: "Dein geglättetes Gewicht. Jede neue Messung verschiebt den Trend nur ein Stück in ihre Richtung. So siehst du die echte Entwicklung ohne die täglichen Schwankungen.",
      changes: "Wie sich dein Trendgewicht in den letzten 7 bzw. 30 Tagen und seit der ersten Messung verändert hat. Das Tempo ist die durchschnittliche Veränderung pro Woche. Gesund abnehmen heißt meist 0,5–1 % des Körpergewichts pro Woche.",
      bmi: "Body-Mass-Index: Gewicht in kg geteilt durch das Quadrat der Größe in Metern. Für Erwachsene gilt: unter 18,5 Untergewicht, 18,5–24,9 Normalgewicht, 25–29,9 Übergewicht, ab 30 Adipositas. Der BMI unterscheidet nicht zwischen Muskeln und Fett. Sehr muskulöse Menschen haben deshalb oft einen hohen BMI, ohne zu viel Fett zu haben.",
      body_score: "Eine Gesamtnote von 10 bis 100. Sie beginnt bei 100 und sinkt, wenn BMI, Körperfett, Muskeln, Körperwasser, Viszeralfett, Knochen, Grundumsatz oder Eiweiß außerhalb des Normalbereichs liegen. Gut, um deine Entwicklung über Wochen zu verfolgen.",
      body_fat: "Wie viel deines Gewichts Fett ist. Die Waage schickt einen schwachen, nicht spürbaren Strom durch deinen Körper. Muskeln enthalten viel Wasser und leiten ihn gut, Fett kaum. Aus dem Widerstand wird das Fett geschätzt. Normal sind bei 18–39 Jahren etwa 11–22 % für Männer und 21–35 % für Frauen, mit dem Alter etwas mehr. Der Wert hängt vom Wasserhaushalt ab, miss deshalb möglichst immer zur gleichen Tageszeit.",
      fat_mass: "Wie viele Kilogramm deines Gewichts Fett sind: Gewicht mal Körperfettanteil.",
      composition: "So setzt sich dein Gewicht zusammen. Muskelgewebe sind die Muskeln, mit denen du dich bewegst. Essentielles Fett braucht der Körper zum Leben, etwa 3 % des Gewichts bei Männern und 12 % bei Frauen. Speicherfett ist das übrige Fett, also die Energiereserve. Knochen meint die Mineralien in den Knochen. Sonstiges sind Organe, Blut, Haut und Wasser außerhalb der Muskeln.",
      water: "Wie viel deines Gewichts Wasser ist. Muskeln bestehen zu etwa drei Vierteln aus Wasser, Fett kaum. Normal sind bei Männern ab etwa 55 %, bei Frauen ab etwa 45 %. Der Wert schwankt deutlich damit, wie viel du getrunken oder geschwitzt hast.",
      water_mass: "Die Wassermenge in deinem Körper in Litern. Sie macht etwa drei Viertel der fettfreien Masse aus. Eine gute Versorgung mit Wasser ist wichtig für Kreislauf, Konzentration und Muskeln.",
      muscle: "Alles, was nicht Fett und nicht Knochen ist: die Muskeln samt dem Wasser darin, aber auch Organe. Darum ist dieser Wert viel höher als die Skelettmuskelmasse. Was normal ist, hängt von Größe und Geschlecht ab.",
      skeletal_muscle: "Nur die Muskeln, mit denen du dich bewegst. Typisch sind etwa 35–45 % des Gewichts bei Männern und 30–40 % bei Frauen. Krafttraining und genug Eiweiß erhalten sie, besonders beim Abnehmen und im Alter.",
      protein: "Eiweiß ist der Baustoff für Muskeln, Organe und Enzyme. Normal sind etwa 16–20 % des Gewichts. Ein niedriger Wert deutet auf wenig Muskeln oder zu wenig Eiweiß in der Ernährung hin.",
      bone: "Das geschätzte Gewicht der Mineralien in deinen Knochen, vor allem Calcium. Es ändert sich nur sehr langsam. Eine Messung der Knochendichte ersetzt der Wert nicht.",
      visceral_fat: "Viszeralfett liegt im Bauch um die Organe. Es erhöht das Risiko für Herz-Kreislauf-Erkrankungen und Diabetes stärker als das Fett unter der Haut. 1–9 ist normal, 10–14 erhöht, ab 15 hoch. Bewegung senkt es oft schneller als das übrige Fett.",
      lean_mass: "Alles außer Fett: Muskeln, Knochen, Organe und Wasser. Beim Abnehmen sollte vor allem das Fett weniger werden, während die fettfreie Masse möglichst gleich bleibt.",
      whtr: "Taillenumfang geteilt durch Körpergröße. Faustregel: Die Taille sollte kleiner sein als die halbe Körpergröße, also unter 0,5; ab 50 Jahren gilt bis 0,6 als normal. Zeigt Bauchfett besser als der BMI. Dafür trägst du unter „Meine Daten“ deinen Taillenumfang ein.",
      bmr: "Der Grundumsatz ist die Energie, die dein Körper in völliger Ruhe am Tag verbraucht: für Atmung, Herzschlag, Organe und Körperwärme. Mehr Muskeln erhöhen ihn.",
      bmr_mifflin: "Grundumsatz aus Gewicht, Größe, Alter und Geschlecht (Mifflin-St Jeor). Die übliche Formel, wenn man die Körperzusammensetzung nicht kennt: der Energieverbrauch in völliger Ruhe pro Tag.",
      bmr_katch: "Grundumsatz aus der fettfreien Masse (Katch-McArdle). Genauer, wenn du viele Muskeln oder viel Fett hast, weil vor allem Muskeln Energie verbrauchen.",
      tdee: "Wie viel Energie du an einem normalen Tag insgesamt verbrauchst: Grundumsatz mal Aktivitätsfaktor. Isst du weniger, nimmst du ab, isst du mehr, nimmst du zu. Deinen Aktivitätslevel stellst du unter „Meine Daten“ ein.",
      metabolic_age: "Vergleicht deinen Stoffwechsel mit dem Durchschnitt deines Alters. Liegt das Körperalter unter deinem echten Alter, ist dein Körper „jünger“ als der Durchschnitt.",
      heart_rate: "Der Puls, den die Waage beim Wiegen über die Füße misst. In Ruhe sind bei Erwachsenen 60–100 Schläge pro Minute normal, bei Trainierten oft weniger. Im Stehen und kurz nach Bewegung, Kaffee oder Stress ist er höher.",
      hr_max: "Die rechnerisch höchste Herzfrequenz für dein Alter (208 − 0,7 × Alter). Sie dient als Obergrenze für die Trainingszonen. Die echte Grenze kann einige Schläge darüber oder darunter liegen.",
      hr_reserve: "Der Abstand zwischen maximaler Herzfrequenz und Ruhepuls. Je größer die Reserve, desto mehr kann dein Herz bei Belastung zulegen. Grundlage der Pulszonen.",
      zones: "Pulsbereiche fürs Training, berechnet aus Ruhepuls und Herzfrequenzreserve. Gesundheit (50–60 %): locker, zum Einstieg und zur Erholung. Fettverbrennung (60–70 %): ruhige Ausdauer, du kannst dich noch unterhalten. Aerob (70–80 %): verbessert die Ausdauer. Anaerob (80–90 %): hart, nur kurze Intervalle.",
      vo2max: "Wie viel Sauerstoff dein Körper bei voller Belastung pro Minute und Kilogramm aufnehmen kann, geschätzt aus maximalem und Ruhepuls. Je höher, desto fitter. Mit Puls im Liegen fällt der Wert genauer und meist höher aus.",
      ponderal_index: "Ähnlich wie der BMI, teilt das Gewicht aber durch die Größe hoch drei. Dadurch passt er besser für sehr große oder sehr kleine Menschen. Normal sind etwa 11–14 kg/m³.",
      bsa: "Die Oberfläche deiner Haut in Quadratmetern. Ärztinnen und Ärzte nutzen sie zum Beispiel, um manche Medikamente zu dosieren.",
      broca_weight: "Ein einfacher Richtwert fürs Gewicht: Größe in cm minus 100, bei Männern mal 0,9 und bei Frauen mal 0,85. Muskeln und Körperbau berücksichtigt er nicht.",
      impedance_index: "Größe zum Quadrat geteilt durch den Widerstand, den die Waage misst. Die Grundlage, aus der Fett, Wasser und Muskeln berechnet werden. Höher heißt meist mehr fettfreie Masse.",
      body_type: "Ordnet dich nach BMI (senkrecht) und Körperfettanteil (waagerecht) ein. Ein hoher BMI mit wenig Fett bedeutet viele Muskeln (athletisch, muskulös). Ein normaler BMI mit viel Fett heißt „unsichtbar fettleibig“: von außen schlank, aber wenig Muskeln und viel Fett. Ein gutes Ziel ist meist „Fit“ oder „Muskulös“. Der Punkt zeigt, wo du genau liegst.",
      suggestions: "Das Standardgewicht ist ein Richtwert aus Größe und Geschlecht. Die Gewichtskontrolle zeigt den Abstand dazu. Die Fettkontrolle zeigt, wie viel Fett über der Obergrenze des Normalbereichs liegt (oder wie viel Luft noch ist). Die Muskelkontrolle zeigt, wie viel Muskelmasse bis zum Normalbereich fehlt.",
      ai: "Eine KI bewertet deine Werte und gibt dir Empfehlungen. Welche Werte sie sieht, legst du unter „Meine Daten“ fest. Die Hinweise können Fehler enthalten und ersetzen keine ärztliche Beratung.",
    },
    aiFieldsLabel: "Diese Werte darf die KI sehen",
    aiFieldGroups: { profile: "Profil", weight: "Gewicht", body: "Körperwerte", fitness: "Aktivität und Fitness" },
    aiFieldNames: {
      sex: "Geschlecht", age: "Alter", height: "Größe", goal: "Zielgewicht",
      weight: "Gewicht", trend: "Trend", change_7d: "Veränderung 7 Tage", change_30d: "Veränderung 30 Tage", change_total: "Veränderung gesamt", rate: "Tempo pro Woche", weekly: "Wochenverlauf", bmi: "BMI",
      body_fat: "Körperfett", muscle_mass: "Muskelmasse", water: "Körperwasser", bone_mass: "Knochenmasse", bmr: "Grundumsatz", protein: "Eiweiß", visceral_fat: "Viszeralfett",
      metabolic_age: "Körperalter", skeletal_muscle: "Skelettmuskelmasse", body_score: "Körperbewertung", body_type: "Körpertyp", heart_rate: "Herzfrequenz", whtr: "Taille-zu-Größe",
      activity: "Aktivitätslevel", tdee: "Gesamtumsatz", vo2max: "VO₂max",
    },
    aiFieldsNone: "Keine Werte ausgewählt – die KI kann nichts auswerten.",
    sinceLast: "seit der letzten Messung",
    bodyReport: "Körperbewertung",
    points: "Punkte",
    composition: "Körperzusammensetzung",
    waterMass: "Masse des Körperwassers",
    fatMass: "Fettmasse",
    boneMineral: "Knochenmineral",
    proteinMass: "Eiweißmasse",
    musclePct: "Muskelanteil",
    waterPct: "Körperwasser",
    proteinPct: "Eiweißanteil",
    bonePct: "Anteil Knochenmineral",
    skeletalMuscle: "Skelettmuskelmasse",
    visceral: "Viszeralfett",
    bodyAge: "Körperalter",
    leanMass: "Fettfreie Masse",
    heartRate: "Herzfrequenz",
    yearsUnit: "Jahre",
    status: { low: "Niedrig", standard: "Normal", good: "Gut", high: "Hoch", very_high: "Sehr hoch", very_low: "Sehr niedrig", excellent: "Sehr gut", guide: "Richtwert", below: "Unter Durchschnitt", average: "Durchschnitt", above: "Über Durchschnitt" },
    pace: { stable: "Stabil", toward: "Richtung Ziel", healthy: "Gesundes Tempo", fast: "Sehr schnell", away: "Weg vom Ziel", change: "Verändert sich" },
    vsYou: (kg) => `Du: ${kg}`,
    bodyType: "Körpertyp",
    bodyTypes: {
      athletic: "Athletisch", overweight: "Übergewichtig", obese: "Fettleibig", muscular: "Muskulös", fit: "Fit",
      lean_muscular: "Schlank und muskulös", lean: "Schlank", skinny_fat: "Unsichtbar fettleibig", thin: "Mager", underweight: "Untergewichtig",
    },
    axisFat: "Körperfettanteil",
    suggestions: "Vorschläge zum Gewicht",
    idealWeight: "Standardgewicht",
    weightControl: "Gewichtskontrolle",
    fatControl: "Fettkontrolle",
    muscleControl: "Muskelkontrolle",
    sugg: { lose: "abnehmen", gain: "zunehmen", onTarget: "im Standard", reduceFat: "Fett abbauen", fatRoom: "Spielraum", build: "aufbauen", keep: "Halten", inRange: "im Normalbereich" },
    advice: {
      fat: "Dein Körperfett liegt über dem Standard. Etwas weniger Kalorien, mehr Eiweiß und regelmäßige Bewegung helfen, es langsam zu senken.",
      visceral: "Das Viszeralfett ist erhöht. Ausdauer- und Krafttraining sowie weniger Zucker und Alkohol senken es am wirksamsten.",
      muscle: "Deine Muskelmasse ist niedrig. Zwei- bis dreimal Krafttraining pro Woche und genug Eiweiß bauen sie auf.",
      water: "Dein Körperwasser ist niedrig. Trink über den Tag verteilt genug Wasser.",
      thin: "Dein Gewicht liegt unter dem Normalbereich. Achte auf ausreichend Energie und Eiweiß.",
      good: "Deine Werte liegen im Normalbereich. Weiter so!",
    },
    analysisNote: "Geschätzte Werte – keine medizinische Diagnose.",
    aiTitle: "KI-Hinweise",
    aiRefresh: "Neu auswerten",
    aiBusy: "Wird ausgewertet …",
    aiNone: "Noch keine Auswertung – sie startet nach der nächsten Messung oder mit „Neu auswerten“.",
    aiError: (e) => `Auswertung fehlgeschlagen: ${e}`,
    aiAt: (when) => `Stand: ${when}`,
    aiDisclaimer: "Von einer KI erstellt – kann Fehler enthalten und ersetzt keine ärztliche Beratung.",
    aiOffHint: "KI-Hinweise sind aus. Einschalten unter „Meine Daten“.",
    aiSwitch: "Meine Werte von der KI auswerten lassen",
    aiExplain: (entity) => `Nach jeder Messung (höchstens einmal pro Stunde) und auf Knopfdruck gehen die unten ausgewählten Werte an „${entity}“ – ohne Namen. Bei einer Cloud-KI verlassen diese Gesundheitsdaten dein Zuhause.`,
    aiEntity: "KI für Hinweise (AI Task)",
    aiEntityHint: "Optional. Eine AI-Task-Entität (ab Home Assistant 2025.7, z. B. OpenAI, Anthropic, Google oder Ollama). Jede Person entscheidet unter „Meine Daten“ selbst, ob ihre Werte ausgewertet werden.",
    aiSection: "KI-Hinweise",
    aiSectionHint: "Eine KI wertet die Messwerte aus und schreibt kurze Empfehlungen in die Übersicht.",
    impedanceHighEntity: "Impedanz-Sensor (zweite Frequenz)",
    impedanceHighHint: "Nur bei Waagen mit zwei Frequenzen (Xiaomi S400: „Impedance High“). Für die Formeln zählt der größere der beiden Werte.",
    heartRateEntity: "Herzfrequenz-Sensor",
    heartRateHint: "Falls deine Waage den Puls misst (z. B. Xiaomi S400).",
    stableEntity: "Stabilisiert-Sensor",
    stableHint: "Empfohlen, wenn deine Waage ihn hat (z. B. Xiaomi „Stabilized“): Jedes Umschalten auf „an“ zählt als Messung – auch wenn das Gewicht gleich geblieben ist. Wird beim Wählen des Gewichtssensors vorgeschlagen.",
    bodyFatEntity: "Körperfett-Sensor",
    bodyFatEntityHint: "Falls die Integration deiner Waage schon Körperfett in % liefert.",
    myDataHint: "Deine Angaben. Sehen können sie nur du und Admins.",
    healthy: "Gesunder Bereich",
    healthyRange: (h, lo, hi) => `Bei ${h} cm liegt das Normalgewicht (BMI 18,5–24,9) bei etwa ${lo} – ${hi}.`,
    healthyNeedsHeight: "Trage deine Größe ein, dann siehst du hier deinen BMI und dein Normalgewicht.",
    bmiYouth: "Für Kinder und Jugendliche gelten altersabhängige Werte – die Einstufung entfällt.",
    youAt: "Du",
    yourGoal: "Dein Ziel",
    noGoal: "Lege unten ein Zielgewicht fest, dann siehst du hier deinen Fortschritt.",
    startedAt: "Start",
    editData: "Angaben ändern",
    editTile: (label) => `${label} bearbeiten`,
    notifications: "Benachrichtigungen",
    notificationsHint: "Hier entscheidest du, welche Nachrichten du bekommst.",
    notifyTarget: (device) => `Nachrichten gehen an: ${device}`,
    clothes: "Kleidung",
    clothesOn: "Kleidung berücksichtigen",
    clothesOnHint: "Markiere Messungen „mit Kleidung“ – das Kleidungsgewicht wird abgezogen und mit jeder Markierung genauer. Ist ein Gerät eingerichtet, fragt die App nach jedem Wiegen mit zwei Knöpfen nach.",
    clothesStart: "Startwert Kleidungsgewicht",
    clothesStartHint: "Wird verwendet, bis genug markierte Messungen da sind (typisch 0,5–1,5 kg).",
    clothesOff: "aus",
    clothesLearned: (n) => n ? `gelernt aus ${n} ${n === 1 ? "Messung" : "Messungen"}` : "Startwert – lernt mit jeder Markierung",
    withClothes: "Mit Kleidung",
    markClothes: "Als „mit Kleidung“ markieren",
    unmarkClothes: "Markierung „mit Kleidung“ entfernen",
    measuredWithClothes: (kg) => `gemessen ${kg} mit Kleidung`,
    notifyNoDevice: "Für dich ist noch kein Gerät eingerichtet – ein Admin kann das unter Einstellungen → Personen festlegen.",
    notifyDeviceAdminHint: "Wohin die Nachrichten dieser Person gehen. Welche Nachrichten sie bekommt, entscheidet sie selbst unter „Meine Daten“.",
    sensorSettings: "Werte als HA-Sensoren",
    sensorSettingsHint: "Wähle pro Person, Haustier und Kind, welche Werte als Sensor in Home Assistant angelegt werden – z. B. für Automationen oder eigene Dashboards.",
    sensorAll: "Alle",
    sensorNone: "Keine",
    sensorNeeds: (fields) => `braucht ${fields}`,
    sensorNeedFields: { height: "Größe", birth_month: "Geburtsmonat", sex: "Geschlecht", goal: "Zielgewicht" },
    sensorLabels: {
      weight: "Gewicht", trend: "Trend", change_last: "Veränderung letzte Messung", change_7d: "Veränderung 7 Tage",
      change_30d: "Veränderung 30 Tage", change_total: "Veränderung gesamt", rate: "Tempo pro Woche", bmi: "BMI",
      goal_distance: "Abstand zum Ziel", goal_eta: "Ziel voraussichtlich", last_measured: "Letzte Messung",
      body_fat: "Körperfett", muscle_mass: "Muskelmasse", body_water: "Körperwasser", bone_mass: "Knochenmasse", bmr: "Grundumsatz",
      body_score: "Körperbewertung", visceral_fat: "Viszeralfett", protein: "Protein", metabolic_age: "Körperalter", skeletal_muscle: "Skelettmuskelmasse", heart_rate: "Herzfrequenz",
      fat_mass: "Fettmasse", lean_mass: "Fettfreie Masse", water_mass: "Körperwasser (l)", ponderal_index: "Ponderal-Index", bsa: "Körperoberfläche", broca_weight: "Idealgewicht (Broca)",
      bmr_mifflin: "Grundumsatz (Mifflin)", bmr_katch: "Grundumsatz (Katch)", tdee: "Gesamtumsatz", hr_max: "Max. Herzfrequenz", hr_reserve: "Herzfrequenzreserve", vo2max: "VO₂max",
      impedance_index: "Impedanz-Index", zone_health: "Pulszone Gesundheit", zone_fat_burn: "Pulszone Fettverbrennung", zone_aerobic: "Pulszone aerob", zone_anaerobic: "Pulszone anaerob",
    },
    notifyDevice: "Gerät",
    notifyDeviceHint: "Die Home-Assistant-App auf deinem Handy (notify-Dienst).",
    notifyNone: "— keine Benachrichtigungen —",
    notifyWeigh: "Nach dem Wiegen: Gewicht und Veränderung",
    reminderDays: "Erinnern nach … Tagen ohne Messung",
    reminderHint: "0 = keine Erinnerung. Erinnert wird um 18 Uhr.",
    days: "Tage",
    sendTest: "Testnachricht senden",
    testSent: "Testnachricht gesendet",
    unknownService: "Dieser Benachrichtigungsdienst existiert nicht.",
    cm: "cm",
    bmiZones: ["Untergewicht", "Normal", "Übergewicht", "Adipositas"],
    day: "Tag",
    month2: "Monat",
    year: "Jahr",
    invalidDate: (label) => `„${label}“ ist kein gültiges Datum.`,
    sensorsFound: (n) => `📈 ${n} Sensoren in HA`,
    sensorsMissing: "⚠️ Sensoren aktiviert, aber in HA nicht gefunden",
    birthDateHint: "Optional, für das Alter. Monat und Jahr reichen.",
    years: (n) => `${n} Jahre`,
    showDetails: (label) => `${label}: Verlauf anzeigen`,
    invalidNumber: (label) => `„${label}“ ist keine gültige Zahl.`,
    start: "Start",
    errors: {
      name_exists: "Es gibt bereits eine Person mit diesem Namen.",
      invalid_name: "Ungültiger Name.",
      invalid_range: "Das minimale Gewicht muss kleiner als das maximale sein.",
      unknown_service: "Dieser Benachrichtigungsdienst existiert nicht.",
    },
  },
  en: {
    title: "Weight",
    noScale: "No scale set up yet. Add the “Weight Tracker” integration under Settings → Devices & services.",
    loading: "Loading …",
    pendingTitle: (n) => (n === 1 ? "1 measurement needs assignment" : `${n} measurements need assignment`),
    pendingHint: "Who was on the scale?",
    discard: "Discard",
    trend: "Trend",
    d7: "7 days",
    d30: "30 days",
    perWeek: "per week",
    total: "total",
    bmi: "BMI",
    goal: "Goal",
    goalLeft: (kg) => `${kg} to go`,
    goalReached: "Goal reached 🎉",
    goalEta: (d) => `expected ${d}`,
    goalNoEta: "Forecast needs more measurements",
    noData: "No measurement yet",
    measured: "measured",
    history: "History",
    absolute: "Weight",
    relative: "Change",
    chartEmpty: "No measurements in the selected range.",
    forecast: "Forecast",
    calendar: "Calendar",
    calendarHint: "Each square is a day. Blue: trend towards the goal, red: away from it, grey: hardly any change, empty: not weighed.",
    calendarStats: (days, best) => `${days} days with a measurement in 12 months · longest streak ${best} days`,
    calendarLegend: { good: "towards goal", bad: "away from goal", flat: "hardly any change", none: "not weighed" },
    weekdaysShort: ["Mon", "", "Wed", "", "Fri", "", ""],
    importExport: "Import & export",
    importExportHint: "Export your measurements as CSV (e.g. as a backup) or take over old data from other apps (Withings, Zepp/Mi Fit, Garmin, own spreadsheets).",
    exportCsv: "⬇ Export CSV",
    importCsv: "⬆ Import CSV",
    importPreview: (n, from, to, skipped) => `${n} measurements from ${from} to ${to}${skipped ? ` · ${skipped} rows skipped` : ""}`,
    importColumns: (cols) => `Detected columns: ${cols}`,
    importNothing: "No weights found in this file. It needs a date column and a weight column.",
    importTarget: "Import for",
    importButton: "Import",
    importDone: (added, skipped) => `${added} measurements imported${skipped ? `, ${skipped} duplicates skipped` : ""}`,
    today: "Today",
    measurement: "Measurement",
    monthly: "Monthly average",
    month: "Month",
    list: "Measurements",
    all: "All",
    date: "Date",
    person: "Person",
    weight: "Weight",
    detected: "Detected",
    more: "Show more",
    deleteConfirm: (w, d) => `Permanently delete measurement ${w} from ${d}?`,
    deleteLabel: "Delete",
    add: "Add measurement",
    addButton: "Add",
    open: "pending",
    discarded: "discarded",
    methods: {
      only_match: "automatic",
      closest: "automatic (closest)",
      presence: "automatic (at home)",
      manual: "manual",
      no_match: "unclear",
      ambiguous: "unclear",
    },
    bmiCat: (b) => (b < 18.5 ? "Underweight" : b < 25 ? "Normal" : b < 30 ? "Overweight" : "Obese"),
    error: "Error",
    notMine: "Not me (pending again)",
    pendingOption: "Pending",
    noAccess: "No data has been shared with you yet. An administrator can change this in the “Weight” panel under “Access”.",
    access: "Access",
    accessHint: "Who may see which data? Admins always see and edit everything. The linked person sees their own data and can assign, add and delete their own measurements.",
    user: "User",
    admin: "Admin",
    accNone: "no access",
    accAdmin: "sees everything",
    accView: "may view",
    accOwner: "is this person",
    sensors: "Sensors in HA",
    sensorsHint: "⚠️ Sensors are visible to all Home Assistant users – even if the person is not shared with them in the panel.",
    saved: "Saved",
    me: "Me",
    petWarning: {
      fast_loss: (p) => `Losing weight fast: ${p} % per week`,
      fast_gain: (p) => `Gaining weight fast: ${p} % per week`,
      loss_30d: (p) => `Lost ${p} % in 30 days`,
      gain_30d: (p) => `Gained ${p} % in 30 days`,
    },
    petWarningHint: "Unusually fast changes can be a warning sign – best talk to your vet.",
    notifyPetWarnings: "Pet warnings (unusually fast weight change)",
    petNotes: "Notes",
    petNotesHint: "Vet visits, vaccinations, food changes, medication …",
    eventCategories: { vet: "🩺 Vet", vaccination: "💉 Vaccination", food: "🍽️ Food", medication: "💊 Medication", other: "📝 Other" },
    addNote: "Add",
    notePlaceholderPet: "e.g. dental check, new dry food",
    children: "Children",
    childrenHint: "You weigh children and babies like pets: once alone, once holding the child. Instead of a goal the panel shows the percentile (WHO up to 2 years, then CDC).",
    addChild: "Add child",
    newChild: "New child",
    deleteChild: "Delete child",
    childBirthDate: "Date of birth",
    childSexHint: "For the percentiles (girls and boys have their own curves).",
    childStartWeight: "Current weight (approximately)",
    childAge: (months) => months < 1 ? `${Math.max(0, Math.round(months * 4.35))} weeks` : months < 24 ? `${Math.floor(months)} ${Math.floor(months) === 1 ? "month" : "months"}` : `${Math.floor(months / 12)} years`,
    percentile: (p) => `${p}th percentile`,
    percentileClass: { low: "below the 3rd percentile – please check with your paediatrician", high: "above the 97th percentile – please check with your paediatrician", normal: "in the normal range (3rd–97th percentile)" },
    growthMissing: "Sex or date of birth is missing for the percentiles.",
    growthLegend: "Bands: 3rd–97th and 15th–85th percentile, dashed: median",
    unit: "Unit",
    tabOverview: "Overview",
    tabMeasurements: "Measurements",
    tabSettings: "Settings",
    scale: "Scale",
    scaleHint: "Which sensor reports the weight, and how strict is the assignment?",
    name: "Name",
    source: "Weight sensor of the scale",
    minWeight: "Minimum weight",
    minWeightHint: "Lighter readings (bags, pets) are ignored.",
    maxWeight: "Maximum weight",
    tolerance: "Tolerance",
    toleranceHint: "How far a reading may differ from the previous weight. Grows by 0.15 kg per day without a measurement.",
    margin: "Ambiguity margin",
    marginHint: "If several persons match, the closest must be this much closer – otherwise you are asked.",
    debounce: "Wait until stable",
    debounceHint: "Many scales send intermediate values. The value that stays unchanged this long is stored.",
    save: "Save",
    cancel: "Cancel",
    persons: "Persons",
    personsHint: "Who is weighed? The start weight helps to recognize the first measurement.",
    addPerson: "Add person",
    newPerson: "New person",
    edit: "Edit",
    deletePerson: "Delete person",
    deletePersonConfirm: (name, n) => `Permanently delete “${name}” and ${n === 1 ? "1 measurement" : `all ${n} measurements`}?`,
    noPersonsAdmin: "No persons yet.",
    toSettings: "Add persons",
    startWeight: "Start weight",
    startWeightHint: "Approximate current weight.",
    height: "Height",
    heightHint: "Optional, for the BMI.",
    goalWeight: "Goal weight",
    goalWeightHint: "Optional, for progress and forecast.",
    presence: "Presence",
    presenceHint: "Optional: the matching person entity. If only one matching person is home, they get the measurement.",
    linkedUser: "Home Assistant user",
    linkedUserHint: "This user sees their data and can assign, add and delete their own measurements.",
    none: "— none —",
    noUser: "— no user —",
    viewers: "May also view",
    viewersHint: "Read only. Admins always see everything.",
    noOtherUsers: "No other users.",
    createSensors: "Create sensors in Home Assistant",
    count: (n) => (n === 1 ? "1 measurement" : `${n} measurements`),
    required: (label) => `Please fill in “${label}”.`,
    editProfile: "Edit details",
    myData: "My details",
    pets: "Pets",
    pet: "Pet",
    weighPet: (name) => `Weigh ${name}`,
    weighAnyPet: "Weigh pet",
    petSessionTitle: (name) => `Pet weighing${name ? ` for ${name}` : ""} in progress`,
    petSessionHint: (name) => `Step on the scale once alone and once holding ${name || "the pet"} – in any order.`,
    petSessionStep: (n) => `Reading ${n + 1} of 2`,
    petSessionLeft: (time) => `${time} left`,
    petSuggestion: "Was that a pet weighing?",
    petSuggestionText: (pet, kg, who) => `${pet}: ${kg} (${who} holding ${pet})`,
    petYes: (name) => `Yes, ${name}`,
    petNo: "No, that was me",
    petMeasurements: "Pet measurements",
    carriedBy: "weighed by",
    petNoData: "No measurement yet – tap “Weigh”.",
    species: "Species",
    speciesNames: { cat: "Cat", dog: "Dog", rabbit: "Rabbit", guinea_pig: "Guinea pig", other: "Other" },
    addPet: "Add pet",
    newPet: "New pet",
    deletePet: "Delete pet",
    petsHint: "You weigh a pet by holding it. All users see pets and may weigh them.",
    petStartWeight: "Approximate weight",
    petStartHint: "Helps to recognize pet weighings automatically.",
    petMethods: { pet_session: "button", pet_auto: "detected", manual: "manual" },
    profileHint: "You can change these details yourself.",
    birthDate: "Birth month",
    birthMonthHint: "Month and year are enough for the age.",
    age: "Age",
    ageMissing: "Add birth month",
    sex: "Sex",
    sexNames: { male: "Male", female: "Female" },
    sexNone: "— not specified —",
    sexHint: "For the body fat and waist classification.",
    waist: "Waist",
    waistNew: "New waist circumference",
    waistHint: "Measure at the navel, in the morning, after breathing out.",
    whtr: "Waist/height",
    whtrClass: { low: "low", healthy: "healthy", increased: "increased", high: "high" },
    whtrLine: (cm, ratio, cls) => `Waist ${cm} cm · waist/height ${ratio} – ${cls}`,
    body: "Body composition",
    bodyHint: "Estimated from your scale's impedance – guide values, not a medical measurement.",
    bodyScaleHint: "Measured by your scale.",
    bodyMissing: (fields) => `Your scale also measures body composition. Still missing: ${fields}.`,
    bodyFields: { sex: "sex", birth_month: "birth month", height: "height" },
    bodyFat: "Body fat",
    muscle: "Muscle mass",
    water: "Body water",
    bone: "Bone mass",
    bmr: "Basal metabolic rate",
    fatClass: { low: "low", healthy: "healthy", high: "increased", very_high: "high" },
    fatRange: (lo, hi) => `Healthy for you: ${lo}–${hi} %`,
    note: "Note",
    editNote: "Edit note",
    notePlaceholder: "e.g. after holiday, ill, new training",
    scaleSensors: "Scale sensors",
    scaleSensorsHint: "Which values your scale reports to Home Assistant. Only the weight is required – everything else only if your scale provides it.",
    muscleEntity: "Muscle mass sensor",
    waterEntity: "Body water sensor",
    boneEntity: "Bone mass sensor",
    bmrEntity: "Basal metabolic rate sensor",
    directHint: "If your scale reports this value directly – it then replaces the estimate from the impedance.",
    impedanceEntity: "Impedance sensor",
    impedanceHint: "Only if your scale reports impedance (e.g. Xiaomi Body Composition Scale). Body fat, muscles etc. are estimated from it. Xiaomi S400: “Impedance Low” here, “Impedance High” below.",
    ovPersons: "Choose person",
    infoAbout: (label) => `What does “${label}” mean?`,
    scaleSuggestTitle: "More sensors of your scale found",
    scaleSuggestText: (list) => `Not set up yet: ${list}.`,
    scaleSuggestApply: "Apply and save",
    pulseMissingAdmin: "No pulse: no heart rate sensor is set under Settings → Scale sensors yet.",
    pulseWaiting: "The pulse appears from the next measurement.",
    pulseMissing: "No pulse – the scale does not measure it or it is not set up yet.",
    tabHistory: "History",
    settingsTitle: "Settings",
    personalSettings: "Personal",
    adminSettings: "Administration",
    settingsFor: (name) => `for ${name}`,
    shareTitle: "Who may see me",
    shareHint: "Choose who may see your values in the panel. Admins see all data. People you share with can only look, not change anything.",
    shareNone: "There are no other users.",
    dataTitle: "Export and import data",
    pendingBar: (n) => n === 1 ? "1 measurement waits to be assigned" : `${n} measurements wait to be assigned`,
    petBar: (n) => n === 1 ? "1 pet weighing detected" : `${n} pet weighings detected`,
    showItems: "Show",
    hideItems: "Hide",
    addOpen: "Add",
    addTabMeasure: "Add measurement",
    addTabPet: "Weigh pet or child",
    addPetHint: "The next two weighings belong together: once alone, once holding the pet or child.",
    closeLabel: "Close",
    last30: "Last 30 days",
    noHistory: "No history yet – it needs measurements of persons.",
    chartMetric: "Value",
    chartMetrics: {
      weight: "Weight", bmi: "BMI", body_fat: "Body fat", fat_mass: "Fat mass", lean_mass: "Fat-free mass",
      muscle_mass: "Muscle mass", skeletal_muscle: "Skeletal muscle mass", water: "Body water", visceral_fat: "Visceral fat",
      protein: "Protein", bmr: "Basal metabolic rate", body_score: "Body score", metabolic_age: "Body age", heart_rate: "Pulse", waist: "Waist",
    },
    chartUnits: { body_score: "points", metabolic_age: "years" },
    chartNoMetric: (name) => `No values for “${name}” in this period yet.`,
    aiPrompt: "Instructions for the AI",
    aiPromptHint: "What the AI should do and how it answers. Each person's shared values are appended automatically. For the hints to show nicely: first line an assessment, then recommendations as lines starting with “- ”.",
    aiPromptReset: "Reset to default",
    cardNames: {
      main: "Weight", score: "Body score", ai: "AI hints", composition: "Body composition", bodytype: "Body type",
      suggestions: "Weight suggestions", fat: "Fat and water", muscle: "Muscle and bone", metabolism: "Metabolism",
      heart: "Heart and fitness", indices: "More figures",
    },
    showMore: "More",
    boardEdit: "Customise",
    boardDone: "Done",
    boardReset: "Reset",
    hiddenCards: "Hidden",
    noHiddenCards: "No card hidden.",
    cardSize: (z) => `Size ${z}`,
    moveEarlier: "Move earlier",
    moveLater: "Move later",
    hideCard: "Hide",
    valuesTitle: "Body values",
    valueGroupsExtra: { heart: "Heart and fitness", indices: "More figures" },
    bmrMifflin: "Basal metabolic rate (Mifflin-St Jeor)",
    bmrKatch: "Basal metabolic rate (Katch-McArdle)",
    tdeeLabel: "Total energy expenditure",
    hrMax: "Max. heart rate",
    hrReserve: "Heart rate reserve",
    vo2max: "VO₂max (estimated)",
    zonesLabel: "Heart rate zones",
    zoneNames: { health: "Health", fat_burn: "Fat burning", aerobic: "Aerobic", anaerobic: "Anaerobic" },
    ponderal: "Ponderal index",
    bsa: "Body surface area",
    broca: "Ideal weight (Broca)",
    impedanceIndex: "Impedance index",
    fatMassLabel: "Fat mass",
    waterLiters: "Water amount",
    activity: "Activity",
    activityLevels: { "1.2": "Sedentary", "1.375": "Lightly active", "1.55": "Moderately active", "1.725": "Very active", "1.9": "Extremely active" },
    activityHints: { "1.2": "office job, hardly any sport", "1.375": "sport 1–3× a week", "1.55": "sport 3–5× a week", "1.725": "sport 6–7× a week", "1.9": "physical work + sport" },
    activityHint: "For the total energy expenditure: how active your everyday life is.",
    bodyModel: "Formula for body composition",
    bodyModels: { standard: "Standard (like body composition scales)", sun: "Sun et al. 2003 (study formula)" },
    bodyModelHint: "Decides how body fat, water, muscle and bone are calculated from impedance. Standard is tuned for scales you stand on. Sun et al. is a published study formula from hand-to-foot measurements; with a scale you stand on it usually gives lower body fat.",
    valueGroups: { fat: "Fat and water", muscle: "Muscle and bone", metabolism: "Metabolism" },
    sinceStart: (kg) => `${kg} since start`,
    infoClose: "Close",
    infoYourRange: (lo, hi) => `Your standard range: ${lo}–${hi} %.`,
    segments: { muscle: "Muscle tissue", essential_fat: "Essential fat", storage_fat: "Storage fat", bone: "Bone", other: "Other" },
    info: {
      weight: "Your current weight. If the measurement is marked “with clothes”, the clothes are already deducted. Weight varies by 1–2 kg from day to day depending on what you ate and drank, so the trend shows better where you are heading.",
      trend: "Your smoothed weight. Every new measurement moves the trend only a little towards it, so you see the real development without the daily ups and downs.",
      changes: "How your trend weight changed over the last 7 and 30 days and since the first measurement. The rate is the average change per week. Healthy weight loss is usually 0.5–1 % of body weight per week.",
      bmi: "Body mass index: weight in kg divided by height in metres squared. For adults: below 18.5 underweight, 18.5–24.9 normal, 25–29.9 overweight, 30 and above obese. BMI does not tell muscle from fat, so very muscular people often have a high BMI without too much fat.",
      body_score: "An overall score from 10 to 100. It starts at 100 and drops when BMI, body fat, muscle, body water, visceral fat, bone, basal metabolic rate or protein are outside the normal range. Good for following your development over weeks.",
      body_fat: "How much of your weight is fat. The scale sends a weak current you cannot feel through your body. Muscles contain a lot of water and conduct it well, fat hardly does, so fat is estimated from the resistance. Normal at 18–39 years is about 11–22 % for men and 21–35 % for women, a bit more with age. The value depends on hydration, so measure at the same time of day if you can.",
      fat_mass: "How many kilograms of your weight are fat: weight times body fat percentage.",
      composition: "What your weight is made of. Muscle tissue is the muscle you move with. Essential fat is needed for life, about 3 % of body weight in men and 12 % in women. Storage fat is the remaining fat, your energy reserve. Bone means the minerals in your bones. Other covers organs, blood, skin and water outside the muscles.",
      water: "How much of your weight is water. Muscles are about three quarters water, fat hardly any. Normal is from about 55 % for men and 45 % for women. It changes noticeably with how much you drank or sweated.",
      water_mass: "The amount of water in your body in litres, about three quarters of your fat-free mass. Being well hydrated matters for circulation, concentration and muscles.",
      muscle: "Everything that is neither fat nor bone: muscles including the water in them, but also organs. That is why it is much higher than skeletal muscle mass. What is normal depends on height and sex.",
      skeletal_muscle: "Only the muscles you move with. Typically about 35–45 % of body weight in men and 30–40 % in women. Strength training and enough protein preserve them, especially when losing weight and with age.",
      protein: "Protein is the building material of muscles, organs and enzymes. About 16–20 % of body weight is normal. A low value points to little muscle or too little protein in your diet.",
      bone: "The estimated weight of the minerals in your bones, mainly calcium. It changes only very slowly and does not replace a bone density scan.",
      visceral_fat: "Visceral fat sits in the abdomen around the organs. It raises the risk of cardiovascular disease and diabetes more than fat under the skin. 1–9 is normal, 10–14 increased, 15 and above high. Exercise often lowers it faster than other fat.",
      lean_mass: "Everything except fat: muscles, bones, organs and water. When losing weight, mainly fat should go down while fat-free mass stays the same if possible.",
      whtr: "Waist circumference divided by height. Rule of thumb: your waist should be less than half your height, below 0.5; from 50 years up to 0.6 is normal. It shows belly fat better than BMI. Enter your waist under “My details” for it.",
      bmr: "The basal metabolic rate is the energy your body uses per day at complete rest: for breathing, heartbeat, organs and body heat. More muscle raises it.",
      bmr_mifflin: "Basal metabolic rate from weight, height, age and sex (Mifflin-St Jeor). The usual formula when body composition is unknown: the energy used per day at complete rest.",
      bmr_katch: "Basal metabolic rate from fat-free mass (Katch-McArdle). More accurate if you have a lot of muscle or fat, because mainly muscle uses energy.",
      tdee: "How much energy you use on a normal day in total: basal metabolic rate times activity factor. Eat less and you lose weight, eat more and you gain. Set your activity level under “My details”.",
      metabolic_age: "Compares your metabolism with the average for your age. A body age below your real age means your body is “younger” than average.",
      heart_rate: "The pulse the scale measures through your feet while weighing. At rest, 60–100 beats per minute is normal for adults, often less for trained people. It is higher standing and shortly after exercise, coffee or stress.",
      hr_max: "The calculated maximum heart rate for your age (208 − 0.7 × age). It is the upper limit for the training zones; your real limit can be a few beats higher or lower.",
      hr_reserve: "The gap between maximum heart rate and resting pulse. The larger it is, the more your heart can speed up under load. The basis of the heart rate zones.",
      zones: "Heart rate ranges for training, from resting pulse and heart rate reserve. Health (50–60 %): easy, for starting out and recovery. Fat burning (60–70 %): calm endurance, you can still talk. Aerobic (70–80 %): improves endurance. Anaerobic (80–90 %): hard, short intervals only.",
      vo2max: "How much oxygen your body can take up per minute and kilogram at full effort, estimated from maximum and resting pulse. Higher means fitter. With a pulse measured lying down it is more accurate and usually higher.",
      ponderal_index: "Like BMI, but divides weight by height cubed, so it suits very tall or very short people better. About 11–14 kg/m³ is normal.",
      bsa: "The area of your skin in square metres. Doctors use it, for example, to dose some medicines.",
      broca_weight: "A simple guide weight: height in cm minus 100, times 0.9 for men and 0.85 for women. It does not consider muscle or build.",
      impedance_index: "Height squared divided by the resistance the scale measures. The basis from which fat, water and muscle are calculated. Higher usually means more fat-free mass.",
      body_type: "Places you by BMI (vertical) and body fat (horizontal). A high BMI with little fat means a lot of muscle (athletic, muscular). A normal BMI with a lot of fat is called “skinny fat”: slim from the outside, but little muscle and much fat. A good goal is usually “Fit” or “Muscular”. The dot shows exactly where you are.",
      suggestions: "The standard weight is a guide value from height and sex. Weight control shows the distance to it. Fat control shows how much fat is above the upper limit of the normal range (or how much room is left). Muscle control shows how much muscle mass is missing to the normal range.",
      ai: "An AI assesses your values and gives you recommendations. You choose under “My details” which values it sees. The hints may contain mistakes and do not replace medical advice.",
    },
    aiFieldsLabel: "The AI may see these values",
    aiFieldGroups: { profile: "Profile", weight: "Weight", body: "Body values", fitness: "Activity and fitness" },
    aiFieldNames: {
      sex: "Sex", age: "Age", height: "Height", goal: "Goal weight",
      weight: "Weight", trend: "Trend", change_7d: "Change 7 days", change_30d: "Change 30 days", change_total: "Total change", rate: "Rate per week", weekly: "Weekly history", bmi: "BMI",
      body_fat: "Body fat", muscle_mass: "Muscle mass", water: "Body water", bone_mass: "Bone mass", bmr: "Basal metabolic rate", protein: "Protein", visceral_fat: "Visceral fat",
      metabolic_age: "Body age", skeletal_muscle: "Skeletal muscle mass", body_score: "Body score", body_type: "Body type", heart_rate: "Heart rate", whtr: "Waist-to-height",
      activity: "Activity level", tdee: "Total energy expenditure", vo2max: "VO₂max",
    },
    aiFieldsNone: "No values selected – the AI has nothing to analyse.",
    sinceLast: "since last measurement",
    bodyReport: "Body score",
    points: "points",
    composition: "Body composition",
    waterMass: "Body water mass",
    fatMass: "Fat mass",
    boneMineral: "Bone mineral",
    proteinMass: "Protein mass",
    musclePct: "Muscle rate",
    waterPct: "Body water",
    proteinPct: "Protein rate",
    bonePct: "Bone mineral rate",
    skeletalMuscle: "Skeletal muscle mass",
    visceral: "Visceral fat",
    bodyAge: "Body age",
    leanMass: "Fat-free mass",
    heartRate: "Heart rate",
    yearsUnit: "years",
    status: { low: "Low", standard: "Normal", good: "Good", high: "High", very_high: "Very high", very_low: "Very low", excellent: "Excellent", guide: "Guide value", below: "Below average", average: "Average", above: "Above average" },
    pace: { stable: "Stable", toward: "Towards goal", healthy: "Healthy pace", fast: "Very fast", away: "Away from goal", change: "Changing" },
    vsYou: (kg) => `You: ${kg}`,
    bodyType: "Body type",
    bodyTypes: {
      athletic: "Athletic", overweight: "Overweight", obese: "Obese", muscular: "Muscular", fit: "Fit",
      lean_muscular: "Lean and muscular", lean: "Lean", skinny_fat: "Skinny fat", thin: "Thin", underweight: "Underweight",
    },
    axisFat: "Body fat",
    suggestions: "Weight suggestions",
    idealWeight: "Standard weight",
    weightControl: "Weight control",
    fatControl: "Fat control",
    muscleControl: "Muscle control",
    sugg: { lose: "to lose", gain: "to gain", onTarget: "on target", reduceFat: "fat to lose", fatRoom: "room left", build: "to build", keep: "Keep", inRange: "in range" },
    advice: {
      fat: "Your body fat is above standard. Slightly fewer calories, more protein and regular exercise help to lower it slowly.",
      visceral: "Visceral fat is increased. Endurance and strength training plus less sugar and alcohol lower it most effectively.",
      muscle: "Your muscle mass is low. Strength training two to three times a week and enough protein build it up.",
      water: "Your body water is low. Drink enough water throughout the day.",
      thin: "Your weight is below the normal range. Make sure you get enough energy and protein.",
      good: "Your values are in the normal range. Keep it up!",
    },
    analysisNote: "Estimated values – not a medical diagnosis.",
    aiTitle: "AI hints",
    aiRefresh: "Analyse again",
    aiBusy: "Analysing …",
    aiNone: "No analysis yet – it starts after the next measurement or with “Analyse again”.",
    aiError: (e) => `Analysis failed: ${e}`,
    aiAt: (when) => `As of ${when}`,
    aiDisclaimer: "Written by an AI – may contain mistakes and does not replace medical advice.",
    aiOffHint: "AI hints are off. Switch them on under “My details”.",
    aiSwitch: "Let the AI analyse my values",
    aiExplain: (entity) => `After every measurement (at most once an hour) and on request the values selected below go to “${entity}” – without your name. With a cloud AI this health data leaves your home.`,
    aiEntity: "AI for hints (AI Task)",
    aiEntityHint: "Optional. An AI Task entity (Home Assistant 2025.7+, e.g. OpenAI, Anthropic, Google or Ollama). Every person decides under “My details” whether their values are analysed.",
    aiSection: "AI hints",
    aiSectionHint: "An AI analyses the measurements and writes short recommendations into the overview.",
    impedanceHighEntity: "Impedance sensor (second frequency)",
    impedanceHighHint: "Only for dual-frequency scales (Xiaomi S400: “Impedance High”). The formulas use the larger of the two values.",
    heartRateEntity: "Heart rate sensor",
    heartRateHint: "If your scale measures the pulse (e.g. Xiaomi S400).",
    stableEntity: "Stabilized sensor",
    stableHint: "Recommended if your scale has one (e.g. Xiaomi “Stabilized”): every switch to “on” counts as a measurement – even if the weight stayed the same. Suggested when you pick the weight sensor.",
    bodyFatEntity: "Body fat sensor",
    bodyFatEntityHint: "If your scale's integration already reports body fat in %.",
    myDataHint: "Your details. Only you and admins can see them.",
    healthy: "Healthy range",
    healthyRange: (h, lo, hi) => `At ${h} cm a normal weight (BMI 18.5–24.9) is about ${lo} – ${hi}.`,
    healthyNeedsHeight: "Add your height to see your BMI and your normal weight range.",
    bmiYouth: "Children and teenagers use age-specific values – no classification shown.",
    youAt: "You",
    yourGoal: "Your goal",
    noGoal: "Set a goal weight below to see your progress here.",
    startedAt: "Start",
    editData: "Edit details",
    editTile: (label) => `Edit ${label}`,
    notifications: "Notifications",
    notificationsHint: "Here you decide which messages you get.",
    notifyTarget: (device) => `Messages go to: ${device}`,
    clothes: "Clothes",
    clothesOn: "Account for clothes",
    clothesOnHint: "Mark measurements “with clothes” – the clothes weight is deducted and gets more precise with every mark. With a device set up, the app asks after every weighing with two buttons.",
    clothesStart: "Start value clothes weight",
    clothesStartHint: "Used until there are enough marked measurements (typically 0.5–1.5 kg).",
    clothesOff: "off",
    clothesLearned: (n) => n ? `learned from ${n} ${n === 1 ? "measurement" : "measurements"}` : "start value – learns with every mark",
    withClothes: "With clothes",
    markClothes: "Mark “with clothes”",
    unmarkClothes: "Remove “with clothes”",
    measuredWithClothes: (kg) => `measured ${kg} with clothes`,
    notifyNoDevice: "No device is set up for you yet – an admin can choose one under Settings → Persons.",
    notifyDeviceAdminHint: "Where this person's messages go. Which messages they get, they decide themselves under “My details”.",
    sensorSettings: "Values as HA sensors",
    sensorSettingsHint: "Choose per person, pet and child which values become sensors in Home Assistant – e.g. for automations or your own dashboards.",
    sensorAll: "All",
    sensorNone: "None",
    sensorNeeds: (fields) => `needs ${fields}`,
    sensorNeedFields: { height: "height", birth_month: "birth month", sex: "sex", goal: "goal weight" },
    sensorLabels: {
      weight: "Weight", trend: "Trend", change_last: "Change since last", change_7d: "Change 7 days",
      change_30d: "Change 30 days", change_total: "Total change", rate: "Rate per week", bmi: "BMI",
      goal_distance: "Distance to goal", goal_eta: "Goal expected", last_measured: "Last measurement",
      body_fat: "Body fat", muscle_mass: "Muscle mass", body_water: "Body water", bone_mass: "Bone mass", bmr: "Basal metabolic rate",
      body_score: "Body score", visceral_fat: "Visceral fat", protein: "Protein", metabolic_age: "Body age", skeletal_muscle: "Skeletal muscle mass", heart_rate: "Heart rate",
      fat_mass: "Fat mass", lean_mass: "Fat-free mass", water_mass: "Body water (l)", ponderal_index: "Ponderal index", bsa: "Body surface area", broca_weight: "Ideal weight (Broca)",
      bmr_mifflin: "BMR (Mifflin)", bmr_katch: "BMR (Katch)", tdee: "Total energy expenditure", hr_max: "Max. heart rate", hr_reserve: "Heart rate reserve", vo2max: "VO₂max",
      impedance_index: "Impedance index", zone_health: "Zone health", zone_fat_burn: "Zone fat burning", zone_aerobic: "Zone aerobic", zone_anaerobic: "Zone anaerobic",
    },
    notifyDevice: "Device",
    notifyDeviceHint: "The Home Assistant app on your phone (notify service).",
    notifyNone: "— no notifications —",
    notifyWeigh: "After weighing: weight and change",
    reminderDays: "Remind me after … days without a measurement",
    reminderHint: "0 = no reminder. Reminders are sent at 6 pm.",
    days: "days",
    sendTest: "Send test message",
    testSent: "Test message sent",
    unknownService: "This notify service does not exist.",
    cm: "cm",
    bmiZones: ["Underweight", "Normal", "Overweight", "Obese"],
    day: "Day",
    month2: "Month",
    year: "Year",
    invalidDate: (label) => `“${label}” is not a valid date.`,
    sensorsFound: (n) => `📈 ${n} sensors in HA`,
    sensorsMissing: "⚠️ Sensors enabled but not found in HA",
    birthDateHint: "Optional, for the age. Month and year are enough.",
    years: (n) => `${n} years`,
    showDetails: (label) => `${label}: show history`,
    invalidNumber: (label) => `“${label}” is not a valid number.`,
    start: "Start",
    errors: {
      name_exists: "A person with this name already exists.",
      invalid_name: "Invalid name.",
      invalid_range: "The minimum weight must be lower than the maximum weight.",
      unknown_service: "This notify service does not exist.",
    },
  },
};

// ----------------------------------------------------------------- CSV import
// Reads weight exports of other apps (Withings, Zepp/Mi Fit, Garmin, own tables).
// Returns { rows: [{ ts, weight, body_fat? }], skipped, columns }.
function parseWeightCsv(text, lang = "en") {
  const clean = String(text || "").replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  if (!clean) return { rows: [], skipped: 0, columns: {} };
  const firstLine = clean.split("\n")[0];
  const delimiter = [";", "\t", ","].map((d) => [d, firstLine.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  // Minimal CSV reader with quotes.
  const records = [];
  let field = "", record = [], quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) { record.push(field); field = ""; }
    else if (c === "\n") { record.push(field); records.push(record); record = []; field = ""; }
    else field += c;
  }
  record.push(field); records.push(record);

  const header = records[0].map((h) => h.trim().toLowerCase());
  const find = (test) => header.findIndex(test);
  const dateIdx = find((h) => /^(date|datum|day|tag)\b|date ?time|timestamp|^time$|^zeit$|zeitpunkt/.test(h));
  const timeIdx = find((h, i) => i !== dateIdx && /^(time|zeit|uhrzeit)\b/.test(h));
  const weightIdx = find((h) => /(weight|gewicht)/.test(h) && !/(fat|fett|muscle|muskel|bone|knochen|water|wasser|lean|goal|ziel)/.test(h));
  const fatIdx = find((h) => /(fat|fett)/.test(h) && !/(visceral|viszeral)/.test(h));
  if (dateIdx < 0 || weightIdx < 0) return { rows: [], skipped: records.length - 1, columns: { header: records[0] } };
  const weightFactor = /\blbs?\b|pound|pfund/.test(header[weightIdx]) ? 0.45359237 : /\(g\)|\bgram/.test(header[weightIdx]) ? 0.001 : 1;
  const fatIsKg = fatIdx >= 0 && /(mass|masse|\(kg\)|\bkg\b)/.test(header[fatIdx]) && !/(%|rate|percent|prozent|anteil)/.test(header[fatIdx]);

  const number = (raw) => {
    let v = String(raw || "").trim().replace(/\s|kg|lbs?|%/gi, "");
    if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(v)) v = v.replace(/\./g, "").replace(",", ".");
    else v = v.replace(",", ".");
    return v === "" ? NaN : Number(v);
  };
  const date = (raw, timeRaw) => {
    let v = String(raw || "").trim();
    if (timeRaw) v = `${v} ${String(timeRaw).trim()}`;
    if (/^\d{10}(\d{3})?$/.test(v)) return Number(v.length === 10 ? v + "000" : v);
    let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/.exec(v);
    if (m) {
      const [, y, mo, d, h = "0", mi = "0", s = "0", tz] = m;
      if (tz) {
        const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T${h.padStart(2, "0")}:${mi}:${s.padStart(2, "0")}${tz === "Z" ? "Z" : tz.replace(/^([+-]\d{2})(\d{2})$/, "$1:$2")}`;
        return Date.parse(iso);
      }
      return new Date(+y, +mo - 1, +d, +h, +mi, +s).getTime();
    }
    m = /^(\d{1,2})([./])(\d{1,2})\2(\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(v);
    if (m) {
      let [, a, sep, b, y, h = "0", mi = "0", s = "0"] = m;
      if (y.length === 2) y = `20${y}`;
      // dd.mm.yyyy; with "/" it is dd/mm unless the language is English (mm/dd) – a value > 12 decides.
      let day = +a, month = +b;
      if (sep === "/" && (+a > 12 ? false : +b > 12 ? true : !lang.startsWith("de"))) { day = +b; month = +a; }
      return new Date(+y, month - 1, day, +h, +mi, +s).getTime();
    }
    const parsed = Date.parse(v);
    return Number.isNaN(parsed) ? NaN : parsed;
  };

  const rows = [];
  let skipped = 0;
  for (const rec of records.slice(1)) {
    if (rec.every((f) => !String(f).trim())) continue;
    const ts = date(rec[dateIdx], timeIdx >= 0 ? rec[timeIdx] : null);
    const weight = number(rec[weightIdx]) * weightFactor;
    if (!Number.isFinite(ts) || !Number.isFinite(weight) || weight < 0.1 || weight > 500 || ts > Date.now() + 86400000) { skipped++; continue; }
    const row = { ts, weight: Math.round(weight * 100) / 100 };
    if (fatIdx >= 0) {
      let fat = number(rec[fatIdx]);
      if (fatIsKg && Number.isFinite(fat)) fat = (fat / weight) * 100;
      if (Number.isFinite(fat) && fat >= 1 && fat <= 75) row.body_fat = Math.round(fat * 10) / 10;
    }
    rows.push(row);
  }
  rows.sort((a, b) => a.ts - b.ts);
  return {
    rows,
    skipped,
    columns: { date: records[0][dateIdx], time: timeIdx >= 0 ? records[0][timeIdx] : null, weight: records[0][weightIdx], fat: fatIdx >= 0 ? records[0][fatIdx] : null },
  };
}

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const STYLE = `
  :host {
    display: block;
    height: 100%;
    background: var(--primary-background-color, #fafafa);
    color: var(--primary-text-color, #212121);
    font-family: var(--ha-font-family-body, Roboto, system-ui, sans-serif);
    --wt-card: var(--ha-card-background, var(--card-background-color, #fff));
    --wt-radius: var(--ha-card-border-radius, 12px);
    --wt-border: var(--ha-card-border-color, var(--divider-color, #e0e0e0));
    --wt-muted: var(--secondary-text-color, #727272);
    /* ratings of body values */
    --wt-st-low: var(--info-color, #039be5);
    --wt-st-standard: var(--success-color, #2e9d5b);
    --wt-st-good: var(--success-color, #2e9d5b);
    --wt-st-high: var(--warning-color, #e58a00);
    --wt-st-very_high: var(--error-color, #db4437);
    --wt-grid: var(--divider-color, #e0e0e0);
  }
  * { box-sizing: border-box; }
  .layout { display: flex; flex-direction: column; height: 100%; }
  .toolbar {
    display: flex; align-items: center; gap: 4px;
    height: var(--header-height, 56px); flex: none;
    padding: 0 12px;
    background: var(--app-header-background-color, var(--primary-color));
    color: var(--app-header-text-color, #fff);
    border-bottom: var(--app-header-border-bottom, none);
  }
  .toolbar .title { font-size: 20px; font-weight: 400; margin-left: 4px; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .toolbar select { background: transparent; color: inherit; border: 1px solid currentColor; border-radius: 8px; padding: 4px 8px; font: inherit; }
  .toolbar select option { color: #000; }
  .tabs {
    display: flex; flex: none; overflow-x: auto; padding: 0 8px;
    background: var(--app-header-background-color, var(--primary-color));
    color: var(--app-header-text-color, #fff);
  }
  .tab {
    background: none; border: none; color: inherit; opacity: 0.72; font: inherit; font-size: 14px;
    padding: 0 16px; min-height: 44px; border-bottom: 2px solid transparent; white-space: nowrap;
  }
  .tab:hover { opacity: 1; }
  .tab[aria-selected="true"] { opacity: 1; font-weight: 500; border-bottom-color: currentColor; }
  /* phones: the four tabs share the width instead of scrolling */
  @media (max-width: 520px) { .tabs { padding: 0 4px; } .tab { flex: 1 1 auto; padding: 0 6px; font-size: 13px; } }
  .scroller { flex: 1; overflow-y: auto; }
  .fields { display: grid; grid-template-columns: repeat(auto-fill, minmax(max(220px, calc((100% - 32px) / 3)), 1fr)); gap: 16px; margin-top: 12px; align-items: start; }
  .flabel { font-size: 12px; color: var(--wt-muted); margin: 0 0 4px 2px; min-height: 16px; }
  .fields .wide { grid-column: 1 / -1; }
  .hint { font-size: 12px; color: var(--wt-muted); line-height: 1.35; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
  .actions .spacer { flex: 1; }
  .btn.danger { color: var(--error-color, #db4437); border-color: var(--error-color, #db4437); }
  .checks { display: flex; flex-wrap: wrap; gap: 6px 18px; }
  .form label.check, label.check { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; color: var(--primary-text-color); }
  .check input { width: 18px; height: 18px; min-height: 0; margin: 0; }
  .person-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid var(--wt-grid); }
  .person-row:first-of-type { border-top: none; }
  .person-row .info { flex: 1; min-width: 0; }
  .person-row .info b { font-weight: 500; }
  .editor { border: 1px solid var(--wt-border); border-radius: 12px; padding: 16px; margin: 8px 0; }
  .editor h3 { font-size: 15px; font-weight: 500; margin: 0; display: flex; align-items: center; gap: 8px; }
  .field { min-width: 0; }
  .bd-label { font-size: 12px; color: var(--wt-muted); margin-bottom: 4px; }
  .bd-row { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1.2fr) auto; gap: 8px; align-items: start; max-width: 640px; }
  /* Same top as the fields: below their 16px label + 4px gap, as high as a field. */
  .bd-age { min-width: 72px; height: 56px; box-sizing: border-box; margin-top: 20px; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 4px 8px; border-radius: 10px; background: rgba(127,127,127,.1); }
  .bd-age b { display: block; font-size: 24px; line-height: 1.1; }
  .bd-age span { font-size: 11px; color: var(--wt-muted); }
  .section-title { font-size: 15px; font-weight: 500; margin: 8px 0 -4px; color: var(--wt-muted); display: flex; align-items: center; gap: 8px; }
  .session { border-left: 4px solid var(--primary-color, #03a9f4); display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
  .session .what { flex: 1 1 260px; }
  .session .count { font-variant-numeric: tabular-nums; font-weight: 500; }
  .mini { display: block; margin-top: 12px; touch-action: pan-y; }
  .spark { width: 100%; min-height: 20px; }
  .mini-wrap { position: relative; }
  .mini text { fill: var(--wt-muted); font-size: 10px; font-family: inherit; }
  .pet-actions { display: flex; justify-content: flex-end; margin-top: 12px; }
  .profile-hero { display: flex; align-items: center; gap: 16px; }
  .avatar { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-size: 24px; font-weight: 500; flex: none; }
  .avatar.img { background: none; overflow: hidden; }
  .avatar.img img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }
  .tile { position: relative; }
  .tile.editing { grid-column: 1 / -1; }
  .tile .pen {
    position: absolute; top: 6px; right: 6px; width: 32px; height: 32px; border-radius: 50%;
    border: none; background: transparent; color: var(--wt-muted); font-size: 16px; cursor: pointer;
  }
  .tile .pen:hover { background: rgba(127,127,127,.15); color: var(--primary-color, #03a9f4); }
  .tile .pen:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); }
  .tile .actions { margin-top: 12px; }
  .warn-box { margin-top: 12px; padding: 10px 12px; border-radius: 10px; border-left: 4px solid var(--warning-color, #ffa600); background: rgba(255,166,0,.1); font-size: 13px; }
  .warn-box b { display: block; margin-bottom: 2px; }
  .events { margin-top: 12px; border-top: 1px solid var(--wt-grid); padding-top: 8px; font-size: 13px; }
  .events .ev { display: flex; gap: 8px; align-items: baseline; padding: 4px 0; }
  .events .ev .when { color: var(--wt-muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .events .ev .what { flex: 1; }
  .events .add { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .events .add select, .events .add input { font: inherit; font-size: 13px; padding: 4px 8px; min-height: 34px; border-radius: 8px; border: 1px solid var(--wt-border); background: var(--wt-card); color: var(--primary-text-color); }
  .events .add input[type=text] { flex: 1 1 160px; }
  .growth { display: block; margin-top: 12px; }
  .growth text { fill: var(--wt-muted); font-size: 10px; font-family: inherit; }
  .unit-select { background: transparent; color: inherit; border: 1px solid currentColor; border-radius: 8px; padding: 2px 6px; font: inherit; font-size: 13px; margin-left: 8px; }
  .unit-select option { color: #000; }
  .cal { display: block; width: 100%; height: auto; margin-top: 12px; }
  .cal text { fill: var(--wt-muted); font-size: 9px; font-family: inherit; }
  .legend-row { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12px; color: var(--wt-muted); margin-top: 8px; }
  .legend-row span { display: inline-flex; align-items: center; gap: 5px; }
  .legend-row i { width: 11px; height: 11px; border-radius: 2px; display: inline-block; }
  .file-btn input { display: none; }
  .icon-btn.on { background: rgba(127,127,127,.18); }
  .icon-btn:not(.on)[data-action="clothes-toggle"] { opacity: 0.45; }
  .note { font-size: 12px; color: var(--wt-muted); font-style: italic; white-space: normal; max-width: 260px; }
  .note-edit { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .note-edit input { flex: 1 1 220px; font: inherit; font-size: 14px; padding: 6px 10px; min-height: 36px; border-radius: 8px; border: 1px solid var(--wt-border); background: var(--wt-card); color: var(--primary-text-color); }
  .waist-list { margin-top: 10px; font-size: 13px; }
  .waist-list div { display: flex; justify-content: space-between; align-items: center; gap: 8px; border-top: 1px solid var(--wt-grid); padding: 4px 0; }
  .body-line { font-size: 13px; color: var(--wt-muted); margin-top: 10px; }
  .avatar.pet { background: rgba(127,127,127,.14) !important; font-size: 28px; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
  .tile { background: var(--wt-card); border: 1px solid var(--wt-border); border-radius: var(--wt-radius); padding: 14px 16px; min-width: 0; }
  .tile .label { font-size: 12px; color: var(--wt-muted); }
  .tile .big { font-size: 30px; font-weight: 500; line-height: 1.2; margin-top: 2px; }
  .tile .big small { font-size: 15px; font-weight: 400; color: var(--wt-muted); }
  .tile .sub { font-size: 12px; color: var(--wt-muted); margin-top: 2px; }
  .two { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
  .scale { position: relative; margin: 26px 0 6px; }
  .scale .zones { display: flex; height: 12px; border-radius: 6px; overflow: hidden; gap: 2px; }
  .scale .zones div { height: 100%; }
  .scale .marker { position: absolute; top: -24px; transform: translateX(-50%); text-align: center; font-size: 12px; font-weight: 500; white-space: nowrap; }
  .scale .marker::after { content: ""; display: block; width: 2px; height: 22px; margin: 2px auto 0; background: var(--primary-text-color); border-radius: 1px; }
  .scale .labels { display: flex; font-size: 11px; color: var(--wt-muted); margin-top: 4px; gap: 2px; }
  .scale .labels div { text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bd-row label { display: grid; gap: 4px; font-size: 12px; color: var(--wt-muted); min-width: 0; }
  .link {
    background: none; border: none; padding: 0 2px; margin: 0 -2px; font: inherit; color: inherit;
    cursor: pointer; border-radius: 4px; text-align: inherit;
  }
  .link:hover { background: rgba(127, 127, 127, 0.14); }
  .link:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 1px; }
  .field ha-selector { display: block; width: 100%; }
  .field.wide { grid-column: 1 / -1; }
  .form-error { color: var(--error-color, #db4437); font-size: 13px; margin-top: 8px; }
  .content { max-width: 1200px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
  .section { background: var(--wt-card); border: 1px solid var(--wt-border); border-radius: var(--wt-radius); box-shadow: var(--ha-card-box-shadow, none); min-width: 0; }
  .section > summary { list-style: none; display: flex; align-items: center; gap: 16px; padding: 18px 20px; cursor: pointer; border-radius: var(--wt-radius); font-size: 16px; font-weight: 500; user-select: none; }
  .section > summary::-webkit-details-marker { display: none; }
  .section > summary:hover { background: rgba(127,127,127,.06); }
  .section > summary:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: -2px; }
  .section[open] > summary { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
  .sec-icon { flex: none; width: 24px; display: grid; place-items: center; color: var(--wt-muted); --mdc-icon-size: 24px; font-size: 20px; line-height: 1; }
  .sec-title { flex: 1; min-width: 0; }
  .sec-count { font-size: 13px; font-weight: 400; color: var(--wt-muted); }
  .sec-chevron { flex: none; width: 9px; height: 9px; margin: 0 4px 4px 0; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(45deg); transition: transform .2s; }
  .section[open] > summary .sec-chevron { transform: translateY(4px) rotate(-135deg); }
  .sec-body { padding: 0 20px 20px; }
  @media (prefers-reduced-motion: reduce) { .sec-chevron { transition: none; } }
  .switcher { display: flex; gap: 8px; flex-wrap: wrap; }
  .sw { display: inline-flex; align-items: center; gap: 8px; padding: 4px 14px 4px 4px; min-height: 36px; border-radius: 999px; border: 1px solid var(--wt-border); background: var(--wt-card); color: var(--primary-text-color); font: inherit; font-size: 14px; cursor: pointer; }
  .sw[aria-selected="true"] { border-color: var(--primary-color, #03a9f4); background: color-mix(in srgb, var(--primary-color, #03a9f4) 14%, var(--wt-card)); font-weight: 500; }
  .sw:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; }
  /* dense: later cards fill gaps left next to shorter rows */
  /* at most two columns (content is max 1200px wide), so cards stand in pairs */
  .report { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); grid-auto-flow: row dense; gap: 16px; }
  .report-hero .stats { grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); }
  .sub-h { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--wt-grid); }
  .report .span { grid-column: 1 / -1; }
  .report-hero { background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 24%, var(--wt-card)) 0%, var(--wt-card) 75%); }
  .rh-head { display: flex; align-items: center; gap: 12px; }
  .rh-name { font-size: 16px; font-weight: 500; }
  .rh-weight { text-align: center; margin-top: 8px; line-height: 1; white-space: nowrap; }
  .rh-weight .int { font-size: 64px; font-weight: 500; letter-spacing: -1px; }
  .rh-weight .dec { font-size: 32px; font-weight: 500; }
  .rh-weight .u { font-size: 16px; color: var(--wt-muted); margin-left: 4px; vertical-align: top; }
  .rh-class { text-align: center; margin-top: 6px; min-height: 18px; font-size: 13px; }
  .st { font-size: 12px; font-weight: 500; color: var(--wt-muted); }
  .st-low { color: var(--wt-st-low); }
  .st-standard { color: var(--wt-st-standard); }
  .st-good { color: var(--wt-st-good); }
  .st-high { color: var(--wt-st-high); }
  .st-very_high { color: var(--wt-st-very_high); }
  .score-row { display: flex; gap: 16px; align-items: flex-start; margin-top: 12px; }
  .score { white-space: nowrap; }
  .score b { font-size: 44px; font-weight: 500; line-height: 1; }
  .score > span { font-size: 13px; color: var(--wt-muted); margin-left: 4px; }
  .score-text { flex: 1; font-size: 13px; line-height: 1.45; color: var(--wt-muted); }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--wt-grid); }
  .pair > div + div { border-left: 1px solid var(--wt-grid); padding-left: 16px; }
  .pv { font-size: 24px; font-weight: 500; }
  .pv small, .cv small, .mtile .mv small, .sg .sv small { font-size: 13px; font-weight: 400; color: var(--wt-muted); }
  .pl, .cl, .mtile .ml, .sg .sl { font-size: 12px; color: var(--wt-muted); }
  .comp { display: grid; grid-template-columns: minmax(80px, 130px) 1fr; gap: 20px; align-items: center; margin-top: 12px; }
  .figure { width: 100%; height: auto; max-height: 230px; }
  .comp-values { display: grid; gap: 12px; }
  .cv b { font-size: 22px; font-weight: 500; }
  .mtiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
  .mtile { background: var(--wt-card); border: 1px solid var(--wt-border); border-radius: var(--wt-radius); padding: 14px 16px; min-width: 0; }
  .mtile .mv { font-size: 24px; font-weight: 500; line-height: 1.2; }
  .mtile .ml { margin: 2px 0 4px; }
  .bt2 { display: grid; grid-template-columns: 40px 1fr; grid-template-rows: auto 22px auto; column-gap: 8px; margin-top: 14px; }
  .bt2-y, .bt2-x { position: relative; font-size: 12px; color: var(--wt-muted); }
  .bt2-y span { position: absolute; right: 0; transform: translateY(-50%); }
  .bt2-x { grid-column: 2; }
  .bt2-x span { position: absolute; top: 4px; transform: translateX(-50%); }
  .bt2-ycap { grid-row: 2 / 4; align-self: end; font-size: 12px; text-align: right; }
  .bt2-xcap { font-size: 12px; margin-top: 4px; }
  .bt2-grid { position: relative; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: repeat(4, minmax(52px, auto)); gap: 4px;
    grid-template-areas: "ath ath ow1 ob" "mus mus fit ow2" "lm ln fit sf" "th uw uw sf";
    border-left: 1px solid var(--wt-grid); border-bottom: 1px solid var(--wt-grid); padding: 0 0 4px 4px; }
  .bt2-cell { display: grid; place-items: center; padding: 6px 4px; border-radius: 6px; background: rgba(127,127,127,.12);
    color: var(--wt-muted); font-size: 12px; line-height: 1.25; text-align: center; hyphens: auto; overflow-wrap: anywhere; }
  /* the dot marks the exact spot, so the label of that field moves to the top */
  .bt2-cell.on { color: #fff; font-weight: 600; align-content: start; padding-top: 8px; }
  .bt2-dot { position: absolute; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%; background: #fff;
    box-shadow: 0 0 0 2px rgba(0,0,0,.55); pointer-events: none; }
  .mdi { width: 24px; height: 24px; fill: currentColor; flex: none; }
  /* weight suggestions: tiles with an icon tinted in the colour of their rating */
  .sugg { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; margin-top: 10px; }
  .sg { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .sg-ic { flex: none; width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center;
    background: color-mix(in srgb, var(--tone) 16%, transparent); color: var(--tone); }
  .sg-ic .mdi { width: 22px; height: 22px; }
  .sg-t { min-width: 0; }
  .sg .sl { line-height: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sg .sv { font-size: 18px; font-weight: 500; line-height: 22px; white-space: nowrap; }
  .sg .st { display: block; line-height: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ai-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .ai-head h2 { flex: 1; }
  .ai-summary { margin: 10px 0 8px; line-height: 1.45; }
  .ai-tips { margin: 0; padding-left: 20px; display: grid; gap: 6px; font-size: 14px; line-height: 1.4; }
  .report-note { font-size: 12px; color: var(--wt-muted); line-height: 1.4; }
  .report.single { grid-template-columns: 1fr; }
  .ov-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .ov-head .switcher { flex: 1 1 auto; }
  .ov-head .board-btn { margin-left: auto; }
  /* overview board: fixed card sizes like widgets. S = 1x1, M = 2x1, L = 2x2,
     XL = full width x 2; 4 columns on wide screens, 2 below. */
  .board-wrap { container-type: inline-size; }
  .board { --row: 184px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: var(--row); grid-auto-flow: row dense; gap: 16px; }
  @container (max-width: 940px) { .board { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  /* phones: less room per card, so a few parts get more compact */
  @container (max-width: 520px) {
    .hero-m .stats .stat:nth-child(n+3) { display: none; }
    .hero-m .stats { grid-template-columns: minmax(0, 1fr); }
    .hero-l .stat { display: flex; flex-wrap: wrap; align-items: center; column-gap: 6px; }
    .hero-l .stat .label { flex-basis: 100%; }
    .hero-l .stat .st { font-size: 0; }
    .hero-l .stat .st::before { margin-right: 0; width: 8px; height: 8px; }
    .hero-l .rh-mini > .ml { display: none; }
    .size-s .sg .sl { display: none; }  /* "17,8 kg · abnehmen" says it; the label would be cut off */
  }
  .bc { position: relative; min-width: 0; min-height: 0; }
  .bc.size-s { grid-column: span 1; grid-row: span 1; }
  .bc.size-m { grid-column: span 2; grid-row: span 1; }
  .bc.size-l { grid-column: span 2; grid-row: span 2; }
  .bc.size-xl { grid-column: 1 / -1; grid-row: span 2; }
  .bc > .card { position: relative; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; overflow: hidden; }
  .bc-body { position: relative; flex: 1; min-height: 0; overflow: hidden; }
  /* content that does not fit: fade out and offer "Mehr" */
  .bc.overflow .bc-body::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 44px; pointer-events: none;
    background: linear-gradient(to bottom, transparent, var(--wt-card)); }
  .bc-more { display: none; position: absolute; right: 10px; bottom: 8px; padding: 2px 10px; border: 0; border-radius: 999px; font: inherit; font-size: 12px;
    background: color-mix(in srgb, var(--primary-color, #03a9f4) 18%, var(--wt-card)); color: var(--primary-text-color); cursor: pointer; }
  .bc.overflow .bc-more { display: inline-block; }
  .board.editing .bc-more { display: none; }
  .board.editing .bc > .card { outline: 2px dashed color-mix(in srgb, var(--primary-color, #03a9f4) 50%, transparent); outline-offset: -2px; }
  /* edit controls lie on top of the card, so its size stays the same */
  .bc-edit { position: absolute; inset: 0; z-index: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 8px; padding: 10px;
    background: color-mix(in srgb, var(--wt-card) 82%, transparent); backdrop-filter: blur(2px); text-align: center; }
  .bc-name { font-weight: 500; font-size: 14px; }
  .bc-sizes, .bc-tools { display: inline-flex; gap: 4px; flex-wrap: wrap; justify-content: center; }
  .bc-btn { min-width: 34px; height: 32px; padding: 0 8px; border-radius: 8px; border: 1px solid var(--wt-border); background: var(--wt-card);
    color: var(--primary-text-color); font: inherit; font-size: 13px; cursor: pointer; }
  .bc-btn[aria-pressed="true"] { background: var(--primary-color, #03a9f4); border-color: var(--primary-color, #03a9f4); color: var(--text-primary-color, #fff); font-weight: 500; }
  .bc-btn:disabled { opacity: .4; cursor: default; }
  .bc-btn:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 1px; }
  /* compact value list (S, M) */
  .vlist { display: grid; gap: 8px 20px; margin-top: 10px; }
  .vlist.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .vrow .vtop { display: flex; align-items: baseline; gap: 8px; }
  .vrow .vl { flex: 1; min-width: 0; font-size: 13px; color: var(--wt-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vrow .vv { font-size: 17px; font-weight: 500; white-space: nowrap; }
  .vrow .vv small { font-size: 12px; font-weight: 400; color: var(--wt-muted); }
  .hero-m { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 20px; align-items: center; }
  .hero-m .stats { margin-top: 0; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 12px; }
  .comp2.compact { grid-template-columns: 70px 1fr; gap: 14px; margin-top: 6px; }
  .comp2.compact svg { max-height: 118px; }
  .comp2.compact .seg-list { gap: 2px; }
  .comp2.compact .seg .sv { font-size: 14px; }
  .comp2.compact .seg .sl { font-size: 12px; }
  .card-dialog { width: min(720px, calc(100vw - 32px)); }
  .card-dialog .card-full { margin-top: 4px; }
  /* the dialog already shows the card's name */
  .card-dialog .card-full > h2:first-child, .card-dialog .card-full .ai-head h2 { display: none; }
  .card-dialog .card-full .ai-head { justify-content: flex-end; }
  .board-hidden { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 14px; border: 1px dashed var(--wt-border); border-radius: var(--wt-radius); }
  /* while customising: Reset and Done float at the bottom right, like the + button */
  .board-fab { position: fixed; right: 24px; bottom: 24px; z-index: 5; display: flex; gap: 6px; padding: 6px; border-radius: 30px;
    background: var(--wt-card); border: 1px solid var(--wt-border); box-shadow: 0 4px 18px rgba(0,0,0,.28); }
  .bf-btn { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px 0 14px; border: 0; border-radius: 22px;
    background: transparent; color: var(--primary-text-color); font: inherit; font-size: 15px; font-weight: 500; cursor: pointer; }
  .bf-btn .mdi { width: 20px; height: 20px; }
  .bf-btn:hover { background: rgba(127,127,127,.14); }
  .bf-btn.primary { background: var(--primary-color, #03a9f4); color: var(--text-primary-color, #fff); }
  .bf-btn.primary:hover { filter: brightness(1.08); }
  .bf-btn:focus-visible { outline: 3px solid var(--primary-text-color); outline-offset: 2px; }
  .content:has(.board-fab) { padding-bottom: 96px; }
  @media (max-width: 600px) { .board-fab { right: 16px; bottom: 16px; } }
  .board-btn .mdi { width: 18px; height: 18px; }
  /* size-dependent content */
  .size-s .rh-weight .int { font-size: 44px; }
  .size-s .rh-weight .dec { font-size: 24px; }
  .size-s .score b { font-size: 36px; }
  .size-s .sugg { grid-template-columns: minmax(0, 1fr); }
  .sg-foot { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--wt-grid); font-size: 12px; color: var(--wt-muted); }
  .sg-foot b { font-weight: 500; color: var(--primary-text-color); white-space: nowrap; }
  .sg-foot small { color: var(--wt-muted); }
  .size-s .rh-class, .size-m .rh-class { text-align: left; }
  .size-s .rh-label, .size-s .rh-weight, .size-m .rh-label, .size-m .rh-weight { text-align: left; }
  .hero-xl { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); gap: 24px; align-items: center; }
  .bt2.compact { display: block; }
  .bt2.compact { margin-top: 8px; }
  .bt2.compact .bt2-grid { border: 0; padding: 0; gap: 3px; grid-template-rows: repeat(4, 23px); }
  .bt2.compact .bt2-cell { min-height: 0; padding: 0 4px; font-size: 11px; }
  .bt2.compact .bt2-cell.on { align-content: center; padding-top: 0; }
  .bt2.compact .bt2-dot { width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px; }
  .hero-l .rh-weight { margin-top: 2px; }
  .hero-l .rh-weight .int { font-size: 54px; }
  .hero-l .rh-weight .dec { font-size: 28px; }
  .hero-l .rh-mini { margin-top: 4px; }
  .hero-l .stats { margin-top: 8px; }
  .goal.compact { margin-top: 10px; padding-top: 8px; }
  .sw .avatar.pet { background: rgba(127,127,127,.15); }
  /* labels that open their explanation: dotted underline instead of an icon */
  .term { padding: 0; border: 0; background: none; font: inherit; color: inherit; cursor: help; text-align: inherit;
    text-decoration: underline dotted; text-decoration-color: color-mix(in srgb, currentColor 45%, transparent); text-underline-offset: 3px; }
  .term:hover { color: var(--primary-color, #03a9f4); }
  .term:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; border-radius: 2px; }
  .st::before { content: ""; display: inline-block; width: 7px; height: 7px; margin-right: 5px; border-radius: 50%; background: currentColor; vertical-align: 1px; }
  .st.st-standard, .st.st-good, .st.st-excellent { color: var(--wt-muted); font-weight: 400; }
  .st.st-standard::before, .st.st-good::before, .st.st-excellent::before { background: var(--wt-st-good); }
  /* neither good nor bad (guide values, above/below average): grey */
  .st.st-guide, .st.st-below, .st.st-average, .st.st-above { color: var(--wt-muted); font-weight: 400; }
  .st.st-guide::before, .st.st-below::before, .st.st-average::before, .st.st-above::before { background: var(--wt-muted); opacity: .6; }
  .rh-label { text-align: center; font-size: 12px; color: var(--wt-muted); margin-top: 10px; }
  .vgroup h3 { font-size: 13px; font-weight: 500; color: var(--wt-muted); margin: 16px 0 8px; }
  .vgroup:first-of-type h3 { margin-top: 12px; }
  .vgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  .vt { padding: 10px 12px; border-radius: 10px; background: rgba(127,127,127,.08); min-width: 0; }
  .vt .mv { font-size: 22px; font-weight: 500; line-height: 1.2; }
  .vt .mv small { font-size: 13px; font-weight: 400; color: var(--wt-muted); }
  .vt .ml { font-size: 12px; color: var(--wt-muted); margin: 2px 0 4px; }
  /* explanation popup: rounded, quiet, no frame */
  .info-dialog { width: min(440px, calc(100vw - 32px)); max-height: min(80vh, 640px); padding: 22px 24px 20px; border: 0; border-radius: 22px;
    background: var(--wt-card); color: var(--primary-text-color); box-shadow: 0 12px 40px rgba(0,0,0,.25); overflow: auto; }
  .info-dialog::backdrop { background: rgba(0,0,0,.35); backdrop-filter: blur(2px); }
  .info-dialog .ih { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
  .info-dialog h2 { flex: 1; margin: 0; font-size: 17px; font-weight: 500; line-height: 1.35; }
  .info-dialog p { margin: 0 0 10px; font-size: 14px; line-height: 1.55; color: var(--wt-muted); }
  .info-dialog p:last-child { margin-bottom: 0; }
  .info-dialog .ix { flex: none; width: 32px; height: 32px; margin: -6px -10px 0 0; border: 0; border-radius: 50%; background: transparent;
    color: var(--wt-muted); font-size: 20px; line-height: 1; cursor: pointer; }
  .info-dialog .ix:hover { background: rgba(127,127,127,.14); color: var(--primary-text-color); }
  .info-dialog .ix:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); }
  .zones { margin-top: 4px; }
  .zbar { display: flex; gap: 2px; height: 10px; border-radius: 5px; overflow: hidden; margin: 6px 0 10px; }
  .zbar span { display: block; height: 100%; }
  .toolbar-end { display: inline-flex; align-items: center; gap: 4px; }
  .gear { display: inline-grid; place-items: center; width: 40px; height: 40px; border: 0; border-radius: 50%; background: transparent;
    color: var(--app-header-text-color, #fff); font-size: 20px; cursor: pointer; --mdc-icon-size: 22px; }
  .gear:hover, .gear[aria-pressed="true"] { background: rgba(255,255,255,.14); }
  .gear:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; }
  .page-title { display: flex; align-items: center; gap: 10px; font-size: 20px; font-weight: 500; margin: 4px 0 -4px; }
  .pending-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 14px; border-radius: var(--wt-radius);
    background: color-mix(in srgb, var(--warning-color, #ffa600) 14%, var(--wt-card)); border: 1px solid color-mix(in srgb, var(--warning-color, #ffa600) 40%, transparent); }
  .pending-bar .what { flex: 1 1 200px; font-size: 14px; }
  .rh-mini { margin-top: 10px; }
  .rh-mini .ml { font-size: 12px; color: var(--wt-muted); margin-bottom: 2px; }
  .vtabs { display: flex; gap: 6px; flex-wrap: wrap; margin: 12px 0 4px; }
  .vtab { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--wt-border); background: transparent; color: var(--primary-text-color);
    font: inherit; font-size: 13px; cursor: pointer; }
  .vtab[aria-selected="true"] { background: color-mix(in srgb, var(--primary-color, #03a9f4) 16%, var(--wt-card)); border-color: var(--primary-color, #03a9f4); font-weight: 500; }
  .vtab:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; }
  .fab { position: fixed; right: 24px; bottom: 24px; z-index: 5; display: inline-flex; align-items: center; gap: 8px; height: 52px; padding: 0 20px 0 16px;
    border: 0; border-radius: 26px; background: var(--primary-color, #03a9f4); color: var(--text-primary-color, #fff); font: inherit; font-size: 15px; font-weight: 500;
    box-shadow: 0 4px 14px rgba(0,0,0,.3); cursor: pointer; }
  .fab b { font-size: 24px; font-weight: 400; line-height: 1; }
  .content:has(.fab) { padding-bottom: 96px; }  /* room so the button never hides the last card */
  .fab:focus-visible { outline: 3px solid var(--primary-text-color); outline-offset: 2px; }
  .sheet-bg { position: fixed; inset: 0; z-index: 6; background: rgba(0,0,0,.35); }
  .sheet { position: fixed; z-index: 7; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(560px, calc(100vw - 24px)); max-height: calc(100vh - 48px);
    overflow: auto; padding: 20px 22px; border-radius: 22px; background: var(--wt-card); box-shadow: 0 12px 40px rgba(0,0,0,.3); }
  .sheet .ih { display: flex; align-items: center; gap: 12px; }
  .sheet .ih h2 { flex: 1; font-size: 17px; }
  .sheet .ix { width: 32px; height: 32px; border: 0; border-radius: 50%; background: transparent; color: var(--wt-muted); font-size: 20px; cursor: pointer; }
  .sheet .ix:hover { background: rgba(127,127,127,.14); }
  .sheet .add-form h2 { display: none; }
  .pet-pick { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  @media (max-width: 600px) { .fab { right: 16px; bottom: 16px; } .fab span { display: none; } .fab { padding: 0 16px; } }
  .suggest-box { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 12px; padding: 12px 14px; border-radius: 12px;
    background: color-mix(in srgb, var(--primary-color, #03a9f4) 10%, var(--wt-card)); }
  .suggest-box > div { flex: 1 1 260px; }
  .zhead { font-size: 12px; color: var(--wt-muted); margin-top: 14px; }
  .zlist { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; font-size: 14px; }
  .zrow { display: grid; grid-template-columns: 10px 1fr auto; align-items: center; gap: 10px; }
  .zdot { width: 10px; height: 10px; border-radius: 3px; }
  .zname small { display: block; font-size: 12px; color: var(--wt-muted); }
  .zval { font-weight: 500; white-space: nowrap; }
  .zval small { font-size: 12px; font-weight: 400; color: var(--wt-muted); }
  .comp2 { display: grid; grid-template-columns: minmax(110px, 170px) 1fr; gap: 20px; align-items: center; margin-top: 12px; }
  .comp2 svg { width: 100%; height: auto; max-height: 300px; }
  .seg-list { display: grid; gap: 10px; }
  .seg { display: grid; grid-template-columns: 12px 1fr auto; gap: 4px 10px; align-items: baseline; }
  .seg .sw-dot { width: 12px; height: 12px; border-radius: 3px; align-self: center; }
  .seg .sv { font-size: 18px; font-weight: 500; text-align: right; white-space: nowrap; }
  .seg .sv small { font-size: 12px; font-weight: 400; color: var(--wt-muted); }
  .seg .sl { font-size: 13px; }
  .seg .skg { grid-column: 2 / -1; font-size: 12px; color: var(--wt-muted); margin-top: -4px; }
  .ai-fields { margin-top: 12px; }
  .ai-fields h3 { font-size: 13px; font-weight: 500; color: var(--wt-muted); margin: 12px 0 6px; }
  .card { background: var(--wt-card); border: 1px solid var(--wt-border); border-radius: var(--wt-radius); box-shadow: var(--ha-card-box-shadow, none); padding: 16px; min-width: 0; }
  h2 { font-size: 16px; font-weight: 500; margin: 0; }
  .muted { color: var(--wt-muted); }
  .small { font-size: 13px; }
  .num { font-variant-numeric: tabular-nums; }
  .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; flex: none; }
  .message { padding: 32px 16px; text-align: center; color: var(--wt-muted); }

  .pending { border-left: 4px solid var(--warning-color, #ffa600); }
  .pending h2 { display: flex; align-items: center; gap: 8px; }
  .pending-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 0; border-top: 1px solid var(--wt-grid); }
  .pending-row:first-of-type { border-top: none; }
  .pending-row .what { flex: 1 1 180px; }
  .pending-row .what b { font-size: 18px; }

  button { font: inherit; cursor: pointer; }
  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    border: 1px solid var(--wt-border); background: transparent; color: var(--primary-text-color);
    border-radius: 18px; padding: 6px 14px; min-height: 36px;
  }
  .btn:hover { background: rgba(127, 127, 127, 0.12); }
  .btn.primary { background: var(--primary-color, #03a9f4); border-color: var(--primary-color, #03a9f4); color: var(--text-primary-color, #fff); }
  .btn.quiet { color: var(--wt-muted); }

  .persons { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
  .person-head { display: flex; align-items: center; gap: 8px; }
  .person-head h2 { flex: 1; }
  .hero { display: flex; align-items: baseline; gap: 8px; margin: 12px 0 2px; }
  .hero .value { font-size: 40px; font-weight: 500; line-height: 1.1; }
  .hero .unit { font-size: 18px; color: var(--wt-muted); }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px 8px; margin-top: 16px; }
  .stat .label { font-size: 12px; color: var(--wt-muted); }
  .stat .val { font-size: 16px; font-weight: 500; }
  .goal { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--wt-grid); }
  .goal .row { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
  .bar { height: 8px; border-radius: 4px; background: var(--wt-grid); margin: 8px 0 6px; overflow: hidden; }
  .bar > div { height: 100%; border-radius: 4px; }

  .chart-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px; }
  .chart-head h2 { flex: 1 1 auto; }
  .chips { display: inline-flex; flex-wrap: wrap; gap: 4px; }
  .chip {
    border: 1px solid var(--wt-border); background: transparent; color: var(--primary-text-color);
    border-radius: 16px; padding: 4px 12px; min-height: 32px; font-size: 13px;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .chip[aria-pressed="true"] { background: var(--primary-color, #03a9f4); border-color: var(--primary-color, #03a9f4); color: var(--text-primary-color, #fff); }
  .chip.legend[aria-pressed="true"] { background: transparent; border-color: var(--wt-border); color: var(--primary-text-color); }
  .chip.off { opacity: 0.45; }
  .chip.off .dot { background: transparent !important; box-shadow: inset 0 0 0 2px var(--wt-muted); }
  .chart { position: relative; width: 100%; min-height: 300px; }
  .chart svg { display: block; width: 100%; overflow: visible; touch-action: pan-y; }
  .chart text { fill: var(--wt-muted); font-size: 11px; font-family: inherit; }
  .chart .label { fill: var(--primary-text-color); font-size: 12px; font-weight: 500; }
  .tooltip {
    position: absolute; pointer-events: none; z-index: 2;
    background: var(--wt-card); color: var(--primary-text-color);
    border: 1px solid var(--wt-border); border-radius: 8px; padding: 8px 10px;
    box-shadow: 0 4px 12px rgba(0,0,0,.18); font-size: 13px; white-space: nowrap;
    display: none;
  }
  .tooltip .t-head { display: flex; align-items: center; gap: 6px; font-weight: 500; }

  .split { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 16px; align-items: start; }
  @media (max-width: 900px) { .split { grid-template-columns: minmax(0, 1fr); } }
  .table-wrap { overflow-x: auto; margin-top: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { text-align: left; font-weight: 500; color: var(--wt-muted); font-size: 12px; padding: 6px 8px; border-bottom: 1px solid var(--wt-grid); white-space: nowrap; }
  td { padding: 6px 8px; border-bottom: 1px solid var(--wt-grid); white-space: nowrap; }
  td.r, th.r { text-align: right; }
  tr:last-child td { border-bottom: none; }
  .who { display: inline-flex; align-items: center; gap: 6px; }
  select.inline, .form select, .form input {
    font: inherit; font-size: 14px; color: var(--primary-text-color);
    background: var(--wt-card); border: 1px solid var(--wt-border); border-radius: 8px; padding: 4px 6px; min-height: 32px;
  }
  .icon-btn { border: none; background: transparent; color: var(--wt-muted); border-radius: 50%; width: 32px; height: 32px; font-size: 16px; }
  .icon-btn:hover { background: rgba(127,127,127,.15); color: var(--error-color, #db4437); }
  .tag { font-size: 12px; color: var(--wt-muted); }
  .tag.warn { color: var(--warning-color, #ffa600); font-weight: 500; }
  .form { display: grid; gap: 10px; margin-top: 12px; }
  .form label { display: grid; gap: 4px; font-size: 12px; color: var(--wt-muted); }
  .form input, .form select { min-height: 40px; padding: 6px 10px; width: 100%; min-width: 0; max-width: 100%; }
  .form label { align-content: start; min-width: 0; }
  .form .check input { width: 18px; min-height: 0; padding: 0; }
  .more { margin-top: 8px; }
  .side { display: flex; flex-direction: column; gap: 16px; }
  @media (max-width: 600px) {
    .content { padding: 12px; gap: 12px; }
    .hero .value { font-size: 34px; }
  }
`;

class WeightTrackerPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._data = null;
    this._entryId = null;
    this._range = 90;
    this._mode = "abs";
    try {
      this._openSections = new Set(JSON.parse(localStorage.getItem("wt-sections") || "[]"));
    } catch (err) {
      this._openSections = new Set();
    }
    try {
      this._unitPref = localStorage.getItem("wt-unit");
    } catch (err) {
      this._unitPref = null;
    }
    this._forecast = true;
    this._hidden = new Set();
    this._listPerson = "all";
    this._listLimit = 15;
    this._chartWidth = 0;
    this._chartPoints = [];
    this._tab = "overview";
    this._editPerson = null; // person id, "new" or null
    this._editPet = null; // pet id, "new" or null
    this._editTile = null; // { person, key } of the tile edited on "My details"
    this._editNote = null; // { kind, id } of the measurement note being edited
    this._models = {}; // form values, survive live updates while edited
    this._forms = {}; // field definitions of the forms on screen
    this._dirty = new Set();
    this._haReady = false;
    this._formErrors = {};
  }

  // ------------------------------------------------------------ HA plumbing

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) this._init();
    if (this._menuButton) this._menuButton.hass = hass;
    if (this.shadowRoot) for (const el of this.shadowRoot.querySelectorAll("ha-selector")) el.hass = hass;
    const dark = Boolean(hass.themes && hass.themes.darkMode);
    if (dark !== this._dark) {
      this._dark = dark;
      if (!first) this._render();
    }
  }

  set narrow(narrow) {
    this._narrow = narrow;
    if (this._menuButton) this._menuButton.narrow = narrow;
  }

  set panel(panel) {
    this._panel = panel;
  }

  connectedCallback() {
    if (this._hass && !this._unsub && !this._subscribing) this._subscribe();
  }

  disconnectedCallback() {
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer);
      this._countdownTimer = null;
    }
    if (this._unsub) {
      this._unsub();
      this._unsub = null;
    }
    if (this._resizeObserver) this._resizeObserver.disconnect();
  }

  get _t() {
    return (this._hass && this._hass.language || "en").startsWith("de") ? TEXT.de : TEXT.en;
  }

  get _lang() {
    return (this._hass && this._hass.locale && this._hass.locale.language) || (this._hass && this._hass.language) || "en";
  }

  _init() {
    this.shadowRoot.innerHTML = `
      <style>${STYLE}</style>
      <div class="layout">
        <div class="toolbar"><span id="menu"></span><div class="title"></div><span id="scale"></span><span id="unit"></span></div>
        <div class="tabs" id="tabs" role="tablist"></div>
        <div class="scroller"><div class="content" id="content"><div class="message">${esc(this._t.loading)}</div></div></div>
      </div>`;
    this.shadowRoot.querySelector(".title").textContent = this._t.title;
    if (customElements.get("ha-menu-button")) {
      this._menuButton = document.createElement("ha-menu-button");
      this._menuButton.hass = this._hass;
      this._menuButton.narrow = this._narrow;
      this.shadowRoot.getElementById("menu").appendChild(this._menuButton);
    }
    const root = this.shadowRoot;
    root.addEventListener("click", (ev) => this._onClick(ev));
    root.addEventListener("change", (ev) => this._onChange(ev));
    root.addEventListener("submit", (ev) => this._onSubmit(ev));
    root.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && this._addOpen) {
        this._addOpen = false;
        this._clearForm("add-form");
        this._render();
      }
    });
    // "toggle" does not bubble: listen in the capture phase.
    root.addEventListener("toggle", (ev) => this._onSectionToggle(ev), true);
    root.addEventListener("pointermove", (ev) => this._onPointer(ev));
    root.addEventListener("pointerleave", () => {
      this._hideHover();
      this._hideMiniHover();
    }, true);
    this._sparkObserver = new ResizeObserver(() => {
      this._drawSparks();
      this._layoutBoard();
    });
    this._sparkObserver.observe(root.getElementById("content"));
    this._resizeObserver = new ResizeObserver(() => {
      const el = root.getElementById("chart");
      if (el && Math.abs(el.clientWidth - this._chartWidth) > 2) this._renderChart();
    });
    if (this.isConnected) this._subscribe();
    this._loadHaComponents();
  }

  // Home Assistant loads its form components lazily. Loading a card editor
  // pulls in <ha-selector>; if that fails we fall back to plain HTML fields.
  async _loadHaComponents() {
    if (!customElements.get("ha-selector")) {
      try {
        if (window.loadCardHelpers) {
          const helpers = await window.loadCardHelpers();
          for (const config of [{ type: "tile", entity: "sun.sun" }, { type: "entities", entities: [] }]) {
            if (customElements.get("ha-selector")) break;
            const card = await helpers.createCardElement(config);
            if (card && card.constructor.getConfigElement) await card.constructor.getConfigElement();
          }
        }
      } catch (err) {
        // ignore, fallback below
      }
      await Promise.race([customElements.whenDefined("ha-selector"), new Promise((r) => setTimeout(r, 5000))]);
    }
    this._haReady = Boolean(customElements.get("ha-selector"));
    if (this._haReady && this._data) this._render();
  }

  async _subscribe() {
    this._subscribing = true;
    try {
      this._unsub = await this._hass.connection.subscribeMessage((data) => this._onData(data), {
        type: "weight_tracker/subscribe",
      });
    } catch (err) {
      this._content(`<div class="message">${esc(this._t.error)}: ${esc(err.message || err.code || err)}</div>`);
    } finally {
      this._subscribing = false;
    }
  }

  _onData(data) {
    clearTimeout(this._emptyTimer);
    // While a scale reloads (e.g. after changing access) it is briefly missing.
    if (!data.entries.length && this._data && this._data.entries.length) {
      this._emptyTimer = setTimeout(() => {
        this._data = data;
        this._render();
      }, 2500);
      return;
    }
    this._data = data;
    this._render();
  }

  get _isAdmin() {
    return Boolean(this._data && this._data.user && this._data.user.is_admin);
  }

  _content(html) {
    this.shadowRoot.getElementById("content").innerHTML = html;
  }

  _toast(message) {
    this.dispatchEvent(new CustomEvent("hass-notification", { detail: { message }, bubbles: true, composed: true }));
  }

  async _call(service, data) {
    try {
      await this._hass.callService("weight_tracker", service, { config_entry_id: this._entry.entry_id, ...data });
    } catch (err) {
      this._toast(`${this._t.error}: ${err.message || err}`);
    }
  }

  // ---------------------------------------------------------------- helpers

  get _entry() {
    const entries = (this._data && this._data.entries) || [];
    return entries.find((e) => e.entry_id === this._entryId) || entries[0];
  }

  _color(index) {
    const palette = this._dark ? COLORS.dark : COLORS.light;
    return palette[index % palette.length];
  }

  // Picture of the HA person (with a ring in the person's chart color), or the
  // initial on the person's color.
  _avatar(person, size = 36) {
    const color = this._color(person.color_index);
    const box = `width:${size}px;height:${size}px`;
    if (person.picture) {
      return `<span class="avatar img" style="${box};box-shadow:0 0 0 2px ${color}"><img src="${esc(person.picture)}" alt="" loading="lazy"></span>`;
    }
    return `<span class="avatar" style="${box};font-size:${Math.round(size * 0.45)}px;background:${color}" aria-hidden="true">${esc(person.name.slice(0, 1).toUpperCase())}</span>`;
  }

  _childMonths(child) {
    if (!child || !child.birth_date) return null;
    const born = new Date(`${child.birth_date}T00:00:00`);
    return (Date.now() - born.getTime()) / (30.4375 * DAY);
  }

  _emoji(subject) {
    if (subject && subject.kind === "child") {
      const months = this._childMonths(subject);
      return months !== null && months >= 24 ? "🧒" : "👶";
    }
    return this._speciesEmoji(subject && subject.species);
  }

  _speciesEmoji(species) {
    return { cat: "🐱", dog: "🐶", rabbit: "🐰", guinea_pig: "🐹" }[species] || "🐾";
  }

  _pet(petId) {
    return (this._entry.pets || []).find((p) => p.id === petId);
  }

  _personColor(personId) {
    const person = this._entry.persons.find((p) => p.id === personId);
    return person ? this._color(person.color_index) : "var(--wt-muted)";
  }

  // Display unit: kg, lb or st (per device; default from the HA unit system).
  get _unit() {
    if (this._unitPref) return this._unitPref;
    const mass = this._hass && this._hass.config && this._hass.config.unit_system && this._hass.config.unit_system.mass;
    return mass === "lb" ? "lb" : "kg";
  }

  get _factor() {
    return this._unit === "kg" ? 1 : 2.20462262;
  }

  get _unitLabel() {
    return this._unit === "kg" ? "kg" : "lb";
  }

  _num(value, { signed = false, digits = 1 } = {}) {
    if (value === null || value === undefined || Number.isNaN(value)) return "–";
    const fmt = new Intl.NumberFormat(this._lang, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    let text = fmt.format(Math.abs(value));
    if (signed) text = (value > 0.0499 ? "+" : value < -0.0499 ? "−" : "±") + text;
    else if (value < 0) text = "−" + text;
    return text;
  }

  // Formats a weight given in kg in the chosen display unit.
  _kg(value, { signed = false, unit = true, digits = 1 } = {}) {
    if (value === null || value === undefined || Number.isNaN(value)) return "–";
    const converted = value * this._factor;
    if (unit && !signed && this._unit === "st" && Math.abs(converted) >= 14) {
      const pounds = Math.abs(converted);
      const stones = Math.floor(pounds / 14);
      return `${value < 0 ? "−" : ""}${stones} st ${this._num(pounds - stones * 14, { digits: 0 })} lb`;
    }
    const text = this._num(converted, { signed, digits });
    return unit ? `${text} ${this._unitLabel}` : text;
  }

  // Big weight number + unit for the cards.
  _hero(value, digits = 1) {
    if (this._unit === "st" && value !== null && value !== undefined && value * this._factor >= 14) {
      const pounds = value * this._factor, stones = Math.floor(pounds / 14);
      return `<span class="value num">${stones}</span><span class="unit"> st </span><span class="value num">${this._num(pounds - stones * 14, { digits: 0 })}</span><span class="unit"> lb</span>`;
    }
    return `<span class="value num">${this._kg(value, { unit: false, digits })}</span><span class="unit"> ${this._unitLabel}</span>`;
  }

  _date(ts, opts = { day: "2-digit", month: "2-digit", year: "numeric" }) {
    return new Intl.DateTimeFormat(this._lang, opts).format(new Date(ts));
  }

  _dateTime(ts) {
    return this._date(ts, { weekday: "short", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  _relative(ts) {
    const rtf = new Intl.RelativeTimeFormat(this._lang, { numeric: "auto" });
    const diff = (ts - Date.now()) / 1000;
    const abs = Math.abs(diff);
    if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
    if (abs < 86400 * 45) return rtf.format(Math.round(diff / 86400), "day");
    return rtf.format(Math.round(diff / (86400 * 30.4)), "month");
  }

  // Weight without clothes (what statistics use); the raw reading stays in m.weight.
  _w(m) {
    return m.clothes_kg ? m.weight - m.clothes_kg : m.weight;
  }

  // Values a person has for the history chart (weight is always there).
  _metricAvailable(person, key) {
    if (key === "weight") return true;
    if (key === "bmi") return Boolean(person.height);
    if (key === "waist") return (person.waist || []).length > 0;
    return ((person.body && person.body.series && person.body.series[key]) || []).length > 0;
  }

  // The chosen value of the history chart (falls back to weight).
  _chartMetric() {
    if (this._metric === undefined) {
      try {
        this._metric = localStorage.getItem("wt-metric") || "weight";
      } catch (err) {
        this._metric = "weight";
      }
    }
    const persons = this._entry.persons;
    const available = CHART_METRICS.filter((d) => persons.some((p) => this._metricAvailable(p, d.key)));
    return available.find((d) => d.key === this._metric) || CHART_METRICS[0];
  }

  // Points {ts, weight: value, trend} of another value than weight; the trend is
  // smoothed like the weight (body values vary a lot from day to day).
  _metricPoints(person, key) {
    if (key === "bmi") {
      const h = (person.height || 0) / 100;
      if (!h) return [];
      return this._assigned(person.id).map((m) => ({
        ts: m.ts, weight: this._w(m) / (h * h), trend: m.trend !== null && m.trend !== undefined ? m.trend / (h * h) : null, note: m.note,
      }));
    }
    const raw = key === "waist"
      ? (person.waist || []).map((w) => [w.ts, w.cm])
      : ((person.body && person.body.series && person.body.series[key]) || []);
    let trend = null;
    return raw.map(([ts, value]) => {
      trend = trend === null ? value : trend + 0.25 * (value - trend);
      return { ts, weight: value, trend };
    });
  }

  // A value of the chosen metric as text (kg values follow the display unit).
  _metricText(metric, value, signed = false) {
    if (metric.kg) return this._kg(value, { signed });
    const unit = this._t.chartUnits[metric.key] || metric.unit;
    return `${this._num(value, { digits: metric.digits, signed })}${unit ? ` ${unit}` : ""}`;
  }

  _assigned(personId) {
    return this._entry.measurements.filter((m) => m.status === "assigned" && m.person_id === personId);
  }

  // ----------------------------------------------------------------- render

  _render() {
    if (!this._data) return;
    const t = this._t;
    const entries = this._data.entries;
    const unitSlot = this.shadowRoot.getElementById("unit");
    if (unitSlot) unitSlot.innerHTML = `<span class="toolbar-end"><select class="unit-select" data-action="unit" aria-label="${esc(t.unit)}">${["kg", "lb", "st"].map((u) => `<option value="${u}" ${u === this._unit ? "selected" : ""}>${u}</option>`).join("")}</select>
      ${entries.length ? `<button class="gear" data-action="tab" data-tab="settings" aria-label="${esc(t.settingsTitle)}" title="${esc(t.settingsTitle)}" aria-pressed="${this._tab === "settings"}">${customElements.get("ha-icon") ? '<ha-icon icon="mdi:cog"></ha-icon>' : "⚙"}</button>` : ""}</span>`;
    const scaleSlot = this.shadowRoot.getElementById("scale");
    scaleSlot.innerHTML = entries.length > 1
      ? `<select data-action="scale">${entries.map((e) => `<option value="${esc(e.entry_id)}" ${e === this._entry ? "selected" : ""}>${esc(e.title)}</option>`).join("")}</select>`
      : "";
    // Settings are behind the gear in the header, not a tab.
    const myPersons = entries.length ? this._entry.persons.filter((p) => p.is_me) : [];
    const tabs = [["overview", t.tabOverview]];
    if (entries.length && this._entry.persons.length) tabs.push(["history", t.tabHistory]);
    tabs.push(["measurements", t.tabMeasurements]);
    if (myPersons.length) tabs.push(["mydata", t.myData]);
    if (this._tab !== "settings" && !tabs.some(([key]) => key === this._tab)) this._tab = "overview";
    this.shadowRoot.getElementById("tabs").innerHTML = entries.length
      ? tabs.map(([key, label]) => `<button class="tab" role="tab" data-action="tab" data-tab="${key}" aria-selected="${this._tab === key}">${esc(label)}</button>`).join("")
      : "";
    if (!entries.length) {
      this._content(`<div class="message">${esc(t.noScale)}</div>`);
      return;
    }

    this._forms = {};
    const noteInput = this.shadowRoot.getElementById("note-input");
    if (noteInput && this._editNote) this._editNote.draft = noteInput.value;  // survive live updates
    const canAdd = this._entry.persons.some((p) => p.can_manage) || (this._entry.pets || []).length;
    // "+": add a measurement / weigh a pet from every page (not where the form is already).
    const fab = canAdd && this._tab !== "measurements" && this._tab !== "settings" && !this._boardEdit ? `
      <button class="fab" data-action="add-open" aria-haspopup="dialog"><b aria-hidden="true">+</b><span>${esc(t.addOpen)}</span></button>
      ${this._addOpen ? this._renderAddSheet() : ""}` : "";
    if (this._tab === "settings") {
      this._content(this._renderSettingsPage(myPersons));
    } else if (this._tab === "history") {
      this._content(this._renderHistory() + fab);
    } else if (this._tab === "mydata") {
      this._content(myPersons.map((p) => this._renderMyData(p)).join("") + fab);
    } else if (!this._entry.persons.length && !(this._entry.pets || []).length) {
      this._content(this._isAdmin
        ? `<div class="card message">${esc(t.noPersonsAdmin)}<div class="actions" style="justify-content:center"><button class="btn primary" data-action="tab" data-tab="settings">${esc(t.toSettings)}</button></div></div>`
        : `<div class="message">${esc(t.noAccess)}</div>`);
    } else if (this._tab === "measurements") {
      // The form comes first so it stays reachable however long the lists get.
      this._content(`
        ${this._renderPetSession()}
        ${this._renderPending()}
        ${canAdd ? `<div class="card">${this._renderAddForm()}</div>` : ""}
        ${this._entry.persons.length ? `<div class="card">${this._renderList()}</div>` : ""}
        ${this._renderPetList()}`);
    } else {
      // One person, child or pet at a time; the switcher lists all you may see.
      const current = this._overviewSubject();
      const person = current.kind === "person" ? current.subject : null;
      this._content(`
        ${this._renderPetSession()}
        ${this._renderPendingBar()}
        <div class="ov-head">${this._renderSwitcher(current)}
          ${person && !this._boardEdit ? `<button class="btn quiet board-btn" data-action="board-edit">${icon("pencil")}${esc(t.boardEdit)}</button>` : ""}</div>
        ${person ? this._renderReport(person) : `<div class="report single">${current.kind === "child" ? this._renderChildCard(current.subject) : this._renderPetCard(current.subject)}</div>`}
        ${fab}`);
    }
    this._syncCountdown();
    this._mountFields();
    this._drawSparks();
    this._layoutBoard();
    this._resizeObserver.disconnect();
    const chart = this.shadowRoot.getElementById("chart");
    if (chart) {
      this._resizeObserver.observe(chart);
      this._renderChart();
    }
  }

  // Open items on the overview: one slim bar, the list only when opened.
  _renderPendingBar() {
    const t = this._t;
    const pending = this._entry.measurements.filter((m) => m.status === "pending").length;
    const pets = this._entry.measurements.filter((m) => m.status === "pet_candidate").length;
    if (!pending && !pets) return "";
    const text = [pets ? t.petBar(pets) : "", pending ? t.pendingBar(pending) : ""].filter(Boolean).join(" · ");
    return `
      <div class="pending-bar" role="status">
        <span class="what">⚠️ ${esc(text)}</span>
        <button class="btn" data-action="pending-toggle" aria-expanded="${Boolean(this._pendingOpen)}">${esc(this._pendingOpen ? t.hideItems : t.showItems)}</button>
      </div>
      ${this._pendingOpen ? this._renderPending() : ""}`;
  }

  // History tab: the big chart, monthly values and the calendar.
  _renderHistory() {
    const t = this._t;
    if (!this._entry.persons.length) return `<div class="message">${esc(t.noHistory)}</div>`;
    const current = this._overviewSubject();
    const person = current && current.kind === "person" ? current.subject
      : this._entry.persons.find((p) => p.is_me) || this._entry.persons[0];
    return `
      <div class="card">
        ${this._renderChartHead()}
        <div class="chart" id="chart"></div>
      </div>
      ${this._renderMonthly()}
      ${person ? this._renderCalendar(person) : ""}`;
  }

  // Settings behind the gear: personal ones for everybody, administration for admins.
  _renderSettingsPage(myPersons) {
    const t = this._t;
    const own = this._entry.persons.filter((p) => p.can_manage && (p.is_me || !this._isAdmin));
    const many = own.length > 1;
    const suffix = (p) => (many ? ` – ${t.settingsFor(p.name)}` : "");
    const personal = [
      ...own.map((p) => this._section(`me-notify-${p.id}`, "mdi:bell-outline", "🔔", t.notifications + suffix(p), this._renderNotifySettings(p))),
      ...(this._entry.ai_available ? own.map((p) => this._section(`me-ai-${p.id}`, "mdi:robot-outline", "🤖", t.aiTitle + suffix(p), this._renderAiSettings(p))) : []),
      ...own.map((p) => this._section(`me-share-${p.id}`, "mdi:account-eye-outline", "👁", t.shareTitle + suffix(p), this._renderShareSettings(p))),
      this._section("me-data", "mdi:swap-vertical", "⇅", t.dataTitle, this._renderImportExport()),
    ].join("");
    return `
      <div class="page-title">${customElements.get("ha-icon") ? '<ha-icon icon="mdi:cog"></ha-icon>' : "⚙"} ${esc(t.settingsTitle)}</div>
      <div class="section-title">${esc(t.personalSettings)}</div>
      ${personal}
      ${this._isAdmin ? `<div class="section-title">${esc(t.adminSettings)}</div>${this._renderSettings()}` : ""}`;
  }

  // Who may see this person (the person itself decides; admins see all).
  _renderShareSettings(person) {
    const t = this._t;
    const viewers = new Set(person.viewers || []);
    const users = (this._data.users || []).filter((u) => !u.is_admin && u.id !== this._data.user.id && u.id !== person.user_id);
    return `
      <div class="hint">${esc(t.shareHint)}</div>
      ${users.length ? `<div class="checks" style="margin-top:10px">${users.map((u) => `
        <label class="check"><input type="checkbox" data-action="viewer-toggle" data-person="${esc(person.id)}" data-user="${esc(u.id)}" ${viewers.has(u.id) ? "checked" : ""}>${esc(u.name)}</label>`).join("")}</div>`
        : `<div class="hint" style="margin-top:10px">${esc(t.shareNone)}</div>`}`;
  }

  // "+" dialog: add a measurement or weigh a pet / child.
  _renderAddSheet() {
    const t = this._t;
    const pets = this._entry.pets || [];
    const tab = this._addTab === "pet" && pets.length ? "pet" : "measure";
    const session = this._entry.pet_session;
    return `
      <div class="sheet-bg" data-action="add-close"></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div class="ih"><h2 id="sheet-title">${esc(tab === "pet" ? t.addTabPet : t.addTabMeasure)}</h2>
          <button class="ix" type="button" data-action="add-close" aria-label="${esc(t.closeLabel)}">×</button></div>
        ${pets.length ? `<div class="vtabs" role="tablist">
          <button class="vtab" role="tab" data-action="add-tab" data-tab="measure" aria-selected="${tab === "measure"}">${esc(t.addTabMeasure)}</button>
          <button class="vtab" role="tab" data-action="add-tab" data-tab="pet" aria-selected="${tab === "pet"}">${esc(t.addTabPet)}</button></div>` : ""}
        ${tab === "measure" ? `<div class="add-form">${this._renderAddForm()}</div>` : `
          <div class="hint" style="margin-top:8px">${esc(t.addPetHint)}</div>
          <div class="pet-pick">${pets.map((p) => `<button class="btn ${session ? "" : "primary"}" data-action="pet-start" data-pet="${esc(p.id)}" ${session ? "disabled" : ""}>${this._emoji(p)} ${esc(p.name)}</button>`).join("")}</div>`}
      </div>`;
  }

  _renderPending() {
    return `${this._renderPetSuggestions()}${this._renderPendingPersons()}`;
  }

  _renderPetSuggestions() {
    const t = this._t;
    const candidates = this._entry.measurements.filter((m) => m.status === "pet_candidate").reverse();
    if (!candidates.length) return "";
    const pets = this._entry.pets || [];
    return candidates.map((m) => {
      const pet = this._pet(m.pet_id);
      const person = this._entry.persons.find((p) => p.id === m.pair_person_id);
      if (!pet) return "";
      const others = pets.filter((p) => p.id !== pet.id);
      return `
        <div class="card pending" role="region" aria-label="${esc(t.petSuggestion)}">
          <h2>${this._emoji(pet)} ${esc(t.petSuggestion)}</h2>
          <div class="pending-row">
            <div class="what"><b class="num">${esc(t.petSuggestionText(pet.name, this._kg(m.pet_weight), person ? person.name : "?"))}</b>
              <span class="muted small">· ${esc(this._dateTime(m.ts))}</span></div>
            <button class="btn primary" data-action="pet-confirm" data-id="${esc(m.id)}" data-pet="${esc(pet.id)}">${esc(t.petYes(pet.name))}</button>
            ${others.map((o) => `<button class="btn" data-action="pet-confirm" data-id="${esc(m.id)}" data-pet="${esc(o.id)}">${this._emoji(o)} ${esc(o.name)}</button>`).join("")}
            <button class="btn quiet" data-action="pet-reject" data-id="${esc(m.id)}">${esc(t.petNo)}</button>
          </div>
        </div>`;
    }).join("");
  }

  _renderPendingPersons() {
    const t = this._t;
    const pending = this._entry.measurements.filter((m) => m.status === "pending").slice(-10).reverse();
    if (!pending.length) return "";
    const persons = this._entry.persons.filter((p) => p.can_manage);
    return `
      <div class="card pending" role="region" aria-label="${esc(t.pendingTitle(pending.length))}">
        <h2>⚠️ ${esc(t.pendingTitle(pending.length))}</h2>
        <div class="muted small" style="margin:4px 0 8px">${esc(t.pendingHint)}</div>
        ${pending.map((m) => `
          <div class="pending-row">
            <div class="what"><b class="num">${this._kg(m.weight)}</b> <span class="muted small">· ${esc(this._dateTime(m.ts))}</span></div>
            ${persons.map((p, i) => `
              <button class="btn" data-action="assign" data-id="${esc(m.id)}" data-person="${esc(p.id)}">
                <span class="dot" style="background:${this._color(p.color_index)}"></span>${esc(p.is_me && !this._isAdmin ? `${t.me} (${p.name})` : p.name)}
              </button>`).join("")}
            ${this._isAdmin ? `<button class="btn quiet" data-action="assign" data-id="${esc(m.id)}" data-person="discard">${esc(t.discard)}</button>` : ""}
          </div>`).join("")}
      </div>`;
  }

  // Everything the overview can show: persons, then children, then pets.
  _subjects() {
    const pets = this._entry.pets || [];
    return [
      ...this._entry.persons.map((subject) => ({ kind: "person", subject })),
      ...pets.filter((p) => p.kind === "child").map((subject) => ({ kind: "child", subject })),
      ...pets.filter((p) => p.kind !== "child").map((subject) => ({ kind: "pet", subject })),
    ];
  }

  // The subject shown on the overview: last choice, else yourself, else the first.
  _overviewSubject() {
    const all = this._subjects();
    let id = this._subject;
    if (id === undefined) {
      try {
        id = localStorage.getItem("wt-subject");
      } catch (err) {
        id = null;
      }
    }
    return all.find((x) => x.subject.id === id) || all.find((x) => x.kind === "person" && x.subject.is_me) || all[0];
  }

  _renderSwitcher(current) {
    const all = this._subjects();
    if (all.length < 2) return "";
    const icon = ({ kind, subject }) => kind === "person"
      ? this._avatar(subject, 26)
      : `<span class="avatar pet" style="width:26px;height:26px;font-size:15px" aria-hidden="true">${this._emoji(subject)}</span>`;
    return `<div class="switcher" role="tablist" aria-label="${esc(this._t.ovPersons)}">${all.map((x) => `
      <button class="sw" role="tab" data-action="subject" data-person="${esc(x.subject.id)}" aria-selected="${x.subject === current.subject}">${icon(x)}<span>${esc(x.subject.name)}</span></button>`).join("")}</div>`;
  }

  _showInfo(key, title, personId) {
    const t = this._t;
    let dialog = this.shadowRoot.getElementById("wt-info");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "wt-info";
      dialog.className = "info-dialog";
      dialog.setAttribute("aria-labelledby", "wt-info-title");
      // a click on the backdrop closes it
      dialog.addEventListener("click", (ev) => {
        if (ev.target === dialog || ev.target.closest("[data-close]")) dialog.close();
      });
      this.shadowRoot.appendChild(dialog);
    }
    const parts = [t.info[key] || ""];
    const person = this._entry.persons.find((p) => p.id === personId);
    const range = person && person.body && person.body.fat_range;
    if (key === "body_fat" && range) parts.push(t.infoYourRange(this._num(range[0], { digits: 0 }), this._num(range[1], { digits: 0 })));
    dialog.innerHTML = `<div class="ih"><h2 id="wt-info-title">${esc(title)}</h2>
      <button class="ix" type="button" data-close aria-label="${esc(t.infoClose)}">×</button></div>
      ${parts.map((text) => `<p>${esc(text)}</p>`).join("")}`;
    if (!dialog.open) dialog.showModal();
  }

  // Rating under a value: a status key, or [status key, own text].
  _status(status) {
    if (!status) return "";
    const [key, text] = Array.isArray(status) ? status : [status, this._t.status[status] || status];
    return `<span class="st st-${esc(key)}">${esc(text)}</span>`;
  }

  // 85,9 kg like the Xiaomi app: big integer part, smaller decimals.
  _bigWeight(value) {
    if (value === null || value === undefined) return `<span class="int">–</span>`;
    if (this._unit === "st") return this._hero(value);
    const match = /^(.*?)([.,]\d+)?$/.exec(this._kg(value, { unit: false }));
    return `<span class="int num">${esc(match[1])}</span><span class="dec num">${esc(match[2] || "")}</span><span class="u">${esc(this._unitLabel)}</span>`;
  }

  _goalHtml(person, color, compact = false) {
    const t = this._t;
    const s = person.stats || {};
    if (person.goal === null || person.goal === undefined || s.trend === null || s.trend === undefined) return "";
    const start = s.first_weight ?? person.start_weight;
    const span = start - person.goal;
    const progress = span ? Math.min(1, Math.max(0, (start - s.trend) / span)) : 1;
    const eta = s.goal_reached ? t.goalReached : s.goal_eta ? t.goalEta(this._date(Date.parse(s.goal_eta))) : t.goalNoEta;
    if (compact) {
      return `
      <div class="goal compact">
        <div class="row"><span>${esc(t.goal)} ${this._kg(person.goal)} · ${Math.round(progress * 100)} %</span><span class="num">${s.goal_reached ? esc(t.goalReached) : this._link(person, "goal_distance", t.goal, esc(t.goalLeft(this._kg(Math.abs(s.goal_remaining)))))}</span></div>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress * 100)}"><div style="width:${(progress * 100).toFixed(1)}%;background:${color}"></div></div>
      </div>`;
    }
    return `
      <div class="goal">
        <div class="row"><span>${esc(t.goal)} ${this._kg(person.goal)}</span><span class="num">${s.goal_reached ? "" : this._link(person, "goal_distance", t.goal, esc(t.goalLeft(this._kg(Math.abs(s.goal_remaining)))))}</span></div>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress * 100)}"><div style="width:${(progress * 100).toFixed(1)}%;background:${color}"></div></div>
        <div class="muted small">${this._link(person, "goal_eta", t.goal, esc(eta))} · ${Math.round(progress * 100)} %${s.change_total !== null && s.change_total !== undefined ? ` · ${this._link(person, "change_total", t.total, esc(t.sinceStart(this._kg(s.change_total, { signed: true }))))}` : ""}</div>
      </div>`;
  }

  // Overview of one person in the style of the Xiaomi app.
  _renderReport(person) {
    const t = this._t;
    const s = person.stats || {};
    const body = person.body || {};
    const a = body.analysis || null;
    const b = body.latest || {};
    const st = (a && a.status) || {};
    const color = this._color(person.color_index);
    const link = (key, label, html) => this._link(person, key, label, html);
    const age = this._age(person.birth_month);
    const adult = age === null || age >= 18;
    const latestTs = s.latest_ts ? Date.parse(s.latest_ts) : null;
    const num = (v, digits = 1) => this._kg(v, { unit: false, digits });
    const kg = (v) => `${num(v)} <small>${esc(this._unitLabel)}</small>`;
    // A label that opens its explanation when tapped.
    const term = (key, label) => `<button class="term" type="button" data-action="info" data-info="${esc(key)}" data-title="${esc(label)}" data-person="${esc(person.id)}" aria-label="${esc(`${label} – ${t.infoAbout(label)}`)}">${esc(label)}</button>`;
    const stat = (key, label, value, infoKey = "changes", rating = null) => `<div class="stat"><div class="label">${term(infoKey, label)}</div><div class="val num">${link(key, label, value)}</div>${this._status(rating)}</div>`;
    // Rate a change (kg per week): towards the goal, healthy pace, too fast or away.
    const goalDir = person.goal && s.trend ? Math.sign(person.goal - s.trend) : 0;
    const pace = (perWeek) => {
      if (perWeek === null || perWeek === undefined) return null;
      const share = Math.abs(perWeek) / (s.trend || s.latest_weight || 1) * 100;
      if (Math.abs(perWeek) < 0.1) return ["standard", t.pace.stable];
      if (goalDir && Math.sign(perWeek) !== goalDir) return ["high", t.pace.away];
      if (share > 1) return ["high", t.pace.fast];
      return goalDir ? ["good", t.pace.healthy] : ["guide", t.pace.change];
    };
    const trendStatus = s.trend && person.height && adult ? (() => {
      const bmi = s.trend / (person.height / 100) ** 2;
      return [bmi < 18.5 ? "low" : bmi < 25 ? "standard" : bmi < 30 ? "high" : "very_high", t.bmiCat(bmi)];
    })() : null;
    const bmiStatus = s.bmi && adult ? (s.bmi < 18.5 ? "low" : s.bmi < 25 ? "standard" : s.bmi < 30 ? "high" : "very_high") : null;

    const missingData = body.missing && body.missing.length
      ? `<div class="card"><div class="hint">${esc(t.bodyMissing(body.missing.map((k) => t.bodyFields[k]).join(", ")))}</div></div>` : "";
    // Short rule-based assessment (the AI's own text has its card).
    const advice = () => {
      if (st.body_fat === "high" || st.body_fat === "very_high") return t.advice.fat;
      if (st.visceral_fat === "high" || st.visceral_fat === "very_high") return t.advice.visceral;
      if (st.muscle_mass === "low") return t.advice.muscle;
      if (st.water === "low") return t.advice.water;
      if (st.bmi === "low") return t.advice.thin;
      return t.advice.good;
    };
    const ai = person.ai || {};

    // ---- cards: each builds its content for a size (S, M, L, XL) ----
    const cards = {};

    const weightBlock = `
        <div class="rh-label">${term("weight", t.weight)}</div>
        <div class="rh-weight">${link("weight", t.weight, this._bigWeight(s.latest_weight))}</div>
        <div class="rh-class">${bmiStatus ? `<span class="st st-${bmiStatus}">${esc(t.bmiCat(s.bmi))}</span>` : ""}${s.change_last !== null && s.change_last !== undefined ? `${bmiStatus ? " · " : ""}<span class="muted num">${link("change_last", t.weight, this._kg(s.change_last, { signed: true }))} ${esc(t.sinceLast)}</span>` : ""}</div>`;
    const heroStats = `
        <div class="stats">
          ${stat("trend", t.trend, this._kg(s.trend), "trend", trendStatus)}
          ${stat("change_7d", t.d7, this._kg(s.change_7d, { signed: true }), "changes", pace(s.change_7d))}
          ${stat("change_30d", t.d30, this._kg(s.change_30d, { signed: true }), "changes", pace(s.change_30d === null || s.change_30d === undefined ? null : s.change_30d * 7 / 30))}
          ${stat("rate", t.perWeek, this._kg(s.rate_per_week, { signed: true, digits: 2 }), "changes", pace(s.rate_per_week))}
          ${person.goal ? "" : stat("change_total", t.total, this._kg(s.change_total, { signed: true }))}
        </div>`;
    // Name and avatar are in the switcher above; the card starts with the weight.
    const weightLabel = `<div class="rh-label">${term("weight", t.weight)}${latestTs ? ` <span class="muted small">· ${link("last_measured", t.measured, esc(this._dateTime(latestTs)))}</span>` : ""}</div>`;
    const weightOnly = weightBlock.replace(/<div class="rh-label">[\s\S]*?<\/div>/, "");
    cards.main = {
      cls: "report-hero",
      style: `--accent:${color}`,
      build: (size) => size === "S" ? `${weightLabel}${weightOnly}`
        : size === "M" ? `<div class="hero-m"><div>${weightLabel}${weightOnly}</div>${heroStats}</div>`
        : size === "L" ? `<div class="hero-l">${weightLabel}${weightOnly}${this._personMini(person, color, 80)}${heroStats}${this._goalHtml(person, color, true)}</div>`
        : `<div class="hero-xl"><div class="hero-l">${weightLabel}${weightOnly}${heroStats}${this._goalHtml(person, color, true)}</div><div>${this._personMini(person, color, 200)}</div></div>`,
    };

    if (a && a.body_score !== undefined) {
      const scoreStatus = a.body_score >= 85 ? "good" : a.body_score >= 70 ? "standard" : a.body_score >= 50 ? ["high", t.status.low] : ["very_high", t.status.very_low];
      cards.score = {
        build: (size) => `
          <h2>${term("body_score", t.bodyReport)}</h2>
          <div class="score-row">
            <div class="score">${link("body_score", t.bodyReport, `<b class="num">${a.body_score}</b>`)}<span>${esc(t.points)}</span>
              <div>${this._status(scoreStatus)}</div></div>
            ${size === "S" ? "" : `<div class="score-text">${esc(advice())}</div>`}
          </div>
          ${size === "L" ? `<div class="pair">
            <div><div class="pv num">${s.bmi ? link("bmi", t.bmi, num(s.bmi)) : "–"}</div><div class="pl">${term("bmi", t.bmi)}</div>${this._status(bmiStatus)}</div>
            <div><div class="pv num">${b.body_fat !== null && b.body_fat !== undefined ? link("body_fat", t.bodyFat, `${num(b.body_fat)} <small>%</small>`) : "–"}</div><div class="pl">${term("body_fat", t.bodyFat)}</div>${this._status(st.body_fat)}</div>
          </div>` : ""}`,
      };
    }

    // Switched off: only the person can switch it on, so only they get the hint.
    if (ai.enabled || (person.is_me && this._entry.ai_available)) {
      const hasText = Boolean(ai.summary || (ai.tips || []).length);
      cards.ai = {
        live: true,
        build: (size) => {
          const tips = (ai.tips || []).slice(0, size === "S" ? 0 : size === "M" ? 2 : undefined);
          return `
          <div class="ai-head"><h2>🤖 ${term("ai", t.aiTitle)}</h2>
            ${ai.enabled && person.can_manage ? `<button class="btn" data-action="ai-refresh" data-person="${esc(person.id)}" ${ai.busy ? "disabled" : ""}>${esc(ai.busy ? t.aiBusy : t.aiRefresh)}</button>` : ""}</div>
          ${!ai.enabled ? `<div class="hint" style="margin-top:8px">${esc(t.aiOffHint)}</div>`
            : hasText ? `${ai.summary ? `<p class="ai-summary">${esc(ai.summary)}</p>` : ""}${tips.length ? `<ul class="ai-tips">${tips.map((tip) => `<li>${esc(tip)}</li>`).join("")}</ul>` : ""}`
            : `<div class="hint" style="margin-top:8px">${esc(ai.busy ? t.aiBusy : t.aiNone)}</div>`}
          ${ai.enabled && ai.error ? `<div class="form-error" role="alert">${esc(t.aiError(ai.error))}</div>` : ""}
          ${ai.enabled && hasText && ai.ts && (size === "L" || size === "XL") ? `<div class="hint" style="margin-top:10px">${esc(t.aiAt(this._relative(Date.parse(ai.ts))))} · ${esc(t.aiDisclaimer)}</div>` : ""}`;
        },
      };
    }

    // Body figure filled with bands, one per part, as high as its share.
    const segments = (a && a.segments) || [];
    if (segments.length) {
      const female = person.sex === "female";
      const outline = figurePath(female ? FIGURES.female : FIGURES.male);
      const top = female ? 0 : 6;
      const span = 398 - top;
      let y = top;
      const bands = segments.map((seg, i) => {
        const h = (seg.pct / 100) * span;
        const band = `<rect x="0" y="${y.toFixed(1)}" width="200" height="${(h + 0.5).toFixed(1)}" fill="${this._color(i)}"><title>${esc(`${t.segments[seg.key]}: ${this._num(seg.pct)} %`)}</title></rect>`;
        y += h;
        return band;
      });
      // 2px gaps in the card color between the bands
      let gapY = top;
      const gaps = segments.slice(0, -1).map((seg) => {
        gapY += (seg.pct / 100) * span;
        return `<line x1="0" x2="200" y1="${gapY.toFixed(1)}" y2="${gapY.toFixed(1)}" stroke="var(--wt-card)" stroke-width="3"/>`;
      }).join("");
      const clip = `wt-figure-${esc(person.id)}`;
      cards.composition = {
        build: (size) => `
          <h2>${term("composition", t.composition)}</h2>
          <div class="comp2 ${size === "M" ? "compact" : ""}">
            <svg viewBox="0 0 200 400" role="img" aria-label="${esc(`${t.composition}: ${segments.map((seg) => `${t.segments[seg.key]} ${this._num(seg.pct)} %`).join(", ")}`)}">
              <defs><clipPath id="${clip}"><path d="${outline}"/></clipPath></defs>
              <g clip-path="url(#${clip})">${bands.join("")}${gaps}</g>
            </svg>
            <div class="seg-list">${segments.map((seg, i) => `
              <div class="seg"><span class="sw-dot" style="background:${this._color(i)}"></span><span class="sl">${esc(t.segments[seg.key])}</span>
                <span class="sv num">${this._num(seg.pct)} <small>%</small></span>
                ${size === "L" ? `<span class="skg num">${this._kg(seg.kg)}</span>` : ""}</div>`).join("")}</div>
          </div>`,
      };
    }

    const facts = this._profileFacts(person, { height: person.height, goal_weight: person.goal, birth_month: person.birth_month, sex: person.sex });
    const whtrStatus = { low: "low", healthy: "standard", increased: "high", high: "very_high" }[facts.whtrClass] || null;
    const heart = body.heart_rate || null;
    const mx = body.metrics || {};
    const kcal = (v) => `${new Intl.NumberFormat(this._lang).format(v)} <small>kcal</small>`;
    const bpm = (v) => `${v} <small>bpm</small>`;
    const plain = (digits, unit) => (v) => `${this._num(v, { digits })}${unit ? ` <small>${esc(unit)}</small>` : ""}`;
    const activityName = mx.activity ? t.activityLevels[String(mx.activity)] : null;
    const ms = mx.status || {};
    // Broca is a reference weight: say where you are compared with it.
    const brocaDiff = mx.broca_weight && s.latest_weight ? s.latest_weight - mx.broca_weight : null;
    const brocaStatus = brocaDiff === null ? null
      : [Math.abs(brocaDiff) <= mx.broca_weight * 0.1 ? "standard" : brocaDiff > 0 ? "high" : "low", t.vsYou(this._kg(brocaDiff, { signed: true }))];
    // [group, sensor key, label, value, format, rating, explanation]
    const tiles = [
      ["fat", "visceral_fat", t.visceral, a && a.visceral_fat, (v) => num(v), st.visceral_fat, "visceral_fat"],
      ["fat", "fat_mass", t.fatMassLabel, a && a.fat_mass, kg, st.fat_mass, "fat_mass"],
      ["fat", "body_water", t.waterPct, b.water, (v) => `${num(v)} <small>%</small>`, st.water, "water"],
      ["fat", "water_mass", t.waterLiters, a && a.water_mass, plain(1, "l"), st.water_mass, "water_mass"],
      ["fat", "", t.whtr, facts.whtr, (v) => num(v, 2), whtrStatus, "whtr"],
      ["fat", "lean_mass", t.leanMass, a && a.lean_mass, kg, st.lean_mass, "lean_mass"],
      ["muscle", "muscle_mass", t.muscle, b.muscle_mass, kg, st.muscle_mass, "muscle"],
      ["muscle", "", t.musclePct, a && a.muscle_pct, (v) => `${num(v)} <small>%</small>`, st.muscle_pct, "muscle"],
      ["muscle", "skeletal_muscle", t.skeletalMuscle, a && a.skeletal_muscle, kg, st.skeletal_muscle, "skeletal_muscle"],
      ["muscle", "protein", t.proteinPct, a && a.protein, (v) => `${num(v)} <small>%</small>`, st.protein, "protein"],
      ["muscle", "", t.bonePct, a && a.bone_pct, (v) => `${num(v)} <small>%</small>`, st.bone_pct, "bone"],
      ["metabolism", "bmr_mifflin", t.bmrMifflin, mx.bmr_mifflin, kcal, ms.bmr_mifflin, "bmr_mifflin"],
      ["metabolism", "bmr_katch", t.bmrKatch, mx.bmr_katch, kcal, ms.bmr_katch, "bmr_katch"],
      ["metabolism", "tdee", t.tdeeLabel, mx.tdee, kcal, ms.tdee, "tdee", activityName],
      ["metabolism", "metabolic_age", t.bodyAge, a && a.metabolic_age, (v) => `${v} <small>${esc(t.yearsUnit)}</small>`, st.metabolic_age, "metabolic_age"],
      ["heart", "heart_rate", t.heartRate, heart && heart.value, bpm, st.heart_rate || (heart ? (heart.value < 60 ? "low" : heart.value <= 100 ? "standard" : "high") : null), "heart_rate"],
      ["heart", "hr_max", t.hrMax, mx.hr_max, bpm, ms.hr_max, "hr_max"],
      ["heart", "hr_reserve", t.hrReserve, mx.hr_reserve, bpm, ms.hr_reserve, "hr_reserve"],
      ["heart", "vo2max", t.vo2max, mx.vo2max, plain(1, "ml/kg/min"), ms.vo2max, "vo2max"],
      ["indices", "ponderal_index", t.ponderal, mx.ponderal_index, plain(1, "kg/m³"), ms.ponderal_index, "ponderal_index"],
      ["indices", "bsa", t.bsa, mx.bsa, plain(2, "m²"), ms.bsa, "bsa"],
      ["indices", "broca_weight", t.broca, mx.broca_weight, kg, brocaStatus, "broca_weight"],
      ["indices", "impedance_index", t.impedanceIndex, mx.impedance_index, plain(1, "cm²/Ω"), ms.impedance_index, "impedance_index"],
    ].filter(([, , , value]) => value !== null && value !== undefined && !Number.isNaN(value));
    // Heart rate zones as one bar: four steps of one hue, darker = harder.
    const zoneKeys = ["health", "fat_burn", "aerobic", "anaerobic"];
    const zoneColor = (i) => `color-mix(in srgb, ${this._color(7)} ${40 + i * 20}%, var(--wt-card))`;
    const zones = mx.zones ? `
      <div class="zones">
        <div class="zhead">${term("zones", t.zonesLabel)}</div>
        <div class="zbar" role="img" aria-label="${esc(`${t.zonesLabel}: ${zoneKeys.map((k) => `${t.zoneNames[k]} ${mx.zones[k][0]}–${mx.zones[k][1]} bpm`).join(", ")}`)}">${zoneKeys.map((k, i) => `
          <span style="flex:${Math.max(1, mx.zones[k][1] - mx.zones[k][0])};background:${zoneColor(i)}" title="${esc(`${t.zoneNames[k]}: ${mx.zones[k][0]}–${mx.zones[k][1]} bpm`)}"></span>`).join("")}</div>
        <div class="zlist">${zoneKeys.map((k, i) => `
          <div class="zrow"><span class="zdot" style="background:${zoneColor(i)}"></span>
            <span class="zname">${esc(t.zoneNames[k])}<small>${50 + i * 10}–${60 + i * 10} %</small></span>
            <span class="zval num">${link(`zone_${k}`, t.zoneNames[k], `${mx.zones[k][0]}–${mx.zones[k][1]}`)} <small>bpm</small></span></div>`).join("")}</div>
      </div>` : "";
    const groupNames = { ...t.valueGroups, ...t.valueGroupsExtra };
    // No pulse yet: say why (only admins can set up the scale's sensors).
    const cfg = this._entry.settings;
    const pulseNote = heart ? "" : `<div class="hint" style="margin-top:10px">${esc(
      !cfg ? t.pulseMissing : cfg.heart_rate_entity ? t.pulseWaiting : t.pulseMissingAdmin)}</div>`;
    // One card per group; S shows the first two values, M four, L all.
    for (const group of ["fat", "muscle", "metabolism", "heart", "indices"]) {
      const items = tiles.filter((tile) => tile[0] === group);
      if (!items.length) continue;
      cards[group] = {
        build: (size) => size === "L" ? `
          <h2>${esc(groupNames[group])}</h2>
          <div class="vgrid">${items.map(([, key, label, value, fmt, status, infoKey, note]) => `
            <div class="vt"><div class="mv num">${key ? link(key, label, fmt(value)) : fmt(value)}</div><div class="ml">${term(infoKey, label)}</div>${this._status(status)}${note ? `<div class="ml">${esc(note)}</div>` : ""}</div>`).join("")}</div>
          ${group === "heart" ? zones + pulseNote : ""}` : `
          <h2>${esc(groupNames[group])}</h2>
          <div class="vlist ${size === "M" ? "two" : ""}">${items.slice(0, size === "S" ? 2 : 4).map(([, key, label, value, fmt, status, infoKey]) => `
            <div class="vrow"><div class="vtop"><span class="vl">${term(infoKey, label)}</span><span class="vv num">${key ? link(key, label, fmt(value)) : fmt(value)}</span></div>${this._status(status)}</div>`).join("")}</div>`,
      };
    }

    // Body type map: BMI (rows, top = high) x body fat (columns), like the scale apps.
    if (a && a.body_type && s.bmi && b.body_fat !== null && b.body_fat !== undefined) {
      const female = person.sex === "female";
      const fatEdges = female ? [12, 20, 25, 30, 42] : [4, 10, 15, 20, 32];
      const bmiEdges = [32, 25, 21.7, 18.5, 15];  // top to bottom
      const areas = [["ath", "ath", "ow1", "ob"], ["mus", "mus", "fit", "ow2"], ["lm", "ln", "fit", "sf"], ["th", "uw", "uw", "sf"]];
      const typeOf = { ath: "athletic", ow1: "overweight", ob: "obese", mus: "muscular", fit: "fit", ow2: "overweight", lm: "lean_muscular", ln: "lean", sf: "skinny_fat", th: "thin", uw: "underweight" };
      const band = (value, edges, descending) => {
        for (let i = 0; i < edges.length - 1; i++) {
          const [hi, lo] = descending ? [edges[i], edges[i + 1]] : [edges[i + 1], edges[i]];
          const last = i === edges.length - 2;
          if (descending ? value >= lo || last : value < hi || last) {
            const frac = (value - lo) / (hi - lo);
            return [i, Math.min(0.9, Math.max(0.1, descending ? 1 - frac : frac))];
          }
        }
        return [0, 0.5];
      };
      const [col, fx] = band(b.body_fat, fatEdges, false);
      const [row, fy] = band(s.bmi, bmiEdges, true);
      const here = areas[row][col];
      const accent = this._color(1);
      const pct = (v) => `${this._num(v, { digits: 0 })} %`;
      const grid = (labels = true) => `
            <div class="bt2-grid">
              ${[...new Set(areas.flat())].map((area) => `<div class="bt2-cell ${area === here ? "on" : ""}" style="grid-area:${area}${area === here ? `;background:${accent}` : ""}" title="${esc(t.bodyTypes[typeOf[area]])}">${labels || area === here ? esc(t.bodyTypes[typeOf[area]]) : ""}</div>`).join("")}
              <span class="bt2-dot" style="left:${((col + fx) * 25).toFixed(1)}%;top:${((row + fy) * 25).toFixed(1)}%"></span>
            </div>`;
      cards.bodytype = {
        build: (size) => `
          <h2>${term("body_type", t.bodyType)}: ${esc(t.bodyTypes[a.body_type])}</h2>
          ${size === "M" ? `<div class="bt2 compact" role="img" aria-label="${esc(`${t.bodyType}: ${t.bodyTypes[a.body_type]}`)}">${grid(false)}</div>` : `
          <div class="bt2" role="img" aria-label="${esc(`${t.bodyType}: ${t.bodyTypes[a.body_type]} (BMI ${num(s.bmi)}, ${t.axisFat} ${num(b.body_fat)} %)`)}">
            <div class="bt2-y"><span style="top:25%">${this._num(25, { digits: 1 })}</span><span style="top:75%">${this._num(18.5, { digits: 1 })}</span></div>
            ${grid()}
            <div class="bt2-ycap">BMI</div>
            <div class="bt2-x"><span style="left:25%">${pct(fatEdges[1])}</span><span style="left:75%">${pct(fatEdges[3])}</span></div>
            <div></div><div class="bt2-xcap">${esc(t.axisFat)}</div>
          </div>`}`,
      };
    }

    // Each suggestion: amount without sign, what to do in words below, icon in the rating colour.
    const tones = { good: "var(--wt-st-good)", high: "var(--wt-st-high)", low: "var(--wt-st-low)" };
    const sugg = (name, label, value, status) => value === null || value === undefined ? "" : `
            <div class="sg" style="--tone:${tones[status[0]] || "var(--primary-color, #03a9f4)"}">
              <span class="sg-ic">${icon(name)}</span>
              <div class="sg-t"><div class="sl">${esc(label)}</div><div class="sv num">${value}</div>${this._status(status)}</div>
            </div>`;
    if (a && a.ideal_weight !== undefined) {
      const wc = a.weight_control, fc = a.fat_control, mc = a.muscle_control;
      const amount = (v) => kg(Math.abs(v));
      const ideal = sugg("scale", t.idealWeight, kg(a.ideal_weight), ["guide", t.status.guide]);
      const weight = wc === undefined ? "" : sugg("target", t.weightControl, amount(wc),
        Math.abs(wc) < 0.5 ? ["good", t.sugg.onTarget] : wc < 0 ? ["high", t.sugg.lose] : ["low", t.sugg.gain]);
      cards.suggestions = {
        // S: what to do with the weight, the standard weight as one line below
        build: (size) => size === "S" && weight ? `
          <h2>${term("suggestions", t.suggestions)}</h2>
          <div class="sugg">${weight}</div>
          <div class="sg-foot">${esc(t.idealWeight)} <b class="num">${kg(a.ideal_weight)}</b></div>` : `
          <h2>${term("suggestions", t.suggestions)}</h2>
          <div class="sugg">
            ${ideal}${weight}
            ${fc === undefined ? "" : sugg("fire", t.fatControl, amount(fc), fc < 0 ? ["high", t.sugg.reduceFat] : ["good", t.sugg.fatRoom])}
            ${mc === undefined ? "" : sugg("arm", t.muscleControl, mc > 0 ? amount(mc) : esc(t.sugg.keep), mc > 0 ? ["low", t.sugg.build] : ["good", t.sugg.inRange])}
          </div>`,
      };
    }

    const note = a ? `<div class="report-note">${esc(t.analysisNote)}</div>` : "";
    return `${this._renderBoard(cards)}${missingData}${note}`;
  }

  // Overview board: cards on a grid (4 columns on wide screens, 2 otherwise).
  // Each user sets visibility, size and order per device (kept in the browser).
  _boardKey() {
    return `wt-board-${(this._data && this._data.user && this._data.user.id) || "me"}`;
  }

  _board() {
    if (!this._boardState) {
      let saved = null;
      try {
        saved = JSON.parse(localStorage.getItem(this._boardKey()) || "null");
      } catch (err) {
        saved = null;
      }
      this._boardState = { order: [], size: {}, hidden: [], ...(saved || {}) };
    }
    const st = this._boardState;
    // Cards added by an update take their default place.
    BOARD_ORDER.forEach((id, index) => {
      if (!st.order.includes(id)) st.order.splice(Math.min(index, st.order.length), 0, id);
    });
    st.order = st.order.filter((id) => BOARD_CARDS[id]);
    return st;
  }

  _saveBoard() {
    try {
      localStorage.setItem(this._boardKey(), JSON.stringify(this._boardState));
    } catch (err) {
      // private mode etc.: the layout just is not remembered
    }
  }

  _cardSize(id) {
    const wanted = this._board().size[id];
    return BOARD_CARDS[id].sizes.includes(wanted) ? wanted : BOARD_CARDS[id].size;
  }

  _renderBoard(cards) {
    const t = this._t;
    const st = this._board();
    const editing = Boolean(this._boardEdit);
    const available = st.order.filter((id) => cards[id]);
    const visible = available.filter((id) => !st.hidden.includes(id));
    this._boardVisible = visible;
    this._boardCards = cards;  // for "Mehr": the full content in a dialog
    const items = visible.map((id, i) => {
      const size = this._cardSize(id);
      // on phones XL takes the same space as L, so it shows the L content
      const content = size === "XL" && this._boardNarrow ? "L" : size;
      const name = t.cardNames[id];
      const bar = editing ? `
        <div class="bc-edit" role="group" aria-label="${esc(name)}">
          <span class="bc-name">${esc(name)}</span>
          <span class="bc-sizes">${BOARD_CARDS[id].sizes.map((z) => `<button class="bc-btn" data-action="card-size" data-card="${id}" data-size="${z}" aria-pressed="${z === size}" aria-label="${esc(t.cardSize(z))}">${z}</button>`).join("")}</span>
          <span class="bc-tools">
            <button class="bc-btn" data-action="card-move" data-card="${id}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="${esc(t.moveEarlier)}">←</button>
            <button class="bc-btn" data-action="card-move" data-card="${id}" data-dir="1" ${i === visible.length - 1 ? "disabled" : ""} aria-label="${esc(t.moveLater)}">→</button>
            <button class="bc-btn" data-action="card-hide" data-card="${id}" aria-label="${esc(t.hideCard)}" title="${esc(t.hideCard)}">✕</button>
          </span>
        </div>` : "";
      return `<div class="bc size-${size.toLowerCase()}" data-card="${id}"><div class="card bc-card ${cards[id].cls || ""}" style="${cards[id].style || ""}" ${cards[id].live ? 'aria-live="polite"' : ""}>
        <div class="bc-body">${cards[id].build(content)}</div>
        <button class="bc-more" data-action="card-more" data-card="${id}" aria-haspopup="dialog">${esc(t.showMore)}</button>
        ${bar}</div></div>`;
    }).join("");
    const hidden = available.filter((id) => st.hidden.includes(id));
    return `
      <div class="board-wrap"><div class="board ${editing ? "editing" : ""}">${items}</div></div>
      ${editing ? `
        <div class="board-hidden">
          ${hidden.length ? `<span class="muted small">${esc(t.hiddenCards)}:</span>${hidden.map((id) => `<button class="chip" data-action="card-show" data-card="${id}">+ ${esc(t.cardNames[id])}</button>`).join("")}` : `<span class="muted small">${esc(t.noHiddenCards)}</span>`}
        </div>
        <div class="board-fab" role="toolbar" aria-label="${esc(t.boardEdit)}">
          <button class="bf-btn" data-action="board-reset">${icon("restore")}<span>${esc(t.boardReset)}</span></button>
          <button class="bf-btn primary" data-action="board-edit">${icon("check")}<span>${esc(t.boardDone)}</span></button>
        </div>` : ""}`;
  }

  // Cards have fixed sizes; content that does not fit fades out and gets "Mehr".
  _layoutBoard() {
    const board = this.shadowRoot.querySelector(".board");
    if (!board) return;
    const narrow = board.clientWidth < 520;
    if (narrow !== Boolean(this._boardNarrow)) {
      this._boardNarrow = narrow;
      this._render();  // XL content depends on it
      return;
    }
    for (const bc of board.querySelectorAll(".bc")) {
      const body = bc.querySelector(".bc-body");
      bc.classList.toggle("overflow", body.scrollHeight > body.clientHeight + 2);
    }
  }

  // "Mehr": the card with its largest content in a dialog.
  _showCardMore(id) {
    const cards = this._boardCards || {};
    if (!cards[id]) return;
    const sizes = BOARD_CARDS[id].sizes;
    let dialog = this.shadowRoot.getElementById("wt-card");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "wt-card";
      dialog.className = "info-dialog card-dialog";
      dialog.setAttribute("aria-labelledby", "wt-card-title");
      dialog.addEventListener("click", (ev) => {
        if (ev.target === dialog || ev.target.closest("[data-close]")) dialog.close();
      });
      this.shadowRoot.appendChild(dialog);
    }
    dialog.innerHTML = `<div class="ih"><h2 id="wt-card-title">${esc(this._t.cardNames[id])}</h2>
      <button class="ix" type="button" data-close aria-label="${esc(this._t.infoClose)}">×</button></div>
      <div class="card-full ${cards[id].cls || ""}" style="${cards[id].style || ""}">${cards[id].build(sizes[sizes.length - 1])}</div>`;
    if (!dialog.open) dialog.showModal();
    this._drawSparks();
  }

  // ---------------------------------------------------------------- pets

  _renderPetSession() {
    const t = this._t;
    const session = this._entry.pet_session;
    if (!session) return "";
    const pet = session.pet_id ? this._pet(session.pet_id) : null;
    return `
      <div class="card session" role="status">
        <div class="what">
          <h2>${pet ? this._emoji(pet) : "🐾"} ${esc(t.petSessionTitle(pet ? pet.name : ""))}</h2>
          <div class="hint" style="margin-top:4px">${esc(t.petSessionHint(pet ? pet.name : ""))}</div>
        </div>
        <div><span class="count">${esc(t.petSessionStep(session.readings))}</span> · <span class="muted" data-countdown>${esc(this._countdownText())}</span></div>
        <button class="btn" data-action="pet-cancel">${esc(t.cancel)}</button>
      </div>`;
  }

  _countdownText() {
    const session = this._entry && this._entry.pet_session;
    if (!session) return "";
    const left = Math.max(0, Math.round((session.expires - Date.now()) / 1000));
    return this._t.petSessionLeft(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`);
  }

  // Tick the countdown without re-rendering the page.
  _syncCountdown() {
    const active = Boolean(this._entry && this._entry.pet_session);
    if (active && !this._countdownTimer) {
      this._countdownTimer = setInterval(() => {
        const el = this.shadowRoot.querySelector("[data-countdown]");
        if (el) el.textContent = this._countdownText();
      }, 1000);
    } else if (!active && this._countdownTimer) {
      clearInterval(this._countdownTimer);
      this._countdownTimer = null;
    }
  }

  _renderChildCard(child) {
    const t = this._t;
    const s = child.stats || {};
    const g = child.growth;
    const months = this._childMonths(child);
    const latestTs = s.latest_ts ? Date.parse(s.latest_ts) : null;
    const link = (key, label, html) => this._link(child, key, label, html);
    let growthHtml = `<div class="hint" style="margin-top:12px">${esc(t.growthMissing)}</div>`;
    if (g) {
      const pct = g.percentile;
      const cls = pct === null || pct === undefined ? null : pct < 3 ? "low" : pct > 97 ? "high" : "normal";
      growthHtml = `
        ${pct !== null && pct !== undefined ? `<div style="margin-top:10px"><b>${esc(t.percentile(Math.round(pct)))}</b> <span class="muted small">· ${esc(t.percentileClass[cls])}</span></div>` : ""}
        ${this._growthChart(child)}
        <div class="hint">${esc(t.growthLegend)}</div>`;
    }
    const session = this._entry.pet_session;
    return `
      <div class="card person-card">
        <div class="person-head"><span class="avatar pet" style="width:36px;height:36px;font-size:20px">${this._emoji(child)}</span>
          <h2>${esc(child.name)}${months !== null ? ` <span class="muted small" style="font-weight:400">· ${esc(t.childAge(months))}</span>` : ""}</h2>
          <span class="muted small">${latestTs ? link("last_measured", t.measured, `${esc(t.measured)} ${esc(this._relative(latestTs))}`) : ""}</span></div>
        ${s.latest_weight !== null && s.latest_weight !== undefined
          ? `<div class="hero">${link("weight", t.weight, this._hero(s.latest_weight, s.latest_weight < 10 ? 2 : 1))}
              ${s.change_last !== null && s.change_last !== undefined ? `<span class="muted small num">${link("change_last", t.weight, this._kg(s.change_last, { signed: true, digits: 2 }))}</span>` : ""}</div>`
          : `<div class="hint" style="margin:16px 0 4px">${esc(t.petNoData)}</div>`}
        ${growthHtml}
        <div class="pet-actions">
          <button class="btn ${session ? "" : "primary"}" data-action="pet-start" data-pet="${esc(child.id)}" ${session ? "disabled" : ""}>${this._emoji(child)} ${esc(t.weighPet(child.name))}</button>
        </div>
      </div>`;
  }

  // Weight-for-age chart with percentile bands (3–97, 15–85) and the median.
  _growthChart(child) {
    const g = child.growth;
    if (!g || !g.curves || g.curves.length < 2) return "";
    return this._spark(`growth-${child.id}`, (W) => this._growthChartSvg(child, W));
  }

  _growthChartSvg(child, W) {
    const g = child.growth;
    const uf = this._factor;
    const color = this._color(child.color_index);
    const H = 190, padL = 34, padR = 10, padT = 10, padB = 20;
    const curves = g.curves.map((c) => [c[0], ...c.slice(1).map((v) => v * uf)]);
    const pts = (g.points || []).map(([a, w]) => [a, w * uf]);
    const a0 = curves[0][0], a1 = curves[curves.length - 1][0];
    let lo = Math.min(...curves.map((c) => c[1]), ...pts.map((p) => p[1]));
    let hi = Math.max(...curves.map((c) => c[5]), ...pts.map((p) => p[1]));
    const pad = (hi - lo) * 0.05; lo -= pad; hi += pad;
    const x = (a) => padL + ((a - a0) / Math.max(a1 - a0, 0.1)) * (W - padL - padR);
    const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
    const band = (iLow, iHigh) => `M${curves.map((c) => `${x(c[0]).toFixed(1)},${y(c[iHigh]).toFixed(1)}`).join("L")}L${curves.slice().reverse().map((c) => `${x(c[0]).toFixed(1)},${y(c[iLow]).toFixed(1)}`).join("L")}Z`;
    const median = curves.map((c, i) => `${i ? "L" : "M"}${x(c[0]).toFixed(1)},${y(c[3]).toFixed(1)}`).join("");
    const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
    const span = a1 - a0;
    const yearsAxis = a1 > 30;
    const stepM = yearsAxis ? (span > 120 ? 24 : 12) : span > 12 ? 3 : 1;
    let ticks = "";
    for (let a = Math.ceil(a0 / stepM) * stepM; a <= a1; a += stepM) {
      ticks += `<text x="${x(a).toFixed(1)}" y="${H - 4}" text-anchor="middle">${yearsAxis ? `${a / 12} J` : `${a} M`}</text>`;
    }
    return `<svg class="growth" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">
      <path d="${band(1, 5)}" fill="${color}" fill-opacity="0.10"/>
      <path d="${band(2, 4)}" fill="${color}" fill-opacity="0.16"/>
      <path d="${median}" fill="none" stroke="${color}" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>
      <text x="0" y="${padT + 8}">${esc(this._num(hi, { digits: 0 }))}</text>
      <text x="0" y="${H - padB}">${esc(this._num(lo, { digits: 0 }))}</text>
      ${ticks}
      ${line ? `<path d="${line}" fill="none" stroke="${color}" stroke-width="2"/>` : ""}
      ${pts.map((p) => `<circle cx="${x(p[0]).toFixed(1)}" cy="${y(p[1]).toFixed(1)}" r="3.5" fill="${color}" stroke="var(--wt-card)" stroke-width="1.5"/>`).join("")}
    </svg>`;
  }

  _renderPetCard(pet) {
    const t = this._t;
    const s = pet.stats || {};
    const color = this._color(pet.color_index);
    const link = (key, label, html) => this._link(pet, key, label, html);
    const stat = (key, label, value) => `<div class="stat"><div class="label">${esc(label)}</div><div class="val num">${link(key, label, value)}</div></div>`;
    const age = this._age(pet.birth_month);
    const latestTs = s.latest_ts ? Date.parse(s.latest_ts) : null;
    const session = this._entry.pet_session;
    let goalHtml = "";
    if (pet.goal && s.trend !== null && s.trend !== undefined) {
      const start = s.first_weight ?? pet.start_weight;
      const span = start - pet.goal;
      const progress = span ? Math.min(1, Math.max(0, (start - s.trend) / span)) : 1;
      goalHtml = `
        <div class="goal">
          <div class="row"><span>${esc(t.goal)} ${this._kg(pet.goal)}</span><span class="num">${s.goal_reached ? esc(t.goalReached) : link("goal_distance", t.goal, esc(t.goalLeft(this._kg(Math.abs(s.goal_remaining)))))}</span></div>
          <div class="bar"><div style="width:${(progress * 100).toFixed(1)}%;background:${color}"></div></div>
        </div>`;
    }
    return `
      <div class="card person-card">
        <div class="person-head"><span class="avatar pet" style="width:36px;height:36px;font-size:20px">${this._emoji(pet)}</span>
          <h2>${esc(pet.name)}${age !== null ? ` <span class="muted small" style="font-weight:400">· ${esc(t.years(age))}</span>` : ""}</h2>
          <span class="muted small">${latestTs ? link("last_measured", t.measured, `${esc(t.measured)} ${esc(this._relative(latestTs))}`) : ""}</span></div>
        ${s.latest_weight !== null && s.latest_weight !== undefined ? `
          <div class="hero">${link("weight", t.weight, this._hero(s.latest_weight, s.latest_weight < 10 ? 2 : 1))}
            ${s.change_last !== null && s.change_last !== undefined ? `<span class="muted small num">${link("change_last", t.weight, this._kg(s.change_last, { signed: true, digits: 2 }))}</span>` : ""}</div>
          <div class="stats">
            ${stat("trend", t.trend, this._kg(s.trend, { digits: 2 }))}
            ${stat("change_30d", t.d30, this._kg(s.change_30d, { signed: true, digits: 2 }))}
            ${stat("change_total", t.total, this._kg(s.change_total, { signed: true, digits: 2 }))}
          </div>
          ${this._miniChart(pet, color)}` : `<div class="hint" style="margin:16px 0 4px">${esc(t.petNoData)}</div>`}
        ${goalHtml}
        ${pet.warning ? `<div class="warn-box" role="alert"><b>⚠️ ${esc(t.petWarning[pet.warning.code](this._num(pet.warning.percent, { signed: true })))}</b>${esc(t.petWarningHint)}</div>` : ""}
        ${this._renderPetEvents(pet)}
        <div class="pet-actions">
          <button class="btn ${session ? "" : "primary"}" data-action="pet-start" data-pet="${esc(pet.id)}" ${session ? "disabled" : ""}>🐾 ${esc(t.weighPet(pet.name))}</button>
        </div>
      </div>`;
  }

  _renderPetEvents(pet) {
    const t = this._t;
    const events = (pet.events || []).slice().reverse();
    const open = this._petNotesOpen === pet.id;
    const line = (e) => `<div class="ev"><span class="when">${esc(this._date(e.ts))}</span><span class="what">${esc(t.eventCategories[e.category] || e.category)}: ${esc(e.text)}</span>
      ${open ? `<button class="icon-btn" data-action="pet-event-delete" data-id="${esc(e.id)}" title="${esc(t.deleteLabel)}" aria-label="${esc(t.deleteLabel)}">✕</button>` : ""}</div>`;
    const today = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `
      <div class="events">
        ${open ? events.map(line).join("") : events.slice(0, 1).map(line).join("")}
        ${open ? `<div class="add">
            <select id="pet-note-cat-${esc(pet.id)}" aria-label="${esc(t.petNotes)}">${Object.entries(t.eventCategories).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select>
            <input type="date" id="pet-note-date-${esc(pet.id)}" value="${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}" aria-label="${esc(t.date)}">
            <input type="text" id="pet-note-text-${esc(pet.id)}" maxlength="300" placeholder="${esc(t.notePlaceholderPet)}" aria-label="${esc(t.note)}">
            <button class="btn primary" data-action="pet-event-add" data-pet="${esc(pet.id)}">${esc(t.addNote)}</button>
          </div>` : ""}
        <button class="btn quiet" style="margin-top:6px" data-action="pet-notes" data-pet="${esc(pet.id)}">📋 ${esc(t.petNotes)}${events.length ? ` (${events.length})` : ""}</button>
      </div>`;
  }

  // Charts inside cards are drawn after rendering, in the real width of the card.
  _spark(key, draw) {
    (this._sparks = this._sparks || {})[key] = draw;
    return `<div class="spark" data-spark="${esc(key)}"></div>`;
  }

  _drawSparks() {
    for (const el of this.shadowRoot.querySelectorAll(".spark[data-spark]")) {
      const draw = (this._sparks || {})[el.dataset.spark];
      const width = Math.round(el.clientWidth);
      if (!draw || !width || el._width === width) continue;
      el._width = width;
      el.innerHTML = draw(Math.max(240, width));
    }
  }

  // Small history chart of one pet (last 180 days): dots + trend line.
  // Last 30 days of a person, same small chart as for pets.
  _personMini(person, color, height = 96) {
    const now = Date.now();
    const pts = this._entry.measurements
      .filter((m) => m.person_id === person.id && m.status === "assigned" && m.ts >= now - 30 * DAY)
      .map((m) => ({ ...m, weight: m.weight - (m.clothes_kg || 0) }));
    if (pts.length < 2) return "";
    return `<div class="rh-mini"><div class="ml">${esc(this._t.last30)}</div>${this._spark(`person-${person.id}`, (W) => this._miniChartSvg(person, color, pts, now, W, `person-${person.id}`, height))}</div>`;
  }

  _miniChart(pet, color) {
    const now = Date.now();
    const pts = (this._entry.pet_measurements || []).filter((m) => m.pet_id === pet.id && m.ts >= now - 180 * DAY);
    if (pts.length < 2) return "";
    return this._spark(`pet-${pet.id}`, (W) => this._miniChartSvg(pet, color, pts, now, W));
  }

  _miniChartSvg(pet, color, pts, now, W, key = `pet-${pet.id}`, H = 96) {
    const padL = 34, padR = 8, padT = 8, padB = 8;
    const values = pts.flatMap((m) => [m.weight, m.trend ?? m.weight]);
    let lo = Math.min(...values), hi = Math.max(...values);
    if (hi - lo < 0.4) { lo -= 0.2; hi += 0.2; }
    const t0 = pts[0].ts, t1 = Math.max(now, pts[pts.length - 1].ts);
    const x = (ts) => padL + ((ts - t0) / Math.max(t1 - t0, 1)) * (W - padL - padR);
    const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
    const trend = pts.map((m, i) => `${i ? "L" : "M"}${x(m.ts).toFixed(1)},${y(m.trend ?? m.weight).toFixed(1)}`).join("");
    this._miniData = this._miniData || {};
    this._miniData[key] = { W, H, padT, padB, color, points: pts.map((m) => ({ px: x(m.ts), py: y(m.weight), m })) };
    return `<div class="mini-wrap"><svg class="mini" data-mini="${esc(key)}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(this._t.history)}">
      <text x="0" y="${padT + 8}">${esc(this._kg(hi, { unit: false }))}</text>
      <text x="0" y="${H - padB}">${esc(this._kg(lo, { unit: false }))}</text>
      ${pts.map((m) => `<circle cx="${x(m.ts).toFixed(1)}" cy="${y(m.weight).toFixed(1)}" r="3" fill="${color}" fill-opacity="0.35"/>`).join("")}
      <path d="${trend}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${(pet.events || []).filter((e) => e.ts >= t0 && e.ts <= t1).map((e) => `<line x1="${x(e.ts).toFixed(1)}" x2="${x(e.ts).toFixed(1)}" y1="${padT}" y2="${H - padB}" stroke="var(--wt-muted)" stroke-dasharray="2 2"><title>${esc(this._date(e.ts))}: ${esc(e.text)}</title></line>`).join("")}
      <g class="mini-hover"></g>
      <rect x="0" y="0" width="${W}" height="${H}" fill="transparent"/>
    </svg><div class="tooltip mini-tip"></div></div>`;
  }

  _renderPetList() {
    const t = this._t;
    const pets = this._entry.pets || [];
    const rows = (this._entry.pet_measurements || []).slice().reverse().slice(0, 30);
    if (!pets.length) return "";
    return `
      <div class="card">
        <h2>🐾 ${esc(t.petMeasurements)}</h2>
        ${rows.length ? `<div class="table-wrap"><table>
          <thead><tr><th>${esc(t.date)}</th><th class="r">${esc(t.weight)}</th><th>${esc(t.pet)}</th><th>${esc(t.carriedBy)}</th><th>${esc(t.detected)}</th><th></th></tr></thead>
          <tbody>${rows.map((m) => {
            const pet = this._pet(m.pet_id);
            const petCell = m.can_edit
              ? `<select class="inline" data-action="pet-reassign" data-id="${esc(m.id)}">${pets.map((p) => `<option value="${esc(p.id)}" ${p.id === m.pet_id ? "selected" : ""}>${this._emoji(p)} ${esc(p.name)}</option>`).join("")}</select>`
              : `${pet ? `${this._emoji(pet)} ${esc(pet.name)}` : "–"}`;
            return `<tr>
              <td class="num">${esc(this._dateTime(m.ts))}${m.note ? `<div class="note">📝 ${esc(m.note)}</div>` : ""}</td>
              <td class="r num"><b>${this._kg(m.weight, { unit: false, digits: 2 })}</b></td>
              <td>${petCell}</td>
              <td>${esc(m.by || "–")}</td>
              <td><span class="tag">${esc(t.petMethods[m.method] || m.method)}</span></td>
              <td class="r"><button class="icon-btn" data-action="note-edit" data-kind="pet" data-id="${esc(m.id)}" title="${esc(t.editNote)}" aria-label="${esc(t.editNote)}">📝</button>${m.can_edit ? `<button class="icon-btn" data-action="pet-delete" data-id="${esc(m.id)}" title="${esc(t.deleteLabel)}" aria-label="${esc(t.deleteLabel)}">✕</button>` : ""}</td>
            </tr>${this._noteEditRow("pet", m)}`;
          }).join("")}</tbody></table></div>` : `<div class="message">${esc(t.petNoData)}</div>`}
      </div>`;
  }

  // Entity id of a person's sensor: from the server, or found via HA's own
  // frontend registry (platform + translation key + device identifier).
  _entityFor(person, key) {
    const fromServer = person.entities && person.entities[key];
    if (fromServer) return fromServer;
    const entities = this._hass && this._hass.entities;
    const devices = (this._hass && this._hass.devices) || {};
    if (!entities) return null;
    const isPet = (this._entry.pets || []).includes(person);
    const identifier = isPet ? `${this._entry.entry_id}_pet_${person.id}` : `${this._entry.entry_id}_${person.id}`;
    for (const entry of Object.values(entities)) {
      if (entry.platform !== "weight_tracker" || entry.translation_key !== key || !entry.device_id) continue;
      const device = devices[entry.device_id];
      const ids = (device && device.identifiers) || [];
      if (ids.some(([domain, id]) => domain === "weight_tracker" && id === identifier) && this._hass.states[entry.entity_id]) {
        return entry.entity_id;
      }
    }
    return null;
  }

  _sensorCount(person) {
    const keys = new Set(["weight", "trend", "change_last", "change_7d", "change_30d", "change_total", "rate", "bmi", "goal_distance", "goal_eta", "last_measured", ...(person.sensors || [])]);
    return [...keys].filter((k) => this._entityFor(person, k)).length;
  }

  _link(person, key, label, html) {
    const entityId = this._entityFor(person, key);
    if (!entityId) return html;
    return `<button class="link" data-action="more-info" data-entity="${esc(entityId)}" title="${esc(this._t.showDetails(label))}">${html}</button>`;
  }

  _age(birthMonth) {
    const match = /^(\d{4})-(\d{2})/.exec(birthMonth || "");
    if (!match) return null;
    const year = Number(match[1]), month = Number(match[2]);
    const now = new Date();
    const age = now.getFullYear() - year - (now.getMonth() + 1 < month ? 1 : 0);
    return age >= 0 && age < 130 ? age : null;
  }

  // ------------------------------------------------------------- my data

  // Values shown on "My details", from the (possibly unsaved) form model.
  _profileFacts(person, model) {
    const s = person.stats || {};
    const height = model.height === null || model.height === undefined || model.height === "" ? null : Number(model.height);
    const goal = model.goal_weight === null || model.goal_weight === undefined || model.goal_weight === "" ? null : Number(model.goal_weight);
    const weight = s.latest_weight ?? null;
    const age = model.birth_month && model.birth_month !== "invalid" ? this._age(model.birth_month) : null;
    const h = height && !Number.isNaN(height) ? height / 100 : null;
    const bmi = h && weight ? weight / (h * h) : null;
    const waist = (person.waist || []).length ? person.waist[person.waist.length - 1].cm : null;
    const whtr = waist && h ? waist / height : null;
    let whtrClass = null;
    if (whtr) {
      const limit = age === null || age < 50 ? 0.5 : 0.5 + Math.min(age - 50, 10) * 0.01;
      whtrClass = whtr < 0.4 ? "low" : whtr < limit ? "healthy" : whtr < 0.6 ? "increased" : "high";
    }
    return {
      age, height: h ? height : null, weight, bmi, goal: goal && !Number.isNaN(goal) ? goal : null,
      low: h ? 18.5 * h * h : null, high: h ? 24.9 * h * h : null, trend: s.trend ?? weight,
      sex: model.sex || null, waist, whtr, whtrClass,
    };
  }

  // Editable values on "My details": the tile key, its field and its profile key.
  _tileDefs(person) {
    const t = this._t;
    const refresh = () => this._refreshMyData(person);
    return {
      age: this._def("birthmonth", "birth_month", t.birthDate, { helper: t.birthMonthHint, onChange: refresh }),
      height: this._def("number", "height", t.height, { min: 50, max: 250, step: 1, unit: "cm", helper: t.heightHint, onChange: refresh }),
      goal: this._def("number", "goal_weight", t.goalWeight, { min: 1, max: 300, step: 0.1, unit: "kg", helper: t.goalWeightHint, onChange: refresh }),
      sex: this._def("select", "sex", t.sex, { options: Object.entries(t.sexNames).map(([value, label]) => ({ value, label })), emptyLabel: t.sexNone, helper: t.sexHint, onChange: refresh }),
      waist: this._def("number", "waist_new", t.waistNew, { min: 30, max: 250, step: 0.5, unit: "cm", helper: t.waistHint }),
      activity: this._def("select", "activity_level", t.activity, {
        options: Object.entries(t.activityLevels).map(([value, label]) => ({ value, label: `${label} – ${t.activityHints[value]}` })), helper: t.activityHint,
      }),
      clothes: [
        this._def("boolean", "clothes", t.clothesOn, { helper: t.clothesOnHint, wide: true }),
        this._def("number", "clothes_kg", t.clothesStart, { min: 0, max: 4, step: 0.1, unit: "kg", helper: t.clothesStartHint, wide: true }),
      ],
    };
  }

  _renderMyData(person) {
    const t = this._t;
    const formId = `profile-form-${person.id}`;
    const c = person.clothes || {};
    const defaults = { height: person.height ?? null, goal_weight: person.goal ?? null, birth_month: person.birth_month || null, sex: person.sex || "", waist_new: null,
      activity_level: person.activity_level ? String(person.activity_level) : "", clothes: Boolean(c.enabled), clothes_kg: c.start ?? 0.8 };
    if (!this._dirty.has(formId) || !this._models[formId]) this._models[formId] = { ...defaults };
    const facts = this._profileFacts(person, this._models[formId]);
    return `
      <div class="card profile-hero">
        ${this._avatar(person, 64)}
        <div><h2>${esc(person.name)}</h2><div class="hint" style="margin-top:2px">${esc(t.myDataHint)}</div></div>
      </div>
      <div class="tiles">${this._myDataTiles(person, facts, defaults)}</div>
      <div class="two">
        <div class="card" data-preview="health-${esc(person.id)}">${this._myDataHealth(facts)}</div>
        <div class="card" data-preview="goal-${esc(person.id)}">${this._myDataGoal(person, facts)}</div>
      </div>
`;
  }

  _renderAiFields(formId) {
    const t = this._t;
    const chosen = new Set(this._models[formId].ai_fields || []);
    return `
      <div class="ai-fields" role="group" aria-label="${esc(t.aiFieldsLabel)}">
        <div class="flabel" style="display:flex;align-items:center;gap:8px">${esc(t.aiFieldsLabel)}
          <span class="chips" style="margin-left:auto">
            <button class="chip" type="button" data-action="ai-fields-all" data-form="${esc(formId)}">${esc(t.sensorAll)}</button>
            <button class="chip" type="button" data-action="ai-fields-none" data-form="${esc(formId)}">${esc(t.sensorNone)}</button>
          </span></div>
        ${Object.entries(AI_FIELDS).map(([group, keys]) => `
          <h3>${esc(t.aiFieldGroups[group])}</h3>
          <div class="checks">${keys.map((key) => `
            <label class="check"><input type="checkbox" data-action="ai-field" data-form="${esc(formId)}" data-key="${key}" ${chosen.has(key) ? "checked" : ""}>${esc(t.aiFieldNames[key])}</label>`).join("")}</div>`).join("")}
        <div class="hint" id="${esc(formId)}-none" style="margin-top:8px" ${chosen.size ? "hidden" : ""}>${esc(t.aiFieldsNone)}</div>
      </div>`;
  }

  _renderAiSettings(person) {
    const t = this._t;
    const formId = `ai-form-${person.id}`;
    const entity = (this._entry.settings || {}).ai_task_entity;
    const state = entity && this._hass.states[entity];
    const name = (state && state.attributes.friendly_name) || entity || "AI Task";
    return `
        <div class="hint">${esc(t.aiExplain(name))}</div>
        <div class="form" id="${esc(formId)}">
          ${this._formFields(formId, [this._def("boolean", "ai_insights", t.aiSwitch, { wide: true })],
            { ai_insights: Boolean(person.ai_insights), ai_fields: person.ai_fields ? [...person.ai_fields] : [...AI_FIELD_KEYS] })}
          ${this._renderAiFields(formId)}
          ${this._formActions(formId)}
        </div>`;
  }

  _notifyServices() {
    const services = Object.keys((this._hass.services || {}).notify || {});
    return services
      .filter((name) => !["notify", "send_message", "persistent_notification"].includes(name))
      .sort()
      .map((name) => ({ value: name, label: name.replace(/^mobile_app_/, "📱 ").replace(/_/g, " ") }));
  }

  _serviceLabel(name) {
    return name ? name.replace(/^mobile_app_/, "📱 ").replace(/_/g, " ") : "";
  }

  _renderNotifySettings(person) {
    const t = this._t;
    const formId = `notify-form-${person.id}`;
    const n = person.notify || {};
    // The device is chosen by an admin; persons only decide what they get.
    const fields = [
      this._def("boolean", "notify_weigh", t.notifyWeigh, { wide: true }),
      ...((this._entry.pets || []).some((p) => p.kind !== "child") ? [this._def("boolean", "notify_pet_warnings", t.notifyPetWarnings, { wide: true })] : []),
      this._def("number", "reminder_days", t.reminderDays, { min: 0, max: 60, step: 1, unit: t.days, helper: t.reminderHint, wide: true }),
    ];
    const defaults = { notify_weigh: Boolean(n.weigh), notify_pet_warnings: Boolean(n.pet_warnings), reminder_days: n.reminder_days || 0 };
    return `
        <div class="hint">${esc(t.notificationsHint)}</div>
        <div style="margin-top:8px">${n.service ? esc(t.notifyTarget(this._serviceLabel(n.service))) : `<span class="hint">${esc(t.notifyNoDevice)}</span>`}</div>
        <div class="form" id="${esc(formId)}">
          ${this._formFields(formId, fields, defaults)}
          ${this._formActions(formId, n.service ? `<button class="btn" type="button" data-action="notify-test" data-person="${esc(person.id)}" data-form="${esc(formId)}">${esc(t.sendTest)}</button>` : "")}
        </div>`;
  }

  // Live update while a tile is edited; the tile being edited keeps its field.
  _refreshMyData(person) {
    const facts = this._profileFacts(person, this._models[`profile-form-${person.id}`] || {});
    for (const [key, html] of Object.entries(this._tileContents(person, facts))) {
      if (this._editTile && this._editTile.key === key && this._editTile.person === person.id) continue;
      const el = this.shadowRoot.querySelector(`[data-tile="${key}-${person.id}"]`);
      if (el) el.innerHTML = html;
    }
    const set = (key, html) => {
      const el = this.shadowRoot.querySelector(`[data-preview="${key}-${person.id}"]`);
      if (el) el.innerHTML = html;
    };
    set("health", this._myDataHealth(facts));
    set("goal", this._myDataGoal(person, facts));
  }

  _tileContents(person, f) {
    const t = this._t;
    const remaining = f.goal !== null && f.trend !== null ? f.goal - f.trend : null;
    const content = (label, big, sub = "") => `<div class="label">${esc(label)}</div><div class="big num">${big}</div>${sub ? `<div class="sub">${sub}</div>` : ""}`;
    return {
      age: content(t.age, f.age !== null ? `${f.age} <small>${esc(t.years(f.age).replace(/^\d+\s*/, ""))}</small>` : "–", f.age === null ? esc(t.ageMissing) : ""),
      height: content(t.height, f.height ? `${this._kg(f.height, { unit: false, digits: 0 })} <small>cm</small>` : "–"),
      bmi: content(t.bmi, f.bmi ? this._kg(f.bmi, { unit: false }) : "–", f.bmi && (f.age === null || f.age >= 18) ? esc(t.bmiCat(f.bmi)) : ""),
      goal: content(t.goal, f.goal ? `${this._kg(f.goal, { unit: false })} <small>${this._unitLabel}</small>` : "–", remaining !== null ? esc(Math.abs(remaining) <= 0.2 ? t.goalReached : t.goalLeft(this._kg(Math.abs(remaining)))) : ""),
      sex: content(t.sex, f.sex ? esc(t.sexNames[f.sex]) : "–", f.sex ? "" : esc(t.sexHint)),
      activity: content(t.activity, person.activity_level ? esc(t.activityLevels[String(person.activity_level)]) : "–",
        esc(person.activity_level ? t.activityHints[String(person.activity_level)] : t.activityHint)),
      clothes: person.clothes ? content(t.clothes, person.clothes.enabled ? `${this._kg(person.clothes.learned, { unit: false })} <small>${this._unitLabel}</small>` : esc(t.clothesOff),
        person.clothes.enabled ? esc(t.clothesLearned(person.clothes.samples)) : esc(t.clothesOnHint)) : "",
      waist: content(t.waist, f.waist ? `${this._kg(f.waist, { unit: false, digits: f.waist % 1 ? 1 : 0 })} <small>cm</small>` : "–",
        f.whtr ? `${esc(t.whtr)} ${this._kg(f.whtr, { unit: false, digits: 2 })} · ${esc(t.whtrClass[f.whtrClass])}` : ""),
    };
  }

  _myDataTiles(person, facts, defaults) {
    const t = this._t;
    const formId = `profile-form-${person.id}`;
    const defs = this._tileDefs(person);
    const contents = this._tileContents(person, facts);
    const labels = { age: t.age, height: t.height, bmi: t.bmi, goal: t.goal, sex: t.sex, waist: t.waist, activity: t.activity, clothes: t.clothes };
    return ["age", "height", "bmi", "goal", "sex", "waist", "activity", ...(person.clothes ? ["clothes"] : [])].map((key) => {
      const editing = this._editTile && this._editTile.key === key && this._editTile.person === person.id;
      if (editing) {
        return `
          <div class="tile editing">
            <div class="label">${esc(labels[key])}</div>
            <div class="form" id="${esc(formId)}">
              ${this._formFields(formId, [].concat(defs[key]), defaults)}
              ${key === "waist" ? this._waistList(person) : ""}
              <div class="actions">
                <button class="btn primary" type="button" data-action="save-form" data-form="${esc(formId)}">${esc(t.save)}</button>
                <button class="btn" type="button" data-action="cancel-tile" data-form="${esc(formId)}">${esc(t.cancel)}</button>
              </div>
            </div>
          </div>`;
      }
      const pen = defs[key] && person.can_manage && !this._editTile
        ? `<button class="pen" data-action="edit-tile" data-tile="${key}" data-person="${esc(person.id)}" title="${esc(t.editTile(labels[key]))}" aria-label="${esc(t.editTile(labels[key]))}">✎</button>`
        : "";
      return `<div class="tile">${pen}<div data-tile="${key}-${esc(person.id)}">${contents[key]}</div></div>`;
    }).join("");
  }

  _waistList(person) {
    const entries = (person.waist || []).slice(-5).reverse();
    if (!entries.length) return "";
    return `<div class="waist-list">${entries.map((w) => `
      <div><span>${esc(this._date(w.ts))}</span><b class="num">${this._kg(w.cm, { unit: false, digits: w.cm % 1 ? 1 : 0 })} cm</b>
        <button class="icon-btn" type="button" data-action="waist-delete" data-id="${esc(w.id)}" title="${esc(this._t.deleteLabel)}" aria-label="${esc(this._t.deleteLabel)}">✕</button></div>`).join("")}</div>`;
  }

  // Only shown when the scale provides impedance / body fat.
  _renderBody(person, f) {
    const t = this._t;
    const body = person.body;
    // Only derived values (no scale data): nothing to show here.
    if (!body || (!body.latest && !(body.missing || []).length)) return "";
    if (!body.latest) {
      const fields = (body.missing || []).map((k) => t.bodyFields[k]).join(", ");
      return `<div class="card"><h2>🧬 ${esc(t.body)}</h2><div class="hint" style="margin-top:6px">${esc(t.bodyMissing(fields))}</div></div>`;
    }
    const b = body.latest;
    const tile = (key, label, value, sub = "") => value === null || value === undefined ? "" :
      `<div class="tile"><div class="label">${esc(label)}</div><div class="big num">${this._link(person, key, label, value)}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>`;
    const range = body.fat_range ? t.fatRange(body.fat_range[0], body.fat_range[1]) : "";
    const fatSub = [body.fat_class ? t.fatClass[body.fat_class] : "", range,
      body.fat_change_30d !== null && body.fat_change_30d !== undefined ? `${this._kg(body.fat_change_30d, { signed: true, unit: false })} % ${t.d30}` : ""].filter(Boolean).join(" · ");
    return `
      <div class="card">
        <h2>🧬 ${esc(t.body)}</h2>
        <div class="hint" style="margin-top:4px">${esc(body.source === "impedance" ? t.bodyHint : t.bodyScaleHint)}</div>
        ${body.missing && body.missing.length ? `<div class="hint" style="margin-top:4px">${esc(t.bodyMissing(body.missing.map((k) => t.bodyFields[k]).join(", ")))}</div>` : ""}
        <div class="tiles" style="margin-top:12px">
          ${tile("body_fat", t.bodyFat, `${this._kg(b.body_fat, { unit: false })} <small>%</small>`, esc(fatSub))}
          ${tile("muscle_mass", t.muscle, b.muscle_mass !== null ? `${this._kg(b.muscle_mass, { unit: false })} <small>${this._unitLabel}</small>` : null)}
          ${tile("body_water", t.water, b.water !== null ? `${this._kg(b.water, { unit: false })} <small>%</small>` : null)}
          ${tile("bone_mass", t.bone, b.bone_mass !== null ? `${this._kg(b.bone_mass, { unit: false })} <small>${this._unitLabel}</small>` : null)}
          ${tile("bmr", t.bmr, b.bmr !== null ? `${new Intl.NumberFormat(this._lang).format(b.bmr)} <small>kcal</small>` : null)}
        </div>
        ${this._sparkline((body.history || []).map(([ts, fat]) => [ts, fat]), this._color(person.color_index), "%")}
      </div>`;
  }

  // Year heatmap: one square per day, color = trend change towards / away from the goal.
  _renderCalendar(person) {
    const t = this._t;
    const all = this._assigned(person.id);
    if (!all.length) return "";
    const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
    const byDay = new Map();
    for (const m of all) byDay.set(dayKey(m.ts), m);   // last measurement of the day
    const sign = person.goal && all[0] && person.goal > all[0].weight ? 1 : -1;
    const changes = new Map();
    let prev = null;
    for (const m of [...byDay.values()]) {
      if (prev !== null && m.trend !== null && m.trend !== undefined) changes.set(dayKey(m.ts), m.trend - prev);  // raw change; colorFor applies the goal direction
      prev = m.trend ?? prev;
    }
    const dark = this._dark;
    const good = dark ? ["#2a5d9e", "#3987e5", "#86b6ef"] : ["#b7d3f6", "#5598e7", "#1c5cab"];
    const bad = dark ? ["#8a3b3b", "#d04f4f", "#f19a9a"] : ["#f6c4c4", "#e66767", "#b83232"];
    const flat = dark ? "#55544f" : "#c9c8c3";
    const empty = dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)";
    const colorFor = (change) => {
      if (change === undefined) return flat;
      const towards = sign < 0 ? change < 0 : change > 0;
      const size = Math.abs(change);
      if (size < 0.05) return flat;
      const step = size < 0.15 ? 0 : size < 0.4 ? 1 : 2;
      return (towards ? good : bad)[step];
    };
    // 53 weeks, starting on a Monday
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today); start.setDate(start.getDate() - 52 * 7 - ((today.getDay() + 6) % 7));
    const cell = 11, gap = 2, left = 22, top = 14;
    let svg = "", day = new Date(start), col = 0, lastMonth = -1, days = 0;
    while (day <= today) {
      const row = (day.getDay() + 6) % 7;
      if (row === 0 && day.getMonth() !== lastMonth && day.getDate() <= 7) {
        svg += `<text x="${left + col * (cell + gap)}" y="9">${esc(this._date(day.getTime(), { month: "short" }))}</text>`;
        lastMonth = day.getMonth();
      }
      const key = dayKey(day.getTime());
      const m = byDay.get(key);
      if (m) days++;
      const fill = m ? colorFor(changes.get(key)) : empty;
      const title = m ? `${this._date(day.getTime())}: ${this._kg(this._w(m))}${changes.has(key) ? ` (${t.trend} ${this._kg(changes.get(key), { signed: true, digits: 2 })})` : ""}` : this._date(day.getTime());
      svg += `<rect x="${left + col * (cell + gap)}" y="${top + row * (cell + gap)}" width="${cell}" height="${cell}" rx="2" fill="${fill}"><title>${esc(title)}</title></rect>`;
      day.setDate(day.getDate() + 1);
      if ((day.getDay() + 6) % 7 === 0) col++;
    }
    const labels = t.weekdaysShort.map((d, i) => d ? `<text x="0" y="${top + i * (cell + gap) + 9}">${esc(d)}</text>` : "").join("");
    const width = left + (col + 1) * (cell + gap), height = top + 7 * (cell + gap);
    // longest streak
    let best = 0, run = 0, prevDay = null;
    for (const key of [...byDay.keys()]) {
      const [y, mo, d] = key.split("-").map(Number);
      const dt = new Date(y, mo, d).getTime();
      run = prevDay !== null && Math.round((dt - prevDay) / DAY) === 1 ? run + 1 : 1;
      best = Math.max(best, run); prevDay = dt;
    }
    const L = t.calendarLegend;
    return `
      <div class="card">
        <h2>📅 ${esc(t.calendar)}</h2>
        <div class="hint" style="margin-top:4px">${esc(t.calendarStats(days, best))}</div>
        <svg class="cal" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(t.calendarHint)}">${labels}${svg}</svg>
        <div class="legend-row">
          <span><i style="background:${good[2]}"></i>${esc(L.good)}</span>
          <span><i style="background:${bad[2]}"></i>${esc(L.bad)}</span>
          <span><i style="background:${flat}"></i>${esc(L.flat)}</span>
          <span><i style="background:${empty};box-shadow:inset 0 0 0 1px var(--wt-grid)"></i>${esc(L.none)}</span>
        </div>
      </div>`;
  }

  // Small line chart for [[ts, value], ...]
  _sparkline(points, color, unit = "") {
    if (points.length < 2) return "";
    return this._spark(`line-${color}-${points.length}-${points[0][0]}`, (W) => this._sparklineSvg(points, color, unit, W));
  }

  _sparklineSvg(points, color, unit, W) {
    const H = 84, padL = 38, padR = 8, padT = 8, padB = 8;
    let lo = Math.min(...points.map((p) => p[1])), hi = Math.max(...points.map((p) => p[1]));
    if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
    const t0 = points[0][0], t1 = points[points.length - 1][0];
    const x = (ts) => padL + ((ts - t0) / Math.max(t1 - t0, 1)) * (W - padL - padR);
    const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
    const d = points.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
    return `<svg class="mini" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">
      <text x="0" y="${padT + 8}">${esc(this._kg(hi, { unit: false }))}${unit}</text>
      <text x="0" y="${H - padB}">${esc(this._kg(lo, { unit: false }))}${unit}</text>
      <path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${points.map((p) => `<circle cx="${x(p[0]).toFixed(1)}" cy="${y(p[1]).toFixed(1)}" r="2.5" fill="${color}"/>`).join("")}
    </svg>`;
  }

  _myDataHealth(f) {
    const t = this._t;
    if (!f.height) return `<h2>${esc(t.healthy)}</h2><div class="hint" style="margin-top:8px">${esc(t.healthyNeedsHeight)}</div>`;
    const min = 15, max = 40;
    const zones = [[min, 18.5, "var(--warning-color, #ffa600)"], [18.5, 25, "var(--success-color, #43a047)"], [25, 30, "var(--warning-color, #ffa600)"], [30, max, "var(--error-color, #db4437)"]];
    const width = (a, b) => `${((b - a) / (max - min)) * 100}%`;
    const pos = f.bmi ? Math.min(max, Math.max(min, f.bmi)) : null;
    const youth = f.age !== null && f.age < 18;
    return `
      <h2>${esc(t.healthy)}</h2>
      <div class="scale" role="img" aria-label="BMI ${f.bmi ? this._kg(f.bmi, { unit: false }) : "–"}">
        ${pos !== null ? `<div class="marker" style="left:${((pos - min) / (max - min)) * 100}%">${esc(t.youAt)} ${this._kg(f.bmi, { unit: false })}</div>` : ""}
        <div class="zones">${zones.map(([a, b, c]) => `<div style="width:${width(a, b)};background:${c}"></div>`).join("")}</div>
        <div class="labels">${zones.map(([a, b], i) => `<div style="width:${width(a, b)}">${esc(t.bmiZones[i])}</div>`).join("")}</div>
      </div>
      <div class="hint" style="margin-top:10px">${esc(t.healthyRange(this._kg(f.height, { unit: false, digits: 0 }), this._kg(f.low, { unit: false }), this._kg(f.high)))}</div>
      ${f.whtr ? `<div style="margin-top:8px;font-size:13px">${esc(t.whtrLine(this._kg(f.waist, { unit: false, digits: f.waist % 1 ? 1 : 0 }), this._kg(f.whtr, { unit: false, digits: 2 }), t.whtrClass[f.whtrClass]))}</div>` : ""}
      ${youth ? `<div class="hint" style="margin-top:6px">${esc(t.bmiYouth)}</div>` : ""}`;
  }

  _myDataGoal(person, f) {
    const t = this._t;
    const s = person.stats || {};
    if (!f.goal) return `<h2>${esc(t.yourGoal)}</h2><div class="hint" style="margin-top:8px">${esc(t.noGoal)}</div>`;
    const start = s.first_weight ?? person.start_weight;
    const span = start - f.goal;
    const progress = f.trend !== null && span ? Math.min(1, Math.max(0, (start - f.trend) / span)) : 0;
    // The ETA from the server belongs to the saved goal; recompute for an edited one.
    let eta = t.goalNoEta;
    const remaining = f.trend !== null ? f.goal - f.trend : null;
    if (remaining !== null && Math.abs(remaining) <= 0.2) eta = t.goalReached;
    else if (s.rate_per_week && remaining !== null && s.rate_per_week * remaining > 0) {
      const weeks = remaining / s.rate_per_week;
      if (weeks <= 260) eta = t.goalEta(this._date(Date.now() + weeks * 7 * DAY));
    }
    return `
      <h2>${esc(t.yourGoal)}</h2>
      <div class="goal" style="border:none;padding-top:4px">
        <div class="row"><span>${esc(t.startedAt)} ${this._kg(start)}</span><span>${esc(t.goal)} ${this._kg(f.goal)}</span></div>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress * 100)}"><div style="width:${(progress * 100).toFixed(1)}%;background:${this._color(person.color_index)}"></div></div>
        <div class="row"><span class="muted">${esc(eta)}</span><span class="num">${Math.round(progress * 100)} %</span></div>
        ${s.rate_per_week !== null && s.rate_per_week !== undefined ? `<div class="hint" style="margin-top:6px">${esc(t.perWeek)}: ${this._kg(s.rate_per_week, { signed: true, digits: 2 })}</div>` : ""}
      </div>`;
  }

  _renderChartHead() {
    const t = this._t;
    const metric = this._chartMetric();
    const de = t === TEXT.de;
    return `
      <div class="chart-head">
        <h2>${esc(t.history)}</h2>
        <label class="muted small">${esc(t.chartMetric)}
          <select class="inline" data-action="metric" aria-label="${esc(t.chartMetric)}">${CHART_METRICS
            .filter((d) => this._entry.persons.some((p) => this._metricAvailable(p, d.key)))
            .map((d) => `<option value="${d.key}" ${d.key === metric.key ? "selected" : ""}>${esc(t.chartMetrics[d.key])}</option>`).join("")}</select></label>
        <div class="chips" role="group" aria-label="${esc(t.history)}">
          ${this._entry.persons.map((p, i) => `
            <button class="chip legend ${this._hidden.has(p.id) ? "off" : ""}" data-action="toggle" data-person="${esc(p.id)}" aria-pressed="${!this._hidden.has(p.id)}">
              <span class="dot" style="background:${this._color(p.color_index)}"></span>${esc(p.name)}</button>`).join("")}
        </div>
        <div class="chips" role="group">
          <button class="chip" data-action="mode" data-mode="abs" aria-pressed="${this._mode === "abs"}">${esc(metric.key === "weight" ? t.absolute : t.chartMetrics[metric.key])}</button>
          <button class="chip" data-action="mode" data-mode="rel" aria-pressed="${this._mode === "rel"}">${esc(t.relative)}</button>
          ${this._mode === "abs" && metric.key === "weight" ? `<button class="chip" data-action="forecast" aria-pressed="${this._forecast}">📈 ${esc(t.forecast)}</button>` : ""}
        </div>
        <div class="chips" role="group">
          ${RANGES.map((r) => `<button class="chip" data-action="range" data-range="${r.key}" aria-pressed="${this._range === r.key}">${de ? r.de : r.en}</button>`).join("")}
        </div>
      </div>`;
  }

  _renderList() {
    const t = this._t;
    const persons = this._entry.persons;
    // Pet suggestions have their own card above.
    let rows = this._entry.measurements.filter((m) => m.status !== "pet_candidate" && (m.status !== "discarded" || this._listPerson === "all"));
    if (this._listPerson !== "all") rows = rows.filter((m) => m.person_id === this._listPerson);
    rows = rows.slice().reverse();
    const shown = rows.slice(0, this._listLimit);
    const previous = {};
    // change vs. the previous measurement of the same person
    for (const m of this._entry.measurements) {
      if (m.status !== "assigned") continue;
      if (previous[m.person_id] !== undefined) m._delta = this._w(m) - previous[m.person_id];
      previous[m.person_id] = this._w(m);
    }
    return `
      <div class="chart-head">
        <h2>${esc(t.list)}</h2>
        <div class="chips">
          <button class="chip" data-action="list-person" data-person="all" aria-pressed="${this._listPerson === "all"}">${esc(t.all)}</button>
          ${persons.map((p, i) => `<button class="chip" data-action="list-person" data-person="${esc(p.id)}" aria-pressed="${this._listPerson === p.id}"><span class="dot" style="background:${this._color(p.color_index)}"></span>${esc(p.name)}</button>`).join("")}
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>${esc(t.date)}</th><th class="r">${esc(t.weight)}</th><th class="r">±</th><th>${esc(t.person)}</th><th>${esc(t.detected)}</th><th></th></tr></thead>
          <tbody>
            ${shown.map((m) => `
              <tr>
                <td class="num">${esc(this._dateTime(m.ts))}${m.note ? `<div class="note">📝 ${esc(m.note)}</div>` : ""}</td>
                <td class="r num"><b>${this._kg(this._w(m), { unit: false })}</b>${m.clothes_kg ? `<div class="note" title="${esc(t.measuredWithClothes(this._kg(m.weight)))}">👕 ${this._kg(m.weight, { unit: false })}</div>` : ""}</td>
                <td class="r num muted">${m.status === "assigned" && m._delta !== undefined ? this._kg(m._delta, { signed: true, unit: false }) : ""}</td>
                <td>${this._renderPersonCell(m)}</td>
                <td><span class="tag ${m.status === "pending" ? "warn" : ""}">${esc(m.status === "pending" ? t.open : m.status === "discarded" ? t.discarded : t.methods[m.method] || m.method)}</span></td>
                <td class="r">${this._canDelete(m) && m.status === "assigned" && ((this._personOf(m) || {}).clothes || {}).enabled ? `<button class="icon-btn ${m.clothes_kg ? "on" : ""}" data-action="clothes-toggle" data-id="${esc(m.id)}" data-on="${m.clothes_kg ? "1" : ""}" title="${esc(m.clothes_kg ? t.unmarkClothes : t.markClothes)}" aria-label="${esc(m.clothes_kg ? t.unmarkClothes : t.markClothes)}" aria-pressed="${Boolean(m.clothes_kg)}">👕</button>` : ""}${this._canDelete(m) && m.status === "assigned" ? `<button class="icon-btn" data-action="note-edit" data-kind="person" data-id="${esc(m.id)}" title="${esc(t.editNote)}" aria-label="${esc(t.editNote)}">📝</button>` : ""}${this._canDelete(m) ? `<button class="icon-btn" data-action="delete" data-id="${esc(m.id)}" title="${esc(t.deleteLabel)}" aria-label="${esc(t.deleteLabel)}">✕</button>` : ""}</td>
              </tr>${this._noteEditRow("person", m)}`).join("")}
          </tbody>
        </table>
      </div>
      ${!shown.length ? `<div class="message">${esc(t.noData)}</div>` : ""}
      ${rows.length > shown.length ? `<button class="btn more" data-action="more">${esc(t.more)} (${rows.length - shown.length})</button>` : ""}`;
  }

  _renderImportExport() {
    const t = this._t;
    const targets = [
      ...this._entry.persons.filter((p) => p.can_manage).map((p) => ({ value: `person:${p.id}`, label: p.name })),
      ...(this._entry.pets || []).map((p) => ({ value: `pet:${p.id}`, label: `${this._emoji(p)} ${p.name}` })),
    ];
    const imp = this._import;
    let preview = "";
    if (imp) {
      if (!imp.parsed.rows.length) {
        preview = `<div class="form-error">${esc(t.importNothing)}</div>`;
      } else {
        const rows = imp.parsed.rows, c = imp.parsed.columns;
        const cols = [c.date, c.time, c.weight, c.fat].filter(Boolean).map((x) => `„${x}“`).join(", ");
        preview = `
          <div style="margin-top:12px"><b>${esc(imp.name)}</b></div>
          <div class="hint">${esc(t.importPreview(rows.length, this._date(rows[0].ts), this._date(rows[rows.length - 1].ts), imp.parsed.skipped))}</div>
          <div class="hint">${esc(t.importColumns(cols))}</div>
          <div class="actions" style="align-items:center">
            <label class="muted small">${esc(t.importTarget)}
              <select class="inline" id="import-target">${targets.map((o) => `<option value="${esc(o.value)}" ${o.value === imp.target ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select></label>
            <button class="btn primary" data-action="import-run" ${imp.busy ? "disabled" : ""}>${esc(t.importButton)}</button>
            <button class="btn" data-action="import-cancel">${esc(t.cancel)}</button>
          </div>`;
      }
    }
    return `
        <div class="hint">${esc(t.importExportHint)}</div>
        <div class="actions">
          <button class="btn" data-action="export-csv">${esc(t.exportCsv)}</button>
          ${targets.length ? `<label class="btn file-btn">${esc(t.importCsv)}<input type="file" accept=".csv,.txt,text/csv" data-action="import-file"></label>` : ""}
        </div>
        ${preview}`;
  }

  _exportCsv() {
    const quote = (v) => (v === null || v === undefined ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const iso = (ts) => { const d = new Date(ts); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
    const lines = [["type", "name", "date", "weight_kg", "trend_kg", "body_fat_pct", "note", "clothes_kg"].join(",")];
    for (const person of this._entry.persons) {
      const fat = new Map(((person.body && person.body.history) || []).map(([ts, f]) => [ts, f]));
      for (const m of this._assigned(person.id)) {
        lines.push(["person", person.name, iso(m.ts), Math.round(this._w(m) * 100) / 100, m.trend ?? "", fat.get(m.ts) ?? "", m.note || "", m.clothes_kg ?? ""].map(quote).join(","));
      }
    }
    for (const m of this._entry.pet_measurements || []) {
      const pet = this._pet(m.pet_id);
      lines.push(["pet", pet ? pet.name : "", iso(m.ts), m.weight, m.trend ?? "", "", m.note || ""].map(quote).join(","));
    }
    const blob = new Blob([lines.join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `weight-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  async _runImport() {
    const imp = this._import;
    const target = (this.shadowRoot.getElementById("import-target") || {}).value || imp.target;
    const [kind, id] = target.split(":");
    imp.busy = true;
    this._render();
    let added = 0, skipped = 0;
    try {
      for (let i = 0; i < imp.parsed.rows.length; i += 2000) {
        const res = await this._ws({ type: "weight_tracker/import", [kind === "pet" ? "pet_id" : "person_id"]: id, rows: imp.parsed.rows.slice(i, i + 2000) });
        added += res.added; skipped += res.skipped;
      }
      this._import = null;
      this._toast(this._t.importDone(added, skipped));
    } catch (err) {
      imp.busy = false;
      this._toast(`${this._t.error}: ${this._errorText(err)}`);
    }
    this._render();
  }

  _noteEditRow(kind, m) {
    if (!this._editNote || this._editNote.kind !== kind || this._editNote.id !== m.id) return "";
    const t = this._t;
    return `<tr><td colspan="6"><div class="note-edit">
      <input type="text" maxlength="200" id="note-input" value="${esc(this._editNote.draft ?? m.note ?? "")}" placeholder="${esc(t.notePlaceholder)}" aria-label="${esc(t.note)}">
      <button class="btn primary" data-action="note-save" data-kind="${kind}" data-id="${esc(m.id)}">${esc(t.save)}</button>
      <button class="btn" data-action="note-cancel">${esc(t.cancel)}</button>
    </div></td></tr>`;
  }

  _personOf(m) {
    return this._entry.persons.find((p) => p.id === m.person_id);
  }

  _canEdit(m) {
    if (this._isAdmin) return true;
    if (m.status === "pending") return true; // server only sends plausible ones
    const person = this._personOf(m);
    return m.status === "assigned" && Boolean(person && person.can_manage);
  }

  _canDelete(m) {
    if (this._isAdmin) return true;
    const person = this._personOf(m);
    return m.status === "assigned" && Boolean(person && person.can_manage);
  }

  _renderPersonCell(m) {
    const t = this._t;
    const person = this._personOf(m);
    const dot = m.status === "assigned"
      ? `<span class="dot" style="background:${this._personColor(m.person_id)}"></span>`
      : `<span class="dot" style="box-shadow:inset 0 0 0 2px var(--wt-muted)"></span>`;
    if (!this._canEdit(m)) {
      return `<span class="who">${dot}${esc(person ? person.name : "–")}</span>`;
    }
    const targets = this._entry.persons.filter((p) => this._isAdmin || p.can_manage);
    const options = [];
    if (m.status === "pending") options.push(`<option value="" selected>${esc(t.open)} …</option>`);
    for (const p of targets) {
      options.push(`<option value="${esc(p.id)}" ${m.status === "assigned" && m.person_id === p.id ? "selected" : ""}>${esc(p.name)}</option>`);
    }
    if (m.status !== "pending") {
      options.push(`<option value="pending">${esc(this._isAdmin ? t.pendingOption : t.notMine)}</option>`);
    }
    if (this._isAdmin || m.status === "assigned") {
      options.push(`<option value="discard" ${m.status === "discarded" ? "selected" : ""}>${esc(t.discard)}</option>`);
    }
    return `<span class="who">${dot}<select class="inline" data-action="reassign" data-id="${esc(m.id)}" aria-label="${esc(t.person)}">${options.join("")}</select></span>`;
  }

  _renderAccess() {
    const t = this._t;
    const persons = this._entry.persons;
    const users = this._data.users || [];
    const cell = (user, person) => {
      const value = person.user_id === user.id ? "owner" : (person.viewers || []).includes(user.id) ? "view" : "none";
      return `<select class="inline" data-action="access" data-person="${esc(person.id)}" data-user="${esc(user.id)}" aria-label="${esc(`${user.name} – ${person.name}`)}">
        <option value="none" ${value === "none" ? "selected" : ""}>${esc(user.is_admin ? t.accAdmin : t.accNone)}</option>
        ${user.is_admin ? "" : `<option value="view" ${value === "view" ? "selected" : ""}>${esc(t.accView)}</option>`}
        <option value="owner" ${value === "owner" ? "selected" : ""}>${esc(t.accOwner)}</option>
      </select>`;
    };
    return this._section("access", "mdi:shield-account", "🔒", t.access, `
        <div class="muted small">${esc(t.accessHint)}</div>
        <div class="table-wrap"><table>
          <thead><tr><th>${esc(t.user)}</th>${persons.map((p) => `<th><span class="who"><span class="dot" style="background:${this._color(p.color_index)}"></span>${esc(p.name)}</span></th>`).join("")}</tr></thead>
          <tbody>
            ${users.map((u) => `<tr><td>${esc(u.name)} ${u.is_admin ? `<span class="tag">· ${esc(t.admin)}</span>` : ""}</td>${persons.map((p) => `<td>${cell(u, p)}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table></div>`);
  }

  // ---------------------------------------------------------------- forms

  // Field definition: { name, label, helper, required, wide, kind, selector, ... }
  _def(kind, name, label, opts = {}) {
    const def = { kind, name, label, ...opts };
    if (kind === "text") def.selector = { text: opts.multiline ? { multiline: true } : {} };
    if (kind === "number") {
      def.selector = { number: { min: opts.min ?? 0, max: opts.max ?? 500, step: opts.step ?? 0.1, mode: "box", unit_of_measurement: opts.unit } };
    }
    if (kind === "entity") def.selector = { entity: { filter: opts.filter } };
    if (kind === "select") def.selector = { select: { options: opts.options, mode: "dropdown" } };
    if (kind === "multi") def.selector = { select: { options: opts.options, multiple: true, mode: "list" } };
    if (kind === "boolean") def.selector = { boolean: {} };
    if (kind === "datetime") def.selector = { datetime: {} };
    if (kind === "date") def.selector = { date: {} };
    // "birthmonth": month + year fields instead of a calendar where you would
    // have to click back month by month.
    return def;
  }

  // Register a form for this render and return the placeholders for its fields.
  _formFields(formId, fields, defaults) {
    if (!this._dirty.has(formId) || !this._models[formId]) this._models[formId] = { ...defaults };
    this._forms[formId] = fields;
    return `<div class="fields">${fields.map((f) => `<div class="field ${f.wide ? "wide" : ""}" data-form="${esc(formId)}" data-field="${esc(f.name)}"></div>`).join("")}</div>
      ${this._formErrors[formId] ? `<div class="form-error" role="alert">${esc(this._formErrors[formId])}</div>` : ""}`;
  }

  _mountFields() {
    for (const host of this.shadowRoot.querySelectorAll(".field[data-field]")) {
      const formId = host.dataset.form;
      const def = (this._forms[formId] || []).find((f) => f.name === host.dataset.field);
      if (!def) continue;
      const value = this._models[formId][def.name];
      if (def.kind === "birthmonth" || def.kind === "fulldate") host.appendChild(this._birthMonthField(formId, def, value, def.kind === "fulldate"));
      else host.appendChild(this._haReady ? this._haField(formId, def, value) : this._nativeField(formId, def, value));
    }
  }

  _setValue(formId, def, value) {
    (this._models[formId] = this._models[formId] || {})[def.name] = value;
    this._dirty.add(formId);
    if (def.onChange) def.onChange(value);
  }

  // Number fields in kg are shown and read in the chosen display unit.
  _converted(def) {
    if (def.kind !== "number" || def.unit !== "kg" || this._factor === 1) return null;
    const f = this._factor;
    const round = (v) => Math.round(v * 10) / 10;
    return {
      unit: "lb",
      toDisplay: (v) => (v === null || v === undefined || v === "" ? v : round(Number(v) * f)),
      fromDisplay: (v) => (typeof v === "number" && !Number.isNaN(v) ? v / f : v),
      selector: { number: { ...def.selector.number, min: round(def.selector.number.min * f), max: round(def.selector.number.max * f), unit_of_measurement: "lb" } },
    };
  }

  _haField(formId, def, value) {
    const conv = this._converted(def);
    if (conv) {
      value = conv.toDisplay(value);
      const inner = def;
      def = { ...def, selector: conv.selector, onChange: inner.onChange, _from: conv.fromDisplay };
    }
    const el = document.createElement("ha-selector");
    el.hass = this._hass;
    el.selector = def.selector;
    // Labels above every field (some HA fields put them inside, some above),
    // so all fields of a row line up. Switches keep their own label.
    const outside = def.kind !== "boolean";
    el.label = outside ? "" : def.label;
    if (def.helper) el.helper = def.helper;
    el.required = Boolean(def.required);
    el.value = value === null ? undefined : value;
    el.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      // <ha-selector> is controlled: it only shows what is in .value, so the
      // new value has to be handed back (otherwise e.g. a select stays empty).
      el.value = ev.detail.value;
      this._setValue(formId, def, def._from ? def._from(ev.detail.value) : ev.detail.value);
    });
    if (!outside) return el;
    const box = document.createElement("div");
    box.innerHTML = `<div class="flabel">${esc(def.label)}${def.required ? " *" : ""}</div>`;
    box.append(el);
    return box;
  }

  _birthMonthField(formId, def, value, withDay = false) {
    const t = this._t;
    const model = this._models[formId];
    const partsKey = `${def.name}:parts`;
    if (!model[partsKey]) {
      const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(value || "");
      model[partsKey] = { d: match && match[3] ? String(Number(match[3])) : "", m: match ? String(Number(match[2])) : "", y: match ? Number(match[1]) : null };
    }
    const parts = model[partsKey];
    const box = document.createElement("div");
    const ageHtml = () => {
      const age = this._age(model[def.name] && model[def.name] !== "invalid" ? model[def.name] : null);
      return age === null ? `<b>–</b><span>${esc(t.age)}</span>` : `<b>${age}</b><span>${esc(t.years(age).replace(/^\d+\s*/, ""))}</span>`;
    };
    const update = (key, v) => {
      parts[key] = v === undefined || v === null ? (key === "y" ? null : "") : v;
      const { d, m, y } = parts;
      let result;
      if (!m && !y && (!withDay || !d)) result = null;
      else if (!m || !y || (withDay && !d)) result = "invalid";
      else if (withDay) {
        const date = new Date(Number(y), Number(m) - 1, Number(d));
        const valid = date.getMonth() === Number(m) - 1 && date.getDate() === Number(d) && Number(y) >= 1990 && date <= new Date();
        result = valid ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : "invalid";
      } else {
        const now = new Date();
        const valid = Number(y) >= 1900 && (Number(y) < now.getFullYear() || (Number(y) === now.getFullYear() && Number(m) <= now.getMonth() + 1));
        result = valid ? `${y}-${String(m).padStart(2, "0")}` : "invalid";
      }
      this._setValue(formId, def, result);
      box.querySelector(".bd-age").innerHTML = ageHtml();
    };
    const monthName = (i) => new Intl.DateTimeFormat(this._lang, { month: "long" }).format(new Date(2000, i, 1));
    const months = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(i) }));
    const days = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
    const sub = [
      ...(withDay ? [["d", this._def("select", `${def.name}-d`, t.day, { options: days }), parts.d]] : []),
      ["m", this._def("select", `${def.name}-m`, t.month2, { options: months }), parts.m],
      ["y", this._def("number", `${def.name}-y`, t.year, { min: 1900, max: new Date().getFullYear(), step: 1 }), parts.y],
    ];
    box.innerHTML = `<div class="bd-label">${esc(def.label)}</div><div class="bd-row"></div>${def.helper ? `<div class="hint" style="margin-top:4px">${esc(def.helper)}</div>` : ""}`;
    const row = box.querySelector(".bd-row");
    for (const [key, subDef, current] of sub) {
      const proxyForm = `${formId}::${key}`;
      this._models[proxyForm] = {};
      subDef.onChange = (v) => update(key, v);
      row.appendChild(this._haReady ? this._haField(proxyForm, subDef, current || undefined) : this._nativeField(proxyForm, subDef, current));
    }
    if (withDay) {
      row.style.gridTemplateColumns = "minmax(0, 0.8fr) minmax(0, 1.6fr) minmax(0, 1.1fr)";
      return box;  // children: age is shown on their card
    }
    const age = document.createElement("div");
    age.className = "bd-age";
    age.setAttribute("aria-live", "polite");
    age.innerHTML = ageHtml();
    row.appendChild(age);
    return box;
  }

  _entityMatches(st, filter) {
    const filters = Array.isArray(filter) ? filter : [filter || {}];
    const domain = st.entity_id.split(".")[0];
    return filters.some((f) => {
      const domains = f.domain ? [].concat(f.domain) : null;
      const classes = f.device_class ? [].concat(f.device_class) : null;
      return (!domains || domains.includes(domain)) && (!classes || classes.includes(st.attributes.device_class));
    });
  }

  // Plain HTML fallback with the same behavior.
  _nativeField(formId, def, value) {
    const t = this._t;
    const conv = this._converted(def);
    if (conv) {
      value = conv.toDisplay(value);
      def = { ...def, unit: conv.unit, _from: conv.fromDisplay };
    }
    const wrap = document.createElement("label");
    const helper = def.helper ? `<span class="hint">${esc(def.helper)}</span>` : "";
    const label = `${esc(def.label)}${def.required ? " *" : ""}`;
    const set = (v) => this._setValue(formId, def, v);
    if (def.kind === "boolean") {
      wrap.className = "check";
      wrap.innerHTML = `<input type="checkbox" ${value ? "checked" : ""}>${label}`;
      wrap.querySelector("input").addEventListener("change", (ev) => set(ev.target.checked));
      if (!def.helper) return wrap;
      const box = document.createElement("div");
      box.append(wrap);
      box.insertAdjacentHTML("beforeend", `<div class="hint" style="margin-top:4px">${esc(def.helper)}</div>`);
      return box;
    }
    if (def.kind === "multi") {
      const box = document.createElement("div");
      const selected = value || [];
      box.innerHTML = `<div class="hint" style="margin-bottom:6px">${label}</div>
        <div class="checks">${def.options.length ? def.options.map((o) => `<label class="check"><input type="checkbox" value="${esc(o.value)}" ${selected.includes(o.value) ? "checked" : ""}>${esc(o.label)}</label>`).join("") : `<span class="hint">${esc(t.noOtherUsers)}</span>`}</div>${helper}`;
      box.addEventListener("change", () => set([...box.querySelectorAll("input:checked")].map((i) => i.value)));
      return box;
    }
    let control;
    if (def.kind === "entity" || def.kind === "select") {
      let options = def.options;
      if (def.kind === "entity") {
        const states = Object.values(this._hass.states || {}).filter((st) => this._entityMatches(st, def.filter));
        if (value && !states.some((st) => st.entity_id === value)) states.push({ entity_id: value, attributes: {} });
        options = states
          .map((st) => ({ value: st.entity_id, label: `${st.attributes.friendly_name || st.entity_id} (${st.entity_id})` }))
          .sort((a, b) => a.label.localeCompare(b.label));
      }
      control = `<select>${def.required ? "" : `<option value="">${esc(def.emptyLabel || t.none)}</option>`}${options.map((o) => `<option value="${esc(o.value)}" ${o.value === value ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`;
    } else if (def.kind === "number") {
      // text instead of type=number: accepts "75,5" and "75.5" in every browser
      const shown = value === null || value === undefined ? "" : String(value).replace(".", this._lang.startsWith("de") ? "," : ".");
      control = `<input type="text" inputmode="decimal" autocomplete="off" value="${esc(shown)}">`;
    } else if (def.kind === "datetime") {
      control = `<input type="datetime-local" value="${esc(String(value || "").replace(" ", "T").slice(0, 16))}">`;
    } else if (def.kind === "date") {
      control = `<input type="date" value="${esc(value || "")}">`;
    } else if (def.multiline) {
      control = `<textarea rows="10">${esc(value ?? "")}</textarea>`;
    } else {
      control = `<input type="text" value="${esc(value ?? "")}">`;
    }
    wrap.innerHTML = `${label}${def.unit ? ` (${esc(def.unit)})` : ""}${control}${helper}`;
    const input = wrap.querySelector("input, select, textarea");
    input.addEventListener(input.tagName === "SELECT" ? "change" : "input", () => {
      const raw = input.value;
      if (def.kind === "number") {
        const text = raw.trim().replace(",", ".");
        const parsed = text === "" ? null : /^-?\d+(\.\d+)?$/.test(text) ? parseFloat(text) : NaN;
        set(def._from && typeof parsed === "number" ? def._from(parsed) : parsed);
      } else if (def.kind === "datetime") {
        set(raw ? `${raw.replace("T", " ")}:00`.slice(0, 19) : null);
      } else {
        set(raw === "" && def.kind !== "text" ? null : raw);
      }
    });
    return wrap;
  }

  _validate(formId) {
    const t = this._t;
    const model = this._models[formId];
    for (const def of this._forms[formId] || []) {
      const value = model[def.name];
      const empty = value === null || value === undefined || value === "" || (typeof value === "string" && !value.trim());
      if (def.required && empty) return t.required(def.label);
      if (def.kind === "number" && !empty && Number.isNaN(Number(value))) return t.invalidNumber(def.label);
      if ((def.kind === "birthmonth" || def.kind === "fulldate") && value === "invalid") return t.invalidDate(def.label);
    }
    return null;
  }

  _formActions(formId, extra = "") {
    return `<div class="actions"><button class="btn primary" type="button" data-action="save-form" data-form="${esc(formId)}">${esc(this._t.save)}</button>${extra}</div>`;
  }

  _nowString() {
    const pad = (n) => String(n).padStart(2, "0");
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  }

  // Collapsible settings section (like the sections of HA's own settings pages).
  _section(id, icon, emoji, title, body, { open = false, count = null } = {}) {
    const isOpen = open || this._openSections.has(id);
    const iconHtml = customElements.get("ha-icon") ? `<ha-icon icon="${icon}"></ha-icon>` : emoji;
    return `
      <details class="section" data-section="${esc(id)}" ${isOpen ? "open" : ""}>
        <summary><span class="sec-icon" aria-hidden="true">${iconHtml}</span><span class="sec-title">${esc(title)}${count !== null ? ` <span class="sec-count">· ${count}</span>` : ""}</span><span class="sec-chevron" aria-hidden="true"></span></summary>
        <div class="sec-body">${body}</div>
      </details>`;
  }

  _onSectionToggle(ev) {
    const el = ev.target;
    if (!(el instanceof HTMLElement) || !el.matches("details.section")) return;
    const id = el.dataset.section;
    if (el.open === this._openSections.has(id)) return;
    if (el.open) this._openSections.add(id); else this._openSections.delete(id);
    try {
      localStorage.setItem("wt-sections", JSON.stringify([...this._openSections]));
    } catch (err) {
      // only a convenience
    }
  }

  _renderSettings() {
    return `${this._renderScaleSettings()}${this._renderPersonsSettings()}${this._renderPetsSettings("child")}${this._renderPetsSettings("pet")}${this._entry.persons.length ? this._renderAccess() : ""}${this._renderSensorSettings()}`;
  }

  _renderScaleSettings() {
    const t = this._t;
    const cfg = this._entry.settings || {};
    const states = Object.values(this._hass.states || {});
    const current = this._hass.states && this._hass.states[cfg.source_entity];
    const hasWeightSensors = states.some((st) => st.entity_id.startsWith("sensor.") && st.attributes.device_class === "weight");
    // Prefer real weight sensors; show all sensors if the scale lacks a device class.
    const filter = hasWeightSensors && (!current || current.attributes.device_class === "weight")
      ? { domain: "sensor", device_class: "weight" }
      : { domain: "sensor" };
    const fields = [
      this._def("text", "name", t.name, { required: true }),
      this._def("number", "min_weight", t.minWeight, { required: true, min: 1, max: 300, step: 0.5, unit: "kg", helper: t.minWeightHint }),
      this._def("number", "max_weight", t.maxWeight, { required: true, min: 1, max: 500, step: 0.5, unit: "kg" }),
      this._def("number", "tolerance", t.tolerance, { required: true, min: 0.5, max: 20, step: 0.1, unit: "kg", helper: t.toleranceHint }),
      this._def("number", "ambiguity_margin", t.margin, { required: true, min: 0.1, max: 10, step: 0.1, unit: "kg", helper: t.marginHint }),
      this._def("number", "debounce_seconds", t.debounce, { required: true, min: 0, max: 120, step: 1, unit: "s", helper: t.debounceHint }),
    ];
    const sensors = [
      this._def("entity", "source_entity", t.source, { required: true, filter, onChange: (id) => this._suggestScaleSensors(id) }),
      this._def("entity", "stable_entity", t.stableEntity, { filter: { domain: "binary_sensor" }, helper: t.stableHint }),
      this._def("entity", "impedance_entity", t.impedanceEntity, { filter: { domain: "sensor" }, helper: t.impedanceHint }),
      this._def("entity", "impedance_high_entity", t.impedanceHighEntity, { filter: { domain: "sensor" }, helper: t.impedanceHighHint }),
      this._def("entity", "heart_rate_entity", t.heartRateEntity, { filter: { domain: "sensor" }, helper: t.heartRateHint }),
      this._def("select", "body_model", t.bodyModel, { required: true, options: Object.entries(t.bodyModels).map(([value, label]) => ({ value, label })), helper: t.bodyModelHint, wide: true }),
      this._def("entity", "body_fat_entity", t.bodyFatEntity, { filter: { domain: "sensor" }, helper: t.bodyFatEntityHint }),
      this._def("entity", "muscle_mass_entity", t.muscleEntity, { filter: { domain: "sensor" }, helper: t.directHint }),
      this._def("entity", "water_entity", t.waterEntity, { filter: { domain: "sensor" }, helper: t.directHint }),
      this._def("entity", "bone_mass_entity", t.boneEntity, { filter: { domain: "sensor" }, helper: t.directHint }),
      this._def("entity", "bmr_entity", t.bmrEntity, { filter: { domain: "sensor" }, helper: t.directHint }),
    ];
    const defaults = { name: this._entry.title, ...cfg };
    // Sensors of the scale that exist but are not set up yet (e.g. heart rate added later).
    const suggestions = this._scaleSuggestions(cfg.source_entity, { ...cfg, ...(this._models["scale-sensors-form"] || {}) });
    const suggestionLabels = { stable_entity: t.stableEntity, impedance_entity: t.impedanceEntity, impedance_high_entity: t.impedanceHighEntity, heart_rate_entity: t.heartRateEntity };
    const suggestionBox = Object.keys(suggestions).length ? `
        <div class="suggest-box" role="status">
          <div><b>${esc(t.scaleSuggestTitle)}</b>
            <div class="hint">${esc(t.scaleSuggestText(Object.entries(suggestions).map(([key, id]) => `${suggestionLabels[key]} (${(this._hass.states[id] && this._hass.states[id].attributes.friendly_name) || id})`).join(", ")))}</div></div>
          <button class="btn primary" type="button" data-action="scale-suggest">${esc(t.scaleSuggestApply)}</button>
        </div>` : "";
    return this._section("scale", "mdi:scale-bathroom", "⚖️", t.scale, `
        <div class="hint">${esc(t.scaleHint)}</div>
        <div class="form" id="settings-form">
          ${this._formFields("settings-form", fields, defaults)}
          ${this._formActions("settings-form")}
        </div>`) + this._section("scale-sensors", "mdi:access-point", "📡", t.scaleSensors, `
        <div class="hint">${esc(t.scaleSensorsHint)}</div>
        ${suggestionBox}
        <div class="form" id="scale-sensors-form">
          ${this._formFields("scale-sensors-form", sensors, defaults)}
          ${this._formActions("scale-sensors-form")}
        </div>`, { open: !cfg.source_entity || Boolean(suggestionBox) }) + this._section("ai", "mdi:robot-outline", "🤖", t.aiSection, `
        <div class="hint">${esc(t.aiSectionHint)}</div>
        <div class="form" id="ai-settings-form">
          ${this._formFields("ai-settings-form", [
            this._def("entity", "ai_task_entity", t.aiEntity, { filter: { domain: "ai_task" }, helper: t.aiEntityHint, wide: true }),
            this._def("text", "ai_prompt", t.aiPrompt, { multiline: true, helper: t.aiPromptHint, wide: true }),
          ], { ...defaults, ai_prompt: cfg.ai_prompt || cfg.ai_prompt_default || "" })}
          ${this._formActions("ai-settings-form", `<button class="btn" type="button" data-action="ai-prompt-reset" ${(this._models["ai-settings-form"] || {}).ai_prompt === cfg.ai_prompt_default ? "disabled" : ""}>${esc(t.aiPromptReset)}</button>`)}
        </div>`);
  }

  // After picking the weight sensor: fill in "stabilized" and impedance from the
  // same device (e.g. Xiaomi scales), if those fields are still empty.
  // Sensors on the scale's own device that fit fields still empty in `current`
  // ("stabilized", both impedances, heart rate), as {setting key: entity id}.
  _scaleSuggestions(sourceId, current) {
    const registry = (this._hass && this._hass.entities) || {};
    const device = sourceId && registry[sourceId] && registry[sourceId].device_id;
    if (!device) return {};
    const siblings = Object.keys(registry).filter((id) => id !== sourceId && registry[id].device_id === device && !registry[id].disabled_by);
    const impedance = siblings.filter((id) => id.startsWith("sensor.") && /impedanc/i.test(id));
    const low = impedance.find((id) => /low/i.test(id)) || impedance.find((id) => !/high/i.test(id));
    const high = impedance.find((id) => /high/i.test(id) && id !== low);
    const used = new Set(["stable_entity", "impedance_entity", "impedance_high_entity", "heart_rate_entity"].map((key) => current[key]).filter(Boolean));
    const found = {};
    for (const [key, id] of [
      ["stable_entity", siblings.find((e) => e.startsWith("binary_sensor.") && /stabili[sz]/i.test(e))],
      ["impedance_entity", low || high],
      ["impedance_high_entity", low ? high : null],
      ["heart_rate_entity", siblings.find((e) => e.startsWith("sensor.") && /heart|herz|puls/i.test(e))],
    ]) {
      if (id && !current[key] && !used.has(id)) found[key] = id;
    }
    return found;
  }

  // After picking the weight sensor: fill in the matching sensors of the same device.
  _suggestScaleSensors(sourceId) {
    const model = this._models["scale-sensors-form"];
    const found = this._scaleSuggestions(sourceId, { ...(this._entry.settings || {}), ...model });
    if (!Object.keys(found).length) return;
    Object.assign(model, found);
    this._render();
  }

  _renderPersonsSettings() {
    const t = this._t;
    const users = this._data.users || [];
    const userName = (id) => (users.find((u) => u.id === id) || {}).name;
    const counts = {};
    for (const m of this._entry.measurements) if (m.person_id) counts[m.person_id] = (counts[m.person_id] || 0) + 1;
    const rows = this._entry.persons.map((p) => {
      if (this._editPerson === p.id) return this._renderPersonEditor(p);
      const bits = [
        `${t.start} ${this._kg(p.start_weight)}`,
        p.height ? `${this._kg(p.height, { unit: false, digits: 0 })} cm` : null,
        p.goal ? `${t.goal} ${this._kg(p.goal)}` : null,
        p.user_id ? `👤 ${userName(p.user_id) || "?"}` : null,
        t.count(counts[p.id] || 0),
        (p.sensors || []).length ? (this._sensorCount(p) ? t.sensorsFound(this._sensorCount(p)) : t.sensorsMissing) : null,
      ].filter(Boolean);
      return `
        <div class="person-row">
          ${this._avatar(p, 32)}
          <div class="info"><b>${esc(p.name)}</b><div class="hint">${esc(bits.join(" · "))}</div></div>
          <button class="btn" data-action="edit-person" data-person="${esc(p.id)}">${esc(t.edit)}</button>
        </div>`;
    }).join("");
    return this._section("persons", "mdi:account-multiple", "👥", t.persons, `
        <div class="hint">${esc(t.personsHint)}</div>
        <div style="margin-top:8px">${rows}</div>
        ${this._editPerson === "new" ? this._renderPersonEditor(null) : `<div class="actions"><button class="btn primary" data-action="edit-person" data-person="new">＋ ${esc(t.addPerson)}</button></div>`}`,
      { open: !this._entry.persons.length || Boolean(this._editPerson), count: this._entry.persons.length || null });
  }

  _renderPersonEditor(person) {
    const t = this._t;
    const p = person || {};
    const id = person ? person.id : "new";
    const formId = `person-form-${id}`;
    const users = this._data.users || [];
    const defaults = {
      name: p.name || "",
      start_weight: p.start_weight ?? null,
      height: p.height ?? null,
      goal_weight: p.goal ?? null,
      birth_month: p.birth_month || null,
      sex: p.sex || "",
      person_entity: p.person_entity || null,
      user_id: p.user_id || null,
      viewers: p.viewers || [],
      notify_service: (p.notify && p.notify.service) || "",
    };
    // Build the model first so the viewer list can exclude the chosen user.
    if (!this._dirty.has(formId) || !this._models[formId]) this._models[formId] = { ...defaults };
    const owner = this._models[formId].user_id;
    const viewerOptions = users
      .filter((u) => !u.is_admin && u.id !== owner)
      .map((u) => ({ value: u.id, label: u.name }));
    const fields = [
      this._def("text", "name", t.name, { required: true }),
      this._def("number", "start_weight", t.startWeight, { required: true, min: 1, max: 300, step: 0.1, unit: "kg", helper: t.startWeightHint }),
      this._def("number", "height", t.height, { min: 50, max: 250, step: 1, unit: "cm", helper: t.heightHint }),
      this._def("number", "goal_weight", t.goalWeight, { min: 1, max: 300, step: 0.1, unit: "kg", helper: t.goalWeightHint }),
      this._def("select", "sex", t.sex, { options: Object.entries(t.sexNames).map(([value, label]) => ({ value, label })), emptyLabel: t.sexNone }),
      this._def("entity", "person_entity", t.presence, { filter: { domain: "person" }, helper: t.presenceHint }),
      this._def("birthmonth", "birth_month", t.birthDate, { helper: t.birthDateHint, wide: true }),
      this._def("select", "user_id", t.linkedUser, {
        options: users.map((u) => ({ value: u.id, label: u.is_admin ? `${u.name} (${t.admin})` : u.name })),
        helper: t.linkedUserHint,
        onChange: (value) => {
          const model = this._models[formId];
          model.viewers = (model.viewers || []).filter((v) => v !== value);
          this._render(); // refresh the viewer list
        },
      }),
      this._def("select", "notify_service", t.notifyDevice, { options: this._notifyServices(), emptyLabel: t.notifyNone, helper: t.notifyDeviceAdminHint }),
      this._def("multi", "viewers", t.viewers, { options: viewerOptions, helper: t.viewersHint, wide: true }),
    ];
    const count = this._entry.measurements.filter((m) => m.person_id === id).length;
    const extra = `
      <button class="btn" type="button" data-action="cancel-edit" data-form="${esc(formId)}">${esc(t.cancel)}</button>
      <span class="spacer"></span>
      ${person ? `<button class="btn danger" type="button" data-action="delete-person" data-person="${esc(id)}" data-count="${count}">${esc(t.deletePerson)}</button>` : ""}`;
    return `
      <div class="form editor" id="${esc(formId)}" data-person="${esc(id)}">
        <h3>${person ? `<span class="dot" style="background:${this._color(p.color_index)}"></span>${esc(p.name)}` : esc(t.newPerson)}</h3>
        ${this._formFields(formId, fields, defaults)}
        ${this._formActions(formId, extra)}
      </div>`;
  }

  _sensorKeys(kind) {
    const base = ["weight", "trend", "change_last", "change_7d", "change_30d", "change_total", "rate"];
    if (kind !== "person") return [...base, "goal_distance", "goal_eta", "last_measured"];
    const cfg = this._entry.settings || {};
    const impedance = cfg.impedance_entity || cfg.impedance_high_entity;
    const direct = { body_fat: cfg.body_fat_entity, muscle_mass: cfg.muscle_mass_entity, body_water: cfg.water_entity, bone_mass: cfg.bone_mass_entity, bmr: cfg.bmr_entity };
    const body = Object.keys(direct).filter((key) => impedance || direct[key]);
    if (impedance) body.push("body_score", "visceral_fat", "protein", "metabolic_age", "skeletal_muscle");
    if (cfg.heart_rate_entity) body.push("heart_rate");
    // values derived from weight, height, age (and impedance / pulse if the scale provides them)
    if (impedance || cfg.body_fat_entity) body.push("fat_mass", "lean_mass");
    if (impedance || cfg.water_entity) body.push("water_mass");
    body.push("ponderal_index", "bsa", "broca_weight", "bmr_mifflin", "tdee", "hr_max");
    if (impedance) body.push("bmr_katch", "impedance_index");
    if (cfg.heart_rate_entity) body.push("hr_reserve", "vo2max", "zone_health", "zone_fat_burn", "zone_aerobic", "zone_anaerobic");
    return [...base, "bmi", "goal_distance", "goal_eta", "last_measured", ...body];
  }

  _renderSensorSettings() {
    const t = this._t;
    const subjects = [
      ...this._entry.persons.map((p) => ({ kind: "person", s: p, icon: this._avatar(p, 28) })),
      ...(this._entry.pets || []).map((p) => ({ kind: "pet", s: p, icon: `<span style="font-size:20px">${this._emoji(p)}</span>` })),
    ];
    if (!subjects.length) return "";
    const rows = subjects.map(({ kind, s, icon }) => {
      const keys = this._sensorKeys(kind);
      const available = new Set(this._availableSensorKeys(kind, s));
      const chosen = new Set((s.sensors || []).filter((key) => available.has(key)));
      const needs = (key) => {
        const missing = this._sensorMissing(kind, s, key);
        return missing.length ? t.sensorNeeds(missing.map((f) => t.sensorNeedFields[f]).join(", ")) : "";
      };
      const found = this._sensorCount(s);
      return `
        <div class="person-row" style="align-items:flex-start">
          ${icon}
          <div class="info">
            <b>${esc(s.name)}</b>
            ${chosen.size ? `<div class="hint">${esc(found ? t.sensorsFound(found) : t.sensorsMissing)}</div>` : ""}
            <div class="checks" style="margin-top:8px">${keys.filter((key) => available.has(key)).map((key) => `
              <label class="check"><input type="checkbox" data-action="sensor-toggle" data-kind="${kind}" data-id="${esc(s.id)}" data-key="${key}" ${chosen.has(key) ? "checked" : ""}>
                ${esc(t.sensorLabels[key])}</label>`).join("")}</div>
            ${Object.entries(keys.filter((key) => !available.has(key)).reduce((groups, key) => {
              (groups[needs(key)] = groups[needs(key)] || []).push(t.sensorLabels[key]);
              return groups;
            }, {})).map(([reason, labels]) => `<div class="hint" style="margin-top:6px">${esc(reason.charAt(0).toUpperCase() + reason.slice(1))}: ${esc(labels.join(", "))}</div>`).join("")}
          </div>
          <div class="chips" style="flex:none">
            <button class="chip" data-action="sensor-all" data-kind="${kind}" data-id="${esc(s.id)}">${esc(t.sensorAll)}</button>
            <button class="chip" data-action="sensor-none" data-kind="${kind}" data-id="${esc(s.id)}">${esc(t.sensorNone)}</button>
          </div>
        </div>`;
    }).join("");
    return this._section("output-sensors", "mdi:chart-line", "📈", t.sensorSettings, `
        <div class="hint">${esc(t.sensorSettingsHint)}</div>
        <div class="hint" style="margin-top:4px">${esc(t.sensorsHint)}</div>
        <div style="margin-top:8px">${rows}</div>`);
  }

  // Profile fields a sensor needs for this person/pet (missing ones are listed).
  _sensorMissing(kind, s, key) {
    const cfg = this._entry.settings || {};
    const impedance = cfg.impedance_entity || cfg.impedance_high_entity;
    const direct = { body_fat: cfg.body_fat_entity, muscle_mass: cfg.muscle_mass_entity, body_water: cfg.water_entity, bone_mass: cfg.bone_mass_entity, bmr: cfg.bmr_entity };
    let fields = [];
    if (key === "bmi" || key === "ponderal_index" || key === "bsa" || key === "impedance_index") fields = ["height"];
    else if (key === "broca_weight") fields = ["height", "sex"];
    else if (key === "bmr_mifflin" || key === "tdee") fields = ["height", "birth_month", "sex"];
    else if (["hr_max", "hr_reserve", "vo2max"].includes(key) || key.startsWith("zone_")) fields = ["birth_month"];
    else if (key === "goal_distance" || key === "goal_eta") fields = ["goal"];
    else if (kind === "person" && (key in direct || ["body_score", "visceral_fat", "protein", "metabolic_age", "skeletal_muscle", "fat_mass", "lean_mass", "water_mass", "bmr_katch"].includes(key))) {
      // values the scale reports itself need no profile data
      fields = !impedance && direct[key] ? [] : ["height", "birth_month", "sex"];
    }
    return fields.filter((f) => !s[f]);
  }

  _availableSensorKeys(kind, s) {
    return this._sensorKeys(kind).filter((key) => !this._sensorMissing(kind, s, key).length);
  }

  _subjectById(kind, id) {
    return kind === "person" ? this._entry.persons.find((p) => p.id === id) : (this._entry.pets || []).find((p) => p.id === id);
  }

  async _saveSensors(kind, id, sensors) {
    try {
      // "id" is taken by the websocket message number, hence subject_id
      await this._ws({ type: "weight_tracker/set_sensors", kind, subject_id: id, sensors });
      this._toast(this._t.saved);
    } catch (err) {
      this._toast(`${this._t.error}: ${this._errorText(err)}`);
      this._render();
    }
  }

  _toggleSensor(kind, id, key, on) {
    const subject = this._subjectById(kind, id);
    if (!subject) return;
    const available = new Set(this._availableSensorKeys(kind, subject));
    const set = new Set((subject.sensors || []).filter((k) => available.has(k)));
    if (on) set.add(key); else set.delete(key);
    this._saveSensors(kind, id, [...set]);
  }

  _renderPetsSettings(kind = "pet") {
    const t = this._t;
    const child = kind === "child";
    const pets = (this._entry.pets || []).filter((p) => (p.kind === "child") === child);
    const newId = child ? "new-child" : "new";
    const counts = {};
    for (const m of this._entry.pet_measurements || []) counts[m.pet_id] = (counts[m.pet_id] || 0) + 1;
    const rows = pets.map((p) => {
      if (this._editPet === p.id) return this._renderPetEditor(p);
      const age = this._age(p.birth_month);
      const sensors = this._sensorCount(p);
      const months = this._childMonths(p);
      const bits = [
        child ? (p.sex ? t.sexNames[p.sex] : null) : t.speciesNames[p.species] || p.species,
        child && months !== null ? t.childAge(months) : null,
        `≈ ${this._kg(p.start_weight)}`,
        age !== null ? t.years(age) : null,
        p.goal ? `${t.goal} ${this._kg(p.goal)}` : null,
        t.count(counts[p.id] || 0),
        (p.sensors || []).length ? (sensors ? t.sensorsFound(sensors) : t.sensorsMissing) : null,
      ].filter(Boolean);
      return `
        <div class="person-row">
          <span style="font-size:20px">${this._emoji(p)}</span>
          <div class="info"><b>${esc(p.name)}</b><div class="hint">${esc(bits.join(" · "))}</div></div>
          <button class="btn" data-action="edit-pet" data-pet="${esc(p.id)}">${esc(t.edit)}</button>
        </div>`;
    }).join("");
    const editing = Boolean(this._editPet) && (this._editPet === newId || pets.some((p) => p.id === this._editPet));
    return this._section(child ? "children" : "pets", child ? "mdi:human-child" : "mdi:paw", child ? "👶" : "🐾", child ? t.children : t.pets, `
        <div class="hint">${esc(child ? t.childrenHint : t.petsHint)}</div>
        <div style="margin-top:8px">${rows}</div>
        ${this._editPet === newId ? this._renderPetEditor(null, kind) : `<div class="actions"><button class="btn primary" data-action="edit-pet" data-pet="${newId}">＋ ${esc(child ? t.addChild : t.addPet)}</button></div>`}`,
      { open: editing, count: pets.length || null });
  }

  _renderPetEditor(pet, kind = pet ? pet.kind || "pet" : "pet") {
    const t = this._t;
    const p = pet || {};
    const child = kind === "child";
    const id = pet ? pet.id : child ? "new-child" : "new";
    const formId = `pet-form-${id}`;
    const fields = child ? [
      this._def("text", "name", t.name, { required: true }),
      this._def("select", "sex", t.sex, { required: true, options: Object.entries(t.sexNames).map(([value, label]) => ({ value, label })), helper: t.childSexHint }),
      this._def("fulldate", "birth_date", t.childBirthDate, { required: true, wide: true }),
      this._def("number", "start_weight", t.childStartWeight, { required: true, min: 0.2, max: 80, step: 0.1, unit: "kg", helper: t.petStartHint }),
    ] : [
      this._def("text", "name", t.name, { required: true }),
      this._def("select", "species", t.species, { required: true, options: Object.entries(t.speciesNames).map(([value, label]) => ({ value, label: `${this._speciesEmoji(value)} ${label}` })) }),
      this._def("number", "start_weight", t.petStartWeight, { required: true, min: 0.2, max: 80, step: 0.1, unit: "kg", helper: t.petStartHint }),
      this._def("number", "goal_weight", t.goalWeight, { min: 0.2, max: 80, step: 0.1, unit: "kg" }),
      this._def("birthmonth", "birth_month", t.birthDate, { helper: t.birthMonthHint, wide: true }),
    ];
    const defaults = {
      name: p.name || "", species: p.species || "cat", start_weight: p.start_weight ?? null,
      goal_weight: p.goal ?? null, birth_month: p.birth_month || null,
      kind, sex: p.sex || "", birth_date: p.birth_date || null,
    };
    const count = (this._entry.pet_measurements || []).filter((m) => m.pet_id === id).length;
    const extra = `
      <button class="btn" type="button" data-action="cancel-edit" data-form="${esc(formId)}">${esc(t.cancel)}</button>
      <span class="spacer"></span>
      ${pet ? `<button class="btn danger" type="button" data-action="delete-pet" data-pet="${esc(id)}" data-count="${count}">${esc(child ? t.deleteChild : t.deletePet)}</button>` : ""}`;
    return `
      <div class="form editor" id="${esc(formId)}">
        <h3>${pet ? `${this._emoji(p)} ${esc(p.name)}` : esc(child ? t.newChild : t.newPet)}</h3>
        ${this._formFields(formId, fields, defaults)}
        ${this._formActions(formId, extra)}
      </div>`;
  }

  async _ws(message) {
    return this._hass.callWS({ entry_id: this._entry.entry_id, ...message });
  }

  _errorText(err) {
    const code = err && (err.code || err.error);
    return (code && this._t.errors[code]) || (err && err.message) || String(err);
  }

  _clearForm(formId) {
    delete this._models[formId];
    delete this._formErrors[formId];
    this._dirty.delete(formId);
  }

  async _saveForm(formId) {
    const error = this._validate(formId);
    if (error) {
      this._formErrors[formId] = error;
      this._render();
      return;
    }
    delete this._formErrors[formId];
    const m = this._models[formId];
    try {
      if (formId === "settings-form" || formId === "scale-sensors-form" || formId === "ai-settings-form") {
        // These cards are one set of settings: send the current values of all,
        // each card only with its own fields (every card's model starts as a copy
        // of all settings, so a stale copy must not overwrite another card's change).
        const own = (id) => Object.fromEntries((this._forms[id] || [])
          .map((def) => [def.name, (this._models[id] || {})[def.name]])
          .filter(([, value]) => value !== undefined));
        const m = { ...(this._entry.settings || {}), name: this._entry.title, ...own("settings-form"), ...own("scale-sensors-form"), ...own("ai-settings-form") };
        await this._ws({
          type: "weight_tracker/update_settings",
          settings: {
            name: String(m.name).trim(),
            source_entity: m.source_entity,
            min_weight: Number(m.min_weight),
            max_weight: Number(m.max_weight),
            tolerance: Number(m.tolerance),
            ambiguity_margin: Number(m.ambiguity_margin),
            debounce_seconds: Math.round(Number(m.debounce_seconds)),
            stable_entity: m.stable_entity || null,
            impedance_entity: m.impedance_entity || null,
            impedance_high_entity: m.impedance_high_entity || null,
            heart_rate_entity: m.heart_rate_entity || null,
            body_model: m.body_model || "standard",
            ai_task_entity: m.ai_task_entity || null,
            // the built-in text is not stored, so later improvements of it apply
            ai_prompt: m.ai_prompt && m.ai_prompt.trim() && m.ai_prompt.trim() !== String(m.ai_prompt_default || "").trim() ? m.ai_prompt.trim() : null,
            body_fat_entity: m.body_fat_entity || null,
            muscle_mass_entity: m.muscle_mass_entity || null,
            water_entity: m.water_entity || null,
            bone_mass_entity: m.bone_mass_entity || null,
            bmr_entity: m.bmr_entity || null,
          },
        });
        this._toast(this._t.saved);
        this._clearForm("settings-form");
        this._clearForm("scale-sensors-form");
        this._clearForm("ai-settings-form");
      } else if (formId.startsWith("person-form-")) {
        const id = formId.slice("person-form-".length);
        const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
        await this._ws({
          type: "weight_tracker/save_person",
          person: {
            person_id: id === "new" ? null : id,
            name: String(m.name).trim(),
            start_weight: num(m.start_weight),
            height: num(m.height),
            goal_weight: num(m.goal_weight),
            birth_month: m.birth_month || null,
            sex: m.sex || null,
            person_entity: m.person_entity || null,
            user_id: m.user_id || null,
            viewers: m.viewers || [],
            notify_service: m.notify_service || null,
          },
        });
        this._editPerson = null;
        this._toast(this._t.saved);
      } else if (formId.startsWith("pet-form-")) {
        const id = formId.slice("pet-form-".length);
        const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
        await this._ws({
          type: "weight_tracker/save_pet",
          pet: {
            pet_id: id.startsWith("new") ? null : id,
            name: String(m.name).trim(),
            kind: m.kind || "pet",
            ...(m.kind === "child" ? { sex: m.sex || null, birth_date: m.birth_date && m.birth_date !== "invalid" ? m.birth_date : null } : {}),
            species: m.species || "other",
            start_weight: num(m.start_weight),
            goal_weight: num(m.goal_weight),
            birth_month: m.birth_month || null,
          },
        });
        this._editPet = null;
        this._toast(this._t.saved);
      } else if (formId.startsWith("ai-form-")) {
        await this._ws({
          type: "weight_tracker/update_profile",
          person_id: formId.slice("ai-form-".length),
          profile: { ai_insights: Boolean(m.ai_insights), ai_fields: m.ai_fields || [] },
        });
        this._toast(this._t.saved);
      } else if (formId.startsWith("notify-form-")) {
        await this._ws({
          type: "weight_tracker/update_profile",
          person_id: formId.slice("notify-form-".length),
          profile: {
            notify_weigh: Boolean(m.notify_weigh),
            notify_pet_warnings: Boolean(m.notify_pet_warnings),
            reminder_days: Math.max(0, Math.round(Number(m.reminder_days) || 0)),
          },
        });
        this._toast(this._t.saved);
      } else if (formId.startsWith("profile-form-") && this._editTile && this._editTile.key === "waist") {
        await this._ws({ type: "weight_tracker/waist", action: "add", person_id: formId.slice("profile-form-".length), cm: Number(m.waist_new) });
        this._editTile = null;
        this._toast(this._t.saved);
      } else if (formId.startsWith("profile-form-")) {
        const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
        // Only the value of the tile being edited.
        const profile = {};
        for (const def of this._forms[formId] || []) {
          profile[def.name] = def.kind === "number" ? num(m[def.name]) : def.kind === "boolean" ? Boolean(m[def.name]) : m[def.name] || null;
        }
        await this._ws({
          type: "weight_tracker/update_profile",
          person_id: formId.slice("profile-form-".length),
          profile,
        });
        this._editTile = null;
        this._toast(this._t.saved);
      } else if (formId === "add-form") {
        await this._hass.callService("weight_tracker", "add_measurement", {
          config_entry_id: this._entry.entry_id,
          person: m.person,
          weight: Number(m.weight),
          ...(m.ts ? { timestamp: m.ts } : {}),
          ...(m.note && String(m.note).trim() ? { note: String(m.note).trim() } : {}),
          ...(m.clothes ? { clothes: true } : {}),
        });
        this._addOpen = false;  // saved: close the "+" dialog (on errors it stays open)
      }
      this._clearForm(formId);
    } catch (err) {
      this._formErrors[formId] = this._errorText(err);
    }
    this._render();
  }

  async _deletePet(petId, count) {
    const pet = this._pet(petId);
    if (!pet || !confirm(this._t.deletePersonConfirm(pet.name, count))) return;
    try {
      await this._ws({ type: "weight_tracker/delete_pet", pet_id: petId });
      this._clearForm(`pet-form-${petId}`);
      this._editPet = null;
      this._toast(this._t.saved);
    } catch (err) {
      this._toast(`${this._t.error}: ${this._errorText(err)}`);
    }
    this._render();
  }

  async _deletePerson(personId, count) {
    const person = this._entry.persons.find((p) => p.id === personId);
    if (!person || !confirm(this._t.deletePersonConfirm(person.name, count))) return;
    try {
      await this._ws({ type: "weight_tracker/delete_person", person_id: personId });
      this._clearForm(`person-form-${personId}`);
      this._editPerson = null;
      this._hidden.delete(personId);
      this._toast(this._t.saved);
    } catch (err) {
      this._toast(`${this._t.error}: ${this._errorText(err)}`);
    }
    this._render();
  }

  async _setAccess(personId, changes) {
    try {
      await this._hass.callWS({ type: "weight_tracker/set_access", entry_id: this._entry.entry_id, person_id: personId, ...changes });
      this._toast(this._t.saved);
    } catch (err) {
      this._toast(`${this._t.error}: ${err.message || err}`);
      this._render();
    }
  }

  _renderAddForm() {
    const t = this._t;
    const own = this._entry.persons.filter((p) => p.can_manage);
    const pets = this._entry.pets || [];
    const options = [
      ...own.map((p) => ({ value: p.id, label: p.name })),
      ...pets.map((p) => ({ value: p.id, label: `${this._emoji(p)} ${p.name}` })),
    ];
    const fields = [
      this._def("select", "person", t.person, { required: true, options }),
      this._def("number", "weight", t.weight, { required: true, min: 1, max: 500, step: 0.1, unit: "kg" }),
      this._def("datetime", "ts", t.date, { required: true }),
      this._def("text", "note", t.note, { helper: t.notePlaceholder }),
      ...(own.some((p) => p.clothes && p.clothes.enabled) ? [this._def("boolean", "clothes", t.withClothes)] : []),
    ];
    const defaults = { person: (own.find((p) => p.is_me) || own[0] || pets[0] || {}).id, weight: null, ts: this._nowString() };
    return `
      <h2>${esc(t.add)}</h2>
      <div class="form" id="add-form">
        ${this._formFields("add-form", fields, defaults)}
        <div class="actions"><button class="btn primary" type="button" data-action="save-form" data-form="add-form">${esc(t.addButton)}</button></div>
      </div>`;
  }

  _renderMonthly() {
    const t = this._t;
    const persons = this._entry.persons;
    const months = new Map();
    for (const m of this._entry.measurements) {
      if (m.status !== "assigned") continue;
      const d = new Date(m.ts);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!months.has(key)) months.set(key, {});
      const bucket = months.get(key);
      (bucket[m.person_id] = bucket[m.person_id] || []).push(this._w(m));
    }
    if (!months.size) return "";
    const keys = [...months.keys()].sort().reverse().slice(0, 12);
    const avg = (key, pid) => {
      const list = months.get(key) && months.get(key)[pid];
      return list ? list.reduce((a, b) => a + b, 0) / list.length : null;
    };
    return `
      <div class="card">
        <h2>${esc(t.monthly)}</h2>
        <div class="table-wrap"><table>
          <thead><tr><th>${esc(t.month)}</th>${persons.map((p, i) => `<th class="r"><span class="who"><span class="dot" style="background:${this._color(p.color_index)}"></span>${esc(p.name)}</span></th>`).join("")}</tr></thead>
          <tbody>${keys.map((key, idx) => {
            const [y, mo] = key.split("-").map(Number);
            const prevKey = [...months.keys()].sort().reverse()[idx + 1];
            return `<tr><td>${esc(this._date(new Date(y, mo - 1, 1).getTime(), { month: "short", year: "numeric" }))}</td>${persons.map((p) => {
              const a = avg(key, p.id);
              const b = prevKey ? avg(prevKey, p.id) : null;
              return `<td class="r num">${a === null ? "–" : `${this._kg(a, { unit: false })}${b !== null ? ` <span class="muted small">${this._kg(a - b, { signed: true, unit: false })}</span>` : ""}`}</td>`;
            }).join("")}</tr>`;
          }).join("")}</tbody>
        </table></div>
      </div>`;
  }

  // ------------------------------------------------------------------ chart

  _renderChart() {
    const el = this.shadowRoot.getElementById("chart");
    if (!el || !this._entry) return;
    const t = this._t;
    const width = Math.max(el.clientWidth, 280);
    this._chartWidth = el.clientWidth;
    const height = width < 600 ? 260 : 320;
    const now = Date.now();

    const metric = this._chartMetric();
    const isWeight = metric.key === "weight";
    const series = [];
    let firstTs = Infinity;
    this._entry.persons.forEach((person, index) => {
      if (this._hidden.has(person.id)) return;
      const all = isWeight ? this._assigned(person.id) : this._metricPoints(person, metric.key);
      const pts = all.filter((m) => !this._range || m.ts >= now - this._range * DAY);
      if (!pts.length) return;
      firstTs = Math.min(firstTs, pts[0].ts);
      // In change mode every person starts at 0 at the beginning of the range.
      const base = this._mode === "rel" ? (pts[0].trend ?? pts[0].weight) : 0;
      series.push({ person, color: this._color(person.color_index), base, pts });
    });

    if (!series.length) {
      el.innerHTML = `<div class="message">${esc(!isWeight ? t.chartNoMetric(t.chartMetrics[metric.key]) : this._entry.measurements.length ? t.chartEmpty : t.noData)}</div>`;
      this._chartPoints = [];
      return;
    }
    // Start at the first measurement in range, with a small margin, at least one day.
    let t0 = Math.min(firstTs - (now - firstTs) * 0.02, now - DAY);
    // Forecast: trend extended to the goal at the expected date (max. one year ahead).
    let tEnd = now;
    if (this._mode === "abs" && this._forecast && isWeight) {
      for (const s of series) {
        const st = s.person.stats || {};
        const last = s.pts[s.pts.length - 1];
        const eta = st.goal_eta ? Date.parse(`${st.goal_eta}T12:00:00`) : null;
        if (!s.person.goal || st.goal_reached || !eta || eta <= now || eta - now > 365 * DAY || last.trend === null || last.trend === undefined) continue;
        s.forecast = { ts: last.ts, from: last.trend, eta, goal: s.person.goal };
        tEnd = Math.max(tEnd, eta + (eta - t0) * 0.03);
      }
      // The future part may take at most as much room as the past shown.
      tEnd = Math.min(tEnd, now + Math.max(now - t0, 14 * DAY));
    }

    const uf = metric.kg ? this._factor : 1;  // chart works in the display unit
    let lo = Infinity, hi = -Infinity;
    for (const s of series) {
      for (const m of s.pts) {
        for (const v of [this._w(m), m.trend]) {
          if (v === null || v === undefined) continue;
          lo = Math.min(lo, (v - s.base) * uf);
          hi = Math.max(hi, (v - s.base) * uf);
        }
      }
      if (this._mode === "abs" && isWeight && s.person.goal !== null && s.person.goal !== undefined) {
        lo = Math.min(lo, s.person.goal * uf);
        hi = Math.max(hi, s.person.goal * uf);
      }
    }
    if (this._mode === "rel") { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    const spanY = Math.max(hi - lo, isWeight ? 1 : (Math.abs(hi) || 1) * 0.02);
    const step = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500].find((s) => spanY / s <= 6) || 1000;
    lo = Math.floor((lo - spanY * 0.05) / step) * step;
    hi = Math.ceil((hi + spanY * 0.05) / step) * step;

    const labelWidth = Math.min(110, Math.max(...series.map((s) => s.person.name.length)) * 7 + 16);
    const unitLabel = metric.kg ? this._unitLabel : this._t.chartUnits[metric.key] || metric.unit;
    const m = { l: 44, r: width < 500 ? 12 : labelWidth, t: unitLabel ? 22 : 12, b: 28 };
    const iw = width - m.l - m.r, ih = height - m.t - m.b;
    const x = (ts) => m.l + ((ts - t0) / (tEnd - t0)) * iw;
    const y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * ih;

    let svg = `<svg viewBox="0 0 ${width} ${height}" height="${height}" role="img" aria-label="${esc(`${t.history}: ${t.chartMetrics[metric.key]}`)}">`;
    // grid + y axis (unit above the axis labels)
    if (unitLabel) svg += `<text x="${m.l - 8}" y="10" text-anchor="end">${esc(unitLabel)}</text>`;
    for (let v = lo; v <= hi + 1e-9; v += step) {
      const yy = y(v).toFixed(1);
      const zero = this._mode === "rel" && Math.abs(v) < 1e-9;
      svg += `<line x1="${m.l}" x2="${width - m.r}" y1="${yy}" y2="${yy}" stroke="var(--wt-grid)" stroke-width="${zero ? 1.5 : 1}" ${zero ? "" : 'stroke-dasharray="2 4"'}/>`;
      svg += `<text x="${m.l - 8}" y="${yy}" text-anchor="end" dominant-baseline="middle">${esc(this._num(v, { signed: this._mode === "rel" && v !== 0, digits: step < 1 ? 1 : 0 }))}</text>`;
    }
    // x axis
    for (const tick of this._timeTicks(t0, tEnd, Math.max(2, Math.floor(iw / 90)))) {
      const xx = x(tick.t).toFixed(1);
      svg += `<line x1="${xx}" x2="${xx}" y1="${height - m.b}" y2="${height - m.b + 4}" stroke="var(--wt-grid)"/>`;
      svg += `<text x="${xx}" y="${height - 8}" text-anchor="middle">${esc(this._date(tick.t, tick.fmt))}</text>`;
    }
    svg += `<line x1="${m.l}" x2="${width - m.r}" y1="${height - m.b}" y2="${height - m.b}" stroke="var(--wt-grid)"/>`;
    if (tEnd > now) {
      const nx = x(now).toFixed(1);
      svg += `<line x1="${nx}" x2="${nx}" y1="${m.t}" y2="${height - m.b}" stroke="var(--wt-muted)" stroke-width="1" stroke-dasharray="2 3" opacity="0.7"/>`;
      svg += `<text x="${(x(now) + 4).toFixed(1)}" y="${m.t + 10}">${esc(t.today)}</text>`;
    }

    this._chartPoints = [];
    const labels = [];
    for (const s of series) {
      // goal line
      if (this._mode === "abs" && isWeight && s.person.goal !== null && s.person.goal !== undefined) {
        const gy = y(s.person.goal * uf).toFixed(1);
        svg += `<line x1="${m.l}" x2="${width - m.r}" y1="${gy}" y2="${gy}" stroke="${s.color}" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.7"/>`;
        svg += `<text x="${m.l + 4}" y="${(y(s.person.goal * uf) - 5).toFixed(1)}">${esc(t.goal)} ${esc(s.person.name)}</text>`;
      }
      // measurements (dots)
      for (const p of s.pts) {
        const px = x(p.ts), py = y((this._w(p) - s.base) * uf);
        svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4" fill="${s.color}" fill-opacity="0.35" stroke="${s.color}" stroke-opacity="0.6" stroke-width="1"/>`;
        if (p.note) svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="7.5" fill="none" stroke="var(--primary-text-color)" stroke-width="1.5"/>`;
        this._chartPoints.push({ px, py, m: p, s });
      }
      // trend line
      const trendPts = s.pts.filter((p) => p.trend !== null && p.trend !== undefined);
      if (trendPts.length > 1) {
        const d = trendPts.map((p, i) => `${i ? "L" : "M"}${x(p.ts).toFixed(1)},${y((p.trend - s.base) * uf).toFixed(1)}`).join("");
        svg += `<path d="${d}" fill="none" stroke="var(--wt-card)" stroke-width="3.5" stroke-opacity="0.7" stroke-linejoin="round" stroke-linecap="round"/>`;
        svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      }
      if (s.forecast) {
        const f = s.forecast;
        // Cut at the edge if the goal date lies beyond the visible range.
        const endTs = Math.min(f.eta, tEnd);
        const endValue = f.from + (f.goal - f.from) * ((endTs - f.ts) / (f.eta - f.ts));
        const fx = x(endTs), fy = y(endValue * uf);
        svg += `<path d="M${x(f.ts).toFixed(1)},${y(f.from * uf).toFixed(1)}L${fx.toFixed(1)},${fy.toFixed(1)}" fill="none" stroke="${s.color}" stroke-width="2" stroke-dasharray="5 5" opacity="0.75"/>`;
        if (endTs === f.eta) svg += `<circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="5" fill="var(--wt-card)" stroke="${s.color}" stroke-width="2"/>`;
        svg += `<text x="${fx.toFixed(1)}" y="${(fy - 10).toFixed(1)}" text-anchor="end">${endTs === f.eta ? "≈" : "→"} ${esc(t.goal)} ${esc(this._date(f.eta, { day: "numeric", month: "short", year: endTs === f.eta ? undefined : "numeric" }))}</text>`;
      }
      const last = trendPts[trendPts.length - 1] || s.pts[s.pts.length - 1];
      labels.push({ y: y(((last.trend ?? last.weight) - s.base) * uf), x: x(last.ts), name: s.person.name, color: s.color });
    }
    // direct labels at the line ends (wide screens), pushed apart to avoid overlap
    if (width >= 500) {
      labels.sort((a, b) => a.y - b.y);
      for (let i = 1; i < labels.length; i++) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + 15);
      for (const l of labels) {
        svg += `<text class="label" x="${(width - m.r + 8).toFixed(1)}" y="${l.y.toFixed(1)}" dominant-baseline="middle">${esc(l.name)}</text>`;
      }
    }
    svg += `<g id="hover"></g>`;
    svg += `<rect id="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/>`;
    svg += `</svg><div class="tooltip" id="tooltip"></div>`;
    el.innerHTML = svg;
    this._chartBox = { m, width, height };
  }

  _timeTicks(t0, t1, maxTicks) {
    const spanDays = (t1 - t0) / DAY;
    const ticks = [];
    if (spanDays <= 70) {
      const step = [1, 2, 7, 14].find((s) => spanDays / s <= maxTicks) || 14;
      const d = new Date(t0);
      d.setHours(0, 0, 0, 0);
      if (d.getTime() < t0) d.setDate(d.getDate() + 1);
      if (step >= 7) while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
      for (; d.getTime() <= t1; d.setDate(d.getDate() + step)) ticks.push({ t: d.getTime(), fmt: { day: "numeric", month: "short" } });
    } else {
      const months = spanDays / 30.4;
      const step = [1, 2, 3, 6, 12].find((s) => months / s <= maxTicks) || 12;
      const start = new Date(t0);
      const d = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      while (d.getMonth() % step !== 0) d.setMonth(d.getMonth() + 1);
      const fmt = step >= 12 ? { year: "numeric" } : { month: "short", year: "2-digit" };
      for (; d.getTime() <= t1; d.setMonth(d.getMonth() + step)) ticks.push({ t: d.getTime(), fmt });
    }
    return ticks;
  }

  _onPointer(ev) {
    const path = ev.composedPath();
    const mini = path.find((n) => n.tagName === "svg" && n.dataset && n.dataset.mini);
    if (mini) {
      this._hideHover();
      return this._onMiniPointer(ev, mini);
    }
    this._hideMiniHover();
    // Only the big person chart (it lives in #chart).
    const svg = path.find((n) => n.tagName === "svg" && n.parentNode && n.parentNode.id === "chart");
    if (!svg || !this._chartPoints.length || !this._chartBox) return this._hideHover();
    const rect = svg.getBoundingClientRect();
    const scale = this._chartBox.width / rect.width;
    const mx = (ev.clientX - rect.left) * scale, my = (ev.clientY - rect.top) * scale;
    const { m, width, height } = this._chartBox;
    if (mx < m.l - 10 || mx > width - m.r + 10 || my < 0 || my > height - m.b + 10) return this._hideHover();
    let best = null, bestD = Infinity;
    for (const p of this._chartPoints) {
      const d = Math.hypot((p.px - mx) * 1, (p.py - my) * 0.35);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (!best || bestD > 60) return this._hideHover();
    const t = this._t;
    const hover = this.shadowRoot.getElementById("hover");
    hover.innerHTML = `
      <line x1="${best.px.toFixed(1)}" x2="${best.px.toFixed(1)}" y1="${m.t}" y2="${height - m.b}" stroke="var(--wt-muted)" stroke-width="1" stroke-dasharray="3 3"/>
      <circle cx="${best.px.toFixed(1)}" cy="${best.py.toFixed(1)}" r="6" fill="${best.s.color}" stroke="var(--wt-card)" stroke-width="2"/>`;
    const tip = this.shadowRoot.getElementById("tooltip");
    const metric = this._chartMetric();
    const fmt = (v, signed = false) => esc(this._metricText(metric, v, signed));
    const rel = this._mode === "rel" ? `<div class="muted small">${esc(t.relative)}: ${fmt(this._w(best.m) - best.s.base, true)}</div>` : "";
    tip.innerHTML = `
      <div class="t-head"><span class="dot" style="background:${best.s.color}"></span>${esc(best.s.person.name)}</div>
      <div class="muted small">${esc(this._dateTime(best.m.ts))}</div>
      <div>${esc(metric.key === "weight" ? t.measurement : t.chartMetrics[metric.key])}: <b class="num">${fmt(this._w(best.m))}</b></div>
      ${best.m.clothes_kg ? `<div class="muted small">👕 ${esc(t.measuredWithClothes(this._kg(best.m.weight)))}</div>` : ""}
      ${best.m.trend !== null && best.m.trend !== undefined ? `<div>${esc(t.trend)}: <span class="num">${fmt(best.m.trend)}</span></div>` : ""}
      ${best.m.note ? `<div class="note" style="max-width:220px">📝 ${esc(best.m.note)}</div>` : ""}
      ${rel}`;
    tip.style.display = "block";
    const cssX = best.px / scale, cssY = best.py / scale;
    const tipW = tip.offsetWidth, tipH = tip.offsetHeight;
    let left = cssX + 12;
    if (left + tipW > rect.width) left = cssX - tipW - 12;
    tip.style.left = `${Math.max(0, left)}px`;
    tip.style.top = `${Math.max(0, Math.min(cssY - tipH / 2, rect.height - tipH))}px`;
  }

  // Hover on a pet's small chart: marker + tooltip in that card.
  _onMiniPointer(ev, svg) {
    const key = svg.dataset.mini;
    const data = (this._miniData || {})[key];
    const wrap = svg.parentNode;
    const tip = wrap && wrap.querySelector(".mini-tip");
    if (!data || !tip) return;
    const rect = svg.getBoundingClientRect();
    // viewBox is scaled uniformly ("meet") and centered
    const scale = Math.min(rect.width / data.W, rect.height / data.H);
    const offX = (rect.width - data.W * scale) / 2, offY = (rect.height - data.H * scale) / 2;
    const mx = (ev.clientX - rect.left - offX) / scale;
    let best = null, bestD = Infinity;
    for (const p of data.points) {
      const d = Math.abs(p.px - mx);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (!best || bestD > 40) return this._hideMiniHover();
    const t = this._t;
    svg.querySelector(".mini-hover").innerHTML = `
      <line x1="${best.px.toFixed(1)}" x2="${best.px.toFixed(1)}" y1="${data.padT}" y2="${data.H - data.padB}" stroke="var(--wt-muted)" stroke-dasharray="3 3"/>
      <circle cx="${best.px.toFixed(1)}" cy="${best.py.toFixed(1)}" r="5" fill="${data.color}" stroke="var(--wt-card)" stroke-width="2"/>`;
    tip.innerHTML = `<div class="muted small">${esc(this._dateTime(best.m.ts))}</div>
      <div>${esc(t.measurement)}: <b class="num">${this._kg(best.m.weight, { digits: 2 })}</b></div>
      ${best.m.trend !== null && best.m.trend !== undefined ? `<div>${esc(t.trend)}: <span class="num">${this._kg(best.m.trend, { digits: 2 })}</span></div>` : ""}
      ${best.m.by ? `<div class="muted small">${esc(t.carriedBy)}: ${esc(best.m.by)}</div>` : ""}
      ${best.m.note ? `<div class="note">📝 ${esc(best.m.note)}</div>` : ""}`;
    tip.style.display = "block";
    const cssX = offX + best.px * scale, cssY = offY + best.py * scale;
    let left = cssX + 12;
    if (left + tip.offsetWidth > rect.width) left = cssX - tip.offsetWidth - 12;
    tip.style.left = `${Math.max(0, left)}px`;
    tip.style.top = `${Math.max(0, cssY - tip.offsetHeight / 2)}px`;
  }

  _hideMiniHover() {
    for (const g of this.shadowRoot.querySelectorAll(".mini-hover")) g.innerHTML = "";
    for (const tip of this.shadowRoot.querySelectorAll(".mini-tip")) tip.style.display = "none";
  }

  _hideHover() {
    const hover = this.shadowRoot.getElementById("hover");
    const tip = this.shadowRoot.getElementById("tooltip");
    if (hover) hover.innerHTML = "";
    if (tip) tip.style.display = "none";
  }

  // ----------------------------------------------------------------- events

  _onClick(ev) {
    const el = ev.composedPath().find((n) => n.dataset && n.dataset.action);
    if (!el || el.tagName === "SELECT") return;
    const { action } = el.dataset;
    if (action === "subject") {
      this._subject = el.dataset.person;
      try {
        localStorage.setItem("wt-subject", this._subject);
      } catch (err) {
        // only a convenience
      }
      this._render();
      return;
    }
    if (action === "ai-prompt-reset") {
      const cfg = this._entry.settings || {};
      (this._models["ai-settings-form"] = this._models["ai-settings-form"] || { ...cfg }).ai_prompt = cfg.ai_prompt_default || "";
      this._dirty.add("ai-settings-form");
      this._render();
      return;
    }
    if (action === "card-more") {
      this._showCardMore(el.dataset.card);
      return;
    }
    if (action === "board-edit") {
      this._boardEdit = !this._boardEdit;
      this._render();
      return;
    }
    if (action === "card-size" || action === "card-hide" || action === "card-show" || action === "card-move" || action === "board-reset") {
      const st = this._board();
      const id = el.dataset.card;
      if (action === "card-size") st.size[id] = el.dataset.size;
      else if (action === "card-hide") st.hidden = [...new Set([...st.hidden, id])];
      else if (action === "card-show") st.hidden = st.hidden.filter((x) => x !== id);
      else if (action === "card-move") {
        // swap with the neighbour among the cards shown
        const visible = this._boardVisible || [];
        const other = visible[visible.indexOf(id) + Number(el.dataset.dir)];
        if (other) {
          const a = st.order.indexOf(id), b = st.order.indexOf(other);
          [st.order[a], st.order[b]] = [st.order[b], st.order[a]];
        }
      } else {
        this._boardState = { order: [...BOARD_ORDER], size: {}, hidden: [] };
      }
      this._saveBoard();
      this._render();
      return;
    }
    if (action === "pending-toggle") {
      this._pendingOpen = !this._pendingOpen;
      this._render();
      return;
    }
    if (action === "add-open" || action === "add-close") {
      this._addOpen = action === "add-open";
      if (!this._addOpen) this._clearForm("add-form");
      this._render();
      if (this._addOpen) this.shadowRoot.querySelector(".sheet .ix")?.focus();
      return;
    }
    if (action === "add-tab") {
      this._addTab = el.dataset.tab;
      this._render();
      return;
    }
    if (action === "scale-suggest") {
      const cfg = this._entry.settings || {};
      const model = this._models["scale-sensors-form"] || (this._models["scale-sensors-form"] = { ...cfg });
      Object.assign(model, this._scaleSuggestions(cfg.source_entity, { ...cfg, ...model }));
      this._dirty.add("scale-sensors-form");
      this._saveForm("scale-sensors-form");
      return;
    }
    if (action === "info") {
      this._showInfo(el.dataset.info, el.dataset.title, el.dataset.person);
      return;
    }
    if (action === "ai-fields-all" || action === "ai-fields-none") {
      const formId = el.dataset.form;
      this._models[formId].ai_fields = action === "ai-fields-all" ? [...AI_FIELD_KEYS] : [];
      this._dirty.add(formId);
      this._render();
      return;
    }
    if (action === "ai-refresh") {
      this._ws({ type: "weight_tracker/ai_refresh", person_id: el.dataset.person })
        .catch((err) => this._toast(`${this._t.error}: ${this._errorText(err)}`));
      return;
    }
    if (action === "clothes-toggle") {
      this._ws({ type: "weight_tracker/set_clothes", measurement_id: el.dataset.id, clothes: !el.dataset.on })
        .catch((err) => this._toast(`${this._t.error}: ${this._errorText(err)}`));
      return;
    }
    if (action === "sensor-all" || action === "sensor-none") {
      const subject = this._subjectById(el.dataset.kind, el.dataset.id);
      this._saveSensors(el.dataset.kind, el.dataset.id, action === "sensor-all" && subject ? this._availableSensorKeys(el.dataset.kind, subject) : []);
      return;
    }
    if (action === "pet-notes") {
      this._petNotesOpen = this._petNotesOpen === el.dataset.pet ? null : el.dataset.pet;
      this._render();
      return;
    } else if (action === "pet-event-add") {
      const id = el.dataset.pet;
      const text = (this.shadowRoot.getElementById(`pet-note-text-${id}`) || {}).value || "";
      if (!text.trim()) return;
      const date = (this.shadowRoot.getElementById(`pet-note-date-${id}`) || {}).value;
      this._ws({
        type: "weight_tracker/pet_event", action: "add", pet_id: id, text: text.trim(),
        category: (this.shadowRoot.getElementById(`pet-note-cat-${id}`) || {}).value || "other",
        ...(date ? { ts: new Date(`${date}T12:00:00`).getTime() } : {}),
      }).catch((err) => this._toast(`${this._t.error}: ${this._errorText(err)}`));
      return;
    } else if (action === "pet-event-delete") {
      this._ws({ type: "weight_tracker/pet_event", action: "delete", event_id: el.dataset.id }).catch((err) => this._toast(`${this._t.error}: ${this._errorText(err)}`));
      return;
    }
    if (action === "export-csv") {
      this._exportCsv();
      return;
    } else if (action === "import-run") {
      this._runImport();
      return;
    } else if (action === "import-cancel") {
      this._import = null;
      this._render();
      return;
    }
    if (action === "note-edit") {
      this._editNote = { kind: el.dataset.kind, id: el.dataset.id };
      this._render();
      const input = this.shadowRoot.getElementById("note-input");
      if (input) input.focus();
      return;
    } else if (action === "note-cancel") {
      this._editNote = null;
      this._render();
      return;
    } else if (action === "note-save") {
      const input = this.shadowRoot.getElementById("note-input");
      this._ws({ type: "weight_tracker/set_note", kind: el.dataset.kind, measurement_id: el.dataset.id, note: input ? input.value : "" })
        .then(() => { this._editNote = null; this._render(); })
        .catch((err) => this._toast(`${this._t.error}: ${this._errorText(err)}`));
      return;
    } else if (action === "waist-delete") {
      this._ws({ type: "weight_tracker/waist", action: "delete", waist_id: el.dataset.id }).catch((err) => this._toast(`${this._t.error}: ${this._errorText(err)}`));
      return;
    }
    if (action === "notify-test") {
      this._ws({ type: "weight_tracker/notify_test", person_id: el.dataset.person })
        .then(() => this._toast(this._t.testSent))
        .catch((err) => this._toast(`${this._t.error}: ${this._errorText(err)}`));
    } else if (action === "pet-start") {
      this._ws({ type: "weight_tracker/pet_session", action: "start", pet_id: el.dataset.pet || null }).catch((err) => this._toast(`${this._t.error}: ${this._errorText(err)}`));
      if (this._addOpen) {
        this._addOpen = false;
        this._render();
      }
    } else if (action === "pet-cancel") {
      this._ws({ type: "weight_tracker/pet_session", action: "cancel" }).catch((err) => this._toast(`${this._t.error}: ${this._errorText(err)}`));
    } else if (action === "pet-confirm" || action === "pet-reject") {
      this._ws({
        type: "weight_tracker/pet_candidate",
        measurement_id: el.dataset.id,
        action: action === "pet-confirm" ? "confirm" : "reject",
        ...(el.dataset.pet ? { pet_id: el.dataset.pet } : {}),
      }).catch((err) => this._toast(`${this._t.error}: ${this._errorText(err)}`));
    } else if (action === "pet-delete") {
      const m = (this._entry.pet_measurements || []).find((x) => x.id === el.dataset.id);
      if (m && confirm(this._t.deleteConfirm(this._kg(m.weight, { digits: 2 }), this._dateTime(m.ts)))) {
        this._ws({ type: "weight_tracker/pet_measurement", measurement_id: m.id, action: "delete" }).catch((err) => this._toast(`${this._t.error}: ${this._errorText(err)}`));
      }
    } else if (action === "more-info") {
      this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: el.dataset.entity }, bubbles: true, composed: true }));
    } else if (action === "save-form") {
      this._saveForm(el.dataset.form);
    } else if (action === "tab") {
      this._tab = el.dataset.tab;
      this._render();
      this.shadowRoot.querySelector(".scroller").scrollTop = 0;
    } else if (action === "edit-person") {
      this._editPerson = el.dataset.person;
      this._render();
      const form = this.shadowRoot.getElementById(`person-form-${el.dataset.person}`);
      if (form) form.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else if (action === "edit-tile") {
      this._editTile = { person: el.dataset.person, key: el.dataset.tile };
      this._render();
    } else if (action === "cancel-tile") {
      this._clearForm(el.dataset.form);
      this._editTile = null;
      this._render();
    } else if (action === "edit-pet") {
      this._editPet = el.dataset.pet;
      this._render();
      const form = this.shadowRoot.getElementById(`pet-form-${el.dataset.pet}`);
      if (form) form.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else if (action === "delete-pet") {
      this._deletePet(el.dataset.pet, Number(el.dataset.count) || 0);
    } else if (action === "cancel-edit") {
      this._clearForm(el.dataset.form);
      this._editPerson = null;
      this._editPet = null;
      this._render();
    } else if (action === "delete-person") {
      this._deletePerson(el.dataset.person, Number(el.dataset.count) || 0);
    } else if (action === "assign") {
      this._call("assign_measurement", { measurement_id: el.dataset.id, person: el.dataset.person });
    } else if (action === "toggle") {
      const id = el.dataset.person;
      this._hidden.has(id) ? this._hidden.delete(id) : this._hidden.add(id);
      this._render();
    } else if (action === "range") {
      this._range = Number(el.dataset.range);
      this._render();
    } else if (action === "forecast") {
      this._forecast = !this._forecast;
      this._render();
    } else if (action === "mode") {
      this._mode = el.dataset.mode;
      this._render();
    } else if (action === "list-person") {
      this._listPerson = el.dataset.person;
      this._listLimit = 15;
      this._render();
    } else if (action === "more") {
      this._listLimit += 30;
      this._render();
    } else if (action === "delete") {
      const m = this._entry.measurements.find((x) => x.id === el.dataset.id);
      if (m && confirm(this._t.deleteConfirm(this._kg(m.weight), this._dateTime(m.ts)))) {
        this._call("delete_measurement", { measurement_id: m.id });
      }
    }
  }

  _onChange(ev) {
    const el = ev.composedPath()[0];
    if (!el.dataset) return;
    if (el.dataset.action === "import-file" && el.files && el.files[0]) {
      const file = el.files[0];
      file.text().then((text) => {
        const me = this._entry.persons.find((p) => p.is_me && p.can_manage) || this._entry.persons.find((p) => p.can_manage);
        const firstPet = (this._entry.pets || [])[0];
        this._import = { name: file.name, parsed: parseWeightCsv(text, this._lang), target: me ? `person:${me.id}` : firstPet ? `pet:${firstPet.id}` : "", busy: false };
        this._render();
      });
      return;
    }
    if (el.dataset.action === "viewer-toggle") {
      const person = this._entry.persons.find((p) => p.id === el.dataset.person);
      if (!person) return;
      const viewers = new Set(person.viewers || []);
      if (el.checked) viewers.add(el.dataset.user); else viewers.delete(el.dataset.user);
      this._ws({ type: "weight_tracker/set_viewers", person_id: person.id, viewers: [...viewers] })
        .then(() => this._toast(this._t.saved))
        .catch((err) => {
          this._toast(`${this._t.error}: ${this._errorText(err)}`);
          this._render();
        });
      return;
    }
    if (el.dataset.action === "ai-field") {
      const model = this._models[el.dataset.form];
      const set = new Set(model.ai_fields || []);
      if (el.checked) set.add(el.dataset.key); else set.delete(el.dataset.key);
      model.ai_fields = AI_FIELD_KEYS.filter((key) => set.has(key));
      this._dirty.add(el.dataset.form);
      const none = this.shadowRoot.getElementById(`${el.dataset.form}-none`);
      if (none) none.hidden = model.ai_fields.length > 0;
      return;
    }
    if (el.dataset.action === "pet-reassign") {
      this._ws({ type: "weight_tracker/pet_measurement", measurement_id: el.dataset.id, action: "assign", pet_id: el.value }).catch((err) => this._toast(`${this._t.error}: ${this._errorText(err)}`));
    } else if (el.dataset.action === "reassign" && el.value) {
      this._call("assign_measurement", { measurement_id: el.dataset.id, person: el.value });
    } else if (el.dataset.action === "access") {
      const person = this._entry.persons.find((p) => p.id === el.dataset.person);
      const uid = el.dataset.user;
      let owner = person.user_id || null;
      let viewers = (person.viewers || []).filter((v) => v !== uid);
      if (el.value === "owner") owner = uid;
      else if (owner === uid) owner = null;
      if (el.value === "view") viewers.push(uid);
      this._setAccess(person.id, { user_id: owner, viewers });
    } else if (el.dataset.action === "sensor-toggle") {
      this._toggleSensor(el.dataset.kind, el.dataset.id, el.dataset.key, el.checked);
    } else if (el.dataset.action === "metric") {
      this._metric = el.value;
      try {
        localStorage.setItem("wt-metric", el.value);
      } catch (err) {
        // only a convenience
      }
      this._render();
    } else if (el.dataset.action === "unit") {
      this._unitPref = el.value;
      try {
        localStorage.setItem("wt-unit", el.value);
      } catch (err) {
        // private mode etc.: the choice just is not remembered
      }
      this._render();
    } else if (el.dataset.action === "scale") {
      this._entryId = el.value;
      this._hidden.clear();
      this._listPerson = "all";
      this._render();
    }
  }

  _onSubmit(ev) {
    ev.preventDefault();
  }

}

if (!customElements.get("weight-tracker-panel")) {
  customElements.define("weight-tracker-panel", WeightTrackerPanel);
}
