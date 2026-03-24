# Robs Filters for tar1090

A multi-tab aircraft filter panel for [tar1090](https://github.com/wiedehopf/tar1090). Click the **RF** button in the header bar to open a sidebar with live filtering across routes, airports, countries, operators, aircraft types, alerts, and distance zones. All filters are AND-ed together across tabs so you can combine them however you like.

---

## Screenshots

| Airports | Countries |
|---|---|
| ![Airports tab](Screenshots/Screenshot%202026-03-24%20130258.png) | ![Countries tab](Screenshots/Screenshot%202026-03-24%20130316.png) |

| Operators | Aircraft |
|---|---|
| ![Operators tab](Screenshots/Screenshot%202026-03-24%20130331.png) | ![Aircraft tab](Screenshots/Screenshot%202026-03-24%20130343.png) |

---

## What It Does

### Filter logic

Each tab has its own independent filter state. Multiple tabs active at the same time are AND-ed — a plane has to pass every active tab to stay on the map. Within a single tab, multiple selected items are OR-ed — picking Heathrow and Manchester shows flights through either.

Filtering works by patching tar1090's internal `PlaneObject.prototype.isFiltered` function, the same hook tar1090 uses for its own built-in filters. It chains cleanly without replacing anything.

The panel rebuilds its lists every few seconds to pick up aircraft that have come and gone, and reapplies all active filters to the map live on every update.

---

### Summary tab

Opens by default. Shows a live count of what is on screen broken down by category. Each count is a button — click it to instantly filter the map to that category. Click again to clear it.

---

### Airports tab

Reads route data from tar1090's `plane.routeString` and `g.route_cache`. When `TAR1090_USEROUTEAPI=true` is set, tar1090 fetches route data automatically for every callsign it sees and caches it in memory.

The From / Both / To toggle controls which end of the route is matched. Select **From** to show only aircraft departing a specific airport, **To** for arrivals, **Both** for either.

Aircraft without route data (military, VFR, untracked callsigns) won't appear here — use the Aircraft tab for those.

---

### Countries tab

Country is derived from the departure and arrival airports. Two methods are tried in order: the `countryiso2` field from the route cache, then a built-in ICAO prefix table (e.g. `EG` = UK, `LF` = France). From / Both / To works the same as Airports.

---

### Operators tab

Reads the 3-letter ICAO airline code from `g.route_cache` and resolves it to a full airline name. If the code isn't in the built-in table it shows the raw code. Only flights with a recognised callsign appear here.

---

### Aircraft tab

Lists every aircraft type currently on screen, grouped and counted. Click any type to filter the map to just those aircraft.

**Category filters** sit across the top of the tab — Heavy, Jet, Business, Turboprop, Helicopter, Military, Light. Each button shows a live count of how many aircraft of that category are visible. Click to filter. Click again to deselect. You can select multiple categories at once — selecting Military and Helicopter shows only military helicopters.

Military detection uses three methods in order:
- `plane.military` flag set by tar1090 directly
- ADS-B emitter category `A6` (high performance / military)
- A built-in table of known military ICAO type codes

**Registration country** filter is a dropdown below the category buttons. This uses the aircraft's ICAO hex address to determine registration country via a binary search of ICAO block allocations — works without any callsign or route data.

**Local databases** (optional) — enable via Settings to download OurAirports and VRS Standing Data route databases once per 24 hours. These are cached in localStorage and let the panel resolve airport names and routes for aircraft that the live API hasn't seen yet.

---

### Alerts tab

On first open, fetches [plane-alert-db](https://github.com/sdr-enthusiasts/plane-alert-db) from GitHub and caches it in localStorage for 24 hours. This database has thousands of aircraft of interest — military, government, special operations, and notable registrations.

**Map Filter** hides everything except matched aircraft. Clicking individual rows selects specific aircraft.

---

### Distance tab

Define a zone by setting a centre point and a radius in nautical miles. The centre point is set by clicking on a small embedded Leaflet map directly in the panel — no manual lat/lon entry needed. The map shows your current receiver position as the default, and a circle preview updates as you adjust the radius.

Zones are saved to localStorage and persist across sessions. An optional altitude band lets you further limit to aircraft within a specific altitude range in feet.

Distance is calculated using the Haversine formula (great-circle). Aircraft with no position data pass through rather than being filtered out.

---

### Settings tab

- **Only aircraft in map view** — limits all lists and filters to what is currently visible on screen. On by default.
- **Display mode** — sidebar (default) or popup. Sidebar positions the panel next to tar1090's own info panel so they don't overlap.
- **Use local databases** — enables OurAirports and VRS route data downloads. On by default.
- **Visible tabs** — hide any tab you don't use. Hidden tabs keep their filter state if already set.
- **Alerts database** — shows last fetch time, manual refresh button.

---

## Install

### docker-compose.yml

Add to your tar1090 service environment:

```yaml
- TAR1090_CONFIGJS_APPEND=(function(){var b='https://cdn.jsdelivr.net/gh/robertcanavan/tar1090-robs-filters@main/';function load(){var l=document.createElement('link');l.rel='stylesheet';l.href=b+'robs-filter.css';document.head.appendChild(l);var s=document.createElement('script');s.src=b+'robs-filter.js';document.head.appendChild(s);}document.readyState==='loading'?document.addEventListener('DOMContentLoaded',load):load();})();
```

Restart the container:

```bash
docker compose up -d
```

No rebuild needed. Files load from jsDelivr CDN at page load.

---

### ADSB.im feeder

If you run an [ADSB.im](https://adsb.im) feeder image, you can add Robs Filters through the web UI.

1. Open your feeder web UI and go to **Setup**
2. Click **Expert** at the top
3. Under **Add environment variables to containers**, paste the following and click **Apply**:

```
TAR1090_CONFIGJS_APPEND=(function(){var b='https://cdn.jsdelivr.net/gh/robertcanavan/tar1090-robs-filters@main/';function load(){var l=document.createElement('link');l.rel='stylesheet';l.href=b+'robs-filter.css';document.head.appendChild(l);var s=document.createElement('script');s.src=b+'robs-filter.js';document.head.appendChild(s);}document.readyState==='loading'?document.addEventListener('DOMContentLoaded',load):load();})();
```

![ADSB.im Expert Setup](Screenshots/ADSN.Im-Feeder.png)

The RF button appears in the tar1090 header immediately after applying.

---

## Requirements

- tar1090 (any recent version)
- `TAR1090_USEROUTEAPI=true` recommended — enables route data for the Routes, Airports, Countries, and Operators tabs
- Alerts tab requires internet access to fetch [plane-alert-db](https://github.com/sdr-enthusiasts/plane-alert-db) (cached 24h in localStorage)

---

## Compatibility

Tested with [docker-tar1090](https://github.com/sdr-enthusiasts/docker-tar1090). Should work with any tar1090 deployment that supports `TAR1090_CONFIGJS_APPEND` or equivalent custom JS injection.

---

## License

MIT
