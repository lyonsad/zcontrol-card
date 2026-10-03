/** Z-Control Card: a dependency-free, read-only Home Assistant dashboard card. */
export const VERSION = "0.1.1";

const PRESETS = {
  "508": {
    title: "Aquanot 508 Fit", subtitle: "Battery backup system", icon: "mdi:pump",
    color: "#71608e", statuses: ["system_ready", "battery", "dc_pump", "float_status", "ac_power"],
  },
  apak: {
    title: "APak Indoor Alarm", subtitle: "Sump alarm monitor", icon: "mdi:alarm-light-outline",
    color: "#d5483d", statuses: ["input_1", "input_2", "ac_power", "battery"],
  },
  generic: {
    title: "Z-Control", subtitle: "Sump system monitor", icon: "mdi:water-alert-outline",
    color: "#277f86", statuses: ["ac_power", "battery"],
  },
};
const FIELDS = {
  online: ["binary_sensor", "online", "Connectivity"],
  system_ready: ["binary_sensor", "system_ready_alarm", "System Ready"],
  battery: ["binary_sensor", "battery", "Battery"],
  dc_pump: ["binary_sensor", "dc_pump_alarm", "DC Pump"],
  float_status: ["binary_sensor", "float_status_alarm", "Float Status"],
  ac_power: ["binary_sensor", "ac_power", "AC Power"],
  input_1: ["binary_sensor", "input_1", "Input 1"],
  input_2: ["binary_sensor", "input_2", "Input 2"],
  alarm_count: ["sensor", "alarm_count", "Active alarms"],
  battery_voltage: ["sensor", "battery_voltage", "Battery voltage"],
  battery_current: ["sensor", "battery_current", "Battery current"],
  dc_pump_current: ["sensor", "dc_pump_current", "DC pump current"],
  operational_float_count: ["sensor", "operational_float_count", "Operational float activations"],
  high_water_float_count: ["sensor", "high_water_float_count", "High-water float activations"],
  pump_runtime: ["sensor", "pump_runtime", "Pump runtime"],
  system_run_time: ["sensor", "system_run_time", "System runtime"],
  up_time: ["sensor", "up_time", "Uptime"],
  wifi_signal: ["sensor", "wifi_signal", "Wi-Fi signal"],
  last_heartbeat: ["sensor", "last_heartbeat", "Last heartbeat"],
};
const METRICS = ["battery_voltage", "battery_current", "dc_pump_current",
  "operational_float_count", "high_water_float_count", "pump_runtime", "system_run_time", "up_time"];

export function normalizeConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("Supply a card configuration.");
  const model = String(config.model ?? "generic").toLowerCase();
  if (!Object.hasOwn(PRESETS, model)) throw new Error('model must be "508", "apak", or "generic".');
  if (config.entity_prefix && !/^[a-z0-9_]+$/.test(config.entity_prefix)) throw new Error("entity_prefix must be an entity name without its domain.");
  if (config.entities && (typeof config.entities !== "object" || Array.isArray(config.entities))) throw new Error("entities must be a mapping of field names to entity IDs.");
  const entities = {};
  if (config.entity_prefix) {
    for (const [key, [domain, suffix]] of Object.entries(FIELDS)) entities[key] = `${domain}.${config.entity_prefix}_${suffix}`;
  }
  for (const [key, value] of Object.entries(config.entities ?? {})) {
    if (!Object.hasOwn(FIELDS, key)) throw new Error(`Unknown entity field: ${key}`);
    if (value !== false && !validEntity(value)) throw new Error(`Invalid entity ID for ${key}`);
    entities[key] = value;
  }
  const checkRows = (name) => {
    if (config[name] !== undefined && !Array.isArray(config[name])) throw new Error(`${name} must be a list.`);
    for (const row of config[name] ?? []) {
      if (!row || typeof row !== "object" || !validEntity(row.entity)) throw new Error(`Every ${name} row needs an entity ID.`);
      if (row.invert !== undefined && typeof row.invert !== "boolean") throw new Error("invert must be true or false.");
    }
  };
  checkRows("statuses"); checkRows("metrics");
  const columns = config.metric_columns ?? 2;
  if (![1, 2, 3].includes(columns)) throw new Error("metric_columns must be 1, 2, or 3.");
  const stale = config.stale_after ?? 10;
  if (typeof stale !== "number" || !Number.isFinite(stale) || stale < 0) throw new Error("stale_after must be a nonnegative number of minutes.");
  if (config.accent_color && !/^#[a-f0-9]{6}$/i.test(config.accent_color)) throw new Error("accent_color must be a six-digit hex color.");
  if (config.logo && !(typeof config.logo === "string" && (/^\/(?!\/)/.test(config.logo) || /^https:\/\//.test(config.logo)))) throw new Error("logo must be a local /path or an HTTPS URL.");
  for (const key of ["brand_colors", "show_metrics", "show_heartbeat"]) {
    if (config[key] !== undefined && typeof config[key] !== "boolean") throw new Error(`${key} must be true or false.`);
  }
  return { ...config, model, entities, metric_columns: columns, stale_after: stale };
}
function validEntity(value) { return typeof value === "string" && /^[a-z_]+\.[a-z0-9_]+$/.test(value); }
export function statusState(state, invert = false) {
  if (!state) return { kind: "unknown", label: "Not available", icon: "mdi:help-circle-outline" };
  if (state.state === "unavailable") return { kind: "unknown", label: "Unavailable", icon: "mdi:cloud-off-outline" };
  if (!["on", "off"].includes(state.state)) return { kind: "unknown", label: "Unknown", icon: "mdi:help-circle-outline" };
  const alarm = invert ? state.state === "off" : state.state === "on";
  return alarm ? { kind: "alarm", label: "Alarm", icon: "mdi:alert-circle" }
    : { kind: "ok", label: "OK", icon: "mdi:check-circle" };
}
function getRows(config, states) {
  const statuses = config.statuses ?? PRESETS[config.model].statuses
    .filter(key => config.entities[key] !== false)
    .map(key => ({ entity: config.entities[key], name: FIELDS[key][2] }));
  // Automatic metric tiles include existing entities only. Explicit rows never disappear.
  const metrics = config.metrics ?? METRICS.filter(key => config.entities[key] && states[config.entities[key]])
    .map(key => ({ entity: config.entities[key], name: FIELDS[key][2] }));
  return { statuses, metrics };
}
export function cardData(config, hass, now = Date.now()) {
  const states = hass?.states ?? {};
  const { statuses, metrics } = getRows(config, states);
  const rows = statuses.map(row => ({ ...row, ...statusState(states[row.entity], row.invert), state: states[row.entity] }));
  const online = states[config.entities.online]?.state;
  const heartbeat = states[config.entities.last_heartbeat];
  const heartbeatTime = Date.parse(heartbeat?.state);
  const age = Number.isFinite(heartbeatTime) ? Math.max(0, (now - heartbeatTime) / 60000) : null;
  const stale = config.stale_after > 0 && age !== null && age > config.stale_after;
  const offline = online === "off" || online === "unavailable";
  const unknown = rows.some(row => row.kind === "unknown") || (config.entities.online && !["on", "off"].includes(online));
  const countState = states[config.entities.alarm_count]?.state;
  const count = countState !== undefined && countState.trim() !== "" ? Number(countState) : NaN;
  const alarm = rows.some(row => row.kind === "alarm") || (Number.isFinite(count) && count > 0);
  let summary = { kind: "ok", label: "No active alarms" };
  if (!rows.length || unknown) summary = { kind: "unknown", label: "Check status" };
  if (stale) summary = { kind: "unknown", label: "Data delayed" };
  if (offline) summary = { kind: "unknown", label: "Offline" };
  if (alarm) summary = { kind: "alarm", label: offline || stale ? "Last reported alarm" : "Alarm reported" };
  // Explicit metric lists keep their chosen layout, including Wi-Fi when requested.
  const wifiEntity = config.entities.wifi_signal;
  const diagnostics = config.metrics === undefined && config.show_metrics !== false && wifiEntity && states[wifiEntity]
    ? [{ entity: wifiEntity, name: FIELDS.wifi_signal[2] }] : [];
  return { rows, metrics, diagnostics, summary, online, heartbeat, age, stale, offline };
}
export function formatDuration(value, unit) {
  const factors = { ms: .001, s: 1, min: 60, h: 3600, d: 86400 };
  if (!Object.hasOwn(factors, unit) || !Number.isFinite(value) || value < 0) return null;
  let seconds = Math.round(value * factors[unit]);
  const days = Math.floor(seconds / 86400); seconds %= 86400;
  const hours = Math.floor(seconds / 3600); seconds %= 3600;
  const minutes = Math.floor(seconds / 60); seconds %= 60;
  return [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`,
    !days && !hours && !minutes && `${seconds}s`].filter(Boolean).join(" ");
}
export function formatReading(state, hass) {
  if (!state || ["unknown", "unavailable"].includes(state.state)) return state?.state === "unavailable" ? "Unavailable" : "Unknown";
  const unit = state.attributes?.unit_of_measurement;
  if (state.attributes?.device_class === "duration") {
    const formatted = formatDuration(Number(state.state), unit);
    if (formatted !== null) return formatted;
  }
  // Use HA's own locale and display precision when available.
  if (hass?.formatEntityState) return hass.formatEntityState(state);
  const number = Number(state.state);
  if (state.state.trim() !== "" && Number.isFinite(number)) {
    const maximumFractionDigits = state.attributes?.device_class === "voltage" ? 2 : 3;
    return `${new Intl.NumberFormat(hass?.locale?.language ?? "en", { maximumFractionDigits }).format(number)}${unit ? ` ${unit}` : ""}`;
  }
  return state.state;
}

const STYLES = `
  :host { display:block; height:100%; --zc-accent:var(--primary-color); }
  ha-card { overflow:hidden; height:100%; box-sizing:border-box; color:var(--primary-text-color); }
  .header { padding:16px; display:flex; gap:14px; align-items:center; border-bottom:1px solid var(--divider-color); }
  .brand .header { background:var(--zc-accent); color:#fff; border:0; }
  .header-icon { --mdc-icon-size:36px; color:var(--zc-accent); flex-shrink:0; }
  .brand .header-icon { color:inherit; }
  .brand.apak .header { background:var(--secondary-background-color); color:var(--primary-text-color); border-top:4px solid var(--zc-accent); }
  .brand.apak .header-icon { color:var(--zc-accent); }
  .logo { max-height:56px; max-width:155px; object-fit:contain; }
  .head-text { min-width:0; flex:1; }
  h2 { margin:0; font-size:22px; line-height:1.25; font-weight:600; overflow-wrap:anywhere; }
  .subtitle { font-size:13px; margin-top:5px; opacity:.86; }
  .body { padding:16px 20px 20px; }
  .summary { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:12px; }
  .badge { display:inline-flex; gap:6px; align-items:center; font-size:12px; font-weight:500; padding:5px 9px; border-radius:var(--ha-border-radius-sm,8px); background:var(--secondary-background-color); }
  .badge ha-icon { --mdc-icon-size:16px; }
  .connection { color:var(--secondary-text-color); font-size:12px; display:flex; align-items:center; gap:5px; }
  .connection ha-icon { --mdc-icon-size:16px; }
  .statuses { display:grid; gap:2px; }
  button { font:inherit; color:inherit; background:none; border:0; cursor:pointer; text-align:left; }
  button:disabled { cursor:default; }
  button:focus-visible { outline:2px solid var(--primary-color); outline-offset:2px; }
  button:hover:not(:disabled) { background:var(--secondary-background-color); }
  .status { display:flex; align-items:center; gap:12px; padding:8px 0; min-height:44px; box-sizing:border-box; border-radius:var(--ha-border-radius-sm,8px); width:100%; }
  .status ha-icon { --mdc-icon-size:26px; flex-shrink:0; }
  .status-name { flex:1; font-size:15px; }
  .status-value { font-size:12px; color:var(--secondary-text-color); }
  .ok { color:var(--success-color,#43a047); }
  .alarm { color:var(--error-color,#db4437); }
  .unknown { color:var(--secondary-text-color); }
  .metrics { display:grid; grid-template-columns:repeat(var(--zc-columns,2),minmax(0,1fr)); gap:8px; border-top:1px solid var(--divider-color); margin-top:12px; padding-top:16px; }
  .metric { padding:10px 12px; border-radius:var(--ha-border-radius-sm,8px); background:var(--secondary-background-color); min-width:0; }
  .metric-name { display:block; font-size:11px; color:var(--secondary-text-color); line-height:1.4; margin-bottom:4px; }
  .metric-value { display:block; font-size:17px; font-weight:500; overflow-wrap:anywhere; }
  .footer { margin-top:16px; padding-top:12px; border-top:1px solid var(--divider-color); display:grid; gap:8px; font-size:11px; color:var(--secondary-text-color); }
  .diagnostic { display:flex; align-items:center; gap:8px; padding:0; font-size:inherit; color:inherit; }
  .footer ha-icon { --mdc-icon-size:15px; flex-shrink:0; }
  .footer span { overflow-wrap:anywhere; }
  @media(max-width:350px) { .header { padding:16px; } .body { padding:12px 16px 16px; } h2 { font-size:20px; } .metric-value { font-size:15px; } }
`;
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function icon(name) { const node = element("ha-icon"); node.setAttribute("icon", name); return node; }
function moreInfo(target, entityId) {
  if (!entityId) return;
  target.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
}

export class ZControlCard extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: "open" }); }
  setConfig(config) { this._config = normalizeConfig(config); this._render(); }
  set hass(hass) { this._hass = hass; this._render(); }
  get hass() { return this._hass; }
  connectedCallback() {
    // Re-evaluate heartbeat age even when no HA entity changes.
    if (!this._timer) this._timer = setInterval(() => this._render(), 30000);
    this._render();
  }
  disconnectedCallback() { clearInterval(this._timer); this._timer = undefined; }
  getCardSize() { return 5 + Math.ceil((this._lastMetricCount ?? 0) / (this._config?.metric_columns ?? 2)); }
  getGridOptions() { return { columns: 12, min_columns: 6 }; }
  static getConfigElement() { return document.createElement("zcontrol-card-editor"); }
  static getStubConfig() { return { model: "generic", entity_prefix: "sump_pump", brand_colors: true }; }
  _render() {
    if (!this._config || !this._hass) return;
    const config = this._config;
    const preset = PRESETS[config.model];
    const data = cardData(config, this._hass);
    const signature = JSON.stringify([config, data.rows, data.metrics.map(row => [row, this._hass.states[row.entity]]), data.diagnostics.map(row => [row, this._hass.states[row.entity]]), data.summary, data.online, data.heartbeat, data.stale, data.offline, this._hass.locale]);
    if (signature === this._signature) return;
    this._signature = signature;
    const focusedEntity = this.shadowRoot.activeElement?.dataset.entity;
    const card = element("ha-card", config.brand_colors === false ? "" : `brand ${config.model}`);
    card.style.setProperty("--zc-accent", config.accent_color ?? (config.brand_colors === false ? "var(--primary-color)" : preset.color));
    card.style.setProperty("--zc-columns", config.metric_columns);
    const style = element("style", "", STYLES);
    const header = element("header", "header");
    const headerIcon = icon(preset.icon); headerIcon.className = "header-icon";
    header.append(headerIcon);
    if (config.logo) {
      const image = element("img", "logo"); image.src = config.logo;
      image.alt = config.title ?? preset.title; image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => { image.remove(); headerIcon.hidden = false; }, { once: true });
      headerIcon.hidden = true; header.prepend(image);
    }
    const heading = element("div", "head-text");
    heading.append(element("h2", "", config.title ?? preset.title), element("div", "subtitle", config.subtitle ?? preset.subtitle));
    header.append(heading);
    const body = element("div", "body");
    const summary = element("div", "summary");
    const badge = element("span", `badge ${data.summary.kind}`);
    badge.append(icon(data.summary.kind === "alarm" ? "mdi:alert-circle" : data.summary.kind === "ok" ? "mdi:check-circle-outline" : "mdi:help-circle-outline"), element("span", "", data.summary.label));
    summary.append(badge);
    const connection = element("span", "connection");
    connection.append(icon(data.online === "on" ? "mdi:cloud-check-outline" : "mdi:cloud-off-outline"), element("span", "", data.online === "on" ? "Connected" : data.online === "off" ? "Offline" : "Connection unknown"));
    summary.append(connection); body.append(summary);
    const statuses = element("div", "statuses");
    for (const row of data.rows) {
      const button = element("button", "status"); button.type = "button"; if (row.entity) button.dataset.entity = row.entity;
      const name = row.name ?? row.state?.attributes?.friendly_name ?? row.entity ?? "Unconfigured status";
      const staleOK = row.kind === "ok" && (data.offline || data.stale);
      const shown = staleOK ? { kind: "unknown", icon: "mdi:clock-alert-outline", label: "Last reported OK" } : row;
      const indicator = icon(shown.icon); indicator.className = shown.kind;
      button.append(indicator, element("span", "status-name", name), element("span", "status-value", shown.kind === "ok" ? "" : shown.label));
      button.disabled = !row.entity; button.setAttribute("aria-label", `${name}: ${shown.label}. Show details.`);
      button.addEventListener("click", () => moreInfo(this, row.entity)); statuses.append(button);
    }
    body.append(statuses);
    const visibleMetrics = config.show_metrics === false ? [] : data.metrics;
    this._lastMetricCount = visibleMetrics.length;
    if (visibleMetrics.length) {
      const metrics = element("div", "metrics");
      for (const row of visibleMetrics) {
        const state = this._hass.states[row.entity];
        const name = row.name ?? state?.attributes?.friendly_name ?? row.entity;
        const value = formatReading(state, this._hass);
        const tile = element("button", "metric"); tile.type = "button"; tile.dataset.entity = row.entity;
        tile.append(element("span", "metric-name", name), element("span", "metric-value", value));
        tile.setAttribute("aria-label", `${name}: ${value}. Show details.`);
        tile.addEventListener("click", () => moreInfo(this, row.entity)); metrics.append(tile);
      }
      body.append(metrics);
    }
    if (config.show_heartbeat !== false || data.diagnostics.length) {
      const footer = element("div", "footer");
      for (const row of data.diagnostics) {
        const value = formatReading(this._hass.states[row.entity], this._hass);
        const diagnostic = element("button", "diagnostic"); diagnostic.type = "button"; diagnostic.dataset.entity = row.entity;
        diagnostic.append(icon("mdi:wifi"), element("span", "", `${row.name}: ${value}`));
        diagnostic.setAttribute("aria-label", `${row.name}: ${value}. Show details.`);
        diagnostic.addEventListener("click", () => moreInfo(this, row.entity)); footer.append(diagnostic);
      }
      if (config.show_heartbeat !== false) {
        let label = "Last heartbeat unknown";
        const timestamp = Date.parse(data.heartbeat?.state);
        if (Number.isFinite(timestamp)) {
          const formatted = this._hass.formatEntityState?.(data.heartbeat) ?? new Intl.DateTimeFormat(this._hass.locale?.language ?? "en", { dateStyle: "medium", timeStyle: "short", timeZone: this._hass.config?.time_zone }).format(timestamp);
          label = `Last heartbeat ${formatted}`;
          if (data.stale) label += " · Data delayed";
        }
        const heartbeatRow = element("div", "diagnostic");
        heartbeatRow.append(icon("mdi:clock-outline"), element("span", "", label)); footer.append(heartbeatRow);
      }
      body.append(footer);
    }
    card.append(header, body);
    // All dynamic strings use textContent; neither entity states nor YAML inject HTML.
    this.shadowRoot.replaceChildren(style, card);
    if (focusedEntity) [...this.shadowRoot.querySelectorAll("button")].find(button => button.dataset.entity === focusedEntity)?.focus();
  }
}

class ZControlCardEditor extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: "open" }); }
  setConfig(config) { this._config = { ...config }; this._render(); }
  set hass(hass) { this._hass = hass; }
  _render() {
    if (!this._config) return;
    const wrapper = element("div");
    const style = element("style", "", "label{display:grid;gap:6px;margin:14px 0;font-size:14px}input,select{font:inherit;color:var(--primary-text-color);background:var(--card-background-color);padding:10px;border:1px solid var(--divider-color);border-radius:8px}p{color:var(--secondary-text-color);font-size:13px;line-height:1.5}");
    const addField = (key, title, values) => {
      const label = element("label", "", title);
      const input = element(values ? "select" : "input");
      if (values) for (const [value, name] of values) { const option = element("option", "", name); option.value = value; input.append(option); }
      input.value = String(this._config[key] ?? (key === "model" ? "generic" : key === "metric_columns" ? 2 : ""));
      input.addEventListener("change", () => {
        const next = { ...this._config };
        if (input.value === "") delete next[key]; else next[key] = key === "metric_columns" ? Number(input.value) : input.value;
        this._config = next;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: next }, bubbles: true, composed: true }));
      }); label.append(input); wrapper.append(label);
    };
    addField("model", "Model", [["508", "Aquanot 508"], ["apak", "APak"], ["generic", "Generic"]]);
    addField("title", "Title (optional)"); addField("subtitle", "Subtitle (optional)");
    addField("entity_prefix", "Entity prefix (without sensor. or binary_sensor.)");
    addField("logo", "Logo path (optional, for example /local/zcontrol-logo.png)");
    addField("metric_columns", "Reading columns", [["1", "One"], ["2", "Two"], ["3", "Three"]]);
    const label = element("label"); label.style.display = "flex";
    const toggle = element("input"); toggle.type = "checkbox"; toggle.checked = this._config.brand_colors !== false;
    toggle.addEventListener("change", () => {
      this._config = { ...this._config, brand_colors: toggle.checked };
      this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
    }); label.append(toggle, element("span", "", "Use model brand colors")); wrapper.append(label);
    wrapper.append(element("p", "", "Use the YAML editor for entity overrides and custom status/reading rows. The prefix is a convenience; it does not discover devices or infer wiring."));
    this.shadowRoot.replaceChildren(style, wrapper);
  }
}
if (!customElements.get("zcontrol-card")) customElements.define("zcontrol-card", ZControlCard);
if (!customElements.get("zcontrol-card-editor")) customElements.define("zcontrol-card-editor", ZControlCardEditor);
window.customCards = window.customCards ?? [];
if (!window.customCards.some(card => card.type === "zcontrol-card")) window.customCards.push({
  type: "zcontrol-card", name: "Z-Control Card", preview: true,
  description: "508, APak, and generic sump status with inline readings.",
  documentationURL: "https://github.com/lyonsad/zcontrol-card",
});
