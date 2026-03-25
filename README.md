# Robs Filters for tar1090

A multi-tab filter and dashboard panel for [tar1090](https://github.com/wiedehopf/tar1090). Click the **RF** button in the tar1090 header to open a sidebar packed with live filtering, statistics, and tracking tools.

Filters AND across tabs — a plane has to pass every active tab to stay on the map. Within a tab, multiple selected items are OR-ed.

---

## Screenshots

| Summary | Aircraft |
|---|---|
| ![Summary tab](Screenshots/Screenshot%202026-03-24%20130258.png) | ![Aircraft tab](Screenshots/Screenshot%202026-03-24%20130343.png) |

| Countries | Operators |
|---|---|
| ![Countries tab](Screenshots/Screenshot%202026-03-24%20130316.png) | ![Operators tab](Screenshots/Screenshot%202026-03-24%20130331.png) |

---

## Install

### docker-compose.yml

Add to your tar1090 environment:

```yaml
- TAR1090_CONFIGJS_APPEND=(function(){var b='https://cdn.jsdelivr.net/gh/robertcanavan/tar1090-robs-filters@main/';function load(){var l=document.createElement('link');l.rel='stylesheet';l.href=b+'robs-filter.css';document.head.appendChild(l);var s=document.createElement('script');s.src=b+'robs-filter.js';document.head.appendChild(s);}document.readyState==='loading'?document.addEventListener('DOMContentLoaded',load):load();})();
```

Then `docker compose up -d`. No rebuild needed.

---

### ADSB.im feeder

1. Open your feeder web UI and go to **Setup**
2. Click **Expert** at the top
3. Under **Add environment variables to containers**, paste:

```
TAR1090_CONFIGJS_APPEND=(function(){var b='https://cdn.jsdelivr.net/gh/robertcanavan/tar1090-robs-filters@main/';function load(){var l=document.createElement('link');l.rel='stylesheet';l.href=b+'robs-filter.css';document.head.appendChild(l);var s=document.createElement('script');s.src=b+'robs-filter.js';document.head.appendChild(s);}document.readyState==='loading'?document.addEventListener('DOMContentLoaded',load):load();})();
```

![ADSB.im Expert Setup](Screenshots/ADSN.Im-Feeder.png)

---

## Tabs

### Summary

Opens by default. A live dashboard of everything on screen — no filtering needed, just open it and see what's happening.

**Overview** — total aircraft, airborne vs on ground, military count, emergency count.

**Altitude distribution** — bar chart showing how many aircraft are at each altitude band. Click any band to instantly filter the map to just those aircraft.

**Attention** — flags anything worth looking at:
- Emergency squawks (7500/7600/7700) with code descriptions
- Military aircraft — click the header to filter all military on the map
- Low altitude airborne aircraft that look unusual

**Closest aircraft** — top 5 nearest to your receiver, with distance in nautical miles.

**Speed leaders** — fastest aircraft on screen with a speed bar. Click any to filter to that aircraft.

**Slowest airborne** — opposite of speed leaders. Useful for spotting helicopters and light aircraft.

**High flyers** — top aircraft by altitude with a bar chart.

**Aircraft types** — most common type codes currently visible.

**Busiest operators** — airline/operator with the most aircraft on screen.

**Busiest routes** — most active departure-arrival pairs with flag emojis.

**Tracking methods** — breakdown of ADS-B / MLAT / TIS-B / Mode S.

**Range & coverage** — furthest aircraft from your receiver, with compass bearing and direction.

**Countries** — registration countries of aircraft on screen.

All sections in Summary are clickable — click a row, a bar, or a header to filter the map to that group.

The controls bar has an **All aircraft / In map view** toggle so you can scope the statistics to either everything being received or just what's in the current viewport.

---

### Airports

Lists departure and arrival airports from route data. The **From / Both / To** toggle at the top controls which end is matched. Click an airport to filter.

Route data comes from tar1090's live route API (`TAR1090_USEROUTEAPI=true`) and optionally from the VRS Standing Data local database.

---

### Countries

Groups aircraft by the country of their departure or arrival airport. From / Both / To works the same as Airports.

Country is resolved from the route cache `countryiso2` field first, then from a built-in ICAO prefix table as fallback.

---

### Operators

Lists airlines by their ICAO code, resolved to full names. Requires route data.

---

### Aircraft

Lists every aircraft type on screen, grouped and counted by type code. Click any row to filter.

**Category filter buttons** across the top — Heavy, Jet, Business, Turboprop, Helicopter, Military, Light. Each shows a live count. Click to filter, click again to deselect. Multi-select works: Military + Helicopter = military helicopters only.

Military detection uses three methods in order:
- `plane.military` flag set by readsb/tar1090 from ICAO hex block analysis
- ADS-B emitter category `A6` (high performance / military jets)
- Built-in table of known military ICAO type codes

**Registration country** dropdown below the category buttons — uses the ICAO hex address to determine country without needing a callsign or route.

---

### Alerts

Fetches and caches [plane-alert-db](https://github.com/sdr-enthusiasts/plane-alert-db) from GitHub (once per 24 hours, stored in localStorage). This database covers thousands of aircraft of interest — military, government, charter operators, historic aircraft, and other notable registrations.

**Map Filter** button hides everything except matched database entries. Individual rows are selectable for single-aircraft filtering.

Filter dropdowns let you narrow by category, campaign, and tag.

---

### Distance

Define one or more filter zones by centre point and radius. Only aircraft within at least one zone are shown.

**Setting the centre point** — click anywhere on the embedded mini-map, or click "Use map centre" to use the current tar1090 map view position. Coordinates pre-populate from your receiver position when you first open the tab.

**Multiple zones** — add as many zones as you want. Each one gets a different colour circle on the map. Active zones are listed at the top with remove buttons.

**Saved locations** — name and save frequently used positions. Click a saved location to instantly activate it as a zone.

**Pan to zones** — snaps the main tar1090 map to fit all active zones in view.

**Altitude band** — optional per-zone altitude range in feet. Only aircraft between those altitudes within the radius are shown.

Distance is calculated using the Haversine formula. Aircraft with no position data are shown rather than filtered out.

When a distance filter is applied, the "only in map view" restriction is automatically disabled so aircraft in range but off-screen are still shown.

---

### Settings

- **Only aircraft in map view** — limits all lists to what's currently visible on screen. On by default.
- **Display mode** — sidebar (sits next to tar1090's own info panel) or popup (floating).
- **Use local databases** — downloads OurAirports and VRS Standing Data once per 24 hours. Cached in localStorage. On by default.
- **Visible tabs** — hide any tab you don't use. Hidden tabs keep their filter state.
- **Section visibility** — the Summary tab sections can each be toggled on/off to keep it tidy.

---

## Requirements

- tar1090 (recent version)
- `TAR1090_USEROUTEAPI=true` recommended for full route, airport, country, and operator data

---

## Local databases

When **Use local databases** is enabled in Settings, two databases are downloaded and cached:

| Database | Source | What it provides |
|---|---|---|
| OurAirports | davidmegginson/ourairports-data | Airport names and countries (~50,000 airports) |
| VRS Standing Data | vradarserver/standing-data | Airline names and flight routes |

Both are fetched fresh every 24 hours and stored in localStorage.

---

## Compatibility

Works with [docker-tar1090](https://github.com/sdr-enthusiasts/docker-tar1090) and [ADSB.im](https://adsb.im) feeder images. Any tar1090 deployment that supports `TAR1090_CONFIGJS_APPEND` or equivalent custom JS injection should work.

---

## License

MIT — made by Rob.
