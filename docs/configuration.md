# Configuration reference

[Back to the README](../README.md)

## Entity overrides and selected readings

The default readings omit alarm count because the status summary already communicates alarms. The mapped count still contributes to that summary. Add it explicitly to `metrics` if you want a numeric tile. Explicit `metrics` replace automatic readings, controlling order and card height. Missing explicitly selected entities display **Unknown**. Set an entity field to `false` to disable a preset binding. Explicit `statuses` replace all preset rows.

```yaml
type: custom:zcontrol-card
model: apak
entity_prefix: sump_alarm
entities:
  input_1: binary_sensor.sump_alarm_float_switch
  input_2: false
metrics:
  - entity: sensor.sump_alarm_alarm_count
    name: Active alarms
  - entity: sensor.sump_alarm_wifi_signal
    name: Wi-Fi signal
```

## Generic controllers

Use explicit statuses for a model without a preset. The card does not infer wiring, capabilities, or polarity. By default **on means alarm** and **off means OK**, matching integration problem sensors. For an entity where on means healthy, set `invert: true`.

```yaml
type: custom:zcontrol-card
model: generic
title: Sump system
entities:
  online: binary_sensor.sump_online
  alarm_count: sensor.sump_alarm_count
  last_heartbeat: sensor.sump_last_heartbeat
statuses:
  - entity: binary_sensor.sump_high_water
    name: High water
  - entity: binary_sensor.sump_ready
    name: System Ready
    invert: true
metrics:
  - entity: sensor.sump_battery_voltage
    name: Battery voltage
```

## Options

| Option | Default | Purpose |
| --- | --- | --- |
| `model` | `generic` | `508`, `apak`, or `generic`; selects labels and accent. |
| `entity_prefix` | none | Builds conventional IDs listed below. |
| `entities` | none | Override field IDs; `false` disables a binding. |
| `title`, `subtitle` | model defaults | Header text. |
| `brand_colors` | `true` | False uses a theme-colored icon and normal HA background. |
| `accent_color` | model color | Six-digit hex accent, such as `'#71608e'`. |
| `logo` | none | Local `/path` or HTTPS image. |
| `statuses` | model preset | Replace rows with `{entity, name?, invert?}` entries. |
| `metrics` | existing mapped readings | Replace tiles with `{entity, name?}` entries. |
| `metric_columns` | `2` | One, two, or three reading columns. |
| `show_metrics` | `true` | Show reading tiles and automatic Wi-Fi diagnostics. |
| `show_heartbeat` | `true` | Show the heartbeat footer row; freshness checks still run when hidden. |
| `stale_after` | `10` | Minutes after heartbeat to mark data delayed; `0` disables. |

For prefix `sump_pump`, `battery` maps to `binary_sensor.sump_pump_battery`. Available fields and suffixes:

| Domain | Fields / suffixes |
| --- | --- |
| `binary_sensor` | `online`, `battery`, `ac_power`, `input_1`, `input_2` |
| `binary_sensor` | `system_ready` → `system_ready_alarm`; `dc_pump` → `dc_pump_alarm`; `float_status` → `float_status_alarm` |
| `sensor` | `alarm_count`, `battery_voltage`, `battery_current`, `dc_pump_current`, `operational_float_count`, `high_water_float_count`, `pump_runtime`, `system_run_time`, `up_time`, `wifi_signal`, `last_heartbeat` |

Automatic metrics include existing mapped entities only; existing unavailable entities still appear. Durations with HA device class `duration` and units `ms`, `s`, `min`, `h`, or `d` become days/hours/minutes (seconds below one minute). The entity’s actual unit is used, including user-selected days. Other readings use HA display formatting when available.

## Status and freshness

Any displayed alarm or positive mapped `alarm_count` produces an alarm summary, even if that particular alarm has no row. Offline or stale alarms say **Last reported alarm**. Unknown readings never imply healthy status. Connectivity is separate: `online: on` means connected. Invalid/missing heartbeats are labeled unknown; freshness cannot be determined without a timestamp. Tune the threshold to the controller’s heartbeat interval.

This monitoring display does not replace physical alarms or notifications. It invokes no controller commands, tests, resets, silence actions, or services.

## Appearance

Set `brand_colors: false` to use your Home Assistant theme for the header. Use `title` and `subtitle` to name the device, and `metric_columns` to choose one, two, or three columns.

For a logo, save an image in `config/www/` and set `logo: /local/your-logo.png`. Local images avoid requests to another host; HTTPS image URLs are also supported. Failed images fall back to the model icon. Vendor artwork is not included.

## Default readings

Battery voltage/current, pump current, float activation counts, and runtimes appear when their mapped entities exist. Wi-Fi appears in the footer. Alarm count affects the summary but has no default tile.

An explicit `metrics` list replaces automatic tiles and suppresses the automatic Wi-Fi row, so selecting Wi-Fi as a tile does not show it twice. `show_metrics: false` hides tiles and automatic Wi-Fi diagnostics; `show_heartbeat: false` hides only the heartbeat row.
