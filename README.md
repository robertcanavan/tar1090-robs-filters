# Robs Filters for tar1090

A multi-tab aircraft filter panel for [tar1090](https://github.com/wiedehopf/tar1090). Adds a **RF** button to the header bar that opens a sidebar panel with live filtering across routes, airports, countries, operators, aircraft type, alerts, and distance zones.

![tar1090 with Robs Filters panel](screenshot.png)

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
| **Settings** | Toggle tab visibility. All settings persisted to localStorage. |

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
- TAR1090_CONFIGJS_APPEND=(function(){var b='https://cdn.jsdelivr.net/gh/robertcanavan/tar1090-robs-filters@latest/';function load(){var l=document.createElement('link');l.rel='stylesheet';l.href=b+'robs-filter.css';document.head.appendChild(l);var s=document.createElement('script');s.src=b+'robs-filter.js';document.head.appendChild(s);}document.readyState==='loading'?document.addEventListener('DOMContentLoaded',load):load();})();
```

Then restart your container:

```bash
docker compose up -d
```

No rebuild required. The files are loaded from jsDelivr CDN at page load time.

### Pin to a specific version

Replace `@latest` with a release tag to avoid picking up breaking changes:

```yaml
b='https://cdn.jsdelivr.net/gh/robertcanavan/tar1090-robs-filters@v1.0.0/'
```

Available versions: see [Releases](https://github.com/robertcanavan/tar1090-robs-filters/releases)

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
