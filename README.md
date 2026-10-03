# Z-Control Card

Home Assistant cards for **Aquanot 508 Fit**, **APak**, and other sump controllers, with status checks and readings in one place. Select a status or reading to open its Home Assistant details.

Requires [levineds/zcontrol-ha](https://github.com/levineds/zcontrol-ha). Thanks to [levineds](https://github.com/levineds) for creating the integration that supplies these entities.

<img src="docs/home-assistant-live.png" alt="Aquanot 508 Fit and APak cards running in Home Assistant" width="520">

Actual cards running v0.1.1 in Home Assistant.

## Install

Configure the Z-Control integration first and confirm its entities have readings. For the 508, use an integration version with the [corrected 508 mappings](https://github.com/levineds/zcontrol-ha/pull/1).

### HACS

1. Open **HACS → three-dot menu → Custom repositories**.
2. Add `https://github.com/lyonsad/zcontrol-card` with type **Dashboard** (or **Lovelace** in older versions).
3. Find **Z-Control Card**, download the latest stable release, and reload your browser.
4. Check **Settings → Dashboards → three-dot menu → Resources** for `/hacsfiles/zcontrol-card/zcontrol-card.js`, type **JavaScript module**. Add it if missing. Enable **Advanced mode** in your profile if Resources is hidden.

HACS installs numbered releases by default. To use `main`, select **Need a different version? → main**. This repository must be added manually; it is not in the HACS default store.

### Manual

Download [zcontrol-card.js from main](https://raw.githubusercontent.com/lyonsad/zcontrol-card/main/zcontrol-card.js) or a [release](https://github.com/lyonsad/zcontrol-card/releases/latest) to `config/www/zcontrol-card.js`. Add `/local/zcontrol-card.js` under dashboard **Resources** as a **JavaScript module**, then reload your browser. If you created the `www` folder for the first time, restart Home Assistant once.

## Add a card

Open **Edit dashboard → Add card → By card → Z-Control Card**. Choose the model and enter your entity prefix. Use the visual editor for basic settings or **Show code editor** for custom mappings.

To find the prefix, open **Settings → Devices & services → Entities** and check an entity ID. For `binary_sensor.basement_sump_battery`, the prefix is `basement_sump`. If your entities use different names, see [entity overrides](docs/configuration.md#entity-overrides-and-selected-readings).

You can also choose **Manual** and paste one of these examples:

**Aquanot 508 Fit**

```yaml
type: custom:zcontrol-card
model: '508'
entity_prefix: basement_sump
```

**APak**

```yaml
type: custom:zcontrol-card
model: apak
entity_prefix: basement_alarm
```

Replace the prefixes with your own. For two devices together, see [examples/cards.yaml](examples/cards.yaml).

The 508 shows System Ready, Battery, DC Pump, Float Status, and AC Power. APak shows Input 1, Input 2, AC Power, and Battery; input names can be customized to match your wiring.

Set `brand_colors: false` to use your dashboard theme for the header. See the [configuration reference](docs/configuration.md) for all options, selected readings, logos, and a generic controller example.

## Tested with

Home Assistant Core **2026.9.4**, frontend **20260826.7**, and Safari on macOS, using live 508 and APak devices and Z-Control integration `1.1.0-test.4`. Generic controllers and alarm/offline/unknown behavior have automated test coverage; physical alarm events were not triggered. The declared minimum is HA 2024.11, which has not been live-tested.

## Troubleshooting

- **Card not found:** check the resource URL and module type, then reload or clear the browser's frontend cache.
- **Unknown readings:** check the entity IDs and integration. The card can only show readings the integration supplies.
- **Data delayed:** check connectivity and the last heartbeat. The default threshold is 10 minutes; adjust `stale_after` if needed.
- **Updates:** download the new version through HACS and reload your browser. For manual installs, replace the JavaScript file.

## Credits

Inspired by Zoeller's Z-Control Cloud layout and built for [Home Assistant](https://www.home-assistant.io/). This is an independent community project, not an official Zoeller product. The card displays monitoring data; keep your physical alarms and notifications in place.

[MIT license](LICENSE).
