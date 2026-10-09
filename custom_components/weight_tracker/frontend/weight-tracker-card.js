/*
 * Weight Tracker – dashboard card.
 *
 *   type: custom:weight-tracker-card
 *   person: Gabriel      # optional: person or pet name; default = yourself
 *   chart_days: 30       # optional: 0 hides the chart
 *
 * Uses the same websocket subscription as the panel, so every user only ever
 * receives data they are allowed to see.
 */

const WT_DAY = 864e5;
const WT_COLORS = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
};
const WT_SPECIES = { cat: "🐱", dog: "🐶", rabbit: "🐰", guinea_pig: "🐹" };
const wtEsc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const WT_TEXT = {
  de: { noData: "Keine Daten", notFound: (n) => `„${n}“ nicht gefunden oder nicht freigegeben.`, loading: "Lade …", trend: "Trend", d7: "7 Tage", goal: "Ziel", left: (kg) => `noch ${kg}`, reached: "Ziel erreicht 🎉", person: "Person oder Haustier (leer = du selbst)", days: "Tage im Verlauf (0 = aus)" },
  en: { noData: "No data", notFound: (n) => `“${n}” not found or not shared with you.`, loading: "Loading …", trend: "Trend", d7: "7 days", goal: "Goal", left: (kg) => `${kg} to go`, reached: "Goal reached 🎉", person: "Person or pet (empty = yourself)", days: "Days in chart (0 = off)" },
};

class WeightTrackerCard extends HTMLElement {
  static getConfigForm() {
    return {
      schema: [
        { name: "person", selector: { text: {} } },
        { name: "chart_days", selector: { number: { min: 0, max: 365, step: 1, mode: "box" } } },
      ],
      computeLabel: (schema) => {
        const t = (document.querySelector("home-assistant")?.hass?.language || "en").startsWith("de") ? WT_TEXT.de : WT_TEXT.en;
        return schema.name === "person" ? t.person : t.days;
      },
    };
  }

  static getStubConfig() {
    return { chart_days: 30 };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = { chart_days: 30 };
    this._data = null;
  }

  setConfig(config) {
    this._config = { chart_days: 30, ...config };
    this._render();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first && this.isConnected) this._subscribe();
    const dark = Boolean(hass.themes && hass.themes.darkMode);
    if (dark !== this._dark) {
      this._dark = dark;
      this._render();
    }
  }

  connectedCallback() {
    if (this._hass && !this._unsub && !this._subscribing) this._subscribe();
  }

  disconnectedCallback() {
    if (this._unsub) {
      this._unsub();
      this._unsub = null;
    }
  }

  getCardSize() {
    return this._config.chart_days ? 4 : 3;
  }

  getGridOptions() {
    return { columns: 6, rows: this._config.chart_days ? 4 : 3, min_columns: 4, min_rows: 2 };
  }

  get _t() {
    return ((this._hass && this._hass.language) || "en").startsWith("de") ? WT_TEXT.de : WT_TEXT.en;
  }

  get _lang() {
    return (this._hass && this._hass.locale && this._hass.locale.language) || (this._hass && this._hass.language) || "en";
  }

  async _subscribe() {
    this._subscribing = true;
    try {
      this._unsub = await this._hass.connection.subscribeMessage((data) => {
        this._data = data;
        this._render();
      }, { type: "weight_tracker/subscribe" });
    } catch (err) {
      this._error = err.message || String(err);
      this._render();
    } finally {
      this._subscribing = false;
    }
  }

  // Same display unit as the panel (kg / lb; st is shown as lb here).
  get _unitLabel() {
    let unit = null;
    try {
      unit = localStorage.getItem("wt-unit");
    } catch (err) {
      unit = null;
    }
    if (!unit) unit = this._hass && this._hass.config && this._hass.config.unit_system && this._hass.config.unit_system.mass === "lb" ? "lb" : "kg";
    return unit === "kg" ? "kg" : "lb";
  }

  _kg(value, digits = 1, signed = false) {
    if (value === null || value === undefined || Number.isNaN(value)) return "–";
    const label = this._unitLabel;
    const v = label === "kg" ? value : value * 2.20462262;
    const text = new Intl.NumberFormat(this._lang, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(v));
    if (signed) return `${v > 0.049 ? "+" : v < -0.049 ? "−" : "±"}${text} ${label}`;
    return `${v < 0 ? "−" : ""}${text} ${label}`;
  }

  // The configured person/pet, or the user's own person.
  _subject() {
    const entries = (this._data && this._data.entries) || [];
    const wanted = (this._config.person || "").trim().toLowerCase();
    for (const entry of entries) {
      const persons = entry.persons || [], pets = entry.pets || [];
      const match = wanted
        ? persons.find((p) => p.name.toLowerCase() === wanted) || pets.find((p) => p.name.toLowerCase() === wanted)
        : persons.find((p) => p.is_me) || persons[0];
      if (match) return { entry, subject: match, isPet: pets.includes(match) };
    }
    return null;
  }

  _chart(entry, subject, isPet, color) {
    const days = Number(this._config.chart_days) || 0;
    if (!days) return "";
    const since = Date.now() - days * WT_DAY;
    const pts = isPet
      ? (entry.pet_measurements || []).filter((m) => m.pet_id === subject.id && m.ts >= since)
      : (entry.measurements || []).filter((m) => m.status === "assigned" && m.person_id === subject.id && m.ts >= since);
    if (pts.length < 2) return "";
    const W = 300, H = 70, pad = 4;
    const values = pts.map((m) => m.trend ?? m.weight);
    let lo = Math.min(...values), hi = Math.max(...values);
    if (hi - lo < 0.5) { lo -= 0.25; hi += 0.25; }
    const t0 = pts[0].ts, t1 = pts[pts.length - 1].ts;
    const x = (ts) => pad + ((ts - t0) / Math.max(t1 - t0, 1)) * (W - 2 * pad);
    const y = (v) => pad + (1 - (v - lo) / (hi - lo)) * (H - 2 * pad);
    const d = pts.map((m, i) => `${i ? "L" : "M"}${x(m.ts).toFixed(1)},${y(m.trend ?? m.weight).toFixed(1)}`).join("");
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="chart" aria-hidden="true">
      <path d="${d}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
    </svg>`;
  }

  _render() {
    if (!this.shadowRoot) return;
    const t = this._t;
    let body;
    if (this._error) body = `<div class="msg">${wtEsc(this._error)}</div>`;
    else if (!this._data) body = `<div class="msg">${wtEsc(t.loading)}</div>`;
    else {
      const found = this._subject();
      if (!found) body = `<div class="msg">${wtEsc(this._config.person ? t.notFound(this._config.person) : t.noData)}</div>`;
      else {
        const { entry, subject, isPet } = found;
        const s = subject.stats || {};
        const color = (this._dark ? WT_COLORS.dark : WT_COLORS.light)[(subject.color_index || 0) % 8];
        const avatar = isPet
          ? `<span class="avatar pet">${WT_SPECIES[subject.species] || "🐾"}</span>`
          : subject.picture
            ? `<span class="avatar" style="box-shadow:0 0 0 2px ${color}"><img src="${wtEsc(subject.picture)}" alt=""></span>`
            : `<span class="avatar" style="background:${color}">${wtEsc(subject.name.slice(0, 1).toUpperCase())}</span>`;
        let goal = "";
        if (subject.goal && s.trend !== null && s.trend !== undefined) {
          const start = s.first_weight ?? subject.start_weight;
          const span = start - subject.goal;
          const progress = span ? Math.min(1, Math.max(0, (start - s.trend) / span)) : 1;
          goal = `<div class="goal"><div class="row"><span>${wtEsc(t.goal)} ${this._kg(subject.goal)}</span><span>${s.goal_reached ? wtEsc(t.reached) : wtEsc(t.left(this._kg(Math.abs(s.goal_remaining))))}</span></div>
            <div class="bar"><div style="width:${(progress * 100).toFixed(1)}%;background:${color}"></div></div></div>`;
        }
        const digits = isPet && s.latest_weight < 10 ? 2 : 1;
        body = `
          <div class="head">${avatar}<div class="name">${wtEsc(subject.name)}</div></div>
          <div class="hero"><span class="value">${s.latest_weight !== null && s.latest_weight !== undefined ? this._kg(s.latest_weight, digits).replace(` ${this._unitLabel}`, "") : "–"}</span><span class="unit">${this._unitLabel}</span></div>
          <div class="stats"><span>${wtEsc(t.trend)} <b>${this._kg(s.trend, digits)}</b></span><span>${wtEsc(t.d7)} <b>${this._kg(s.change_7d, digits, true)}</b></span></div>
          ${goal}
          ${this._chart(entry, subject, isPet, color)}`;
      }
    }
    this.shadowRoot.innerHTML = `
      <style>
        ha-card { padding: 16px; cursor: pointer; height: 100%; box-sizing: border-box; }
        .msg { color: var(--secondary-text-color); padding: 8px 0; }
        .head { display: flex; align-items: center; gap: 10px; }
        .avatar { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-weight: 500; overflow: hidden; flex: none; }
        .avatar img { width: 100%; height: 100%; object-fit: cover; }
        .avatar.pet { background: rgba(127,127,127,.15); font-size: 18px; }
        .name { font-size: 16px; font-weight: 500; }
        .hero { display: flex; align-items: baseline; gap: 6px; margin-top: 8px; }
        .hero .value { font-size: 34px; font-weight: 500; line-height: 1.1; font-variant-numeric: tabular-nums; }
        .hero .unit { color: var(--secondary-text-color); }
        .stats { display: flex; gap: 16px; flex-wrap: wrap; font-size: 13px; color: var(--secondary-text-color); margin-top: 4px; }
        .stats b { color: var(--primary-text-color); font-weight: 500; }
        .goal { margin-top: 10px; font-size: 12px; color: var(--secondary-text-color); }
        .goal .row { display: flex; justify-content: space-between; gap: 8px; }
        .bar { height: 6px; border-radius: 3px; background: var(--divider-color); margin-top: 4px; overflow: hidden; }
        .bar > div { height: 100%; border-radius: 3px; }
        .chart { display: block; width: 100%; height: 56px; margin-top: 10px; }
      </style>
      <ha-card>${body}</ha-card>`;
    this.shadowRoot.querySelector("ha-card").addEventListener("click", () => {
      history.pushState(null, "", "/weight-tracker");
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
    });
  }
}

if (!customElements.get("weight-tracker-card")) {
  customElements.define("weight-tracker-card", WeightTrackerCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "weight-tracker-card",
    name: "Weight Tracker",
    description: "Gewicht, Trend, Ziel und Verlauf einer Person oder eines Haustiers.",
    preview: true,
    documentationURL: "https://github.com/Ga-Re/HAWeightTracker",
  });
}
