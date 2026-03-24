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

## Features

### Tabs

| Tab | What it does |
|---|---|
| **Routes** | Live route list (e.g. LGW - JFK) with flight count. Click to filter map to that route. |
| **Airports** | Filter by departure, arrival, or both. Flags, sortable by name or count. |
| **Countries** | Filter by origin country, destination country, or both. Flags, sortable. |
| **Operators** | Full airline name with flight count. Sortable. |
| **Aircraft** | Category filter pills (jet, prop, heli, etc.) + country of registration dropdown. Sortable. |
| **Alerts** | Integrates with [plane-alert-db](https://github.com/sdr-enthusiasts/plane-alert-db). Shows live matched aircraft with campaign, category and tag filters. Map filter button to isolate alert aircraft on map. |
| **Distance** | Define named zones by lat/lon + radius (nm). Filter map to aircraft within a zone. Zones are saved. |
| **Settings** | Toggle tab visibility. GitHub link. All settings persisted to localStorage. |

### General

- Active filters shown as removable breadcrumb chips at the top of the panel
- Filters AND across tabs, OR within a tab
- **In View** toggle restricts all lists to aircraft currently visible on screen
- All state persisted to localStorage across page reloads
- Works alongside any existing tar1090 config - does not modify core files

---

## Install

Add the following to your tar1090 `docker-compose.yml` environment:

```yaml
- TAR1090_CONFIGJS_APPEND=(function(){var b='https://cdn.jsdelivr.net/gh/robertcanavan/tar1090-robs-filters@main/';function load(){var l=document.createElement('link');l.rel='stylesheet';l.href=b+'robs-filter.css';document.head.appendChild(l);var s=document.createElement('script');s.src=b+'robs-filter.js';document.head.appendChild(s);}document.readyState==='loading'?document.addEventListener('DOMContentLoaded',load):load();})();
```

Then restart your container:

```bash
docker compose up -d
```

No rebuild required. Files are loaded directly from GitHub at page load time.

---

## Requirements

- tar1090 (any recent version)
- `TAR1090_USEROUTEAPI=true` recommended - enables route data used by Routes, Airports, and Countries tabs
- Alerts tab requires internet access to fetch [plane-alert-db](https://github.com/sdr-enthusiasts/plane-alert-db) (fetched client-side, cached 24h in localStorage)

---

## Compatibility

Tested with [docker-tar1090](https://github.com/sdr-enthusiasts/docker-tar1090). Should work with any tar1090 deployment that supports `TAR1090_CONFIGJS_APPEND` or equivalent custom JS injection.

---

## License

MIT
