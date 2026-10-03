import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.HTMLElement = class {};
const registered = new Map();
globalThis.customElements = { get: name => registered.get(name), define: (name, value) => registered.set(name, value) };
globalThis.window = {};
const { normalizeConfig, statusState, cardData, formatReading, formatDuration } = await import('../zcontrol-card.js');
const state = (value, attributes = {}) => ({ state: value, attributes });
const now = Date.parse('2026-01-01T12:00:00Z');
function fixture(model) {
  const config = normalizeConfig({ model, entity_prefix: 'test_sump' });
  const states = {};
  for (const entity of Object.values(config.entities)) states[entity] = state('off');
  states[config.entities.online] = state('on');
  states[config.entities.last_heartbeat] = state('2026-01-01T11:59:00Z');
  states[config.entities.alarm_count] = state('0');
  return { config, hass: { states } };
}

test('all presets use problem polarity and the 508 excludes unsupported inputs', () => {
  for (const model of ['508', 'apak', 'generic']) {
    const { config, hass } = fixture(model);
    const data = cardData(config, hass, now);
    assert.equal(data.summary.kind, 'ok');
    assert.equal(data.rows.length, model === '508' ? 5 : model === 'apak' ? 4 : 2);
    if (model === '508') assert.ok(data.rows.every(row => !row.entity.includes('_input_')));
    hass.states[data.rows[0].entity] = state('on');
    assert.equal(cardData(config, hass, now).summary.kind, 'alarm');
  }
});
test('missing, unknown and unavailable readings never become a green check', () => {
  for (const value of [undefined, state('unknown'), state('unavailable'), state('unexpected')]) assert.equal(statusState(value).kind, 'unknown');
  const { config, hass } = fixture('508');
  delete hass.states[config.entities.ac_power];
  assert.equal(cardData(config, hass, now).summary.label, 'Check status');
});
test('catch-all alarms remain visible during stale or offline monitoring', () => {
  const { config, hass } = fixture('508');
  hass.states[config.entities.alarm_count] = state('2');
  assert.equal(cardData(config, hass, now).summary.label, 'Alarm reported');
  hass.states[config.entities.online] = state('off');
  assert.equal(cardData(config, hass, now).summary.label, 'Last reported alarm');
  hass.states[config.entities.alarm_count] = state('unknown');
  assert.equal(cardData(config, hass, now).summary.label, 'Offline');
  hass.states[config.entities.online] = state('on');
  hass.states[config.entities.last_heartbeat] = state('2026-01-01T11:00:00Z');
  assert.equal(cardData(config, hass, now).summary.label, 'Data delayed');
  assert.equal(cardData({ ...config, stale_after: 0 }, hass, now).summary.kind, 'ok');
});
test('generic custom statuses support inverted healthy sensors without changing defaults', () => {
  const config = normalizeConfig({ model: 'generic', statuses: [{ entity: 'binary_sensor.ready', name: 'Ready', invert: true }] });
  assert.equal(cardData(config, { states: { 'binary_sensor.ready': state('on') } }, now).summary.kind, 'ok');
  assert.equal(statusState(state('on')).kind, 'alarm');
});
test('entity overrides, disabled rows, and explicit missing metrics work independently', () => {
  const { config, hass } = fixture('apak');
  const overridden = normalizeConfig({ model: 'apak', entity_prefix: 'test_sump', entities: { input_1: 'binary_sensor.float_switch', input_2: false }, metrics: [{ entity: 'sensor.missing', name: 'Voltage' }] });
  const data = cardData(overridden, hass, now);
  assert.equal(data.rows.length, 3);
  assert.equal(data.rows[0].entity, 'binary_sensor.float_switch');
  assert.equal(data.metrics.length, 1);
  assert.equal(formatReading(hass.states[data.metrics[0].entity], hass), 'Unknown');
  assert.equal(cardData(config, hass, now).rows.length, 4);
});
test('durations use the actual entity unit, including user-selected days', () => {
  for (const [value, unit] of [[93780, 's'], [1563, 'min'], [26.05, 'h'], [93780 / 86400, 'd']]) assert.equal(formatDuration(value, unit), '1d 2h 3m');
  assert.equal(formatDuration(0, 'h'), '0s');
  assert.equal(formatDuration(-1, 'h'), null);
  assert.equal(formatDuration(NaN, 'h'), null);
  assert.equal(formatReading(state('1.5', { device_class: 'duration', unit_of_measurement: 'd' })), '1d 12h');
  assert.equal(formatReading(state('unknown', { device_class: 'duration' })), 'Unknown');
});
test('ordinary readings respect HA formatting and voltage fallback precision', () => {
  assert.equal(formatReading(state('12.731', { device_class: 'voltage', unit_of_measurement: 'V' })), '12.73 V');
  assert.equal(formatReading(state('12'), { formatEntityState: () => 'HA formatted' }), 'HA formatted');
  assert.equal(formatReading(state('unavailable')), 'Unavailable');
});
test('invalid configuration is rejected before rendering', () => {
  for (const config of [{ model: 'other' }, { entity_prefix: 'sensor.bad' }, { entities: { unknown: 'sensor.test' } }, { entities: { battery: 'bad' } }, { statuses: [{ entity: 'binary_sensor.x', invert: 'yes' }] }, { metric_columns: 4 }, { stale_after: -1 }, { logo: 'javascript:alert(1)' }, { logo: '//remote/logo' }, { brand_colors: 'yes' }]) assert.throws(() => normalizeConfig(config));
  assert.doesNotThrow(() => normalizeConfig({ logo: '/local/logo.png', brand_colors: false }));
});
