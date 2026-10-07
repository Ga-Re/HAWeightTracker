/*
 * Weight Tracker – sidebar panel.
 * Plain web component without external dependencies (works offline).
 * Data arrives via the websocket subscription "weight_tracker/subscribe".
 */

const DAY = 864e5;
const DECIMAL_PATTERN = "\\s*[0-9]+([.,][0-9]+)?\\s*";

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
    absolute: "kg",
    relative: "Veränderung",
    chartEmpty: "Im gewählten Zeitraum gibt es keine Messungen.",
    measurement: "Messung",
    monthly: "Monatsdurchschnitt",
    month: "Monat",
    list: "Messungen",
    all: "Alle",
    date: "Datum",
    person: "Person",
    weight: "Gewicht",
    source: "Erkannt",
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
    sensorsHint: "⚠️ Sensoren sind in Home Assistant für alle Benutzer sichtbar. Nur für Automationen einschalten.",
    saved: "Gespeichert",
    me: "Ich",
    tabOverview: "Übersicht",
    tabMeasurements: "Messungen",
    tabSettings: "Einstellungen",
    scale: "Waage",
    scaleHint: "Welcher Sensor liefert das Gewicht, und wie streng wird zugeordnet?",
    name: "Name",
    source: "Gewichtssensor der Waage",
    minWeight: "Minimales Gewicht (kg)",
    minWeightHint: "Leichtere Werte (Taschen, Haustiere) werden ignoriert.",
    maxWeight: "Maximales Gewicht (kg)",
    tolerance: "Toleranz (kg)",
    toleranceHint: "So weit darf eine Messung vom bisherigen Gewicht abweichen. Wächst um 0,15 kg pro Tag ohne Messung.",
    margin: "Eindeutigkeits-Abstand (kg)",
    marginHint: "Passen mehrere Personen, muss die nächste um so viel näher liegen – sonst wird nachgefragt.",
    debounce: "Wartezeit bis Wert stabil (s)",
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
    startWeight: "Startgewicht (kg)",
    startWeightHint: "Ungefähres aktuelles Gewicht.",
    height: "Größe (cm)",
    heightHint: "Optional, für den BMI.",
    goalWeight: "Zielgewicht (kg)",
    goalWeightHint: "Optional, für Fortschritt und Prognose.",
    presence: "Anwesenheit",
    presenceHint: "Optional. Ist nur eine passende Person zu Hause, bekommt sie die Messung.",
    linkedUser: "Home-Assistant-Benutzer",
    linkedUserHint: "Dieser Benutzer sieht seine Daten und kann eigene Messungen zuordnen, eintragen und löschen.",
    none: "— keine —",
    noUser: "— kein Benutzer —",
    viewers: "Darf außerdem ansehen",
    viewersHint: "Nur lesen. Admins sehen immer alles.",
    noOtherUsers: "Keine weiteren Benutzer vorhanden.",
    createSensors: "Sensoren in Home Assistant anlegen",
    count: (n) => (n === 1 ? "1 Messung" : `${n} Messungen`),
    start: "Start",
    errors: {
      name_exists: "Es gibt bereits eine Person mit diesem Namen.",
      invalid_name: "Ungültiger Name.",
      invalid_range: "Das minimale Gewicht muss kleiner als das maximale sein.",
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
    absolute: "kg",
    relative: "Change",
    chartEmpty: "No measurements in the selected range.",
    measurement: "Measurement",
    monthly: "Monthly average",
    month: "Month",
    list: "Measurements",
    all: "All",
    date: "Date",
    person: "Person",
    weight: "Weight",
    source: "Detected",
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
    sensorsHint: "⚠️ Sensors are visible to all Home Assistant users. Only enable them for automations.",
    saved: "Saved",
    me: "Me",
    tabOverview: "Overview",
    tabMeasurements: "Measurements",
    tabSettings: "Settings",
    scale: "Scale",
    scaleHint: "Which sensor reports the weight, and how strict is the assignment?",
    name: "Name",
    source: "Weight sensor of the scale",
    minWeight: "Minimum weight (kg)",
    minWeightHint: "Lighter readings (bags, pets) are ignored.",
    maxWeight: "Maximum weight (kg)",
    tolerance: "Tolerance (kg)",
    toleranceHint: "How far a reading may differ from the previous weight. Grows by 0.15 kg per day without a measurement.",
    margin: "Ambiguity margin (kg)",
    marginHint: "If several persons match, the closest must be this much closer – otherwise you are asked.",
    debounce: "Wait until stable (s)",
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
    startWeight: "Start weight (kg)",
    startWeightHint: "Approximate current weight.",
    height: "Height (cm)",
    heightHint: "Optional, for the BMI.",
    goalWeight: "Goal weight (kg)",
    goalWeightHint: "Optional, for progress and forecast.",
    presence: "Presence",
    presenceHint: "Optional. If only one matching person is home, they get the measurement.",
    linkedUser: "Home Assistant user",
    linkedUserHint: "This user sees their data and can assign, add and delete their own measurements.",
    none: "— none —",
    noUser: "— no user —",
    viewers: "May also view",
    viewersHint: "Read only. Admins always see everything.",
    noOtherUsers: "No other users.",
    createSensors: "Create sensors in Home Assistant",
    count: (n) => (n === 1 ? "1 measurement" : `${n} measurements`),
    start: "Start",
    errors: {
      name_exists: "A person with this name already exists.",
      invalid_name: "Invalid name.",
      invalid_range: "The minimum weight must be lower than the maximum weight.",
    },
  },
};

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
  .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px 16px; margin-top: 12px; }
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
  .form-error { color: var(--error-color, #db4437); font-size: 13px; margin-top: 8px; }
  .content { max-width: 1200px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
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
    this._hidden = new Set();
    this._listPerson = "all";
    this._listLimit = 15;
    this._chartWidth = 0;
    this._chartPoints = [];
    this._tab = "overview";
    this._editPerson = null; // person id, "new" or null
    this._formState = {}; // unsaved form input, survives live updates
    this._dirty = new Set();
    this._formErrors = {};
  }

  // ------------------------------------------------------------ HA plumbing

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) this._init();
    if (this._menuButton) this._menuButton.hass = hass;
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
        <div class="toolbar"><span id="menu"></span><div class="title"></div><span id="scale"></span></div>
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
    root.addEventListener("input", (ev) => this._markDirty(ev));
    root.addEventListener("pointermove", (ev) => this._onPointer(ev));
    root.addEventListener("pointerleave", () => this._hideHover(), true);
    this._resizeObserver = new ResizeObserver(() => {
      const el = root.getElementById("chart");
      if (el && Math.abs(el.clientWidth - this._chartWidth) > 2) this._renderChart();
    });
    if (this.isConnected) this._subscribe();
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

  _personColor(personId) {
    const person = this._entry.persons.find((p) => p.id === personId);
    return person ? this._color(person.color_index) : "var(--wt-muted)";
  }

  _kg(value, { signed = false, unit = true, digits = 1 } = {}) {
    if (value === null || value === undefined || Number.isNaN(value)) return "–";
    const fmt = new Intl.NumberFormat(this._lang, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    let text = fmt.format(Math.abs(value));
    if (signed) text = (value > 0.0499 ? "+" : value < -0.0499 ? "−" : "±") + text;
    else if (value < 0) text = "−" + text;
    return unit ? `${text} kg` : text;
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

  _assigned(personId) {
    return this._entry.measurements.filter((m) => m.status === "assigned" && m.person_id === personId);
  }

  // ----------------------------------------------------------------- render

  _render() {
    if (!this._data) return;
    const t = this._t;
    const entries = this._data.entries;
    const scaleSlot = this.shadowRoot.getElementById("scale");
    scaleSlot.innerHTML = entries.length > 1
      ? `<select data-action="scale">${entries.map((e) => `<option value="${esc(e.entry_id)}" ${e === this._entry ? "selected" : ""}>${esc(e.title)}</option>`).join("")}</select>`
      : "";
    const tabs = [["overview", t.tabOverview], ["measurements", t.tabMeasurements]];
    if (this._isAdmin) tabs.push(["settings", t.tabSettings]);
    if (!tabs.some(([key]) => key === this._tab)) this._tab = "overview";
    this.shadowRoot.getElementById("tabs").innerHTML = entries.length
      ? tabs.map(([key, label]) => `<button class="tab" role="tab" data-action="tab" data-tab="${key}" aria-selected="${this._tab === key}">${esc(label)}</button>`).join("")
      : "";
    if (!entries.length) {
      this._content(`<div class="message">${esc(t.noScale)}</div>`);
      return;
    }

    this._captureForms();
    if (this._tab === "settings") {
      this._content(this._renderSettings());
    } else if (!this._entry.persons.length) {
      this._content(this._isAdmin
        ? `<div class="card message">${esc(t.noPersonsAdmin)}<div class="actions" style="justify-content:center"><button class="btn primary" data-action="tab" data-tab="settings">${esc(t.toSettings)}</button></div></div>`
        : `<div class="message">${esc(t.noAccess)}</div>`);
    } else if (this._tab === "measurements") {
      const canAdd = this._entry.persons.some((p) => p.can_manage);
      this._content(`
        ${this._renderPending()}
        <div class="split">
          <div class="card">${this._renderList()}</div>
          <div class="side">${canAdd ? `<div class="card">${this._renderAddForm()}</div>` : ""}</div>
        </div>`);
    } else {
      this._content(`
        ${this._renderPending()}
        <div class="persons">${this._entry.persons.map((p) => this._renderPerson(p, p.color_index)).join("")}</div>
        <div class="card">
          ${this._renderChartHead()}
          <div class="chart" id="chart"></div>
        </div>
        ${this._renderMonthly()}`);
    }
    this._restoreForms();
    this._resizeObserver.disconnect();
    const chart = this.shadowRoot.getElementById("chart");
    if (chart) {
      this._resizeObserver.observe(chart);
      this._renderChart();
    }
  }

  _renderPending() {
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
          <div class="row"><span>${esc(t.goal)} ${this._kg(person.goal)}</span><span class="num">${s.goal_reached ? "" : esc(t.goalLeft(this._kg(Math.abs(s.goal_remaining))))}</span></div>
          <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress * 100)}"><div style="width:${(progress * 100).toFixed(1)}%;background:${color}"></div></div>
          <div class="muted small">${esc(eta)} · ${Math.round(progress * 100)} %</div>
        </div>`;
    }
    const stat = (label, value) => `<div class="stat"><div class="label">${esc(label)}</div><div class="val num">${value}</div></div>`;
    return `
      <div class="card">
        <div class="person-head"><span class="dot" style="background:${color}"></span><h2>${esc(person.name)}</h2>
          <span class="muted small">${latestTs ? `${esc(t.measured)} ${esc(this._relative(latestTs))}` : esc(t.noData)}</span></div>
        <div class="hero"><span class="value num">${this._kg(s.latest_weight, { unit: false })}</span><span class="unit">kg</span>
          ${s.change_last !== null && s.change_last !== undefined ? `<span class="muted small num">${this._kg(s.change_last, { signed: true })}</span>` : ""}</div>
        <div class="stats">
          ${stat(t.trend, this._kg(s.trend))}
          ${stat(t.d7, this._kg(s.change_7d, { signed: true }))}
          ${stat(t.d30, this._kg(s.change_30d, { signed: true }))}
          ${stat(t.perWeek, this._kg(s.rate_per_week, { signed: true, digits: 2 }))}
          ${stat(t.total, this._kg(s.change_total, { signed: true }))}
          ${person.height ? stat(t.bmi, s.bmi ? `${this._kg(s.bmi, { unit: false })} <span class="muted small">${esc(t.bmiCat(s.bmi))}</span>` : "–") : stat("Min / Max", s.min_weight ? `${this._kg(s.min_weight, { unit: false })} / ${this._kg(s.max_weight, { unit: false })}` : "–")}
        </div>
        ${goalHtml}
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
        </div>
        <div class="chips" role="group">
          ${RANGES.map((r) => `<button class="chip" data-action="range" data-range="${r.key}" aria-pressed="${this._range === r.key}">${de ? r.de : r.en}</button>`).join("")}
        </div>
      </div>`;
  }

  _renderList() {
    const t = this._t;
    const persons = this._entry.persons;
    let rows = this._entry.measurements.filter((m) => m.status !== "discarded" || this._listPerson === "all");
    if (this._listPerson !== "all") rows = rows.filter((m) => m.person_id === this._listPerson);
    rows = rows.slice().reverse();
    const shown = rows.slice(0, this._listLimit);
    const previous = {};
    // change vs. the previous measurement of the same person
    for (const m of this._entry.measurements) {
      if (m.status !== "assigned") continue;
      if (previous[m.person_id] !== undefined) m._delta = m.weight - previous[m.person_id];
      previous[m.person_id] = m.weight;
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
          <thead><tr><th>${esc(t.date)}</th><th class="r">${esc(t.weight)}</th><th class="r">±</th><th>${esc(t.person)}</th><th>${esc(t.source)}</th><th></th></tr></thead>
          <tbody>
            ${shown.map((m) => `
              <tr>
                <td class="num">${esc(this._dateTime(m.ts))}</td>
                <td class="r num"><b>${this._kg(m.weight, { unit: false })}</b></td>
                <td class="r num muted">${m.status === "assigned" && m._delta !== undefined ? this._kg(m._delta, { signed: true, unit: false }) : ""}</td>
                <td>${this._renderPersonCell(m)}</td>
                <td><span class="tag ${m.status === "pending" ? "warn" : ""}">${esc(m.status === "pending" ? t.open : m.status === "discarded" ? t.discarded : t.methods[m.method] || m.method)}</span></td>
                <td class="r">${this._canDelete(m) ? `<button class="icon-btn" data-action="delete" data-id="${esc(m.id)}" title="${esc(t.deleteLabel)}" aria-label="${esc(t.deleteLabel)}">✕</button>` : ""}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
      ${!shown.length ? `<div class="message">${esc(t.noData)}</div>` : ""}
      ${rows.length > shown.length ? `<button class="btn more" data-action="more">${esc(t.more)} (${rows.length - shown.length})</button>` : ""}`;
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
    return `
      <div class="card">
        <h2>🔒 ${esc(t.access)}</h2>
        <div class="muted small" style="margin-top:4px">${esc(t.accessHint)}</div>
        <div class="table-wrap"><table>
          <thead><tr><th>${esc(t.user)}</th>${persons.map((p) => `<th><span class="who"><span class="dot" style="background:${this._color(p.color_index)}"></span>${esc(p.name)}</span></th>`).join("")}</tr></thead>
          <tbody>
            ${users.map((u) => `<tr><td>${esc(u.name)} ${u.is_admin ? `<span class="tag">· ${esc(t.admin)}</span>` : ""}</td>${persons.map((p) => `<td>${cell(u, p)}</td>`).join("")}</tr>`).join("")}
            <tr><td>${esc(t.sensors)}</td>${persons.map((p) => `<td><input type="checkbox" data-action="sensors" data-person="${esc(p.id)}" ${p.create_sensors ? "checked" : ""} aria-label="${esc(`${t.sensors} – ${p.name}`)}"></td>`).join("")}</tr>
          </tbody>
        </table></div>
        <div class="muted small" style="margin-top:8px">${esc(t.sensorsHint)}</div>
      </div>`;
  }

  _renderSettings() {
    return `${this._renderScaleSettings()}${this._renderPersonsSettings()}${this._entry.persons.length ? this._renderAccess() : ""}`;
  }

  _field(label, input, hint = "", wide = false) {
    return `<label class="${wide ? "wide" : ""}">${esc(label)}${input}${hint ? `<span class="hint">${esc(hint)}</span>` : ""}</label>`;
  }

  _num(name, value, { step = 0.1, min = 0, max = 500, required = false } = {}) {
    const v = value === null || value === undefined ? "" : value;
    // Text input instead of type=number: accepts "75,5" and "75.5" in every browser (incl. iOS).
    const shown = v === "" ? "" : this._kg(Number(v), { unit: false, digits: step >= 1 ? 0 : 1 }).replace("−", "-");
    return `<input name="${name}" type="text" inputmode="decimal" autocomplete="off" pattern="${DECIMAL_PATTERN}" value="${esc(shown)}" ${required ? "required" : ""}>`;
  }

  _entityOptions(predicate, current, emptyLabel) {
    const states = Object.values(this._hass.states || {}).filter(predicate);
    if (current && !states.some((st) => st.entity_id === current)) states.push({ entity_id: current, attributes: {} });
    states.sort((a, b) => (a.attributes.friendly_name || a.entity_id).localeCompare(b.attributes.friendly_name || b.entity_id));
    const empty = emptyLabel !== undefined ? `<option value="">${esc(emptyLabel)}</option>` : "";
    return empty + states.map((st) => {
      const name = st.attributes.friendly_name || st.entity_id;
      const unit = st.attributes.unit_of_measurement;
      const value = st.state !== undefined && unit ? ` – ${st.state} ${unit}` : "";
      return `<option value="${esc(st.entity_id)}" ${st.entity_id === current ? "selected" : ""}>${esc(`${name} (${st.entity_id})${value}`)}</option>`;
    }).join("");
  }

  _renderScaleSettings() {
    const t = this._t;
    const cfg = this._entry.settings || {};
    const units = ["kg", "g", "lb", "lbs", "st", "oz"];
    const isWeight = (st) => st.entity_id.startsWith("sensor.") && (units.includes(st.attributes.unit_of_measurement) || st.attributes.device_class === "weight");
    return `
      <div class="card">
        <h2>⚖️ ${esc(t.scale)}</h2>
        <div class="hint" style="margin-top:4px">${esc(t.scaleHint)}</div>
        <form class="form" id="settings-form">
          <div class="fields">
            ${this._field(t.name, `<input name="name" type="text" maxlength="50" required value="${esc(this._entry.title)}">`)}
            ${this._field(t.source, `<select name="source_entity" required>${this._entityOptions(isWeight, cfg.source_entity)}</select>`)}
            ${this._field(t.minWeight, this._num("min_weight", cfg.min_weight, { step: 0.5, min: 1, max: 300, required: true }), t.minWeightHint)}
            ${this._field(t.maxWeight, this._num("max_weight", cfg.max_weight, { step: 0.5, min: 1, max: 500, required: true }))}
            ${this._field(t.tolerance, this._num("tolerance", cfg.tolerance, { min: 0.5, max: 20, required: true }), t.toleranceHint)}
            ${this._field(t.margin, this._num("ambiguity_margin", cfg.ambiguity_margin, { min: 0.1, max: 10, required: true }), t.marginHint)}
            ${this._field(t.debounce, this._num("debounce_seconds", cfg.debounce_seconds, { step: 1, min: 0, max: 120, required: true }), t.debounceHint)}
          </div>
          ${this._formErrors["settings-form"] ? `<div class="form-error">${esc(this._formErrors["settings-form"])}</div>` : ""}
          <div class="actions"><button class="btn primary" type="submit">${esc(t.save)}</button></div>
        </form>
      </div>`;
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
      ].filter(Boolean);
      return `
        <div class="person-row">
          <span class="dot" style="background:${this._color(p.color_index)}"></span>
          <div class="info"><b>${esc(p.name)}</b><div class="hint">${esc(bits.join(" · "))}</div></div>
          <button class="btn" data-action="edit-person" data-person="${esc(p.id)}">${esc(t.edit)}</button>
        </div>`;
    }).join("");
    return `
      <div class="card">
        <h2>👥 ${esc(t.persons)}</h2>
        <div class="hint" style="margin-top:4px">${esc(t.personsHint)}</div>
        <div style="margin-top:8px">${rows}</div>
        ${this._editPerson === "new" ? this._renderPersonEditor(null) : `<div class="actions"><button class="btn primary" data-action="edit-person" data-person="new">＋ ${esc(t.addPerson)}</button></div>`}
      </div>`;
  }

  _renderPersonEditor(person) {
    const t = this._t;
    const p = person || { viewers: [] };
    const id = person ? person.id : "new";
    const formId = `person-form-${id}`;
    const users = this._data.users || [];
    const isPresence = (st) => st.entity_id.startsWith("person.") || st.entity_id.startsWith("device_tracker.");
    const viewerUsers = users.filter((u) => !u.is_admin && u.id !== p.user_id);
    const counts = this._entry.measurements.filter((m) => m.person_id === id).length;
    return `
      <form class="form editor" id="${esc(formId)}" data-person="${esc(id)}">
        <h3>${person ? `<span class="dot" style="background:${this._color(p.color_index)}"></span>${esc(p.name)}` : esc(t.newPerson)}</h3>
        <div class="fields">
          ${this._field(t.name, `<input name="name" type="text" maxlength="50" required value="${esc(p.name || "")}">`)}
          ${this._field(t.startWeight, this._num("start_weight", p.start_weight, { min: 1, max: 300, required: true }), t.startWeightHint)}
          ${this._field(t.height, this._num("height", p.height, { step: 1, min: 50, max: 250 }), t.heightHint)}
          ${this._field(t.goalWeight, this._num("goal_weight", p.goal, { min: 1, max: 300 }), t.goalWeightHint)}
          ${this._field(t.presence, `<select name="person_entity">${this._entityOptions(isPresence, p.person_entity, t.none)}</select>`, t.presenceHint)}
          ${this._field(t.linkedUser, `<select name="user_id"><option value="">${esc(t.noUser)}</option>${users.map((u) => `<option value="${esc(u.id)}" ${p.user_id === u.id ? "selected" : ""}>${esc(u.name)}${u.is_admin ? ` (${esc(t.admin)})` : ""}</option>`).join("")}</select>`, t.linkedUserHint)}
          <div class="wide">
            <div class="hint" style="margin-bottom:6px">${esc(t.viewers)} – ${esc(t.viewersHint)}</div>
            <div class="checks">${viewerUsers.length ? viewerUsers.map((u) => `<label class="check"><input type="checkbox" name="viewers" value="${esc(u.id)}" ${(p.viewers || []).includes(u.id) ? "checked" : ""}>${esc(u.name)}</label>`).join("") : `<span class="hint">${esc(t.noOtherUsers)}</span>`}</div>
          </div>
          <div class="wide">
            <label class="check"><input type="checkbox" name="create_sensors" value="1" ${p.create_sensors ? "checked" : ""}>${esc(t.createSensors)}</label>
            <div class="hint" style="margin-top:4px">${esc(t.sensorsHint)}</div>
          </div>
        </div>
        ${this._formErrors[formId] ? `<div class="form-error">${esc(this._formErrors[formId])}</div>` : ""}
        <div class="actions">
          <button class="btn primary" type="submit">${esc(t.save)}</button>
          <button class="btn" type="button" data-action="cancel-edit" data-form="${esc(formId)}">${esc(t.cancel)}</button>
          <span class="spacer"></span>
          ${person ? `<button class="btn danger" type="button" data-action="delete-person" data-person="${esc(id)}" data-count="${counts}">${esc(t.deletePerson)}</button>` : ""}
        </div>
      </form>`;
  }

  async _ws(message) {
    return this._hass.callWS({ entry_id: this._entry.entry_id, ...message });
  }

  _errorText(err) {
    const code = err && (err.code || err.error);
    return (code && this._t.errors[code]) || (err && err.message) || String(err);
  }

  _clearForm(formId) {
    delete this._formState[formId];
    delete this._formErrors[formId];
    this._dirty.delete(formId);
  }

  async _saveSettings(form) {
    const data = new FormData(form);
    const num = (key) => parseFloat(String(data.get(key)).replace(",", "."));
    try {
      await this._ws({
        type: "weight_tracker/update_settings",
        settings: {
          name: String(data.get("name") || "").trim(),
          source_entity: data.get("source_entity"),
          min_weight: num("min_weight"),
          max_weight: num("max_weight"),
          tolerance: num("tolerance"),
          ambiguity_margin: num("ambiguity_margin"),
          debounce_seconds: Math.round(num("debounce_seconds")),
        },
      });
      this._clearForm(form.id);
      this._toast(this._t.saved);
    } catch (err) {
      this._formErrors[form.id] = this._errorText(err);
    }
    this._render();
  }

  async _savePerson(form) {
    const data = new FormData(form);
    const optNum = (key) => {
      const raw = String(data.get(key) || "").replace(",", ".").trim();
      return raw ? parseFloat(raw) : null;
    };
    const id = form.dataset.person;
    try {
      await this._ws({
        type: "weight_tracker/save_person",
        person: {
          person_id: id === "new" ? null : id,
          name: String(data.get("name") || "").trim(),
          start_weight: optNum("start_weight"),
          height: optNum("height"),
          goal_weight: optNum("goal_weight"),
          person_entity: data.get("person_entity") || null,
          user_id: data.get("user_id") || null,
          viewers: data.getAll("viewers"),
          create_sensors: data.get("create_sensors") === "1",
        },
      });
      this._clearForm(form.id);
      this._editPerson = null;
      this._toast(this._t.saved);
    } catch (err) {
      this._formErrors[form.id] = this._errorText(err);
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

  // Keep unsaved input when live updates re-render the page.
  _markDirty(ev) {
    const form = ev.composedPath().find((n) => n.tagName === "FORM");
    if (form && form.id) this._dirty.add(form.id);
  }

  _captureForms() {
    for (const id of this._dirty) {
      const form = this.shadowRoot.getElementById(id);
      if (!form) continue;
      this._formState[id] = [...form.elements]
        .filter((el) => el.name)
        .map((el) => ({ name: el.name, value: el.value, checked: el.checked, type: el.type }));
    }
  }

  _restoreForms() {
    for (const [id, fields] of Object.entries(this._formState)) {
      const form = this.shadowRoot.getElementById(id);
      if (!form) continue;
      for (const el of form.elements) {
        if (!el.name) continue;
        if (el.type === "checkbox" || el.type === "radio") {
          const field = fields.find((f) => f.name === el.name && f.value === el.value);
          if (field) el.checked = field.checked;
        } else {
          const field = fields.find((f) => f.name === el.name);
          if (field) el.value = field.value;
        }
      }
    }
    const add = this.shadowRoot.getElementById("add-form");
    if (add && !add.ts.value) {
      const pad = (n) => String(n).padStart(2, "0");
      const d = new Date();
      add.ts.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
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
    return `
      <h2>${esc(t.add)}</h2>
      <form class="form" id="add-form">
        <label>${esc(t.person)}
          <select name="person" required>${this._entry.persons.filter((p) => p.can_manage).map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select></label>
        <label>${esc(t.weight)} (kg)
          <input name="weight" type="text" inputmode="decimal" autocomplete="off" pattern="${DECIMAL_PATTERN}" required></label>
        <label>${esc(t.date)}
          <input name="ts" type="datetime-local" required></label>
        <button class="btn primary" type="submit">${esc(t.addButton)}</button>
      </form>`;
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
      (bucket[m.person_id] = bucket[m.person_id] || []).push(m.weight);
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

    let lo = Infinity, hi = -Infinity;
    for (const s of series) {
      for (const m of s.pts) {
        for (const v of [m.weight, m.trend]) {
          if (v === null || v === undefined) continue;
          lo = Math.min(lo, v - s.base);
          hi = Math.max(hi, v - s.base);
        }
      }
      if (this._mode === "abs" && s.person.goal !== null && s.person.goal !== undefined) {
        lo = Math.min(lo, s.person.goal);
        hi = Math.max(hi, s.person.goal);
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
    const x = (ts) => m.l + ((ts - t0) / (now - t0)) * iw;
    const y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * ih;

    let svg = `<svg viewBox="0 0 ${width} ${height}" height="${height}" role="img" aria-label="${esc(t.history)}">`;
    // grid + y axis
    for (let v = lo; v <= hi + 1e-9; v += step) {
      const yy = y(v).toFixed(1);
      const zero = this._mode === "rel" && Math.abs(v) < 1e-9;
      svg += `<line x1="${m.l}" x2="${width - m.r}" y1="${yy}" y2="${yy}" stroke="var(--wt-grid)" stroke-width="${zero ? 1.5 : 1}" ${zero ? "" : 'stroke-dasharray="2 4"'}/>`;
      svg += `<text x="${m.l - 8}" y="${yy}" text-anchor="end" dominant-baseline="middle">${esc(this._kg(v, { unit: false, signed: this._mode === "rel" && v !== 0, digits: step < 1 ? 1 : 0 }))}</text>`;
    }
    // x axis
    for (const tick of this._timeTicks(t0, now, Math.max(2, Math.floor(iw / 90)))) {
      const xx = x(tick.t).toFixed(1);
      svg += `<line x1="${xx}" x2="${xx}" y1="${height - m.b}" y2="${height - m.b + 4}" stroke="var(--wt-grid)"/>`;
      svg += `<text x="${xx}" y="${height - 8}" text-anchor="middle">${esc(this._date(tick.t, tick.fmt))}</text>`;
    }
    svg += `<line x1="${m.l}" x2="${width - m.r}" y1="${height - m.b}" y2="${height - m.b}" stroke="var(--wt-grid)"/>`;

    this._chartPoints = [];
    const labels = [];
    for (const s of series) {
      // goal line
      if (this._mode === "abs" && s.person.goal !== null && s.person.goal !== undefined) {
        const gy = y(s.person.goal).toFixed(1);
        svg += `<line x1="${m.l}" x2="${width - m.r}" y1="${gy}" y2="${gy}" stroke="${s.color}" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.7"/>`;
        svg += `<text x="${m.l + 4}" y="${(y(s.person.goal) - 5).toFixed(1)}">${esc(t.goal)} ${esc(s.person.name)}</text>`;
      }
      // measurements (dots)
      for (const p of s.pts) {
        const px = x(p.ts), py = y(p.weight - s.base);
        svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4" fill="${s.color}" fill-opacity="0.35" stroke="${s.color}" stroke-opacity="0.6" stroke-width="1"/>`;
        this._chartPoints.push({ px, py, m: p, s });
      }
      // trend line
      const trendPts = s.pts.filter((p) => p.trend !== null && p.trend !== undefined);
      if (trendPts.length > 1) {
        const d = trendPts.map((p, i) => `${i ? "L" : "M"}${x(p.ts).toFixed(1)},${y(p.trend - s.base).toFixed(1)}`).join("");
        svg += `<path d="${d}" fill="none" stroke="var(--wt-card)" stroke-width="3.5" stroke-opacity="0.7" stroke-linejoin="round" stroke-linecap="round"/>`;
        svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      }
      const last = trendPts[trendPts.length - 1] || s.pts[s.pts.length - 1];
      labels.push({ y: y((last.trend ?? last.weight) - s.base), x: x(last.ts), name: s.person.name, color: s.color });
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
    const svg = path.find((n) => n.tagName === "svg");
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
    const rel = this._mode === "rel" ? `<div class="muted small">${esc(t.relative)}: ${this._kg(best.m.weight - best.s.base, { signed: true })}</div>` : "";
    tip.innerHTML = `
      <div class="t-head"><span class="dot" style="background:${best.s.color}"></span>${esc(best.s.person.name)}</div>
      <div class="muted small">${esc(this._dateTime(best.m.ts))}</div>
      <div>${esc(t.measurement)}: <b class="num">${this._kg(best.m.weight)}</b></div>
      ${best.m.trend !== null && best.m.trend !== undefined ? `<div>${esc(t.trend)}: <span class="num">${this._kg(best.m.trend)}</span></div>` : ""}
      ${rel}`;
    tip.style.display = "block";
    const cssX = best.px / scale, cssY = best.py / scale;
    const tipW = tip.offsetWidth, tipH = tip.offsetHeight;
    let left = cssX + 12;
    if (left + tipW > rect.width) left = cssX - tipW - 12;
    tip.style.left = `${Math.max(0, left)}px`;
    tip.style.top = `${Math.max(0, Math.min(cssY - tipH / 2, rect.height - tipH))}px`;
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
    if (action === "tab") {
      this._tab = el.dataset.tab;
      this._render();
      this.shadowRoot.querySelector(".scroller").scrollTop = 0;
    } else if (action === "edit-person") {
      this._editPerson = el.dataset.person;
      this._render();
      const form = this.shadowRoot.getElementById(`person-form-${el.dataset.person}`);
      if (form) {
        form.scrollIntoView({ block: "nearest", behavior: "smooth" });
        form.querySelector("input[name=name]").focus({ preventScroll: true });
      }
    } else if (action === "cancel-edit") {
      this._clearForm(el.dataset.form);
      this._editPerson = null;
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
    this._markDirty(ev);
    const el = ev.composedPath()[0];
    if (!el.dataset) return;
    if (el.dataset.action === "reassign" && el.value) {
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
    } else if (el.dataset.action === "sensors") {
      this._setAccess(el.dataset.person, { create_sensors: el.checked });
    } else if (el.dataset.action === "scale") {
      this._entryId = el.value;
      this._hidden.clear();
      this._listPerson = "all";
      this._render();
    }
  }

  async _onSubmit(ev) {
    ev.preventDefault();
    const form = ev.composedPath()[0];
    if (form.id === "settings-form") return this._saveSettings(form);
    if (form.id && form.id.startsWith("person-form-")) return this._savePerson(form);
    if (form.id !== "add-form") return;
    const data = new FormData(form);
    const weight = parseFloat(String(data.get("weight")).replace(",", "."));
    if (!weight) return;
    const ts = String(data.get("ts") || "");
    await this._call("add_measurement", {
      person: data.get("person"),
      weight,
      ...(ts ? { timestamp: `${ts.replace("T", " ")}:00`.slice(0, 19) } : {}),
    });
    this._clearForm("add-form");
    this._render();
  }

}

if (!customElements.get("weight-tracker-panel")) {
  customElements.define("weight-tracker-panel", WeightTrackerPanel);
}
