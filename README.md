# Robs Filters for tar1090

> **BETA - Work In Progress**
> This panel is functional but has known issues under active development. Use at your own risk.

A multi-tab aircraft filter panel for [tar1090](https://github.com/wiedehopf/tar1090). Adds a **RF** button to the header bar that opens a sidebar panel with live filtering across routes, airports, countries, operators, aircraft type, alerts, and distance zones.

---

## Screenshots

| Airports | Countries |
|---|---|
| ![Airports tab](Screenshots/Screenshot%202026-03-24%20130258.png) | ![Countries tab](Screenshots/Screenshot%202026-03-24%20130316.png) |

| Operators | Aircraft |
|---|---|
| ![Operators tab](Screenshots/Screenshot%202026-03-24%20130331.png) | ![Aircraft tab](Screenshots/Screenshot%202026-03-24%20130343.png) |

---

## Known Issues

- **Alerts tab filtering** - campaign, category and tag filters have known bugs. Live aircraft matching works but filter interactions need work.
- **Distance filter** - zone saving and apply behaviour has rough edges.
- **Route data** - depends on `TAR1090_USEROUTEAPI=true`. If routes are not loading, check this is set.
- Cross-tab filter state can occasionally get out of sync after rapid tab switching.

If you hit a bug, raise an issue: [github.com/robertcanavan/tar1090-robs-filters/issues](https://github.com/robertcanavan/tar1090-robs-filters/issues)

---

## How It Works

### Filter logic

Every tab maintains its own independent filter state. When you select items in multiple tabs, the filters are **AND-ed** together — a plane must pass all active tabs to be shown. Within a single tab, multiple selected items are **OR-ed** — selecting London Heathrow and Manchester means flights from either airport pass.

Filters work by patching tar1090's internal `PlaneObject.prototype.isFiltered` function. This is the same mechanism tar1090 uses for its own built-in filters, so Robs Filters chains cleanly alongside them without replacing any core behaviour.

The panel rebuilds its lists every 3 seconds to reflect aircraft that have appeared or disappeared, and reapplies all active filters live to the map on every update.

---

### Airports tab

**Data source:** `plane.routeString` and `g.route_cache`

tar1090 provides each aircraft's route as a string (e.g. `LGW - JFK`) when `TAR1090_USEROUTEAPI=true` is set. The panel parses this and cross-references it against tar1090's internal route cache (`g.route_cache`), which holds full airport objects including ICAO code, name, city, and country ISO code.

- The departure airport ICAO is taken from the first entry in `_airports[]` in the route cache
- The arrival airport ICAO is taken from the last entry
- If the route cache entry is not yet populated (it loads asynchronously), the panel falls back to parsing the raw `routeString` directly and using the ICAO codes from that
- Airport names shown in the list come from the route cache `name` field
- Country flags come from the `countryiso2` field in the route cache
- Aircraft without route data (military, VFR, untracked callsigns) will not appear in this tab

The direction toggle (From / Both / To) filters which airports are counted: `From` counts only departures, `To` counts only arrivals, `Both` counts either.

---

### Countries tab

**Data source:** `plane.routeString`, `g.route_cache`, and built-in airport prefix lookup

Country is derived from the departure and arrival airports. Two resolution methods are used in order:

1. **Route cache:** if the airport object has a `countryiso2` field, that is used directly
2. **ICAO prefix table:** if no `countryiso2` is available, the first two letters of the airport's ICAO code are looked up in a built-in prefix table (e.g. `EG` = United Kingdom, `LF` = France, `OE` = Saudi Arabia). Special cases handle `K` prefixes (United States), `C` prefixes (Canada), and `P4`-length codes (United States territories)

Country names are resolved from ISO 3166-1 alpha-2 codes using a built-in lookup table. Flags are rendered from the same ISO code.

The From / Both / To direction toggle works the same as on the Airports tab.

---

### Operators tab

**Data source:** `g.route_cache[callsign].airline_code`

tar1090's route cache includes the 3-letter ICAO airline code for each flight (e.g. `BAW` for British Airways, `EZY` for easyJet). The panel reads this code and resolves it to a full airline name using a built-in lookup table of ~100 common operators.

If the airline code is not in the built-in table, the raw code is shown as-is. Only aircraft with a populated route cache entry will appear — flights without callsigns or with unrecognised callsigns will not be listed.

---

### Aircraft tab

**Data source:** `plane.typeLong`, `plane.icaoType`, `plane.category`, `plane.wtc`, `plane.icao`

Each aircraft is identified by its type. `plane.typeLong` (e.g. `Boeing 737-800`) is used as the display key where available, falling back to `plane.icaoType` (e.g. `B738`). Surface vehicles (ADS-B category `C0`–`C3`) are excluded.

**Category classification** uses a 3-tier lookup in order:

1. **ICAO type table:** a built-in table maps several hundred ICAO type designators to one of 7 categories (Heavy, Jet, Business, Turboprop, Helicopter, Military, Light)
2. **ADS-B emitter category:** if the type is not in the table, `plane.category` is used (e.g. `A5` = Heavy, `A7` = Rotorcraft, `A1` = Light)
3. **Wake turbulence category:** if neither of the above resolves, `plane.wtc` is used (`J`/`H` = Heavy, `L` = Light)

**Registration country** is determined by a binary search of ICAO 24-bit address ranges. Each country is allocated a block of ICAO hex addresses by ICAO, so the aircraft's hex code (`plane.icao`) alone is enough to determine where it is registered. This works even with no callsign or route data.

The country dropdown in the Aircraft tab uses this mechanism to filter by registration country independently of where the aircraft is flying.

---

### Alerts tab

**Data source:** [plane-alert-db](https://github.com/sdr-enthusiasts/plane-alert-db) fetched from GitHub

On first load of the Alerts tab, the panel fetches the plane-alert-db CSV file directly from GitHub. This database contains thousands of aircraft of interest — military, government, special operations, interesting registrations, and more. The fetched data is cached in `localStorage` for 24 hours (`rf_alerts_v1` key) to avoid repeated downloads.

Matching is done by comparing each live aircraft's `plane.icao` hex against the ICAO codes in the database (case-insensitive). Matched aircraft are shown in the list with their campaign, category, and tag metadata from the database.

The **Map Filter** button builds a Set of all matching ICAOs and applies it through the same `isFiltered` hook, hiding all non-alert aircraft from the map. Clicking individual rows adds them to a selected set, which takes priority over the broad map filter.

> Note: the campaign/category/tag filter dropdowns have known bugs in the current beta.

---

### Distance tab

**Data source:** `plane.lat`, `plane.lon`, `plane.altitude` / `plane.alt_baro`

You define a named zone by entering a centre point (lat/lon) and a radius in nautical miles. Zones are saved to `localStorage` (`rf_dist_locs_v1` key) and persist across sessions.

When a zone filter is applied, each aircraft's distance from the zone centre is calculated using the **Haversine formula** (great-circle distance). Aircraft outside the radius are filtered out.

An optional altitude band filter can be added — when set to `Between`, only aircraft with a barometric altitude (`plane.alt_baro`) or pressure altitude (`plane.altitude`) within the specified range in feet are shown. Aircraft with no position data are passed through rather than filtered out.

---

### Settings tab

Controls panel behaviour. All settings are saved to `localStorage` automatically.

- **Only include aircraft in map view** — when enabled, all tab lists and filters only consider aircraft currently visible in the map viewport (`plane.inView`). Useful for busy airspace where you want to focus on what is on screen.
- **Visible Tabs** — toggle which tabs appear. Hidden tabs are still functional; their filters remain active if set before hiding.
- **Alerts Database** — shows the last fetch timestamp and allows a manual refresh.

---

## Install

### docker-compose.yml

Add the following to your tar1090 service environment:

```yaml
- TAR1090_CONFIGJS_APPEND=(function(){var b='https://cdn.jsdelivr.net/gh/robertcanavan/tar1090-robs-filters@main/';function load(){var l=document.createElement('link');l.rel='stylesheet';l.href=b+'robs-filter.css';document.head.appendChild(l);var s=document.createElement('script');s.src=b+'robs-filter.js';document.head.appendChild(s);}document.readyState==='loading'?document.addEventListener('DOMContentLoaded',load):load();})();
```

Then restart your container:

```bash
docker compose up -d
```

No rebuild required. Files are loaded from jsDelivr CDN at page load time.

---

### ADSB.im feeder

If you are running an [ADSB.im](https://adsb.im) feeder image, you can add Robs Filters through the web UI without editing any files.

1. Open your feeder web UI and go to **Setup**
2. Click **Expert** at the top
3. Under **Add environment variables to containers**, paste the following and click **Apply**:

```
TAR1090_CONFIGJS_APPEND=(function(){var b='https://cdn.jsdelivr.net/gh/robertcanavan/tar1090-robs-filters@main/';function load(){var l=document.createElement('link');l.rel='stylesheet';l.href=b+'robs-filter.css';document.head.appendChild(l);var s=document.createElement('script');s.src=b+'robs-filter.js';document.head.appendChild(s);}document.readyState==='loading'?document.addEventListener('DOMContentLoaded',load):load();})();
```

![ADSB.im Expert Setup](Screenshots/ADSN.Im-Feeder.png)

The RF button will appear in your tar1090 map header immediately after applying.

---

## Requirements

- tar1090 (any recent version)
- `TAR1090_USEROUTEAPI=true` recommended - enables route data used by Routes, Airports, Countries, and Operators tabs
- Alerts tab requires internet access to fetch [plane-alert-db](https://github.com/sdr-enthusiasts/plane-alert-db) (fetched client-side, cached 24h in localStorage)

---

## Compatibility

Tested with [docker-tar1090](https://github.com/sdr-enthusiasts/docker-tar1090). Should work with any tar1090 deployment that supports `TAR1090_CONFIGJS_APPEND` or equivalent custom JS injection.

---

## License

MIT
