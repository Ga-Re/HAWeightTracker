/*
 * Weight Tracker – sidebar panel.
 * Plain web component without external dependencies (works offline).
 * Data arrives via the websocket subscription "weight_tracker/subscribe".
 */

const DAY = 864e5;

// Categorical person colors, fixed order (validated for CVD separation).
const COLORS = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
};

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
    bodyHint: "Geschätzt aus der Impedanz deiner Waage (Xiaomi-Formel) – Richtwerte, keine medizinische Messung.",
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
    impedanceHint: "Nur falls deine Waage die Impedanz liefert (z. B. Xiaomi Body Composition Scale). Daraus werden Körperfett, Muskeln usw. geschätzt.",
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
    sensorNeeds: { height: "braucht Größe", goal: "braucht Zielgewicht" },
    sensorLabels: {
      weight: "Gewicht", trend: "Trend", change_last: "Veränderung letzte Messung", change_7d: "Veränderung 7 Tage",
      change_30d: "Veränderung 30 Tage", change_total: "Veränderung gesamt", rate: "Tempo pro Woche", bmi: "BMI",
      goal_distance: "Abstand zum Ziel", goal_eta: "Ziel voraussichtlich", last_measured: "Letzte Messung",
      body_fat: "Körperfett", muscle_mass: "Muskelmasse", body_water: "Körperwasser", bone_mass: "Knochenmasse", bmr: "Grundumsatz",
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
    bodyHint: "Estimated from your scale's impedance (Xiaomi formula) – guide values, not a medical measurement.",
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
    impedanceHint: "Only if your scale reports impedance (e.g. Xiaomi Body Composition Scale). Body fat, muscles etc. are estimated from it.",
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
    sensorNeeds: { height: "needs height", goal: "needs goal weight" },
    sensorLabels: {
      weight: "Weight", trend: "Trend", change_last: "Change since last", change_7d: "Change 7 days",
      change_30d: "Change 30 days", change_total: "Total change", rate: "Rate per week", bmi: "BMI",
      goal_distance: "Distance to goal", goal_eta: "Goal expected", last_measured: "Last measurement",
      body_fat: "Body fat", muscle_mass: "Muscle mass", body_water: "Body water", bone_mass: "Bone mass", bmr: "Basal metabolic rate",
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
    // "toggle" does not bubble: listen in the capture phase.
    root.addEventListener("toggle", (ev) => this._onSectionToggle(ev), true);
    root.addEventListener("pointermove", (ev) => this._onPointer(ev));
    root.addEventListener("pointerleave", () => {
      this._hideHover();
      this._hideMiniHover();
    }, true);
    this._sparkObserver = new ResizeObserver(() => this._drawSparks());
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

  _assigned(personId) {
    return this._entry.measurements.filter((m) => m.status === "assigned" && m.person_id === personId);
  }

  // ----------------------------------------------------------------- render

  _render() {
    if (!this._data) return;
    const t = this._t;
    const entries = this._data.entries;
    const unitSlot = this.shadowRoot.getElementById("unit");
    if (unitSlot) unitSlot.innerHTML = `<select class="unit-select" data-action="unit" aria-label="${esc(t.unit)}">${["kg", "lb", "st"].map((u) => `<option value="${u}" ${u === this._unit ? "selected" : ""}>${u}</option>`).join("")}</select>`;
    const scaleSlot = this.shadowRoot.getElementById("scale");
    scaleSlot.innerHTML = entries.length > 1
      ? `<select data-action="scale">${entries.map((e) => `<option value="${esc(e.entry_id)}" ${e === this._entry ? "selected" : ""}>${esc(e.title)}</option>`).join("")}</select>`
      : "";
    const tabs = [["overview", t.tabOverview], ["measurements", t.tabMeasurements]];
    const myPersons = entries.length ? this._entry.persons.filter((p) => p.is_me) : [];
    if (myPersons.length) tabs.push(["mydata", t.myData]);
    if (this._isAdmin) tabs.push(["settings", t.tabSettings]);
    if (!tabs.some(([key]) => key === this._tab)) this._tab = "overview";
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
    if (this._tab === "settings") {
      this._content(this._renderSettings());
    } else if (this._tab === "mydata") {
      this._content(myPersons.map((p) => this._renderMyData(p)).join(""));
    } else if (!this._entry.persons.length && !(this._entry.pets || []).length) {
      this._content(this._isAdmin
        ? `<div class="card message">${esc(t.noPersonsAdmin)}<div class="actions" style="justify-content:center"><button class="btn primary" data-action="tab" data-tab="settings">${esc(t.toSettings)}</button></div></div>`
        : `<div class="message">${esc(t.noAccess)}</div>`);
    } else if (this._tab === "measurements") {
      const canAdd = this._entry.persons.some((p) => p.can_manage) || (this._entry.pets || []).length;
      // The form comes first so it stays reachable however long the lists get.
      this._content(`
        ${this._renderPetSession()}
        ${this._renderPending()}
        ${canAdd ? `<div class="card">${this._renderAddForm()}</div>` : ""}
        ${this._entry.persons.length ? `<div class="card">${this._renderList()}</div>` : ""}
        ${this._renderPetList()}
        ${this._renderImportExport()}`);
    } else {
      const persons = this._entry.persons;
      this._content(`
        ${this._renderPetSession()}
        ${this._renderPending()}
        ${persons.length ? `<div class="persons">${persons.map((p) => this._renderPerson(p, p.color_index)).join("")}</div>
        <div class="card">
          ${this._renderChartHead()}
          <div class="chart" id="chart"></div>
        </div>` : ""}
        ${this._renderPets()}
        ${persons.length ? this._renderMonthly() : ""}`);
    }
    this._syncCountdown();
    this._mountFields();
    this._drawSparks();
    this._resizeObserver.disconnect();
    const chart = this.shadowRoot.getElementById("chart");
    if (chart) {
      this._resizeObserver.observe(chart);
      this._renderChart();
    }
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

  _renderPerson(person, index) {
    const t = this._t;
    const s = person.stats || {};
    const color = this._color(index);
    const latestTs = s.latest_ts ? Date.parse(s.latest_ts) : null;
    let goalHtml = "";
    if (person.goal !== null && person.goal !== undefined && s.trend !== null && s.trend !== undefined) {
      const start = s.first_weight ?? person.start_weight;
      const span = start - person.goal;
      const progress = span ? Math.min(1, Math.max(0, (start - s.trend) / span)) : 1;
      const eta = s.goal_reached ? t.goalReached : s.goal_eta ? t.goalEta(this._date(Date.parse(s.goal_eta))) : t.goalNoEta;
      goalHtml = `
        <div class="goal">
          <div class="row"><span>${esc(t.goal)} ${this._kg(person.goal)}</span><span class="num">${s.goal_reached ? "" : this._link(person, "goal_distance", t.goal, esc(t.goalLeft(this._kg(Math.abs(s.goal_remaining)))))}</span></div>
          <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress * 100)}"><div style="width:${(progress * 100).toFixed(1)}%;background:${color}"></div></div>
          <div class="muted small">${this._link(person, "goal_eta", t.goal, esc(eta))} · ${Math.round(progress * 100)} %</div>
        </div>`;
    }
    // With sensors in HA, values open HA's own more-info dialog on click.
    const link = (key, label, html) => this._link(person, key, label, html);
    const stat = (key, label, value) => `<div class="stat"><div class="label">${esc(label)}</div><div class="val num">${link(key, label, value)}</div></div>`;
    const age = this._age(person.birth_month);
    const bmiText = s.bmi
      ? `${this._kg(s.bmi, { unit: false })}${age === null || age >= 18 ? ` <span class="muted small">${esc(t.bmiCat(s.bmi))}</span>` : ""}`
      : "–";
    return `
      <div class="card person-card">
        <div class="person-head">${this._avatar(person, 36)}
          <h2>${esc(person.name)}${age !== null ? ` <span class="muted small" style="font-weight:400">· ${esc(t.years(age))}</span>` : ""}</h2>
          <span class="muted small">${latestTs ? link("last_measured", t.measured, `${esc(t.measured)} ${esc(this._relative(latestTs))}`) : esc(t.noData)}</span></div>
        <div class="hero">${link("weight", t.weight, this._hero(s.latest_weight))}
          ${s.change_last !== null && s.change_last !== undefined ? `<span class="muted small num">${link("change_last", t.weight, this._kg(s.change_last, { signed: true }))}</span>` : ""}</div>
        <div class="stats">
          ${stat("trend", t.trend, this._kg(s.trend))}
          ${stat("change_7d", t.d7, this._kg(s.change_7d, { signed: true }))}
          ${stat("change_30d", t.d30, this._kg(s.change_30d, { signed: true }))}
          ${stat("rate", t.perWeek, this._kg(s.rate_per_week, { signed: true, digits: 2 }))}
          ${stat("change_total", t.total, this._kg(s.change_total, { signed: true }))}
          ${person.height ? stat("bmi", t.bmi, bmiText) : `<div class="stat"><div class="label">Min / Max</div><div class="val num">${s.min_weight ? `${this._kg(s.min_weight, { unit: false })} / ${this._kg(s.max_weight, { unit: false })}` : "–"}</div></div>`}
        </div>
        ${person.body && person.body.latest ? `<div class="body-line">🧬 ${link("body_fat", t.bodyFat, `${esc(t.bodyFat)} ${this._kg(person.body.latest.body_fat, { unit: false })} %`)}${person.body.latest.muscle_mass ? ` · ${link("muscle_mass", t.muscle, `${esc(t.muscle)} ${this._kg(person.body.latest.muscle_mass)}`)}` : ""}</div>` : ""}
        ${goalHtml}
      </div>`;
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

  _renderPets() {
    const t = this._t;
    const all = this._entry.pets || [];
    const pets = all.filter((p) => p.kind !== "child");
    const children = all.filter((p) => p.kind === "child");
    return `
      ${children.length ? `<div class="section-title">👶 ${esc(t.children)}</div>
        <div class="persons">${children.map((child) => this._renderChildCard(child)).join("")}</div>` : ""}
      ${pets.length ? `<div class="section-title">🐾 ${esc(t.pets)}</div>
        <div class="persons">${pets.map((pet) => this._renderPetCard(pet)).join("")}</div>` : ""}`;
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
  _miniChart(pet, color) {
    const now = Date.now();
    const pts = (this._entry.pet_measurements || []).filter((m) => m.pet_id === pet.id && m.ts >= now - 180 * DAY);
    if (pts.length < 2) return "";
    return this._spark(`pet-${pet.id}`, (W) => this._miniChartSvg(pet, color, pts, now, W));
  }

  _miniChartSvg(pet, color, pts, now, W) {
    const H = 96, padL = 34, padR = 8, padT = 8, padB = 8;
    const values = pts.flatMap((m) => [m.weight, m.trend ?? m.weight]);
    let lo = Math.min(...values), hi = Math.max(...values);
    if (hi - lo < 0.4) { lo -= 0.2; hi += 0.2; }
    const t0 = pts[0].ts, t1 = Math.max(now, pts[pts.length - 1].ts);
    const x = (ts) => padL + ((ts - t0) / Math.max(t1 - t0, 1)) * (W - padL - padR);
    const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
    const trend = pts.map((m, i) => `${i ? "L" : "M"}${x(m.ts).toFixed(1)},${y(m.trend ?? m.weight).toFixed(1)}`).join("");
    this._miniData = this._miniData || {};
    this._miniData[`pet-${pet.id}`] = { W, H, padT, padB, color, points: pts.map((m) => ({ px: x(m.ts), py: y(m.weight), m })) };
    return `<div class="mini-wrap"><svg class="mini" data-mini="pet-${esc(pet.id)}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(this._t.history)}">
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
    const keys = ["weight", "trend", "change_last", "change_7d", "change_30d", "change_total", "rate", "bmi", "goal_distance", "goal_eta", "last_measured"];
    return keys.filter((k) => this._entityFor(person, k)).length;
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
      clothes: Boolean(c.enabled), clothes_kg: c.start ?? 0.8 };
    if (!this._dirty.has(formId) || !this._models[formId]) this._models[formId] = { ...defaults };
    const facts = this._profileFacts(person, this._models[formId]);
    return `
      <div class="card profile-hero">
        ${this._avatar(person, 64)}
        <div><h2>${esc(person.name)}</h2><div class="hint" style="margin-top:2px">${esc(t.myDataHint)}</div></div>
      </div>
      <div class="tiles">${this._myDataTiles(person, facts, defaults)}</div>
      ${this._renderBody(person, facts)}
      ${this._renderCalendar(person)}
      <div class="two">
        <div class="card" data-preview="health-${esc(person.id)}">${this._myDataHealth(facts)}</div>
        <div class="card" data-preview="goal-${esc(person.id)}">${this._myDataGoal(person, facts)}</div>
      </div>
      ${person.can_manage ? this._renderNotifySettings(person) : ""}`;
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
      <div class="card">
        <h2>🔔 ${esc(t.notifications)}</h2>
        <div class="hint" style="margin-top:4px">${esc(t.notificationsHint)}</div>
        <div style="margin-top:8px">${n.service ? esc(t.notifyTarget(this._serviceLabel(n.service))) : `<span class="hint">${esc(t.notifyNoDevice)}</span>`}</div>
        <div class="form" id="${esc(formId)}">
          ${this._formFields(formId, fields, defaults)}
          ${this._formActions(formId, n.service ? `<button class="btn" type="button" data-action="notify-test" data-person="${esc(person.id)}" data-form="${esc(formId)}">${esc(t.sendTest)}</button>` : "")}
        </div>
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
    const labels = { age: t.age, height: t.height, bmi: t.bmi, goal: t.goal, sex: t.sex, waist: t.waist, clothes: t.clothes };
    return ["age", "height", "bmi", "goal", "sex", "waist", ...(person.clothes ? ["clothes"] : [])].map((key) => {
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
    if (!body) return "";
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
    const de = t === TEXT.de;
    return `
      <div class="chart-head">
        <h2>${esc(t.history)}</h2>
        <div class="chips" role="group" aria-label="${esc(t.history)}">
          ${this._entry.persons.map((p, i) => `
            <button class="chip legend ${this._hidden.has(p.id) ? "off" : ""}" data-action="toggle" data-person="${esc(p.id)}" aria-pressed="${!this._hidden.has(p.id)}">
              <span class="dot" style="background:${this._color(p.color_index)}"></span>${esc(p.name)}</button>`).join("")}
        </div>
        <div class="chips" role="group">
          <button class="chip" data-action="mode" data-mode="abs" aria-pressed="${this._mode === "abs"}">${esc(t.absolute)}</button>
          <button class="chip" data-action="mode" data-mode="rel" aria-pressed="${this._mode === "rel"}">${esc(t.relative)}</button>
          ${this._mode === "abs" ? `<button class="chip" data-action="forecast" aria-pressed="${this._forecast}">📈 ${esc(t.forecast)}</button>` : ""}
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
      <div class="card">
        <h2>⇅ ${esc(t.importExport)}</h2>
        <div class="hint" style="margin-top:4px">${esc(t.importExportHint)}</div>
        <div class="actions">
          <button class="btn" data-action="export-csv">${esc(t.exportCsv)}</button>
          ${targets.length ? `<label class="btn file-btn">${esc(t.importCsv)}<input type="file" accept=".csv,.txt,text/csv" data-action="import-file"></label>` : ""}
        </div>
        ${preview}
      </div>`;
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
    if (kind === "text") def.selector = { text: {} };
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
    } else {
      control = `<input type="text" value="${esc(value ?? "")}">`;
    }
    wrap.innerHTML = `${label}${def.unit ? ` (${esc(def.unit)})` : ""}${control}${helper}`;
    const input = wrap.querySelector("input, select");
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
      this._def("entity", "source_entity", t.source, { required: true, filter }),
      this._def("entity", "impedance_entity", t.impedanceEntity, { filter: { domain: "sensor" }, helper: t.impedanceHint }),
      this._def("entity", "body_fat_entity", t.bodyFatEntity, { filter: { domain: "sensor" }, helper: t.bodyFatEntityHint }),
      this._def("entity", "muscle_mass_entity", t.muscleEntity, { filter: { domain: "sensor" }, helper: t.directHint }),
      this._def("entity", "water_entity", t.waterEntity, { filter: { domain: "sensor" }, helper: t.directHint }),
      this._def("entity", "bone_mass_entity", t.boneEntity, { filter: { domain: "sensor" }, helper: t.directHint }),
      this._def("entity", "bmr_entity", t.bmrEntity, { filter: { domain: "sensor" }, helper: t.directHint }),
    ];
    const defaults = { name: this._entry.title, ...cfg };
    return this._section("scale", "mdi:scale-bathroom", "⚖️", t.scale, `
        <div class="hint">${esc(t.scaleHint)}</div>
        <div class="form" id="settings-form">
          ${this._formFields("settings-form", fields, defaults)}
          ${this._formActions("settings-form")}
        </div>`) + this._section("scale-sensors", "mdi:access-point", "📡", t.scaleSensors, `
        <div class="hint">${esc(t.scaleSensorsHint)}</div>
        <div class="form" id="scale-sensors-form">
          ${this._formFields("scale-sensors-form", sensors, defaults)}
          ${this._formActions("scale-sensors-form")}
        </div>`, { open: !cfg.source_entity });
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
    const direct = { body_fat: cfg.body_fat_entity, muscle_mass: cfg.muscle_mass_entity, body_water: cfg.water_entity, bone_mass: cfg.bone_mass_entity, bmr: cfg.bmr_entity };
    const body = Object.keys(direct).filter((key) => cfg.impedance_entity || direct[key]);
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
      const chosen = new Set(s.sensors || []);
      const keys = this._sensorKeys(kind);
      const needs = (key) => key === "bmi" && !s.height ? t.sensorNeeds.height
        : (key === "goal_distance" || key === "goal_eta") && !s.goal ? t.sensorNeeds.goal : "";
      const found = this._sensorCount(s);
      return `
        <div class="person-row" style="align-items:flex-start">
          ${icon}
          <div class="info">
            <b>${esc(s.name)}</b>
            ${chosen.size ? `<div class="hint">${esc(found ? t.sensorsFound(found) : t.sensorsMissing)}</div>` : ""}
            <div class="checks" style="margin-top:8px">${keys.map((key) => `
              <label class="check" title="${esc(needs(key))}"><input type="checkbox" data-action="sensor-toggle" data-kind="${kind}" data-id="${esc(s.id)}" data-key="${key}" ${chosen.has(key) ? "checked" : ""}>
                ${esc(t.sensorLabels[key])}${needs(key) && chosen.has(key) ? ` <span class="hint">(${esc(needs(key))})</span>` : ""}</label>`).join("")}</div>
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

  _subjectById(kind, id) {
    return kind === "person" ? this._entry.persons.find((p) => p.id === id) : (this._entry.pets || []).find((p) => p.id === id);
  }

  async _saveSensors(kind, id, sensors) {
    try {
      await this._ws({ type: "weight_tracker/set_sensors", kind, id, sensors });
      this._toast(this._t.saved);
    } catch (err) {
      this._toast(`${this._t.error}: ${this._errorText(err)}`);
      this._render();
    }
  }

  _toggleSensor(kind, id, key, on) {
    const subject = this._subjectById(kind, id);
    if (!subject) return;
    const set = new Set(subject.sensors || []);
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
      if (formId === "settings-form" || formId === "scale-sensors-form") {
        // Both cards are one set of settings: send the current values of both.
        const m = { ...(this._entry.settings || {}), name: this._entry.title, ...(this._models["settings-form"] || {}), ...(this._models["scale-sensors-form"] || {}) };
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
            impedance_entity: m.impedance_entity || null,
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

    const series = [];
    let firstTs = Infinity;
    this._entry.persons.forEach((person, index) => {
      if (this._hidden.has(person.id)) return;
      const all = this._assigned(person.id);
      const pts = all.filter((m) => !this._range || m.ts >= now - this._range * DAY);
      if (!pts.length) return;
      firstTs = Math.min(firstTs, pts[0].ts);
      // In change mode every person starts at 0 at the beginning of the range.
      const base = this._mode === "rel" ? (pts[0].trend ?? pts[0].weight) : 0;
      series.push({ person, color: this._color(person.color_index), base, pts });
    });

    if (!series.length) {
      el.innerHTML = `<div class="message">${esc(this._entry.measurements.length ? t.chartEmpty : t.noData)}</div>`;
      this._chartPoints = [];
      return;
    }
    // Start at the first measurement in range, with a small margin, at least one day.
    let t0 = Math.min(firstTs - (now - firstTs) * 0.02, now - DAY);
    // Forecast: trend extended to the goal at the expected date (max. one year ahead).
    let tEnd = now;
    if (this._mode === "abs" && this._forecast) {
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

    const uf = this._factor;  // chart works in the display unit
    let lo = Infinity, hi = -Infinity;
    for (const s of series) {
      for (const m of s.pts) {
        for (const v of [this._w(m), m.trend]) {
          if (v === null || v === undefined) continue;
          lo = Math.min(lo, (v - s.base) * uf);
          hi = Math.max(hi, (v - s.base) * uf);
        }
      }
      if (this._mode === "abs" && s.person.goal !== null && s.person.goal !== undefined) {
        lo = Math.min(lo, s.person.goal * uf);
        hi = Math.max(hi, s.person.goal * uf);
      }
    }
    if (this._mode === "rel") { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    const spanY = Math.max(hi - lo, 1);
    const step = [0.5, 1, 2, 5, 10, 20, 50].find((s) => spanY / s <= 6) || 50;
    lo = Math.floor((lo - spanY * 0.05) / step) * step;
    hi = Math.ceil((hi + spanY * 0.05) / step) * step;

    const labelWidth = Math.min(110, Math.max(...series.map((s) => s.person.name.length)) * 7 + 16);
    const m = { l: 44, r: width < 500 ? 12 : labelWidth, t: 12, b: 28 };
    const iw = width - m.l - m.r, ih = height - m.t - m.b;
    const x = (ts) => m.l + ((ts - t0) / (tEnd - t0)) * iw;
    const y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * ih;

    let svg = `<svg viewBox="0 0 ${width} ${height}" height="${height}" role="img" aria-label="${esc(t.history)}">`;
    // grid + y axis
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
      if (this._mode === "abs" && s.person.goal !== null && s.person.goal !== undefined) {
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
    const rel = this._mode === "rel" ? `<div class="muted small">${esc(t.relative)}: ${this._kg(this._w(best.m) - best.s.base, { signed: true })}</div>` : "";
    tip.innerHTML = `
      <div class="t-head"><span class="dot" style="background:${best.s.color}"></span>${esc(best.s.person.name)}</div>
      <div class="muted small">${esc(this._dateTime(best.m.ts))}</div>
      <div>${esc(t.measurement)}: <b class="num">${this._kg(this._w(best.m))}</b></div>
      ${best.m.clothes_kg ? `<div class="muted small">👕 ${esc(t.measuredWithClothes(this._kg(best.m.weight)))}</div>` : ""}
      ${best.m.trend !== null && best.m.trend !== undefined ? `<div>${esc(t.trend)}: <span class="num">${this._kg(best.m.trend)}</span></div>` : ""}
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
    if (action === "clothes-toggle") {
      this._ws({ type: "weight_tracker/set_clothes", measurement_id: el.dataset.id, clothes: !el.dataset.on })
        .catch((err) => this._toast(`${this._t.error}: ${this._errorText(err)}`));
      return;
    }
    if (action === "sensor-all" || action === "sensor-none") {
      this._saveSensors(el.dataset.kind, el.dataset.id, action === "sensor-all" ? this._sensorKeys(el.dataset.kind) : []);
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
