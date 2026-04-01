/**
 * robs-filter.js  v2
 * Multi-tab aircraft filter panel for tar1090.
 * OR within a tab, AND across tabs.
 * Single IIFE — no build step, no framework, no external dependencies.
 */
(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════════
    // §1  Constants & version
    // ═══════════════════════════════════════════════════════════════════════════

    var RF_VERSION = '2.0.0';
    var RF_BUILD   = '2026-03-31';

    // Definition of per-tab header buttons (order = display order)
    var RF_TAB_BTNS = [
        { key: 'summary',   code: 'RS', title: 'Robs Summary \u2014 traffic overview' },
        { key: 'airports',  code: 'RA', title: 'Robs Airports \u2014 filter by airport' },
        { key: 'countries', code: 'RC', title: 'Robs Countries \u2014 filter by country' },
        { key: 'operators', code: 'RO', title: 'Robs Operators \u2014 filter by airline' },
        { key: 'aircraft',  code: 'RP', title: 'Robs Planes \u2014 filter by aircraft type' },
        { key: 'alerts',    code: 'RL', title: 'Robs Plane Alert \u2014 plane-alert-db' },
        { key: 'distance',  code: 'RD', title: 'Robs Distance \u2014 zone filters' },
        { key: 'ranges',    code: 'RG', title: 'Robs ranGes \u2014 alt/speed filters' },
    ];

    // Built-in read-only views (not stored in localStorage, always available)
    var RF_BUILTIN_VIEWS = [
        // Core traffic presets
        { id: 'builtin_military', name: 'All Military', builtin: true, map: { enabled: true, mode: 'dynamic', autoCenter: true, autoZoom: true, fixedCenterLat: null, fixedCenterLon: null, fixedZoom: null }, state: { panelScope: 'all', tabState: { aircraft: { items: ['(Military)'], catFilter: [], regCountryFilter: '', direction: 'both', sortBy: 'count', sortDir: 'desc' } }, alerts: { filters: {}, mapFilter: false, selectedIcaos: [] }, distance: { zones: [], mode: 'any' }, summary: { sumFilter: [] }, ranges: {}, watchlist: { mapFilter: false } } },
        { id: 'builtin_helicopter', name: 'All Helicopters', builtin: true, map: { enabled: true, mode: 'dynamic', autoCenter: true, autoZoom: true, fixedCenterLat: null, fixedCenterLon: null, fixedZoom: null }, state: { panelScope: 'all', tabState: { aircraft: { items: [], catFilter: [5], regCountryFilter: '', direction: 'both', sortBy: 'count', sortDir: 'desc' } }, alerts: { filters: {}, mapFilter: false, selectedIcaos: [] }, distance: { zones: [], mode: 'any' }, summary: { sumFilter: [] }, ranges: {}, watchlist: { mapFilter: false } } },
        { id: 'builtin_highalt', name: 'High Altitude (FL250+)', builtin: true, map: { enabled: true, mode: 'dynamic', autoCenter: true, autoZoom: true, fixedCenterLat: null, fixedCenterLon: null, fixedZoom: null }, state: { panelScope: 'all', tabState: {}, alerts: { filters: {}, mapFilter: false, selectedIcaos: [] }, distance: { zones: [], mode: 'any' }, summary: { sumFilter: [] }, ranges: { altMin: 25000, altMax: '', speedMin: '', speedMax: '', vrMin: '', vrMax: '', squawk: '', callsign: '' }, watchlist: { mapFilter: false } } },
        { id: 'builtin_fast', name: 'Fast (300kt+)', builtin: true, map: { enabled: true, mode: 'dynamic', autoCenter: true, autoZoom: true, fixedCenterLat: null, fixedCenterLon: null, fixedZoom: null }, state: { panelScope: 'all', tabState: {}, alerts: { filters: {}, mapFilter: false, selectedIcaos: [] }, distance: { zones: [], mode: 'any' }, summary: { sumFilter: [] }, ranges: { altMin: '', altMax: '', speedMin: 300, speedMax: '', vrMin: '', vrMax: '', squawk: '', callsign: '' }, watchlist: { mapFilter: false } } },
        { id: 'builtin_lowalt', name: 'Low & Slow (below 3000ft, <150kt)', builtin: true, map: { enabled: true, mode: 'dynamic', autoCenter: true, autoZoom: true, fixedCenterLat: null, fixedCenterLon: null, fixedZoom: null }, state: { panelScope: 'all', tabState: {}, alerts: { filters: {}, mapFilter: false, selectedIcaos: [] }, distance: { zones: [], mode: 'any' }, summary: { sumFilter: [] }, ranges: { altMin: '', altMax: 3000, speedMin: '', speedMax: 150, vrMin: '', vrMax: '', squawk: '', callsign: '' }, watchlist: { mapFilter: false } } },
        { id: 'builtin_business', name: 'Business Jets', builtin: true, map: { enabled: true, mode: 'dynamic', autoCenter: true, autoZoom: true, fixedCenterLat: null, fixedCenterLon: null, fixedZoom: null }, state: { panelScope: 'all', tabState: { aircraft: { items: [], catFilter: [3], regCountryFilter: '', direction: 'both', sortBy: 'count', sortDir: 'desc' } }, alerts: { filters: {}, mapFilter: false, selectedIcaos: [] }, distance: { zones: [], mode: 'any' }, summary: { sumFilter: [] }, ranges: {}, watchlist: { mapFilter: false } } },
        { id: 'builtin_turboprops', name: 'Turboprops', builtin: true, map: { enabled: true, mode: 'dynamic', autoCenter: true, autoZoom: true, fixedCenterLat: null, fixedCenterLon: null, fixedZoom: null }, state: { panelScope: 'all', tabState: { aircraft: { items: [], catFilter: [4], regCountryFilter: '', direction: 'both', sortBy: 'count', sortDir: 'desc' } }, alerts: { filters: {}, mapFilter: false, selectedIcaos: [] }, distance: { zones: [], mode: 'any' }, summary: { sumFilter: [] }, ranges: {}, watchlist: { mapFilter: false } } },
        { id: 'builtin_heavy', name: 'Heavy Airliners', builtin: true, map: { enabled: true, mode: 'dynamic', autoCenter: true, autoZoom: true, fixedCenterLat: null, fixedCenterLon: null, fixedZoom: null }, state: { panelScope: 'all', tabState: { aircraft: { items: [], catFilter: [1], regCountryFilter: '', direction: 'both', sortBy: 'count', sortDir: 'desc' } }, alerts: { filters: {}, mapFilter: false, selectedIcaos: [] }, distance: { zones: [], mode: 'any' }, summary: { sumFilter: [] }, ranges: {}, watchlist: { mapFilter: false } } },
        { id: 'builtin_climbouts', name: 'Strong Climbs (1500fpm+)', builtin: true, map: { enabled: true, mode: 'dynamic', autoCenter: true, autoZoom: true, fixedCenterLat: null, fixedCenterLon: null, fixedZoom: null }, state: { panelScope: 'all', tabState: {}, alerts: { filters: {}, mapFilter: false, selectedIcaos: [] }, distance: { zones: [], mode: 'any' }, summary: { sumFilter: [] }, ranges: { altMin: '', altMax: '', speedMin: '', speedMax: '', vrMin: 1500, vrMax: '', squawk: '', callsign: '' }, watchlist: { mapFilter: false } } },
        { id: 'builtin_descents', name: 'Strong Descents (-1500fpm)', builtin: true, map: { enabled: true, mode: 'dynamic', autoCenter: true, autoZoom: true, fixedCenterLat: null, fixedCenterLon: null, fixedZoom: null }, state: { panelScope: 'all', tabState: {}, alerts: { filters: {}, mapFilter: false, selectedIcaos: [] }, distance: { zones: [], mode: 'any' }, summary: { sumFilter: [] }, ranges: { altMin: '', altMax: '', speedMin: '', speedMax: '', vrMin: '', vrMax: -1500, squawk: '', callsign: '' }, watchlist: { mapFilter: false } } },

        // Plane-alert driven presets (facet map-filter ON)
        { id: 'builtin_alert_military', name: 'Alerts: Military', builtin: true, map: { enabled: true, mode: 'dynamic', autoCenter: true, autoZoom: true, fixedCenterLat: null, fixedCenterLon: null, fixedZoom: null }, state: { panelScope: 'all', tabState: {}, alerts: { filters: { category: 'Military' }, mapFilter: true, selectedIcaos: [] }, distance: { zones: [], mode: 'any' }, summary: { sumFilter: [] }, ranges: {}, watchlist: { mapFilter: false } } },
        { id: 'builtin_alert_government', name: 'Alerts: Government', builtin: true, map: { enabled: true, mode: 'dynamic', autoCenter: true, autoZoom: true, fixedCenterLat: null, fixedCenterLon: null, fixedZoom: null }, state: { panelScope: 'all', tabState: {}, alerts: { filters: { category: 'Government' }, mapFilter: true, selectedIcaos: [] }, distance: { zones: [], mode: 'any' }, summary: { sumFilter: [] }, ranges: {}, watchlist: { mapFilter: false } } },
        { id: 'builtin_alert_historic', name: 'Alerts: Historic / WW2-style', builtin: true, map: { enabled: true, mode: 'dynamic', autoCenter: true, autoZoom: true, fixedCenterLat: null, fixedCenterLon: null, fixedZoom: null }, state: { panelScope: 'all', tabState: {}, alerts: { filters: { category: 'Historic' }, mapFilter: true, selectedIcaos: [] }, distance: { zones: [], mode: 'any' }, summary: { sumFilter: [] }, ranges: {}, watchlist: { mapFilter: false } } },
        { id: 'builtin_alert_interesting', name: 'Alerts: Interesting', builtin: true, map: { enabled: true, mode: 'dynamic', autoCenter: true, autoZoom: true, fixedCenterLat: null, fixedCenterLon: null, fixedZoom: null }, state: { panelScope: 'all', tabState: {}, alerts: { filters: { category: 'Interesting' }, mapFilter: true, selectedIcaos: [] }, distance: { zones: [], mode: 'any' }, summary: { sumFilter: [] }, ranges: {}, watchlist: { mapFilter: false } } },
        { id: 'builtin_alert_police', name: 'Alerts: Law Enforcement (Police)', builtin: true, map: { enabled: true, mode: 'dynamic', autoCenter: true, autoZoom: true, fixedCenterLat: null, fixedCenterLon: null, fixedZoom: null }, state: { panelScope: 'all', tabState: {}, alerts: { filters: { category: 'Law Enforcement' }, mapFilter: true, selectedIcaos: [] }, distance: { zones: [], mode: 'any' }, summary: { sumFilter: [] }, ranges: {}, watchlist: { mapFilter: false } } },
        { id: 'builtin_alert_redarrows', name: 'Alerts Tag: Red Arrows', builtin: true, map: { enabled: true, mode: 'dynamic', autoCenter: true, autoZoom: true, fixedCenterLat: null, fixedCenterLon: null, fixedZoom: null }, state: { panelScope: 'all', tabState: {}, alerts: { filters: { tag: 'Red Arrows' }, mapFilter: true, selectedIcaos: [] }, distance: { zones: [], mode: 'any' }, summary: { sumFilter: [] }, ranges: {}, watchlist: { mapFilter: false } } },
        { id: 'builtin_alert_warbird', name: 'Alerts Tag: Warbird', builtin: true, map: { enabled: true, mode: 'dynamic', autoCenter: true, autoZoom: true, fixedCenterLat: null, fixedCenterLon: null, fixedZoom: null }, state: { panelScope: 'all', tabState: {}, alerts: { filters: { tag: 'Warbird' }, mapFilter: true, selectedIcaos: [] }, distance: { zones: [], mode: 'any' }, summary: { sumFilter: [] }, ranges: {}, watchlist: { mapFilter: false } } },
        { id: 'builtin_alert_bbmf', name: 'Alerts Tag: BBMF', builtin: true, map: { enabled: true, mode: 'dynamic', autoCenter: true, autoZoom: true, fixedCenterLat: null, fixedCenterLon: null, fixedZoom: null }, state: { panelScope: 'all', tabState: {}, alerts: { filters: { tag: 'BBMF' }, mapFilter: true, selectedIcaos: [] }, distance: { zones: [], mode: 'any' }, summary: { sumFilter: [] }, ranges: {}, watchlist: { mapFilter: false } } },
        { id: 'builtin_alert_raf', name: 'Alerts Tag: RAF', builtin: true, map: { enabled: true, mode: 'dynamic', autoCenter: true, autoZoom: true, fixedCenterLat: null, fixedCenterLon: null, fixedZoom: null }, state: { panelScope: 'all', tabState: {}, alerts: { filters: { tag: 'RAF' }, mapFilter: true, selectedIcaos: [] }, distance: { zones: [], mode: 'any' }, summary: { sumFilter: [] }, ranges: {}, watchlist: { mapFilter: false } } },
        { id: 'builtin_alert_police_tag', name: 'Alerts Tag: Police', builtin: true, map: { enabled: true, mode: 'dynamic', autoCenter: true, autoZoom: true, fixedCenterLat: null, fixedCenterLon: null, fixedZoom: null }, state: { panelScope: 'all', tabState: {}, alerts: { filters: { tag: 'Police' }, mapFilter: true, selectedIcaos: [] }, distance: { zones: [], mode: 'any' }, summary: { sumFilter: [] }, ranges: {}, watchlist: { mapFilter: false } } },
        { id: 'builtin_alert_airambulance', name: 'Alerts Tag: Air Ambulance', builtin: true, map: { enabled: true, mode: 'dynamic', autoCenter: true, autoZoom: true, fixedCenterLat: null, fixedCenterLon: null, fixedZoom: null }, state: { panelScope: 'all', tabState: {}, alerts: { filters: { tag: 'Air Ambulance' }, mapFilter: true, selectedIcaos: [] }, distance: { zones: [], mode: 'any' }, summary: { sumFilter: [] }, ranges: {}, watchlist: { mapFilter: false } } },
        { id: 'builtin_alert_coastguard', name: 'Alerts Tag: Coastguard', builtin: true, map: { enabled: true, mode: 'dynamic', autoCenter: true, autoZoom: true, fixedCenterLat: null, fixedCenterLon: null, fixedZoom: null }, state: { panelScope: 'all', tabState: {}, alerts: { filters: { tag: 'Coastguard' }, mapFilter: true, selectedIcaos: [] }, distance: { zones: [], mode: 'any' }, summary: { sumFilter: [] }, ranges: {}, watchlist: { mapFilter: false } } }
    ];

    // localStorage keys — must not change (migration required if they do)
    var LS_SETTINGS       = 'rf_settings_v1';
    var LS_TAB_VIS        = 'rf_tab_vis_v1';
    var LS_SUM_SETTINGS   = 'rf_sum_settings_v1';
    var LS_VIEWS          = 'rf_views_v1';
    var LS_DIST_LOCS      = 'rf_dist_locs_v1';
    var LS_DIST_ZONES     = 'rf_dist_zones_v2';
    var LS_DIST_MODE      = 'rf_dist_mode_v1';
    var LS_RANGES         = 'rf_ranges_v1';
    var LS_WATCHLIST      = 'rf_watchlist_v1';
    var LS_NOTIF          = 'rf_notif_v1';
    var LS_RECORDS        = 'rf_records_v1';
    var LS_ALERTS         = 'rf_alerts_v1';
    var LS_DB_AIRPORTS    = 'rf_db_airports_v1';
    var LS_DB_AIRPORTS_TS = 'rf_db_airports_ts';
    var LS_DB_AIRLINES    = 'rf_db_airlines_v1';
    var LS_DB_AIRLINES_TS = 'rf_db_airlines_ts';
    var LS_DB_ROUTES_PFX  = 'rf_db_rt_';
    var LS_HOME           = 'rf_home_v1';
    var LS_HOME_COOKIE    = 'rf_home_cookie_v1';
    var LS_PERSIST        = 'rf_persist_v1';
    var LS_PERSIST_SNAP   = 'rf_persist_snapshot_v1';
    var LS_RV             = 'rf_rv_v1';

    // Remote data source URLs
    var DB_AIRPORTS_URL = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv';
    var DB_AIRLINES_URL = 'https://raw.githubusercontent.com/vradarserver/standing-data/main/airlines/schema-01/airlines.csv';
    var DB_ROUTES_URL   = 'https://raw.githubusercontent.com/vradarserver/standing-data/main/routes/schema-01/{P}/{CODE}-all.csv';
    var DB_SYNC_MS      = 24 * 60 * 60 * 1000; // 24 hours

    // ═══════════════════════════════════════════════════════════════════════════
    // §2  State — all mutable variables
    // ═══════════════════════════════════════════════════════════════════════════

    // Core panel state
    var _panelOpen   = false;
    var _activeTab   = 'summary';
    var _panelScope  = 'all';   // 'all' | 'inview' | 'filtered'
    var _rfTabMenuOpen = false;

    // Per-tab filter state
    var _tabState = {
        airports:  { items: new Set(), direction: 'both', sortBy: 'count', sortDir: 'desc' },
        countries: { items: new Set(), direction: 'both', sortBy: 'count', sortDir: 'desc' },
        operators: { items: new Set(), direction: 'both', sortBy: 'count', sortDir: 'desc' },
        aircraft:  { items: new Set(), direction: 'both', sortBy: 'count', sortDir: 'desc',
                     catFilter: new Set(), regCountryFilter: '' },
    };

    // Tab visibility (which tabs appear in the bar)
    var _tabVisibility = {
        summary: true, airports: true, countries: true, operators: true,
        aircraft: true, views: true, alerts: true, distance: true,
        ranges: true, settings: true
    };

    // Summary tab state
    var _summarySettings = {
        altitude: true, attention: true, closest: true, speed: true,
        highflyers: true, types: true, operators: true, routes: true,
        methods: true, range: true, arrivals: true, countries: true, slowest: true
    };
    var _sumFilter      = new Set();  // ICAO subset quick-filter from summary clicks
    var _sumClickData   = [];         // indexed click data (avoids inline JSON in HTML attrs)
    var _sumArrivals    = {};         // {icao: firstSeenMs}
    var _sumAttentionSort = { by: 'distance', dir: 'asc' };

    // Views state
    var _savedViews            = [];
    var _activeViewId          = '';
    var _activeViewIds         = [];
    var _rfQuickSelectedViewId = '';
    var _rfPreViewState        = null;

    // Alerts state
    var _alertsDb            = null;   // null = not loaded, array when loaded
    var _alertsFetching      = false;
    var _alertsTimestamp     = 0;
    var _alertsError         = null;
    var _alertsMoreInfo      = null;   // icao of currently expanded detail card
    var _alertsFilters       = { cmpg: '', category: '', tag: '' };
    var _alertsMapFilter     = false;
    var _alertsMapFilterIcaos = null;  // pre-built Set<icao> for fast checks
    var _alertsSelectedIcaos = new Set();
    var _alertsPhotoCache    = {};
    var _alertsPhotoInflight = {};
    var _alertsClickData     = [];

    // Distance filter state
    var _distanceLocations = [];   // [{name, lat, lon, radiusNm}]
    var _distanceZones     = [];   // [{lat, lon, radiusNm, name, altMode, altMin, altMax}]
    var _distanceMode      = 'inside'; // 'inside' | 'outside' | 'maponly'
    var _distanceForm      = {
        locationIdx: -1, locationName: '', lat: '', lon: '',
        radiusNm: '50', altMode: 'all', altMin: '0', altMax: '50000', mapZoom: 8
    };
    var _distMap        = null;
    var _distMapMarker  = null;
    var _distMapCircle  = null;
    var _leafletReady   = false;
    var _distOLLayer    = null;
    var _distOLSource   = null;

    // Ranges filter state
    var _rangesFilter = {
        speedMin: '', speedMax: '',
        altMin: '',   altMax: '',
        vrMin: '',    vrMax: '',
        squawk: '',
        ageMin: '',   ageMax: '',
        callsign: ''
    };

    // Watchlist state
    var _watchList          = [];   // [{icao, label, added, ...v2 fields}]
    var _watchlistMapFilter = false;

    // Notification state
    var _notifSettings = {
        enabled: false, military: true, emergency: true,
        customRange: false, customRangeNm: 20, newAircraft: false,
        toasts: true, toastPhotos: true, toastDuration: 14, browserNotif: false
    };
    var _notifSeen        = {};   // {icao_condition: lastNotifMs}
    var _notifToastSeen   = {};   // {icao_condition: lastToastMs}
    var _notifLastCheck   = 0;
    var _toastPhotoCache  = {};   // {icao: {url, ts}}
    var _toastPhotoInflight = {};
    var _toastCounter     = 0;

    // Session records state
    var _sessionRecords = {
        maxAircraft: { val: 0, date: '' },
        maxMilitary: { val: 0, date: '' },
        maxRange:    { val: 0, icao: '', callsign: '', date: '' },
        maxAltitude: { val: 0, icao: '', callsign: '', date: '' },
        maxSpeed:    { val: 0, icao: '', callsign: '', date: '' }
    };
    var _sessionStats = { aircraft: 0, military: 0, range: 0 };

    // Local DB state
    var _localDb = {
        airports:       null,   // {ICAO: {n, c}} loaded from localStorage/fetch
        airlines:       null,   // {CODE: name}
        routes:         {},     // {CALLSIGN: {dep, arr}}
        routesFetched:  {},     // codes already fetched
        routesFetching: {},     // codes currently in-flight
        st: {
            airports: { busy: false, err: null, count: 0, ts: 0 },
            airlines: { busy: false, err: null, count: 0, ts: 0 }
        }
    };

    // Module-level aircraft data caches (rebuilt by getAircraftData)
    var _airportLabels        = new Map(); // icao -> name
    var _airportIso2          = new Map(); // icao -> iso2
    var _countryIso2          = new Map(); // country name -> iso2
    var _aircraftIcaoMap      = new Map(); // typeKey -> icaoType
    var _aircraftAdsbCat      = new Map(); // typeKey -> ADS-B category
    var _aircraftWtc          = new Map(); // typeKey -> WTC
    var _aircraftRegCountries = new Map(); // typeKey -> Map<name, iso2>
    var _allRegCountries      = new Map(); // name -> iso2
    var _militaryTypeKeys     = new Set();
    var _catCounts            = {};        // catId -> count

    // Data cache invalidation
    var _rfDataDirty      = true;
    var _rfDataLastKey    = '';
    var _rfDataLastResult = null;

    // Single-tab focused mode (set when opening via a header button)
    var _rfSingleTabMode = false;

    // Map / home state
    var _mapViewSaved          = null;
    var _selectionMapViewSaved = null;
    var _autoFitSavedView      = null;
    var _rfDidInitialHomeCenter = false;
    var _rfHomePickHandler     = null;
    var _rfCookieOk            = null;
    var _rfLocalStorageOk      = null;
    var _rfLastPersistSaveTs   = 0;

    // Observer refs (cleaned up when leaving sidebar mode)
    var _rfObservers       = [];
    var _rfMapResizeTimer  = null;
    var _rfMapInsetState   = null;

    // Refresh timer
    var _refreshTimer = null;

    // RV panel state
    var _rvOpen        = false;
    var _rvCheckedIds  = [];    // IDs selected in the RV picker
    var _rvPinnedIds   = [];    // IDs always kept active
    var _rvPopupViewIds = [];   // IDs allowed to emit popups (opt-in)
    var _rvSoundViewIds = [];   // IDs allowed to emit sounds (opt-in)
    var _rvCycleActive = false;
    var _rvCyclePaused = false;
    var _rvCycleIdx    = 0;
    var _rvCycleSec    = 30;
    var _rvCycleTimer  = null;
    var _rvPopupSec    = 4;     // how long cycle popup stays visible
    var _rvPopupTimer  = null;
    var _rvCycleRequireSeenIds = []; // per-view cycle gate: skip until seen
    var _rvSeenHistory = {};         // { viewId: lastSeenTs } while session runs
    var _rvDetectMode  = 'step';     // 'step' | 'round'
    var _rvDetectSound = false;      // play sound when detections occur
    var _rvStickyNotify = true;      // keep RV detection panel visible until dismissed
    var _rvPopupOnEntryOnly = true;  // popup only when new aircraft enter watched view
    var _rvRunMode = 'cycle';        // 'cycle' | 'watchall'
    var _rvRoundHits   = {};         // {viewId: {name, count}}
    var _rvSeenIcaosByView = {};     // {viewId: {icao:1}} cumulative session history
    var _rvNewHits = {};             // {viewId: number} last new-aircraft count
    var _rvLiveCountCache = {};      // {viewId: liveCount} updated by watch engine ticks
    var _rvManualPos = null;         // {left, top} draggable RV window position

    // ═══════════════════════════════════════════════════════════════════════════
    // §3  Settings — schema, load, save, defaults
    // ═══════════════════════════════════════════════════════════════════════════

    // Core settings object — matches rf_settings_v1 contract
    var settings = {
        displayMode:    'sidebar',  // 'sidebar' | 'popup'
        sidebarSide:    'right',    // 'left' | 'right'
        useLocalDb:     true,
        routeKnownOnly: true,
        hideAllScope:   false,
        homeOverride:   false,
        homeLat:        '',
        homeLon:        '',
        homeZoom:       12,
        homeCenterOnOpen: false,
        selectionAutoCenter: true,
        settingsAccOpen: {},
        alertsViewMode: 'inview',
        alertsSortBy: 'distance',
        alertsFacetSource: 'db', // 'db' | 'live'
        aircraftViewMode: 'inview',
        aircraftSortBy: 'count',
        rvNotifyLayout: 'overlay', // 'overlay' | 'sidebar'
        headerBtns: {
            summary:   false,
            airports:  false,
            countries: false,
            operators: false,
            aircraft:  false,
            alerts:    false,
            distance:  false,
            ranges:    false,
            watchlist: false
        }
    };

    // Watchlist settings namespace (spec §5 / §12.9)
    var watchlistSettings = {
        enabled:             true,
        mapFilterDefault:    false,
        maxEntries:          2000,
        allowDormantEntries: true,
        search: {
            includeLivePlanes: true,
            includeAlertsDb:   true,
            fuzzyMatch:        true,
            minQueryLength:    2,
            maxResults:        100
        },
        autoAddRules: {
            fromAlertsCategory: [],
            fromAlertsTag:      [],
            fromOperatorCodes:  [],
            fromRegCountry:     []
        },
        notifications: {
            onFirstSeen:               true,
            onReappearedAfterMinutes:  60,
            quietHoursEnabled:         false,
            quietHoursLocalStart:      '23:00',
            quietHoursLocalEnd:        '06:00'
        },
        retention: {
            pruneNeverSeenAfterDays: 0,
            pruneNotSeenAfterDays:   0
        },
        importExport: {
            allowCsv:         true,
            allowJson:        true,
            mergeModeDefault: 'upsert'
        }
    };

    /**
     * Load core settings from localStorage into the settings object.
     * Unknown keys are ignored; missing keys keep their defaults.
     */
    function _rfLoadSettings() {
        var raw = _rfLoad(LS_SETTINGS);
        if (raw && typeof raw === 'object') {
            var keys = Object.keys(settings);
            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                if (raw[k] !== undefined) {
                    // Deep-merge plain sub-objects (e.g. headerBtns) rather than replace
                    if (k === 'headerBtns' && typeof raw[k] === 'object' && raw[k] !== null) {
                        Object.assign(settings.headerBtns, raw[k]);
                    } else {
                        settings[k] = raw[k];
                    }
                }
            }
        }
    }

    /** Persist current settings object to localStorage. */
    function _rfSaveSettings() {
        _rfSave(LS_SETTINGS, settings);
    }

    /** Load summary section visibility from localStorage. */
    function _rfLoadSummarySettings() {
        var raw = _rfLoad(LS_SUM_SETTINGS);
        if (raw && typeof raw === 'object') {
            var keys = Object.keys(_summarySettings);
            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                if (typeof raw[k] === 'boolean') _summarySettings[k] = raw[k];
            }
        }
    }

    /** Persist summary section visibility. */
    function _rfSaveSummarySettings() {
        _rfSave(LS_SUM_SETTINGS, _summarySettings);
    }

    /** Load tab visibility from localStorage. */
    function _rfLoadTabVisibility() {
        var raw = _rfLoad(LS_TAB_VIS);
        if (raw && typeof raw === 'object') {
            var keys = Object.keys(_tabVisibility);
            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                if (typeof raw[k] === 'boolean') _tabVisibility[k] = raw[k];
            }
        }
    }

    /** Persist tab visibility. */
    function _rfSaveTabVisibility() {
        _rfSave(LS_TAB_VIS, _tabVisibility);
    }

    /** Load notification settings from localStorage. */
    function _rfLoadNotifSettings() {
        var raw = _rfLoad(LS_NOTIF);
        if (raw && typeof raw === 'object') {
            var keys = Object.keys(_notifSettings);
            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                if (raw[k] !== undefined) _notifSettings[k] = raw[k];
            }
        }
    }

    /** Persist notification settings. */
    function _rfSaveNotifSettings() {
        _rfSave(LS_NOTIF, _notifSettings);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // §4  Persistence — localStorage helpers, migration, import/export
    // ═══════════════════════════════════════════════════════════════════════════

    /** Guard: returns true if localStorage is available. */
    function _rfCanUseLocalStorage() {
        if (_rfLocalStorageOk !== null) return _rfLocalStorageOk;
        try {
            var t = '__rf_test__';
            localStorage.setItem(t, '1');
            localStorage.removeItem(t);
            _rfLocalStorageOk = true;
        } catch (e) {
            _rfLocalStorageOk = false;
        }
        return _rfLocalStorageOk;
    }

    /**
     * Load and JSON-parse a localStorage key.
     * Returns null on missing key, parse error, or unavailable storage.
     */
    function _rfLoad(key) {
        if (!_rfCanUseLocalStorage()) return null;
        try {
            var raw = localStorage.getItem(key);
            if (raw === null) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    /**
     * JSON-stringify and store a value in localStorage.
     * Silently ignores quota errors and unavailable storage.
     */
    function _rfSave(key, value) {
        if (!_rfCanUseLocalStorage()) return;
        try {
            localStorage.setItem(key, JSON.stringify(value));
            _rfLastPersistSaveTs = Date.now();
        } catch (e) {
            // quota exceeded or storage unavailable — silently ignore
        }
    }

    /** Remove a key from localStorage. */
    function _rfRemove(key) {
        if (!_rfCanUseLocalStorage()) return;
        try { localStorage.removeItem(key); } catch (e) {}
    }

    /** Load session records from localStorage. */
    function _rfLoadRecords() {
        var raw = _rfLoad(LS_RECORDS);
        if (raw && typeof raw === 'object') {
            var keys = Object.keys(_sessionRecords);
            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                if (raw[k] !== undefined) _sessionRecords[k] = raw[k];
            }
        }
    }

    /** Persist session records. */
    function _rfSaveRecords() {
        _rfSave(LS_RECORDS, _sessionRecords);
    }

    /** Load saved views from localStorage. */
    function _rfLoadViews() {
        var raw = _rfLoad(LS_VIEWS);
        if (Array.isArray(raw)) _savedViews = raw;
    }

    /** Persist saved views. */
    function _rfSaveViews() {
        _rfSave(LS_VIEWS, _savedViews);
    }

    /** Load RV panel settings + active view IDs. */
    function _rvLoad() {
        var raw = _rfLoad(LS_RV);
        if (!raw || typeof raw !== 'object') return;
        if (typeof raw.cycleSec  === 'number' && raw.cycleSec  >= 1) _rvCycleSec  = raw.cycleSec;
        if (typeof raw.popupSec  === 'number' && raw.popupSec  >= 0) _rvPopupSec  = raw.popupSec;
        if (Array.isArray(raw.activeViewIds)) _activeViewIds = raw.activeViewIds;
        if (Array.isArray(raw.checkedIds))    _rvCheckedIds  = raw.checkedIds;
        if (Array.isArray(raw.pinnedIds))     _rvPinnedIds   = raw.pinnedIds;
        if (Array.isArray(raw.popupViewIds))  _rvPopupViewIds = raw.popupViewIds;
        if (Array.isArray(raw.soundViewIds))  _rvSoundViewIds = raw.soundViewIds;
        if (Array.isArray(raw.requireSeenIds)) _rvCycleRequireSeenIds = raw.requireSeenIds;
        if (raw.detectMode === 'step' || raw.detectMode === 'round') _rvDetectMode = raw.detectMode;
        if (typeof raw.detectSound === 'boolean') _rvDetectSound = raw.detectSound;
        if (typeof raw.stickyNotify === 'boolean') _rvStickyNotify = raw.stickyNotify;
        if (typeof raw.popupOnEntryOnly === 'boolean') _rvPopupOnEntryOnly = raw.popupOnEntryOnly;
        if (raw.runMode === 'cycle' || raw.runMode === 'watchall') _rvRunMode = raw.runMode;
        if (raw.manualPos && typeof raw.manualPos === 'object') _rvManualPos = raw.manualPos;
    }

    function _rvSaveObj() {
        return {
            cycleSec: _rvCycleSec,
            popupSec: _rvPopupSec,
            activeViewIds: _activeViewIds,
            checkedIds: _rvCheckedIds,
            pinnedIds: _rvPinnedIds,
            popupViewIds: _rvPopupViewIds,
            soundViewIds: _rvSoundViewIds,
            requireSeenIds: _rvCycleRequireSeenIds,
            detectMode: _rvDetectMode,
            detectSound: _rvDetectSound,
            stickyNotify: _rvStickyNotify,
            popupOnEntryOnly: _rvPopupOnEntryOnly,
            runMode: _rvRunMode,
            manualPos: _rvManualPos
        };
    }

    /** Persist RV settings + active view IDs. */
    function _rvSave() { _rfSave(LS_RV, _rvSaveObj()); }

    /** Called from _rfSyncActiveViewPointers to keep active IDs persisted. */
    function _rvSaveActive() { _rfSave(LS_RV, _rvSaveObj()); }

    /** Load distance locations and zones from localStorage. */
    function _rfLoadDistance() {
        var locs  = _rfLoad(LS_DIST_LOCS);
        var zones = _rfLoad(LS_DIST_ZONES);
        var mode  = _rfLoad(LS_DIST_MODE);
        if (Array.isArray(locs))  _distanceLocations = locs;
        if (Array.isArray(zones)) _distanceZones     = zones;
        if (typeof mode === 'string' &&
            (mode === 'inside' || mode === 'outside' || mode === 'maponly')) {
            _distanceMode = mode;
        }
    }

    /** Persist distance state. */
    function _rfSaveDistance() {
        _rfSave(LS_DIST_LOCS,  _distanceLocations);
        _rfSave(LS_DIST_ZONES, _distanceZones);
        _rfSave(LS_DIST_MODE,  _distanceMode);
    }

    /** Load ranges filter from localStorage. */
    function _rfLoadRanges() {
        var raw = _rfLoad(LS_RANGES);
        if (raw && typeof raw === 'object') {
            var keys = Object.keys(_rangesFilter);
            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                if (raw[k] !== undefined) _rangesFilter[k] = raw[k];
            }
        }
    }

    /** Persist ranges filter. */
    function _rfSaveRanges() {
        _rfSave(LS_RANGES, _rangesFilter);
    }

    /**
     * Load watchlist from localStorage, migrating legacy format if needed.
     * Legacy format: [{icao, label, added}]
     * v2 format: [{icao, label, added, source, sourceRef, status, priority,
     *              tags, firstSeenAt, lastSeenAt}]
     */
    function _rfLoadWatchlist() {
        var raw = _rfLoad(LS_WATCHLIST);
        if (Array.isArray(raw)) {
            _watchList = migrateWatchlist(raw);
        }
    }

    /** Persist watchlist. */
    function _rfSaveWatchlist() {
        _rfSave(LS_WATCHLIST, _watchList);
    }

    /**
     * Migrate legacy watchlist array to v2 schema.
     * Legacy: [{icao, label, added}]
     * Adds missing v2 fields with safe defaults.
     * Idempotent — v2 entries pass through unchanged.
     */
    function migrateWatchlist(arr) {
        return arr.map(function (entry) {
            // Already v2 if it has 'status' field
            if (entry.status !== undefined) return entry;
            // Legacy entry — promote to v2
            return {
                icao:       (entry.icao || '').toUpperCase(),
                label:      entry.label || '',
                added:      entry.added || Date.now(),
                source:     'manual',
                sourceRef:  null,
                status:     'active',
                priority:   'normal',
                tags:       [],
                firstSeenAt: null,
                lastSeenAt:  null
            };
        });
    }

    /**
     * Build a full import/export snapshot of all persisted state.
     * Schema version 1.
     */
    function _rfBuildExportSnapshot() {
        return {
            v:       1,
            savedAt: new Date().toISOString(),
            settings:     Object.assign({}, settings),
            notifSettings: Object.assign({}, _notifSettings),
            watchlistSettings: JSON.parse(JSON.stringify(watchlistSettings)),
            distance: {
                locations: JSON.parse(JSON.stringify(_distanceLocations)),
                zones:     JSON.parse(JSON.stringify(_distanceZones)),
                mode:      _distanceMode
            },
            tabs: {
                visibility: Object.assign({}, _tabVisibility),
                tabState:   _rfSerializeTabState()
            },
            summary: {
                settings:   Object.assign({}, _summarySettings),
                sumFilter:  Array.from(_sumFilter)
            },
            views:     JSON.parse(JSON.stringify(_savedViews)),
            rv:        JSON.parse(JSON.stringify(_rvSaveObj())),
            ranges:    Object.assign({}, _rangesFilter),
            watchlist: JSON.parse(JSON.stringify(_watchList)),
            records:   JSON.parse(JSON.stringify(_sessionRecords))
        };
    }

    /**
     * Serialize _tabState to a plain object (Sets -> Arrays).
     */
    function _rfSerializeTabState() {
        var out = {};
        var tabs = Object.keys(_tabState);
        for (var i = 0; i < tabs.length; i++) {
            var k = tabs[i];
            var ts = _tabState[k];
            out[k] = {
                items:     Array.from(ts.items),
                direction: ts.direction,
                sortBy:    ts.sortBy,
                sortDir:   ts.sortDir
            };
            if (k === 'aircraft') {
                out[k].catFilter         = Array.from(ts.catFilter);
                out[k].regCountryFilter  = ts.regCountryFilter;
            }
        }
        return out;
    }

    /**
     * Deserialize plain object back to _tabState (Arrays -> Sets).
     */
    function _rfDeserializeTabState(raw) {
        if (!raw || typeof raw !== 'object') return;
        var tabs = Object.keys(_tabState);
        for (var i = 0; i < tabs.length; i++) {
            var k = tabs[i];
            if (!raw[k]) continue;
            var src = raw[k];
            _tabState[k].items    = new Set(Array.isArray(src.items) ? src.items : []);
            _tabState[k].direction = src.direction || 'both';
            _tabState[k].sortBy   = src.sortBy || 'count';
            _tabState[k].sortDir  = src.sortDir || 'desc';
            if (k === 'aircraft') {
                _tabState[k].catFilter        = new Set(Array.isArray(src.catFilter) ? src.catFilter : []);
                _tabState[k].regCountryFilter = src.regCountryFilter || '';
            }
        }
    }

    /**
     * Apply an import/export snapshot to live state.
     * Only imports keys that are present; ignores unknown keys.
     */
    function _rfApplyImportSnapshot(snap) {
        if (!snap || snap.v !== 1) return false;
        try {
            if (snap.settings)      Object.assign(settings, snap.settings);
            if (snap.notifSettings) Object.assign(_notifSettings, snap.notifSettings);
            if (snap.watchlistSettings) Object.assign(watchlistSettings, snap.watchlistSettings);
            if (snap.distance) {
                if (Array.isArray(snap.distance.locations)) _distanceLocations = snap.distance.locations;
                if (Array.isArray(snap.distance.zones))     _distanceZones     = snap.distance.zones;
                if (snap.distance.mode)                     _distanceMode      = snap.distance.mode;
            }
            if (snap.tabs) {
                if (snap.tabs.visibility) Object.assign(_tabVisibility, snap.tabs.visibility);
                if (snap.tabs.tabState)   _rfDeserializeTabState(snap.tabs.tabState);
            }
            if (snap.summary) {
                if (snap.summary.settings) Object.assign(_summarySettings, snap.summary.settings);
                if (Array.isArray(snap.summary.sumFilter)) _sumFilter = new Set(snap.summary.sumFilter);
            }
            if (Array.isArray(snap.views))    _savedViews  = snap.views;
            if (snap.rv && typeof snap.rv === 'object') {
                if (typeof snap.rv.cycleSec  === 'number' && snap.rv.cycleSec  >= 1) _rvCycleSec  = snap.rv.cycleSec;
                if (typeof snap.rv.popupSec  === 'number' && snap.rv.popupSec  >= 0) _rvPopupSec  = snap.rv.popupSec;
                if (Array.isArray(snap.rv.activeViewIds)) _activeViewIds = snap.rv.activeViewIds;
                if (Array.isArray(snap.rv.checkedIds))    _rvCheckedIds  = snap.rv.checkedIds;
                if (Array.isArray(snap.rv.pinnedIds))     _rvPinnedIds   = snap.rv.pinnedIds;
                if (Array.isArray(snap.rv.popupViewIds))  _rvPopupViewIds = snap.rv.popupViewIds;
                if (Array.isArray(snap.rv.soundViewIds))  _rvSoundViewIds = snap.rv.soundViewIds;
                if (Array.isArray(snap.rv.requireSeenIds)) _rvCycleRequireSeenIds = snap.rv.requireSeenIds;
                if (snap.rv.detectMode === 'step' || snap.rv.detectMode === 'round') _rvDetectMode = snap.rv.detectMode;
                if (typeof snap.rv.detectSound === 'boolean') _rvDetectSound = snap.rv.detectSound;
                if (typeof snap.rv.stickyNotify === 'boolean') _rvStickyNotify = snap.rv.stickyNotify;
                if (typeof snap.rv.popupOnEntryOnly === 'boolean') _rvPopupOnEntryOnly = snap.rv.popupOnEntryOnly;
                if (snap.rv.runMode === 'cycle' || snap.rv.runMode === 'watchall') _rvRunMode = snap.rv.runMode;
                if (snap.rv.manualPos && typeof snap.rv.manualPos === 'object') _rvManualPos = snap.rv.manualPos;
            }
            if (snap.ranges)                  Object.assign(_rangesFilter, snap.ranges);
            if (Array.isArray(snap.watchlist)) _watchList  = migrateWatchlist(snap.watchlist);
            if (snap.records)                 Object.assign(_sessionRecords, snap.records);
            return true;
        } catch (e) {
            console.error('[RF] Import snapshot failed:', e);
            return false;
        }
    }

    /** Persist a snapshot to localStorage (the auto-persist slot). */
    function _rfPersistSnapshot() {
        _rfSave(LS_PERSIST_SNAP, _rfBuildExportSnapshot());
    }

    /** Load all persisted state from localStorage. Called at init. */
    function _rfLoadAllPersisted() {
        _rfLoadSettings();
        _rfLoadSummarySettings();
        _rfLoadTabVisibility();
        _rfLoadNotifSettings();
        _rfLoadRecords();
        _rfLoadViews();
        _rvLoad();
        _rfLoadDistance();
        _rfLoadRanges();
        _rfLoadWatchlist();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // §5  Lookup tables — ICAO ranges, country maps, airline names, categories
    // ═══════════════════════════════════════════════════════════════════════════

    // ── ICAO airline code -> full name (built-in fallback) ────────────────────
    var AIRLINE_NAMES = {
        'BAW':'British Airways','EZY':'easyJet','RYR':'Ryanair','VIR':'Virgin Atlantic',
        'TOM':'TUI Airways','TCX':'TUI Airways','MON':'Monarch','FLY':'Flybe',
        'LOG':'Loganair','BEE':'Flybe','FHY':'FreeBird','SHT':'British Airways Shuttle',
        'DLH':'Lufthansa','AFR':'Air France','KLM':'KLM','IBE':'Iberia','VLG':'Vueling',
        'BEL':'Brussels Airlines','SAS':'Scandinavian Airlines','NOR':'Norwegian',
        'SKW':'SkyWest','NAX':'Norwegian Air','AUA':'Austrian Airlines',
        'SWR':'Swiss International','TAP':'TAP Air Portugal','EJU':'easyJet Europe',
        'UAE':'Emirates','QTR':'Qatar Airways','ETD':'Etihad Airways','THY':'Turkish Airlines',
        'SVA':'Saudi Arabian Airlines','GFA':'Gulf Air','OMA':'Oman Air','FDB':'flydubai',
        'EK':'Emirates','AAL':'American Airlines','UAL':'United Airlines','DAL':'Delta Air Lines',
        'SWA':'Southwest Airlines','JBU':'JetBlue','ASA':'Alaska Airlines','HAL':'Hawaiian Airlines',
        'ACA':'Air Canada','WJA':'WestJet','TSC':'Air Transat','CPA':'Cathay Pacific',
        'CES':'China Eastern','CSN':'China Southern','CCA':'Air China','CHH':'Hainan Airlines',
        'JAL':'Japan Airlines','ANA':'All Nippon Airways','KAL':'Korean Air','AAR':'Asiana Airlines',
        'SIA':'Singapore Airlines','MAS':'Malaysia Airlines','THA':'Thai Airways',
        'QFA':'Qantas','VOZ':'Virgin Australia','JST':'Jetstar','ANZ':'Air New Zealand',
        'ETH':'Ethiopian Airlines','KQA':'Kenya Airways','SAA':'South African Airways',
        'RAM':'Royal Air Maroc','MSR':'EgyptAir','TUN':'Tunisair',
        'AFL':'Aeroflot','SDM':'Rossiya Airlines','UTN':'UTair',
        'LOT':'LOT Polish Airlines','CSA':'Czech Airlines','MAL':'Malev','ROT':'TAROM',
        'AZA':'Alitalia','EIN':'Aer Lingus','ICE':'Icelandair','FIN':'Finnair',
        'WZZ':'Wizz Air','WUK':'Wizz Air UK','RJA':'Royal Jordanian','MEA':'Middle East Airlines',
        'AMX':'Aeromexico','AVA':'Avianca','LAN':'LATAM Airlines','TAM':'LATAM Brasil',
        'GLO':'Gol Transportes','AZU':'Azul Brazilian Airlines','ARG':'Aerolineas Argentinas',
        'FJI':'Fiji Airways','PIA':'Pakistan International Airlines','AIC':'Air India',
        'IGO':'IndiGo','SEJ':'SpiceJet','GOW':'Go First','VTI':'Vistara',
        'GEC':'Lufthansa Cargo','BOX':'DHL Air','FDX':'FedEx','UPS':'UPS Airlines',
        'MPH':'Martinair','CLX':'Cargolux','GXA':'Gemini Air Cargo',
        'EXS':'Jet2','TFL':'Arkefly','TRA':'Transavia','HVN':'Vietnam Airlines',
        'GWI':'Germanwings','EWG':'Eurowings','TUI':'TUI fly'
    };

    /**
     * Resolve an airline ICAO code to a human-readable name.
     * Checks local DB first, then built-in table, then returns code as-is.
     */
    function getAirlineName(code) {
        if (!code || code === 'unknown') return null;
        var uc = code.toUpperCase();
        if (_localDb.airlines && _localDb.airlines[uc]) return _localDb.airlines[uc];
        return AIRLINE_NAMES[uc] || uc;
    }

    // ── ISO 3166-1 alpha-2 -> Country name ────────────────────────────────────
    var ISO_COUNTRY = {
        'GB':'United Kingdom','US':'United States','DE':'Germany','FR':'France',
        'ES':'Spain','IT':'Italy','NL':'Netherlands','BE':'Belgium','IE':'Ireland',
        'PT':'Portugal','PL':'Poland','SE':'Sweden','NO':'Norway','DK':'Denmark',
        'FI':'Finland','AT':'Austria','CH':'Switzerland','TR':'Turkey','AE':'United Arab Emirates',
        'SA':'Saudi Arabia','QA':'Qatar','OM':'Oman','BH':'Bahrain','KW':'Kuwait',
        'IN':'India','CN':'China','JP':'Japan','KR':'South Korea','AU':'Australia',
        'NZ':'New Zealand','CA':'Canada','MX':'Mexico','BR':'Brazil','ZA':'South Africa',
        'RU':'Russia','UA':'Ukraine','BY':'Belarus','IL':'Israel','CY':'Cyprus',
        'HU':'Hungary','CZ':'Czech Republic','SK':'Slovakia','HR':'Croatia',
        'SI':'Slovenia','BG':'Bulgaria','RO':'Romania','RS':'Serbia','MK':'North Macedonia',
        'AL':'Albania','BA':'Bosnia & Herzegovina','IS':'Iceland','LV':'Latvia',
        'LT':'Lithuania','EE':'Estonia','PK':'Pakistan','AF':'Afghanistan','NP':'Nepal',
        'BD':'Bangladesh','LK':'Sri Lanka','TH':'Thailand','MY':'Malaysia','SG':'Singapore',
        'ID':'Indonesia','PH':'Philippines','VN':'Vietnam','KH':'Cambodia','MM':'Myanmar',
        'LA':'Laos','TW':'Taiwan','HK':'Hong Kong','MO':'Macau','MN':'Mongolia',
        'KZ':'Kazakhstan','UZ':'Uzbekistan','TM':'Turkmenistan','KG':'Kyrgyzstan',
        'TJ':'Tajikistan','AZ':'Azerbaijan','AM':'Armenia','GE':'Georgia',
        'IQ':'Iraq','IR':'Iran','JO':'Jordan','SY':'Syria','LB':'Lebanon','YE':'Yemen',
        'KE':'Kenya','TZ':'Tanzania','UG':'Uganda','ET':'Ethiopia','NG':'Nigeria',
        'GH':'Ghana','CI':'Ivory Coast','SN':'Senegal','MA':'Morocco','TN':'Tunisia',
        'LY':'Libya','EG':'Egypt','SD':'Sudan','AO':'Angola','ZW':'Zimbabwe',
        'MZ':'Mozambique','ZM':'Zambia','BW':'Botswana','AR':'Argentina','CL':'Chile',
        'PE':'Peru','CO':'Colombia','VE':'Venezuela','EC':'Ecuador','UY':'Uruguay',
        'BO':'Bolivia','PY':'Paraguay','CU':'Cuba','DO':'Dominican Republic',
        'JM':'Jamaica','TT':'Trinidad & Tobago','FJ':'Fiji','GR':'Greece','LU':'Luxembourg',
        'MT':'Malta','NA':'Namibia','MW':'Malawi','CM':'Cameroon','ER':'Eritrea',
        'DJ':'Djibouti','SO':'Somalia','KP':'North Korea'
    };

    /** Resolve ISO 3166-1 alpha-2 to country name. */
    function countryFromIso(iso2) {
        if (!iso2) return 'Unknown';
        return ISO_COUNTRY[iso2.toUpperCase()] || iso2.toUpperCase();
    }

    /** Generate flag emoji from ISO 3166-1 alpha-2 code. */
    function flagFromIso(iso2) {
        if (!iso2 || iso2.length !== 2) return '';
        var base = 0x1F1E6;
        return String.fromCodePoint(base + iso2.charCodeAt(0) - 65) +
               String.fromCodePoint(base + iso2.charCodeAt(1) - 65);
    }

    // ── ICAO airport prefix -> Country ────────────────────────────────────────
    var PREFIX_COUNTRY = {
        'EG':'United Kingdom','EI':'Ireland','EH':'Netherlands','EB':'Belgium',
        'EL':'Luxembourg','ED':'Germany','ET':'Germany','LF':'France','LE':'Spain',
        'GC':'Spain','LP':'Portugal','LG':'Greece','LI':'Italy','LM':'Malta',
        'LH':'Hungary','LO':'Austria','LK':'Czech Republic','LZ':'Slovakia','EP':'Poland',
        'LD':'Croatia','LJ':'Slovenia','LB':'Bulgaria','LR':'Romania','LY':'Serbia',
        'LW':'North Macedonia','LA':'Albania','LQ':'Bosnia & Herzegovina',
        'EK':'Denmark','EN':'Norway','ES':'Sweden','EF':'Finland','BI':'Iceland',
        'EV':'Latvia','EY':'Lithuania','EE':'Estonia','UK':'Ukraine','UM':'Belarus',
        'LT':'Turkey','LL':'Israel','LC':'Cyprus',
        'UU':'Russia','UL':'Russia','UW':'Russia','UI':'Russia','UN':'Russia',
        'UT':'Russia','UE':'Russia',
        'OE':'Saudi Arabia','OM':'UAE','OB':'Bahrain','OK':'Kuwait','OI':'Iran',
        'OJ':'Jordan','OS':'Syria','OL':'Lebanon','OY':'Yemen','OP':'Pakistan',
        'OA':'Afghanistan',
        'VT':'India','VE':'India','VI':'India','VN':'Nepal','VL':'Laos',
        'VB':'Myanmar','VD':'Cambodia','VV':'Vietnam',
        'WA':'Indonesia','WI':'Indonesia','WM':'Malaysia','WS':'Singapore',
        'VH':'Thailand','RJ':'Japan','RK':'South Korea','RC':'Taiwan',
        'ZB':'China','ZG':'China','ZH':'China','ZL':'China','ZP':'China',
        'ZS':'China','ZU':'China','ZW':'China','ZY':'China',
        'YM':'Australia','YB':'Australia','YP':'Australia','YS':'Australia',
        'YT':'Australia','NZ':'New Zealand',
        'FA':'South Africa','FB':'Botswana','FQ':'Mozambique','FW':'Malawi',
        'FV':'Zimbabwe','FK':'Cameroon','FN':'Angola',
        'HA':'Ethiopia','HH':'Eritrea','HK':'Kenya','HS':'Sudan','HT':'Tanzania',
        'HU':'Uganda','DN':'Nigeria','DG':'Ghana','DI':'Ivory Coast',
        'GM':'Morocco','DT':'Tunisia','HL':'Libya','HE':'Egypt',
        'CY':'Canada','CF':'Canada','CG':'Canada','CZ':'Canada',
        'MM':'Mexico','MU':'Cuba','MD':'Dominican Republic','MK':'Jamaica',
        'SB':'Brazil','SN':'Brazil','SS':'Brazil','SA':'Argentina',
        'SC':'Chile','SP':'Peru','SE':'Ecuador','SK':'Colombia',
        'SV':'Venezuela','SU':'Uruguay'
    };

    /**
     * Derive country name from an ICAO airport code using prefix rules.
     */
    function getCountryFromAirport(icao) {
        if (!icao || icao.length < 2) return 'Unknown';
        if (icao[0] === 'K') return 'United States';
        if (icao[0] === 'P' && icao.length === 4) return 'United States';
        if (icao[0] === 'C') return 'Canada';
        return PREFIX_COUNTRY[icao.substring(0, 2).toUpperCase()] ||
               ('Other (' + icao.substring(0, 2).toUpperCase() + ')');
    }

    // ── Country name -> ISO 3166-1 alpha-2 ────────────────────────────────────
    // Covers all names produced by getCountryFromAirport() and _rfRegCountry().
    var COUNTRY_ISO2_MAP = {
        'United Kingdom':'GB','UK':'GB','Ireland':'IE','Netherlands':'NL','Belgium':'BE',
        'Luxembourg':'LU','Germany':'DE','France':'FR','Spain':'ES','Portugal':'PT',
        'Greece':'GR','Italy':'IT','Malta':'MT','Hungary':'HU','Austria':'AT',
        'Czech Republic':'CZ','Czechia':'CZ','Slovakia':'SK','Poland':'PL','Croatia':'HR',
        'Slovenia':'SI','Bulgaria':'BG','Romania':'RO','Serbia':'RS','Denmark':'DK',
        'Norway':'NO','Sweden':'SE','Finland':'FI','Iceland':'IS','Latvia':'LV',
        'Lithuania':'LT','Estonia':'EE','Ukraine':'UA','Belarus':'BY','Turkey':'TR',
        'Israel':'IL','Cyprus':'CY','Russia':'RU','Saudi Arabia':'SA','UAE':'AE',
        'Bahrain':'BH','Kuwait':'KW','Iran':'IR','Jordan':'JO','Syria':'SY',
        'Lebanon':'LB','Yemen':'YE','Pakistan':'PK','Afghanistan':'AF','India':'IN',
        'Nepal':'NP','Laos':'LA','Myanmar':'MM','Cambodia':'KH','Vietnam':'VN',
        'Indonesia':'ID','Malaysia':'MY','Singapore':'SG','Thailand':'TH','Japan':'JP',
        'South Korea':'KR','S. Korea':'KR','Taiwan':'TW','China':'CN','Australia':'AU',
        'New Zealand':'NZ','South Africa':'ZA','S. Africa':'ZA','Botswana':'BW',
        'Mozambique':'MZ','Malawi':'MW','Zimbabwe':'ZW','Cameroon':'CM','Angola':'AO',
        'Ethiopia':'ET','Eritrea':'ER','Kenya':'KE','Sudan':'SD','Tanzania':'TZ',
        'Uganda':'UG','Nigeria':'NG','Ghana':'GH','Ivory Coast':'CI','Morocco':'MA',
        'Tunisia':'TN','Libya':'LY','Egypt':'EG','Canada':'CA','United States':'US',
        'USA':'US','Mexico':'MX','Cuba':'CU','Dominican Republic':'DO','Jamaica':'JM',
        'Brazil':'BR','Argentina':'AR','Chile':'CL','Peru':'PE','Ecuador':'EC',
        'Colombia':'CO','Venezuela':'VE','Uruguay':'UY','Kazakhstan':'KZ',
        'North Macedonia':'MK','Albania':'AL','Bosnia & Herzegovina':'BA',
        'Switzerland':'CH','Namibia':'NA','Djibouti':'DJ','Somalia':'SO',
        'North Korea':'KP','Hong Kong':'HK','Macau':'MO','Mongolia':'MN'
    };

    /**
     * Resolve a country name to ISO2.
     * Checks the dynamic DB-built map first, then the hardcoded table.
     */
    function _toIso2(name) {
        if (!name) return '';
        var v = _countryIso2.get(name);
        if (v) return v;
        return COUNTRY_ISO2_MAP[name] || '';
    }

    /** Flag emoji for an ICAO airport code (e.g. "EGLL" -> GB flag). */
    function airportFlag(icao) {
        var iso2 = _toIso2(getCountryFromAirport(icao));
        return iso2 ? flagFromIso(iso2) : '';
    }

    // ── Aircraft category lookup ──────────────────────────────────────────────
    // Value = category ID: 1=Heavy 2=Jet 3=Business 4=Turboprop
    //                      5=Helicopter 6=Military 7=Light
    var AIRCRAFT_CATEGORIES = {
        // Heavy / wide-body
        'A124':1,'A225':1,'A306':1,'A30B':1,'A310':1,'A332':1,'A333':1,'A342':1,
        'A343':1,'A345':1,'A346':1,'A359':1,'A35K':1,'A388':1,'B703':1,'B741':1,
        'B742':1,'B743':1,'B744':1,'B748':1,'B74S':1,'B762':1,'B763':1,'B764':1,
        'B772':1,'B77L':1,'B77W':1,'B788':1,'B789':1,'B78X':1,'IL96':1,'MD11':1,
        'DC8':1,'IL62':1,'A339':1,'A337':1,
        // Narrow-body jet
        'A19N':2,'A20N':2,'A21N':2,'A318':2,'A319':2,'A320':2,'A321':2,'A32N':2,
        'A32S':2,'B461':2,'B462':2,'B463':2,'B712':2,'B732':2,'B733':2,'B734':2,
        'B735':2,'B736':2,'B737':2,'B738':2,'B739':2,'B38M':2,'B39M':2,'B3XM':2,
        'B752':2,'B753':2,'CRJ1':2,'CRJ2':2,'CRJ7':2,'CRJ9':2,'CRJX':2,
        'E135':2,'E145':2,'E170':2,'E175':2,'E190':2,'E195':2,'E290':2,'E295':2,
        'E75L':2,'E75S':2,'MD80':2,'MD81':2,'MD82':2,'MD83':2,'MD88':2,'MD90':2,
        'TU54':2,'DC9':2,'D328':2,'B190':2,'BCS1':2,'BCS3':2,
        // Business jet
        'C25A':3,'C25B':3,'C25C':3,'C25M':3,'C510':3,'C525':3,'C55B':3,'C560':3,
        'C56X':3,'C680':3,'C700':3,'C750':3,'CL30':3,'CL35':3,'CL60':3,'CL65':3,
        'F2TH':3,'F900':3,'FA20':3,'FA50':3,'FA7X':3,'FA8X':3,'GL5T':3,'GL7T':3,
        'GLEX':3,'G150':3,'G280':3,'G550':3,'G600':3,'G650':3,'HA4T':3,'LJ35':3,
        'LJ45':3,'LJ60':3,'LJ75':3,'PC24':3,'PRM1':3,'BE40':3,'E50P':3,
        'E545':3,'E550':3,'EA50':3,'P180':3,'E55P':3,'C68A':3,'C550':3,'C551':3,
        // Turboprop
        'AT43':4,'AT44':4,'AT45':4,'AT46':4,'AT72':4,'AT73':4,'AT75':4,'AT76':4,
        'ATP':4,'BE20':4,'BE99':4,'C208':4,'C212':4,'DH8A':4,'DH8B':4,'DH8C':4,
        'DH8D':4,'DHC6':4,'DHC7':4,'E120':4,'F27':4,'F50':4,'F60':4,'JS31':4,
        'JS32':4,'JS41':4,'L410':4,'PC12':4,'SF34':4,'SB20':4,'SW4':4,'Y12':4,
        'AN24':4,'AN26':4,'MA60':4,'C295':4,'TBM7':4,'TBM8':4,'TBM9':4,
        'BE9L':4,'BE90':4,'G120':4,'G12T':4,
        // Helicopter
        'A109':5,'A119':5,'A139':5,'A149':5,'A169':5,'A189':5,'AS32':5,'AS50':5,
        'AS55':5,'AS65':5,'B06':5,'B06T':5,'B105':5,'B212':5,'B222':5,'B230':5,
        'B407':5,'B412':5,'B427':5,'B429':5,'B430':5,'B505':5,'BK17':5,'CH47':5,
        'EC25':5,'EC30':5,'EC35':5,'EC45':5,'EC55':5,'EC75':5,'H160':5,'H175':5,
        'H215':5,'H225':5,'K126':5,'K226':5,'MI8':5,'MI17':5,'R22':5,'R44':5,
        'R66':5,'S61':5,'S76':5,'S92':5,'UH60':5,'AW139':5,'NH90':5,'TIGR':5,
        'G2CA':5,
        // Military
        'F15':6,'F15E':6,'F16C':6,'F16D':6,'F16':6,'F18':6,'F18E':6,'F18F':6,'F18G':6,
        'FA18':6,'F22':6,'F35':6,'FA35':6,'F104':6,'F111':6,'F14':6,'AV8B':6,'A10':6,
        'EUFI':6,'GRIF':6,'JAS3':6,'TPHN':6,'TRNT':6,'TORN':6,'MIRF':6,'MIR2':6,
        'RFAL':6,'SU27':6,'SU30':6,'SU35':6,'SU57':6,'MIG29':6,'MIG31':6,'MIG35':6,
        'B1':6,'B2':6,'B21':6,'B52':6,'TU95':6,'TU22':6,'TU160':6,
        'C17':6,'C130':6,'C5':6,'A400':6,'C27':6,'C141':6,'C5M':6,'C130J':6,
        'KC135':6,'KC46':6,'MRTT':6,'KC10':6,'KC130':6,'K35R':6,
        'P8':6,'P3':6,'P1':6,'P3C':6,'E3':6,'E7':6,'E2':6,'E6':6,'E8':6,
        'RC135':6,'U2':6,'SR71':6,'TR1':6,'RQ4':6,'MQ9':6,'MQ1':6,
        'HAWK':6,'T38':6,'T45':6,'T6':6,'T6A':6,'T50':6,'M346':6,'L39':6,'L159':6,
        'PC9':6,'PC21':6,'MB339':6,'MB326':6,'SF260':6,'AJET':6,'T37':6,'T2':6,
        'V22':6,'MV22':6,'CV22':6,
        // Military helicopter variants
        'AH64':5,'MH60':5,'HH60':5,'CH53':5,'MH53':5,
        'LYNX':5,'PUMA':5,'MERL':5,'SH60':5,'SH3':5,
        // Light / piston
        'C172':7,'C152':7,'C182':7,'C206':7,'C210':7,'PA28':7,'P28A':7,'PA32':7,'PA24':7,
        'SR20':7,'SR22':7,'DA40':7,'DA42':7,'DA62':7,'DA20':7,'BE58':7,'BE36':7,
        'C150':7,'C177':7,'C162':7,'TB20':7,'TB21':7,'TB10':7,'TOBA':7,'P2006':7,
        'P210':7,'DR40':7,'RF6':7,'G115':7,'A210':7,'BR23':7,'SIRA':7,'EV97':7,
        'RV4':7,'RV6':7,'RV7':7,'RV8':7,'C120':7,'C170':7,'PA18':7,'PA22':7,
        'G103':7
    };

    // ── ADS-B emitter category -> our category ID ─────────────────────────────
    var ADSB_CAT_MAP = {
        'A1':7, 'A2':7, 'A3':2, 'A4':2, 'A5':1,
        'A6':2, 'A7':5, 'B1':7, 'B2':7, 'B4':7, 'B6':7
    };

    // ── Category display metadata ─────────────────────────────────────────────
    var CATEGORY_INFO = {
        1: { label: 'Heavy',      emoji: '\u2708', color: '#e8a87c' },
        2: { label: 'Jet',        emoji: '\u2708', color: '#7cb9e8' },
        3: { label: 'Business',   emoji: '\uD83D\uDEE9', color: '#a8e87c' },
        4: { label: 'Turboprop',  emoji: '\u2708', color: '#e8d87c' },
        5: { label: 'Helicopter', emoji: '\uD83D\uDE81', color: '#b87ce8' },
        6: { label: 'Military',   emoji: '\u2708', color: '#e87c7c' },
        7: { label: 'Light',      emoji: '\uD83D\uDEE9', color: '#7ce8c8' },
        0: { label: '',           emoji: '\u2708', color: '#888888' }
    };

    // ── ICAO 24-bit hex -> registration country (binary search table) ─────────
    var ICAO_RANGES = [
        [0x004000,0x0043FF,'ZW'],[0x006000,0x006FFF,'MZ'],[0x008000,0x008FFF,'ZA'],
        [0x00A000,0x00A3FF,'BW'],[0x010000,0x017FFF,'EG'],[0x018000,0x01FFFF,'LY'],
        [0x020000,0x027FFF,'MA'],[0x028000,0x02FFFF,'TN'],[0x030000,0x033FFF,'GH'],
        [0x034000,0x034FFF,'NG'],[0x035000,0x037FFF,'NG'],[0x038000,0x03FFFF,'NG'],
        [0x040000,0x043FFF,'ET'],[0x044000,0x047FFF,'KE'],[0x048000,0x04BFFF,'UG'],
        [0x04C000,0x04FFFF,'TZ'],[0x050000,0x057FFF,'ZA'],[0x058000,0x05FFFF,'ZM'],
        [0x060000,0x063FFF,'AO'],[0x064000,0x067FFF,'MZ'],[0x068000,0x06BFFF,'ZW'],
        [0x06C000,0x06CFFF,'BW'],[0x100000,0x1FFFFF,'RU'],[0x201000,0x2013FF,'NA'],
        [0x202000,0x2023FF,'BW'],[0x300000,0x33FFFF,'IT'],[0x340000,0x37FFFF,'ES'],
        [0x380000,0x3BFFFF,'FR'],[0x3C0000,0x3FFFFF,'DE'],[0x400000,0x43FFFF,'GB'],
        [0x440000,0x447FFF,'AT'],[0x448000,0x44FFFF,'BE'],[0x450000,0x457FFF,'BG'],
        [0x458000,0x45FFFF,'DK'],[0x460000,0x467FFF,'FI'],[0x468000,0x46FFFF,'GR'],
        [0x470000,0x477FFF,'HU'],[0x478000,0x47FFFF,'NO'],[0x480000,0x487FFF,'NL'],
        [0x488000,0x48FFFF,'PL'],[0x490000,0x497FFF,'PT'],[0x498000,0x49FFFF,'CZ'],
        [0x4A0000,0x4A7FFF,'RO'],[0x4A8000,0x4AFFFF,'SE'],[0x4B0000,0x4B7FFF,'CH'],
        [0x4B8000,0x4BFFFF,'TR'],[0x4C0000,0x4C7FFF,'UA'],[0x4CA000,0x4CBFFF,'IE'],
        [0x4CC000,0x4CCFFF,'IS'],[0x4D0000,0x4DFFFF,'LU'],[0x4E0000,0x4E7FFF,'SK'],
        [0x4E8000,0x4EFFF,'SI'],[0x500000,0x5003FF,'HR'],[0x501000,0x5013FF,'RS'],
        [0x501C00,0x501FFF,'BA'],[0x502C00,0x502FFF,'MK'],[0x503000,0x5033FF,'AL'],
        [0x504000,0x504FFF,'EE'],[0x505000,0x5053FF,'LV'],[0x506000,0x5063FF,'LT'],
        [0x507000,0x5073FF,'MD'],[0x508000,0x50FFFF,'CY'],[0x600000,0x6003FF,'ET'],
        [0x601000,0x6013FF,'ER'],[0x680000,0x6803FF,'DJ'],[0x690000,0x6903FF,'SO'],
        [0x710000,0x717FFF,'SA'],[0x720000,0x727FFF,'IQ'],[0x728000,0x72FFFF,'KW'],
        [0x730000,0x737FFF,'BH'],[0x738000,0x73FFFF,'IL'],[0x740000,0x747FFF,'JO'],
        [0x748000,0x74FFFF,'SY'],[0x750000,0x757FFF,'LB'],[0x758000,0x75FFFF,'YE'],
        [0x760000,0x767FFF,'OM'],[0x768000,0x76FFFF,'AE'],[0x770000,0x777FFF,'QA'],
        [0x778000,0x77FFFF,'AF'],[0x780000,0x7BFFFF,'CN'],[0x7C0000,0x7FFFFF,'AU'],
        [0x800000,0x83FFFF,'IN'],[0x840000,0x87FFFF,'JP'],[0x880000,0x887FFF,'KR'],
        [0x888000,0x88FFFF,'KP'],[0x890000,0x890FFF,'BD'],[0x895000,0x8953FF,'AE'],
        [0x896000,0x896FFF,'AE'],[0x897000,0x8973FF,'AE'],[0x898000,0x898FFF,'AE'],
        [0x899000,0x8993FF,'AE'],[0x8A0000,0x8AFFFF,'TH'],[0x8B0000,0x8BFFFF,'VN'],
        [0x8C0000,0x8CFFFF,'PH'],[0x8D0000,0x8DFFFF,'ID'],[0x8E0000,0x8EFFFF,'MY'],
        [0x8F0000,0x8FFFFF,'SG'],[0x900000,0x93FFFF,'NZ'],[0x940000,0x97FFFF,'PK'],
        [0x980000,0x9BFFFF,'AF'],[0xA00000,0xAFFFFF,'US'],[0xC00000,0xC3FFFF,'CA'],
        [0xC80000,0xC8FFFF,'NZ'],[0xD00000,0xD3FFFF,'MX'],[0xE40000,0xE7FFFF,'BR'],
        [0xE80000,0xE8FFFF,'AR'],[0xE90000,0xE9FFFF,'CL'],[0xEA0000,0xEAFFFF,'CO'],
        [0xEB0000,0xEBFFFF,'VE']
    ];

    /**
     * Derive registration country from ICAO 24-bit hex address.
     * Uses binary search over ICAO_RANGES.
     * Returns {iso2, name} or null if not found.
     */
    function getRegCountryFromIcao(icaoHex) {
        if (!icaoHex || icaoHex.length < 4) return null;
        var n = parseInt(icaoHex, 16);
        if (isNaN(n)) return null;
        var lo = 0, hi = ICAO_RANGES.length - 1;
        while (lo <= hi) {
            var mid = (lo + hi) >> 1;
            var r = ICAO_RANGES[mid];
            if (n < r[0])      hi = mid - 1;
            else if (n > r[1]) lo = mid + 1;
            else return { iso2: r[2], name: countryFromIso(r[2]) };
        }
        return null;
    }

    /**
     * Returns true if the plane should be treated as military.
     */
    function isMilitaryAircraft(plane) {
        if (plane.military) return true;
        if (plane.category === 'A6') return true;
        var t = plane.typeLong || plane.icaoType;
        if (t && getAircraftCategory(t) === 6) return true;
        return false;
    }

    /**
     * Resolve a typeKey to a category ID using three-tier lookup:
     * 1. ICAO type table, 2. ADS-B category, 3. Wake turbulence category.
     */
    function getAircraftCategory(typeKey) {
        if (!typeKey) return 0;
        var icao = _aircraftIcaoMap.get(typeKey) || typeKey;
        var byIcao = AIRCRAFT_CATEGORIES[icao.toUpperCase()];
        if (byIcao) return byIcao;
        var adsb = _aircraftAdsbCat.get(typeKey);
        if (adsb === 'A7') return 5;
        if (adsb === 'A5') return 1;
        if (adsb === 'A6') return 6;
        if (adsb === 'A4') return 1;
        if (adsb === 'A1' || adsb === 'B1' || adsb === 'B4') return 7;
        var wtc = _aircraftWtc.get(typeKey);
        if (wtc === 'J') return 1;
        if (wtc === 'H') return 1;
        if (adsb === 'A3') return 2;
        if (adsb === 'A2') return wtc === 'L' ? 7 : 3;
        if (wtc === 'L') return 7;
        return 0;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // §6  TAR1090 adapter — wrappers for g.*, route_cache, OLMap
    // ═══════════════════════════════════════════════════════════════════════════

    /** Returns true when tar1090 runtime globals are available. */
    function gReady() {
        try { return typeof g !== 'undefined' && Array.isArray(g.planesOrdered); }
        catch (e) { return false; }
    }

    /**
     * Look up a plane's route cache entry from g.route_cache.
     * Returns the entry only when it contains at least 2 airport objects.
     */
    function getCacheEntry(plane) {
        try {
            var name = plane.name || plane.flight;
            if (!name) return null;
            var normalized = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
            var entry = g.route_cache[normalized];
            return (entry && entry._airports && entry._airports.length >= 2) ? entry : null;
        } catch (e) { return null; }
    }

    /**
     * Parse route information for a plane.
     * Prefers g.route_cache for ICAO accuracy; falls back to routeString parsing,
     * then to local DB lookup when useLocalDb is enabled.
     * Returns {full, fromDisplay, toDisplay, fromIcao, toIcao} or null.
     */
    function parseRoute(plane) {
        if (!plane.routeString) {
            return settings.useLocalDb ? _dbGetRoute(plane) : null;
        }
        var raw = plane.routeString.replace(/^\?\?\s*/, '').trim();
        if (!raw) return null;
        var parts = raw.split(' - ').map(function (s) { return s.trim(); });
        if (parts.length < 2) return null;
        var cache    = getCacheEntry(plane);
        var fromIcao = cache ? cache._airports[0].icao
                             : (parts[0].length === 4 ? parts[0] : null);
        var toIcao   = cache ? cache._airports[cache._airports.length - 1].icao
                             : (parts[parts.length - 1].length === 4 ? parts[parts.length - 1] : null);
        return {
            full:        raw,
            fromDisplay: parts[0],
            toDisplay:   parts[parts.length - 1],
            fromIcao:    fromIcao,
            toIcao:      toIcao
        };
    }

    /**
     * Aggregate aircraft data for panel rendering.
     * excludeTab: tab name to omit from cross-tab filtering (used when
     * rendering that tab's own list, so it shows all options not just
     * what passes the current selection).
     * Returns {airports, countries, operators, aircraft} Maps.
     * Results are cached and only rebuilt when _rfDataDirty is set.
     */
    function getAircraftData(excludeTab) {
        var cacheKey = (gReady() ? g.planesOrdered.length : 0) +
                       '|' + _panelScope + '|' + (excludeTab || '');
        if (!_rfDataDirty && cacheKey === _rfDataLastKey && _rfDataLastResult) {
            return _rfDataLastResult;
        }

        var airports  = new Map(); // icao -> {from, to}
        var countries = new Map(); // country name -> {from, to}
        var operators = new Map(); // airline code -> count
        var aircraft  = new Map(); // typeKey -> count

        // Clear module-level caches in-place
        _airportLabels.clear();
        _airportIso2.clear();
        _countryIso2.clear();
        _aircraftIcaoMap.clear();
        _aircraftAdsbCat.clear();
        _aircraftWtc.clear();
        _aircraftRegCountries.clear();
        _allRegCountries.clear();
        _militaryTypeKeys.clear();
        _catCounts = {};

        if (!gReady()) {
            var empty = { airports: airports, countries: countries, operators: operators, aircraft: aircraft };
            return empty;
        }

        function apInc(map, key, dir) {
            if (!map.has(key)) map.set(key, { from: 0, to: 0 });
            map.get(key)[dir]++;
        }

        for (var i = 0; i < g.planesOrdered.length; i++) {
            var plane = g.planesOrdered[i];

            // Cross-tab filter: skip planes that don't pass other tabs' active filters
            if (!planePassesAllFilters(plane, excludeTab)) continue;
            // Runtime scope filter
            if (_panelScope === 'inview'    && !plane.inView)                        continue;
            if (_panelScope === 'filtered'  && !planePassesAllFilters(plane, null))  continue;

            // Aircraft tab: skip surface vehicles (ADS-B category C*)
            var isSurface = plane.category && plane.category[0] === 'C';
            var typeKey   = (!isSurface && (plane.typeLong || plane.icaoType)) || null;
            if (!typeKey && !isSurface && isMilitaryAircraft(plane)) typeKey = '(Military)';

            if (typeKey) {
                if (plane.icaoType && !_aircraftIcaoMap.has(typeKey))
                    _aircraftIcaoMap.set(typeKey, plane.icaoType);
                if (plane.category && !_aircraftAdsbCat.has(typeKey))
                    _aircraftAdsbCat.set(typeKey, plane.category);
                if (plane.wtc && !_aircraftWtc.has(typeKey))
                    _aircraftWtc.set(typeKey, plane.wtc);
                if (isMilitaryAircraft(plane))
                    _militaryTypeKeys.add(typeKey);

                var cId = isMilitaryAircraft(plane) ? 6 : getAircraftCategory(typeKey);
                if (cId) _catCounts[cId] = (_catCounts[cId] || 0) + 1;

                // Count type only when it also passes catFilter + regCountryFilter
                var acTab     = _tabState.aircraft;
                var passesCat = acTab.catFilter.size === 0;
                if (!passesCat) {
                    passesCat = true;
                    acTab.catFilter.forEach(function (catId) {
                        if (catId === 6) { if (!isMilitaryAircraft(plane)) passesCat = false; }
                        else             { if (getAircraftCategory(typeKey) !== catId) passesCat = false; }
                    });
                }
                var passesRc = !acTab.regCountryFilter;
                if (!passesRc && plane.icao) {
                    var rcCheck = getRegCountryFromIcao(plane.icao);
                    passesRc = !!(rcCheck && rcCheck.name === acTab.regCountryFilter);
                }
                if (passesCat && passesRc)
                    aircraft.set(typeKey, (aircraft.get(typeKey) || 0) + 1);
            }

            // Registration country caches
            if (!isSurface && plane.icao) {
                var rcInfo = getRegCountryFromIcao(plane.icao);
                if (rcInfo) {
                    _allRegCountries.set(rcInfo.name, rcInfo.iso2);
                    if (typeKey) {
                        if (!_aircraftRegCountries.has(typeKey))
                            _aircraftRegCountries.set(typeKey, new Map());
                        _aircraftRegCountries.get(typeKey).set(rcInfo.name, rcInfo.iso2);
                    }
                }
            }

            var cache = getCacheEntry(plane);

            // Operators: prefer route_cache airline_code, fall back to callsign prefix
            if (cache && cache.airline_code) {
                var opCode = cache.airline_code.toUpperCase();
                operators.set(opCode, (operators.get(opCode) || 0) + 1);
            } else if (settings.useLocalDb && (plane.name || plane.flight)) {
                var cs = (plane.name || plane.flight || '').toUpperCase().replace(/[^A-Z]/g, '');
                if (cs.length >= 3) {
                    var iCode = cs.substring(0, 3);
                    operators.set(iCode, (operators.get(iCode) || 0) + 1);
                }
            }

            var route = parseRoute(plane);
            if (!route) continue;

            var depAp = cache ? cache._airports[0] : null;
            var arrAp = cache ? cache._airports[cache._airports.length - 1] : null;

            // Airports
            var apTriples = [
                [depAp, route.fromIcao || route.fromDisplay, 'from'],
                [arrAp, route.toIcao   || route.toDisplay,   'to']
            ];
            for (var ai = 0; ai < apTriples.length; ai++) {
                var ap       = apTriples[ai][0];
                var fallback = apTriples[ai][1];
                var dir      = apTriples[ai][2];
                var apKey    = (ap && ap.icao) ? ap.icao : fallback;
                if (!apKey) continue;
                apInc(airports, apKey, dir);
                if (!_airportLabels.has(apKey)) {
                    var lbl = (ap && ap.name) ? ap.name : (_dbGetAirportName(apKey) || apKey);
                    _airportLabels.set(apKey, lbl);
                }
                if (!_airportIso2.has(apKey)) {
                    if (ap && ap.countryiso2) {
                        _airportIso2.set(apKey, ap.countryiso2);
                    } else {
                        var aIso2 = _dbGetAirportIso2(apKey);
                        if (aIso2) _airportIso2.set(apKey, aIso2);
                    }
                }
            }

            // Countries
            var cTriples = [
                [depAp, route.fromIcao, 'from'],
                [arrAp, route.toIcao,   'to']
            ];
            for (var ci = 0; ci < cTriples.length; ci++) {
                var cap          = cTriples[ci][0];
                var fallbackIcao = cTriples[ci][1];
                var cdir         = cTriples[ci][2];
                var cName, cIso2;
                if (cap && cap.countryiso2) {
                    cIso2  = cap.countryiso2;
                    cName  = countryFromIso(cIso2);
                } else if (fallbackIcao) {
                    cIso2  = _dbGetAirportIso2(fallbackIcao);
                    cName  = cIso2 ? countryFromIso(cIso2) : getCountryFromAirport(fallbackIcao);
                }
                if (!cName) continue;
                apInc(countries, cName, cdir);
                if (cIso2) _countryIso2.set(cName, cIso2);
            }
        }

        var result = { airports: airports, countries: countries, operators: operators, aircraft: aircraft };
        _rfDataDirty      = false;
        _rfDataLastKey    = cacheKey;
        _rfDataLastResult = result;
        return result;
    }

    // ── Geo helpers ───────────────────────────────────────────────────────────

    /** Haversine distance in nautical miles between two lat/lon points. */
    function haversineNm(lat1, lon1, lat2, lon2) {
        var R    = 3440.065;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a    = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                   Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                   Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /** True bearing (degrees) from point 1 to point 2. */
    function _rfBearing(lat1, lon1, lat2, lon2) {
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var la1  = lat1 * Math.PI / 180;
        var la2  = lat2 * Math.PI / 180;
        var y    = Math.sin(dLon) * Math.cos(la2);
        var x    = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }

    /** Convert bearing degrees to 16-point cardinal direction string. */
    function _rfCardinal(deg) {
        var dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
        return dirs[Math.round(deg / 22.5) % 16];
    }

    /**
     * Infer registration country from aircraft reg prefix or ICAO hex block.
     * Returns country name string or null.
     */
    function _rfRegCountry(reg, icao) {
        if (reg) {
            var r   = reg.toUpperCase();
            var pfx = [
                ['G-','United Kingdom'], ['D-','Germany'],      ['F-','France'],
                ['I-','Italy'],          ['EC-','Spain'],        ['SE-','Sweden'],
                ['PH-','Netherlands'],   ['OO-','Belgium'],      ['LN-','Norway'],
                ['OY-','Denmark'],       ['EI-','Ireland'],      ['TF-','Iceland'],
                ['SP-','Poland'],        ['OE-','Austria'],      ['HB-','Switzerland'],
                ['OK-','Czech Republic'],['OM-','Slovakia'],     ['LX-','Luxembourg'],
                ['SX-','Greece'],        ['HA-','Hungary'],      ['YR-','Romania'],
                ['LZ-','Bulgaria'],      ['9A-','Croatia'],      ['S5-','Slovenia'],
                ['9H-','Malta'],         ['LY-','Lithuania'],    ['YL-','Latvia'],
                ['ES-','Estonia'],       ['OH-','Finland'],      ['YU-','Serbia'],
                ['RA-','Russia'],        ['EW-','Belarus'],      ['UP-','Kazakhstan'],
                ['UR-','Ukraine'],       ['4X-','Israel'],       ['TC-','Turkey'],
                ['A6-','United Arab Emirates'],['HZ-','Saudi Arabia'],['9V-','Singapore'],
                ['VH-','Australia'],     ['ZK-','New Zealand'],  ['ZS-','South Africa'],
                ['JA','Japan'],          ['HL','South Korea'],   ['B-','China'],
                ['VT-','India'],         ['SU-','Egypt'],        ['ET-','Ethiopia'],
                ['CN-','Morocco'],       ['5Y-','Kenya'],        ['AP-','Pakistan'],
                ['VN-','Vietnam'],       ['HS-','Thailand'],
                ['N','United States'],   ['C-','Canada'],        ['XA-','Mexico'],
                ['CC-','Chile'],         ['PT-','Brazil'],       ['LV-','Argentina'],
                ['PP-','Brazil']
            ];
            for (var pi = 0; pi < pfx.length; pi++) {
                if (r.indexOf(pfx[pi][0]) === 0) return pfx[pi][1];
            }
        }
        if (icao) {
            var rcInfo = getRegCountryFromIcao(icao);
            if (rcInfo) return rcInfo.name;
        }
        return null;
    }

    // ── TAR1090 filter hook wiring ────────────────────────────────────────────

    /**
     * Install filter hooks into tar1090.
     * Method 1: window.customFilter (the supported extension point).
     * Method 2: PlaneObject.prototype.isFiltered (fallback compatibility).
     */
    function installFilterHook() {
        var origCustom = window.customFilter;
        window.customFilter = function (plane) {
            if (typeof origCustom === 'function' && origCustom(plane)) return true;
            return rfIsFiltered(plane);
        };
        try {
            if (typeof PlaneObject === 'undefined') return;
            var origIsFiltered = PlaneObject.prototype.isFiltered;
            PlaneObject.prototype.isFiltered = function () {
                if (origIsFiltered && origIsFiltered.call(this)) return true;
                return rfIsFiltered(this);
            };
        } catch (e) {
            console.warn('[RF] could not patch PlaneObject.prototype.isFiltered:', e);
        }
    }

    /**
     * Trigger tar1090 to re-evaluate plane visibility.
     * Uses refreshFilter() when available, with fallback approaches.
     */
    function triggerRedraw() {
        try {
            if (typeof refreshFilter === 'function') {
                refreshFilter();
            } else if (typeof window.refreshFilter === 'function') {
                window.refreshFilter();
            } else if (gReady()) {
                if (typeof updateVisible === 'function') updateVisible();
                for (var i = 0; i < g.planesOrdered.length; i++) {
                    var p = g.planesOrdered[i];
                    if (typeof p.updateFeatures === 'function') p.updateFeatures(true);
                }
            }
        } catch (e) {
            console.warn('[RF] triggerRedraw error:', e);
        }
    }

    /**
     * Invalidate the aircraft data cache and schedule a filter redraw.
     * Call this whenever filter state changes.
     */
    function applyFilter() {
        _rfDataDirty = true;
        triggerRedraw();
        try {
            if (_distanceZones && _distanceZones.length > 0) _rfDrawDistOnMainMap();
            else _rfClearDistOnMainMap();
        } catch (e) {}
        try { _rfRenderScopeHeader(); } catch (e) {}
        try { _rfUpdateHeaderBtns(); } catch (e) {}
    }

    // ── HTML escaping helpers ─────────────────────────────────────────────────

    function _rfEscText(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    }
    function _rfEscAttr(s) {
        return _rfEscText(s).replace(/"/g, '&quot;');
    }

    // ── View state helpers ────────────────────────────────────────────────────

    /** Default map policy for a saved view. */
    function _rfDefaultViewMap() {
        return {
            enabled:        false,
            mode:           'dynamic', // 'dynamic' | 'fixed'
            autoCenter:     true,
            autoZoom:       true,
            fixedCenterLat: null,
            fixedCenterLon: null,
            fixedZoom:      null
        };
    }

    /** Find a saved or built-in view by id. Returns the view object or null. */
    function _rfFindViewById(id) {
        for (var i = 0; i < _savedViews.length; i++) {
            if (_savedViews[i].id === id) return _savedViews[i];
        }
        for (var j = 0; j < RF_BUILTIN_VIEWS.length; j++) {
            if (RF_BUILTIN_VIEWS[j].id === id) return RF_BUILTIN_VIEWS[j];
        }
        return null;
    }

    /**
     * Capture current full filter state into a view-state snapshot.
     * Used by save-view and pre-view-state capture.
     */
    function _rfCaptureViewState() {
        return {
            panelScope: _panelScope,
            tabState:   _rfSerializeTabState(),
            alerts: {
                filters:       Object.assign({}, _alertsFilters),
                mapFilter:     _alertsMapFilter,
                selectedIcaos: Array.from(_alertsSelectedIcaos)
            },
            distance: {
                zones: JSON.parse(JSON.stringify(_distanceZones)),
                mode:  _distanceMode
            },
            summary: {
                sumFilter: Array.from(_sumFilter)
            },
            ranges:    Object.assign({}, _rangesFilter)
        };
    }

    /**
     * Apply a view-state snapshot to live filter state.
     */
    function _rfApplyViewState(vs) {
        if (!vs) return;
        if (vs.panelScope)           _panelScope = vs.panelScope;
        if (vs.tabState)             _rfDeserializeTabState(vs.tabState);
        if (vs.alerts) {
            if (vs.alerts.filters)        Object.assign(_alertsFilters, vs.alerts.filters);
            if (typeof vs.alerts.mapFilter === 'boolean') _alertsMapFilter = vs.alerts.mapFilter;
            if (Array.isArray(vs.alerts.selectedIcaos))
                _alertsSelectedIcaos = new Set(vs.alerts.selectedIcaos);
        }
        if (vs.distance) {
            if (Array.isArray(vs.distance.zones)) _distanceZones = vs.distance.zones;
            if (vs.distance.mode)                 _distanceMode  = vs.distance.mode;
        }
        if (vs.summary && Array.isArray(vs.summary.sumFilter))
            _sumFilter = new Set(vs.summary.sumFilter);
        if (vs.ranges)    Object.assign(_rangesFilter, vs.ranges);
        applyFilter();
    }

    function _rfSyncActiveViewPointers() {
        var keep = [];
        for (var i = 0; i < _activeViewIds.length; i++) {
            var id = _activeViewIds[i];
            if (id && _rfFindViewById(id)) keep.push(id);
        }
        _activeViewIds = keep;
        _activeViewId  = _activeViewIds.length ? _activeViewIds[0] : '';
        _rvSaveActive();
    }

    function _rfCapturePreViewStateIfNeeded() {
        if (_rfPreViewState) return;
        _rfPreViewState = _rfCaptureViewState();
    }

    function _rfRestorePreViewStateIfAny() {
        if (!_rfPreViewState) return;
        _rfApplyViewState(_rfPreViewState);
        _rfPreViewState = null;
    }

    // ── Scope helpers ─────────────────────────────────────────────────────────

    function _rfScopeLabel() {
        return _panelScope === 'inview'   ? 'in view'
             : _panelScope === 'filtered' ? 'filtered'
             :                             'all';
    }
    function _rfScopeBadgeLabel() {
        return _panelScope === 'inview'   ? 'In View'
             : _panelScope === 'filtered' ? 'Filtered'
             :                             'All';
    }

    function _rfDetectTar1090ApiMode() {
        var hints = [];
        var enabled = false;
        var certainty = 'none';
        try {
            if (typeof window.USE_API === 'boolean') {
                hints.push('window.USE_API=' + window.USE_API);
                enabled = enabled || window.USE_API;
                certainty = 'high';
            }
        } catch (e) {}
        try {
            if (typeof window.useApi === 'boolean') {
                hints.push('window.useApi=' + window.useApi);
                enabled = enabled || window.useApi;
                if (certainty !== 'high') certainty = 'high';
            }
        } catch (e) {}
        try {
            if (typeof g !== 'undefined' && g) {
                if (typeof g.useApi === 'boolean') {
                    hints.push('g.useApi=' + g.useApi);
                    enabled = enabled || g.useApi;
                    if (certainty !== 'high') certainty = 'medium';
                }
                if (g.globeIndex || g.globeIndexUrl) {
                    hints.push('g.globeIndex present');
                    enabled = true;
                    if (certainty !== 'high') certainty = 'medium';
                }
            }
        } catch (e) {}
        return { enabled: !!enabled, certainty: certainty, hints: hints };
    }

    function _rfDebugSummarizeValue(v, depth, seen) {
        depth = depth || 0;
        seen = seen || [];
        if (v === null) return null;
        var t = typeof v;
        if (t === 'undefined' || t === 'boolean' || t === 'number') return v;
        if (t === 'string') return v.length > 220 ? (v.slice(0, 220) + '…') : v;
        if (t === 'function') return '[Function ' + (v.name || 'anonymous') + ']';
        if (seen.indexOf(v) >= 0) return '[Circular]';
        if (depth >= 2) {
            if (Array.isArray(v)) return '[Array(' + v.length + ')]';
            return '[Object]';
        }
        seen.push(v);
        if (Array.isArray(v)) {
            var outArr = [];
            for (var ai = 0; ai < Math.min(v.length, 12); ai++) outArr.push(_rfDebugSummarizeValue(v[ai], depth + 1, seen));
            if (v.length > 12) outArr.push('… +' + (v.length - 12) + ' more');
            return outArr;
        }
        var outObj = {};
        var keys = [];
        try { keys = Object.keys(v); } catch (e) { return '[Uninspectable object]'; }
        for (var ki = 0; ki < Math.min(keys.length, 30); ki++) {
            var k = keys[ki];
            try { outObj[k] = _rfDebugSummarizeValue(v[k], depth + 1, seen); } catch (e2) { outObj[k] = '[Error reading value]'; }
        }
        if (keys.length > 30) outObj.__truncated = '+' + (keys.length - 30) + ' keys';
        return outObj;
    }

    function _rfCollectTar1090GlobalsDebug() {
        var known = [
            'g', 'OLMap', 'SiteLat', 'SiteLon', 'route_cache',
            'SelectedPlane', 'selectedPlane', 'useApi', 'USE_API',
            'onMapResize', 'refreshSelected', 'refreshSelectedPlane',
            'selectPlaneByHex', 'selectPlaneByICAO', 'selectPlaneByIcao'
        ];
        var out = { known: {}, discovered: {}, meta: {} };
        for (var i = 0; i < known.length; i++) {
            var name = known[i];
            if (typeof window[name] === 'undefined') continue;
            try { out.known[name] = _rfDebugSummarizeValue(window[name], 0, []); }
            catch (e) { out.known[name] = '[Error reading global]'; }
        }
        var rx = /tar1090|readsb|aircraft|plane|globe|site|route|history|selected/i;
        var keys = [];
        try { keys = Object.keys(window); } catch (e2) { keys = []; }
        var picked = [];
        for (var wi = 0; wi < keys.length; wi++) {
            var wk = keys[wi];
            if (known.indexOf(wk) >= 0) continue;
            if (!rx.test(wk)) continue;
            picked.push(wk);
            if (picked.length >= 80) break;
        }
        for (var pi = 0; pi < picked.length; pi++) {
            var dk = picked[pi];
            try { out.discovered[dk] = _rfDebugSummarizeValue(window[dk], 0, []); }
            catch (e3) { out.discovered[dk] = '[Error reading global]'; }
        }
        out.meta.discoveredCount = picked.length;
        out.meta.totalWindowKeys = keys.length;
        return out;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // §7  Filter engine — pure predicates, AND composition
    // ═══════════════════════════════════════════════════════════════════════════

    /** Returns true if the ranges filter has any active constraint. */
    function _rfRangesFilterActive() {
        var f = _rangesFilter;
        return !!(f.speedMin || f.speedMax || f.altMin || f.altMax ||
                  f.vrMin || f.vrMax || f.squawk || f.ageMin || f.ageMax || f.callsign);
    }

    /** Returns true if any filter dimension is currently active. */
    function isFilterActive() {
        // When multiple views are active, always run the filter engine (OR across views).
        if (_activeViewIds.length >= 2) return true;
        var ac = _tabState.aircraft;
        if (ac.catFilter.size > 0 || ac.regCountryFilter !== '') return true;
        if (_alertsSelectedIcaos.size > 0)                        return true;
        if (_alertsMapFilter && _alertsMapFilterIcaos)             return true;
        if (_distanceZones.length > 0 && _distanceMode !== 'maponly') return true;
        if (_sumFilter.size > 0)                                   return true;
        if (_rfRangesFilterActive())                               return true;
        return Object.values(_tabState).some(function (s) { return s.items.size > 0; });
    }

    /**
     * Test whether a plane passes a single tab's filter predicate.
     * Pure function — reads from _tabState and plane fields only.
     */
    function planePassesFilter(plane, tabName, items, direction) {
        if (tabName === 'operators') {
            var cache = getCacheEntry(plane);
            return !!(cache && cache.airline_code &&
                      items.has(cache.airline_code.toUpperCase()));
        }

        if (tabName === 'aircraft') {
            var ac = _tabState.aircraft;
            var t  = plane.typeLong || plane.icaoType;
            if (ac.items.size > 0) {
                var tMatch   = t && ac.items.has(t);
                var milMatch = ac.items.has('(Military)') && isMilitaryAircraft(plane);
                if (!tMatch && !milMatch) return false;
            }
            if (ac.catFilter.size > 0) {
                var cfOk = true;
                ac.catFilter.forEach(function (catId) {
                    if (catId === 6) { if (!isMilitaryAircraft(plane)) cfOk = false; }
                    else             { if (getAircraftCategory(t) !== catId) cfOk = false; }
                });
                if (!cfOk) return false;
            }
            if (ac.regCountryFilter !== '') {
                var rcInfo = getRegCountryFromIcao(plane.icao);
                if (!rcInfo || rcInfo.name !== ac.regCountryFilter) return false;
            }
            return true;
        }

        var route = parseRoute(plane);
        if (!route) return false; // no route = cannot match airport/country filter

        if (tabName === 'airports') {
            var dep = route.fromIcao || route.fromDisplay;
            var arr = route.toIcao   || route.toDisplay;
            if (direction === 'from') return items.has(dep);
            if (direction === 'to')   return items.has(arr);
            return items.has(dep) || items.has(arr);
        }

        if (tabName === 'countries') {
            var c2    = getCacheEntry(plane);
            var depAp = c2 ? c2._airports[0]                        : null;
            var arrAp = c2 ? c2._airports[c2._airports.length - 1]  : null;
            var depCN = depAp && depAp.countryiso2
                        ? countryFromIso(depAp.countryiso2)
                        : getCountryFromAirport(route.fromIcao || '');
            var arrCN = arrAp && arrAp.countryiso2
                        ? countryFromIso(arrAp.countryiso2)
                        : getCountryFromAirport(route.toIcao || '');
            if (direction === 'from') return items.has(depCN);
            if (direction === 'to')   return items.has(arrCN);
            return items.has(depCN) || items.has(arrCN);
        }

        return false;
    }

    /**
     * Test a plane against the ranges filter.
     * All non-empty constraints are AND'd.
     */
    function planePassesRangesFilter(plane) {
        var f = _rangesFilter;

        // Speed (knots)
        if (f.speedMin !== '' && typeof plane.gs === 'number') {
            if (plane.gs < parseFloat(f.speedMin)) return false;
        }
        if (f.speedMax !== '' && typeof plane.gs === 'number') {
            if (plane.gs > parseFloat(f.speedMax)) return false;
        }

        // Altitude (feet)
        var altVal = null;
        if (plane.altitude === 'ground' || plane.alt_baro === 'ground') altVal = 0;
        else if (typeof plane.altitude === 'number')  altVal = plane.altitude;
        else if (typeof plane.alt_baro === 'number')  altVal = plane.alt_baro;
        if (f.altMin !== '' && altVal !== null) {
            if (altVal < parseFloat(f.altMin)) return false;
        }
        if (f.altMax !== '' && altVal !== null) {
            if (altVal > parseFloat(f.altMax)) return false;
        }

        // Vertical rate (fpm)
        var vrVal = typeof plane.geom_rate === 'number' ? plane.geom_rate
                  : (typeof plane.baro_rate === 'number' ? plane.baro_rate : null);
        if (f.vrMin !== '' && vrVal !== null) {
            if (vrVal < parseFloat(f.vrMin)) return false;
        }
        if (f.vrMax !== '' && vrVal !== null) {
            if (vrVal > parseFloat(f.vrMax)) return false;
        }

        // Squawk (exact or range, comma-separated)
        if (f.squawk !== '') {
            if (!_rfMatchSquawk(plane.squawk, f.squawk)) return false;
        }

        // Age on scope (minutes since first seen)
        if (f.ageMin !== '' || f.ageMax !== '') {
            var firstSeen = plane.icao ? _sumArrivals[plane.icao] : null;
            if (firstSeen) {
                var ageMins = (Date.now() - firstSeen) / 60000;
                if (f.ageMin !== '' && ageMins < parseFloat(f.ageMin)) return false;
                if (f.ageMax !== '' && ageMins > parseFloat(f.ageMax)) return false;
            }
        }

        // Callsign / ICAO substring or wildcard match
        if (f.callsign !== '') {
            var pattern = f.callsign.trim().toLowerCase();
            var cs = ((plane.flight || plane.name || '') + '').toLowerCase();
            var ic = ((plane.icao   || '') + '').toLowerCase();
            if (pattern.indexOf('*') >= 0) {
                var regStr = '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                                          .replace(/\*/g, '.*') + '$';
                var re = new RegExp(regStr);
                if (!re.test(cs) && !re.test(ic)) return false;
            } else {
                if (cs.indexOf(pattern) < 0 && ic.indexOf(pattern) < 0) return false;
            }
        }

        return true;
    }

    /**
     * Match a plane's squawk against a filter string.
     * Filter string may contain exact codes and/or ranges (e.g. "7500,7600-7677").
     */
    function _rfMatchSquawk(planeSquawk, filterStr) {
        if (!filterStr || !planeSquawk) return true;
        var f = filterStr.trim();
        if (!f) return true;
        var parts = f.split(',');
        for (var pi = 0; pi < parts.length; pi++) {
            var part = parts[pi].trim();
            if (!part) continue;
            if (part.indexOf('-') > 0) {
                var bounds = part.split('-');
                var lo     = parseInt(bounds[0].trim(), 10);
                var hi     = parseInt(bounds[1].trim(), 10);
                var sq     = parseInt(planeSquawk, 10);
                if (!isNaN(lo) && !isNaN(hi) && !isNaN(sq) && sq >= lo && sq <= hi) return true;
            } else {
                if (planeSquawk === part) return true;
            }
        }
        return false;
    }

    /** Test a plane against the watchlist map filter. */
    function planePassesWatchlistFilter(plane) {
        if (!_watchlistMapFilter) return true;
        var icao = (plane.icao || '').toUpperCase();
        for (var wi = 0; wi < _watchList.length; wi++) {
            if ((_watchList[wi].icao || '').toUpperCase() === icao) return true;
        }
        return false;
    }

    /**
     * Test a plane against the distance zone filter.
     * Returns true when:
     * - No zones defined, OR
     * - Mode is maponly (zones shown on map but not filtering), OR
     * - Mode is inside and plane is inside any zone, OR
     * - Mode is outside and plane is outside all zones.
     * Plane position read from plane.position [lon,lat] first, then plane.lat/lon.
     */
    function planePassesDistanceFilter(plane) {
        if (_distanceZones.length === 0)    return true;
        if (_distanceMode === 'maponly')     return true;

        var plat, plon;
        if (plane.position && plane.position.length >= 2) {
            plon = +plane.position[0];
            plat = +plane.position[1];
        } else {
            plat = +plane.lat;
            plon = +plane.lon;
        }
        if (isNaN(plat) || isNaN(plon)) return true; // no position — pass through

        var insideAny = false;
        for (var zi = 0; zi < _distanceZones.length; zi++) {
            var zone = _distanceZones[zi];
            var dist = haversineNm(zone.lat, zone.lon, plat, plon);
            if (dist > zone.radiusNm) continue;
            // Altitude constraint within zone
            if (zone.altMode === 'between') {
                var alt = typeof plane.altitude === 'number'  ? plane.altitude
                        : plane.altitude === 'ground'         ? 0
                        : typeof plane.alt_baro === 'number'  ? plane.alt_baro
                        : null;
                if (alt !== null && (alt < zone.altMin || alt > zone.altMax)) continue;
            }
            insideAny = true;
            break;
        }
        return _distanceMode === 'outside' ? !insideAny : insideAny;
    }

    /**
     * AND composition: returns true if the plane passes every active filter.
     * excludeTab: omit one tab's predicate (used when rendering that tab's list).
     */
    function planePassesAllFilters(plane, excludeTab) {
        var tabs = Object.keys(_tabState);
        for (var i = 0; i < tabs.length; i++) {
            var tabName = tabs[i];
            if (tabName === excludeTab) continue;
            var s         = _tabState[tabName];
            var hasFilter = s.items.size > 0;
            if (tabName === 'aircraft')
                hasFilter = hasFilter || s.catFilter.size > 0 || s.regCountryFilter !== '';
            if (!hasFilter) continue;
            if (!planePassesFilter(plane, tabName, s.items, s.direction)) return false;
        }

        // Alerts filter: specific row selection takes priority over broad map filter
        if (excludeTab !== 'alerts') {
            var icao = plane.icao ? plane.icao.toUpperCase() : '';
            if (_alertsSelectedIcaos.size > 0) {
                if (!_alertsSelectedIcaos.has(icao)) return false;
            } else if (_alertsMapFilterIcaos) {
                if (!_alertsMapFilterIcaos.has(icao)) return false;
            }
        }

        // Distance filter
        if (excludeTab !== 'distance' && !planePassesDistanceFilter(plane)) return false;
        // Ranges filter
        if (excludeTab !== 'ranges'   && !planePassesRangesFilter(plane))   return false;
        // Summary quick-filter (ICAO subset)
        if (_sumFilter.size > 0) {
            var si = plane.icao ? plane.icao.toUpperCase() : '';
            if (!_sumFilter.has(si)) return false;
        }

        return true;
    }

    /**
     * Test a plane against a set of distance zones and a mode string.
     * Extracted from planePassesDistanceFilter so snapshots can use it too.
     */
    function _rfPlanePassesZones(plane, zones, mode) {
        if (!zones || zones.length === 0) return true;
        if (mode === 'maponly') return true;
        var plat, plon;
        if (plane.position && plane.position.length >= 2) {
            plon = +plane.position[0]; plat = +plane.position[1];
        } else { plat = +plane.lat; plon = +plane.lon; }
        if (isNaN(plat) || isNaN(plon)) return true;
        var insideAny = false;
        for (var _zi = 0; _zi < zones.length; _zi++) {
            var _z = zones[_zi];
            if (haversineNm(_z.lat, _z.lon, plat, plon) > _z.radiusNm) continue;
            if (_z.altMode === 'between') {
                var _a = typeof plane.altitude === 'number' ? plane.altitude
                       : plane.altitude === 'ground'        ? 0
                       : typeof plane.alt_baro === 'number' ? plane.alt_baro : null;
                if (_a !== null && (_a < _z.altMin || _a > _z.altMax)) continue;
            }
            insideAny = true; break;
        }
        return mode === 'outside' ? !insideAny : insideAny;
    }

    /**
     * Test a plane against a saved view state snapshot (serialized form —
     * Arrays not Sets).  Returns true if the plane passes all of that view's
     * active filters.  Used when multiple views are active (OR mode).
     */
    function planePassesViewSnapshot(plane, vs) {
        if (!vs) return false;

        // Tab filters
        if (vs.tabState) {
            var _tnames = Object.keys(vs.tabState);
            for (var _ti = 0; _ti < _tnames.length; _ti++) {
                var _tn = _tnames[_ti];
                var _ts = vs.tabState[_tn];
                if (!_ts) continue;
                var _items = new Set(Array.isArray(_ts.items) ? _ts.items : []);
                var _hasFilter = _items.size > 0;
                if (_tn === 'aircraft') {
                    var _cat = new Set(Array.isArray(_ts.catFilter) ? _ts.catFilter : []);
                    var _rcf = _ts.regCountryFilter || '';
                    _hasFilter = _hasFilter || _cat.size > 0 || _rcf !== '';
                    if (!_hasFilter) continue;
                    var _t = plane.typeLong || plane.icaoType;
                    if (_items.size > 0) {
                        if (!(_t && _items.has(_t)) && !(_items.has('(Military)') && isMilitaryAircraft(plane))) return false;
                    }
                    if (_cat.size > 0) {
                        var _cfok = true;
                        _cat.forEach(function (c) {
                            if (c === 6) { if (!isMilitaryAircraft(plane)) _cfok = false; }
                            else         { if (getAircraftCategory(_t) !== c) _cfok = false; }
                        });
                        if (!_cfok) return false;
                    }
                    if (_rcf !== '') {
                        var _rc = getRegCountryFromIcao(plane.icao);
                        if (!_rc || _rc.name !== _rcf) return false;
                    }
                } else {
                    if (!_hasFilter) continue;
                    if (!planePassesFilter(plane, _tn, _items, _ts.direction || 'both')) return false;
                }
            }
        }

        // Alerts snapshot filter: selected ICAOs first, then optional facet map-filter
        if (vs.alerts) {
            var _icao = (plane.icao || '').toUpperCase();
            if (Array.isArray(vs.alerts.selectedIcaos) && vs.alerts.selectedIcaos.length > 0) {
                var _sel  = new Set(vs.alerts.selectedIcaos);
                if (!_sel.has(_icao)) return false;
            } else if (vs.alerts.mapFilter && _alertsDb && _icao) {
                var _af = vs.alerts.filters || {};
                var _match = false;
                for (var _ai = 0; _ai < _alertsDb.length; _ai++) {
                    var _a = _alertsDb[_ai];
                    if (_a.icao !== _icao) continue;
                    if (_af.cmpg && _a.cmpg !== _af.cmpg) continue;
                    if (_af.category && _a.category !== _af.category) continue;
                    if (_af.tag && _a.tag1 !== _af.tag && _a.tag2 !== _af.tag && _a.tag3 !== _af.tag) continue;
                    _match = true;
                    break;
                }
                if (!_match) return false;
            }
        }

        // Distance zones
        if (vs.distance && Array.isArray(vs.distance.zones) && vs.distance.zones.length > 0) {
            if (!_rfPlanePassesZones(plane, vs.distance.zones, vs.distance.mode)) return false;
        }

        // Ranges filter (inline — same logic as planePassesRangesFilter)
        if (vs.ranges) {
            var _rf = vs.ranges;
            if (_rf.speedMin !== '' && _rf.speedMin != null && typeof plane.gs === 'number' && plane.gs < parseFloat(_rf.speedMin)) return false;
            if (_rf.speedMax !== '' && _rf.speedMax != null && typeof plane.gs === 'number' && plane.gs > parseFloat(_rf.speedMax)) return false;
            var _av = null;
            if (plane.altitude === 'ground' || plane.alt_baro === 'ground') _av = 0;
            else if (typeof plane.altitude === 'number')  _av = plane.altitude;
            else if (typeof plane.alt_baro === 'number')  _av = plane.alt_baro;
            if (_rf.altMin !== '' && _rf.altMin != null && _av !== null && _av < parseFloat(_rf.altMin)) return false;
            if (_rf.altMax !== '' && _rf.altMax != null && _av !== null && _av > parseFloat(_rf.altMax)) return false;
            var _vr = typeof plane.geom_rate === 'number' ? plane.geom_rate : (typeof plane.baro_rate === 'number' ? plane.baro_rate : null);
            if (_rf.vrMin !== '' && _rf.vrMin != null && _vr !== null && _vr < parseFloat(_rf.vrMin)) return false;
            if (_rf.vrMax !== '' && _rf.vrMax != null && _vr !== null && _vr > parseFloat(_rf.vrMax)) return false;
            if (_rf.squawk !== '' && _rf.squawk != null && !_rfMatchSquawk(plane.squawk, _rf.squawk)) return false;
            if (_rf.callsign !== '' && _rf.callsign != null) {
                var _pat = _rf.callsign.trim().toLowerCase();
                var _cs  = ((plane.flight || plane.name || '') + '').toLowerCase();
                var _ic  = ((plane.icao || '') + '').toLowerCase();
                if (_pat.indexOf('*') >= 0) {
                    var _re = new RegExp('^' + _pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
                    if (!_re.test(_cs) && !_re.test(_ic)) return false;
                } else {
                    if (_cs.indexOf(_pat) < 0 && _ic.indexOf(_pat) < 0) return false;
                }
            }
        }

        // Summary ICAO subset
        if (vs.summary && Array.isArray(vs.summary.sumFilter) && vs.summary.sumFilter.length > 0) {
            var _si = (plane.icao || '').toUpperCase();
            if (vs.summary.sumFilter.indexOf(_si) < 0) return false;
        }

        return true;
    }

    /**
     * Collect distance zones from all active view snapshots.
     * Used so all view circles are drawn on the map when multiple views are active.
     */
    function _rfAllActiveViewZones() {
        if (_activeViewIds.length <= 1) return _distanceZones;
        var _zones = [], _seen = new Set();
        _activeViewIds.forEach(function (id) {
            var _v = _rfFindViewById(id);
            if (!_v || !_v.state || !_v.state.distance || !Array.isArray(_v.state.distance.zones)) return;
            _v.state.distance.zones.forEach(function (z) {
                var _k = z.lat + ',' + z.lon + ',' + z.radiusNm;
                if (!_seen.has(_k)) { _seen.add(_k); _zones.push(z); }
            });
        });
        return _zones.length > 0 ? _zones : _distanceZones;
    }

    /**
     * Main filter predicate installed into tar1090.
     * Returns true when a plane should be HIDDEN (isFiltered semantics).
     */
    function rfIsFiltered(plane) {
        if (!isFilterActive()) return false;
        // Multi-view: plane is shown if it passes ANY active view (OR logic).
        if (_activeViewIds.length >= 2) {
            for (var _mvi = 0; _mvi < _activeViewIds.length; _mvi++) {
                var _mv = _rfFindViewById(_activeViewIds[_mvi]);
                if (!_mv || !_mv.state) continue;
                if (planePassesViewSnapshot(plane, _mv.state)) return false;
            }
            return true;
        }
        return !planePassesAllFilters(plane, null);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // §8  Data sync — CSV parser, airports/airlines/routes/alerts fetch & cache
    // ═══════════════════════════════════════════════════════════════════════════

    // Alerts source
    var ALERTS_CSV_URL = 'https://raw.githubusercontent.com/sdr-enthusiasts/plane-alert-db/main/plane-alert-db.csv';
    var ALERTS_MAX_AGE = 24 * 60 * 60 * 1000;

    /**
     * Safe panel refresh — called by async data callbacks once data arrives.
     * Guards against calling buildPanel before Phase 5 wires it up.
     */
    function _rfRefreshPanel() {
        if (typeof buildPanel === 'function' && _panelOpen) buildPanel();
    }
    function _rfRefreshPanelIfTab(tabName) {
        if (typeof buildPanel === 'function' && _panelOpen && _activeTab === tabName) buildPanel();
    }

    // ── CSV parser ────────────────────────────────────────────────────────────

    /**
     * Parse one CSV line, respecting double-quoted fields.
     * Strips BOM, handles CRLF. Returns array of raw field strings.
     */
    function _dbParseLine(line) {
        // Strip UTF-8 BOM if present on first field
        if (line.charCodeAt(0) === 0xFEFF) line = line.slice(1);
        line = line.replace(/\r$/, '');
        var fields = [], cur = '', inQ = false;
        for (var i = 0; i < line.length; i++) {
            var c = line[i];
            if (c === '"') {
                // Handle escaped quote ""
                if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
                else inQ = !inQ;
            } else if (c === ',' && !inQ) {
                fields.push(cur);
                cur = '';
            } else {
                cur += c;
            }
        }
        fields.push(cur);
        return fields;
    }

    /**
     * Parse CSV text into an array of header-mapped objects.
     * headerAliases: {normalizedKey: [alias1, alias2, ...]} for flexible header matching.
     * Returns {headers, rows, dropped} where dropped counts unparseable rows.
     */
    function _rfParseCsv(text, headerAliases) {
        var lines  = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        var result = { headers: [], rows: [], dropped: 0 };
        if (lines.length < 2) return result;

        // Parse header row
        var rawHeaders = _dbParseLine(lines[0]).map(function (h) { return h.trim().toLowerCase(); });
        result.headers = rawHeaders;

        // Build column index map using aliases
        var colMap = {}; // normalizedKey -> column index
        if (headerAliases) {
            var aliasKeys = Object.keys(headerAliases);
            for (var ai = 0; ai < aliasKeys.length; ai++) {
                var key     = aliasKeys[ai];
                var aliases = headerAliases[key];
                for (var ali = 0; ali < aliases.length; ali++) {
                    var idx = rawHeaders.indexOf(aliases[ali].toLowerCase());
                    if (idx >= 0) { colMap[key] = idx; break; }
                }
            }
        }

        for (var li = 1; li < lines.length; li++) {
            var line = lines[li].trim();
            if (!line) continue;
            var fields = _dbParseLine(line);
            if (fields.length < 2) { result.dropped++; continue; }
            var row = {};
            // Map by alias keys first
            var aKeys = Object.keys(colMap);
            for (var ki = 0; ki < aKeys.length; ki++) {
                row[aKeys[ki]] = (fields[colMap[aKeys[ki]]] || '').trim();
            }
            // Also expose raw fields array
            row._fields = fields;
            result.rows.push(row);
        }
        return result;
    }

    /** Returns true if a localStorage timestamp key indicates stale data (>DB_SYNC_MS). */
    function _dbNeedSync(tsKey) {
        try { return (Date.now() - parseInt(localStorage.getItem(tsKey) || '0', 10)) > DB_SYNC_MS; }
        catch (e) { return true; }
    }

    // ── Airports (OurAirports) ────────────────────────────────────────────────

    /** Load airports cache from localStorage into _localDb.airports. */
    function _dbLoadAirports() {
        try {
            var raw = _rfLoad(LS_DB_AIRPORTS);
            if (!raw) return;
            _localDb.airports             = raw;
            _localDb.st.airports.count    = Object.keys(raw).length;
            _localDb.st.airports.ts       = parseInt(localStorage.getItem(LS_DB_AIRPORTS_TS) || '0', 10);
        } catch (e) { _localDb.airports = null; }
    }

    /**
     * Fetch airports CSV from OurAirports and cache to localStorage.
     * Columns: 0=id 1=ident 2=type 3=name ... 8=iso_country
     */
    function _dbFetchAirports() {
        if (_localDb.st.airports.busy) return;
        _localDb.st.airports.busy = true;
        _localDb.st.airports.err  = null;
        _rfRefreshPanelIfTab('settings');
        fetch(DB_AIRPORTS_URL)
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
            .then(function (text) {
                var lines = text.split('\n'), db = {};
                for (var i = 1; i < lines.length; i++) {
                    var f = _dbParseLine(lines[i]);
                    if (f.length < 9) continue;
                    var ident = f[1].trim(), type = f[2].trim();
                    if (ident.length !== 4) continue;
                    if (type === 'heliport' || type === 'closed') continue;
                    db[ident.toUpperCase()] = { n: f[3].trim(), c: f[8].trim() };
                }
                _localDb.airports          = db;
                _localDb.st.airports.count = Object.keys(db).length;
                _localDb.st.airports.ts    = Date.now();
                _rfSave(LS_DB_AIRPORTS, db);
                try { localStorage.setItem(LS_DB_AIRPORTS_TS, String(Date.now())); } catch (e) {}
            })
            .catch(function (e) { _localDb.st.airports.err = e.message; })
            .finally(function () {
                _localDb.st.airports.busy = false;
                _rfRefreshPanelIfTab('settings');
            });
    }

    /** Look up airport display name from local DB. Returns string or null. */
    function _dbGetAirportName(icao) {
        if (!icao || !_localDb.airports) return null;
        var a = _localDb.airports[icao.toUpperCase()];
        return a ? a.n : null;
    }

    /** Look up airport ISO2 country code from local DB. Returns string or null. */
    function _dbGetAirportIso2(icao) {
        if (!icao || !_localDb.airports) return null;
        var a = _localDb.airports[icao.toUpperCase()];
        return a ? a.c : null;
    }

    // ── Airlines (VRS Standing Data) ──────────────────────────────────────────

    /** Load airlines cache from localStorage into _localDb.airlines. */
    function _dbLoadAirlines() {
        try {
            var raw = _rfLoad(LS_DB_AIRLINES);
            if (!raw) return;
            _localDb.airlines             = raw;
            _localDb.st.airlines.count    = Object.keys(raw).length;
            _localDb.st.airlines.ts       = parseInt(localStorage.getItem(LS_DB_AIRLINES_TS) || '0', 10);
        } catch (e) { _localDb.airlines = null; }
    }

    /**
     * Fetch airlines CSV from VRS Standing Data and cache to localStorage.
     * Columns: 0=Code 1=Name 2=ICAO 3=IATA ...
     */
    function _dbFetchAirlines() {
        if (_localDb.st.airlines.busy) return;
        _localDb.st.airlines.busy = true;
        _localDb.st.airlines.err  = null;
        _rfRefreshPanelIfTab('settings');
        fetch(DB_AIRLINES_URL)
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
            .then(function (text) {
                var lines = text.split('\n'), db = {};
                for (var i = 1; i < lines.length; i++) {
                    var f        = _dbParseLine(lines[i]);
                    if (f.length < 2) continue;
                    var icaoCode = (f[2] || '').trim().toUpperCase();
                    var name     = (f[1] || '').trim();
                    if (icaoCode.length >= 2 && name) db[icaoCode] = name;
                }
                _localDb.airlines          = db;
                _localDb.st.airlines.count = Object.keys(db).length;
                _localDb.st.airlines.ts    = Date.now();
                _rfSave(LS_DB_AIRLINES, db);
                try { localStorage.setItem(LS_DB_AIRLINES_TS, String(Date.now())); } catch (e) {}
            })
            .catch(function (e) { _localDb.st.airlines.err = e.message; })
            .finally(function () {
                _localDb.st.airlines.busy = false;
                _rfRefreshPanelIfTab('settings');
            });
    }

    // ── Routes (VRS Standing Data — lazy loaded per airline) ─────────────────

    /**
     * Fetch and cache routes CSV for one airline ICAO code.
     * Route CSV format: 0=Callsign 1=Code 2=Number 3=AirlineCode 4=AirportCodes
     * AirportCodes is a dash-separated leg list: DEP-...-ARR.
     * Negative-caches 404s to avoid repeated storms.
     */
    function _dbFetchRoutesForAirline(airlineCode) {
        var code = airlineCode.toUpperCase();
        if (_localDb.routesFetched[code] || _localDb.routesFetching[code]) return;

        // Check localStorage cache first
        try {
            var cached   = localStorage.getItem(LS_DB_ROUTES_PFX + code);
            var cachedTs = parseInt(localStorage.getItem(LS_DB_ROUTES_PFX + code + '_ts')    || '0', 10);
            var missTs   = parseInt(localStorage.getItem(LS_DB_ROUTES_PFX + code + '_miss_ts') || '0', 10);
            // Negative cache: known 404, don't retry within sync window
            if (missTs && (Date.now() - missTs) < DB_SYNC_MS) {
                _localDb.routesFetched[code] = true;
                return;
            }
            if (cached && (Date.now() - cachedTs) < DB_SYNC_MS) {
                Object.assign(_localDb.routes, JSON.parse(cached));
                _localDb.routesFetched[code] = true;
                _rfRefreshPanel();
                return;
            }
        } catch (e) {}

        _localDb.routesFetching[code] = true;
        var url = DB_ROUTES_URL.replace('{P}', code[0]).replace('{CODE}', code);
        fetch(url)
            .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
            .then(function (text) {
                var lines    = text.split('\n'), routeMap = {};
                for (var i = 1; i < lines.length; i++) {
                    var f        = _dbParseLine(lines[i]);
                    if (f.length < 5) continue;
                    var callsign = f[0].trim().toUpperCase();
                    var aps      = f[4].trim().split('-');
                    if (aps.length >= 2 && callsign)
                        routeMap[callsign] = { dep: aps[0].toUpperCase(), arr: aps[aps.length - 1].toUpperCase() };
                }
                Object.assign(_localDb.routes, routeMap);
                _localDb.routesFetched[code] = true;
                try {
                    localStorage.setItem(LS_DB_ROUTES_PFX + code,        JSON.stringify(routeMap));
                    localStorage.setItem(LS_DB_ROUTES_PFX + code + '_ts', String(Date.now()));
                    localStorage.removeItem(LS_DB_ROUTES_PFX + code + '_miss_ts');
                } catch (e) {}
                _rfRefreshPanel();
            })
            .catch(function () {
                // 404 or network error — negative-cache so we don't hammer the CDN
                _localDb.routesFetched[code] = true;
                try { localStorage.setItem(LS_DB_ROUTES_PFX + code + '_miss_ts', String(Date.now())); } catch (e) {}
            })
            .finally(function () { delete _localDb.routesFetching[code]; });
    }

    /**
     * Get route data for a plane from local DB.
     * Returns route object or null. Triggers lazy airline fetch as a side-effect.
     */
    function _dbGetRoute(plane) {
        var cs = (plane.name || plane.flight || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!cs) return null;
        var entry = _localDb.routes[cs];
        if (entry) {
            return {
                full:        entry.dep + ' - ' + entry.arr,
                fromDisplay: _dbGetAirportName(entry.dep) || entry.dep,
                toDisplay:   _dbGetAirportName(entry.arr) || entry.arr,
                fromIcao:    entry.dep,
                toIcao:      entry.arr
            };
        }
        // Trigger lazy fetch for the airline prefix (3 alpha chars)
        var prefix = cs.replace(/[^A-Z]/g, '').substring(0, 3);
        if (prefix.length === 3) {
            // Only fetch if routeKnownOnly is off, or the airline code is in the airlines DB
            if (!settings.routeKnownOnly || !_localDb.airlines || _localDb.airlines[prefix]) {
                _dbFetchRoutesForAirline(prefix);
            }
        }
        return null;
    }

    /** Clear all cached route data from memory and localStorage. */
    function _dbClearRoutes() {
        _localDb.routes        = {};
        _localDb.routesFetched = {};
        if (!_rfCanUseLocalStorage()) return;
        try {
            var rem = [];
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.indexOf(LS_DB_ROUTES_PFX) === 0) rem.push(k);
            }
            for (var ri = 0; ri < rem.length; ri++) localStorage.removeItem(rem[ri]);
        } catch (e) {}
    }

    // ── Boot-time auto-sync ───────────────────────────────────────────────────

    /**
     * Called at init. Loads caches from localStorage and triggers background
     * refresh of any stale data.
     */
    function _dbAutoSync() {
        if (!settings.useLocalDb) return;
        _dbLoadAirports();
        if (!_localDb.airports || _dbNeedSync(LS_DB_AIRPORTS_TS)) _dbFetchAirports();
        _dbLoadAirlines();
        if (!_localDb.airlines || _dbNeedSync(LS_DB_AIRLINES_TS)) _dbFetchAirlines();
    }

    // ── Alerts (plane-alert-db) ───────────────────────────────────────────────

    /**
     * Parse plane-alert-db CSV with flexible header mapping.
     * Supports schema drift — uses alias map to find columns by alternate names.
     * Returns array of normalized row objects.
     */
    function parseAlertsCsv(text) {
        var parsed = _rfParseCsv(text, {
            icao:     ['icao', '$icao'],
            reg:      ['reg', '$registration', 'registration', 'r'],
            operator: ['operator', '$operator', 'owner'],
            type:     ['type', '$type', 'aircraft type'],
            icaoType: ['icaotype', '$icao type', 'type_code', 'icao type'],
            cmpg:     ['cmpg', '#cmpg', 'campaign', 'type_flag'],
            tag1:     ['tag', 'tag1', '$tag 1', 'tags'],
            tag2:     ['tag2', 'tag 2', '#tag 2', '$#tag 2'],
            tag3:     ['tag3', 'tag 3', '#tag 3', '$#tag 3'],
            category: ['category', '$category', 'cat'],
            link:     ['link', 'url', 'notes', 'comment', '#link', '$#link'],
            note:     ['note', 'notes', 'comment', 'why', 'reason']
        });

        var rows = [];
        for (var i = 0; i < parsed.rows.length; i++) {
            var r = parsed.rows[i];
            if (!r.icao) continue;
            rows.push({
                icao:     r.icao.toUpperCase(),
                reg:      r.reg      || '',
                operator: r.operator || '',
                type:     r.type     || '',
                icaoType: r.icaoType || '',
                cmpg:     r.cmpg     || '',
                tag1:     r.tag1     || '',
                tag2:     r.tag2     || '',
                tag3:     r.tag3     || '',
                category: r.category || '',
                link:     r.link     || '',
                note:     r.note     || ''
            });
        }
        return rows;
    }

    /**
     * Load alerts DB — from localStorage cache if fresh, else fetch from CDN.
     * forceRefresh: bypass cache and fetch immediately.
     */
    function loadAlerts(forceRefresh) {
        if (_alertsFetching) return;
        if (!forceRefresh) {
            try {
                var cached = _rfLoad(LS_ALERTS);
                if (cached && cached.data && (Date.now() - cached.ts) < ALERTS_MAX_AGE) {
                    _alertsDb        = cached.data;
                    _alertsTimestamp = cached.ts;
                    buildAlertsMapFilterSet();
                    if (_alertsMapFilter) applyFilter();
                    _rfRefreshPanelIfTab('alerts');
                    return;
                }
            } catch (e) {}
        }
        _alertsFetching = true;
        _alertsError    = null;
        _rfRefreshPanelIfTab('alerts');
        fetch(ALERTS_CSV_URL)
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
            .then(function (text) {
                _alertsDb        = parseAlertsCsv(text);
                _alertsTimestamp = Date.now();
                _alertsFetching  = false;
                buildAlertsMapFilterSet();
                _rfSave(LS_ALERTS, { data: _alertsDb, ts: _alertsTimestamp });
                if (_alertsMapFilter) applyFilter();
                _rfRefreshPanelIfTab('alerts');
            })
            .catch(function (e) {
                _alertsError    = e.message || 'Fetch failed';
                _alertsFetching = false;
                _rfRefreshPanelIfTab('alerts');
            });
    }

    /**
     * Rebuild the pre-filtered ICAO set used by planePassesAllFilters for the
     * alerts map filter. Must be called whenever alertsFilters or alertsMapFilter changes.
     */
    function buildAlertsMapFilterSet() {
        if (!_alertsMapFilter || !_alertsDb) { _alertsMapFilterIcaos = null; return; }
        var set = new Set();
        for (var i = 0; i < _alertsDb.length; i++) {
            var a    = _alertsDb[i];
            var icao = a.icao.toUpperCase();
            if (_alertsFilters.cmpg     && a.cmpg     !== _alertsFilters.cmpg)                                    continue;
            if (_alertsFilters.category && a.category !== _alertsFilters.category)                                 continue;
            if (_alertsFilters.tag && a.tag1 !== _alertsFilters.tag &&
                                      a.tag2 !== _alertsFilters.tag &&
                                      a.tag3 !== _alertsFilters.tag)                                               continue;
            set.add(icao);
        }
        _alertsMapFilterIcaos = set;
    }

    /**
     * Look up a single alerts DB entry by ICAO.
     * Returns the first matching row or null.
     */
    function _rfAlertDbEntry(icao) {
        if (!_alertsDb || !icao) return null;
        var uc = icao.toUpperCase();
        for (var i = 0; i < _alertsDb.length; i++) {
            if (_alertsDb[i].icao === uc) return _alertsDb[i];
        }
        return null;
    }

    // ── DB status HTML helper (used by Settings tab) ──────────────────────────

    /**
     * Returns HTML describing current local DB sync state.
     * Used by the Settings tab to show per-source status.
     */
    function dbStatusHtml() {
        if (!settings.useLocalDb) return '<div class="rf-db-status-off">Local databases disabled.</div>';
        var ast   = _localDb.st.airports;
        var lst   = _localDb.st.airlines;
        var rCount = Object.keys(_localDb.routes).length;
        var fmtTs  = function (ts) { return ts ? new Date(ts).toLocaleString() : 'Never'; };

        function statusLabel(st) {
            if (st.busy)  return '<span class="rf-db-busy">Downloading\u2026</span>';
            if (st.err)   return '<span class="rf-db-err">Error: ' + _rfEscText(st.err) + '</span>';
            if (st.count) return '<span class="rf-db-ok">' + st.count.toLocaleString() + ' entries</span>';
            return '<span class="rf-db-none">Not downloaded</span>';
        }

        function dbRow(label, syncFn, st) {
            return '<div class="rf-db-row">' +
                '<span class="rf-db-label">' + label + '</span>' +
                '<span class="rf-db-info">' + statusLabel(st) +
                  (st.ts ? ' <span class="rf-db-ts">Updated: ' + fmtTs(st.ts) + '</span>' : '') +
                '</span>' +
                '<button class="rf-cat-btn rf-db-sync-btn" onclick="' + syncFn + '">Sync now</button>' +
                '</div>';
        }

        return '<div class="rf-db-status">' +
            dbRow('Airports', 'window._rfDbSyncAirports()', ast) +
            dbRow('Airlines', 'window._rfDbSyncAirlines()', lst) +
            '<div class="rf-db-row">' +
                '<span class="rf-db-label">Routes</span>' +
                '<span class="rf-db-info"><span class="rf-db-ok">' + rCount.toLocaleString() + ' cached</span></span>' +
                '<button class="rf-cat-btn rf-db-sync-btn" onclick="window._rfDbClearRoutes()">Clear cache</button>' +
            '</div>' +
            '</div>';
    }

    // ── Exposed DB control globals (called from Settings tab HTML) ────────────
    window._rfDbSyncAirports = function () { _dbFetchAirports(); };
    window._rfDbSyncAirlines = function () { _dbFetchAirlines(); };
    window._rfDbClearRoutes  = function () { _dbClearRoutes(); _rfRefreshPanel(); };
    window._rfAlertsRefresh  = function () { loadAlerts(true); };

    // ═══════════════════════════════════════════════════════════════════════════
    // §9  UI — panel scaffold, header, tab bar, chips
    // ═══════════════════════════════════════════════════════════════════════════

    // ── Panel refresh helper ──────────────────────────────────────────────────

    // buildPanel is guaranteed by this section; keep a single declaration of
    // _rfRefreshPanel (the guarded version above) to avoid override drift.

    // ── Scope toggle HTML ─────────────────────────────────────────────────────

    function _rfTabMenuHtml() {
        var tabs = [
            { key: 'summary',   label: 'Summary' },
            { key: 'views',     label: 'Views' },
            { key: 'alerts',    label: 'Plane Alert' },
            { key: 'airports',  label: 'Airports' },
            { key: 'operators', label: 'Operators' },
            { key: 'aircraft',  label: 'Aircraft' },
            { key: 'countries', label: 'Countries' },
            { key: 'distance',  label: 'Distance' },
            { key: 'ranges',    label: 'Ranges' },
            { key: 'settings',  label: 'Settings' }
        ];
        var html = '';
        for (var i = 0; i < tabs.length; i++) {
            var t = tabs[i];
            if (t.key !== 'settings' && t.key !== 'views' && _tabVisibility[t.key] === false) continue;
            html += '<button class="rf-tabmenu-item' + (_activeTab === t.key ? ' rf-tabmenu-item-active' : '') + '" onclick="window._rfOpenTabFromMenu(\'' + _rfEscAttr(t.key) + '\')">' + _rfEscText(t.label) + '</button>';
        }
        return '<div class="rf-tabmenu-wrap">' +
            '<button class="rf-sum-scope-btn rf-tabmenu-toggle' + (_rfTabMenuOpen ? ' rf-sum-scope-active' : '') + '" title="Open tabs" aria-label="Open tabs" onclick="window._rfToggleTabMenu()">\u2630</button>' +
            '<div id="rf-tab-menu" class="rf-tabmenu-pop" style="display:' + (_rfTabMenuOpen ? 'block' : 'none') + '">' + html + '</div>' +
            '</div>';
    }

    function _rfScopeToggleHtml() {
        var btns = [];
        btns.push(_rfTabMenuHtml());
        btns.push('<button class="rf-sum-scope-btn rf-scope-home-btn" onclick="window._rfCenterHome(true)" title="Center map on home position">\u2302</button>');
        if (!settings.hideAllScope) {
            btns.push('<button class="rf-sum-scope-btn' + (_panelScope === 'all' ? ' rf-sum-scope-active' : '') + '" ' +
                'onclick="window._rfSetPanelScope(\'all\')" title="Include all currently loaded aircraft">All aircraft</button>');
        }
        btns.push('<button class="rf-sum-scope-btn' + (_panelScope === 'inview' ? ' rf-sum-scope-active' : '') + '" ' +
            'onclick="window._rfSetPanelScope(\'inview\')" title="Only aircraft visible in the current map viewport">In map view</button>');
        btns.push('<button class="rf-sum-scope-btn' + (_panelScope === 'filtered' ? ' rf-sum-scope-active' : '') + '" ' +
            'onclick="window._rfSetPanelScope(\'filtered\')" title="Only aircraft matching active filters">Filtered view</button>');
        btns.push('<button class="rf-sum-scope-btn rf-scope-settings-btn" onclick="window._rfSwitchTab(\'settings\')" title="Open settings">⚙</button>');
        return '<div class="rf-sum-scope-wrap"><div class="rf-sum-scope-btns">' + btns.join('') + '</div></div>';
    }

    function _rfRenderScopeHeader() {
        var el = document.getElementById('rf-scope-global');
        if (el) el.innerHTML = _rfScopeToggleHtml();
        _rfRenderViewQuickMenu();
    }

    window._rfToggleTabMenu = function (force) {
        if (typeof force === 'boolean') _rfTabMenuOpen = force;
        else _rfTabMenuOpen = !_rfTabMenuOpen;
        _rfRenderScopeHeader();
    };

    window._rfOpenTabFromMenu = function (tab) {
        _rfTabMenuOpen = false;
        window._rfSwitchTab(tab);
    };

    // ── View quick-menu ───────────────────────────────────────────────────────

    function _rfGetActiveViews() {
        _rfSyncActiveViewPointers();
        var out = [];
        for (var i = 0; i < _activeViewIds.length; i++) {
            var v = _rfFindViewById(_activeViewIds[i]);
            if (v) out.push(v);
        }
        return out;
    }

    function _rfRenderViewQuickMenu() {
        var el = document.getElementById('rf-view-quick-menu');
        if (!el) return;
        var avs = _rfGetActiveViews();
        var badge = '<div class="rf-active-view-badge-empty">No active view</div>';
        if (avs.length) {
            var av = avs[0];
            _rfEnsureViewShape(av);
            var modeLbl = !av.map.enabled ? 'Map Off' : (av.map.mode === 'fixed' ? 'Map Fixed' : 'Map Dynamic');
            badge = '<div class="rf-active-view-badge" title="' + (avs.length > 1 ? ('Active views: ' + avs.length) : ('Active view: ' + _rfEscAttr(av.name || ''))) + '">' +
                '<span class="rf-active-view-name">' + _rfEscText(av.name || 'View') + '</span>' +
                '<span class="rf-active-view-mode">' + (avs.length > 1 ? ('+' + (avs.length - 1) + ' more') : modeLbl) + '</span></div>';
        }
        if (!_rfQuickSelectedViewId) _rfQuickSelectedViewId = _activeViewId || '';
        var list = '';
        for (var i2 = 0; i2 < _savedViews.length; i2++) {
            var sv = _savedViews[i2];
            _rfEnsureViewShape(sv);
            var checked = (_activeViewIds.indexOf(sv.id) >= 0 || _rfQuickSelectedViewId === sv.id) ? ' checked' : '';
            list += '<label class="rf-view-quick-item">' +
                '<input type="checkbox" class="rf-view-quick-check" value="' + _rfEscAttr(sv.id) + '"' + checked + ' onchange="window._rfViewsQuickPick(this)">' +
                '<span>' + _rfEscText(sv.name || ('View ' + (i2 + 1))) + '</span>' +
            '</label>';
        }
        var builtinList = '';
        for (var bi2 = 0; bi2 < RF_BUILTIN_VIEWS.length; bi2++) {
            var bv2 = RF_BUILTIN_VIEWS[bi2];
            var bchecked = (_activeViewIds.indexOf(bv2.id) >= 0) ? ' checked' : '';
            builtinList += '<label class="rf-view-quick-item">' +
                '<input type="checkbox" class="rf-view-quick-check" value="' + _rfEscAttr(bv2.id) + '"' + bchecked + ' onchange="window._rfViewsQuickPick(this)">' +
                '<span>' + _rfEscText(bv2.name) + ' <em style="opacity:0.6;font-size:0.85em">(built-in)</em></span>' +
            '</label>';
        }
        el.innerHTML =
            '<div class="rf-view-quick-head">Views</div>' +
            badge +
            (_savedViews.length ? ('<div class="rf-view-quick-list">' + list + '</div>') : '<div class="rf-active-view-badge-empty">No saved views yet</div>') +
            '<div class="rf-view-quick-list">' + builtinList + '</div>' +
            '<div class="rf-view-quick-actions">' +
            '<button class="rf-cat-btn" title="Apply selected views" onclick="window._rfViewsApplyQuick()">\u25B6</button>' +
            '<button class="rf-cat-btn" title="Turn off all active views" onclick="window._rfViewsClearActive()">\u23FB</button>' +
            '<button class="rf-cat-btn" title="Save current filters as a view" onclick="window._rfViewsSavePrompt()">\uD83D\uDCBE</button>' +
            '<button class="rf-cat-btn" title="Open Views tab" onclick="window._rfSwitchTab(\'views\');window._rfToggleViewQuickMenu(false)">\u2699</button>' +
            '</div>';
    }

    // ── Breadcrumb generation ─────────────────────────────────────────────────

    var TAB_LABELS = {
        airports:'Airports', countries:'Countries',
        operators:'Operators', aircraft:'Aircraft'
    };

    function buildBreadcrumb() {
        var el = document.getElementById('rf-breadcrumb');
        if (!el) return;
        var chips = [];
        var activeViews = _rfGetActiveViews();
        if (activeViews.length) {
            for (var avi = 0; avi < activeViews.length; avi++) {
                var av = activeViews[avi];
                _rfEnsureViewShape(av);
                var avMode = !av.map.enabled ? 'Map Off' : (av.map.mode === 'fixed' ? 'Map Fixed' : 'Map Dynamic');
                chips.push(
                    '<div class="rf-chip rf-chip-active" onclick="window._rfSwitchTab(\'views\')" title="Active view. Click to open Views tab">' +
                    '<span class="rf-chip-label">View</span>' +
                    '<span class="rf-chip-items">' + _rfEscText(av.name || 'Unnamed') + ' \u2022 ' + avMode + '</span>' +
                    '<button class="rf-chip-x" onclick="event.stopPropagation();window._rfViewsRemoveActive(\'' + _rfEscAttr(av.id) + '\')">&#x2715;</button>' +
                    '</div>'
                );
            }
            el.style.display = 'flex';
            el.innerHTML = chips.join('');
            return;
        }
        var tabs = Object.keys(_tabState);
        for (var i = 0; i < tabs.length; i++) {
            var tabName = tabs[i];
            var s = _tabState[tabName];
            var acExtra = tabName === 'aircraft' && (s.catFilter.size > 0 || s.regCountryFilter !== '');
            if (s.items.size === 0 && !acExtra) continue;
            var items = Array.from(s.items);
            var summary;
            if (tabName === 'aircraft') {
                var acParts = [];
                if (items.length > 2) acParts.push(items.length + ' types');
                else if (items.length > 0) acParts.push(items.join(', '));
                s.catFilter.forEach(function(catId) {
                    var cInfo = CATEGORY_INFO[catId];
                    acParts.push(cInfo.emoji + ' ' + cInfo.label);
                });
                if (s.regCountryFilter !== '') {
                    var rcIso2 = _allRegCountries.get(s.regCountryFilter);
                    acParts.push((rcIso2 ? flagFromIso(rcIso2) + ' ' : '') + s.regCountryFilter);
                }
                summary = acParts.join(' + ') || 'filtered';
            } else if (items.length > 2) {
                summary = items.length + ' selected';
            } else {
                summary = items.map(function (key) {
                    if (tabName === 'airports')  return _airportLabels.get(key) || key;
                    if (tabName === 'operators') return getAirlineName(key) || key;
                    if (tabName === 'countries') {
                        var iso2 = _countryIso2.get(key);
                        return (iso2 ? flagFromIso(iso2) + ' ' : '') + key;
                    }
                    return key;
                }).join(', ');
            }
            var dirLabel = (tabName === 'airports' || tabName === 'countries') && s.direction !== 'both'
                ? ' (' + s.direction.charAt(0).toUpperCase() + s.direction.slice(1) + ')'
                : '';
            var activeClass = tabName === _activeTab ? ' rf-chip-active' : '';
            chips.push(
                '<div class="rf-chip' + activeClass + '" onclick="window._rfSwitchTab(\'' + tabName + '\')" title="Click to open this filter tab">' +
                '<span class="rf-chip-label">' + TAB_LABELS[tabName] + '</span>' +
                '<span class="rf-chip-items">' + summary.replace(/&/g, '&amp;').replace(/</g, '&lt;') + dirLabel + '</span>' +
                '<button class="rf-chip-x" onclick="event.stopPropagation();window._rfClearTab(\'' + tabName + '\')">&#x2715;</button>' +
                '</div>'
            );
        }
        // Alerts chip
        var alActive = _activeTab === 'alerts' ? ' rf-chip-active' : '';
        var alFacetActive = !!(_alertsFilters.cmpg || _alertsFilters.category || _alertsFilters.tag);
        if (_alertsSelectedIcaos.size > 0) {
            var alSummary = '';
            if (_alertsSelectedIcaos.size === 1) {
                var only = Array.from(_alertsSelectedIcaos)[0];
                var ae = _rfAlertDbEntry(only);
                alSummary = (ae && (ae.operator || ae.reg || ae.type)) || only;
            } else {
                alSummary = _alertsSelectedIcaos.size + ' aircraft';
            }
            chips.push(
                '<div class="rf-chip' + alActive + '" onclick="window._rfSwitchTab(\'alerts\')" title="Click to open Plane Alert tab">' +
                '<span class="rf-chip-label">Plane Alert</span>' +
                '<span class="rf-chip-items">' + alSummary.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>' +
                '<button class="rf-chip-x" onclick="event.stopPropagation();window._rfClearAlerts()">&#x2715;</button>' +
                '</div>'
            );
        } else if (alFacetActive || (_alertsMapFilter && _alertsMapFilterIcaos)) {
            var alParts = [];
            if (_alertsFilters.cmpg)     alParts.push(_alertsFilters.cmpg);
            if (_alertsFilters.category) alParts.push(_alertsFilters.category);
            if (_alertsFilters.tag)      alParts.push(_alertsFilters.tag);
            var alSummary2 = alParts.length > 0 ? alParts.join(' + ') : 'All alerts';
            if (_alertsMapFilter && _alertsMapFilterIcaos) alSummary2 += ' (' + _alertsMapFilterIcaos.size + ')';
            chips.push(
                '<div class="rf-chip' + alActive + '" onclick="window._rfSwitchTab(\'alerts\')" title="Click to open Plane Alert tab">' +
                '<span class="rf-chip-label">Plane Alert</span>' +
                '<span class="rf-chip-items">' + alSummary2.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>' +
                '<button class="rf-chip-x" onclick="event.stopPropagation();window._rfClearAlertsFacets()">&#x2715;</button>' +
                '</div>'
            );
        }
        // Distance chip
        if (_distanceZones.length > 0) {
            var distActive  = _activeTab === 'distance' ? ' rf-chip-active' : '';
            var distSummary = _distanceZones.length === 1
                ? (_distanceZones[0].name || 'Custom') + '\u00a0' + _distanceZones[0].radiusNm + 'NM'
                : _distanceZones.length + ' zones';
            chips.push(
                '<div class="rf-chip' + distActive + '" onclick="window._rfSwitchTab(\'distance\')" title="Click to open Distance tab">' +
                '<span class="rf-chip-label">Distance</span>' +
                '<span class="rf-chip-items">' + distSummary.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>' +
                '<button class="rf-chip-x" onclick="event.stopPropagation();window._rfDistClear()">&#x2715;</button>' +
                '</div>'
            );
        }
        // Ranges chip
        if (_rfRangesFilterActive()) {
            var rngActive = _activeTab === 'ranges' ? ' rf-chip-active' : '';
            var rngCount = 0;
            var rk2 = Object.keys(_rangesFilter);
            for (var ri2 = 0; ri2 < rk2.length; ri2++) { if (_rangesFilter[rk2[ri2]]) rngCount++; }
            chips.push(
                '<div class="rf-chip' + rngActive + '" onclick="window._rfSwitchTab(\'ranges\')" title="Click to open Ranges tab">' +
                '<span class="rf-chip-label">Ranges</span>' +
                '<span class="rf-chip-items">' + rngCount + ' filter' + (rngCount !== 1 ? 's' : '') + ' active</span>' +
                '<button class="rf-chip-x" onclick="event.stopPropagation();window._rfClearRanges()">&#x2715;</button>' +
                '</div>'
            );
        }
        // Summary quick-filter chip
        if (_sumFilter.size > 0) {
            var sfActive = _activeTab === 'summary' ? ' rf-chip-active' : '';
            var sfLabel  = _sumFilter.size === 1 ? Array.from(_sumFilter)[0] : _sumFilter.size + ' selected';
            chips.push(
                '<div class="rf-chip' + sfActive + '" onclick="window._rfSwitchTab(\'summary\')" title="Click to return to Summary tab">' +
                '<span class="rf-chip-label">Summary</span>' +
                '<span class="rf-chip-items">' + sfLabel.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>' +
                '<button class="rf-chip-x" onclick="event.stopPropagation();window._rfClearSumFilter()">&#x2715;</button>' +
                '</div>'
            );
        }
        if (chips.length === 0) {
            el.innerHTML = '';
            el.style.display = 'none';
        } else {
            el.style.display = 'flex';
            el.innerHTML = chips.join('');
        }
    }

    // ── Panel mode helpers ────────────────────────────────────────────────────

    function _rfCookieSet(name, value, days) {
        try {
            var exp = '', maxAge = '';
            if (days) {
                var d = new Date();
                d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
                exp    = '; expires=' + d.toUTCString();
                maxAge = '; max-age=' + String(days * 24 * 60 * 60);
            }
            document.cookie = name + '=' + encodeURIComponent(value) + exp + maxAge + '; path=/; SameSite=Lax';
            if (_rfCookieGet(name) === '') {
                document.cookie = name + '=' + encodeURIComponent(value) + exp + maxAge + '; path=/';
            }
        } catch (e) {}
    }

    function _rfCookieGet(name) {
        try {
            var k = name + '=';
            var parts = (document.cookie || '').split(';');
            for (var i = 0; i < parts.length; i++) {
                var c = parts[i].trim();
                if (c.indexOf(k) === 0) return decodeURIComponent(c.substring(k.length));
            }
        } catch (e) {}
        return '';
    }

    function _rfProbeStorage() {
        try {
            localStorage.setItem('__rf_probe_ls', '1');
            _rfLocalStorageOk = localStorage.getItem('__rf_probe_ls') === '1';
            localStorage.removeItem('__rf_probe_ls');
        } catch (e) { _rfLocalStorageOk = false; }
        try {
            _rfCookieSet('__rf_probe_ck', '1', 1);
            _rfCookieOk = _rfCookieGet('__rf_probe_ck') === '1';
            document.cookie = '__rf_probe_ck=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
        } catch (e) { _rfCookieOk = false; }
    }

    function _rfGetMapInsetElement() {
        var m = _rfOLMap();
        if (m && typeof m.getTargetElement === 'function') {
            var te = m.getTargetElement();
            if (te) return te;
        }
        return document.getElementById('map_container') ||
               document.getElementById('layout_container') ||
               document.getElementById('map_canvas') || null;
    }

    function _rfClearMapInset() {
        if (!_rfMapInsetState || !_rfMapInsetState.el) return;
        var st = _rfMapInsetState;
        st.el.style.marginLeft  = st.marginLeft;
        st.el.style.marginRight = st.marginRight;
        st.el.style.width       = st.width;
        _rfMapInsetState = null;
    }

    function _rfApplyMapInset() {
        if (settings.displayMode !== 'sidebar' || !_panelOpen) {
            _rfClearMapInset();
            return;
        }
        var panel = document.getElementById('rf-panel');
        var el = _rfGetMapInsetElement();
        if (!panel || !el) return;
        if (!_rfMapInsetState || _rfMapInsetState.el !== el) {
            _rfMapInsetState = {
                el: el,
                marginLeft:  el.style.marginLeft  || '',
                marginRight: el.style.marginRight || '',
                width:       el.style.width       || ''
            };
        }
        var inset = Math.max(280, panel.offsetWidth || 400);
        var pr = panel.getBoundingClientRect();
        var panelOnLeft = ((pr.left + (pr.width / 2)) < (window.innerWidth / 2));
        if (panelOnLeft) {
            el.style.marginLeft  = inset + 'px';
            el.style.marginRight = '';
        } else {
            el.style.marginLeft  = '';
            el.style.marginRight = inset + 'px';
        }
        el.style.width = 'calc(100% - ' + inset + 'px)';
    }

    function _rfNudgeMainMapResize() {
        try {
            if (_rfMapResizeTimer) { clearTimeout(_rfMapResizeTimer); _rfMapResizeTimer = null; }
        } catch (e) {}
        function _doResize() {
            var m = _rfOLMap();
            if (m) {
                try { if (typeof m.updateSize === 'function') m.updateSize(); } catch (e1) {}
                try { if (typeof m.render === 'function') m.render(); } catch (e2) {}
            }
            try { window.dispatchEvent(new Event('resize')); } catch (e3) {}
        }
        _doResize();
        _rfMapResizeTimer = setTimeout(function () {
            _rfMapResizeTimer = null;
            _doResize();
        }, 120);
    }

    function _rfPositionNextToSidebar() {
        if (settings.displayMode !== 'sidebar') return;
        var panel = document.getElementById('rf-panel');
        if (!panel || !_panelOpen) return;
        panel.style.display = 'flex';
        var sidebarEl = document.getElementById('sidebar_container');
        var infoEl    = document.getElementById('selected_infoblock');
        var vw        = window.innerWidth;
        var panelW    = panel.offsetWidth || 400;
        var leftPos = 0;
        [sidebarEl, infoEl].forEach(function(el) {
            if (!el) return;
            var r = el.getBoundingClientRect();
            if (r.width < 10 || r.height < 10) return;
            if (r.right > vw - 20) return;
            if (r.right > leftPos) leftPos = r.right;
        });
        var layoutEl  = document.getElementById('layout_container');
        var hdrEl     = document.getElementById('header_side');
        var topOffset = layoutEl ? layoutEl.getBoundingClientRect().top
                      : hdrEl   ? hdrEl.getBoundingClientRect().bottom
                      : 0;
        topOffset = Math.max(0, topOffset);
        leftPos = Math.min(leftPos, vw - panelW);
        leftPos = Math.max(0, leftPos);
        panel.style.top    = topOffset + 'px';
        panel.style.left   = leftPos + 'px';
        panel.style.right  = '';
        panel.style.bottom = '0px';
        _rfApplyMapInset();
    }

    function _rfDetachObservers() {
        _rfObservers.forEach(function(ob) { try { ob.disconnect(); } catch(e) {} });
        _rfObservers = [];
    }

    function _rfAttachObservers() {
        _rfDetachObservers();
        var targets = ['sidebar_container', 'selected_infoblock', 'layout_container']
            .map(function(id) { return document.getElementById(id); })
            .filter(Boolean);
        var panel = document.getElementById('rf-panel');
        targets.forEach(function(el) {
            if (window.ResizeObserver) {
                var ro = new ResizeObserver(_rfPositionNextToSidebar);
                ro.observe(el);
                _rfObservers.push(ro);
            }
            var opts = { attributes: true, attributeFilter: ['style', 'class'] };
            if (el.id === 'layout_container') opts.childList = true;
            var mo = new MutationObserver(_rfPositionNextToSidebar);
            mo.observe(el, opts);
            _rfObservers.push(mo);
        });
        if (panel && window.ResizeObserver) {
            var pro = new ResizeObserver(function () {
                _rfPositionNextToSidebar();
                _rfNudgeMainMapResize();
            });
            pro.observe(panel);
            _rfObservers.push(pro);
        }
        window.addEventListener('resize', _rfPositionNextToSidebar);
        _rfObservers.push({ disconnect: function() {
            window.removeEventListener('resize', _rfPositionNextToSidebar);
        }});
    }

    function applyPanelMode() {
        var panel = document.getElementById('rf-panel');
        if (!panel) return;
        panel.classList.remove('rf-sidebar', 'rf-sidebar-left', 'rf-sidebar-right');
        panel.style.left   = '';
        panel.style.right  = '';
        panel.style.top    = '';
        panel.style.bottom = '';
        _rfDetachObservers();
        if (settings.displayMode === 'sidebar') {
            panel.classList.add('rf-sidebar');
            _rfPositionNextToSidebar();
            _rfAttachObservers();
            _rfNudgeMainMapResize();
        } else {
            _rfClearMapInset();
        }
    }

    // ── Drag / resize helpers ─────────────────────────────────────────────────

    function makeDraggable(panel, handle) {
        var startX, startY, startLeft, startTop;
        handle.addEventListener('mousedown', function (e) {
            if (settings.displayMode === 'sidebar') return;
            if (e.target.classList.contains('rf-close')) return;
            startX    = e.clientX;
            startY    = e.clientY;
            startLeft = panel.offsetLeft;
            startTop  = panel.offsetTop;
            function onMove(e2) {
                panel.style.right = 'auto';
                panel.style.left  = (startLeft + e2.clientX - startX) + 'px';
                panel.style.top   = (startTop  + e2.clientY - startY) + 'px';
            }
            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup',  onUp);
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup',   onUp);
            e.preventDefault();
        });
    }

    function makeSidebarResizable(panel, handle) {
        if (!panel || !handle) return;
        handle.addEventListener('mousedown', function (e) {
            if (settings.displayMode !== 'sidebar') return;
            var startX = e.clientX;
            var startW = panel.offsetWidth || 400;
            var rect = panel.getBoundingClientRect();
            var panelOnLeft = ((rect.left + (rect.width / 2)) < (window.innerWidth / 2));
            var minW = 300;
            var maxW = Math.max(minW + 20, Math.floor(window.innerWidth * 0.55));
            document.body.style.userSelect = 'none';
            function onMove(ev) {
                var dx = ev.clientX - startX;
                var next = panelOnLeft ? (startW + dx) : (startW - dx);
                if (next < minW) next = minW;
                if (next > maxW) next = maxW;
                panel.style.width = next + 'px';
                _rfPositionNextToSidebar();
            }
            function onUp() {
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                _rfNudgeMainMapResize();
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            e.preventDefault();
            e.stopPropagation();
        });
    }

    function _rfIsEditingInputs() {
        if (!_panelOpen) return false;
        var ae = document.activeElement;
        if (!ae) return false;
        var tag = (ae.tagName || '').toUpperCase();
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return false;
        var panel = document.getElementById('rf-panel');
        return !!(panel && panel.contains(ae));
    }

    // ── OL map helpers ────────────────────────────────────────────────────────

    function _rfOLMap() {
        try { if (typeof OLMap !== 'undefined' && OLMap && OLMap.getView) return OLMap; } catch(e) {}
        try {
            var keys = Object.keys(window);
            for (var ki = 0; ki < keys.length; ki++) {
                var kv = window[keys[ki]];
                if (kv && typeof kv.getView === 'function' &&
                    typeof kv.getLayers === 'function' && typeof kv.addLayer === 'function') return kv;
            }
        } catch(e) {}
        return null;
    }

    function _rfAnimDuration(ms) {
        try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0; } catch(e) {}
        return ms;
    }

    function _rfSaveMapView() {
        if (_mapViewSaved) return;
        var m = _rfOLMap();
        if (!m) return;
        var v = m.getView();
        _mapViewSaved = { center: v.getCenter().slice(), zoom: v.getZoom() };
    }

    function _rfRestoreMapView() {
        if (!_mapViewSaved) return;
        var m = _rfOLMap();
        if (m) m.getView().animate({ center: _mapViewSaved.center, zoom: _mapViewSaved.zoom, duration: _rfAnimDuration(600) });
        _mapViewSaved = null;
    }

    function _rfMapCoordFromLonLat(lon, lat) {
        if (!window.ol || !ol.proj) return null;
        try {
            if (typeof ol.proj.fromLonLat === 'function') return ol.proj.fromLonLat([lon, lat]);
        } catch(e) {}
        try {
            if (typeof ol.proj.transform === 'function') return ol.proj.transform([lon, lat], 'EPSG:4326', 'EPSG:3857');
        } catch(e) {}
        return null;
    }

    function _rfLonLatFromMapCoord(coord) {
        if (!coord || !window.ol || !ol.proj) return null;
        try {
            if (typeof ol.proj.toLonLat === 'function') {
                var ll = ol.proj.toLonLat(coord);
                if (ll && ll.length >= 2) return { lon: ll[0], lat: ll[1] };
            }
        } catch (e) {}
        try {
            if (typeof ol.proj.transform === 'function') {
                var ll2 = ol.proj.transform(coord, 'EPSG:3857', 'EPSG:4326');
                if (ll2 && ll2.length >= 2) return { lon: ll2[0], lat: ll2[1] };
            }
        } catch (e) {}
        return null;
    }

    function _rfGetCurrentMapSnapshot() {
        var m = _rfOLMap();
        if (!m || !m.getView) return null;
        var v = m.getView();
        var c = v.getCenter();
        var ll = _rfLonLatFromMapCoord(c);
        if (!ll) return null;
        return { lat: ll.lat, lon: ll.lon, zoom: v.getZoom() };
    }

    function _rfPlaneLatLon(plane) {
        if (!plane) return null;
        if (plane.position && plane.position.length >= 2) {
            var a = +plane.position[0], b = +plane.position[1];
            if (!isNaN(a) && !isNaN(b) && Math.abs(a) <= 180 && Math.abs(b) <= 90) return { lat: b, lon: a };
            if (!isNaN(a) && !isNaN(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180) return { lat: a, lon: b };
        }
        var lat = +plane.lat, lon = +plane.lon;
        if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat: lat, lon: lon };
        return null;
    }

    function _rfSaveAutoFitView() {
        if (_autoFitSavedView) return;
        var m = _rfOLMap();
        if (!m || !m.getView) return;
        var v = m.getView();
        _autoFitSavedView = { center: v.getCenter().slice(), zoom: v.getZoom() };
    }

    function _rfRestoreAutoFitView() {
        if (!_autoFitSavedView) return;
        var m = _rfOLMap();
        if (m && m.getView) m.getView().animate({ center: _autoFitSavedView.center, zoom: _autoFitSavedView.zoom, duration: _rfAnimDuration(700) });
        _autoFitSavedView = null;
    }

    function _rfAutoFitFilteredPlanes(opts) {
        opts = opts || {};
        var doCenter = opts.autoCenter !== false;
        var doZoom   = opts.autoZoom   !== false;
        var m = _rfOLMap();
        if (!m || !m.getView || !gReady()) return;
        if (!doCenter && !doZoom) return;
        if (!isFilterActive()) { _rfRestoreAutoFitView(); return; }
        _rfSaveAutoFitView();
        var pts = [];
        for (var i = 0; i < g.planesOrdered.length; i++) {
            var p = g.planesOrdered[i];
            if (!planePassesAllFilters(p)) continue;
            var ll = _rfPlaneLatLon(p);
            if (!ll || (ll.lat === 0 && ll.lon === 0)) continue;
            var mc = _rfMapCoordFromLonLat(ll.lon, ll.lat);
            if (mc) pts.push(mc);
        }
        if (!pts.length) return;
        var view = m.getView();
        if (pts.length === 1) {
            var oneOpts = { duration: opts.forceNow ? 650 : 700 };
            if (doCenter) oneOpts.center = pts[0];
            if (doZoom)   oneOpts.zoom   = Math.max(view.getZoom(), 10);
            view.animate(oneOpts);
            return;
        }
        var minX = pts[0][0], minY = pts[0][1], maxX = pts[0][0], maxY = pts[0][1];
        for (var pi = 1; pi < pts.length; pi++) {
            if (pts[pi][0] < minX) minX = pts[pi][0];
            if (pts[pi][1] < minY) minY = pts[pi][1];
            if (pts[pi][0] > maxX) maxX = pts[pi][0];
            if (pts[pi][1] > maxY) maxY = pts[pi][1];
        }
        if (doCenter && doZoom) {
            view.fit([minX, minY, maxX, maxY], { padding: [60, 60, 60, 60], maxZoom: 11, duration: opts.forceNow ? 650 : 700 });
            return;
        }
        var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        var target = { duration: opts.forceNow ? 650 : 700 };
        if (doCenter) target.center = [cx, cy];
        if (doZoom) {
            var z = view.getZoom();
            try {
                var size = (typeof m.getSize === 'function') ? m.getSize() : null;
                if (size && size[0] > 10 && size[1] > 10 && typeof view.getResolutionForExtent === 'function' && typeof view.getZoomForResolution === 'function') {
                    var pad = 60;
                    var fitW = Math.max(20, size[0] - (pad * 2));
                    var fitH = Math.max(20, size[1] - (pad * 2));
                    var res = view.getResolutionForExtent([minX, minY, maxX, maxY], [fitW, fitH]);
                    if (typeof res === 'number' && res > 0) {
                        var zFit = view.getZoomForResolution(res);
                        if (typeof zFit === 'number' && !isNaN(zFit)) z = zFit;
                    }
                }
            } catch (e) {}
            if (z < 2) z = 2;
            if (z > 19) z = 19;
            target.zoom = z;
        }
        view.animate(target);
    }

    function _rfPanToIcaos(icaos) {
        if (!icaos || !icaos.length) return;
        if (_rfAnyActiveViewMapEnabled()) return;
        var m = _rfOLMap();
        if (!m || !g || !g.planesOrdered) return;
        var icaoSet = new Set(icaos.map(function(ic){ return (ic || '').toUpperCase(); }));
        var pts = [];
        for (var pti = 0; pti < g.planesOrdered.length; pti++) {
            var pp = g.planesOrdered[pti];
            if (!icaoSet.has((pp.icao || '').toUpperCase())) continue;
            var ll = _rfPlaneLatLon(pp);
            if (ll && (ll.lat !== 0 || ll.lon !== 0)) {
                var mc = _rfMapCoordFromLonLat(ll.lon, ll.lat);
                if (mc) pts.push(mc);
            }
        }
        if (!pts.length) return;
        var view = m.getView();
        if (!view) return;
        if (pts.length === 1) {
            view.animate({ center: pts[0], zoom: Math.max(view.getZoom(), 10), duration: _rfAnimDuration(600) });
        } else {
            var mnX = pts[0][0], mnY = pts[0][1], mxX = pts[0][0], mxY = pts[0][1];
            for (var ei = 1; ei < pts.length; ei++) {
                if (pts[ei][0] < mnX) mnX = pts[ei][0];
                if (pts[ei][1] < mnY) mnY = pts[ei][1];
                if (pts[ei][0] > mxX) mxX = pts[ei][0];
                if (pts[ei][1] > mxY) mxY = pts[ei][1];
            }
            view.fit([mnX, mnY, mxX, mxY], { padding: [60, 60, 60, 60], maxZoom: 11, duration: _rfAnimDuration(600) });
        }
    }

    function _rfSaveSelectionMapView() {
        if (_selectionMapViewSaved) return;
        var m = _rfOLMap();
        if (!m || !m.getView) return;
        var v = m.getView();
        _selectionMapViewSaved = { center: v.getCenter().slice(), zoom: v.getZoom() };
    }

    function _rfRestoreSelectionMapView() {
        if (!_selectionMapViewSaved) return;
        var m = _rfOLMap();
        if (m && m.getView) {
            m.getView().animate({
                center: _selectionMapViewSaved.center,
                zoom: _selectionMapViewSaved.zoom,
                duration: _rfAnimDuration(650)
            });
        }
        _selectionMapViewSaved = null;
    }

    function _rfGetScopedFilteredIcaos(limit) {
        var out = [];
        if (!gReady()) return out;
        var max = typeof limit === 'number' ? limit : 300;
        for (var i = 0; i < g.planesOrdered.length; i++) {
            var p = g.planesOrdered[i];
            if (!p || !p.icao) continue;
            if (_panelScope === 'inview' && !p.inView) continue;
            if (_panelScope === 'filtered' && !planePassesAllFilters(p, null)) continue;
            if (!planePassesAllFilters(p, null)) continue;
            out.push((p.icao || '').toUpperCase());
            if (out.length >= max) break;
        }
        return out;
    }

    function _rfGetSelectionTargetIcaos() {
        if (_alertsSelectedIcaos.size > 0) return Array.from(_alertsSelectedIcaos);
        if (_sumFilter.size > 0) return Array.from(_sumFilter);
        if (!isFilterActive()) return [];
        return _rfGetScopedFilteredIcaos(300);
    }

    function _rfSyncSelectionMapView() {
        if (settings.selectionAutoCenter === false) return;
        if (_rfAnyActiveViewMapEnabled()) return;
        var icaos = _rfGetSelectionTargetIcaos();
        if (!icaos.length) { _rfRestoreSelectionMapView(); return; }
        _rfSaveSelectionMapView();
        _rfPanToIcaos(icaos);
    }

    function _rfGetReceiverPos() {
        try {
            var m = _rfOLMap();
            if (!m) throw new Error('no map');
            var c = m.getView().getCenter();
            if (window.ol && ol.proj && ol.proj.toLonLat) {
                var ll = ol.proj.toLonLat(c);
                if (!isNaN(ll[1]) && Math.abs(ll[1]) <= 90 && Math.abs(ll[0]) <= 180) {
                    return { lat: ll[1], lon: ll[0] };
                }
            }
        } catch(e) {}
        try { if (typeof SiteLat !== 'undefined' && SiteLat) return { lat: +SiteLat, lon: +SiteLon }; } catch(e) {}
        try { if (typeof g !== 'undefined' && g.SitePosition && g.SitePosition.lat) return { lat: g.SitePosition.lat, lon: g.SitePosition.lng }; } catch(e) {}
        return { lat: 0, lon: 0 };
    }

    // ── Home position helpers ─────────────────────────────────────────────────

    function _rfDetectHomePos() {
        try {
            if (typeof SiteLat !== 'undefined' && typeof SiteLon !== 'undefined') {
                var slat = +SiteLat, slon = +SiteLon;
                if (!isNaN(slat) && !isNaN(slon) && Math.abs(slat) <= 90 && Math.abs(slon) <= 180) {
                    return { lat: slat, lon: slon, source: 'tar1090 site' };
                }
            }
        } catch (e) {}
        try {
            if (typeof g !== 'undefined' && g.SitePosition) {
                var glat = +g.SitePosition.lat, glon = +g.SitePosition.lng;
                if (!isNaN(glat) && !isNaN(glon) && Math.abs(glat) <= 90 && Math.abs(glon) <= 180) {
                    return { lat: glat, lon: glon, source: 'g.SitePosition' };
                }
            }
        } catch (e) {}
        return null;
    }

    function _rfGetHomeConfig() {
        var detected = _rfDetectHomePos();
        var lat = detected ? detected.lat : null;
        var lon = detected ? detected.lon : null;
        var src = detected ? detected.source : 'not detected';
        if (settings.homeOverride) {
            var olat = parseFloat(settings.homeLat), olon = parseFloat(settings.homeLon);
            if (!isNaN(olat) && !isNaN(olon) && Math.abs(olat) <= 90 && Math.abs(olon) <= 180) {
                lat = olat; lon = olon; src = 'override';
            }
        }
        var z = parseInt(settings.homeZoom, 10);
        if (isNaN(z)) z = 12;
        if (z < 2) z = 2;
        if (z > 19) z = 19;
        return { lat: lat, lon: lon, zoom: z, source: src, detected: detected };
    }

    function _rfCenterHome(useConfiguredZoom) {
        var m = _rfOLMap();
        if (!m || !m.getView) return;
        var hc = _rfGetHomeConfig();
        if (hc.lat === null || hc.lon === null) return;
        var c = _rfMapCoordFromLonLat(hc.lon, hc.lat);
        if (!c) return;
        var v = m.getView();
        var targetZoom = useConfiguredZoom ? hc.zoom : Math.max(v.getZoom(), hc.zoom);
        v.animate({ center: c, zoom: targetZoom, duration: _rfAnimDuration(700) });
    }

    // ── Map view behavior from saved views ────────────────────────────────────

    function _rfNormalizeViewMap(mapCfg) {
        var d = _rfDefaultViewMap();
        if (!mapCfg || typeof mapCfg !== 'object') return d;
        return {
            enabled:        typeof mapCfg.enabled        === 'boolean' ? mapCfg.enabled        : d.enabled,
            mode:           mapCfg.mode === 'fixed' || mapCfg.mode === 'dynamic' ? mapCfg.mode : d.mode,
            autoCenter:     typeof mapCfg.autoCenter     === 'boolean' ? mapCfg.autoCenter     : d.autoCenter,
            autoZoom:       typeof mapCfg.autoZoom       === 'boolean' ? mapCfg.autoZoom       : d.autoZoom,
            fixedCenterLat: typeof mapCfg.fixedCenterLat === 'number'  ? mapCfg.fixedCenterLat : d.fixedCenterLat,
            fixedCenterLon: typeof mapCfg.fixedCenterLon === 'number'  ? mapCfg.fixedCenterLon : d.fixedCenterLon,
            fixedZoom:      typeof mapCfg.fixedZoom      === 'number'  ? mapCfg.fixedZoom      : d.fixedZoom
        };
    }

    function _rfEnsureViewShape(v) {
        if (!v) return;
        if (!v.map || typeof v.map !== 'object') v.map = _rfDefaultViewMap();
        if (typeof v.map.enabled        !== 'boolean') v.map.enabled        = false;
        if (typeof v.map.mode           !== 'string')  v.map.mode           = 'dynamic';
        if (typeof v.map.autoCenter     !== 'boolean') v.map.autoCenter     = true;
        if (typeof v.map.autoZoom       !== 'boolean') v.map.autoZoom       = true;
        if (typeof v.map.fixedCenterLat !== 'number')  v.map.fixedCenterLat = null;
        if (typeof v.map.fixedCenterLon !== 'number')  v.map.fixedCenterLon = null;
        if (typeof v.map.fixedZoom      !== 'number')  v.map.fixedZoom      = null;
    }

    function _rfAnyActiveViewMapEnabled() {
        var avs = _rfGetActiveViews();
        for (var i = 0; i < avs.length; i++) {
            _rfEnsureViewShape(avs[i]);
            if (avs[i].map && avs[i].map.enabled) return true;
        }
        return false;
    }

    function _rfApplyMapBehaviorConfig(mapCfg, forceNow) {
        var cfg = _rfNormalizeViewMap(mapCfg);
        if (!cfg.enabled) return;
        var m = _rfOLMap();
        if (!m || !m.getView) return;
        var v = m.getView();
        if (cfg.mode === 'fixed') {
            if (cfg.fixedCenterLat === null || cfg.fixedCenterLon === null || cfg.fixedZoom === null) return;
            var fc = _rfMapCoordFromLonLat(cfg.fixedCenterLon, cfg.fixedCenterLat);
            if (!fc) return;
            v.animate({ center: fc, zoom: cfg.fixedZoom, duration: _rfAnimDuration(forceNow ? 650 : 500) });
            return;
        }
        if (!cfg.autoCenter && !cfg.autoZoom) return;
        _rfAutoFitFilteredPlanes({ autoCenter: cfg.autoCenter, autoZoom: cfg.autoZoom, forceNow: !!forceNow });
    }

    function _rfApplyActiveViewsMapBehavior(forceNow) {
        var avs = _rfGetActiveViews();
        if (!avs.length) return false;
        var m = _rfOLMap();
        if (!m || !m.getView) return false;
        var view = m.getView();
        var mapEnabled = [], fixedPts = [];
        for (var i = 0; i < avs.length; i++) {
            _rfEnsureViewShape(avs[i]);
            var cfg = _rfNormalizeViewMap(avs[i].map);
            if (!cfg.enabled) continue;
            mapEnabled.push(cfg);
            if (cfg.mode === 'fixed' && cfg.fixedCenterLat !== null && cfg.fixedCenterLon !== null) {
                var mc = _rfMapCoordFromLonLat(cfg.fixedCenterLon, cfg.fixedCenterLat);
                if (mc) fixedPts.push(mc);
            }
        }
        if (!mapEnabled.length) return true;
        if (fixedPts.length >= 2) {
            var mnX = fixedPts[0][0], mnY = fixedPts[0][1], mxX = fixedPts[0][0], mxY = fixedPts[0][1];
            for (var fi = 1; fi < fixedPts.length; fi++) {
                if (fixedPts[fi][0] < mnX) mnX = fixedPts[fi][0];
                if (fixedPts[fi][1] < mnY) mnY = fixedPts[fi][1];
                if (fixedPts[fi][0] > mxX) mxX = fixedPts[fi][0];
                if (fixedPts[fi][1] > mxY) mxY = fixedPts[fi][1];
            }
            view.fit([mnX, mnY, mxX, mxY], { padding: [70, 70, 70, 70], maxZoom: 11, duration: _rfAnimDuration(forceNow ? 650 : 700) });
            return true;
        }
        if (fixedPts.length === 1) {
            var z = view.getZoom();
            if (mapEnabled[0].mode === 'fixed' && typeof mapEnabled[0].fixedZoom === 'number' && !isNaN(mapEnabled[0].fixedZoom)) {
                z = Math.max(2, Math.min(19, mapEnabled[0].fixedZoom));
            }
            view.animate({ center: fixedPts[0], zoom: z, duration: forceNow ? 650 : 700 });
            return true;
        }
        _rfApplyMapBehaviorConfig(mapEnabled[0], !!forceNow);
        return true;
    }

    // ── Leaflet mini-map helpers ──────────────────────────────────────────────

    function _rfLoadLeaflet(cb) {
        if (window.L && _leafletReady) { cb(); return; }
        var link = document.createElement('link');
        link.rel  = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
        var s = document.createElement('script');
        s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        s.onload = function() {
            _leafletReady = true;
            if (window.L && L.Icon && L.Icon.Default) {
                delete L.Icon.Default.prototype._getIconUrl;
                L.Icon.Default.mergeOptions({
                    iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                    shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
                });
            }
            cb();
        };
        document.head.appendChild(s);
    }

    function _rfUpdateDistMapPin(lat, lon) {
        if (!_distMap) return;
        var radiusNm = parseFloat(_distanceForm.radiusNm) || 50;
        var radiusM  = radiusNm * 1852;
        if (_distMapMarker) {
            _distMapMarker.setLatLng([lat, lon]);
        } else {
            _distMapMarker = L.circleMarker([lat, lon], {
                radius: 7, color: '#fff', fillColor: '#00596b', fillOpacity: 1, weight: 2
            }).addTo(_distMap);
        }
        if (_distMapCircle) {
            _distMapCircle.setLatLng([lat, lon]);
            _distMapCircle.setRadius(radiusM);
        } else {
            _distMapCircle = L.circle([lat, lon], {
                radius: radiusM, color: '#00596b', fillColor: '#00596b', fillOpacity: 0.08, weight: 2
            }).addTo(_distMap);
        }
    }

    function _rfInitDistMap() {
        if (!_leafletReady) { _rfLoadLeaflet(function() { _rfInitDistMap(); }); return; }
        var container = document.getElementById('rf-dist-map');
        if (!container) return;
        var savedZoom = _distanceForm.mapZoom || 8;
        if (_distMap) {
            savedZoom = _distMap.getZoom();
            _distanceForm.mapZoom = savedZoom;
            try { _distMap.remove(); } catch(e) {}
            _distMap = null; _distMapMarker = null; _distMapCircle = null;
        }
        var lat = parseFloat(_distanceForm.lat);
        var lon = parseFloat(_distanceForm.lon);
        if (isNaN(lat) || isNaN(lon)) {
            var rp = _rfGetReceiverPos();
            lat = rp.lat; lon = rp.lon;
        }
        _distMap = L.map(container, {
            zoomControl: true, attributionControl: false, scrollWheelZoom: true
        }).setView([lat, lon], savedZoom);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19, subdomains: 'abc'
        }).addTo(_distMap);
        if (!isNaN(parseFloat(_distanceForm.lat))) _rfUpdateDistMapPin(lat, lon);
        _distMap.on('click', function(e) {
            var clat = e.latlng.lat, clon = e.latlng.lng;
            _distanceForm.lat = clat.toFixed(5);
            _distanceForm.lon = clon.toFixed(5);
            _rfUpdateDistMapPin(clat, clon);
            var coordEl = document.getElementById('rf-dist-coords');
            if (coordEl) coordEl.textContent = clat.toFixed(5) + ', ' + clon.toFixed(5);
        });
    }

    // ── Distance zone OL overlay ──────────────────────────────────────────────

    function _rfGeodesicPoly(lat, lon, radiusM, npts) {
        try {
            if (typeof TAR !== 'undefined' && TAR.utils &&
                typeof TAR.utils.make_geodesic_circle === 'function') {
                var g2 = TAR.utils.make_geodesic_circle([lon, lat], radiusM, npts);
                g2.transform('EPSG:4326', 'EPSG:3857');
                return g2;
            }
        } catch (e) {}
        var R = 6371008.8;
        var d = radiusM / R;
        var la = lat * Math.PI / 180;
        var lo = lon * Math.PI / 180;
        var pts = [];
        for (var i = 0; i <= npts; i++) {
            var b   = (i * 2 * Math.PI) / npts;
            var la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
            var lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la),
                                      Math.cos(d) - Math.sin(la) * Math.sin(la2));
            pts.push(ol.proj.fromLonLat([lo2 * 180 / Math.PI, la2 * 180 / Math.PI]));
        }
        return new ol.geom.LineString(pts);
    }

    var ZONE_COLORS_OL = ['#00c8e6','#f0e040','#e040fb','#69f080','#ff9800','#ff4444'];
    var ZONE_FILLS_OL  = [
        'rgba(0,200,230,0.05)','rgba(240,224,64,0.05)','rgba(224,64,251,0.05)',
        'rgba(105,240,128,0.05)','rgba(255,152,0,0.05)','rgba(255,68,68,0.05)'
    ];

    function _rfBuildZoneFeatures(src, zones) {
        (zones || _distanceZones).forEach(function(zone, i) {
            var color   = ZONE_COLORS_OL[i % ZONE_COLORS_OL.length];
            var fill    = ZONE_FILLS_OL [i % ZONE_FILLS_OL.length];
            var radiusM = zone.radiusNm * 1852;
            var center  = ol.proj.fromLonLat([zone.lon, zone.lat]);
            var ringGeom = _rfGeodesicPoly(zone.lat, zone.lon, radiusM, 90);
            var ringFeat = new ol.Feature({ geometry: ringGeom });
            ringFeat.set('_rfDist', true);
            ringFeat.setStyle(new ol.style.Style({
                stroke: new ol.style.Stroke({ color: color, width: 2, lineDash: [10, 5] }),
                fill:   new ol.style.Fill  ({ color: fill })
            }));
            var dotFeat = new ol.Feature({ geometry: new ol.geom.Point(center) });
            dotFeat.set('_rfDist', true);
            dotFeat.setStyle(new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 5,
                    fill:   new ol.style.Fill  ({ color: color }),
                    stroke: new ol.style.Stroke({ color: '#fff', width: 1.5 })
                })
            }));
            var lbl = zone.name + '\n' + zone.radiusNm + ' NM';
            var lblFeat = new ol.Feature({ geometry: new ol.geom.Point(center) });
            lblFeat.set('_rfDist', true);
            lblFeat.setStyle(new ol.style.Style({
                text: new ol.style.Text({
                    text: lbl, font: 'bold 12px sans-serif',
                    fill:   new ol.style.Fill  ({ color: '#fff' }),
                    stroke: new ol.style.Stroke({ color: 'rgba(0,0,0,0.75)', width: 3 }),
                    offsetY: 20, textAlign: 'center'
                })
            }));
            var latRad = zone.lat * Math.PI / 180;
            var cosLat = Math.cos(latRad);
            var bearingDirs = [
                { label: 'N', dx: 0,       dy: radiusM  },
                { label: 'E', dx: radiusM,  dy: 0        },
                { label: 'S', dx: 0,       dy: -radiusM },
                { label: 'W', dx: -radiusM, dy: 0        }
            ];
            var bearingFeats = [];
            bearingDirs.forEach(function(bd) {
                var ox = bd.dx;
                var oy = (cosLat > 0.01) ? (bd.dy / cosLat) : bd.dy;
                var bPt = [center[0] + ox, center[1] + oy];
                var bFeat = new ol.Feature({ geometry: new ol.geom.Point(bPt) });
                bFeat.set('_rfDist', true);
                bFeat.setStyle(new ol.style.Style({
                    text: new ol.style.Text({
                        text: bd.label, font: 'bold 11px sans-serif',
                        fill: new ol.style.Fill({ color: color }),
                        stroke: new ol.style.Stroke({ color: 'rgba(0,0,0,0.7)', width: 2 }),
                        textAlign: 'center', textBaseline: 'middle'
                    })
                }));
                bearingFeats.push(bFeat);
            });
            src.addFeatures([ringFeat, dotFeat, lblFeat].concat(bearingFeats));
        });
    }

    function _rfRemoveDistFeatures(src) {
        try {
            var rem = src.getFeatures().filter(function(f) { return f.get('_rfDist'); });
            rem.forEach(function(f) { src.removeFeature(f); });
        } catch(e) {}
    }

    function _rfDrawDistOnMainMap() {
        var _zonesToDraw = _rfAllActiveViewZones();
        if (_zonesToDraw.length === 0) { _rfClearDistOnMainMap(); return; }
        try {
            if (!window.ol || !gReady()) return;
            var src = null;
            if (!_distOLSource) {
                _distOLSource = new ol.source.Vector({ wrapX: false });
                _distOLLayer  = new ol.layer.Vector({ source: _distOLSource, zIndex: 9999, renderOrder: null });
                var added = false;
                try {
                    if (typeof layers !== 'undefined' && layers && typeof layers.push === 'function') {
                        layers.push(_distOLLayer); added = true;
                    }
                } catch(e1) {}
                if (!added) {
                    try {
                        var m = _rfOLMap();
                        if (m) { m.addLayer(_distOLLayer); added = true; }
                    } catch(e2) {}
                }
                if (!added) { _distOLSource = null; _distOLLayer = null; }
            }
            if (_distOLSource) { _distOLSource.clear(); src = _distOLSource; }
            if (!src) {
                try {
                    if (typeof siteCircleFeatures !== 'undefined' && siteCircleFeatures) {
                        _rfRemoveDistFeatures(siteCircleFeatures);
                        src = siteCircleFeatures;
                    }
                } catch(e3) {}
            }
            if (!src) return;
            _rfBuildZoneFeatures(src, _zonesToDraw);
            try { var m2 = _rfOLMap(); if (m2) m2.render(); } catch(e) {}
        } catch(e) { console.warn('[RF] dist OL overlay error:', e); }
    }

    function _rfClearDistOnMainMap() {
        try { if (_distOLSource) _distOLSource.clear(); } catch(e) {}
        try {
            if (typeof siteCircleFeatures !== 'undefined' && siteCircleFeatures) {
                _rfRemoveDistFeatures(siteCircleFeatures);
            }
        } catch(e) {}
    }

    // ── Clear helpers ─────────────────────────────────────────────────────────

    function _rfCallIfFn(name, arg) {
        try { var f = (typeof window !== 'undefined' && typeof window[name] === 'function') ? window[name] : null; if (f) f(arg); } catch (e) {}
    }

    function _rfClearSelectedAircraftInTar1090() {
        _rfCallIfFn('selectPlaneByHex', null);
        _rfCallIfFn('selectPlaneByICAO', null);
        _rfCallIfFn('selectPlaneByIcao', null);
        _rfCallIfFn('setSelectedPlane', null);
        _rfCallIfFn('setSelectedIcao', null);
        _rfCallIfFn('selectPlane', null);
        try { if (window && window.hasOwnProperty('SelectedPlane')) window.SelectedPlane = null; } catch (e) {}
        try { if (window && window.hasOwnProperty('selectedPlane')) window.selectedPlane = null; } catch (e) {}
        _rfCallIfFn('refreshSelected', undefined);
        _rfCallIfFn('refreshSelectedPlane', undefined);
        try {
            var ib = document.getElementById('selected_infoblock');
            if (ib) {
                var closeBtn = ib.querySelector('.close, .closeButton, .infoblockClose, .btn-close');
                if (!closeBtn) {
                    var btns = ib.querySelectorAll('button');
                    for (var bi = 0; bi < btns.length; bi++) {
                        var t = ((btns[bi].textContent || '') + '').trim();
                        if (t === '\xd7' || t === '\u2715' || t === '\u2716' || t === 'X') { closeBtn = btns[bi]; break; }
                    }
                }
                if (closeBtn) closeBtn.click();
            }
        } catch (e) {}
    }

    function _rfClear() {
        Object.values(_tabState).forEach(function (s) { s.items.clear(); });
        _tabState.aircraft.catFilter.clear();
        _tabState.aircraft.regCountryFilter = '';
        _alertsMapFilter      = false;
        _alertsMapFilterIcaos = null;
        _alertsSelectedIcaos.clear();
        _distanceZones = [];
        _sumFilter.clear();
        var rk = Object.keys(_rangesFilter);
        for (var ri = 0; ri < rk.length; ri++) _rangesFilter[rk[ri]] = '';
        _watchlistMapFilter = false;
        _rfClearSelectedAircraftInTar1090();
        _rfRestoreMapView();
        _rfRestoreSelectionMapView();
        applyFilter();
        buildPanel();
    }

    function _rfClosePanel() {
        _panelOpen = false;
        var panel = document.getElementById('rf-panel');
        if (panel) panel.style.display = 'none';
        _rfClearMapInset();
        if (settings.displayMode === 'sidebar') _rfNudgeMainMapResize();
        try { _rfUpdateHeaderBtns(); } catch (e) {}
    }

    function _rfOnSearch(val) {
        _rfDataDirty = true;
        buildPanel();
    }

    // ── Single-tab nav strip ──────────────────────────────────────────────────

    function _rfRenderSingleTabNav() {
        var navEl = document.getElementById('rf-single-tab-nav');
        if (!navEl) return;
        if (!_rfSingleTabMode) {
            navEl.style.display = 'none';
            return;
        }
        navEl.style.display = 'flex';
        var html = '';
        // RF settings always shown
        html += '<button class="rf-stn-btn' + (_activeTab === 'settings' ? ' rf-stn-active' : '') + '" onclick="window._rfSwitchTabSingle(\'settings\')" title="Settings">&#9881;</button>';
        // Filter tabs that are visible
        var tabOrder = [
            { key: 'summary',   code: 'RS' },
            { key: 'airports',  code: 'RA' },
            { key: 'countries', code: 'RC' },
            { key: 'operators', code: 'RO' },
            { key: 'aircraft',  code: 'RP' },
            { key: 'alerts',    code: 'RL' },
            { key: 'distance',  code: 'RD' },
            { key: 'ranges',    code: 'RG' },
            { key: 'views',     code: 'RV' },
        ];
        tabOrder.forEach(function (t) {
            if (!_tabVisibility[t.key] && t.key !== 'views') return;
            var hasFilter = _rfTabHasActiveFilter(t.key);
            html += '<button class="rf-stn-btn' + (_activeTab === t.key ? ' rf-stn-active' : '') + (hasFilter ? ' rf-stn-has-filter' : '') + '" onclick="window._rfSwitchTabSingle(\'' + t.key + '\')" title="' + t.code + '">' + t.code + '</button>';
        });
        navEl.innerHTML = html;
    }

    window._rfSwitchTabSingle = function (tab) {
        _rfApplySingleTabMode(true, tab);
        _activeTab = tab;
        var searchEl = document.getElementById('rf-search');
        if (searchEl) searchEl.value = '';
        applyFilter();
        buildPanel();
        _rfUpdateHeaderBtns();
    };

    // ── Panel build main dispatcher ───────────────────────────────────────────

    function buildPanel() {
        var tab = _activeTab;
        if (tab === 'watchlist') {
            tab = 'summary';
            _activeTab = 'summary';
        }
        // Show/hide tab strip and resize button based on single-tab mode
        var tabsEl   = document.getElementById('rf-tabs');
        var resizeEl = document.getElementById('rf-resize-handle');
        var qbtnEl   = document.getElementById('rf-view-quick-btn');
        if (tabsEl)   tabsEl.style.display   = _rfSingleTabMode ? 'none' : '';
        if (resizeEl) resizeEl.style.display  = _rfSingleTabMode ? 'none' : '';
        if (qbtnEl)   qbtnEl.style.display    = _rfSingleTabMode ? 'none' : '';
        _rfRenderSingleTabNav();
        _rfRenderScopeHeader();

        if (tab === 'summary') { buildSummaryPanel(); return; }
        if (tab === 'settings') { buildSettingsPanel(); return; }
        if (tab === 'distance') { buildDistancePanel(); return; }
        if (tab === 'views')    { buildViewsPanel();    return; }
        if (tab === 'alerts')   { buildAlertsPanel();   return; }

        if (tab === 'ranges') {
            buildBreadcrumb();
            var searchEl3 = document.getElementById('rf-search');
            if (searchEl3) searchEl3.style.display = 'none';
            var ctrlEl3 = document.getElementById('rf-controls');
            if (ctrlEl3) ctrlEl3.innerHTML = '';
            var hdrEl3 = document.getElementById('rf-colheader');
            if (hdrEl3) hdrEl3.innerHTML = '';
            var listEl3 = document.getElementById('rf-list');
            if (listEl3) listEl3.innerHTML = _rfRenderRangesTab();
            var statusEl3 = document.getElementById('rf-status');
            if (statusEl3 && gReady()) {
                var rngCount = 0;
                for (var rci = 0; rci < g.planesOrdered.length; rci++) {
                    if (planePassesRangesFilter(g.planesOrdered[rci])) rngCount++;
                }
                statusEl3.textContent = rngCount + ' aircraft pass range filters';
            }
            var btn3 = document.getElementById('rf-btn');
            if (btn3) btn3.className = 'button ' + (isFilterActive() ? 'activeButton' : 'inActiveButton');
            return;
        }

        // List tabs: airports / countries / operators / aircraft
        var searchEl2 = document.getElementById('rf-search');
        if (searchEl2) searchEl2.style.display = '';

        var data     = getAircraftData(tab);
        var cur      = _tabState[tab] || _tabState.airports;
        var hasDirection = (tab === 'airports' || tab === 'countries');

        buildBreadcrumb();

        var ctrlEl = document.getElementById('rf-controls');
        if (ctrlEl) {
            if (hasDirection) {
                ctrlEl.innerHTML =
                    '<div class="rf-direction">' +
                    ['from', 'both', 'to'].map(function (d) {
                        var active = cur.direction === d ? ' rf-dir-active' : '';
                        var label  = d === 'both' ? 'Both' : d.charAt(0).toUpperCase() + d.slice(1);
                        return '<button class="rf-dir-btn' + active + '" onclick="window._rfSetDirection(\'' + d + '\')">' + label + '</button>';
                    }).join('') +
                    '</div>';
            } else if (tab === 'aircraft') {
                var catHtml = '<div class="rf-cat-filter">';
                catHtml += '<select class="rf-country-select" onchange="window._rfSetAircraftViewMode(this.value)">' +
                    '<option value="inview"' + ((settings.aircraftViewMode || 'inview') === 'inview' ? ' selected' : '') + '>Aircraft in view</option>' +
                    '<option value="all"' + ((settings.aircraftViewMode || 'inview') === 'all' ? ' selected' : '') + '>All aircraft loaded</option>' +
                    '</select>';
                catHtml += '<select class="rf-country-select" onchange="window._rfSetAircraftSortMode(this.value)">' +
                    '<option value="count"' + ((settings.aircraftSortBy || 'count') === 'count' ? ' selected' : '') + '>Sort: Count</option>' +
                    '<option value="name"' + ((settings.aircraftSortBy || 'count') === 'name' ? ' selected' : '') + '>Sort: Name</option>' +
                    '<option value="distance"' + ((settings.aircraftSortBy || 'count') === 'distance' ? ' selected' : '') + '>Sort: Distance from home</option>' +
                    '</select>';
                catHtml += '<button class="rf-cat-btn' + (cur.catFilter.size === 0 ? ' rf-cat-active' : '') +
                    '" onclick="window._rfSetAircraftCat(0)">All</button>';
                [1,2,3,4,5,6,7].forEach(function (catId) {
                    var info = CATEGORY_INFO[catId];
                    var active = cur.catFilter.has(catId) ? ' rf-cat-active' : '';
                    var cnt = _catCounts[catId] || 0;
                    var cntStr = cnt > 0 ? ' <span class="rf-cat-count">' + cnt + '</span>' : '';
                    catHtml += '<button class="rf-cat-btn' + active +
                        '" onclick="window._rfSetAircraftCat(' + catId + ')">' +
                        info.emoji + ' ' + info.label + cntStr + '</button>';
                });
                catHtml += '</div>';
                if (cur.catFilter.size > 0) {
                    cur.catFilter.forEach(function(catId) {
                        var cInfo = CATEGORY_INFO[catId];
                        catHtml += '<button class="rf-cat-select-all" onclick="window._rfSelectAircraftCat(' + catId + ')">' +
                            'Select All ' + cInfo.label + 's</button>';
                    });
                }
                if (_allRegCountries.size > 0) {
                    var rcSorted = Array.from(_allRegCountries.entries()).sort(function(a, b) { return a[0].localeCompare(b[0]); });
                    var selHtml = '<select class="rf-country-select" onchange="window._rfSetRegCountryFilter(this.value)">';
                    selHtml += '<option value="">All Countries</option>';
                    rcSorted.forEach(function(e) {
                        var selected = cur.regCountryFilter === e[0] ? ' selected' : '';
                        selHtml += '<option value="' + e[0].replace(/"/g, '&quot;') + '"' + selected + '>' +
                            (e[1] ? flagFromIso(e[1]) + ' ' : '') + e[0] + '</option>';
                    });
                    selHtml += '</select>';
                    catHtml += selHtml;
                }
                ctrlEl.innerHTML = catHtml;
            } else {
                ctrlEl.innerHTML = '';
            }
        }

        var dataMap;
        var aircraftNearestByType = {};
        if      (tab === 'airports')  dataMap = data.airports;
        else if (tab === 'operators') dataMap = data.operators;
        else if (tab === 'aircraft') {
            dataMap = new Map();
            if (gReady()) {
                var homeCfg2 = _rfGetHomeConfig();
                var hLat2 = typeof homeCfg2.lat === 'number' ? homeCfg2.lat : null;
                var hLon2 = typeof homeCfg2.lon === 'number' ? homeCfg2.lon : null;
                for (var ai = 0; ai < g.planesOrdered.length; ai++) {
                    var ap = g.planesOrdered[ai];
                    if (!ap) continue;
                    if ((settings.aircraftViewMode || 'inview') === 'inview' && !ap.inView) continue;
                    if (!planePassesAllFilters(ap, 'aircraft')) continue;
                    var tKey = ap.typeLong || ap.icaoType || '';
                    if (!tKey) continue;
                    dataMap.set(tKey, (dataMap.get(tKey) || 0) + 1);
                    if (hLat2 !== null && hLon2 !== null) {
                        var pxy = _rfPlaneLatLon(ap);
                        if (pxy) {
                            var dn = haversineNm(hLat2, hLon2, pxy.lat, pxy.lon);
                            if (aircraftNearestByType[tKey] === undefined || dn < aircraftNearestByType[tKey]) aircraftNearestByType[tKey] = dn;
                        }
                    }
                }
            }
        }
        else                          dataMap = data.countries;

        // Build live plane map
        var livePlaneMap = {};
        var homeCfg = _rfGetHomeConfig();
        var refLat = (homeCfg && typeof homeCfg.lat === 'number') ? homeCfg.lat : null;
        var refLon = (homeCfg && typeof homeCfg.lon === 'number') ? homeCfg.lon : null;
        var distByIcao = {};
        if (gReady()) {
            for (var lpi = 0; lpi < g.planesOrdered.length; lpi++) {
                var lp = g.planesOrdered[lpi];
                if (!lp.icao) continue;
                var lic = lp.icao.toUpperCase();
                livePlaneMap[lic] = lp;
                if (refLat !== null && refLon !== null) {
                    var ppos = _rfPlaneLatLon(lp);
                    if (ppos) distByIcao[lic] = haversineNm(refLat, refLon, ppos.lat, ppos.lon);
                }
            }
        }

        var searchEl5 = document.getElementById('rf-search');
        var search = ((searchEl5 && searchEl5.value) || '').toLowerCase();
        var allEntries = [];
        dataMap.forEach(function (v, k) {
            if (tab === 'aircraft' && cur.catFilter.size > 0) {
                var kPass = true;
                cur.catFilter.forEach(function(catId) {
                    if (catId === 6) { if (!_militaryTypeKeys.has(k)) kPass = false; }
                    else { if (getAircraftCategory(k) !== catId) kPass = false; }
                });
                if (!kPass) return;
            }
            if (!search) { allEntries.push([k, v]); return; }
            if (k.toLowerCase().indexOf(search) >= 0) { allEntries.push([k, v]); return; }
            if (tab === 'airports'  && (_airportLabels.get(k) || '').toLowerCase().indexOf(search) >= 0) { allEntries.push([k, v]); return; }
            if (tab === 'operators' && (getAirlineName(k) || '').toLowerCase().indexOf(search) >= 0)     { allEntries.push([k, v]); return; }
        });

        function sortVal(v) {
            if (v && typeof v === 'object') {
                if (cur.sortBy === 'from') return v.from;
                if (cur.sortBy === 'to')   return v.to;
                return v.from + v.to;
            }
            return v || 0;
        }
        allEntries.sort(function (a, b) {
            if (tab === 'aircraft') {
                var sMode = settings.aircraftSortBy || 'count';
                if (sMode === 'distance') {
                    var ad = aircraftNearestByType[a[0]]; if (ad === undefined) ad = 999999;
                    var bd = aircraftNearestByType[b[0]]; if (bd === undefined) bd = 999999;
                    return ad - bd;
                }
                if (sMode === 'name') {
                    return String(a[0]).toLowerCase().localeCompare(String(b[0]).toLowerCase());
                }
                return (b[1] || 0) - (a[1] || 0);
            }
            if (cur.sortBy === 'name') {
                function lbl(entry) {
                    if (tab === 'airports')  return (_airportLabels.get(entry[0]) || entry[0]).toLowerCase();
                    if (tab === 'operators') return (getAirlineName(entry[0]) || entry[0]).toLowerCase();
                    return entry[0].toLowerCase();
                }
                var cmp = lbl(a).localeCompare(lbl(b));
                return cur.sortDir === 'asc' ? cmp : -cmp;
            }
            var va = sortVal(a[1]), vb = sortVal(b[1]);
            return cur.sortDir === 'asc' ? va - vb : vb - va;
        });

        var hdrEl = document.getElementById('rf-colheader');
        if (hdrEl) {
            function sortBtn(col, lbl) {
                var ind = cur.sortBy === col ? (cur.sortDir === 'desc' ? ' \u25bc' : ' \u25b2') : '';
                return '<span class="rf-col-sort' + (cur.sortBy === col ? ' rf-col-active' : '') +
                    '" onclick="window._rfSetSort(\'' + col + '\')">' + lbl + ind + '</span>';
            }
            if (hasDirection) {
                hdrEl.innerHTML = '<div class="rf-colheader-row">' +
                    sortBtn('name', 'Name') + sortBtn('from', 'Fr') + sortBtn('to', 'To') +
                    '</div>';
            } else if (tab === 'aircraft') {
                hdrEl.innerHTML = '<div class="rf-colheader-row">' +
                    sortBtn('name', 'Name') +
                    '<span class="rf-col-cat-hdr">Country</span>' +
                    '<span class="rf-col-cat-hdr">Category</span>' +
                    sortBtn('count', '#') +
                    '</div>';
            } else {
                hdrEl.innerHTML = '<div class="rf-colheader-row">' +
                    sortBtn('name', 'Name') + sortBtn('count', '#') +
                    '</div>';
            }
        }

        var listEl = document.getElementById('rf-list');
        if (!listEl) return;
        var totalAircraft = g && g.planesOrdered ? g.planesOrdered.length : 0;

        function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

        if (allEntries.length === 0) {
            var base = tab === 'aircraft'
                ? 'No aircraft data yet.'
                : 'No route data yet.\nAircraft routes load gradually\nafter initial connection.';
            var msg = totalAircraft === 0 ? base : 'No matches' + (search ? ' for "' + search + '"' : '');
            listEl.innerHTML = '<div class="rf-empty">' + msg.replace(/\n/g, '<br>') + '</div>';
        } else {
            var html = '';
            for (var j = 0; j < allEntries.length; j++) {
                var key = allEntries[j][0];
                var val = allEntries[j][1];
                var active = cur.items.has(key) ? ' rf-item-active' : '';
                var enc    = encodeURIComponent(key);

                if (hasDirection) {
                    var display, flag = '';
                    if (tab === 'airports') {
                        var aIso2 = _airportIso2.get(key);
                        flag    = aIso2 ? '<span class="rf-flag">' + flagFromIso(aIso2) + '</span>' : '';
                        display = esc(_airportLabels.get(key) || key);
                    } else {
                        var cIso2 = _countryIso2.get(key);
                        flag    = cIso2 ? '<span class="rf-flag">' + flagFromIso(cIso2) + '</span>' : '';
                        display = esc(key);
                    }
                    var fr = val && typeof val === 'object' ? val.from : 0;
                    var to = val && typeof val === 'object' ? val.to   : 0;
                    html += '<div class="rf-item rf-item-multi' + active + '" data-key="' + enc + '" onclick="window._rfToggle(this)">' +
                        flag + '<span class="rf-item-name">' + display + '</span>' +
                        '<span class="rf-item-count">' + fr + '</span>' +
                        '<span class="rf-item-count">' + to + '</span>' +
                        '</div>';
                } else if (tab === 'aircraft') {
                    var catId = getAircraftCategory(key);
                    var info  = CATEGORY_INFO[catId];
                    var rcMap = _aircraftRegCountries.get(key);
                    var flags = '';
                    var dn2 = aircraftNearestByType[key];
                    var ringPct = (typeof dn2 === 'number') ? Math.max(0, Math.min(100, Math.round((1 - Math.min(dn2, 250) / 250) * 100))) : 0;
                    if (rcMap && rcMap.size > 0) {
                        var rcEntries = Array.from(rcMap.entries());
                        rcEntries.slice(0, 4).forEach(function(e) { flags += flagFromIso(e[1]); });
                        if (rcMap.size > 4) flags += '+';
                    }
                    html += '<div class="rf-item rf-item-ac' + active + '" data-key="' + enc + '" onclick="window._rfToggle(this)">' +
                        '<span class="rf-ac-icon">' + info.emoji + '</span>' +
                        '<span class="rf-item-name">' + esc(key) + '</span>' +
                        '<span class="rf-ac-country">' + flags + '</span>' +
                        (info.label ? '<span class="rf-ac-cat" style="color:' + info.color + '">' + info.label + '</span>' : '<span class="rf-ac-cat"></span>') +
                        (typeof dn2 === 'number'
                            ? ('<span class="rf-ac-dist"><span class="rf-ac-dist-ring" style="--rfp:' + ringPct + '"></span>' + dn2.toFixed(1) + 'nm</span>')
                            : '<span class="rf-ac-dist"></span>') +
                        '<span class="rf-item-count">' + val + '</span>' +
                        '</div>';
                } else {
                    var opDisplay = tab === 'operators' ? esc(getAirlineName(key) || key) : esc(key);
                    html += '<div class="rf-item' + active + '" data-key="' + enc + '" onclick="window._rfToggle(this)">' +
                        '<span class="rf-item-name">' + opDisplay + '</span>' +
                        '<span class="rf-item-count">' + val + '</span>' +
                        '</div>';
                }
            }
            listEl.innerHTML = html;
        }

        var statusEl = document.getElementById('rf-status');
        if (statusEl) {
            if (isFilterActive() || _panelScope !== 'all') {
                var matched = 0;
                if (gReady()) {
                    for (var k = 0; k < g.planesOrdered.length; k++) {
                        var plane = g.planesOrdered[k];
                        if (_panelScope === 'inview' && !plane.inView) continue;
                        if (_panelScope === 'filtered' && !planePassesAllFilters(plane, null)) continue;
                        if (planePassesAllFilters(plane, null)) matched++;
                    }
                }
                var scopeLabel = _panelScope !== 'all' ? ' (' + _rfScopeLabel() + ')' : '';
                statusEl.textContent = matched + ' matched' + scopeLabel;
            } else {
                statusEl.textContent = allEntries.length + ' items \u2022 ' + totalAircraft + ' loaded aircraft';
            }
        }

        var btn = document.getElementById('rf-btn');
        if (btn) btn.className = 'button ' + (isFilterActive() ? 'activeButton' : 'inActiveButton');
    }

    // ── Toggle panel ──────────────────────────────────────────────────────────

    function togglePanel() {
        _panelOpen = !_panelOpen;
        var panel = document.getElementById('rf-panel');
        if (!panel) return;
        panel.style.display = _panelOpen ? 'flex' : 'none';
        if (_panelOpen) {
            _rfApplySingleTabMode(false, null);
            applyPanelMode();
            buildPanel();
            if (!_rfDidInitialHomeCenter) {
                _rfDidInitialHomeCenter = true;
                if (settings.homeCenterOnOpen !== false) _rfCenterHome(true);
            }
            if (settings.displayMode === 'sidebar') _rfNudgeMainMapResize();
        } else {
            _rfClearMapInset();
            if (settings.displayMode === 'sidebar') _rfNudgeMainMapResize();
        }
        try { _rfUpdateHeaderBtns(); } catch (e) {}
    }

    // ── DOM injection ─────────────────────────────────────────────────────────

    function inject() {
        var headerSide = document.getElementById('header_side');
        if (!headerSide || document.getElementById('rf-btn')) return;
        _rfProbeStorage();

        var btnContainer = headerSide.querySelector('.buttonContainer') || headerSide;

        // Single wrapper for all RF buttons — allows flex-wrap on small screens
        var rfGroup = document.createElement('div');
        rfGroup.id = 'rf-btn-group';
        btnContainer.appendChild(rfGroup);

        function _rfMakeBtn(id, code, title, onclick) {
            var sp = document.createElement('div');
            sp.className = 'buttonSpacer';
            var b = document.createElement('div');
            b.id        = id;
            b.title     = title;
            b.className = 'button inActiveButton';
            b.onclick   = onclick;
            b.innerHTML = '<span class="buttonText" style="font-size:9px;letter-spacing:-0.5px">' + code + '</span>';
            rfGroup.appendChild(sp);
            rfGroup.appendChild(b);
            return b;
        }

        _rfMakeBtn('rf-btn', 'RF', 'Robs Filters \u2014 open filter panel', function () { _rfOpenToTab(_activeTab || 'summary'); });

        // Deliberately keep tar1090 header clean: RF + RV + RR only.

        _rfMakeBtn('rv-btn', 'RV', 'Robs Views \u2014 quick view selector & cycle', function () { window._rvToggle(); });
        _rfMakeBtn('rr-btn', 'RR', 'Robs Reset \u2014 clear all filters and views', function () { window._rrReset(); });

        var rvPanel = document.createElement('div');
        rvPanel.id = 'rv-panel';
        rvPanel.style.display = 'none';
        document.body.appendChild(rvPanel);

        document.addEventListener('mousedown', function (evt) {
            if (!_rvOpen) return;
            var p = document.getElementById('rv-panel');
            var b = document.getElementById('rv-btn');
            if (!p) return;
            var t = evt.target;
            if (p.contains(t) || (b && b.contains(t))) return;
            window._rvToggle(false);
        });

        var panel = document.createElement('div');
        panel.id = 'rf-panel';
        panel.style.display = 'none';
        panel.innerHTML = [
            '<div class="rf-header" id="rf-drag-handle">',
            '  <span id="rf-header-title">Robs Filters</span>',
            '  <div class="rf-header-actions">',
            '    <button class="rf-resize-handle" id="rf-resize-handle" title="Resize sidebar panel" aria-label="Resize sidebar panel">&#8644;</button>',
            '    <button class="rf-view-quick-btn" id="rf-view-quick-btn" title="Views quick menu" aria-label="Views quick menu" onclick="event.stopPropagation();window._rfToggleViewQuickMenu()">&#128065;</button>',
            '    <button class="rf-close" onclick="window._rfClosePanel()">&#x2715;</button>',
            '  </div>',
            '</div>',
            '<div id="rf-view-quick-menu" class="rf-view-quick-menu" style="display:none"></div>',
            '<div id="rf-single-tab-nav" class="rf-single-tab-nav" style="display:none"></div>',
            '<div id="rf-breadcrumb" class="rf-breadcrumb" style="display:none"></div>',
            '<input id="rf-search" class="rf-search" type="text" placeholder="Search\u2026" oninput="window._rfOnSearch(this.value)">',
            '<div id="rf-scope-global" class="rf-scope-global"></div>',
            '<div id="rf-controls" class="rf-controls"></div>',
            '<div id="rf-colheader" class="rf-colheader"></div>',
            '<div id="rf-list" class="rf-list"></div>',
            '<div class="rf-footer">',
            '  <span id="rf-status" class="rf-status"></span>',
            '  <button class="rf-clear" onclick="window._rfClear()">Clear All</button>',
            '</div>',
        ].join('\n');

        document.body.appendChild(panel);
        makeDraggable(panel, document.getElementById('rf-drag-handle'));
        makeSidebarResizable(panel, document.getElementById('rf-resize-handle'));

        document.addEventListener('mousedown', function(evt) {
            var menu = document.getElementById('rf-view-quick-menu');
            var qbtn = document.getElementById('rf-view-quick-btn');
            if (!menu || menu.style.display !== 'block') return;
            var t = evt.target;
            if (menu.contains(t) || (qbtn && qbtn.contains(t))) return;
            window._rfToggleViewQuickMenu(false);
        });
        document.addEventListener('mousedown', function(evt) {
            if (!_rfTabMenuOpen) return;
            var menu = document.getElementById('rf-tab-menu');
            var btn = document.querySelector('.rf-tabmenu-toggle');
            var t = evt.target;
            if ((menu && menu.contains(t)) || (btn && btn.contains(t))) return;
            window._rfToggleTabMenu(false);
        });

        // Apply tab visibility from loaded state
        Object.keys(_tabVisibility).forEach(function (k) {
            if (!_tabVisibility[k]) {
                var tabEl = document.getElementById('rf-tab-' + k);
                if (tabEl) tabEl.style.display = 'none';
            }
        });

        // Apply initial panel mode
        applyPanelMode();
        if (settings.hideAllScope && _panelScope === 'all') _panelScope = 'inview';

        // Rewire _rfSwitchTab to update tab highlights
        var origSwitch = window._rfSwitchTab;
        window._rfSwitchTab = function (tab) {
            ['summary','views','alerts','airports','operators','aircraft','countries','distance','ranges','settings'].forEach(function (t) {
                var el = document.getElementById('rf-tab-' + t);
                if (el) el.className = 'rf-tab' + (t === tab ? ' rf-tab-active' : '');
            });
            if (typeof origSwitch === 'function') origSwitch(tab);
        };

        // Start auto-refresh timer
        _refreshTimer = setInterval(function () {
            if (_panelOpen) {
                if (_activeTab === 'distance') {
                    var statusEl2 = document.getElementById('rf-status');
                    if (statusEl2 && gReady()) {
                        if (_distanceZones.length > 0) {
                            var cnt2 = 0;
                            for (var ti = 0; ti < g.planesOrdered.length; ti++) {
                                if (planePassesDistanceFilter(g.planesOrdered[ti])) cnt2++;
                            }
                            if (_distanceMode === 'outside')       statusEl2.textContent = cnt2 + ' aircraft outside zone' + (_distanceZones.length > 1 ? 's' : '');
                            else if (_distanceMode === 'maponly') statusEl2.textContent = 'Map only mode (no aircraft filtering)';
                            else                                   statusEl2.textContent = cnt2 + ' aircraft in zone' + (_distanceZones.length > 1 ? 's' : '');
                        } else {
                            statusEl2.textContent = '';
                        }
                    }
                } else if (!_rfIsEditingInputs()) {
                    buildPanel();
                }
            }
            _rfApplyActiveViewsMapBehavior(false);
            if (isFilterActive()) triggerRedraw();
            _rfCheckNotifications();
        }, 3000);

        // Draw any restored distance zones
        if (_distanceZones.length > 0) setTimeout(_rfDrawDistOnMainMap, 800);
    }

    // ── Window globals — public handlers ─────────────────────────────────────

    window._rfToggle = function (el) {
        var key = decodeURIComponent(el.dataset.key);
        var cur = _tabState[_activeTab] || _tabState.airports;
        if (cur.items.has(key)) cur.items.delete(key);
        else cur.items.add(key);
        applyFilter();
        buildPanel();
        _rfSyncSelectionMapView();
    };

    window._rfToggle = window._rfToggle;

    window._rfSwitchTab = function (tab) {
        _rfApplySingleTabMode(false, null);
        _activeTab = tab;
        var searchEl = document.getElementById('rf-search');
        if (searchEl) searchEl.value = '';
        applyFilter();
        buildPanel();
        _rfUpdateHeaderBtns();
    };

    /** Apply or remove single-tab focused mode on the panel. */
    function _rfApplySingleTabMode(single, tab) {
        _rfSingleTabMode = single;
        var panel = document.getElementById('rf-panel');
        if (panel) {
            if (single) panel.classList.add('rf-panel-single');
            else        panel.classList.remove('rf-panel-single');
        }
        var titleEl = document.getElementById('rf-header-title');
        if (titleEl) {
            if (single && tab) {
                var def = null;
                for (var i = 0; i < RF_TAB_BTNS.length; i++) {
                    if (RF_TAB_BTNS[i].key === tab) { def = RF_TAB_BTNS[i]; break; }
                }
                titleEl.textContent = def ? def.title.split(' \u2014 ')[0] : 'Robs Filters';
            } else {
                titleEl.textContent = 'Robs Filters';
            }
        }
    }

    /**
     * Open the RF panel to a specific tab, or toggle it closed if already there.
     * Tab buttons open in single-tab (focused) mode — no tab strip, just the content.
     * Settings opens the full panel.
     */
    function _rfOpenToTab(tab) {
        var single = false;  // always open full panel with tab strip
        if (!_panelOpen) {
            _panelOpen = true;
            var p = document.getElementById('rf-panel');
            if (p) p.style.display = 'flex';
            _rfApplySingleTabMode(single, tab);
            applyPanelMode();
            _activeTab = tab;
            buildPanel();
            if (!_rfDidInitialHomeCenter) {
                _rfDidInitialHomeCenter = true;
                if (settings.homeCenterOnOpen !== false) _rfCenterHome(true);
            }
            if (settings.displayMode === 'sidebar') _rfNudgeMainMapResize();
        } else if (_activeTab === tab && _rfSingleTabMode === single) {
            // Same tab, same mode — close
            _panelOpen = false;
            var p2 = document.getElementById('rf-panel');
            if (p2) p2.style.display = 'none';
            _rfClearMapInset();
            if (settings.displayMode === 'sidebar') _rfNudgeMainMapResize();
        } else {
            // Switch tab (or switch mode for the same tab)
            _rfApplySingleTabMode(single, tab);
            _activeTab = tab;
            var searchEl = document.getElementById('rf-search');
            if (searchEl) searchEl.value = '';
            applyFilter();
            buildPanel();
        }
        _rfUpdateHeaderBtns();
    }

    /** Returns true when a tab has at least one active filter constraint. */
    function _rfTabHasActiveFilter(key) {
        if (key === 'summary')   return _sumFilter.size > 0;
        if (key === 'alerts')    return _alertsSelectedIcaos.size > 0 || !!(_alertsMapFilter && _alertsMapFilterIcaos);
        if (key === 'distance')  return _distanceZones.length > 0;
        if (key === 'ranges')    return _rfRangesFilterActive();
        if (key === 'aircraft') {
            var ac = _tabState.aircraft;
            return ac.items.size > 0 || ac.catFilter.size > 0 || ac.regCountryFilter !== '';
        }
        var ts = _tabState[key];
        return !!(ts && ts.items.size > 0);
    }

    /** Refresh active/inactive state and visibility of all tab shortcut buttons. */
    function _rfUpdateHeaderBtns() {
        // RF button: active when panel is open
        var rfBtn = document.getElementById('rf-btn');
        if (rfBtn) {
            var rfActive = !!_panelOpen;
            rfBtn.className = 'button ' + (rfActive ? 'activeButton' : 'inActiveButton');
        }
    }

    window._rfSetDirection = function (dir) {
        var cur = _tabState[_activeTab];
        if (cur) cur.direction = dir;
        applyFilter();
        buildPanel();
    };

    window._rfSetSort = function (col) {
        var cur = _tabState[_activeTab];
        if (!cur) return;
        if (cur.sortBy === col) {
            cur.sortDir = cur.sortDir === 'desc' ? 'asc' : 'desc';
        } else {
            cur.sortBy  = col;
            cur.sortDir = col === 'name' ? 'asc' : 'desc';
        }
        buildPanel();
    };

    window._rfSetAircraftCat = function (catId) {
        var cf = _tabState.aircraft.catFilter;
        if (catId === 0) {
            cf.clear();
        } else if (cf.has(catId)) {
            cf.delete(catId);
        } else {
            cf.add(catId);
        }
        buildPanel();
        _rfSyncSelectionMapView();
    };

    window._rfSelectAircraftCat = function (catId) {
        var data = getAircraftData();
        data.aircraft.forEach(function (count, key) {
            var match = catId === 6 ? _militaryTypeKeys.has(key) : getAircraftCategory(key) === catId;
            if (match) _tabState.aircraft.items.add(key);
        });
        applyFilter();
        buildPanel();
        _rfSyncSelectionMapView();
    };

    window._rfSetRegCountryFilter = function (val) {
        _tabState.aircraft.regCountryFilter = val;
        applyFilter();
        buildPanel();
        _rfSyncSelectionMapView();
    };

    window._rfSetAircraftViewMode = function (mode) {
        settings.aircraftViewMode = mode === 'all' ? 'all' : 'inview';
        _rfSaveSettings();
        buildPanel();
        _rfSyncSelectionMapView();
    };

    window._rfSetAircraftSortMode = function (mode) {
        if (mode !== 'count' && mode !== 'name' && mode !== 'distance') mode = 'count';
        settings.aircraftSortBy = mode;
        _rfSaveSettings();
        buildPanel();
    };

    window._rfSetPanelScope = function (mode) {
        if (mode !== 'all' && mode !== 'inview' && mode !== 'filtered') mode = 'all';
        if (settings.hideAllScope && mode === 'all') mode = 'inview';
        _panelScope = mode;
        applyFilter();
        buildPanel();
        _rfSyncSelectionMapView();
    };

    window._rfClearTab = function (tab) {
        if (_tabState[tab]) {
            _tabState[tab].items.clear();
            if (tab === 'aircraft') {
                _tabState.aircraft.catFilter.clear();
                _tabState.aircraft.regCountryFilter = '';
            }
        }
        applyFilter();
        buildPanel();
        _rfSyncSelectionMapView();
    };

    window._rfClear       = _rfClear;
    window._rfClosePanel  = _rfClosePanel;
    window._rfOnSearch    = function(val) { _rfOnSearch(val); };

    window._rfHomePick = function () {
        var m = _rfOLMap();
        if (!m) return;
        if (_rfHomePickHandler) {
            try { m.un('singleclick', _rfHomePickHandler); } catch (e) {}
            _rfHomePickHandler = null;
        }
        var statusEl = document.getElementById('rf-status');
        if (statusEl) statusEl.textContent = 'Click once on the map to set Home position';
        var tgt = typeof m.getTargetElement === 'function' ? m.getTargetElement() : null;
        if (tgt && tgt.style) tgt.style.cursor = 'crosshair';
        _rfHomePickHandler = function (evt) {
            var ll = _rfLonLatFromMapCoord(evt && evt.coordinate);
            if (ll && !isNaN(ll.lat) && !isNaN(ll.lon) && Math.abs(ll.lat) <= 90 && Math.abs(ll.lon) <= 180) {
                settings.homeOverride = true;
                settings.homeLat = ll.lat.toFixed(5);
                settings.homeLon = ll.lon.toFixed(5);
                _rfSaveSettings();
                if (_panelOpen && _activeTab === 'settings') buildPanel();
            }
            if (statusEl) statusEl.textContent = '';
            if (tgt && tgt.style) tgt.style.cursor = '';
            try { m.un('singleclick', _rfHomePickHandler); } catch (e) {}
            _rfHomePickHandler = null;
        };
        m.on('singleclick', _rfHomePickHandler);
    };

    window._rfHomeSave = function () {
        _rfSaveSettings();
        buildPanel();
    };

    window._rfHomeCancel = function () {
        if (_rfHomePickHandler) {
            var m = _rfOLMap();
            try { if (m) m.un('singleclick', _rfHomePickHandler); } catch (e) {}
            _rfHomePickHandler = null;
        }
        var statusEl = document.getElementById('rf-status');
        if (statusEl) statusEl.textContent = '';
    };

    window._rfCenterHome = function (useConfiguredZoom) {
        _rfCenterHome(!!useConfiguredZoom);
    };

    window._rfExportSettings = function () {
        try {
            var snap = _rfBuildExportSnapshot();
            var raw = JSON.stringify(snap, null, 2);
            var blob = new Blob([raw], { type: 'application/json' });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            var dt = new Date();
            var ts = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
            a.download = 'rf-settings-' + ts + '.json';
            document.body.appendChild(a);
            a.click();
            setTimeout(function () {
                try { URL.revokeObjectURL(a.href); } catch (e) {}
                try { document.body.removeChild(a); } catch (e) {}
            }, 0);
        } catch (e) { alert('Export failed: ' + e); }
    };

    function _rfBuildPersistDebugPayload() {
        var keys = [
            LS_SETTINGS, LS_SUM_SETTINGS, LS_TAB_VIS, LS_NOTIF, LS_RECORDS,
            LS_VIEWS, LS_RV, LS_DIST_LOCS, LS_DIST_ZONES, LS_DIST_MODE,
            LS_RANGES, LS_WATCHLIST, LS_PERSIST_SNAP
        ];
        var localData = {};
        for (var i = 0; i < keys.length; i++) localData[keys[i]] = _rfLoad(keys[i]);
        var alertsCache = _rfLoad(LS_ALERTS);
        var apiMode = _rfDetectTar1090ApiMode();
        return {
            generatedAt: new Date().toISOString(),
            runtime: {
                panelScope: _panelScope,
                activeTab: _activeTab,
                planesLoaded: gReady() ? g.planesOrdered.length : 0,
                isFilterActive: isFilterActive(),
                apiMode: apiMode
            },
            alerts: {
                dbRowsInMemory: _alertsDb ? _alertsDb.length : 0,
                selectedRows: _alertsSelectedIcaos.size,
                facetFilters: Object.assign({}, _alertsFilters),
                mapFilterApplied: !!_alertsMapFilter,
                cacheKey: LS_ALERTS,
                cacheRows: (alertsCache && alertsCache.data && alertsCache.data.length) ? alertsCache.data.length : 0,
                cacheTimestamp: (alertsCache && alertsCache.ts) ? alertsCache.ts : 0,
                cacheAgeMinutes: (alertsCache && alertsCache.ts) ? Math.round((Date.now() - alertsCache.ts) / 60000) : null
            },
            tar1090Globals: _rfCollectTar1090GlobalsDebug(),
            storageStatus: { localStorage: _rfLocalStorageOk, cookies: _rfCookieOk },
            localStorage: localData,
            cookies: {
                home: _rfCookieGet(LS_HOME_COOKIE),
                persistSnapshotRaw: _rfCookieGet(LS_PERSIST_SNAP)
            }
        };
    }

    window._rfShowPersistData = function () {
        try {
            var payload = _rfBuildPersistDebugPayload();
            var raw = JSON.stringify(payload, null, 2);
            var w = window.open('', 'rf-persist-debug', 'width=980,height=760,resizable=yes,scrollbars=yes');
            if (!w) { alert(raw); return; }
            var esc = function (s) {
                return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            };
            w.document.open();
            w.document.write(
                '<!doctype html><html><head><meta charset="utf-8"><title>RF Persisted Data</title>' +
                '<style>body{margin:0;background:#0f1416;color:#d7ecef;font:12px/1.45 Consolas,monospace}.top{position:sticky;top:0;padding:10px 12px;background:#132026;border-bottom:1px solid #2a3a3e}.top b{color:#bfe6ee}pre{margin:0;padding:12px;white-space:pre-wrap;word-break:break-word}</style>' +
                '</head><body><div class="top"><b>Robs Filters persisted content</b> (localStorage + cookie fallback)</div><pre>' + esc(raw) + '</pre></body></html>'
            );
            w.document.close();
        } catch (e) {
            alert('Could not open persisted data popup: ' + e);
        }
    };

    window._rfImportSettings = function (input) {
        if (!input || !input.files || !input.files[0]) return;
        var file = input.files[0];
        var reader = new FileReader();
        reader.onload = function () {
            try {
                var snap = JSON.parse(String(reader.result || '{}'));
                if (!_rfApplyImportSnapshot(snap)) throw new Error('Invalid snapshot');
                _rfSaveSettings();
                _rfSaveSummarySettings();
                _rfSaveTabVisibility();
                _rfSaveDistance();
                _rfSaveViews();
                applyPanelMode();
                applyFilter();
                buildPanel();
                alert('RF settings imported.');
            } catch (e) {
                alert('Import failed: invalid JSON/settings file');
            }
        };
        reader.readAsText(file);
    };

    window._rfToggleTabVis = function (tab, on) {
        _tabVisibility[tab] = !!on;
        var el = document.getElementById('rf-tab-' + tab);
        if (el) el.style.display = on ? '' : 'none';
        if (tab === 'alerts' && on && !_alertsDb && !_alertsFetching) loadAlerts(false);
        if (tab === 'distance' && !on && _distanceZones.length > 0) {
            _distanceZones = [];
            _rfSaveDistance();
            applyFilter();
        }
        _rfSaveTabVisibility();
        buildPanel();
    };

    window._rfToggleViewQuickMenu = function (force) {
        var menu = document.getElementById('rf-view-quick-menu');
        var qbtn = document.getElementById('rf-view-quick-btn');
        if (!menu || !qbtn) return;
        var show = (typeof force === 'boolean') ? force : (menu.style.display !== 'block');
        menu.style.display = show ? 'block' : 'none';
        qbtn.className = 'rf-view-quick-btn' + (show ? ' rf-view-quick-btn-active' : '');
        if (show) _rfRenderViewQuickMenu();
    };

    window._rfViewsQuickPick = function (elOrId) {
        if (elOrId && typeof elOrId.checked === 'boolean') {
            var all = document.querySelectorAll('#rf-view-quick-menu input.rf-view-quick-check');
            var selected = [];
            if (all) { for (var i = 0; i < all.length; i++) { if (all[i].checked && all[i].value) selected.push(all[i].value); } }
            _rfQuickSelectedViewId = selected.length ? selected[0] : '';
            return;
        }
        _rfQuickSelectedViewId = elOrId || '';
    };

    window._rfViewsApplyQuick = function () {
        var all = document.querySelectorAll('#rf-view-quick-menu input.rf-view-quick-check');
        var selected = [];
        if (all) { for (var i = 0; i < all.length; i++) { if (all[i].checked && all[i].value) selected.push(all[i].value); } }
        if (!selected.length && _rfQuickSelectedViewId) selected = [_rfQuickSelectedViewId];
        if (!selected.length) return;
        window._rfViewsApply(selected[0], false);
        for (var si = 1; si < selected.length; si++) window._rfViewsApply(selected[si], true);
        _rfSyncActiveViewPointers();
        window._rfToggleViewQuickMenu(false);
    };

    window._rfViewsApply = function (id, appendOnly) {
        var v = _rfFindViewById(id);
        if (!v) return;
        _rfEnsureViewShape(v);
        var hasActive = _activeViewIds.length > 0;
        if (!appendOnly || !hasActive) {
            _rfCapturePreViewStateIfNeeded();
            _rfApplyViewState(v.state || {});
        }
        if (!appendOnly) _activeViewIds = [];
        if (_activeViewIds.indexOf(id) < 0) _activeViewIds.push(id);
        _rfSyncActiveViewPointers();
        _activeTab = 'summary';
        applyFilter();
        buildPanel();
    };

    window._rfViewsRemoveActive = function (id) {
        _activeViewIds = _activeViewIds.filter(function (x) { return x !== id; });
        _rfSyncActiveViewPointers();
        if (_activeViewIds.length === 0) _rfRestorePreViewStateIfAny();
        _rfRenderScopeHeader();
        applyFilter();
        if (_panelOpen) buildPanel();
        window._rfToggleViewQuickMenu(false);
    };

    window._rfViewsClearActive = function () {
        _activeViewIds = [];
        _rfSyncActiveViewPointers();
        _rfRestorePreViewStateIfAny();
        _rfQuickSelectedViewId = '';
        _rfRenderScopeHeader();
        applyFilter();
        if (_panelOpen) buildPanel();
        window._rfToggleViewQuickMenu(false);
    };

    window._rfSumFilterIcao = function (icao) {
        icao = (icao || '').toUpperCase();
        if (!_sumFilter.has(icao)) _sumFilter.add(icao);
        else {
            _sumFilter.delete(icao);
            _rfClearSelectedAircraftInTar1090();
        }
        applyFilter();
        buildPanel();
        _rfSyncSelectionMapView();
    };

    window._rfSumFilterIdx = function (idx) {
        var icaos = (_sumClickData[idx] || []);
        _sumFilter.clear();
        if (icaos.length) {
            icaos.forEach(function(ic){ _sumFilter.add((ic || '').toUpperCase()); });
        } else {
            _rfClearSelectedAircraftInTar1090();
        }
        applyFilter();
        buildPanel();
        _rfSyncSelectionMapView();
    };

    window._rfClearSumFilter = function () {
        _sumFilter.clear();
        _rfClearSelectedAircraftInTar1090();
        applyFilter();
        buildPanel();
        _rfSyncSelectionMapView();
    };

    window._rfSetAttentionSort = function (by) {
        if (['distance', 'altitude', 'speed', 'name'].indexOf(by) === -1) return;
        _sumAttentionSort.by = by;
        if (_panelOpen && _activeTab === 'summary') buildPanel();
    };

    window._rfToggleAttentionSortDir = function () {
        _sumAttentionSort.dir = (_sumAttentionSort.dir === 'asc') ? 'desc' : 'asc';
        if (_panelOpen && _activeTab === 'summary') buildPanel();
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // §10 Tab: Summary
    // ═══════════════════════════════════════════════════════════════════════════

    // ── Helper: map country name → ISO2 for flag display ─────────────────────
    function _rfToIso2(countryName) {
        return _toIso2(countryName);
    }

    // ── Session records update (called on each summary render) ────────────────
    function _rfUpdateSessionRecords(planes) {
        var now = new Date().toLocaleDateString();
        var rxLat4 = null, rxLon4 = null;
        try {
            if (typeof SiteLat !== 'undefined' && SiteLat) { rxLat4 = +SiteLat; rxLon4 = +SiteLon; }
            else if (typeof g !== 'undefined' && g.SitePosition) { rxLat4 = g.SitePosition.lat; rxLon4 = g.SitePosition.lng; }
        } catch (e) {}
        var milCount = 0;
        var changed  = false;
        for (var ri = 0; ri < planes.length; ri++) {
            var rp = planes[ri];
            if (isMilitaryAircraft(rp)) milCount++;
            var rAlt = typeof rp.altitude === 'number' ? rp.altitude : (typeof rp.alt_baro === 'number' ? rp.alt_baro : null);
            if (rAlt !== null && rAlt > _sessionRecords.maxAltitude.val) {
                _sessionRecords.maxAltitude = { val: rAlt, icao: rp.icao || '', callsign: rp.flight || rp.icao || '', date: now };
                changed = true;
            }
            if (typeof rp.gs === 'number' && rp.gs > _sessionRecords.maxSpeed.val) {
                _sessionRecords.maxSpeed = { val: Math.round(rp.gs), icao: rp.icao || '', callsign: rp.flight || rp.icao || '', date: now };
                changed = true;
            }
            if (rxLat4 !== null) {
                var rplat, rplon;
                if (rp.position && rp.position.length >= 2) { rplon = +rp.position[0]; rplat = +rp.position[1]; }
                else { rplat = +rp.lat; rplon = +rp.lon; }
                if (!isNaN(rplat) && !isNaN(rplon)) {
                    var rdist = haversineNm(rxLat4, rxLon4, rplat, rplon);
                    if (rdist > _sessionRecords.maxRange.val) {
                        _sessionRecords.maxRange = { val: Math.round(rdist), icao: rp.icao || '', callsign: rp.flight || rp.icao || '', date: now };
                        changed = true;
                    }
                }
            }
        }
        if (planes.length > _sessionRecords.maxAircraft.val) {
            _sessionRecords.maxAircraft = { val: planes.length, date: now };
            changed = true;
        }
        if (milCount > _sessionRecords.maxMilitary.val) {
            _sessionRecords.maxMilitary = { val: milCount, date: now };
            changed = true;
        }
        if (changed) _rfSaveRecords();
    }

    window._rfResetRecords = function () {
        if (!confirm('Reset all session records?')) return;
        _sessionRecords = {
            maxAircraft: { val: 0, date: '' },
            maxMilitary: { val: 0, date: '' },
            maxRange:    { val: 0, icao: '', callsign: '', date: '' },
            maxAltitude: { val: 0, icao: '', callsign: '', date: '' },
            maxSpeed:    { val: 0, icao: '', callsign: '', date: '' }
        };
        _rfSaveRecords();
        buildPanel();
    };

    // ── Summary panel renderer ────────────────────────────────────────────────
    function buildSummaryPanel() {
        buildBreadcrumb();
        var searchEl = document.getElementById('rf-search');
        if (searchEl) searchEl.style.display = 'none';
        var hdrEl = document.getElementById('rf-colheader');
        if (hdrEl) hdrEl.innerHTML = '';
        var ctrlEl = document.getElementById('rf-controls');
        if (ctrlEl) ctrlEl.innerHTML = '';
        var listEl = document.getElementById('rf-list');
        if (!listEl) return;

        _sumClickData = [];

        if (!gReady()) {
            listEl.innerHTML = '<div class="rf-empty">Waiting for aircraft data\u2026</div>';
            return;
        }

        try {
            if (_summarySettings.attention && !_alertsDb && !_alertsFetching) loadAlerts(false);
        } catch (e) {}

        var allPlanes = g.planesOrdered;
        var nowMs     = Date.now();

        // Update arrivals tracking on ALL planes
        var currentIcaos = {};
        for (var ci = 0; ci < allPlanes.length; ci++) {
            currentIcaos[allPlanes[ci].icao] = true;
            if (!_sumArrivals[allPlanes[ci].icao]) _sumArrivals[allPlanes[ci].icao] = nowMs;
        }
        Object.keys(_sumArrivals).forEach(function (ic) { if (!currentIcaos[ic]) delete _sumArrivals[ic]; });

        // Scope filter
        var planes = allPlanes.filter(function (p) {
            if (_panelScope === 'inview')   return !!p.inView;
            if (_panelScope === 'filtered') return planePassesAllFilters(p, null);
            return true;
        });

        var total = planes.length;
        var altBands     = [0, 0, 0, 0, 0, 0, 0];
        var altBandIcaos = [[], [], [], [], [], [], []];
        var militaryList  = [];
        var emergencyList = [];
        var unusualList   = [];
        var onGroundIcaos = [];
        var trackingIcaos = [];
        var withRouteIcaos = [];
        var noRouteIcaos  = [];
        var operatorCounts = {};
        var routeCounts    = {};
        var typeCounts     = {};
        var speedList      = [];
        var slowestList    = [];
        var highList       = [];
        var methodCounts   = { adsb: 0, mlat: 0, tisb: 0, modes: 0, other: 0 };
        var countryCounts  = {};
        var distList       = [];

        var rxLat = null, rxLon = null;
        try {
            if (typeof SiteLat !== 'undefined' && SiteLat && SiteLon) {
                rxLat = +SiteLat; rxLon = +SiteLon;
            } else if (typeof g !== 'undefined' && g.SitePosition && g.SitePosition.lat) {
                rxLat = g.SitePosition.lat; rxLon = g.SitePosition.lng;
            }
        } catch (e) {}

        var closestPlanes = [];
        function hasLivePosition(q) {
            if (!q) return false;
            if (q.position && q.position.length >= 2 && !isNaN(+q.position[0]) && !isNaN(+q.position[1])) return true;
            if (!isNaN(+q.lat) && !isNaN(+q.lon)) return true;
            return false;
        }

        for (var i = 0; i < planes.length; i++) {
            var p = planes[i];
            var pHasPos = hasLivePosition(p);
            var isGround = p.altitude === 'ground' || p.alt_baro === 'ground';
            var altNum   = isGround ? -1
                         : (typeof p.altitude === 'number' ? p.altitude
                         : (typeof p.alt_baro  === 'number' ? p.alt_baro : null));
            if (altNum !== null) {
                var bi2;
                if (isGround || altNum < 0)   bi2 = 0;
                else if (altNum < 5000)        bi2 = 1;
                else if (altNum < 10000)       bi2 = 2;
                else if (altNum < 20000)       bi2 = 3;
                else if (altNum < 30000)       bi2 = 4;
                else if (altNum < 40000)       bi2 = 5;
                else                           bi2 = 6;
                altBands[bi2]++;
                if (p.icao) altBandIcaos[bi2].push(p.icao.toUpperCase());
            }
            if (isGround && p.icao) onGroundIcaos.push(p.icao.toUpperCase());
            if (pHasPos && isMilitaryAircraft(p)) militaryList.push(p);
            if (pHasPos && (p.squawk === '7500' || p.squawk === '7600' || p.squawk === '7700')) emergencyList.push(p);
            if (!isGround && altNum !== null && altNum > 0 && altNum < 1000 && p.position && p.position.length >= 2) {
                var cat = getAircraftCategory(p.typeLong || p.icaoType);
                if (cat !== 5) unusualList.push({ plane: p, reason: 'Very low (' + Math.round(altNum) + ' ft)' });
            }
            var cEntry = getCacheEntry(p);
            if (cEntry && cEntry.airline_code) {
                var opName = getAirlineName(cEntry.airline_code);
                if (opName && opName !== cEntry.airline_code) operatorCounts[opName] = (operatorCounts[opName] || 0) + 1;
            }
            var route = parseRoute(p);
            var hasRoute = !!(route && route.fromIcao && route.toIcao);
            if (!hasRoute) {
                var rs = ((p.routeString || '') + '').trim();
                hasRoute = rs.length > 0 && rs.indexOf(' - ') > 0;
            }
            if (p.icao) {
                if (hasRoute) withRouteIcaos.push(p.icao.toUpperCase());
                else noRouteIcaos.push(p.icao.toUpperCase());
            }
            if (route && route.fromIcao && route.toIcao) {
                var rk = route.fromIcao + ' \u2013 ' + route.toIcao;
                routeCounts[rk] = (routeCounts[rk] || 0) + 1;
            }
            var tCode = p.icaoType || (p.typeLong ? p.typeLong.split(' ')[0] : null);
            if (tCode) typeCounts[tCode] = (typeCounts[tCode] || 0) + 1;
            if (pHasPos && !isGround && typeof p.gs === 'number' && p.gs > 0)  speedList.push(p);
            if (pHasPos && !isGround && typeof p.gs === 'number' && p.gs > 30) slowestList.push(p);
            if (pHasPos && !isGround && typeof altNum === 'number' && altNum > 0) highList.push(p);
            var at = (p.addrtype || '').toLowerCase();
            if      (at.indexOf('adsb') === 0 || at.indexOf('adsr') === 0) methodCounts.adsb++;
            else if (at === 'mlat')                                          methodCounts.mlat++;
            else if (at.indexOf('tisb') === 0)                               methodCounts.tisb++;
            else if (at === 'mode_s')                                        methodCounts.modes++;
            else                                                             methodCounts.other++;
            if (at && p.icao) {
                var hasPos = (p.position && p.position.length >= 2) || (!isNaN(+p.lat) && !isNaN(+p.lon));
                if (hasPos) trackingIcaos.push(p.icao.toUpperCase());
            }
            var ctry = _rfRegCountry(p.registration, p.icao);
            if (ctry) countryCounts[ctry] = (countryCounts[ctry] || 0) + 1;
            if (rxLat !== null) {
                var cLat, cLon;
                if (p.position && p.position.length >= 2) { cLon = +p.position[0]; cLat = +p.position[1]; }
                else { cLat = +p.lat; cLon = +p.lon; }
                if (!isNaN(cLat) && !isNaN(cLon)) {
                    var d = haversineNm(rxLat, rxLon, cLat, cLon);
                    distList.push({ plane: p, dist: d, lat: cLat, lon: cLon });
                    closestPlanes.push({ plane: p, dist: d });
                }
            }
        }

        if (closestPlanes.length) {
            closestPlanes.sort(function (a, b) { return a.dist - b.dist; });
            closestPlanes = closestPlanes.slice(0, 5);
        }
        speedList.sort(function (a, b) { return b.gs - a.gs; });
        speedList = speedList.slice(0, 5);
        slowestList.sort(function (a, b) { return a.gs - b.gs; });
        slowestList = slowestList.slice(0, 5);
        highList.sort(function (a, b) {
            var aA = typeof a.altitude === 'number' ? a.altitude : (typeof a.alt_baro === 'number' ? a.alt_baro : 0);
            var bA = typeof b.altitude === 'number' ? b.altitude : (typeof b.alt_baro === 'number' ? b.alt_baro : 0);
            return bA - aA;
        });
        highList = highList.slice(0, 5);

        var alertsList = [];
        if (_alertsDb && _alertsDb.length) {
            var _aLiveMap = {};
            for (var ali = 0; ali < planes.length; ali++) {
                if (planes[ali].icao) _aLiveMap[planes[ali].icao.toUpperCase()] = planes[ali];
            }
            _alertsDb.forEach(function (a) {
                var lp = _aLiveMap[(a.icao || '').toUpperCase()];
                if (lp && hasLivePosition(lp)) alertsList.push({ plane: lp, alert: a });
            });
        }

        var topOps      = Object.keys(operatorCounts).map(function (k) { return [k, operatorCounts[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
        var topRoutes   = Object.keys(routeCounts).map(function (k) { return [k, routeCounts[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
        var topTypes    = Object.keys(typeCounts).map(function (k) { return [k, typeCounts[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
        var topCountries = Object.keys(countryCounts).map(function (k) { return [k, countryCounts[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
        var altMax      = Math.max.apply(null, altBands.concat([1]));

        var furthestItem = null;
        if (distList.length > 0) {
            distList.sort(function (a, b) { return b.dist - a.dist; });
            furthestItem = distList[0];
        }
        var distByIcao = {};
        for (var dsi = 0; dsi < distList.length; dsi++) {
            var dp = distList[dsi];
            if (dp && dp.plane && dp.plane.icao) distByIcao[String(dp.plane.icao).toUpperCase()] = dp.dist;
        }

        var ARRIVAL_WINDOW_MS = 5 * 60 * 1000;
        var recentArrivals = planes.filter(function (p) {
            var fs = _sumArrivals[p.icao];
            return fs && (nowMs - fs) < ARRIVAL_WINDOW_MS && hasLivePosition(p);
        }).sort(function (a, b) {
            return (_sumArrivals[b.icao] || 0) - (_sumArrivals[a.icao] || 0);
        }).slice(0, 8);

        var esc = _rfEscText;
        function planeName(q) { return esc(q.flight || q.name || q.icao || '?'); }
        function planeReg(q)  { return esc(q.registration || ''); }
        function planeType(q) { return esc(q.typeLong || q.icaoType || ''); }
        function altStr(q) {
            if (q.altitude === 'ground' || q.alt_baro === 'ground') return 'Ground';
            if (typeof q.altitude === 'number') return q.altitude.toLocaleString() + '\u2009ft';
            if (typeof q.alt_baro === 'number') return q.alt_baro.toLocaleString() + '\u2009ft';
            return '';
        }
        function altNum2(q) {
            if (typeof q.altitude === 'number') return q.altitude;
            if (typeof q.alt_baro === 'number') return q.alt_baro;
            return 0;
        }
        function planeRow(q, extraHtml) {
            var ic  = (q.icao || '').toUpperCase();
            var sel = _sumFilter.size > 0 && _sumFilter.has(ic);
            return '<div class="rf-sum-plane-row' + (sel ? ' rf-sum-plane-sel' : '') + '" ' +
                'onclick="window._rfSumFilterIcao(\'' + ic + '\')" title="Click to filter to this aircraft">' +
                extraHtml +
                ' <span class="rf-sum-aname">' + planeName(q) + '</span>' +
                (planeReg(q) ? ' <span class="rf-sum-reg">' + planeReg(q) + '</span>' : '') +
                ' <span class="rf-sum-type">' + planeType(q) + '</span>' +
                ' <span class="rf-sum-altbadge">' + altStr(q) + '</span>' +
                (typeof q.gs === 'number' ? ' <span class="rf-sum-speed">' + Math.round(q.gs) + '\u2009kt</span>' : '') +
                '</div>';
        }
        function planeDistNm(q) {
            if (!q || !q.icao) return null;
            var dd = distByIcao[String(q.icao).toUpperCase()];
            return (typeof dd === 'number' && !isNaN(dd)) ? dd : null;
        }

        var _attnDistVals = [];
        emergencyList.forEach(function (q) { var dd = planeDistNm(q); if (dd !== null) _attnDistVals.push(dd); });
        militaryList.forEach(function (q) { var dd = planeDistNm(q); if (dd !== null) _attnDistVals.push(dd); });
        unusualList.forEach(function (item) { var dd = planeDistNm(item && item.plane); if (dd !== null) _attnDistVals.push(dd); });
        alertsList.forEach(function (item) { var dd = planeDistNm(item && item.plane); if (dd !== null) _attnDistVals.push(dd); });
        var _attnDistMin = null, _attnDistMax = null;
        if (_attnDistVals.length > 0) {
            _attnDistMin = Math.min.apply(null, _attnDistVals);
            _attnDistMax = Math.max.apply(null, _attnDistVals);
        }
        function attnProximityPct(dNm) {
            if (dNm === null || _attnDistMin === null || _attnDistMax === null) return 0;
            if (_attnDistMax <= _attnDistMin) return 100;
            var pp = 100 * (_attnDistMax - dNm) / (_attnDistMax - _attnDistMin);
            return Math.round(Math.max(0, Math.min(100, pp)));
        }
        function attnTimeStr(q) {
            var fs = q.icao ? _sumArrivals[q.icao] : null;
            if (!fs) return '';
            var secs = Math.round((nowMs - fs) / 1000);
            if (secs < 60) return secs + 's';
            var mins = Math.floor(secs / 60);
            if (mins < 60) return mins + 'm';
            return Math.floor(mins / 60) + 'h\u00a0' + (mins % 60) + 'm';
        }
        function attnRow(q, leadHtml) {
            var dd = planeDistNm(q);
            var dTxt = dd === null ? '\u2014' : dd.toFixed(0) + '\u2009nm';
            var prox = attnProximityPct(dd);
            var timeTxt = attnTimeStr(q);
            return planeRow(q,
                leadHtml +
                ' <span class="rf-sum-attn-dist">' + dTxt + '</span>' +
                (timeTxt ? ' <span class="rf-sum-attn-time">' + timeTxt + '</span>' : '') +
                ' <span class="rf-sum-attn-distline">' +
                    '<span class="rf-sum-attn-distfill" style="width:' + prox + '%"></span>' +
                '</span>'
            );
        }
        function sortPlanesForAttention(arr) {
            var by  = _sumAttentionSort.by || 'distance';
            var dir = _sumAttentionSort.dir === 'desc' ? -1 : 1;
            var cp  = arr.slice();
            cp.sort(function (a, b) {
                var av, bv;
                if (by === 'name') {
                    av = (a.flight || a.name || a.icao || '').toString();
                    bv = (b.flight || b.name || b.icao || '').toString();
                    return av.localeCompare(bv) * dir;
                } else if (by === 'altitude') {
                    av = altNum2(a); bv = altNum2(b);
                } else if (by === 'speed') {
                    av = (typeof a.gs === 'number' ? a.gs : -1);
                    bv = (typeof b.gs === 'number' ? b.gs : -1);
                } else {
                    av = planeDistNm(a); bv = planeDistNm(b);
                    av = (av === null ? 999999 : av);
                    bv = (bv === null ? 999999 : bv);
                }
                if (av === bv) return 0;
                return (av < bv ? -1 : 1) * dir;
            });
            return cp;
        }

        var html = '<div class="rf-summary-content">';

        // ── Overview ──────────────────────────────────────────────────────────
        var onGround = altBands[0];
        var airborne = total - onGround;
        var milIdx  = militaryList.length > 0    ? (_sumClickData.push(militaryList.map(function (q) { return q.icao; })) - 1)    : -1;
        var gndIdx  = onGroundIcaos.length > 0   ? (_sumClickData.push(onGroundIcaos.slice()) - 1)                               : -1;
        var trkIdx  = trackingIcaos.length > 0   ? (_sumClickData.push(trackingIcaos.slice()) - 1)                               : -1;
        var wrIdx   = withRouteIcaos.length > 0  ? (_sumClickData.push(withRouteIcaos.slice()) - 1)                              : -1;
        var nrIdx   = noRouteIcaos.length > 0    ? (_sumClickData.push(noRouteIcaos.slice()) - 1)                                : -1;
        var alrtIdx = alertsList.length > 0      ? (_sumClickData.push(alertsList.map(function (x) { return x.plane.icao; })) - 1) : -1;
        html += '<div class="rf-sum-section">';
        html += '<div class="rf-sum-title">Overview <span class="rf-sum-scope-badge">' + _rfScopeBadgeLabel() + '</span></div>';
        html += '<div class="rf-sum-overview">';
        html += '<div class="rf-sum-stat"><div class="rf-sum-num">' + total + '</div><div class="rf-sum-label">loaded aircraft</div></div>';
        html += '<div class="rf-sum-stat"><div class="rf-sum-num">' + airborne + '</div><div class="rf-sum-label">airborne</div></div>';
        html += '<div class="rf-sum-stat' + (onGroundIcaos.length > 0 ? ' rf-sum-stat-click' : '') + '"' + (onGroundIcaos.length > 0 ? ' onclick="window._rfSumFilterIdx(' + gndIdx + ')"' : '') + '><div class="rf-sum-num">' + onGround + '</div><div class="rf-sum-label">on ground</div></div>';
        html += '<div class="rf-sum-stat' + (trackingIcaos.length > 0 ? ' rf-sum-stat-click' : '') + '"' + (trackingIcaos.length > 0 ? ' onclick="window._rfSumFilterIdx(' + trkIdx + ')"' : '') + '><div class="rf-sum-num">' + trackingIcaos.length + '</div><div class="rf-sum-label">tracking</div></div>';
        html += '<div class="rf-sum-stat' + (withRouteIcaos.length > 0 ? ' rf-sum-stat-click' : '') + '"' + (withRouteIcaos.length > 0 ? ' onclick="window._rfSumFilterIdx(' + wrIdx + ')"' : '') + '><div class="rf-sum-num">' + withRouteIcaos.length + '</div><div class="rf-sum-label">with route</div></div>';
        html += '<div class="rf-sum-stat' + (noRouteIcaos.length > 0 ? ' rf-sum-stat-click' : '') + '"' + (noRouteIcaos.length > 0 ? ' onclick="window._rfSumFilterIdx(' + nrIdx + ')"' : '') + '><div class="rf-sum-num">' + noRouteIcaos.length + '</div><div class="rf-sum-label">no route</div></div>';
        html += '<div class="rf-sum-stat' + (alertsList.length > 0 ? ' rf-sum-stat-click' : '') + '"' + (alertsList.length > 0 ? ' onclick="window._rfSumFilterIdx(' + alrtIdx + ')"' : '') + '><div class="rf-sum-num">' + alertsList.length + '</div><div class="rf-sum-label">alert</div></div>';
        if (militaryList.length > 0) {
            html += '<div class="rf-sum-stat rf-sum-stat-mil rf-sum-stat-click" onclick="window._rfSumFilterIdx(' + milIdx + ')">' +
                '<div class="rf-sum-num">' + militaryList.length + '</div><div class="rf-sum-label">military</div></div>';
        }
        if (emergencyList.length > 0) {
            html += '<div class="rf-sum-stat rf-sum-stat-emg"><div class="rf-sum-num">' + emergencyList.length + '</div><div class="rf-sum-label">emergency</div></div>';
        }
        html += '</div></div>';

        // ── Altitude distribution ─────────────────────────────────────────────
        if (_summarySettings.altitude) {
            var altLabels   = ['Ground', '< 5,000', '5\u201310k', '10\u201320k', '20\u201330k', '30\u201340k', '40k+'];
            var altColors   = ['#6e6e6e', '#7ce8c8', '#7cb9e8', '#7c8fe8', '#a87ce8', '#e87c7c', '#e8a87c'];
            html += '<div class="rf-sum-section"><div class="rf-sum-title">Altitude Distribution <span class="rf-sum-title-sub">click band to filter</span></div>';
            html += '<div class="rf-sum-altchart">';
            for (var bi = 0; bi < 7; bi++) {
                var cnt    = altBands[bi];
                var barPct = cnt > 0 ? Math.max(3, Math.round(cnt / altMax * 100)) : 0;
                var realPct = total > 0 ? Math.round(cnt / total * 100) : 0;
                var showInside = barPct >= 22 && cnt > 0;
                var bandIcaos  = altBandIcaos[bi];
                var bandActive = cnt > 0 && _sumFilter.size > 0 && bandIcaos.length > 0 && bandIcaos.every(function (ic) { return _sumFilter.has(ic); });
                var bandIdx    = cnt > 0 ? (_sumClickData.push(bandIcaos.slice()) - 1) : -1;
                html += '<div class="rf-sum-altrow' + (bandActive ? ' rf-sum-altrow-active' : '') + (cnt > 0 ? ' rf-sum-altrow-clickable' : '') + '"' +
                    (cnt > 0 ? ' onclick="window._rfSumFilterIdx(' + bandIdx + ')"' : '') + '>' +
                    '<div class="rf-sum-altrow-lbl" style="color:' + altColors[bi] + '">' + altLabels[bi] + '</div>' +
                    '<div class="rf-sum-altrow-track">' +
                    (cnt > 0
                        ? '<div class="rf-sum-altrow-fill" style="width:' + barPct + '%;background:' + altColors[bi] + '">' + (showInside ? '<span class="rf-sum-altrow-inner">' + cnt + '</span>' : '') + '</div>' +
                          (!showInside ? '<span class="rf-sum-altrow-outer">' + cnt + '</span>' : '')
                        : '') +
                    '</div>' +
                    '<div class="rf-sum-altrow-pct">' + (cnt > 0 ? realPct + '%' : '\u2014') + '</div>' +
                    '</div>';
            }
            html += '</div></div>';
        }

        // ── Attention ─────────────────────────────────────────────────────────
        if (_summarySettings.attention) {
            var hasAttn = emergencyList.length > 0 || unusualList.length > 0 || militaryList.length > 0 || _alertsDb || _alertsFetching || _alertsError;
            html += '<div class="rf-sum-section"><div class="rf-sum-title">Attention</div>';
            html += '<div class="rf-sum-attn-sort-wrap">' +
                '<span class="rf-sum-attn-sort-label">Sort:</span>' +
                '<button class="rf-cat-btn' + (_sumAttentionSort.by === 'distance' ? ' rf-cat-active' : '') + '" onclick="window._rfSetAttentionSort(\'distance\')">Distance</button>' +
                '<button class="rf-cat-btn' + (_sumAttentionSort.by === 'altitude' ? ' rf-cat-active' : '') + '" onclick="window._rfSetAttentionSort(\'altitude\')">Altitude</button>' +
                '<button class="rf-cat-btn' + (_sumAttentionSort.by === 'speed' ? ' rf-cat-active' : '') + '" onclick="window._rfSetAttentionSort(\'speed\')">Speed</button>' +
                '<button class="rf-cat-btn' + (_sumAttentionSort.by === 'name' ? ' rf-cat-active' : '') + '" onclick="window._rfSetAttentionSort(\'name\')">Name</button>' +
                '<button class="rf-cat-btn" onclick="window._rfToggleAttentionSortDir()">' + (_sumAttentionSort.dir === 'asc' ? '&#9650;' : '&#9660;') + '</button>' +
                '</div>';
            if (!hasAttn) {
                html += '<div class="rf-sum-none">Nothing unusual right now.</div>';
            } else {
                if (emergencyList.length > 0) {
                    var emgIdx    = _sumClickData.push(emergencyList.map(function (q) { return q.icao; })) - 1;
                    var emgSorted = sortPlanesForAttention(emergencyList);
                    html += '<div class="rf-sum-attn-hdr" onclick="window._rfSumFilterIdx(' + emgIdx + ')">' +
                        '<span class="rf-sum-squawk-hdr">&#9888; Emergency (' + emergencyList.length + ')</span></div>';
                    emgSorted.forEach(function (q) {
                        var sq = q.squawk;
                        var desc = sq === '7500' ? 'Hijack' : sq === '7600' ? 'Radio fail' : 'Emergency';
                        html += attnRow(q, '<span class="rf-sum-squawk">SQWK\u00a0' + sq + ' ' + desc + '</span>');
                    });
                }
                if (militaryList.length > 0) {
                    var milIdx2   = _sumClickData.push(militaryList.map(function (q) { return q.icao; })) - 1;
                    var milSorted = sortPlanesForAttention(militaryList);
                    html += '<div class="rf-sum-attn-hdr" onclick="window._rfSumFilterIdx(' + milIdx2 + ')">' +
                        '<span class="rf-sum-mil-badge">MIL (' + militaryList.length + ')</span></div>';
                    milSorted.slice(0, 8).forEach(function (q) {
                        html += attnRow(q, '<span class="rf-sum-mil-badge">MIL</span>');
                    });
                    if (militaryList.length > 8) {
                        html += '<div class="rf-sum-more">and ' + (militaryList.length - 8) + ' more \u2014 <span class="rf-sum-link" onclick="window._rfSumFilterIdx(' + milIdx2 + ')">filter all</span></div>';
                    }
                }
                if (unusualList.length > 0) {
                    var lowIdx   = _sumClickData.push(unusualList.map(function (item) { return item.plane.icao; })) - 1;
                    var lowSorted = unusualList.slice().sort(function (a, b) {
                        var sa = sortPlanesForAttention([a.plane, b.plane]);
                        return sa[0] === a.plane ? -1 : 1;
                    });
                    html += '<div class="rf-sum-attn-hdr" onclick="window._rfSumFilterIdx(' + lowIdx + ')">' +
                        '<span class="rf-sum-low-badge">LOW (' + unusualList.length + ')</span></div>';
                    lowSorted.slice(0, 6).forEach(function (item) {
                        html += attnRow(item.plane, '<span class="rf-sum-low-badge">LOW</span> <span class="rf-sum-attn-desc">' + esc(item.reason) + '</span>');
                    });
                }
                if (_alertsFetching) {
                    html += '<div class="rf-sum-attn-hdr"><span class="rf-sum-alert-badge">\u2605 Alerts (loading\u2026)</span></div>';
                } else if (_alertsError) {
                    html += '<div class="rf-sum-attn-hdr"><span class="rf-sum-alert-badge">\u2605 Alerts (error)</span></div>' +
                        '<div class="rf-sum-none">plane-alert-db failed to load: ' + esc(String(_alertsError)) + '</div>';
                } else if (_alertsDb) {
                    if (alertsList.length > 0) {
                        var alIdx   = _sumClickData.push(alertsList.map(function (x) { return x.plane.icao; })) - 1;
                        var alSorted = alertsList.slice().sort(function (a, b) {
                            var sa = sortPlanesForAttention([a.plane, b.plane]);
                            return sa[0] === a.plane ? -1 : 1;
                        });
                        html += '<div class="rf-sum-attn-hdr" onclick="window._rfSumFilterIdx(' + alIdx + ')">' +
                            '<span class="rf-sum-alert-badge">\u2605 Alerts (' + alertsList.length + ')</span></div>';
                        alSorted.slice(0, 6).forEach(function (item) {
                            var tags  = [item.alert.tag1, item.alert.tag2, item.alert.tag3].filter(Boolean).join(' \u00b7 ');
                            var label = tags || item.alert.category || item.alert.cmpg || 'Alert';
                            html += attnRow(item.plane, '<span class="rf-sum-alert-tag">' + esc(label) + '</span>');
                        });
                        if (alertsList.length > 6) {
                            html += '<div class="rf-sum-more">and ' + (alertsList.length - 6) + ' more \u2014 <span class="rf-sum-link" onclick="window._rfSumFilterIdx(' + alIdx + ')">filter all</span></div>';
                        }
                    } else {
                        html += '<div class="rf-sum-attn-hdr"><span class="rf-sum-alert-badge">\u2605 Alerts (0)</span></div>' +
                            '<div class="rf-sum-none">No alert-matched aircraft in the current summary scope.</div>';
                    }
                }
            }
            html += '</div>';
        }

        // ── Closest aircraft ──────────────────────────────────────────────────
        if (_summarySettings.closest && closestPlanes.length > 0) {
            html += '<div class="rf-sum-section"><div class="rf-sum-title">Closest Aircraft</div>';
            closestPlanes.forEach(function (item) {
                html += planeRow(item.plane, '<span class="rf-sum-dist">' + item.dist.toFixed(0) + '\u2009nm</span>');
            });
            html += '</div>';
        }

        // ── Speed leaders ─────────────────────────────────────────────────────
        if (_summarySettings.speed && speedList.length > 0) {
            html += '<div class="rf-sum-section"><div class="rf-sum-title">Speed Leaders</div>';
            var spdMax = speedList[0].gs || 1;
            speedList.forEach(function (q, idx) {
                var spdPct = Math.round(q.gs / spdMax * 100);
                var ic  = (q.icao || '').toUpperCase();
                var sel = _sumFilter.size > 0 && _sumFilter.has(ic);
                html += '<div class="rf-sum-leader-row' + (sel ? ' rf-sum-plane-sel' : '') + '" onclick="window._rfSumFilterIcao(\'' + ic + '\')">' +
                    '<div class="rf-sum-leader-rank">' + (idx + 1) + '</div>' +
                    '<div class="rf-sum-leader-info">' +
                        '<div class="rf-sum-leader-name">' + planeName(q) + (planeReg(q) ? ' <span class="rf-sum-reg">' + planeReg(q) + '</span>' : '') + ' <span class="rf-sum-type">' + planeType(q) + '</span></div>' +
                        '<div class="rf-sum-leader-bar-wrap"><div class="rf-sum-leader-bar rf-sum-leader-bar-spd" style="width:' + spdPct + '%"></div></div>' +
                    '</div>' +
                    '<div class="rf-sum-leader-val">' + Math.round(q.gs) + '\u2009kt</div>' +
                    '</div>';
            });
            html += '</div>';
        }

        // ── Slowest airborne ──────────────────────────────────────────────────
        if (_summarySettings.slowest && slowestList.length > 0) {
            html += '<div class="rf-sum-section"><div class="rf-sum-title">Slowest Airborne</div>';
            var slowMax = slowestList[slowestList.length - 1].gs || 1;
            slowestList.forEach(function (q, idx) {
                var spdPct = Math.max(4, Math.round(q.gs / slowMax * 100));
                var ic  = (q.icao || '').toUpperCase();
                var sel = _sumFilter.size > 0 && _sumFilter.has(ic);
                html += '<div class="rf-sum-leader-row' + (sel ? ' rf-sum-plane-sel' : '') + '" onclick="window._rfSumFilterIcao(\'' + ic + '\')">' +
                    '<div class="rf-sum-leader-rank">' + (idx + 1) + '</div>' +
                    '<div class="rf-sum-leader-info">' +
                        '<div class="rf-sum-leader-name">' + planeName(q) + (planeReg(q) ? ' <span class="rf-sum-reg">' + planeReg(q) + '</span>' : '') + ' <span class="rf-sum-type">' + planeType(q) + '</span></div>' +
                        '<div class="rf-sum-leader-bar-wrap"><div class="rf-sum-leader-bar rf-sum-leader-bar-slow" style="width:' + spdPct + '%"></div></div>' +
                    '</div>' +
                    '<div class="rf-sum-leader-val">' + Math.round(q.gs) + '\u2009kt</div>' +
                    '</div>';
            });
            html += '</div>';
        }

        // ── High flyers ───────────────────────────────────────────────────────
        if (_summarySettings.highflyers && highList.length > 0) {
            html += '<div class="rf-sum-section"><div class="rf-sum-title">High Flyers</div>';
            var hiMax = altNum2(highList[0]) || 1;
            highList.forEach(function (q, idx) {
                var hiAlt = altNum2(q);
                var hiPct = Math.round(hiAlt / hiMax * 100);
                var ic  = (q.icao || '').toUpperCase();
                var sel = _sumFilter.size > 0 && _sumFilter.has(ic);
                html += '<div class="rf-sum-leader-row' + (sel ? ' rf-sum-plane-sel' : '') + '" onclick="window._rfSumFilterIcao(\'' + ic + '\')">' +
                    '<div class="rf-sum-leader-rank">' + (idx + 1) + '</div>' +
                    '<div class="rf-sum-leader-info">' +
                        '<div class="rf-sum-leader-name">' + planeName(q) + (planeReg(q) ? ' <span class="rf-sum-reg">' + planeReg(q) + '</span>' : '') + ' <span class="rf-sum-type">' + planeType(q) + '</span></div>' +
                        '<div class="rf-sum-leader-bar-wrap"><div class="rf-sum-leader-bar rf-sum-leader-bar-alt" style="width:' + hiPct + '%"></div></div>' +
                    '</div>' +
                    '<div class="rf-sum-leader-val">' + hiAlt.toLocaleString() + '\u2009ft</div>' +
                    '</div>';
            });
            html += '</div>';
        }

        // ── Aircraft types ────────────────────────────────────────────────────
        if (_summarySettings.types && topTypes.length > 0) {
            html += '<div class="rf-sum-section"><div class="rf-sum-title">Aircraft Types</div><div class="rf-sum-types-grid">';
            topTypes.forEach(function (t) {
                html += '<div class="rf-sum-type-pill"><span class="rf-sum-type-code">' + esc(t[0]) + '</span><span class="rf-sum-type-cnt">' + t[1] + '</span></div>';
            });
            html += '</div></div>';
        }

        // ── Busiest operators ─────────────────────────────────────────────────
        if (_summarySettings.operators && topOps.length > 0) {
            html += '<div class="rf-sum-section"><div class="rf-sum-title">Busiest Operators</div><div class="rf-sum-bar-list">';
            var opMax = topOps[0][1] || 1;
            topOps.forEach(function (op) {
                var w = Math.round(op[1] / opMax * 100);
                html += '<div class="rf-sum-bar-row"><div class="rf-sum-bar-label">' + esc(op[0]) + '</div><div class="rf-sum-bar-track"><div class="rf-sum-bar-fill" style="width:' + w + '%"></div></div><div class="rf-sum-bar-cnt">' + op[1] + '</div></div>';
            });
            html += '</div></div>';
        }

        // ── Busiest routes ────────────────────────────────────────────────────
        if (_summarySettings.routes && topRoutes.length > 0) {
            html += '<div class="rf-sum-section"><div class="rf-sum-title">Busiest Routes</div><div class="rf-sum-bar-list">';
            var rtMax = topRoutes[0][1] || 1;
            topRoutes.forEach(function (rt) {
                var w = Math.round(rt[1] / rtMax * 100);
                var parts = rt[0].split(' \u2013 ');
                var rtLabel = parts.map(function (ap) {
                    var f = airportFlag(ap.trim());
                    return (f ? f + '\u2009' : '') + esc(ap.trim());
                }).join(' <span style="color:#555">\u2013</span> ');
                html += '<div class="rf-sum-bar-row"><div class="rf-sum-bar-label">' + rtLabel + '</div><div class="rf-sum-bar-track"><div class="rf-sum-bar-fill rf-sum-bar-fill-route" style="width:' + w + '%"></div></div><div class="rf-sum-bar-cnt">' + rt[1] + '</div></div>';
            });
            html += '</div></div>';
        }

        // ── Tracking methods ──────────────────────────────────────────────────
        if (_summarySettings.methods) {
            var hasMethods = methodCounts.adsb + methodCounts.mlat + methodCounts.tisb + methodCounts.modes + methodCounts.other > 0;
            if (hasMethods) {
                var methodDefs = [
                    { key: 'adsb',  label: 'ADS-B',  cls: 'rf-sum-meth-adsb'  },
                    { key: 'mlat',  label: 'MLAT',   cls: 'rf-sum-meth-mlat'  },
                    { key: 'tisb',  label: 'TIS-B',  cls: 'rf-sum-meth-tisb'  },
                    { key: 'modes', label: 'Mode S', cls: 'rf-sum-meth-modes' },
                    { key: 'other', label: 'Other',  cls: 'rf-sum-meth-other' },
                ];
                html += '<div class="rf-sum-section"><div class="rf-sum-title">Tracking Methods</div><div class="rf-sum-methods">';
                methodDefs.forEach(function (m) {
                    var cnt = methodCounts[m.key];
                    if (cnt === 0) return;
                    var pct = total > 0 ? Math.round(cnt / total * 100) : 0;
                    html += '<div class="rf-sum-meth-item ' + m.cls + '"><div class="rf-sum-meth-cnt">' + cnt + '</div><div class="rf-sum-meth-label">' + m.label + '</div><div class="rf-sum-meth-pct">' + pct + '%</div></div>';
                });
                html += '</div></div>';
            }
        }

        // ── Range & coverage ──────────────────────────────────────────────────
        if (_summarySettings.range && furthestItem && rxLat !== null) {
            var fq    = furthestItem.plane;
            var fBear = _rfBearing(rxLat, rxLon, furthestItem.lat, furthestItem.lon);
            var fCard = _rfCardinal(fBear);
            html += '<div class="rf-sum-section"><div class="rf-sum-title">Range &amp; Coverage</div>';
            html += '<div class="rf-sum-range-row">' +
                '<div class="rf-sum-range-compass"><div class="rf-sum-range-arrow" style="transform:rotate(' + Math.round(fBear) + 'deg)">&#9650;</div></div>' +
                '<div class="rf-sum-range-info">' +
                    '<div class="rf-sum-range-dist">' + furthestItem.dist.toFixed(0) + '<span class="rf-sum-range-unit">\u2009nm</span></div>' +
                    '<div class="rf-sum-range-detail">' + fCard + ' \u2022 <span class="rf-sum-aname">' + planeName(fq) + '</span>' + (planeReg(fq) ? ' <span class="rf-sum-reg">' + planeReg(fq) + '</span>' : '') + ' <span class="rf-sum-type">' + planeType(fq) + '</span></div>' +
                '</div></div>';
            html += '</div>';
        }

        // ── Countries ─────────────────────────────────────────────────────────
        if (_summarySettings.countries && topCountries.length > 0) {
            html += '<div class="rf-sum-section"><div class="rf-sum-title">Countries</div><div class="rf-sum-bar-list">';
            var ctMax = topCountries[0][1] || 1;
            topCountries.forEach(function (c) {
                var w    = Math.round(c[1] / ctMax * 100);
                var iso2 = _rfToIso2(c[0]);
                var flag = iso2 ? flagFromIso(iso2) + '\u2009' : '';
                html += '<div class="rf-sum-bar-row"><div class="rf-sum-bar-label">' + flag + esc(c[0]) + '</div><div class="rf-sum-bar-track"><div class="rf-sum-bar-fill rf-sum-bar-fill-country" style="width:' + w + '%"></div></div><div class="rf-sum-bar-cnt">' + c[1] + '</div></div>';
            });
            html += '</div></div>';
        }

        // ── Recent arrivals ───────────────────────────────────────────────────
        if (_summarySettings.arrivals) {
            html += '<div class="rf-sum-section"><div class="rf-sum-title">Recent Arrivals <span class="rf-sum-title-sub">(last 5 min)</span></div>';
            if (recentArrivals.length === 0) {
                html += '<div class="rf-sum-none">No new contacts in the last 5 minutes.</div>';
            } else {
                recentArrivals.forEach(function (q) {
                    var secsAgo = Math.round((nowMs - _sumArrivals[q.icao]) / 1000);
                    var timeAgo = secsAgo < 60 ? secsAgo + 's ago' : Math.floor(secsAgo / 60) + 'm\u2009ago';
                    html += planeRow(q, '<span class="rf-sum-arrival-age">' + timeAgo + '</span>');
                });
            }
            html += '</div>';
        }

        // ── Vertical rate leaders ─────────────────────────────────────────────
        var vrList = [];
        for (var vri = 0; vri < planes.length; vri++) {
            var vrp = planes[vri];
            var vrv = typeof vrp.geom_rate === 'number' ? vrp.geom_rate : (typeof vrp.baro_rate === 'number' ? vrp.baro_rate : null);
            if (vrv !== null && hasLivePosition(vrp)) vrList.push({ plane: vrp, vr: vrv });
        }
        vrList.sort(function (a, b) { return b.vr - a.vr; });
        var climbTop   = vrList.filter(function (x) { return x.vr > 0; }).slice(0, 5);
        var descentTop = vrList.filter(function (x) { return x.vr < 0; }).sort(function (a, b) { return a.vr - b.vr; }).slice(0, 5);
        if (climbTop.length > 0 || descentTop.length > 0) {
            html += '<div class="rf-sum-section"><div class="rf-sum-title">Vertical Rate Leaders</div><div class="rf-vr-leaders">';
            function vrLeaderList(items, title, color) {
                if (!items.length) return '';
                var h = '<div class="rf-vr-col"><div class="rf-vr-col-title">' + title + '</div>';
                items.forEach(function (x) {
                    var ic  = (x.plane.icao || '').toUpperCase();
                    var sel = _sumFilter.size > 0 && _sumFilter.has(ic);
                    h += '<div class="rf-sum-plane-row' + (sel ? ' rf-sum-plane-sel' : '') + '" onclick="window._rfSumFilterIcao(\'' + ic + '\')">' +
                        '<span style="color:' + color + ';font-size:10px;font-weight:700">' + (x.vr > 0 ? '+' : '') + Math.round(x.vr) + '\u2009fpm</span>' +
                        ' <span class="rf-sum-aname">' + esc(x.plane.flight || x.plane.name || x.plane.icao || '?') + '</span>' +
                        ' <span class="rf-sum-type">' + esc(x.plane.icaoType || x.plane.typeLong || '') + '</span>' +
                        '</div>';
                });
                return h + '</div>';
            }
            html += vrLeaderList(climbTop, 'Climbing', '#4CAF50');
            html += vrLeaderList(descentTop, 'Descending', '#e87c7c');
            html += '</div></div>';
        }

        // ── Session records ───────────────────────────────────────────────────
        _rfUpdateSessionRecords(planes);
        html += '<div class="rf-sum-section"><div class="rf-sum-title">Session Records</div><div class="rf-records-grid">';
        function recRow(label, rec, unit) {
            if (!rec || !rec.val) return '';
            return '<div class="rf-rec-row">' +
                '<span class="rf-rec-label">' + label + '</span>' +
                '<span class="rf-rec-val">' + rec.val.toLocaleString() + '\u2009' + unit + '</span>' +
                (rec.callsign ? '<span class="rf-rec-extra">' + esc(rec.callsign) + '</span>' : '') +
                (rec.date ? '<span class="rf-rec-date">' + esc(rec.date) + '</span>' : '') +
                '</div>';
        }
        html += recRow('Aircraft',    _sessionRecords.maxAircraft, '');
        html += recRow('Military',    _sessionRecords.maxMilitary, '');
        html += recRow('Max Range',   _sessionRecords.maxRange,    'NM');
        html += recRow('Max Altitude',_sessionRecords.maxAltitude, 'ft');
        html += recRow('Max Speed',   _sessionRecords.maxSpeed,    'kt');
        html += '</div>';
        html += '<button class="rf-cat-btn" style="margin-top:6px" onclick="window._rfResetRecords()">Reset Records</button>';
        html += '</div>';

        html += '<div class="rf-sum-footer">Refreshes every 3s &bull; Manage sections in <span class="rf-sum-footer-link" onclick="window._rfSwitchTab(\'settings\')">Settings &#9881;</span></div>';
        html += '</div>';

        listEl.innerHTML = html;

        var statusEl = document.getElementById('rf-status');
        if (statusEl) statusEl.textContent = total + ' aircraft' + (_panelScope !== 'all' ? ' (' + _rfScopeLabel() + ')' : '');
        var btn = document.getElementById('rf-btn');
        if (btn) btn.className = 'button ' + (isFilterActive() ? 'activeButton' : 'inActiveButton');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // §11 Tab: Airports
    // ═══════════════════════════════════════════════════════════════════════════
    // Rendered by buildPanel() in §9 via the generic list renderer.
    // No separate builder function needed.

    // ═══════════════════════════════════════════════════════════════════════════
    // §12 Tab: Countries
    // ═══════════════════════════════════════════════════════════════════════════
    // Rendered by buildPanel() in §9 via the generic list renderer.

    // ═══════════════════════════════════════════════════════════════════════════
    // §13 Tab: Operators
    // ═══════════════════════════════════════════════════════════════════════════
    // Rendered by buildPanel() in §9 via the generic list renderer.

    // ═══════════════════════════════════════════════════════════════════════════
    // §14 Tab: Aircraft
    // ═══════════════════════════════════════════════════════════════════════════
    // Rendered by buildPanel() in §9 via the generic list renderer (with category
    // filter buttons and registration-country sub-filter).

    // ═══════════════════════════════════════════════════════════════════════════
    // §15 Tab: Views
    // ═══════════════════════════════════════════════════════════════════════════

    function buildViewsPanel() {
        buildBreadcrumb();
        var searchEl = document.getElementById('rf-search');
        if (searchEl) searchEl.style.display = 'none';
        var ctrlEl = document.getElementById('rf-controls');
        if (ctrlEl) ctrlEl.innerHTML = '';
        var hdrEl = document.getElementById('rf-colheader');
        if (hdrEl) hdrEl.innerHTML = '';
        var listEl = document.getElementById('rf-list');
        if (listEl) {
            var html = '<div class="rf-settings-content">' +
                '<div class="rf-set-group">' +
                '<div class="rf-set-group-title">Saved Views</div>' +
                '<div class="rf-set-group-desc">A view saves your filters and optional map behavior. Use it as a one-click preset.</div>' +
                '<div class="rf-set-group-desc" style="margin-top:6px">' +
                    '<strong>Apply (replace):</strong> replaces your current filters with this view.<br>' +
                    '<strong>Add:</strong> keeps current filters and adds this view to active map control.<br>' +
                    '<strong>Remove / Turn off all:</strong> stops active view control and restores what you had before applying views.' +
                '</div>' +
                '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' +
                '<button class="rf-cat-btn" onclick="window._rfViewsSavePrompt()">Save current as new view</button>' +
                (_activeViewIds.length ? '<button class="rf-cat-btn" onclick="window._rfViewsClearActive()">Turn off all active views</button>' : '') +
                (_activeViewId ? '<button class="rf-cat-btn" onclick="window._rfViewsRename(\'' + _rfEscAttr(_activeViewId) + '\')">Rename first active view</button>' : '') +
                (_activeViewId ? '<button class="rf-cat-btn" onclick="window._rfViewsDeleteActive()">Delete first active view</button>' : '') +
                '</div>' +
                '</div>';
            if (_savedViews.length === 0) {
                html += '<div class="rf-empty" style="margin-top:10px">No views saved yet. Build filters in any tab, then click <strong>Save View</strong>.</div>';
            } else {
                html += '<div class="rf-set-divider"></div><div class="rf-set-group"><div class="rf-set-group-title">Your Views (' + _savedViews.length + ')</div>';
                for (var i = 0; i < _savedViews.length; i++) {
                    var v = _savedViews[i];
                    _rfEnsureViewShape(v);
                    var isActive = _activeViewIds.indexOf(v.id) >= 0;
                    var when = v.updatedAt ? new Date(v.updatedAt).toLocaleString() : '';
                    var mapModeLbl = !v.map.enabled ? 'Off' : (v.map.mode === 'fixed' ? 'Fixed' : 'Dynamic');
                    var fixedLat = (typeof v.map.fixedCenterLat === 'number') ? v.map.fixedCenterLat.toFixed(5) : '';
                    var fixedLon = (typeof v.map.fixedCenterLon === 'number') ? v.map.fixedCenterLon.toFixed(5) : '';
                    var fixedZoom = (typeof v.map.fixedZoom === 'number') ? String(Math.round(v.map.fixedZoom)) : '';
                    html += '<div class="rf-view-item' + (isActive ? ' rf-view-item-active' : '') + '">' +
                        '<div class="rf-view-item-name">' + _rfEscText(v.name || ('View ' + (i + 1))) + '</div>' +
                        '<div class="rf-view-item-meta">' + _rfEscText(when) + ' \u2022 Map: ' + mapModeLbl + '</div>' +
                        '<div class="rf-set-group-desc" style="margin:6px 0 8px 0">' +
                            '<strong>Map behavior</strong> controls what the map does while this view is active.' +
                        '</div>' +
                        '<div class="rf-view-map-cfg">' +
                            '<label class="rf-set-toggle"><input type="checkbox"' + (v.map.enabled ? ' checked' : '') + ' onchange="window._rfViewsSetMapEnabled(\'' + _rfEscAttr(v.id) + '\',this.checked)"><div class="rf-set-toggle-body"><div class="rf-set-toggle-label">Enable map behavior</div><div class="rf-set-toggle-desc">When off, this view changes filters only and does not move the map.</div></div></label>' +
                            '<div class="rf-view-inline-row">' +
                                '<button class="rf-cat-btn' + (!v.map.enabled ? ' rf-cat-active' : '') + '" title="No automatic map movement for this view" onclick="window._rfViewsSetMapMode(\'' + _rfEscAttr(v.id) + '\',\'off\')">Off</button>' +
                                '<button class="rf-cat-btn' + (v.map.enabled && v.map.mode === 'dynamic' ? ' rf-cat-active' : '') + '" title="Automatically follows aircraft that match current filters" onclick="window._rfViewsSetMapMode(\'' + _rfEscAttr(v.id) + '\',\'dynamic\')">Dynamic</button>' +
                                '<button class="rf-cat-btn' + (v.map.enabled && v.map.mode === 'fixed' ? ' rf-cat-active' : '') + '" title="Always goes to a saved location and zoom" onclick="window._rfViewsSetMapMode(\'' + _rfEscAttr(v.id) + '\',\'fixed\')">Fixed</button>' +
                            '</div>' +
                            '<div class="rf-set-group-desc" style="margin:4px 0 6px 0">Mode guide: <strong>Dynamic</strong> follows filtered traffic, <strong>Fixed</strong> locks to saved lat/lon/zoom, <strong>Off</strong> leaves map unchanged.</div>' +
                            '<div class="rf-view-inline-row">' +
                                '<label class="rf-set-toggle"><input type="checkbox"' + (v.map.autoCenter ? ' checked' : '') + ' onchange="window._rfViewsSetMapToggle(\'' + _rfEscAttr(v.id) + '\',\'autoCenter\',this.checked)"><div class="rf-set-toggle-body"><div class="rf-set-toggle-label">Auto center</div><div class="rf-set-toggle-desc">Keeps relevant aircraft area in the middle of the map.</div></div></label>' +
                                '<label class="rf-set-toggle"><input type="checkbox"' + (v.map.autoZoom ? ' checked' : '') + ' onchange="window._rfViewsSetMapToggle(\'' + _rfEscAttr(v.id) + '\',\'autoZoom\',this.checked)"><div class="rf-set-toggle-body"><div class="rf-set-toggle-label">Auto zoom</div><div class="rf-set-toggle-desc">Adjusts zoom to keep relevant aircraft in frame.</div></div></label>' +
                            '</div>' +
                            '<div class="rf-view-inline-row">' +
                                '<button class="rf-cat-btn" title="Copy the current map center and zoom into this view" onclick="window._rfViewsUseCurrentMap(\'' + _rfEscAttr(v.id) + '\')">Use current map</button>' +
                            '</div>' +
                            '<div class="rf-view-inline-row">' +
                                '<input class="rf-dist-input rf-dist-small" type="number" step="0.00001" min="-90" max="90" value="' + _rfEscAttr(fixedLat) + '" placeholder="Lat (center)" title="Latitude for Fixed mode center point" oninput="window._rfViewsSetFixedValue(\'' + _rfEscAttr(v.id) + '\',\'lat\',this.value)">' +
                                '<input class="rf-dist-input rf-dist-small" type="number" step="0.00001" min="-180" max="180" value="' + _rfEscAttr(fixedLon) + '" placeholder="Lon (center)" title="Longitude for Fixed mode center point" oninput="window._rfViewsSetFixedValue(\'' + _rfEscAttr(v.id) + '\',\'lon\',this.value)">' +
                                '<input class="rf-dist-input rf-dist-small" type="number" step="1" min="2" max="19" value="' + _rfEscAttr(fixedZoom) + '" placeholder="Zoom (2-19)" title="Zoom level used by Fixed mode (2 wide area, 19 very close)" oninput="window._rfViewsSetFixedValue(\'' + _rfEscAttr(v.id) + '\',\'zoom\',this.value)">' +
                            '</div>' +
                        '</div>' +
                        '<div class="rf-view-item-actions">' +
                        '<button class="rf-cat-btn" title="Apply this view (replace current filters)" onclick="window._rfViewsApply(\'' + _rfEscAttr(v.id) + '\')">\u25B6</button>' +
                        (!isActive ? '<button class="rf-cat-btn" title="Add this view to active view control" onclick="window._rfViewsApply(\'' + _rfEscAttr(v.id) + '\',true)">\u2795</button>' : '<button class="rf-cat-btn" title="Remove this view from active view control" onclick="window._rfViewsRemoveActive(\'' + _rfEscAttr(v.id) + '\')">\u2796</button>') +
                        '<button class="rf-cat-btn" title="Rename this view" onclick="window._rfViewsRename(\'' + _rfEscAttr(v.id) + '\')">\u270F</button>' +
                        '<button class="rf-cat-btn" title="Overwrite this view with current filters/map" onclick="window._rfViewsSavePrompt(\'' + _rfEscAttr(v.id) + '\')">\uD83D\uDCBE</button>' +
                        '<button class="rf-cat-btn" title="Delete this view" onclick="window._rfViewsDelete(\'' + _rfEscAttr(v.id) + '\')">\uD83D\uDDD1</button>' +
                        '</div></div>';
                }
                html += '</div>';
            }
            // Built-in views section
            html += '<div class="rf-set-divider"></div><div class="rf-set-group"><div class="rf-set-group-title">Built-in Views (' + RF_BUILTIN_VIEWS.length + ')</div>' +
                '<div class="rf-set-group-desc">Read-only presets. Click Apply to use, or Add to combine with other views.</div>';
            for (var bi = 0; bi < RF_BUILTIN_VIEWS.length; bi++) {
                var bv = RF_BUILTIN_VIEWS[bi];
                var bActive = _activeViewIds.indexOf(bv.id) >= 0;
                html += '<div class="rf-view-item rf-view-item-builtin' + (bActive ? ' rf-view-item-active' : '') + '">' +
                    '<div class="rf-view-item-name">' + _rfEscText(bv.name) + ' <span class="rf-view-builtin-badge">built-in</span></div>' +
                    '<div class="rf-view-item-actions">' +
                    '<button class="rf-cat-btn" title="Apply this view (replace current filters)" onclick="window._rfViewsApply(\'' + _rfEscAttr(bv.id) + '\')">\u25B6</button>' +
                    (!bActive ? '<button class="rf-cat-btn" title="Add this view to active view control" onclick="window._rfViewsApply(\'' + _rfEscAttr(bv.id) + '\',true)">\u2795</button>' : '<button class="rf-cat-btn" title="Remove this view from active view control" onclick="window._rfViewsRemoveActive(\'' + _rfEscAttr(bv.id) + '\')">\u2796</button>') +
                    '</div></div>';
            }
            html += '</div>';
            html += '</div>';
            listEl.innerHTML = html;
        }
        var statusEl = document.getElementById('rf-status');
        if (statusEl) statusEl.textContent = _savedViews.length + ' saved view' + (_savedViews.length === 1 ? '' : 's');
    }

    // ── Views window handlers ─────────────────────────────────────────────────

    window._rfViewsSavePrompt = function (overwriteId) {
        var existing = null;
        if (overwriteId) {
            for (var i = 0; i < _savedViews.length; i++) {
                if (_savedViews[i] && _savedViews[i].id === overwriteId) { existing = _savedViews[i]; break; }
            }
        }
        var name = prompt(overwriteId ? 'Update view name:' : 'Name for new view:', existing ? existing.name : '');
        if (name === null) return;
        name = String(name || '').trim();
        if (!name) return;
        var now = Date.now();
        var stateSnap = _rfCaptureViewState();
        var mNow = _rfGetCurrentMapSnapshot();
        if (existing) {
            existing.name = name;
            existing.state = stateSnap;
            _rfEnsureViewShape(existing);
            if (mNow) {
                existing.map.fixedCenterLat = mNow.lat;
                existing.map.fixedCenterLon = mNow.lon;
                existing.map.fixedZoom = mNow.zoom;
            }
            existing.updatedAt = now;
            if (_activeViewIds.indexOf(existing.id) < 0) _activeViewIds.push(existing.id);
            _rfSyncActiveViewPointers();
        } else {
            var id = 'view_' + now + '_' + Math.random().toString(36).slice(2, 8);
            var mapCfg = _rfDefaultViewMap();
            if (mNow) {
                mapCfg.fixedCenterLat = mNow.lat;
                mapCfg.fixedCenterLon = mNow.lon;
                mapCfg.fixedZoom = mNow.zoom;
            }
            _savedViews.push({ id: id, name: name, state: stateSnap, map: mapCfg, createdAt: now, updatedAt: now });
            _activeViewIds = [id];
            _rfSyncActiveViewPointers();
        }
        _rfSaveViews();
        _rfRenderScopeHeader();
        if (_activeTab === 'views') buildPanel();
    };

    window._rfViewsRename = function (id) {
        var v = _rfFindViewById(id);
        if (!v) return;
        var name = prompt('Rename view:', v.name || '');
        if (name === null) return;
        name = String(name || '').trim();
        if (!name) return;
        v.name = name;
        v.updatedAt = Date.now();
        _rfSaveViews();
        _rfRenderScopeHeader();
        buildPanel();
    };

    window._rfViewsDelete = function (id) {
        var ix = -1;
        for (var i = 0; i < _savedViews.length; i++) {
            if (_savedViews[i] && _savedViews[i].id === id) { ix = i; break; }
        }
        if (ix < 0) return;
        var nm = _savedViews[ix].name || 'this view';
        if (!confirm('Delete view "' + nm + '"?')) return;
        _savedViews.splice(ix, 1);
        _activeViewIds = _activeViewIds.filter(function (x) { return x !== id; });
        _rfSyncActiveViewPointers();
        if (_activeViewIds.length === 0) _rfRestorePreViewStateIfAny();
        _rfSaveViews();
        _rfRenderScopeHeader();
        buildPanel();
    };

    window._rfViewsDeleteActive = function () {
        if (!_activeViewId) return;
        window._rfViewsDelete(_activeViewId);
    };

    window._rfViewsSetMapEnabled = function (id, on) {
        var v = _rfFindViewById(id);
        if (!v) return;
        _rfEnsureViewShape(v);
        v.map.enabled = !!on;
        v.updatedAt = Date.now();
        _rfSaveViews();
        if (_activeViewIds.indexOf(id) >= 0) _rfApplyActiveViewsMapBehavior(true);
        if (_activeTab === 'views') buildPanel();
    };

    window._rfViewsSetMapMode = function (id, mode) {
        var v = _rfFindViewById(id);
        if (!v) return;
        _rfEnsureViewShape(v);
        if (mode === 'off') v.map.enabled = false;
        else {
            v.map.enabled = true;
            v.map.mode = (mode === 'fixed') ? 'fixed' : 'dynamic';
        }
        v.updatedAt = Date.now();
        _rfSaveViews();
        if (_activeViewIds.indexOf(id) >= 0) _rfApplyActiveViewsMapBehavior(true);
        if (_activeTab === 'views') buildPanel();
    };

    window._rfViewsSetMapToggle = function (id, key, on) {
        var v = _rfFindViewById(id);
        if (!v) return;
        _rfEnsureViewShape(v);
        if (key !== 'autoCenter' && key !== 'autoZoom') return;
        v.map[key] = !!on;
        v.updatedAt = Date.now();
        _rfSaveViews();
        if (_activeViewIds.indexOf(id) >= 0) _rfApplyActiveViewsMapBehavior(true);
    };

    window._rfViewsUseCurrentMap = function (id) {
        var v = _rfFindViewById(id);
        if (!v) return;
        _rfEnsureViewShape(v);
        var mNow = _rfGetCurrentMapSnapshot();
        if (!mNow) return;
        v.map.fixedCenterLat = mNow.lat;
        v.map.fixedCenterLon = mNow.lon;
        v.map.fixedZoom = mNow.zoom;
        v.updatedAt = Date.now();
        _rfSaveViews();
        if (_activeTab === 'views') buildPanel();
    };

    window._rfViewsSetFixedValue = function (id, field, val) {
        var v = _rfFindViewById(id);
        if (!v) return;
        _rfEnsureViewShape(v);
        var n = parseFloat(val);
        if (field === 'lat') {
            if (isNaN(n) || Math.abs(n) > 90) return;
            v.map.fixedCenterLat = n;
        } else if (field === 'lon') {
            if (isNaN(n) || Math.abs(n) > 180) return;
            v.map.fixedCenterLon = n;
        } else if (field === 'zoom') {
            if (isNaN(n)) return;
            if (n < 2) n = 2; if (n > 19) n = 19;
            v.map.fixedZoom = n;
        } else { return; }
        v.updatedAt = Date.now();
        _rfSaveViews();
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // §16 Tab: Alerts
    // ═══════════════════════════════════════════════════════════════════════════

    function buildAlertsPanel() {
        buildBreadcrumb();
        var searchEl = document.getElementById('rf-search');
        if (searchEl) searchEl.style.display = '';
        var ctrlEl   = document.getElementById('rf-controls');
        var hdrEl    = document.getElementById('rf-colheader');
        var listEl   = document.getElementById('rf-list');
        var statusEl = document.getElementById('rf-status');

        if (!_tabVisibility.alerts) {
            if (ctrlEl) ctrlEl.innerHTML = '';
            if (hdrEl)  hdrEl.innerHTML = '';
            if (listEl) listEl.innerHTML = '<div class="rf-empty">Plane Alert tab is disabled.<br>Enable it in \u2699 Settings.</div>';
            if (statusEl) statusEl.textContent = '';
            return;
        }
        if (_alertsFetching) {
            if (ctrlEl) ctrlEl.innerHTML = '';
            if (hdrEl)  hdrEl.innerHTML = '';
            if (listEl) listEl.innerHTML = '<div class="rf-empty">Loading Plane Alert database\u2026</div>';
            if (statusEl) statusEl.textContent = '';
            return;
        }
        if (!_alertsDb && _alertsError) {
            if (ctrlEl) ctrlEl.innerHTML = '';
            if (hdrEl)  hdrEl.innerHTML = '';
            if (listEl) listEl.innerHTML = '<div class="rf-empty">Failed to load: ' + _alertsError + '<br><button class="rf-cat-btn" style="margin-top:8px" onclick="window._rfAlertsRefresh()">Retry</button></div>';
            if (statusEl) statusEl.textContent = '';
            return;
        }
        if (!_alertsDb) {
            loadAlerts(false);
            if (ctrlEl) ctrlEl.innerHTML = '';
            if (hdrEl)  hdrEl.innerHTML = '';
            if (listEl) listEl.innerHTML = '<div class="rf-empty">Loading\u2026</div>';
            if (statusEl) statusEl.textContent = '';
            return;
        }
        if (!listEl) return;

        var esc = _rfEscText;
        var escAttr = _rfEscAttr;
        if (hdrEl) hdrEl.innerHTML = '';
        if (statusEl) statusEl.textContent = 'Updating Plane Alert...';

        // Live ICAOs currently present on map
        var liveIcaos = new Set();
        if (gReady()) {
            for (var li = 0; li < g.planesOrdered.length; li++) {
                if (g.planesOrdered[li].icao) liveIcaos.add(g.planesOrdered[li].icao.toUpperCase());
            }
        }

        // Build live plane map and pre-calculate distance from active home
        var livePlaneMap = {};
        var homeCfg = _rfGetHomeConfig();
        var refLat = (homeCfg && typeof homeCfg.lat === 'number') ? homeCfg.lat : null;
        var refLon = (homeCfg && typeof homeCfg.lon === 'number') ? homeCfg.lon : null;
        var distByIcao = {};
        if (gReady()) {
            for (var lpi = 0; lpi < g.planesOrdered.length; lpi++) {
                var lp = g.planesOrdered[lpi];
                if (!lp.icao) continue;
                var lic = lp.icao.toUpperCase();
                livePlaneMap[lic] = lp;
                if (refLat !== null && refLon !== null) {
                    var ppos = _rfPlaneLatLon(lp);
                    if (ppos) distByIcao[lic] = haversineNm(refLat, refLon, ppos.lat, ppos.lon);
                }
            }
        }

        var searchEl5 = document.getElementById('rf-search');
        var search = ((searchEl5 && searchEl5.value) || '').toLowerCase();

        function matchesBaseAlerts(a) {
            var p = livePlaneMap[(a.icao || '').toUpperCase()];
            // Scope behavior:
            // - inview: must be live and currently in view
            // - filtered: must be live and pass current RF filters
            // - all: must be currently loaded by tar1090 (not constrained to in-view)
            if (_panelScope === 'inview') {
                if (!p || !p.inView) return false;
            } else if (_panelScope === 'filtered') {
                if (!p || !planePassesAllFilters(p, 'alerts')) return false;
            } else {
                if (!p) return false;
            }
            if (search) {
                var hay = (a.icao + ' ' + (a.reg||'') + ' ' + (a.operator||'') + ' ' + (a.type||'') + ' ' + (a.cmpg||'') + ' ' + (a.category||'') + ' ' + (a.tag1||'') + ' ' + (a.tag2||'') + ' ' + (a.tag3||'')).toLowerCase();
                if (!hay.includes(search)) return false;
            }
            return true;
        }
        function facetPassExcept(a, skipField) {
            if (skipField !== 'cmpg' && _alertsFilters.cmpg && a.cmpg !== _alertsFilters.cmpg) return false;
            if (skipField !== 'category' && _alertsFilters.category && a.category !== _alertsFilters.category) return false;
            if (skipField !== 'tag' && _alertsFilters.tag && a.tag1 !== _alertsFilters.tag && a.tag2 !== _alertsFilters.tag && a.tag3 !== _alertsFilters.tag) return false;
            return true;
        }

        // Cascading facet values: each dropdown is constrained by the other two.
        // Source can be live scoped rows, or full Plane Alert DB rows.
        var cmpgSet = new Set(), catSet = new Set(), tagSet = new Set();
        var useDbFacetSource = (settings.alertsFacetSource || 'db') === 'db';
        _alertsDb.forEach(function(a) {
            if (!useDbFacetSource && !matchesBaseAlerts(a)) return;
            if (facetPassExcept(a, 'cmpg') && a.cmpg) cmpgSet.add(a.cmpg);
            if (facetPassExcept(a, 'category') && a.category) catSet.add(a.category);
            if (facetPassExcept(a, 'tag')) {
                [a.tag1, a.tag2, a.tag3].forEach(function(t) { if (t) tagSet.add(t); });
            }
        });
        if (_alertsFilters.cmpg && !cmpgSet.has(_alertsFilters.cmpg)) _alertsFilters.cmpg = '';
        if (_alertsFilters.category && !catSet.has(_alertsFilters.category)) _alertsFilters.category = '';
        if (_alertsFilters.tag && !tagSet.has(_alertsFilters.tag)) _alertsFilters.tag = '';
        function makeSelect(id, title, vals, cur) {
            var h = '<select class="rf-country-select" id="' + id + '"><option value="">' + title + '</option>';
            Array.from(vals).sort().forEach(function(v) {
                h += '<option value="' + escAttr(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(v) + '</option>';
            });
            return h + '</select>';
        }
        if (ctrlEl) {
            ctrlEl.innerHTML =
                '<div class="rf-alerts-filters">' +
                    makeSelect('rf-al-cmpg', 'All Types', cmpgSet, _alertsFilters.cmpg) +
                    makeSelect('rf-al-cat',  'All Categories', catSet, _alertsFilters.category) +
                    makeSelect('rf-al-tag',  'All Tags', tagSet, _alertsFilters.tag) +
                '</div>' +
                '<div class="rf-alerts-checks">' +
                    '<button class="rf-cat-btn' + (_alertsMapFilter ? ' rf-cat-active rf-alerts-mapfilter-btn' : ' rf-alerts-mapfilter-btn') + '" id="rf-al-map-btn">' + (_alertsMapFilter ? 'Applied' : 'Apply') + '</button>' +
                    '<button class="rf-cat-btn' + (useDbFacetSource ? ' rf-cat-active' : '') + '" id="rf-al-facet-source-btn" title="Toggle whether facet dropdowns use full Plane Alert database values or only current live scoped aircraft">' + (useDbFacetSource ? 'Facets: Full DB' : 'Facets: Live scope') + '</button>' +
                    '<button class="rf-cat-btn" id="rf-al-clear-facets">Clear facets</button>' +
                    (_alertsSelectedIcaos.size > 0 ? '<button class="rf-cat-btn" id="rf-al-clear-selected">Clear selection</button>' : '') +
                    '<span class="rf-muted-mini" style="margin-left:6px" title="Plane Alert rows are based on aircraft currently loaded by tar1090 and then filtered by the top scope mode (All / In map view / Filtered view). In API/globe mode, loaded aircraft can change as you pan/zoom.">Scope: <strong>' + esc(_rfScopeBadgeLabel()) + '</strong> (from top scope control)</span>' +
                '</div>';
        }

        // Main filtered set
        function matchesFacet(a) {
            if (_alertsFilters.cmpg && a.cmpg !== _alertsFilters.cmpg) return false;
            if (_alertsFilters.category && a.category !== _alertsFilters.category) return false;
            if (_alertsFilters.tag && a.tag1 !== _alertsFilters.tag && a.tag2 !== _alertsFilters.tag && a.tag3 !== _alertsFilters.tag) return false;
            return matchesBaseAlerts(a);
        }
        function alertScore(a) {
            var mode = settings.alertsSortBy || 'distance';
            var icao = (a.icao || '').toUpperCase();
            if (mode === 'distance') {
                var d = distByIcao[icao];
                return typeof d === 'number' ? d : 999999;
            }
            if (mode === 'aircraft') {
                var p2 = livePlaneMap[icao];
                var nm = (p2 && (p2.flight || p2.name)) || a.operator || a.reg || a.icao || '';
                return String(nm).toLowerCase();
            }
            if (mode === 'operator') return String(a.operator || '').toLowerCase();
            if (mode === 'type') return String(a.cmpg || '').toLowerCase();
            if (mode === 'category') return String(a.category || '').toLowerCase();
            if (mode === 'tags') return String([a.tag1, a.tag2, a.tag3].filter(Boolean).join(', ')).toLowerCase();
            var score = 0;
            if (liveIcaos.has(icao)) score += 70;
            if (_alertsSelectedIcaos.has(icao)) score += 40;
            if (a.category) score += 8;
            if (a.cmpg) score += 6;
            if (a.link) score += 4;
            if (a.tag1 || a.tag2 || a.tag3) score += 6;
            return -score;
        }
        var liveCount = 0;
        var filtered = _alertsDb.filter(function(a) {
            var pass = matchesFacet(a);
            if (pass && liveIcaos.has(a.icao)) liveCount++;
            return pass;
        }).sort(function(a, b) {
            var mode = settings.alertsSortBy || 'distance';
            var av = alertScore(a), bv = alertScore(b);
            var dir = settings.alertsSortDir === 'desc' ? -1 : 1;
            if (mode === 'distance' || mode === 'live') return (av - bv) * dir;
            return String(av).localeCompare(String(bv)) * dir;
        });
        var displayed = filtered.slice(0, 300);
        var overflow = filtered.length > 300;

        var hotNow = displayed.filter(function(a) { return liveIcaos.has(a.icao); }).slice(0, 5);
        var html = '';
        if (hotNow.length > 0) {
            var modeLbl = _panelScope === 'inview' ? 'aircraft currently in map view' : (_panelScope === 'filtered' ? 'aircraft in filtered scope' : 'all loaded aircraft');
            html += '<div class="rf-al-hot-wrap"><div class="rf-al-hot-title">Hot now</div>' +
                '<div class="rf-al-hot-desc">Most relevant live Plane Alert matches in ' + esc(modeLbl) + '. Click one to isolate it.</div>' +
                '<div class="rf-al-hot-list">';
            hotNow.forEach(function(a) {
                var hp = livePlaneMap[(a.icao || '').toUpperCase()];
                var hName = (hp && (hp.flight || hp.name)) || a.operator || a.reg || a.icao;
                html += '<button class="rf-al-hot-chip" data-rf-action="toggle" data-rf-icao="' + escAttr(a.icao) + '">' +
                    '<span class="rf-al-hot-icao">' + esc(hName) + '</span>' +
                    '<span class="rf-al-hot-reg">' + esc(a.icao) + (a.category ? (' • ' + esc(a.category)) : '') + '</span>' +
                    '</button>';
            });
            html += '</div></div>';
        }

        function sortHdr(key, label) {
            var ind = settings.alertsSortBy === key ? (settings.alertsSortDir === 'desc' ? ' ▼' : ' ▲') : '';
            return '<button class="rf-al-th-btn" onclick="window._rfAlertsSetSort(\'' + escAttr(key) + '\')">' + esc(label) + ind + '</button>';
        }
        if (displayed.length === 0) {
            html += '<div class="rf-empty">No matches' + (search ? ' for "' + esc(search) + '"' : '') + '</div>';
        } else {
            html += '<div class="rf-al-table-wrap"><table class="rf-al-table"><thead><tr>' +
                '<th>' + sortHdr('aircraft', 'Aircraft') + '</th>' +
                '<th>' + sortHdr('type', 'Type') + '</th>' +
                '<th>' + sortHdr('category', 'Category') + '</th>' +
                '<th>' + sortHdr('tags', 'Tags') + '</th>' +
                '<th>' + sortHdr('distance', 'Dist') + '</th>' +
                '<th>Photo</th></tr></thead><tbody>';
            displayed.forEach(function(a) {
                var live = liveIcaos.has(a.icao);
                var sel = _alertsSelectedIcaos.has(a.icao);
                var tags = [a.tag1, a.tag2, a.tag3].filter(Boolean);
                var p = livePlaneMap[(a.icao || '').toUpperCase()];
                var inMapNow = !!(p && p.inView);
                var cs = p ? (p.flight || p.name || '') : '';
                var alt = p ? (typeof p.altitude === 'number' ? Math.round(p.altitude) : (typeof p.alt_baro === 'number' ? Math.round(p.alt_baro) : '')) : '';
                var spd = p ? (typeof p.gs === 'number' ? Math.round(p.gs) : '') : '';
                var dist = distByIcao[(a.icao || '').toUpperCase()];
                var friendlyTitle = cs || a.operator || a.reg || a.type || a.icao;
                var ringPct2 = (typeof dist === 'number') ? Math.max(0, Math.min(100, Math.round((1 - Math.min(dist, 250) / 250) * 100))) : 0;
                html += '<tr class="rf-al-tr' + (sel ? ' rf-al-tr-active' : '') + (live ? ' rf-al-tr-live' : '') + '">' +
                    '<td><button class="rf-al-aircraft-btn" data-rf-action="toggle" data-rf-icao="' + escAttr(a.icao) + '">' + (live ? '<span class="rf-al-live-dot"></span>' : '') + esc(friendlyTitle) + '</button><div class="rf-al-icao-sub">' + esc(a.icao) + (a.reg ? (' • ' + esc(a.reg)) : '') + (a.operator ? (' • ' + esc(a.operator)) : '') + '</div>' + (inMapNow ? '<div class="rf-al-map-now" title="Aircraft is currently inside the visible map viewport.">ON MAP</div>' : '<div class="rf-al-map-now rf-al-loaded-offmap" title="Aircraft is loaded by tar1090 but currently outside the visible map viewport.">LOADED</div>') + '</td>' +
                    '<td>' + ((a.cmpg || a.type || a.icaoType) ? '<button class="rf-al-pill rf-al-pill-cmpg" data-rf-action="facet" data-rf-field="cmpg" data-rf-value="' + escAttr(a.cmpg || '') + '">' + esc(a.cmpg || a.type || a.icaoType) + '</button>' : '') + '</td>' +
                    '<td>' + (a.category ? '<button class="rf-al-pill rf-al-pill-cat" data-rf-action="facet" data-rf-field="category" data-rf-value="' + escAttr(a.category) + '">' + esc(a.category) + '</button>' : '') + '</td>' +
                    '<td>' + tags.map(function(t) { return '<button class="rf-al-pill rf-al-pill-tag" data-rf-action="facet" data-rf-field="tag" data-rf-value="' + escAttr(t) + '">' + esc(t) + '</button>'; }).join('') + '</td>' +
                    '<td>' + (dist !== undefined ? ('<span class="rf-al-meta-chip"><span class="rf-al-dist-ring" style="--rfp:' + ringPct2 + '"></span>' + esc(dist.toFixed(1)) + ' nm</span><div class="rf-muted-mini">' + (alt !== '' ? ('ALT ' + esc(String(alt)) + ' ft ') : '') + (spd !== '' ? ('SPD ' + esc(String(spd)) + ' kt') : '') + '</div>') : '') + '</td>' +
                    '<td><div class="rf-al-photo" id="rf-al-photo-' + escAttr(a.icao) + '" data-icao="' + escAttr(a.icao) + '"></div></td>' +
                    '</tr>';
            });
            html += '</tbody></table></div>';
            if (overflow) html += '<div class="rf-empty" style="font-size:10px;padding:8px">Showing 300 of ' + filtered.length + ' \u2014 refine search</div>';
        }
        listEl.innerHTML = html;
        _rfHydrateAlertsPhotos(displayed.slice(0, 60));

        // Controls events
        if (ctrlEl) {
            var cmpgEl  = document.getElementById('rf-al-cmpg');
            var catEl   = document.getElementById('rf-al-cat');
            var tagEl   = document.getElementById('rf-al-tag');
            var mapBtn  = document.getElementById('rf-al-map-btn');
            var srcBtn  = document.getElementById('rf-al-facet-source-btn');
            var clrFBtn = document.getElementById('rf-al-clear-facets');
            var clrSBtn = document.getElementById('rf-al-clear-selected');
            if (cmpgEl) cmpgEl.onchange = window._rfAlertsFilter;
            if (catEl)  catEl.onchange  = window._rfAlertsFilter;
            if (tagEl)  tagEl.onchange  = window._rfAlertsFilter;
            if (mapBtn) mapBtn.onclick  = function() { window._rfToggleAlertsMap(!_alertsMapFilter); };
            if (srcBtn) srcBtn.onclick  = function() { window._rfSetAlertsFacetSource(useDbFacetSource ? 'live' : 'db'); };
            if (clrFBtn) clrFBtn.onclick = function() {
                _alertsFilters.cmpg = ''; _alertsFilters.category = ''; _alertsFilters.tag = '';
                buildPanel();
            };
            if (clrSBtn) clrSBtn.onclick = window._rfClearAlerts;
        }

        // Delegated list click handling
        listEl.onclick = function(ev) {
            var t = ev.target;
            if (!t) return;
            if (t.closest('a.rf-al-pill-link')) return;
            var n = t.closest('[data-rf-action]');
            if (!n) return;
            var action = n.getAttribute('data-rf-action');
            if (action === 'toggle') {
                window._rfToggleAlert((n.getAttribute('data-rf-icao') || '').toUpperCase());
            } else if (action === 'facet') {
                window._rfAlertsQuick(n.getAttribute('data-rf-field') || '', n.getAttribute('data-rf-value') || '');
            } else if (action === 'info') {
                window._rfAlertsMi((n.getAttribute('data-rf-icao') || '').toUpperCase());
            }
            ev.preventDefault();
            ev.stopPropagation();
        };

        if (statusEl) {
            var selCount = _alertsSelectedIcaos.size;
            statusEl.textContent = 'Loaded matches: ' + filtered.length +
                ' \u2022 live now: ' + liveCount +
                ' \u2022 DB total: ' + (_alertsDb ? _alertsDb.length : 0) +
                (selCount > 0 ? ' \u2022 ' + selCount + ' selected' : '');
        }
    }

    // ── Alerts window handlers ────────────────────────────────────────────────

    window._rfAlertsFilter = function () {
        var cmpgEl = document.getElementById('rf-al-cmpg');
        var catEl  = document.getElementById('rf-al-cat');
        var tagEl  = document.getElementById('rf-al-tag');
        if (cmpgEl) _alertsFilters.cmpg     = cmpgEl.value;
        if (catEl)  _alertsFilters.category  = catEl.value;
        if (tagEl)  _alertsFilters.tag       = tagEl.value;
        if (_alertsMapFilter) { buildAlertsMapFilterSet(); applyFilter(); }
        buildPanel();
        _rfSyncSelectionMapView();
    };

    window._rfAlertsSetSort = function (key) {
        if (settings.alertsSortBy === key) {
            settings.alertsSortDir = settings.alertsSortDir === 'desc' ? 'asc' : 'desc';
        } else {
            settings.alertsSortBy = key;
            settings.alertsSortDir = 'asc';
        }
        _rfSaveSettings();
        buildPanel();
    };

    window._rfAlertsQuick = function (field, value) {
        if (!value) return;
        if (field === 'cmpg') _alertsFilters.cmpg = (_alertsFilters.cmpg === value ? '' : value);
        else if (field === 'category') _alertsFilters.category = (_alertsFilters.category === value ? '' : value);
        else if (field === 'tag') _alertsFilters.tag = (_alertsFilters.tag === value ? '' : value);
        if (_alertsMapFilter) { buildAlertsMapFilterSet(); applyFilter(); }
        buildPanel();
        _rfSyncSelectionMapView();
    };

    window._rfClearAlertsFacets = function () {
        _alertsFilters.cmpg = ''; _alertsFilters.category = ''; _alertsFilters.tag = '';
        if (_alertsMapFilter) { buildAlertsMapFilterSet(); applyFilter(); }
        buildPanel();
        _rfSyncSelectionMapView();
    };

    window._rfToggleAlertsMap = function (on) {
        _alertsMapFilter = !!on;
        buildAlertsMapFilterSet();
        applyFilter();
        buildPanel();
        _rfSyncSelectionMapView();
    };

    window._rfToggleAlert = function (elOrIcao) {
        var icao = typeof elOrIcao === 'string' ? elOrIcao : ((elOrIcao && elOrIcao.dataset) ? (elOrIcao.dataset.icao || '') : '');
        icao = (icao || '').toUpperCase();
        if (!icao) return;
        if (_alertsSelectedIcaos.has(icao)) _alertsSelectedIcaos.delete(icao);
        else _alertsSelectedIcaos.add(icao);
        applyFilter();
        buildPanel();
        _rfSyncSelectionMapView();
    };

    window._rfClearAlerts = function () {
        _alertsSelectedIcaos.clear();
        applyFilter();
        buildPanel();
        _rfSyncSelectionMapView();
    };

    window._rfAlertsMi = function (icao) {
        _alertsMoreInfo = icao;
        buildPanel();
    };

    function _rfHydrateAlertsPhotos(items) {
        if (!Array.isArray(items)) return;
        for (var i = 0; i < items.length; i++) {
            var a = items[i];
            if (!a || !a.icao) continue;
            (function (icao) {
                var box = document.getElementById('rf-al-photo-' + icao);
                if (!box) return;
                var cached = _alertsPhotoCache[icao];
                if (cached && cached.url) {
                    box.innerHTML = '<img class="rf-al-photo-img" src="' + _rfEscAttr(cached.url) + '" alt="' + _rfEscAttr(icao) + '">';
                    return;
                }
                if (cached && cached.url === null) {
                    box.innerHTML = '<div class="rf-al-photo-empty">No photo</div>';
                    return;
                }
                if (_alertsPhotoInflight[icao]) return;
                _alertsPhotoInflight[icao] = true;
                _rfFetchPlanePhoto(icao, function (url) {
                    _alertsPhotoCache[icao] = { url: url || null, ts: Date.now() };
                    delete _alertsPhotoInflight[icao];
                    var box2 = document.getElementById('rf-al-photo-' + icao);
                    if (!box2) return;
                    if (url) box2.innerHTML = '<img class="rf-al-photo-img" src="' + _rfEscAttr(url) + '" alt="' + _rfEscAttr(icao) + '">';
                    else box2.innerHTML = '<div class="rf-al-photo-empty">No photo</div>';
                });
            })((a.icao || '').toUpperCase());
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // §17 Tab: Distance
    // ═══════════════════════════════════════════════════════════════════════════

    /** Wrapper kept for symmetry with v1 callers; v2 uses _rfSaveDistance() directly. */
    function _rfPersistDistFilter() { _rfSaveDistance(); }

    function buildDistancePanel() {
        buildBreadcrumb();
        var searchEl = document.getElementById('rf-search');
        if (searchEl) searchEl.style.display = 'none';
        var ctrlEl = document.getElementById('rf-controls');
        if (ctrlEl) ctrlEl.innerHTML = '';
        var hdrEl = document.getElementById('rf-colheader');
        if (hdrEl) hdrEl.innerHTML = '';

        var altAll = _distanceForm.altMode !== 'between';
        var altRng = altAll ? 'display:none' : '';

        var listEl = document.getElementById('rf-list');
        if (listEl) {
            if (!_distanceForm.lat || !_distanceForm.lon) {
                var rp0 = _rfGetReceiverPos();
                _distanceForm.lat = rp0.lat.toFixed(5);
                _distanceForm.lon = rp0.lon.toFixed(5);
            }

            var ZONE_COLORS_UI = ['#00c8e6','#f0e040','#e040fb','#69f080','#ff9800','#ff4444'];
            var zonesHtml = '';
            if (_distanceZones.length > 0) {
                zonesHtml += '<div class="rf-setting-section-title" style="margin:4px 0">Active Zones (' + _distanceZones.length + ')</div>';
                zonesHtml += '<div class="rf-dist-mode-note">Mode: ' + (_distanceMode === 'outside' ? 'Outside zones (exclude inside)' : (_distanceMode === 'maponly' ? 'Map only (no filtering)' : 'Inside zones')) + '</div>';
                zonesHtml += '<div class="rf-dist-active-zone-list">';
                _distanceZones.forEach(function(z, i) {
                    var c = ZONE_COLORS_UI[i % ZONE_COLORS_UI.length];
                    var altInfo = z.altMode === 'between' ? ' \u2014 ' + z.altMin.toLocaleString() + '\u2013' + z.altMax.toLocaleString() + 'ft' : '';
                    zonesHtml +=
                        '<div class="rf-dist-zone-pill">' +
                        '<span class="rf-dist-zone-dot" style="background:' + c + '"></span>' +
                        '<span class="rf-dist-zone-pill-text">' +
                        z.name.replace(/&/g,'&amp;').replace(/</g,'&lt;') + ' \u2014 ' + z.radiusNm + '\u00a0NM' + altInfo +
                        '</span>' +
                        '<button class="rf-dist-pill-x" onclick="window._rfDistRemoveZone(' + i + ')" title="Remove this zone">\u2715</button>' +
                        '</div>';
                });
                zonesHtml += '</div>';
                zonesHtml +=
                    '<div style="display:flex;gap:6px;margin:4px 0 6px">' +
                    '<button class="rf-cat-btn rf-dist-clearbtn" onclick="window._rfDistClear()">Clear All</button>' +
                    '<button class="rf-cat-btn" onclick="window._rfPanToDistZone()" title="Pan the main map to fit all filter zones">&#x1F50D; Pan to zones</button>' +
                    '</div>' +
                    '<div class="rf-setting-divider"></div>';
            }

            var savedLocsHtml = '';
            if (_distanceLocations.length > 0) {
                savedLocsHtml += '<div class="rf-setting-section-title" style="margin:4px 0">Saved Locations</div>';
                savedLocsHtml += '<div class="rf-dist-saved-list">';
                _distanceLocations.forEach(function(loc, idx) {
                    var isActive = _distanceZones.some(function(z) { return z.name === loc.name; });
                    savedLocsHtml +=
                        '<div class="rf-dist-saved-row' + (isActive ? ' rf-dist-saved-active' : '') + '">' +
                        '<div class="rf-dist-saved-info">' +
                        '<span class="rf-dist-saved-name">' + loc.name.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>' +
                        '<span class="rf-dist-saved-detail">' + loc.lat.toFixed(4) + ', ' + loc.lon.toFixed(4) + ' \u2014 ' + loc.radiusNm + '\u00a0NM</span>' +
                        '</div>' +
                        '<div style="display:flex;gap:3px;flex-shrink:0">' +
                        '<button class="rf-cat-btn' + (isActive ? ' rf-cat-active' : '') + '" style="min-width:74px" onclick="window._rfDistToggleLoc(' + idx + ')" title="' + (isActive ? 'Remove from active zones' : 'Add to active zones') + '">' +
                        (isActive ? '&#x2713;\u00a0Active' : '+\u00a0Activate') +
                        '</button>' +
                        '<button class="rf-cat-btn" onclick="window._rfDistLoadLoc(' + idx + ')" title="Load into form to edit">Edit</button>' +
                        '<button class="rf-cat-btn rf-dist-delbtn" onclick="window._rfDistDeleteLoc(' + idx + ')" title="Delete saved location">&#x1F5D1;</button>' +
                        '</div>' +
                        '</div>';
                });
                savedLocsHtml += '</div><div class="rf-setting-divider"></div>';
            }

            listEl.innerHTML =
                '<div class="rf-dist-content">' +
                '<div id="rf-dist-map" class="rf-dist-map"></div>' +
                zonesHtml +
                '<div class="rf-setting-section-title" style="margin:4px 0">Add Zone</div>' +
                '<div class="rf-dist-row">' +
                '<span id="rf-dist-coords" class="rf-dist-coords">' +
                ((_distanceForm.lat && _distanceForm.lon) ? parseFloat(_distanceForm.lat).toFixed(5) + ', ' + parseFloat(_distanceForm.lon).toFixed(5) : 'Click the map to set a centre point') +
                '</span>' +
                '<button class="rf-cat-btn rf-dist-savebtn" onclick="window._rfDistUseCurrent()">Use map centre</button>' +
                '</div>' +
                '<div class="rf-dist-row">' +
                '<label class="rf-dist-label">Name</label>' +
                '<input id="rf-dist-name" class="rf-dist-input" type="text" placeholder="e.g. Home"' +
                ' value="' + _distanceForm.locationName.replace(/"/g, '&quot;') + '"' +
                ' oninput="window._rfDistFormUpdate(\'locationName\',this.value)">' +
                '</div>' +
                '<div class="rf-dist-row">' +
                '<label class="rf-dist-label">Radius</label>' +
                '<input id="rf-dist-radius" class="rf-dist-input rf-dist-small" type="number" min="1" max="9999"' +
                ' value="' + _distanceForm.radiusNm + '" oninput="window._rfDistRadiusChanged(this.value)">' +
                '<span class="rf-dist-unit">NM</span>' +
                '</div>' +
                '<div class="rf-dist-mode-wrap">' +
                '<button class="rf-sum-scope-btn' + (_distanceMode === 'inside' ? ' rf-sum-scope-active' : '') + '" onclick="window._rfSetDistMode(\'inside\')" title="Filter to aircraft inside active zone(s)">Inside</button>' +
                '<button class="rf-sum-scope-btn' + (_distanceMode === 'outside' ? ' rf-sum-scope-active' : '') + '" onclick="window._rfSetDistMode(\'outside\')" title="Filter to aircraft outside active zone(s)">Outside</button>' +
                '<button class="rf-sum-scope-btn' + (_distanceMode === 'maponly' ? ' rf-sum-scope-active' : '') + '" onclick="window._rfSetDistMode(\'maponly\')" title="Do not filter aircraft; only draw active zone(s) on map">Map only</button>' +
                '</div>' +
                '<div class="rf-dist-row" style="margin-top:4px;gap:6px">' +
                '<button class="rf-cat-btn rf-cat-active" onclick="window._rfDistApply()" title="Add this zone to the active filter">+ Add Zone</button>' +
                ((_distanceForm.lat && _distanceForm.lon) ? '<button class="rf-cat-btn rf-dist-savebtn" onclick="window._rfDistSaveLoc()" title="Save this location and add as an active zone">&#128190; Save &amp; Add</button>' : '') +
                '</div>' +
                '<div class="rf-setting-divider"></div>' +
                savedLocsHtml +
                '<div class="rf-setting-section-title" style="margin:4px 0">Altitude</div>' +
                '<div class="rf-dist-row rf-dist-alt-row">' +
                '<label class="rf-dist-radio-label"><input type="radio" name="rf-dist-alt" value="all" id="rf-dist-alt-all"' + (altAll ? ' checked' : '') + ' onchange="window._rfDistAltMode(\'all\')"> All altitudes</label>' +
                '<label class="rf-dist-radio-label"><input type="radio" name="rf-dist-alt" value="between" id="rf-dist-alt-btw"' + (!altAll ? ' checked' : '') + ' onchange="window._rfDistAltMode(\'between\')"> Between</label>' +
                '</div>' +
                '<div id="rf-dist-alt-range" style="' + altRng + '">' +
                '<div class="rf-dist-row">' +
                '<input id="rf-dist-alt-min" class="rf-dist-input rf-dist-small" type="number" min="0" max="99999"' +
                ' value="' + _distanceForm.altMin + '" oninput="window._rfDistFormUpdate(\'altMin\',this.value)">' +
                '<span class="rf-dist-unit">ft</span>' +
                '<span class="rf-dist-to">to</span>' +
                '<input id="rf-dist-alt-max" class="rf-dist-input rf-dist-small" type="number" min="0" max="99999"' +
                ' value="' + _distanceForm.altMax + '" oninput="window._rfDistFormUpdate(\'altMax\',this.value)">' +
                '<span class="rf-dist-unit">ft</span>' +
                '</div>' +
                '</div>' +
                '</div>';

            setTimeout(function() { _rfInitDistMap(); }, 0);
        }

        var statusEl = document.getElementById('rf-status');
        if (statusEl) {
            if (_distanceZones.length > 0 && gReady()) {
                var cnt = 0;
                for (var di = 0; di < g.planesOrdered.length; di++) {
                    if (planePassesDistanceFilter(g.planesOrdered[di])) cnt++;
                }
                if (_distanceMode === 'outside') statusEl.textContent = cnt + ' aircraft outside zone' + (_distanceZones.length > 1 ? 's' : '');
                else if (_distanceMode === 'maponly') statusEl.textContent = 'Map only mode (no aircraft filtering)';
                else statusEl.textContent = cnt + ' aircraft in zone' + (_distanceZones.length > 1 ? 's' : '');
            } else {
                statusEl.textContent = '';
            }
        }
    }

    // ── Distance window handlers ──────────────────────────────────────────────

    window._rfPanToDistZone = function () {
        try {
            var map = _rfOLMap();
            if (_distanceZones.length === 0 || !gReady() || !map || !window.ol) return;
            var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            _distanceZones.forEach(function(zone) {
                var c = ol.proj.fromLonLat([zone.lon, zone.lat]);
                var r = zone.radiusNm * 1852 * 1.35;
                if (c[0] - r < minX) minX = c[0] - r;
                if (c[1] - r < minY) minY = c[1] - r;
                if (c[0] + r > maxX) maxX = c[0] + r;
                if (c[1] + r > maxY) maxY = c[1] + r;
            });
            map.getView().fit([minX, minY, maxX, maxY], { duration: _rfAnimDuration(600), padding: [30, 30, 30, 30] });
        } catch(e) {}
    };

    window._rfDistRadiusChanged = function (val) {
        _distanceForm.radiusNm = val;
        if (_distMapCircle) {
            var nm = parseFloat(val) || 50;
            _distMapCircle.setRadius(nm * 1852);
        }
    };

    window._rfDistUseCurrent = function () {
        var rp = _rfGetReceiverPos();
        _distanceForm.lat = rp.lat.toFixed(5);
        _distanceForm.lon = rp.lon.toFixed(5);
        _rfUpdateDistMapPin(rp.lat, rp.lon);
        var coordEl = document.getElementById('rf-dist-coords');
        if (coordEl) coordEl.textContent = _distanceForm.lat + ', ' + _distanceForm.lon;
    };

    window._rfDistFormUpdate = function (field, value) {
        _distanceForm[field] = value;
    };

    window._rfDistLoadLoc = function (idx) {
        var loc = _distanceLocations[idx];
        if (!loc) return;
        _distanceForm.locationIdx  = idx;
        _distanceForm.locationName = loc.name;
        _distanceForm.lat          = String(loc.lat);
        _distanceForm.lon          = String(loc.lon);
        _distanceForm.radiusNm     = String(loc.radiusNm);
        buildPanel();
    };

    window._rfDistToggleLoc = function (idx) {
        var loc = _distanceLocations[idx];
        if (!loc) return;
        var existingIdx = -1;
        for (var i = 0; i < _distanceZones.length; i++) {
            if (_distanceZones[i].name === loc.name) { existingIdx = i; break; }
        }
        if (existingIdx >= 0) {
            _distanceZones.splice(existingIdx, 1);
        } else {
            _distanceZones.push({
                lat: loc.lat, lon: loc.lon, radiusNm: loc.radiusNm, name: loc.name,
                altMode: _distanceForm.altMode,
                altMin:  parseInt(_distanceForm.altMin,  10) || 0,
                altMax:  parseInt(_distanceForm.altMax,  10) || 50000,
            });
        }
        _rfSaveDistance();
        applyFilter();
        buildPanel();
    };

    window._rfDistSaveLoc = function () {
        var name   = _distanceForm.locationName.trim();
        var lat    = parseFloat(_distanceForm.lat);
        var lon    = parseFloat(_distanceForm.lon);
        var radius = parseFloat(_distanceForm.radiusNm);
        if (!name)                                 { alert('Please enter a name for this location.'); return; }
        if (isNaN(lat) || lat < -90 || lat > 90)   { alert('Enter a valid latitude (-90 to 90).'); return; }
        if (isNaN(lon) || lon < -180 || lon > 180) { alert('Enter a valid longitude (-180 to 180).'); return; }
        if (isNaN(radius) || radius < 1)           { alert('Enter a valid radius (minimum 1 NM).'); return; }
        var loc = { name: name, lat: lat, lon: lon, radiusNm: radius };
        var existing = -1;
        for (var i = 0; i < _distanceLocations.length; i++) {
            if (_distanceLocations[i].name === name) { existing = i; break; }
        }
        if (existing >= 0) {
            _distanceLocations[existing] = loc;
            _distanceForm.locationIdx    = existing;
        } else {
            _distanceLocations.push(loc);
            _distanceForm.locationIdx    = _distanceLocations.length - 1;
        }
        _rfSaveDistance();
        var savedZone = {
            lat: loc.lat, lon: loc.lon, radiusNm: loc.radiusNm, name: loc.name,
            altMode: _distanceForm.altMode,
            altMin:  parseInt(_distanceForm.altMin, 10) || 0,
            altMax:  parseInt(_distanceForm.altMax, 10) || 50000,
        };
        var existingZoneIdx = -1;
        for (var j = 0; j < _distanceZones.length; j++) {
            if (_distanceZones[j].name === loc.name) { existingZoneIdx = j; break; }
        }
        if (existingZoneIdx >= 0) _distanceZones[existingZoneIdx] = savedZone;
        else _distanceZones.push(savedZone);
        _rfSaveDistance();
        _rfPersistSnapshot();
        applyFilter();
        buildPanel();
    };

    window._rfDistDeleteLoc = function (idx) {
        if (idx === undefined) idx = _distanceForm.locationIdx;
        idx = parseInt(idx, 10);
        if (isNaN(idx) || idx < 0 || idx >= _distanceLocations.length) return;
        var locName = _distanceLocations[idx].name;
        _distanceLocations.splice(idx, 1);
        _distanceForm.locationIdx = -1;
        _distanceZones = _distanceZones.filter(function(z) { return z.name !== locName; });
        _rfSaveDistance();
        _rfPersistSnapshot();
        applyFilter();
        buildPanel();
    };

    window._rfDistAltMode = function (mode) {
        _distanceForm.altMode = mode;
        var rangeEl = document.getElementById('rf-dist-alt-range');
        if (rangeEl) rangeEl.style.display = mode === 'between' ? '' : 'none';
    };

    window._rfSetDistMode = function (mode) {
        if (mode !== 'inside' && mode !== 'outside' && mode !== 'maponly') mode = 'inside';
        _distanceMode = mode;
        _rfSaveDistance();
        applyFilter();
        buildPanel();
    };

    window._rfDistApply = function () {
        var radiusEl = document.getElementById('rf-dist-radius');
        var nameEl   = document.getElementById('rf-dist-name');
        var altBtwEl = document.getElementById('rf-dist-alt-btw');
        var altMinEl = document.getElementById('rf-dist-alt-min');
        var altMaxEl = document.getElementById('rf-dist-alt-max');
        if (radiusEl) _distanceForm.radiusNm     = radiusEl.value;
        if (nameEl)   _distanceForm.locationName = nameEl.value;
        if (altBtwEl) _distanceForm.altMode      = altBtwEl.checked ? 'between' : 'all';
        if (altMinEl) _distanceForm.altMin       = altMinEl.value;
        if (altMaxEl) _distanceForm.altMax       = altMaxEl.value;

        var lat    = parseFloat(_distanceForm.lat);
        var lon    = parseFloat(_distanceForm.lon);
        var radius = parseFloat(_distanceForm.radiusNm);
        if (isNaN(lat) || lat < -90 || lat > 90)   { alert('Click the map to set a centre point first.'); return; }
        if (isNaN(lon) || lon < -180 || lon > 180) { alert('Click the map to set a centre point first.'); return; }
        if (isNaN(radius) || radius < 1)           { alert('Enter a valid radius (minimum 1 NM).'); return; }

        var zoneName = _distanceForm.locationName.trim() || (lat.toFixed(4) + ', ' + lon.toFixed(4));
        var newZone = {
            lat: lat, lon: lon, radiusNm: radius, name: zoneName,
            altMode: _distanceForm.altMode,
            altMin:  parseInt(_distanceForm.altMin, 10) || 0,
            altMax:  parseInt(_distanceForm.altMax, 10) || 50000,
        };
        var existingApplyIdx = -1;
        for (var k = 0; k < _distanceZones.length; k++) {
            if (_distanceZones[k].name === zoneName) { existingApplyIdx = k; break; }
        }
        if (existingApplyIdx >= 0) _distanceZones[existingApplyIdx] = newZone;
        else _distanceZones.push(newZone);
        _rfSaveDistance();
        applyFilter();
        buildPanel();
    };

    window._rfDistClear = function () {
        _distanceZones = [];
        _rfSaveDistance();
        applyFilter();
        buildPanel();
    };

    window._rfDistRemoveZone = function (idx) {
        _distanceZones.splice(idx, 1);
        _rfSaveDistance();
        applyFilter();
        buildPanel();
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // §18 Tab: Ranges
    // ═══════════════════════════════════════════════════════════════════════════

    function _rfRenderRangesTab() {
        var f = _rangesFilter;
        var esc = _rfEscAttr;
        function numInput(field, val, placeholder, min, max, step) {
            return '<input class="rf-rng-input" type="number" placeholder="' + placeholder + '"' +
                ' min="' + min + '" max="' + max + '" step="' + (step || '1') + '"' +
                ' value="' + esc(val) + '"' +
                ' onchange="window._rfSetRange(\'' + field + '\',this.value)">';
        }
        function row(label, leftInput, rightInput) {
            return '<div class="rf-rng-row">' +
                '<span class="rf-rng-label">' + label + '</span>' +
                '<span class="rf-rng-pair">' + leftInput + '<span class="rf-rng-sep">to</span>' + rightInput + '</span>' +
                '</div>';
        }
        var sqBtns = ['7700','7600','7500','1200'];
        var sqHtml = '<div class="rf-rng-sq-btns">';
        sqBtns.forEach(function(sq) {
            var active = f.squawk === sq ? ' rf-cat-active' : '';
            sqHtml += '<button class="rf-cat-btn' + active + '" onclick="window._rfSetRangeSquawk(\'' + sq + '\')">' + sq + '</button>';
        });
        sqHtml += '</div>';
        var html = '<div class="rf-rng-content">';
        html += '<div class="rf-rng-section-title">Speed (knots)</div>';
        html += row('', numInput('speedMin', f.speedMin, 'Min', 0, 2000), numInput('speedMax', f.speedMax, 'Max', 0, 2000));
        html += '<div class="rf-rng-section-title">Altitude (feet)</div>';
        html += row('', numInput('altMin', f.altMin, 'Min', -1500, 60000), numInput('altMax', f.altMax, 'Max', -1500, 60000));
        html += '<div class="rf-rng-section-title">Vertical Rate (fpm)</div>';
        html += row('', numInput('vrMin', f.vrMin, 'Min', -10000, 10000), numInput('vrMax', f.vrMax, 'Max', -10000, 10000));
        html += '<div class="rf-rng-section-title">Squawk</div>';
        html += '<div class="rf-rng-row"><input class="rf-rng-input rf-rng-full" type="text" placeholder="e.g. 7700 or 1200-1277 or 7700,7600"' +
            ' value="' + esc(f.squawk) + '" onchange="window._rfSetRange(\'squawk\',this.value)"></div>';
        html += sqHtml;
        html += '<div class="rf-rng-section-title">Age on Scope (minutes)</div>';
        html += row('', numInput('ageMin', f.ageMin, 'Min', 0, 9999), numInput('ageMax', f.ageMax, 'Max', 0, 9999));
        html += '<div class="rf-rng-section-title">Callsign / ICAO Search</div>';
        html += '<div class="rf-rng-row"><input class="rf-rng-input rf-rng-full" type="text" placeholder="Search (supports * wildcard)"' +
            ' value="' + esc(f.callsign) + '" onchange="window._rfSetRange(\'callsign\',this.value)"></div>';
        if (_rfRangesFilterActive()) {
            html += '<div style="margin-top:8px"><button class="rf-cat-btn" onclick="window._rfClearRanges()">Clear All Range Filters</button></div>';
        }
        html += '</div>';
        return html;
    }

    // ── Ranges window handlers ────────────────────────────────────────────────

    window._rfSetRange = function (field, val) {
        if (!_rangesFilter.hasOwnProperty(field)) return;
        _rangesFilter[field] = String(val || '');
        _rfSaveRanges();
        applyFilter();
        buildPanel();
    };

    window._rfSetRangeSquawk = function (sq) {
        _rangesFilter.squawk = (_rangesFilter.squawk === sq) ? '' : sq;
        _rfSaveRanges();
        applyFilter();
        buildPanel();
    };

    window._rfClearRanges = function () {
        var rk = Object.keys(_rangesFilter);
        for (var ri = 0; ri < rk.length; ri++) _rangesFilter[rk[ri]] = '';
        _rfSaveRanges();
        applyFilter();
        buildPanel();
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // §19 Tab: Watchlist
    // ═══════════════════════════════════════════════════════════════════════════

    // Sort state for the watchlist table
    var _wlSortBy  = 'lastSeen'; // 'lastSeen' | 'priority' | 'label' | 'source'
    var _wlSortDir = 'desc';

    // Current search query and results cache
    var _wlSearchQuery   = '';
    var _wlSearchResults = null; // {live: [...], alertDb: [...]} or null

    // Undo buffer for last remove operation
    var _wlUndoEntry = null; // {entry, idx}
    var _wlUndoTimer = null;

    // Priority order for sorting
    var WL_PRIORITY_ORDER = { critical: 0, high: 1, normal: 2, low: 3 };

    // ── Entry factory ─────────────────────────────────────────────────────────

    /**
     * Create a v2 watchlist entry from a raw ICAO + label.
     * status: 'active' if the plane is currently on scope, else 'not_seen_yet'.
     */
    function _wlMakeEntry(icao, label, source, sourceRef, isLiveNow) {
        return {
            icao:       icao.toUpperCase(),
            label:      label || '',
            added:      Date.now(),
            source:     source     || 'manual',
            sourceRef:  sourceRef  || null,
            status:     isLiveNow  ? 'active' : 'not_seen_yet',
            priority:   'normal',
            tags:       [],
            firstSeenAt: isLiveNow ? Date.now() : null,
            lastSeenAt:  isLiveNow ? Date.now() : null
        };
    }

    // ── Dormant entry activation ──────────────────────────────────────────────

    /**
     * Called on each panel refresh. Checks if any dormant (not_seen_yet) entries
     * now have a matching live plane and promotes them to active.
     * Returns true if any entries were promoted (caller may want to redraw).
     */
    function _wlActivateDormantEntries() {
        if (!gReady()) return false;
        var changed = false;
        var liveSet = new Set();
        for (var i = 0; i < g.planesOrdered.length; i++) {
            if (g.planesOrdered[i].icao) liveSet.add(g.planesOrdered[i].icao.toUpperCase());
        }
        for (var wi = 0; wi < _watchList.length; wi++) {
            var e = _watchList[wi];
            if (e.status === 'not_seen_yet' && liveSet.has(e.icao)) {
                e.status      = 'active';
                e.firstSeenAt = e.firstSeenAt || Date.now();
                e.lastSeenAt  = Date.now();
                changed       = true;
            } else if (e.status === 'active' && liveSet.has(e.icao)) {
                e.lastSeenAt  = Date.now();
                changed       = true;
            }
        }
        if (changed) _rfSaveWatchlist();
        return changed;
    }

    // ── Unified search engine ─────────────────────────────────────────────────

    /**
     * Run a unified search across live planes and alerts DB.
     * Returns {live: [...], alertDb: [...]} where each item has fields
     * suitable for the result list UI.
     * Respects watchlistSettings.search config.
     */
    function _wlSearch(query) {
        var cfg     = watchlistSettings.search;
        var q       = (query || '').trim().toUpperCase();
        var minLen  = cfg.minQueryLength || 2;
        if (q.length < minLen) return { live: [], alertDb: [] };

        var maxResults = cfg.maxResults || 100;
        var liveResults = [], alertResults = [];

        // Existing watchlist ICAOs (to flag duplicates)
        var existingIcaos = new Set(_watchList.map(function (e) { return e.icao; }));

        // ── Search live planes ──────────────────────────────────────────────
        if (cfg.includeLivePlanes && gReady()) {
            for (var pi = 0; pi < g.planesOrdered.length && liveResults.length < maxResults; pi++) {
                var plane = g.planesOrdered[pi];
                if (!plane.icao) continue;
                var icao = plane.icao.toUpperCase();
                var cs   = ((plane.flight || plane.name || '')).toUpperCase();
                var type = (plane.typeLong || plane.icaoType || '').toUpperCase();
                var match = false;
                if (cfg.fuzzyMatch) {
                    match = icao.indexOf(q) >= 0 || cs.indexOf(q) >= 0 || type.indexOf(q) >= 0;
                } else {
                    match = icao === q || cs === q;
                }
                if (!match) continue;
                var rcInfo = getRegCountryFromIcao(icao);
                liveResults.push({
                    icao:      icao,
                    label:     cs || icao,
                    type:      plane.typeLong || plane.icaoType || '',
                    country:   rcInfo ? rcInfo.name : '',
                    countryIso2: rcInfo ? rcInfo.iso2 : '',
                    source:    'live',
                    isDuplicate: existingIcaos.has(icao)
                });
            }
        }

        // ── Search alerts DB ────────────────────────────────────────────────
        if (cfg.includeAlertsDb && _alertsDb) {
            // Build live ICAO set for marking "live now" in alert results
            var liveIcaos = new Set();
            if (gReady()) {
                for (var li = 0; li < g.planesOrdered.length; li++) {
                    if (g.planesOrdered[li].icao) liveIcaos.add(g.planesOrdered[li].icao.toUpperCase());
                }
            }
            for (var ai = 0; ai < _alertsDb.length && alertResults.length < maxResults; ai++) {
                var a = _alertsDb[ai];
                if (!a.icao) continue;
                var aicao = a.icao.toUpperCase();
                var aMatch = false;
                if (cfg.fuzzyMatch) {
                    var hay = (aicao + ' ' + a.reg + ' ' + a.operator + ' ' + a.type +
                               ' ' + a.cmpg + ' ' + a.category).toUpperCase();
                    aMatch = hay.indexOf(q) >= 0;
                } else {
                    aMatch = aicao === q || (a.reg || '').toUpperCase() === q;
                }
                if (!aMatch) continue;
                alertResults.push({
                    icao:        aicao,
                    label:       a.operator || a.reg || aicao,
                    type:        a.type || a.icaoType || '',
                    cmpg:        a.cmpg || '',
                    category:    a.category || '',
                    tags:        [a.tag1, a.tag2, a.tag3].filter(Boolean),
                    source:      'alertDb',
                    isLiveNow:   liveIcaos.has(aicao),
                    isDuplicate: existingIcaos.has(aicao)
                });
            }
        }

        return { live: liveResults, alertDb: alertResults };
    }

    // ── Add / remove / edit operations ────────────────────────────────────────

    /**
     * Add an entry to the watchlist.
     * Merges silently if the ICAO already exists (updates label if blank).
     * Shows toast feedback on duplicate.
     * Returns true if added, false if duplicate.
     */
    function _wlAdd(icao, label, source, sourceRef) {
        icao = (icao || '').toUpperCase().replace(/[^A-F0-9]/g, '');
        if (!icao) return false;
        if (_watchList.length >= watchlistSettings.maxEntries) {
            _rfShowToastSimple('Watchlist full (' + watchlistSettings.maxEntries + ' max)');
            return false;
        }
        // Duplicate check
        for (var wi = 0; wi < _watchList.length; wi++) {
            if (_watchList[wi].icao === icao) {
                // Update label if we now have more info
                if (label && !_watchList[wi].label) _watchList[wi].label = label;
                _rfSaveWatchlist();
                _rfShowToastSimple(icao + ' already on watchlist');
                return false;
            }
        }
        var isLive = gReady() && g.planesOrdered.some(function (p) {
            return p.icao && p.icao.toUpperCase() === icao;
        });
        var entry = _wlMakeEntry(icao, label, source || 'manual', sourceRef || null, isLive);
        if (!isLive && !watchlistSettings.allowDormantEntries) {
            _rfShowToastSimple(icao + ' not on scope — dormant entries disabled');
            return false;
        }
        _watchList.push(entry);
        _rfSaveWatchlist();
        applyFilter();
        return true;
    }

    /**
     * Add entry and also enable map filter so only watched aircraft show.
     */
    function _wlAddAndMapFilter(icao, label, source, sourceRef) {
        if (_wlAdd(icao, label, source, sourceRef)) {
            _watchlistMapFilter = true;
            _rfSaveWatchlist();
            applyFilter();
        }
    }

    /**
     * Add entry and enable watchlist notifications.
     */
    function _wlAddAndNotify(icao, label, source, sourceRef) {
        if (_wlAdd(icao, label, source, sourceRef)) {
            _notifSettings.watchlist = true;
            _rfSaveNotifSettings();
        }
    }

    /**
     * Remove a watchlist entry by index with undo support.
     */
    function _wlRemove(idx) {
        if (idx < 0 || idx >= _watchList.length) return;
        _wlUndoEntry = { entry: JSON.parse(JSON.stringify(_watchList[idx])), idx: idx };
        _watchList.splice(idx, 1);
        _rfSaveWatchlist();
        applyFilter();
        // Auto-clear undo buffer after 8 seconds
        if (_wlUndoTimer) clearTimeout(_wlUndoTimer);
        _wlUndoTimer = setTimeout(function () { _wlUndoEntry = null; _wlUndoTimer = null; }, 8000);
        _rfRefreshPanel();
    }

    /**
     * Undo the last remove operation.
     */
    function _wlUndoRemove() {
        if (!_wlUndoEntry) return;
        var e   = _wlUndoEntry.entry;
        var idx = Math.min(_wlUndoEntry.idx, _watchList.length);
        _watchList.splice(idx, 0, e);
        _wlUndoEntry = null;
        if (_wlUndoTimer) { clearTimeout(_wlUndoTimer); _wlUndoTimer = null; }
        _rfSaveWatchlist();
        applyFilter();
        _rfRefreshPanel();
    }

    /** Update label for an entry by index. */
    function _wlSetLabel(idx, label) {
        if (idx < 0 || idx >= _watchList.length) return;
        _watchList[idx].label = label || '';
        _rfSaveWatchlist();
    }

    /** Update priority for an entry by index. */
    function _wlSetPriority(idx, priority) {
        if (idx < 0 || idx >= _watchList.length) return;
        _watchList[idx].priority = priority || 'normal';
        _rfSaveWatchlist();
    }

    // ── Sort helpers ──────────────────────────────────────────────────────────

    function _wlSortedList() {
        var list = _watchList.slice();
        list.sort(function (a, b) {
            var av, bv;
            if (_wlSortBy === 'lastSeen') {
                av = a.lastSeenAt || 0;
                bv = b.lastSeenAt || 0;
            } else if (_wlSortBy === 'priority') {
                av = WL_PRIORITY_ORDER[a.priority] !== undefined ? WL_PRIORITY_ORDER[a.priority] : 99;
                bv = WL_PRIORITY_ORDER[b.priority] !== undefined ? WL_PRIORITY_ORDER[b.priority] : 99;
            } else if (_wlSortBy === 'source') {
                av = a.source || '';
                bv = b.source || '';
            } else { // label / default
                av = (a.label || a.icao || '').toLowerCase();
                bv = (b.label || b.icao || '').toLowerCase();
            }
            if (av < bv) return _wlSortDir === 'asc' ?  -1 : 1;
            if (av > bv) return _wlSortDir === 'asc' ?   1 : -1;
            return 0;
        });
        return list;
    }

    function _wlToggleSort(col) {
        if (_wlSortBy === col) {
            _wlSortDir = _wlSortDir === 'asc' ? 'desc' : 'asc';
        } else {
            _wlSortBy  = col;
            _wlSortDir = col === 'lastSeen' ? 'desc' : 'asc';
        }
        _rfRefreshPanel();
    }

    // ── Export helpers ────────────────────────────────────────────────────────

    function _wlExportCsv() {
        try {
            var rows = ['ICAO,Label,Added,Status,Priority,Source,FirstSeen,LastSeen'];
            _watchList.forEach(function (e) {
                rows.push([
                    e.icao || '',
                    '"' + (e.label || '').replace(/"/g, '""') + '"',
                    e.added      ? new Date(e.added).toISOString()      : '',
                    e.status     || '',
                    e.priority   || '',
                    e.source     || '',
                    e.firstSeenAt ? new Date(e.firstSeenAt).toISOString() : '',
                    e.lastSeenAt  ? new Date(e.lastSeenAt).toISOString()  : ''
                ].join(','));
            });
            _rfDownloadText(rows.join('\n'), 'watchlist.csv', 'text/csv');
        } catch (e) {}
    }

    function _wlExportJson() {
        try {
            _rfDownloadText(JSON.stringify(_watchList, null, 2), 'watchlist.json', 'application/json');
        } catch (e) {}
    }

    function _rfDownloadText(content, filename, mime) {
        var blob = new Blob([content], { type: mime });
        var a    = document.createElement('a');
        a.href   = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            try { URL.revokeObjectURL(a.href); document.body.removeChild(a); } catch (e) {}
        }, 0);
    }

    // Minimal stub until §21 is written
    function _rfShowToastSimple(msg) {
        if (typeof _rfShowToast === 'function') _rfShowToast(msg);
        else console.info('[RF watchlist]', msg);
    }

    // ── Tab renderer ──────────────────────────────────────────────────────────

    /**
     * Render the Watchlist tab into the panel's #rf-list element.
     * Called from buildPanel() when _activeTab === 'watchlist'.
     */
    function buildWatchlistPanel() {
        var listEl   = document.getElementById('rf-list');
        var statusEl = document.getElementById('rf-status');
        var searchEl = document.getElementById('rf-search');
        var ctrlEl   = document.getElementById('rf-controls');
        var hdrEl    = document.getElementById('rf-colheader');
        if (!listEl) return;
        if (searchEl) searchEl.style.display = 'none'; // uses its own search box
        if (hdrEl)    hdrEl.innerHTML = '';

        // Check dormant entries on each render
        _wlActivateDormantEntries();

        var esc  = _rfEscText;
        var escA = _rfEscAttr;

        // Controls bar
        if (ctrlEl) {
            ctrlEl.innerHTML =
                '<div class="rf-wl-controls">' +
                    '<button class="rf-cat-btn' + (_watchlistMapFilter ? ' rf-cat-active' : '') +
                        '" onclick="window._rfWlToggleMapFilter()">Map Filter: ' +
                        (_watchlistMapFilter ? 'ON' : 'OFF') + '</button>' +
                    '<button class="rf-cat-btn" onclick="window._rfWlExport(\'csv\')">CSV</button>' +
                    '<button class="rf-cat-btn" onclick="window._rfWlExport(\'json\')">JSON</button>' +
                    (_wlUndoEntry ? '<button class="rf-cat-btn rf-wl-undo-btn" onclick="window._rfWlUndo()">Undo remove</button>' : '') +
                '</div>';
        }

        // Unified search box
        var searchHtml =
            '<div class="rf-wl-search-wrap">' +
                '<input id="rf-wl-q" class="rf-rng-input rf-wl-q" type="text" ' +
                    'placeholder="Search ICAO, callsign, type\u2026" ' +
                    'value="' + escA(_wlSearchQuery) + '" ' +
                    'oninput="window._rfWlSearchInput(this.value)" ' +
                    'onkeydown="window._rfWlSearchKey(event)">' +
            '</div>';

        // Search results
        var resultsHtml = '';
        if (_wlSearchQuery.length >= (watchlistSettings.search.minQueryLength || 2)) {
            var res = _wlSearchResults || _wlSearch(_wlSearchQuery);
            _wlSearchResults = res;

            function resultRow(item, sourceLabel, idx) {
                var dupClass = item.isDuplicate ? ' rf-wl-dup' : '';
                var liveTag  = item.isLiveNow   ? ' <span class="rf-wl-live-tag">live</span>' : '';
                var rcFlag   = item.countryIso2  ? flagFromIso(item.countryIso2) + ' ' : '';
                return '<div class="rf-wl-result-row' + dupClass + '" data-icao="' + escA(item.icao) + '">' +
                    '<span class="rf-wl-res-icao">' + esc(item.icao) + '</span>' +
                    '<span class="rf-wl-res-label">' + esc(item.label) + liveTag + '</span>' +
                    '<span class="rf-wl-res-type">' + rcFlag + esc(item.type || item.cmpg || '') + '</span>' +
                    (item.isDuplicate
                        ? '<span class="rf-wl-res-dup">already added</span>'
                        : '<span class="rf-wl-res-actions">' +
                            '<button class="rf-cat-btn rf-wl-add-btn" ' +
                                'data-rf-wl-action="add" ' +
                                'data-rf-wl-icao="' + escA(item.icao) + '" ' +
                                'data-rf-wl-label="' + escA(item.label) + '" ' +
                                'data-rf-wl-source="' + escA(item.source) + '" ' +
                                'title="Add to watchlist">Add</button>' +
                            '<button class="rf-cat-btn" ' +
                                'data-rf-wl-action="add+map" ' +
                                'data-rf-wl-icao="' + escA(item.icao) + '" ' +
                                'data-rf-wl-label="' + escA(item.label) + '" ' +
                                'data-rf-wl-source="' + escA(item.source) + '" ' +
                                'title="Add and enable map filter">+Map</button>' +
                            '<button class="rf-cat-btn" ' +
                                'data-rf-wl-action="add+notify" ' +
                                'data-rf-wl-icao="' + escA(item.icao) + '" ' +
                                'data-rf-wl-label="' + escA(item.label) + '" ' +
                                'data-rf-wl-source="' + escA(item.source) + '" ' +
                                'title="Add and enable notifications">+Notify</button>' +
                          '</span>') +
                '</div>';
            }

            if (res.live.length > 0) {
                resultsHtml += '<div class="rf-wl-results-group">' +
                    '<div class="rf-wl-results-label">Live (' + res.live.length + ')</div>';
                res.live.forEach(function (item, i) { resultsHtml += resultRow(item, 'live', i); });
                resultsHtml += '</div>';
            }
            if (res.alertDb.length > 0) {
                resultsHtml += '<div class="rf-wl-results-group">' +
                    '<div class="rf-wl-results-label">Alert DB (' + res.alertDb.length + ')</div>';
                res.alertDb.forEach(function (item, i) { resultsHtml += resultRow(item, 'alertDb', i); });
                resultsHtml += '</div>';
            }
            if (res.live.length === 0 && res.alertDb.length === 0) {
                resultsHtml += '<div class="rf-empty">No results for \u201c' + esc(_wlSearchQuery) + '\u201d</div>';
            }
        }

        // Watchlist table header
        function sortBtn(col, label) {
            var isActive = _wlSortBy === col;
            var arrow = isActive ? (_wlSortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';
            return '<button class="rf-wl-sort-btn' + (isActive ? ' rf-wl-sort-active' : '') +
                '" onclick="window._rfWlSort(\'' + col + '\')">' + label + arrow + '</button>';
        }
        var tableHdr =
            '<div class="rf-wl-table-hdr">' +
                '<span class="rf-wl-th-dot"></span>' +
                sortBtn('label',   'Label / ICAO') +
                sortBtn('lastSeen','Last Seen') +
                sortBtn('priority','Priority') +
                sortBtn('source',  'Source') +
                '<span class="rf-wl-th-actions"></span>' +
            '</div>';

        // Watchlist rows
        var sorted = _wlSortedList();
        var tableRows = '';

        // Build live + distance lookup for status dots
        var onScopeMap = {}, distMap2 = {};
        if (gReady()) {
            var rxLat = null, rxLon = null;
            try {
                if (typeof SiteLat !== 'undefined') { rxLat = +SiteLat; rxLon = +SiteLon; }
                else if (g.SitePosition) { rxLat = +g.SitePosition.lat; rxLon = +g.SitePosition.lng; }
            } catch (e) {}
            for (var pi2 = 0; pi2 < g.planesOrdered.length; pi2++) {
                var lp = g.planesOrdered[pi2];
                if (!lp.icao) continue;
                var lic = lp.icao.toUpperCase();
                onScopeMap[lic] = lp;
                if (rxLat !== null) {
                    var plat, plon;
                    if (lp.position && lp.position.length >= 2) { plon = +lp.position[0]; plat = +lp.position[1]; }
                    else { plat = +lp.lat; plon = +lp.lon; }
                    if (!isNaN(plat) && !isNaN(plon))
                        distMap2[lic] = haversineNm(rxLat, rxLon, plat, plon);
                }
            }
        }

        if (sorted.length === 0) {
            tableRows = '<div class="rf-empty">No entries. Search above to add aircraft.</div>';
        } else {
            // Get original index of each sorted entry for remove/label operations
            for (var ti = 0; ti < sorted.length; ti++) {
                var e   = sorted[ti];
                var origIdx = _watchList.indexOf(e);
                var isLive2 = !!onScopeMap[e.icao];
                var dist2   = distMap2[e.icao];
                var distTxt = (typeof dist2 === 'number') ? dist2.toFixed(0) + '\u2009nm' : '';
                var statusDot = isLive2 ? 'rf-wl-dot-on' : (e.status === 'not_seen_yet' ? 'rf-wl-dot-dormant' : 'rf-wl-dot-off');
                var statusTitle = isLive2 ? 'On scope' : (e.status === 'not_seen_yet' ? 'Dormant — waiting for first appearance' : 'Not on scope');
                var lastSeenTxt = e.lastSeenAt
                    ? _rfTimeAgo(e.lastSeenAt)
                    : (e.status === 'not_seen_yet' ? 'Never seen' : '');
                var priorityColors = { critical: '#e87c7c', high: '#e8a87c', normal: '', low: '#888' };
                var pColor = priorityColors[e.priority] || '';
                tableRows +=
                    '<div class="rf-wl-row">' +
                        '<span class="rf-wl-dot ' + statusDot + '" title="' + escA(statusTitle) + '"></span>' +
                        '<span class="rf-wl-icao">' + esc(e.icao) + '</span>' +
                        '<input class="rf-rng-input rf-wl-label-edit" type="text" ' +
                            'value="' + escA(e.label || '') + '" placeholder="Label" ' +
                            'onchange="window._rfWlSetLabel(' + origIdx + ',this.value)">' +
                        '<span class="rf-wl-lastseen" title="' + escA(e.lastSeenAt ? new Date(e.lastSeenAt).toLocaleString() : '') + '">' +
                            esc(lastSeenTxt) + '</span>' +
                        '<select class="rf-country-select rf-wl-pri-sel" ' +
                            'onchange="window._rfWlSetPriority(' + origIdx + ',this.value)" ' +
                            'style="' + (pColor ? 'color:' + pColor : '') + '">' +
                            ['critical','high','normal','low'].map(function (p) {
                                return '<option value="' + p + '"' + (e.priority === p ? ' selected' : '') + '>' + p + '</option>';
                            }).join('') +
                        '</select>' +
                        '<span class="rf-wl-source">' + esc(e.source || '') + '</span>' +
                        (distTxt ? '<span class="rf-wl-dist">' + esc(distTxt) + '</span>' : '') +
                        '<button class="rf-dist-pill-x" onclick="window._rfWlRemove(' + origIdx + ')" title="Remove">\u2715</button>' +
                    '</div>';
            }
        }

        listEl.innerHTML =
            searchHtml +
            (resultsHtml ? '<div class="rf-wl-results">' + resultsHtml + '</div>' : '') +
            '<div class="rf-wl-table">' + tableHdr + tableRows + '</div>';

        // Delegated click handler for result row action buttons
        listEl.onclick = function (ev) {
            var btn = ev.target.closest('[data-rf-wl-action]');
            if (!btn) return;
            var action  = btn.getAttribute('data-rf-wl-action');
            var icao    = btn.getAttribute('data-rf-wl-icao')    || '';
            var label   = btn.getAttribute('data-rf-wl-label')   || '';
            var source  = btn.getAttribute('data-rf-wl-source')  || 'search';
            if (action === 'add')         _wlAdd(icao, label, source, null);
            else if (action === 'add+map')    _wlAddAndMapFilter(icao, label, source, null);
            else if (action === 'add+notify') _wlAddAndNotify(icao, label, source, null);
            _wlSearchResults = null; // invalidate so next render re-runs search
            _rfRefreshPanel();
        };

        if (statusEl) {
            var liveCount2 = Object.keys(onScopeMap).filter(function (ic) {
                return _watchList.some(function (e) { return e.icao === ic; });
            }).length;
            var dormCount  = _watchList.filter(function (e) { return e.status === 'not_seen_yet'; }).length;
            statusEl.textContent = _watchList.length + ' entries' +
                (liveCount2 > 0 ? ' \u2022 ' + liveCount2 + ' live'    : '') +
                (dormCount  > 0 ? ' \u2022 ' + dormCount  + ' dormant' : '');
        }
    }

    /** Format a timestamp as a human-readable "time ago" string. */
    function _rfTimeAgo(ts) {
        if (!ts) return '';
        var diff = Date.now() - ts;
        var secs = Math.floor(diff / 1000);
        if (secs <  60)  return secs + 's ago';
        var mins = Math.floor(secs / 60);
        if (mins <  60)  return mins + 'm ago';
        var hrs  = Math.floor(mins / 60);
        if (hrs  <  24)  return hrs  + 'h ago';
        return Math.floor(hrs / 24) + 'd ago';
    }

    // ── Window-exposed globals ────────────────────────────────────────────────

    window._rfWlToggleMapFilter = function () {
        _watchlistMapFilter = !_watchlistMapFilter;
        _rfSaveWatchlist();
        applyFilter();
        _rfRefreshPanel();
    };

    window._rfWlSearchInput = function (val) {
        _wlSearchQuery   = val || '';
        _wlSearchResults = null; // invalidate cache
        _rfRefreshPanel();
    };

    window._rfWlSearchKey = function (ev) {
        // Enter on a focused result button — let click handler deal with it
        if (ev.key === 'Escape') {
            _wlSearchQuery   = '';
            _wlSearchResults = null;
            var inp = document.getElementById('rf-wl-q');
            if (inp) inp.value = '';
            _rfRefreshPanel();
        }
    };

    window._rfWlSort = function (col) { _wlToggleSort(col); };

    window._rfWlRemove = function (idx) { _wlRemove(idx); };
    window._rfWlUndo   = function ()    { _wlUndoRemove(); };

    window._rfWlSetLabel    = function (idx, val)  { _wlSetLabel(idx, val);    _rfRefreshPanel(); };
    window._rfWlSetPriority = function (idx, val)  { _wlSetPriority(idx, val); _rfRefreshPanel(); };

    window._rfWlExport = function (fmt) {
        if (fmt === 'json') _wlExportJson();
        else                _wlExportCsv();
    };

    // Legacy compat aliases (called from breadcrumb chip and v1 code paths)
    window._rfWatchlistToggleMapFilter = window._rfWlToggleMapFilter;
    window._rfWatchlistAdd    = function (icao, label) { _wlAdd(icao, label, 'manual', null); _rfRefreshPanel(); };
    window._rfWatchlistRemove = function (idx)         { _wlRemove(idx); };
    window._rfWatchlistExport = function ()            { _wlExportCsv(); };

    // ═══════════════════════════════════════════════════════════════════════════
    // §20 Tab: Settings
    // ═══════════════════════════════════════════════════════════════════════════

    function _rfInitSettingsAccordions() {
        var root = document.querySelector('.rf-settings-content');
        if (!root) return;
        if (!settings.settingsAccOpen || typeof settings.settingsAccOpen !== 'object') settings.settingsAccOpen = {};
        var groups = root.querySelectorAll('.rf-set-group');
        for (var i = 0; i < groups.length; i++) {
            var grp = groups[i];
            if (grp.querySelector('.rf-set-acc')) continue;
            var titleEl = grp.querySelector('.rf-set-group-title');
            if (!titleEl) continue;
            var title = titleEl.textContent || ('Section ' + (i + 1));
            var details = document.createElement('details');
            details.className = 'rf-set-acc';
            if (typeof settings.settingsAccOpen[title] === 'boolean') details.open = settings.settingsAccOpen[title];
            else details.open = i < 2;
            var summary = document.createElement('summary');
            summary.className = 'rf-set-acc-sum';
            summary.textContent = title;
            var body = document.createElement('div');
            body.className = 'rf-set-acc-body';
            while (grp.firstChild) {
                var node = grp.firstChild;
                grp.removeChild(node);
                if (node !== titleEl) body.appendChild(node);
            }
            details.appendChild(summary);
            details.appendChild(body);
            details.addEventListener('toggle', (function (t, d) {
                return function () {
                    settings.settingsAccOpen[t] = !!d.open;
                    _rfSaveSettings();
                };
            })(title, details));
            grp.appendChild(details);
            grp.classList.add('rf-set-group-acc');
        }
        var dividers = root.querySelectorAll('.rf-set-divider');
        for (var di = 0; di < dividers.length; di++) {
            var d = dividers[di];
            if (d && d.parentNode) d.parentNode.removeChild(d);
        }
    }

    function buildSettingsPanel() {
        buildBreadcrumb();
        var searchEl = document.getElementById('rf-search');
        if (searchEl) searchEl.style.display = 'none';
        var ctrlEl = document.getElementById('rf-controls');
        if (ctrlEl) ctrlEl.innerHTML = '';
        var hdrEl = document.getElementById('rf-colheader');
        if (hdrEl) hdrEl.innerHTML = '';
        var listEl = document.getElementById('rf-list');
        if (listEl) {
            var hc = _rfGetHomeConfig();
            var detTxt = hc.detected
                ? (hc.detected.lat.toFixed(5) + ', ' + hc.detected.lon.toFixed(5) + ' (' + hc.source + ')')
                : 'Not detected from tar1090 globals';
            var storageWarnBackup = (_rfLocalStorageOk === false)
                ? '<div class="rf-set-about-warn" style="margin-top:8px">' +
                  '<strong>Storage warning</strong> \u2014 localStorage is blocked in this browser session. ' +
                  'RF is running in cookie-only fallback mode. Use Export JSON for reliable backups.' +
                  '</div>'
                : '';
            var persistStatus =
                '<div class="rf-set-group-desc" style="margin-top:8px">' +
                '<strong>Persistence status:</strong> ' +
                'localStorage=' + (_rfLocalStorageOk === true ? 'OK' : (_rfLocalStorageOk === false ? 'blocked' : 'unknown')) +
                ' \u2022 cookies=' + (_rfCookieOk === true ? 'OK' : (_rfCookieOk === false ? 'blocked' : 'unknown')) +
                (_rfLastPersistSaveTs ? (' \u2022 last save=' + new Date(_rfLastPersistSaveTs).toLocaleTimeString()) : '') +
                '</div>';
            var apiMode = _rfDetectTar1090ApiMode();
            var apiWarn = apiMode.enabled
                ? '<div class="rf-set-about-warn" style="margin-top:8px"><strong>tar1090 API/globe mode appears enabled</strong> \u2014 loaded aircraft can change as you pan/zoom the map, which affects Plane Alert counts. Detection: ' + _rfEscText(apiMode.hints.join(', ') || 'runtime signal') + '.</div>'
                : '<div class="rf-set-group-desc" style="margin-top:8px"><strong>tar1090 API/globe mode:</strong> not detected from runtime signals.</div>';
            var homeLocOpts = '<option value="">Select saved distance location\u2026</option>';
            for (var hli = 0; hli < _distanceLocations.length; hli++) {
                var hl = _distanceLocations[hli];
                var nm = String(hl && hl.name ? hl.name : ('Location ' + (hli + 1)));
                nm = nm.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
                homeLocOpts += '<option value="' + hli + '">' + nm + '</option>';
            }
            listEl.innerHTML =
                '<div class="rf-settings-content">' +

                // ── 1. Panel layout ───────────────────────────────────────
                '<div class="rf-set-group">' +
                '<div class="rf-set-group-title">Panel Layout</div>' +
                '<div class="rf-set-group-desc">Choose how the filter panel sits on screen when you open it with the RF button.</div>' +
                '<div class="rf-set-radio-group" style="margin-top:8px">' +
                '<label class="rf-set-radio"><input type="radio" name="rf-display-mode" value="sidebar"' + (settings.displayMode === 'sidebar' ? ' checked' : '') + ' onchange="window._rfSetDisplayMode(\'sidebar\')"><span>Sidebar</span><span class="rf-set-radio-desc">Docks to the side of the map alongside the aircraft info panel. Best for wide screens.</span></label>' +
                '<label class="rf-set-radio"><input type="radio" name="rf-display-mode" value="popup"' + (settings.displayMode !== 'sidebar' ? ' checked' : '') + ' onchange="window._rfSetDisplayMode(\'popup\')"><span>Floating</span><span class="rf-set-radio-desc">Floats over the map. Drag it by the title bar to move it. Good for smaller screens.</span></label>' +
                '</div>' +
                '<label class="rf-set-toggle" style="margin-top:10px">' +
                '<input type="checkbox"' + (!settings.hideAllScope ? ' checked' : '') + ' onchange="window._rfSetHideAllScope(!this.checked)">' +
                '<div class="rf-set-toggle-body"><div class="rf-set-toggle-label">Show "All aircraft" scope option</div>' +
                '<div class="rf-set-toggle-desc">When on, you can switch between filtering only what\'s visible on the map or all aircraft your receiver has heard. Turn this off if you use globe/API mode, where "all aircraft" can give misleading counts.</div></div>' +
                '</label>' +
                '<label class="rf-set-toggle" style="margin-top:8px">' +
                '<input type="checkbox"' + (settings.selectionAutoCenter !== false ? ' checked' : '') + ' onchange="window._rfSetSelectionAutoCenter(this.checked)">' +
                '<div class="rf-set-toggle-body"><div class="rf-set-toggle-label">Auto-center map on selected aircraft</div>' +
                '<div class="rf-set-toggle-desc">When enabled, selecting aircraft in Plane Alert, Summary, or other filter tabs will automatically move the map: one aircraft centers on it, multiple aircraft fit to frame, and clearing selection restores your previous map view. This pauses while RV map behavior is active.</div></div>' +
                '</label>' +
                '</div>' +

                '<div class="rf-set-divider"></div>' +

                // ── 3. RV cycle notifications ─────────────────────────────
                '<div class="rf-set-group">' +
                '<div class="rf-set-group-title">RV Cycle Notifications</div>' +
                '<div class="rf-set-group-desc">Choose how RV detection cards are shown when cycle mode finds aircraft in a view.</div>' +
                '<div class="rf-set-radio-group" style="margin-top:8px">' +
                '<label class="rf-set-radio"><input type="radio" name="rf-rv-notify-layout" value="overlay"' + (settings.rvNotifyLayout !== 'sidebar' ? ' checked' : '') + ' onchange="window._rfSetRvNotifyLayout(\'overlay\')"><span>Overlay popup</span><span class="rf-set-radio-desc">Centered card over the map (compact).</span></label>' +
                '<label class="rf-set-radio"><input type="radio" name="rf-rv-notify-layout" value="sidebar"' + (settings.rvNotifyLayout === 'sidebar' ? ' checked' : '') + ' onchange="window._rfSetRvNotifyLayout(\'sidebar\')"><span>Sidebar card</span><span class="rf-set-radio-desc">Wider panel on the right side for more aircraft detail and photos.</span></label>' +
                '</div>' +
                '</div>' +

                '<div class="rf-set-divider"></div>' +

                // ── 4. Map center (home) ──────────────────────────────────
                '<div class="rf-set-group">' +
                '<div class="rf-set-group-title">Map Center (Home)</div>' +
                '<div class="rf-set-group-desc">Your home position is used by the Home button and the initial map center when you first open the filter panel.' +
                (hc.detected ? ' Currently auto-detected as <strong>' + detTxt + '</strong>.' : ' Could not be auto-detected from tar1090.') + '</div>' +
                '<label class="rf-set-toggle" style="margin-top:8px">' +
                '<input type="checkbox"' + (settings.homeCenterOnOpen !== false ? ' checked' : '') + ' onchange="window._rfSetHomeCenterOnOpen(this.checked)">' +
                '<div class="rf-set-toggle-body"><div class="rf-set-toggle-label">Pan to home when filter panel first opens</div>' +
                '<div class="rf-set-toggle-desc">The map will jump to your home position the first time you open the filter panel each session. Turn this off if you find it disruptive.</div></div>' +
                '</label>' +
                '<label class="rf-set-toggle" style="margin-top:6px">' +
                '<input type="checkbox"' + (settings.homeOverride ? ' checked' : '') + ' onchange="window._rfSetHomeOverride(this.checked)">' +
                '<div class="rf-set-toggle-body"><div class="rf-set-toggle-label">Use a custom home position</div>' +
                '<div class="rf-set-toggle-desc">Override the auto-detected home with your own lat, lon and zoom level.</div></div>' +
                '</label>' +
                (settings.homeOverride ? (
                    '<div class="rf-dist-row" style="margin-top:8px;flex-wrap:wrap;gap:4px">' +
                    '<input class="rf-dist-input rf-dist-small" type="number" step="0.00001" min="-90" max="90" placeholder="Latitude" value="' + String(settings.homeLat).replace(/"/g,'&quot;') + '" oninput="window._rfSetHomeValue(\'lat\',this.value)">' +
                    '<input class="rf-dist-input rf-dist-small" type="number" step="0.00001" min="-180" max="180" placeholder="Longitude" value="' + String(settings.homeLon).replace(/"/g,'&quot;') + '" oninput="window._rfSetHomeValue(\'lon\',this.value)">' +
                    '<input class="rf-dist-input rf-dist-small" type="number" step="1" min="2" max="19" placeholder="Zoom (2\u201319)" value="' + String(settings.homeZoom).replace(/"/g,'&quot;') + '" oninput="window._rfSetHomeValue(\'zoom\',this.value)">' +
                    '</div>' +
                    '<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">' +
                    '<button class="rf-cat-btn" onclick="window._rfUseDetectedHome()" title="Fill in the auto-detected position">Use auto-detected</button>' +
                    '<button class="rf-cat-btn" onclick="window._rfPickHomeFromMap()" title="Click a point on the map to use as home">Click map to pick</button>' +
                    '<button class="rf-cat-btn" onclick="window._rfCenterHome(true)" title="Pan the map to this home position now">\u2302 Go there now</button>' +
                    '</div>'
                ) : '') +
                '</div>' +

                '<div class="rf-set-divider"></div>' +

                // ── 4. Summary tab ────────────────────────────────────────
                '<div class="rf-set-group">' +
                '<div class="rf-set-group-title">Summary Tab — What to Show</div>' +
                '<div class="rf-set-group-desc">The Summary tab gives a live snapshot of what\'s in the air. Tick the sections you want to see. Untick anything you don\'t need to keep it tidy.</div>' +
                '<div class="rf-set-tabs-grid" style="margin-top:8px">' +
                [
                    ['altitude',   'Altitude distribution',  'Bar chart of how many aircraft are in each altitude band'],
                    ['attention',  'Things needing attention','Emergency squawks, military contacts and very-low aircraft'],
                    ['closest',    'Closest aircraft',        'The 5 aircraft nearest to your receiver right now'],
                    ['speed',      'Fastest aircraft',        'Top 5 by ground speed'],
                    ['highflyers', 'Highest aircraft',        'Top 5 by altitude'],
                    ['types',      'Aircraft types',          'Most common ICAO type codes on scope'],
                    ['operators',  'Busiest airlines',        'Operators with the most aircraft currently visible'],
                    ['routes',     'Busiest routes',          'Airport pairs with the most flights right now'],
                    ['methods',    'How aircraft are tracked','Breakdown of ADS-B, MLAT, TIS-B and Mode S'],
                    ['range',      'Range &amp; coverage',    'Furthest aircraft seen and its bearing from you'],
                    ['countries',  'Countries on scope',      'Top countries identified from aircraft registrations'],
                    ['arrivals',   'Recent arrivals',         'Aircraft that first appeared in the last 5 minutes'],
                    ['slowest',    'Slowest airborne',        'Top 5 slowest aircraft that are flying (above 30 kt)'],
                ].map(function (s) {
                    return '<label class="rf-set-tabvis" title="' + s[2] + '">' +
                        '<input type="checkbox"' + (_summarySettings[s[0]] ? ' checked' : '') + ' onchange="window._rfSetSummarySection(\'' + s[0] + '\',this.checked)">' +
                        '<div><div class="rf-set-tabvis-name">' + s[1] + '</div></div>' +
                        '</label>';
                }).join('') +
                '</div>' +
                '</div>' +

                '<div class="rf-set-divider"></div>' +

                // ── 5. Alerts database ────────────────────────────────────
                '<div class="rf-set-group">' +
                '<div class="rf-set-group-title">Plane Alert Database</div>' +
                '<div class="rf-set-group-desc">Plane Alert checks each aircraft against the plane-alert-db community database, which flags military aircraft, government planes, interesting registrations and more. The database is downloaded once and cached for 24 hours.</div>' +
                '<div style="margin-top:6px;font-size:11px;color:#78929a">Last downloaded: ' + (_alertsTimestamp ? new Date(_alertsTimestamp).toLocaleString() : 'not yet downloaded this session') + '</div>' +
                apiWarn +
                '<div style="margin-top:6px"><button class="rf-cat-btn" onclick="window._rfAlertsRefresh()">Download latest now</button></div>' +
                '</div>' +

                '<div class="rf-set-divider"></div>' +

                // ── 6. Route & airport data ───────────────────────────────
                '<div class="rf-set-group">' +
                '<div class="rf-set-group-title">Route &amp; Airport Data</div>' +
                '<div class="rf-set-group-desc">Robs Filters can download community databases of airports, airlines and flight routes. These are used to enrich the Airports and Operators tabs with names and flags, and to look up where flights are going.</div>' +
                '<label class="rf-set-toggle" style="margin-top:8px">' +
                '<input type="checkbox"' + (settings.useLocalDb ? ' checked' : '') + ' onchange="window._rfSetUseLocalDb(this.checked)">' +
                '<div class="rf-set-toggle-body"><div class="rf-set-toggle-label">Download and use local route data</div>' +
                '<div class="rf-set-toggle-desc">Data is cached for 24 hours. Disable only if you want to use exclusively the live API for route lookups.</div></div>' +
                '</label>' +
                dbStatusHtml() +
                '</div>' +

                '<div class="rf-set-divider"></div>' +

                // ── 7. Notifications ──────────────────────────────────────
                '<div class="rf-set-group">' +
                '<div class="rf-set-group-title">Notifications</div>' +
                '<div class="rf-set-group-desc">Get notified when specific aircraft appear. Notifications can appear as pop-up cards on this page, or as OS-level browser notifications (useful when the tab is in the background).</div>' +
                '<label class="rf-set-toggle" style="margin-top:8px">' +
                '<input type="checkbox"' + (_notifSettings.enabled ? ' checked' : '') + ' onchange="window._rfSetNotifEnabled(this.checked)">' +
                '<div class="rf-set-toggle-body"><div class="rf-set-toggle-label">Enable notifications</div></div>' +
                '</label>' +
                (_notifSettings.enabled ? (
                    '<div class="rf-set-group-desc" style="margin-top:8px">Notify me when these appear on scope:</div>' +
                    '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">' +
                    '<label class="rf-set-tabvis"><input type="checkbox"' + (_notifSettings.emergency ? ' checked' : '') + ' onchange="window._rfSetNotifOption(\'emergency\',this.checked)"><div><div class="rf-set-tabvis-name">Emergency squawks (7500, 7600, 7700)</div></div></label>' +
                    '<label class="rf-set-tabvis"><input type="checkbox"' + (_notifSettings.military ? ' checked' : '') + ' onchange="window._rfSetNotifOption(\'military\',this.checked)"><div><div class="rf-set-tabvis-name">Military aircraft</div></div></label>' +
                    '<label class="rf-set-tabvis"><input type="checkbox"' + (_notifSettings.alertDb ? ' checked' : '') + ' onchange="window._rfSetNotifOption(\'alertDb\',this.checked)"><div><div class="rf-set-tabvis-name">Notable aircraft (alerts database)</div></div></label>' +
                    '</div>' +
                    '<div class="rf-set-group-desc" style="margin-top:10px">How to deliver notifications:</div>' +
                    '<label class="rf-set-toggle" style="margin-top:4px"><input type="checkbox"' + (_notifSettings.toasts ? ' checked' : '') + ' onchange="window._rfSetNotifOption(\'toasts\',this.checked)"><div class="rf-set-toggle-body"><div class="rf-set-toggle-label">Show pop-up cards on this page</div><div class="rf-set-toggle-desc">A small card appears in the corner with the aircraft callsign, route and type.</div></div></label>' +
                    '<label class="rf-set-toggle"><input type="checkbox"' + (_notifSettings.browserNotif ? ' checked' : '') + ' onchange="window._rfSetNotifOption(\'browserNotif\',this.checked)"><div class="rf-set-toggle-body"><div class="rf-set-toggle-label">Send OS browser notifications</div><div class="rf-set-toggle-desc">Triggers a native system notification. Works even when this browser tab is in the background. Requires browser permission to be granted.</div></div></label>' +
                    (typeof Notification !== 'undefined' && Notification.permission === 'denied' ? '<div class="rf-set-group-desc" style="color:#ff8080;margin-top:4px">Browser notifications are currently blocked. Allow them in your browser site settings to use this feature.</div>' : '') +
                    '<div style="margin-top:8px"><button class="rf-cat-btn" onclick="window._rfNotifTestToast()">Send a test notification</button></div>'
                ) : '') +
                '</div>' +

                '<div class="rf-set-divider"></div>' +

                // ── 8. Debug ──────────────────────────────────────────────
                '<div class="rf-set-group">' +
                '<div class="rf-set-group-title">Debug</div>' +
                '<div class="rf-set-group-desc">Runtime diagnostics for scope behavior, cache age, storage fallback, and Plane Alert data sources.</div>' +
                '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' +
                '<button class="rf-cat-btn" title="Open JSON diagnostics (runtime + Plane Alert cache + persistence details)" onclick="window._rfShowPersistData()">Open RF debug report</button>' +
                '</div>' +
                '</div>' +

                '<div class="rf-set-divider"></div>' +

                // ── 8. Backup, import, reset ──────────────────────────────
                '<div class="rf-set-group">' +
                '<div class="rf-set-group-title">Backup, Import &amp; Reset</div>' +
                '<div class="rf-set-group-desc">Save your settings, views and filter configuration to a file so you can restore them later or move them to another device.</div>' +
                storageWarnBackup +
                persistStatus +
                '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' +
                '<button class="rf-cat-btn" title="Download all your settings and saved views as a JSON file" onclick="window._rfExportPersist()">&#x2B07; Save settings to file</button>' +
                '<button class="rf-cat-btn" title="Restore settings from a previously exported JSON file" onclick="window._rfImportPersistPick()">&#x2B06; Load settings from file</button>' +
                '<button class="rf-cat-btn" title="Open a popup with everything RF currently has persisted" onclick="window._rfShowPersistData()">&#128196; View persisted data</button>' +
                '</div>' +
                '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">' +
                '<button class="rf-cat-btn" title="Export the currently filtered aircraft to a CSV spreadsheet" onclick="window._rfExportCSV()">&#x2B07; Export aircraft list to CSV</button>' +
                '</div>' +
                '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">' +
                '<button class="rf-cat-btn" style="color:#ffa0a0;border-color:#7a3030" onclick="window._rfResetPersist()" title="Wipe all saved settings, views and filter data back to defaults">&#9888; Reset everything to defaults</button>' +
                '</div>' +
                '<input id="rf-import-json" type="file" accept="application/json,.json" style="display:none" onchange="window._rfImportPersistFile(this)">' +
                '</div>' +

                '<div class="rf-set-divider"></div>' +

                // ── 9. About ──────────────────────────────────────────────
                '<div class="rf-set-group">' +
                '<div class="rf-set-group-title">About Robs Filters</div>' +
                '<div style="font-size:11px;color:#78929a;line-height:1.7;margin-bottom:10px">' +
                '<strong style="color:#aac8d0">Version ' + RF_VERSION + '</strong><br>' +
                'Built by Rob for practical day-to-day spotting. The aim is simple: keep the map clean, surface what matters quickly, and make watch workflows reliable.' +
                '<br><br><strong style="color:#aac8d0">Filter logic:</strong> inside one tab it is <em>OR</em>, across tabs it is <em>AND</em>, and multiple active Views are <em>OR</em>.' +
                '<br><strong style="color:#aac8d0">Header:</strong> RF + RV + RR only, so tar1090 stays uncluttered.' +
                '</div>' +
                '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
                '<a href="https://github.com/robertcanavan/tar1090-robs-filters" target="_blank" class="rf-set-link-btn">View on GitHub</a>' +
                '<a href="https://github.com/robertcanavan/tar1090-robs-filters/issues" target="_blank" class="rf-set-link-btn">Report a problem</a>' +
                '</div>' +
                '</div>' +

                '</div>';
        }
        var statusEl = document.getElementById('rf-status');
        if (statusEl) statusEl.textContent = '';
        _rfInitSettingsAccordions();
        var btn = document.getElementById('rf-btn');
        if (btn) btn.className = 'button ' + (isFilterActive() ? 'activeButton' : 'inActiveButton');
    }

    // ── Settings window handlers ──────────────────────────────────────────────

    window._rfSetDisplayMode = function (mode) {
        settings.displayMode = mode;
        _rfSaveSettings();
        applyPanelMode();
        buildPanel();
    };

    window._rfSetHideAllScope = function (on) {
        settings.hideAllScope = !!on;
        if (settings.hideAllScope && _panelScope === 'all') _panelScope = 'inview';
        _rfSaveSettings();
        applyFilter();
        buildPanel();
    };

    window._rfSetSelectionAutoCenter = function (on) {
        settings.selectionAutoCenter = !!on;
        _rfSaveSettings();
        if (!settings.selectionAutoCenter) _rfRestoreSelectionMapView();
        else _rfSyncSelectionMapView();
        if (_activeTab === 'settings') buildPanel();
    };

    window._rfSetAlertsFacetSource = function (mode) {
        settings.alertsFacetSource = (mode === 'live') ? 'live' : 'db';
        _rfSaveSettings();
        if (_activeTab === 'alerts') buildPanel();
    };

    window._rfSetHeaderBtn = function (key, visible) {
        if (!settings.headerBtns) settings.headerBtns = {};
        settings.headerBtns[key] = !!visible;
        _rfSaveSettings();
        _rfUpdateHeaderBtns();
        if (_activeTab === 'settings') buildPanel();
    };

    window._rfSetRvNotifyLayout = function (layout) {
        settings.rvNotifyLayout = (layout === 'sidebar') ? 'sidebar' : 'overlay';
        _rfSaveSettings();
        if (_activeTab === 'settings') buildPanel();
    };

    window._rfSetHomeCenterOnOpen = function (on) {
        settings.homeCenterOnOpen = !!on;
        _rfSaveSettings();
    };

    window._rfSetHomeOverride = function (on) {
        settings.homeOverride = !!on;
        _rfSaveSettings();
        buildPanel();
    };

    window._rfSetHomeValue = function (field, val) {
        if (field === 'lat') settings.homeLat = val;
        else if (field === 'lon') settings.homeLon = val;
        else if (field === 'zoom') settings.homeZoom = parseInt(val, 10) || 12;
        _rfSaveSettings();
    };

    window._rfUseDetectedHome = function () {
        var d = _rfDetectHomePos();
        if (!d) return;
        settings.homeOverride = true;
        settings.homeLat = d.lat.toFixed(5);
        settings.homeLon = d.lon.toFixed(5);
        _rfSaveSettings();
        buildPanel();
    };

    window._rfUseDistLocForHome = function () {
        var sel = document.getElementById('rf-home-dist-loc');
        if (!sel) return;
        var idx = parseInt(sel.value, 10);
        if (isNaN(idx) || idx < 0 || idx >= _distanceLocations.length) return;
        var loc = _distanceLocations[idx];
        if (!loc) return;
        var lat = parseFloat(loc.lat), lon = parseFloat(loc.lon);
        if (isNaN(lat) || isNaN(lon)) return;
        settings.homeOverride = true;
        settings.homeLat = lat.toFixed(5);
        settings.homeLon = lon.toFixed(5);
        _rfSaveSettings();
        buildPanel();
    };

    // Alias: settings panel HTML calls _rfPickHomeFromMap; logic lives in _rfHomePick (§9)
    window._rfPickHomeFromMap = window._rfHomePick;

    window._rfSetUseLocalDb = function (on) {
        settings.useLocalDb = !!on;
        _rfSaveSettings();
        if (settings.useLocalDb) _dbAutoSync();
        buildPanel();
    };

    window._rfSetRouteKnownOnly = function (on) {
        settings.routeKnownOnly = !!on;
        _rfSaveSettings();
        buildPanel();
    };

    window._rfSetSummarySection = function (section, on) {
        _summarySettings[section] = !!on;
        _rfSaveSummarySettings();
        _rfPersistSnapshot();
        if (_activeTab === 'summary') buildPanel();
    };

    window._rfSetTabVisible = window._rfToggleTabVis;

    window._rfSetNotifEnabled = function (on) {
        _notifSettings.enabled = !!on;
        if (on && _notifSettings.browserNotif && typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission();
        }
        _rfSaveNotifSettings();
        buildPanel();
    };

    window._rfSetNotifOption = function (key, val) {
        if (_notifSettings.hasOwnProperty(key)) {
            _notifSettings[key] = val;
        }
        if (key === 'browserNotif' && val && typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission();
        }
        _rfSaveNotifSettings();
        buildPanel();
    };

    window._rfNotifTestToast = function () {
        // Placeholder until §21 toast system is wired up
        console.log('[robs-filter] test toast requested (§21 not yet implemented)');
    };

    window._rfExportPersist = window._rfExportSettings;

    window._rfImportPersistPick = function () {
        var inp = document.getElementById('rf-import-json');
        if (!inp) return;
        inp.value = '';
        inp.click();
    };

    window._rfImportPersistFile = window._rfImportSettings;

    window._rfResetPersist = function () {
        if (!confirm('Reset all saved RF data (home, distance, tabs, summary, cookies)?')) return;
        try { localStorage.removeItem(LS_SETTINGS); } catch (e) {}
        try { localStorage.removeItem(LS_HOME); } catch (e) {}
        try { localStorage.removeItem(LS_PERSIST_SNAP); } catch (e) {}
        try { localStorage.removeItem(LS_TAB_VIS); } catch (e) {}
        try { localStorage.removeItem(LS_SUM_SETTINGS); } catch (e) {}
        try { localStorage.removeItem(LS_DIST_LOCS); } catch (e) {}
        try { localStorage.removeItem(LS_DIST_ZONES); } catch (e) {}
        try { localStorage.removeItem(LS_DIST_MODE); } catch (e) {}
        try { localStorage.removeItem(LS_VIEWS); } catch (e) {}
        try { localStorage.removeItem(LS_ALERTS); } catch (e) {}
        try { localStorage.removeItem(LS_RANGES); } catch (e) {}
        try { localStorage.removeItem(LS_WATCHLIST); } catch (e) {}
        try { localStorage.removeItem(LS_NOTIF); } catch (e) {}
        try { localStorage.removeItem(LS_RECORDS); } catch (e) {}
        try { document.cookie = LS_HOME_COOKIE + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'; } catch (e) {}
        try { document.cookie = LS_PERSIST_SNAP + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'; } catch (e) {}

        var rk3 = Object.keys(_rangesFilter);
        for (var ri3 = 0; ri3 < rk3.length; ri3++) _rangesFilter[rk3[ri3]] = '';
        _watchList = [];
        _watchlistMapFilter = false;
        _notifSettings = { enabled: false, military: true, emergency: true, alertDb: false, customRange: false, customRangeNm: 20, toasts: true, toastPhotos: false, toastDuration: 14, browserNotif: false };
        _sessionRecords = { maxAircraft: { val: 0, date: '' }, maxMilitary: { val: 0, date: '' }, maxRange: { val: 0, icao: '', callsign: '', date: '' }, maxAltitude: { val: 0, icao: '', callsign: '', date: '' }, maxSpeed: { val: 0, icao: '', callsign: '', date: '' } };
        settings.displayMode = 'sidebar';
        settings.useLocalDb = true;
        settings.routeKnownOnly = true;
        settings.hideAllScope = true;
        settings.homeOverride = false;
        settings.homeLat = '';
        settings.homeLon = '';
        settings.homeZoom = 12;
        settings.rvNotifyLayout = 'overlay';
        Object.keys(_tabVisibility).forEach(function (k) { _tabVisibility[k] = true; });
        Object.keys(_summarySettings).forEach(function (k) { _summarySettings[k] = true; });
        _distanceLocations = [];
        _distanceZones = [];
        _distanceMode = 'inside';
        _savedViews = [];
        _activeViewId = '';
        _activeViewIds = [];
        _rfPreViewState = null;
        _rvManualPos = null;

        _rfProbeStorage();
        applyPanelMode();
        applyFilter();
        buildPanel();
    };

    window._rfExportCSV = function () {
        if (!gReady()) return;
        var header = 'ICAO,Callsign,Type,Operator,Country,Altitude,Speed,VertRate,Heading,Lat,Lon,Distance_NM,Squawk,Military,OnGround,FirstSeen';
        var rxLat5 = null, rxLon5 = null;
        try {
            if (typeof SiteLat !== 'undefined' && SiteLat) { rxLat5 = +SiteLat; rxLon5 = +SiteLon; }
            else if (typeof g !== 'undefined' && g.SitePosition) { rxLat5 = g.SitePosition.lat; rxLon5 = g.SitePosition.lng; }
        } catch(e) {}
        var rows = [header];
        var planes = g.planesOrdered;
        for (var ci = 0; ci < planes.length; ci++) {
            var cp = planes[ci];
            if (!planePassesAllFilters(cp, null)) continue;
            var cAlt = typeof cp.altitude === 'number' ? cp.altitude : (typeof cp.alt_baro === 'number' ? cp.alt_baro : (cp.altitude === 'ground' ? 0 : ''));
            var cGs = typeof cp.gs === 'number' ? Math.round(cp.gs) : '';
            var cVr = typeof cp.geom_rate === 'number' ? cp.geom_rate : (typeof cp.baro_rate === 'number' ? cp.baro_rate : '');
            var cHdg = typeof cp.track === 'number' ? Math.round(cp.track) : '';
            var cLat = '', cLon = '', cDist = '';
            if (cp.position && cp.position.length >= 2) { cLon = +cp.position[0]; cLat = +cp.position[1]; }
            else if (!isNaN(+cp.lat)) { cLat = +cp.lat; cLon = +cp.lon; }
            if (cLat !== '' && rxLat5 !== null) cDist = haversineNm(rxLat5, rxLon5, +cLat, +cLon).toFixed(1);
            var cMil = isMilitaryAircraft(cp) ? '1' : '0';
            var cGnd = (cp.altitude === 'ground' || cp.alt_baro === 'ground') ? '1' : '0';
            var rcI = getRegCountryFromIcao(cp.icao);
            var cCtry = rcI ? rcI.name : '';
            var cFs = _sumArrivals[cp.icao] ? new Date(_sumArrivals[cp.icao]).toISOString() : '';
            function csvq(v) { var s = String(v === undefined || v === null ? '' : v); if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0) s = '"' + s.replace(/"/g, '""') + '"'; return s; }
            rows.push([
                csvq(cp.icao || ''), csvq(cp.flight || cp.name || ''), csvq(cp.icaoType || cp.typeLong || ''),
                csvq(''), csvq(cCtry), csvq(cAlt), csvq(cGs), csvq(cVr), csvq(cHdg),
                csvq(cLat), csvq(cLon), csvq(cDist), csvq(cp.squawk || ''),
                csvq(cMil), csvq(cGnd), csvq(cFs)
            ].join(','));
        }
        var blob = new Blob([rows.join('\n')], { type: 'text/csv' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        var dt = new Date();
        a.download = 'aircraft-' + dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0') + '.csv';
        document.body.appendChild(a);
        a.click();
        setTimeout(function() { try { URL.revokeObjectURL(a.href); document.body.removeChild(a); } catch(e) {} }, 0);
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // §21 Notifications & toasts
    // ═══════════════════════════════════════════════════════════════════════════

    // ── Toast type config ─────────────────────────────────────────────────────
    var TOAST_TYPE_CFG = {
        emergency:          { color: '#ff3b3b', border: '#ff1a1a', icon: '\u26A0\uFE0F',           label: 'EMERGENCY'       },
        military:           { color: '#ff8c00', border: '#e67e00', icon: '\u2708\uFE0F',            label: 'MILITARY'        },
        watchlist:          { color: '#4a9eff', border: '#2080ee', icon: '\uD83D\uDC41',            label: 'WATCHLIST'       },
        range:              { color: '#a855f7', border: '#9333ea', icon: '\uD83D\uDCCD',            label: 'IN RANGE'        },
        alert:              { color: '#22c55e', border: '#16a34a', icon: '\u2605',                  label: 'ALERT DB'        },
        'Military':         { color: '#ff8c00', border: '#e67e00', icon: '\u2708\uFE0F',            label: 'MILITARY'        },
        'Government':       { color: '#4a9eff', border: '#2080ee', icon: '\uD83C\uDFDB\uFE0F',      label: 'GOVERNMENT'      },
        'Historic':         { color: '#22c55e', border: '#16a34a', icon: '\uD83C\uDFFA',            label: 'HISTORIC'        },
        'Interesting':      { color: '#f59e0b', border: '#d97706', icon: '\u2B50',                  label: 'INTERESTING'     },
        'Law Enforcement':  { color: '#64748b', border: '#475569', icon: '\uD83D\uDEA8',            label: 'LAW ENFORCEMENT' },
    };

    // ── Photo fetching ────────────────────────────────────────────────────────
    function _rfFetchPlanePhoto(icao, cb) {
        var cached = _toastPhotoCache[icao];
        if (cached) { cb(cached.url); return; }
        if (_toastPhotoInflight[icao]) return;
        _toastPhotoInflight[icao] = true;
        fetch('https://api.planespotters.net/pub/photos/hex/' + encodeURIComponent(icao))
            .then(function(r) { return r.json(); })
            .then(function(d) {
                var url = null;
                if (d && d.photos && d.photos.length > 0) {
                    url = (d.photos[0].thumbnail_large && d.photos[0].thumbnail_large.src) ||
                          (d.photos[0].thumbnail      && d.photos[0].thumbnail.src)       || null;
                }
                _toastPhotoCache[icao] = { url: url, ts: Date.now() };
                delete _toastPhotoInflight[icao];
                cb(url);
            })
            .catch(function() {
                _toastPhotoCache[icao] = { url: null, ts: Date.now() };
                delete _toastPhotoInflight[icao];
                cb(null);
            });
    }

    // ── Toast container ───────────────────────────────────────────────────────
    function _rfToastContainer() {
        var el = document.getElementById('rf-toast-container');
        if (!el) {
            el = document.createElement('div');
            el.id = 'rf-toast-container';
            document.body.appendChild(el);
        }
        return el;
    }

    // ── Core toast renderer ───────────────────────────────────────────────────
    function _rfToast(opts) {
        if (!_notifSettings.toasts) return;
        var key = opts.key || ((opts.icao || 'x') + '_' + (opts.type || 'x'));
        var now = Date.now();
        var cooldown = 5 * 60 * 1000;
        if (opts.type === 'emergency') cooldown = 90 * 1000;
        if (_notifToastSeen[key] && (now - _notifToastSeen[key]) < cooldown) return;
        _notifToastSeen[key] = now;

        var id = 'rf-toast-' + (++_toastCounter);
        var cfg = TOAST_TYPE_CFG[opts.alertCategory] || TOAST_TYPE_CFG[opts.type] || TOAST_TYPE_CFG.alert;
        var dur = (_notifSettings.toastDuration || 14) * 1000;

        var routeHtml = opts.route
            ? '<div class="rf-toast-route">' + _rfEscText(opts.route) + '</div>'
            : '';

        var tagsHtml = (opts.alertTags && opts.alertTags.length)
            ? '<div class="rf-toast-tags">' +
              opts.alertTags.map(function(t) { return '<span class="rf-toast-tag">' + _rfEscText(t) + '</span>'; }).join('') +
              '</div>'
            : '';

        var metaParts = [];
        if (opts.aircraftType) metaParts.push(opts.aircraftType);
        if (opts.squawk)       metaParts.push('Sqk\u00a0' + opts.squawk);
        if (opts.distNm !== undefined && opts.distNm !== null) metaParts.push(opts.distNm.toFixed(1) + '\u00a0NM');
        var metaHtml = metaParts.length
            ? '<div class="rf-toast-meta">' + _rfEscText(metaParts.join(' \u2022 ')) + '</div>'
            : '';

        var linkHtml = (opts.alertLink && /^https?:\/\//i.test(opts.alertLink))
            ? '<a class="rf-toast-link" href="' + _rfEscAttr(opts.alertLink) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">More info \u2197</a>'
            : '';

        var photoHtml = _notifSettings.toastPhotos
            ? '<div class="rf-toast-photo" id="' + id + '-photo"><div class="rf-toast-photo-loading"></div></div>'
            : '';

        var html =
            '<div class="rf-toast" id="' + id + '" style="--toast-color:' + cfg.color + ';--toast-border:' + cfg.border + '" onclick="window._rfToastClick(\'' + _rfEscAttr(opts.icao || '') + '\')">' +
            '<div class="rf-toast-bar"></div>' +
            '<div class="rf-toast-inner">' +
            '<div class="rf-toast-left">' +
            '<div class="rf-toast-type-badge" style="background:' + cfg.border + '">' + cfg.icon + ' ' + cfg.label + '</div>' +
            '<div class="rf-toast-callsign">' + _rfEscText(opts.callsign || opts.icao || '') + '</div>' +
            (opts.reg      ? '<div class="rf-toast-reg">'      + _rfEscText(opts.reg)      + '</div>' : '') +
            (opts.operator ? '<div class="rf-toast-operator">' + _rfEscText(opts.operator) + '</div>' : '') +
            routeHtml + metaHtml + tagsHtml + linkHtml +
            '</div>' + photoHtml +
            '</div>' +
            '<button class="rf-toast-close" onclick="event.stopPropagation();window._rfToastDismiss(\'' + id + '\')">&#x2715;</button>' +
            '<div class="rf-toast-progress" id="' + id + '-prog"></div>' +
            '</div>';

        var container = _rfToastContainer();
        var wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        var toastEl = wrapper.firstChild;
        container.appendChild(toastEl);

        requestAnimationFrame(function() {
            requestAnimationFrame(function() { toastEl.classList.add('rf-toast-enter'); });
        });

        var progEl = document.getElementById(id + '-prog');
        if (progEl) {
            progEl.style.transition = 'width ' + dur + 'ms linear';
            requestAnimationFrame(function() {
                requestAnimationFrame(function() { progEl.style.width = '0%'; });
            });
        }

        setTimeout(function() { window._rfToastDismiss(id); }, dur);

        if (_notifSettings.toastPhotos && opts.icao) {
            _rfFetchPlanePhoto(opts.icao, function(url) {
                var photoEl = document.getElementById(id + '-photo');
                if (!photoEl) return;
                if (url) {
                    photoEl.innerHTML = '<img class="rf-toast-photo-img" src="' + _rfEscAttr(url) + '" alt="aircraft photo" onerror="this.parentNode.style.display=\'none\'">';
                } else {
                    photoEl.style.display = 'none';
                }
            });
        }

        // Cap stack at 6
        var toasts = container.querySelectorAll('.rf-toast');
        if (toasts.length > 6) {
            var oldest = toasts[0];
            if (oldest && oldest.id) window._rfToastDismiss(oldest.id);
        }
        return id;
    }

    window._rfToastDismiss = function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.classList.add('rf-toast-exit');
        setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 350);
    };

    window._rfToastClick = function (icao) {
        if (!icao) return;
        _sumFilter.clear();
        _sumFilter.add(icao.toUpperCase());
        applyFilter();
        buildPanel();
    };

    // ── Route string helper ───────────────────────────────────────────────────
    function _rfRouteStringForPlane(plane) {
        try {
            var route = parseRoute(plane);
            if (!route) return null;
            var from = route.fromDisplay || route.fromIcao || '';
            var to   = route.toDisplay   || route.toIcao   || '';
            if (!from && !to) return null;
            return from + ' \u2192 ' + to;
        } catch(e) { return null; }
    }

    // ── Alert DB lookup ───────────────────────────────────────────────────────
    function _rfAlertDbEntry(icao) {
        if (!_alertsDb || !icao) return null;
        var u = (icao + '').toUpperCase();
        for (var ai = 0; ai < _alertsDb.length; ai++) {
            if (_alertsDb[ai].icao === u) return _alertsDb[ai];
        }
        return null;
    }

    // ── Fire rich toast + optional OS notification ────────────────────────────
    function _rfNotify(title, body, key, plane, toastType) {
        var now = Date.now();
        var browserCooldown = 5 * 60 * 1000;
        if (toastType === 'emergency') browserCooldown = 90 * 1000;

        if (_notifSettings.browserNotif) {
            if (!(_notifSeen[key] && (now - _notifSeen[key]) < browserCooldown)) {
                _notifSeen[key] = now;
                try {
                    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                        new Notification('[RF] ' + title, { body: body, icon: '/favicon.ico' });
                    }
                } catch(e) {}
            }
        }

        if (!plane) return;
        var nicao = (plane.icao || '').toUpperCase();
        var alertEntry = _rfAlertDbEntry(nicao);
        var tags = [];
        if (alertEntry) {
            if (alertEntry.tag1) tags.push(alertEntry.tag1);
            if (alertEntry.tag2) tags.push(alertEntry.tag2);
            if (alertEntry.tag3) tags.push(alertEntry.tag3);
        }

        var distNm = null;
        try {
            var rx = _rfGetReceiverPos();
            var plat, plon;
            if (plane.position && plane.position.length >= 2) { plon = +plane.position[0]; plat = +plane.position[1]; }
            else { plat = +plane.lat; plon = +plane.lon; }
            if (rx && !isNaN(plat) && !isNaN(plon) && rx.lat !== 0) distNm = haversineNm(rx.lat, rx.lon, plat, plon);
        } catch(e) {}

        _rfToast({
            key:           key,
            type:          toastType || 'alert',
            title:         title,
            icao:          nicao,
            callsign:      plane.flight || plane.callsign || nicao,
            reg:           (alertEntry && alertEntry.reg)      || '',
            operator:      (alertEntry && alertEntry.operator) || '',
            aircraftType:  (alertEntry && alertEntry.type)     || plane.icaoType || plane.typeCode || '',
            route:         _rfRouteStringForPlane(plane),
            squawk:        plane.squawk || '',
            distNm:        distNm,
            alertCategory: (alertEntry && alertEntry.category) || '',
            alertLink:     (alertEntry && alertEntry.link)     || '',
            alertTags:     tags,
        });
    }

    // ── Notification checker (rate-limited to 10s) ────────────────────────────
    function _rfCheckNotifications() {
        if (!_notifSettings.enabled) return;
        if (!gReady()) return;
        var now = Date.now();
        if ((now - _notifLastCheck) < 10000) return;
        _notifLastCheck = now;

        var rxLat = null, rxLon = null;
        try {
            if (typeof SiteLat !== 'undefined' && SiteLat) { rxLat = +SiteLat; rxLon = +SiteLon; }
            else if (typeof g !== 'undefined' && g.SitePosition) { rxLat = g.SitePosition.lat; rxLon = g.SitePosition.lng; }
        } catch(e) {}

        var planes = g.planesOrdered;
        for (var ni = 0; ni < planes.length; ni++) {
            var np = planes[ni];
            var nicao = (np.icao || '').toUpperCase();
            var firstSeenMs = _sumArrivals[np.icao] || now;
            var isNew = (now - firstSeenMs) < 30000;

            // Emergency squawk — re-alert while squawking
            if (_notifSettings.emergency && np.squawk) {
                if (np.squawk === '7700') {
                    _rfNotify('Emergency 7700', (np.flight || nicao) + ' squawking GENERAL EMERGENCY', nicao + '_7700', np, 'emergency');
                } else if (np.squawk === '7600') {
                    _rfNotify('Radio Failure 7600', (np.flight || nicao) + ' squawking RADIO FAILURE', nicao + '_7600', np, 'emergency');
                } else if (np.squawk === '7500') {
                    _rfNotify('Hijack 7500', (np.flight || nicao) + ' squawking HIJACK', nicao + '_7500', np, 'emergency');
                }
            }

            // Military — new contacts only
            if (_notifSettings.military && isNew && isMilitaryAircraft(np)) {
                _rfNotify('Military Contact', (np.flight || nicao) + ' military detected', nicao + '_mil', np, 'military');
            }

            // Alert DB hit — new contacts only
            if (_notifSettings.alertDb && isNew && _alertsDb) {
                var alertEntry2 = _rfAlertDbEntry(nicao);
                if (alertEntry2) {
                    _rfNotify(alertEntry2.operator || alertEntry2.reg || nicao,
                        (alertEntry2.category || 'Alert DB') + ' aircraft on scope',
                        nicao + '_alertdb', np, 'alert');
                }
            }

            // Custom range — new contacts only
            if (_notifSettings.customRange && isNew && rxLat !== null) {
                var plat2, plon2;
                if (np.position && np.position.length >= 2) { plon2 = +np.position[0]; plat2 = +np.position[1]; }
                else { plat2 = +np.lat; plon2 = +np.lon; }
                if (!isNaN(plat2) && !isNaN(plon2)) {
                    var dist2 = haversineNm(rxLat, rxLon, plat2, plon2);
                    if (dist2 <= _notifSettings.customRangeNm) {
                        _rfNotify('In Range: ' + (np.flight || nicao),
                            (np.flight || nicao) + ' within ' + _notifSettings.customRangeNm + ' NM (' + dist2.toFixed(1) + ' NM)',
                            nicao + '_rng', np, 'range');
                    }
                }
            }
        }
    }

    // Override the §20 stub — now fully wired
    window._rfNotifTestToast = function () {
        _rfToast({
            type:         'alert',
            key:          'test_' + Date.now(),
            icao:         'TEST01',
            callsign:     'TEST FLIGHT',
            reg:          'G-TEST',
            operator:     'Robs Filters',
            aircraftType: 'B738',
            route:        'EGLL \u2192 EGCC',
            squawk:       '1234',
            distNm:       42.5,
            alertCategory: 'Interesting',
            alertTags:    ['test', 'demo'],
        });
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // §RV  Robs Views — standalone quick-access panel + cycle mode
    // ═══════════════════════════════════════════════════════════════════════════

    /** Position the RV panel below/beside the RV button. */
    function _rvPositionPanel() {
        var btn   = document.getElementById('rv-btn');
        var panel = document.getElementById('rv-panel');
        if (!btn || !panel) return;
        if (_rvManualPos && typeof _rvManualPos.left === 'number' && typeof _rvManualPos.top === 'number') {
            panel.style.left = Math.max(0, Math.min(window.innerWidth - 80, _rvManualPos.left)) + 'px';
            panel.style.top = Math.max(0, Math.min(window.innerHeight - 40, _rvManualPos.top)) + 'px';
            panel.style.right = 'auto';
            return;
        }
        var r = btn.getBoundingClientRect();
        panel.style.top   = (r.bottom + 4) + 'px';
        panel.style.right = Math.max(4, window.innerWidth - r.right) + 'px';
        panel.style.left  = 'auto';
    }

    function _rvMakeDraggable(panel, handle) {
        if (!panel || !handle) return;
        var startX, startY, startLeft, startTop;
        handle.addEventListener('mousedown', function (e) {
            if (e.target && e.target.classList && e.target.classList.contains('rv-close')) return;
            startX = e.clientX;
            startY = e.clientY;
            var rect = panel.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            function onMove(e2) {
                var nx = startLeft + e2.clientX - startX;
                var ny = startTop + e2.clientY - startY;
                panel.style.right = 'auto';
                panel.style.left = nx + 'px';
                panel.style.top = ny + 'px';
            }
            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                var r2 = panel.getBoundingClientRect();
                _rvManualPos = { left: Math.round(r2.left), top: Math.round(r2.top) };
                _rvSave();
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            e.preventDefault();
        });
    }

    /** Render the RV panel content. */
    function _rvRender() {
        var panel = document.getElementById('rv-panel');
        if (!panel) return;
        var prevList = panel.querySelector('.rv-list');
        var prevScroll = prevList ? prevList.scrollTop : 0;

        var esc     = _rfEscText;
        var escAttr = _rfEscAttr;
        var views   = _savedViews;

        // View list rows
        var listHtml = '';
        var cycSeq = _rvGetCycleSequence();
        if (views.length) {
            listHtml += '<div class="rv-section-label">Your Views</div>';
            for (var i = 0; i < views.length; i++) {
                var v = views[i];
                var isActive  = _activeViewIds.indexOf(v.id) >= 0;
                var isChecked = _rvCheckedIds.indexOf(v.id) >= 0;
                var isPinned  = _rvPinnedIds.indexOf(v.id) >= 0;
                var popupOn   = (_rvPopupViewIds.indexOf(v.id) >= 0);
                var soundOn   = (_rvSoundViewIds.indexOf(v.id) >= 0);
                var requireSeen = _rvCycleRequireSeenIds.indexOf(v.id) >= 0;
                var awaiting = requireSeen && !_rvSeenHistory[v.id];
                var newHits = _rvNewHits[v.id] || 0;
                var isCycling = _rvCycleActive && !_rvCyclePaused &&
                                cycSeq[_rvCycleIdx % cycSeq.length] === v.id;
                listHtml +=
                    '<div class="rv-view-row' + (isActive ? ' rv-view-active' : '') + (isCycling ? ' rv-view-cycling' : '') + '">' +
                    '<label class="rv-view-check-label">' +
                    '<input type="checkbox" class="rv-check" value="' + escAttr(v.id) + '"' + (isChecked ? ' checked' : '') + ' onchange="window._rvCheck(this)">' +
                    '<span class="rv-view-name">' + esc(v.name || ('View ' + (i + 1))) + '</span>' +
                    (awaiting ? '<span class="rv-badge rv-badge-wait">WAIT</span>' : '') +
                    (newHits > 0 ? '<span class="rv-badge rv-badge-new">NEW ' + newHits + '</span>' : '') +
                    (isActive  ? '<span class="rv-badge rv-badge-on">ON</span>'  : '') +
                    (isCycling ? '<span class="rv-badge rv-badge-cyc">CYC</span>' : '') +
                    '</label>' +
                    '<div class="rv-view-row-actions">' +
                    '<button class="rv-row-btn' + (isPinned ? ' rv-row-btn-pin-on' : '') + '" title="Always keep this view active" onclick="event.stopPropagation();window._rvTogglePinned(\'' + escAttr(v.id) + '\')">Always</button>' +
                    '<button class="rv-row-btn' + (popupOn ? ' rv-row-btn-popup-on' : '') + '" title="Enable popup notifications for this view" onclick="event.stopPropagation();window._rvTogglePopupView(\'' + escAttr(v.id) + '\')">Popup</button>' +
                    '<button class="rv-row-btn' + (soundOn ? ' rv-row-btn-sound-on' : '') + '" title="Enable sound notifications for this view" onclick="event.stopPropagation();window._rvToggleSoundView(\'' + escAttr(v.id) + '\')">Sound</button>' +
                    '<button class="rv-row-btn' + (requireSeen ? ' rv-row-btn-gate-on' : '') + '" title="Wait mode: skip this view until aircraft are seen for it" onclick="event.stopPropagation();window._rvToggleRequireSeen(\'' + escAttr(v.id) + '\')">Wait</button>' +
                    '<button class="rv-row-btn" title="Rename" onclick="event.stopPropagation();window._rvRenameView(\'' + escAttr(v.id) + '\')">&#9998;</button>' +
                    '<button class="rv-row-btn" title="Update with current filters" onclick="event.stopPropagation();window._rvUpdateView(\'' + escAttr(v.id) + '\')">&#8635;</button>' +
                    '<button class="rv-row-btn rv-row-btn-del" title="Delete" onclick="event.stopPropagation();window._rvDeleteView(\'' + escAttr(v.id) + '\')">&#215;</button>' +
                    '</div>' +
                    '</div>';
            }
        }
        // Built-in views section
        listHtml += '<div class="rv-section-label">Built-in Views</div>';
        for (var bi = 0; bi < RF_BUILTIN_VIEWS.length; bi++) {
            var bv = RF_BUILTIN_VIEWS[bi];
            var bActive  = _activeViewIds.indexOf(bv.id) >= 0;
            var bChecked = _rvCheckedIds.indexOf(bv.id) >= 0;
            var bPinned  = _rvPinnedIds.indexOf(bv.id) >= 0;
            var bPopupOn = (_rvPopupViewIds.indexOf(bv.id) >= 0);
            var bSoundOn = (_rvSoundViewIds.indexOf(bv.id) >= 0);
            var bRequireSeen = _rvCycleRequireSeenIds.indexOf(bv.id) >= 0;
            var bAwaiting = bRequireSeen && !_rvSeenHistory[bv.id];
            var bNewHits = _rvNewHits[bv.id] || 0;
            var bCycling = _rvCycleActive && !_rvCyclePaused &&
                           cycSeq[_rvCycleIdx % cycSeq.length] === bv.id;
            listHtml +=
                '<div class="rv-view-row rv-view-builtin' + (bActive ? ' rv-view-active' : '') + (bCycling ? ' rv-view-cycling' : '') + '">' +
                '<label class="rv-view-check-label">' +
                '<input type="checkbox" class="rv-check" value="' + escAttr(bv.id) + '"' +
                    (bChecked ? ' checked' : '') + ' onchange="window._rvCheck(this)">' +
                '<span class="rv-view-name">' + esc(bv.name) + '</span>' +
                (bAwaiting ? '<span class="rv-badge rv-badge-wait">WAIT</span>' : '') +
                (bNewHits > 0 ? '<span class="rv-badge rv-badge-new">NEW ' + bNewHits + '</span>' : '') +
                (bActive  ? '<span class="rv-badge rv-badge-on">ON</span>'  : '') +
                (bCycling ? '<span class="rv-badge rv-badge-cyc">CYC</span>' : '') +
                '</label>' +
                '<div class="rv-view-row-actions">' +
                '<button class="rv-row-btn' + (bPinned ? ' rv-row-btn-pin-on' : '') + '" title="Always keep this view active" onclick="event.stopPropagation();window._rvTogglePinned(\'' + escAttr(bv.id) + '\')">Always</button>' +
                '<button class="rv-row-btn' + (bPopupOn ? ' rv-row-btn-popup-on' : '') + '" title="Enable popup notifications for this view" onclick="event.stopPropagation();window._rvTogglePopupView(\'' + escAttr(bv.id) + '\')">Popup</button>' +
                '<button class="rv-row-btn' + (bSoundOn ? ' rv-row-btn-sound-on' : '') + '" title="Enable sound notifications for this view" onclick="event.stopPropagation();window._rvToggleSoundView(\'' + escAttr(bv.id) + '\')">Sound</button>' +
                '<button class="rv-row-btn' + (bRequireSeen ? ' rv-row-btn-gate-on' : '') + '" title="Wait mode: skip this view until aircraft are seen for it" onclick="event.stopPropagation();window._rvToggleRequireSeen(\'' + escAttr(bv.id) + '\')">Wait</button>' +
                '<button class="rv-row-btn" title="Save as editable copy" onclick="event.stopPropagation();window._rvCloneBuiltin(\'' + escAttr(bv.id) + '\')">&#43; Save copy</button>' +
                '</div>' +
                '</div>';
        }
        if (!views.length && !RF_BUILTIN_VIEWS.length) {
            listHtml = '<div class="rv-empty">No views available.</div>';
        }

        // Cycle status line
        var cycleStatus = '';
        if (_rvCycleActive) {
            var seq   = _rvGetCycleSequence();
            var cidx  = _rvCycleIdx % (seq.length || 1);
            var cv    = _rfFindViewById(seq[cidx]);
            var cvName = cv ? (cv.name || 'View') : '?';
            cycleStatus =
                '<div class="rv-cycle-status">' +
                (_rvCyclePaused ? '\u23F8 Paused ' : '\u25B6 Running ') +
                '<strong>' + (_rvRunMode === 'watchall' ? 'Watch all selected views' : (cvName + ' (' + (cidx + 1) + '/' + seq.length + ')')) + '</strong>' +
                '</div>';
        }

        panel.innerHTML =
            '<div class="rv-head">' +
            '  <span class="rv-title">Robs Views</span>' +
            '  <button class="rv-close" onclick="window._rvToggle(false)">\u2715</button>' +
            '</div>' +
            '<div class="rv-help"><strong>How this works:</strong> tick views to include in watch engine, use <strong>Always</strong> for baseline, <strong>Popup</strong> for per-view alerts, and <strong>Wait</strong> to hold a view until aircraft appear. Engine checks every ' + _rvCycleSec + 's.</div>' +
            '<div class="rv-help rv-help-legend"><span class="rv-help-chip">ALWAYS = always active</span><span class="rv-help-chip">POPUP = per-view alert</span><span class="rv-help-chip">SOUND = per-view audio</span><span class="rv-help-chip">WAIT = hold until first hit</span><span class="rv-help-chip">NEW = fresh aircraft detected</span></div>' +
            '<div class="rv-list">' + listHtml + '</div>' +
            '<div class="rv-actions">' +
            '  <button class="rv-btn-action" title="Check all views" onclick="window._rvCheckAll()">All</button>' +
            '  <button class="rv-btn-action" title="Uncheck all" onclick="window._rvCheckNone()">None</button>' +
            '  <button class="rv-btn-action" title="Apply current selection once (no watch loop)" onclick="window._rvApply()">Preview once</button>' +
            '  <button class="rv-btn-action rv-btn-clear" title="Clear all active views" onclick="window._rvClear()">\u23FB Clear</button>' +
            '</div>' +
            '<div class="rv-divider"></div>' +
            '<div class="rv-cycle-section">' +
            '  <div class="rv-cycle-title">Watch Engine</div>' +
            '  <div class="rv-cycle-desc">Choose run style then Start. Cycle rotates watch views one by one; Watch-all keeps selected views live together. Check interval: every <strong>' + _rvCycleSec + ' seconds</strong>.</div>' +
            '  <div class="rv-cycle-row">' +
            '    <label class="rv-lbl">Run style</label>' +
            '    <select class="rv-sec-input rv-detect-mode" onchange="window._rvSetRunMode(this.value)">' +
            '      <option value="cycle"' + (_rvRunMode === 'cycle' ? ' selected' : '') + '>Auto-cycle</option>' +
            '      <option value="watchall"' + (_rvRunMode === 'watchall' ? ' selected' : '') + '>Watch all selected</option>' +
            '    </select>' +
            '  </div>' +
            '  <div class="rv-cycle-row">' +
            '    <label class="rv-lbl">Interval</label>' +
            '    <input class="rv-sec-input" type="number" min="3" max="3600" value="' + _rvCycleSec + '" oninput="window._rvSetSec(this.value)">' +
            '    <span class="rv-lbl">s</span>' +
            '  </div>' +
            '  <div class="rv-cycle-row">' +
            '    <label class="rv-lbl">Popup</label>' +
            '    <input class="rv-sec-input" type="number" min="0" max="30" value="' + _rvPopupSec + '" oninput="window._rvSetPopupSec(this.value)">' +
            '    <span class="rv-lbl">s <span style="color:#78929a">(0=off)</span></span>' +
            '  </div>' +
            '  <div class="rv-cycle-row">' +
            '    <label class="rv-lbl" style="display:flex;align-items:center;gap:4px"><input type="checkbox"' + (_rvStickyNotify ? ' checked' : '') + ' onchange="window._rvSetStickyNotify(this.checked)"> Stay on screen</label>' +
            '    <span class="rv-lbl" style="color:#78929a">When on, detection panel stays until dismissed.</span>' +
            '  </div>' +
            '  <div class="rv-cycle-row">' +
            '    <label class="rv-lbl" style="display:flex;align-items:center;gap:4px"><input type="checkbox"' + (_rvPopupOnEntryOnly ? ' checked' : '') + ' onchange="window._rvSetPopupOnEntryOnly(this.checked)"> Popup on NEW aircraft only</label>' +
            '    <button class="rv-btn-action" title="Clear NEW-memory so next detections count as new" onclick="window._rvResetEntryMemory()">Reset NEW</button>' +
            '  </div>' +
            '  <div class="rv-cycle-row">' +
            '    <label class="rv-lbl">Detect</label>' +
            '    <select class="rv-sec-input rv-detect-mode" onchange="window._rvSetDetectMode(this.value)">' +
            '      <option value="step"' + (_rvDetectMode === 'step' ? ' selected' : '') + '>Each view</option>' +
            '      <option value="round"' + (_rvDetectMode === 'round' ? ' selected' : '') + '>End of cycle</option>' +
            '    </select>' +
            '    <label class="rv-lbl" style="display:flex;align-items:center;gap:4px"><input type="checkbox"' + (_rvDetectSound ? ' checked' : '') + ' onchange="window._rvSetDetectSound(this.checked)"> Sound</label>' +
            '  </div>' +
            '  <div class="rv-cycle-row">' +
            (!_rvCycleActive
                ? '    <button class="rv-btn-action rv-btn-start" onclick="window._rvCycleStart()">\u25B6 Start</button>'
                : (_rvCyclePaused
                    ? '    <button class="rv-btn-action rv-btn-start" onclick="window._rvCycleResume()">\u25B6 Resume</button>' +
                      '    <button class="rv-btn-action" onclick="window._rvCycleStop()">\u25A0 Stop</button>'
                    : '    <button class="rv-btn-action" onclick="window._rvCyclePause()">\u23F8 Pause</button>' +
                      '    <button class="rv-btn-action" onclick="window._rvCycleNext()">\u23E9 Next</button>' +
                      '    <button class="rv-btn-action" onclick="window._rvCycleStop()">\u25A0 Stop</button>')) +
            '  </div>' +
            cycleStatus +
            _rvWatchStatusHtml() +
            '</div>';
        var nextList = panel.querySelector('.rv-list');
        if (nextList) nextList.scrollTop = prevScroll;
    }

    /** Returns the ordered list of view IDs to cycle through. */
    function _rvGetCycleSequence() {
        var ids = _rvCheckedIds.filter(function (id) { return !!_rfFindViewById(id) && _rvPinnedIds.indexOf(id) < 0; });
        return ids;
    }

    function _rvWatchStatusHtml() {
        if (!_rvCycleActive) return '';
        var watchIds = _rvCheckedIds.filter(function (id) { return !!_rfFindViewById(id) && _rvPinnedIds.indexOf(id) < 0; });
        var pinned = _rvPinnedIds.filter(function (id) { return !!_rfFindViewById(id); });
        var waiting = 0, withHits = 0, rows = [];
        for (var i = 0; i < watchIds.length; i++) {
            var id = watchIds[i];
            var v = _rfFindViewById(id);
            if (!v) continue;
            var live = (typeof _rvLiveCountCache[id] === 'number') ? _rvLiveCountCache[id] : 0;
            var req = _rvCycleRequireSeenIds.indexOf(id) >= 0;
            var isWaiting = req && !_rvSeenHistory[id] && live === 0;
            if (isWaiting) waiting++;
            if (live > 0) withHits++;
            rows.push('<div class="rv-eng-row"><span class="rv-eng-name">' + _rfEscText(v.name || id) + '</span><span class="rv-eng-val">' + (live > 0 ? (live + ' live') : (isWaiting ? 'waiting' : 'idle')) + '</span></div>');
        }
        return '<div class="rv-eng-status"><div class="rv-eng-head">Watch status: ' + (watchIds.length + pinned.length) + ' total • ' + pinned.length + ' always • ' + watchIds.length + ' watched • ' + withHits + ' with hits • ' + waiting + ' waiting</div><div class="rv-eng-list">' + rows.join('') + '</div></div>';
    }

    window._rvRenameView = function (id) {
        var v = null;
        for (var i = 0; i < _savedViews.length; i++) { if (_savedViews[i].id === id) { v = _savedViews[i]; break; } }
        if (!v) return;
        var n = prompt('Rename view:', v.name || '');
        if (n === null) return;
        n = String(n).trim();
        if (!n) return;
        v.name = n;
        _rfSaveViews();
        _rvRender();
    };

    window._rvUpdateView = function (id) {
        var v = null;
        for (var i = 0; i < _savedViews.length; i++) { if (_savedViews[i].id === id) { v = _savedViews[i]; break; } }
        if (!v) return;
        if (!confirm('Update "' + (v.name || 'this view') + '" with your current filters?')) return;
        v.state = _rfCaptureViewState();
        v.updatedAt = Date.now();
        _rfSaveViews();
        _rfSyncActiveViewPointers();
        _rvRender();
    };

    window._rvDeleteView = function (id) {
        var idx = -1;
        for (var i = 0; i < _savedViews.length; i++) { if (_savedViews[i].id === id) { idx = i; break; } }
        if (idx < 0) return;
        var v = _savedViews[idx];
        if (!confirm('Delete view "' + (v.name || 'this view') + '"?')) return;
        _savedViews.splice(idx, 1);
        _rfSaveViews();
        var ai = _activeViewIds.indexOf(id);
        if (ai >= 0) { _activeViewIds.splice(ai, 1); _rfSyncActiveViewPointers(); }
        var ci = _rvCheckedIds.indexOf(id);
        if (ci >= 0) { _rvCheckedIds.splice(ci, 1); _rvSave(); }
        var pi = _rvPinnedIds.indexOf(id);
        if (pi >= 0) _rvPinnedIds.splice(pi, 1);
        var gi = _rvCycleRequireSeenIds.indexOf(id);
        if (gi >= 0) _rvCycleRequireSeenIds.splice(gi, 1);
        delete _rvSeenHistory[id];
        _rvRender();
    };

    window._rvCloneBuiltin = function (id) {
        var bv = null;
        for (var i = 0; i < RF_BUILTIN_VIEWS.length; i++) { if (RF_BUILTIN_VIEWS[i].id === id) { bv = RF_BUILTIN_VIEWS[i]; break; } }
        if (!bv) return;
        var n = prompt('Name for saved copy:', bv.name);
        if (n === null) return;
        n = String(n).trim();
        if (!n) return;
        var now = Date.now();
        var newId = 'view_' + now + '_' + Math.random().toString(36).slice(2, 8);
        var clone = JSON.parse(JSON.stringify(bv));
        clone.id = newId;
        clone.name = n;
        clone.builtin = false;
        clone.updatedAt = now;
        _savedViews.push(clone);
        _rfSaveViews();
        _rvRender();
    };

    /** Toggle RV panel open/closed. */
    window._rvToggle = function (force) {
        var show = (typeof force === 'boolean') ? force : !_rvOpen;
        _rvOpen = show;
        var panel = document.getElementById('rv-panel');
        var btn   = document.getElementById('rv-btn');
        if (!panel) return;
        if (show) {
            _rvPositionPanel();
            _rvRender();
            var head = panel.querySelector('.rv-head');
            if (head && !head.dataset.rvDragBound) {
                _rvMakeDraggable(panel, head);
                head.dataset.rvDragBound = '1';
            }
            panel.style.display = 'block';
        } else {
            panel.style.display = 'none';
        }
        if (btn) btn.className = 'button' + ((_activeViewIds.length || _rvCycleActive) ? ' activeButton' : ' inActiveButton') + (_rvOpen ? ' rv-btn-open' : '');
    };

    window._rvOpenTab = function (tab) {
        window._rvToggle(false);
        _rfOpenToTab(tab || 'views');
    };

    window._rvCompactHeader = function () {
        if (!settings.headerBtns) settings.headerBtns = {};
        Object.keys(settings.headerBtns).forEach(function (k) { settings.headerBtns[k] = false; });
        _rfSaveSettings();
        _rfUpdateHeaderBtns();
        _rvRender();
    };

    function _rvAnyOptionEnabled(id) {
        return _rvPinnedIds.indexOf(id) >= 0 ||
               _rvPopupViewIds.indexOf(id) >= 0 ||
               _rvSoundViewIds.indexOf(id) >= 0 ||
               _rvCycleRequireSeenIds.indexOf(id) >= 0;
    }

    function _rvSyncCheckedForView(id) {
        var idx = _rvCheckedIds.indexOf(id);
        if (_rvAnyOptionEnabled(id)) {
            if (idx < 0) _rvCheckedIds.push(id);
        } else {
            if (idx >= 0) _rvCheckedIds.splice(idx, 1);
        }
    }

    window._rvToggleRequireSeen = function (id) {
        if (_rvCheckedIds.indexOf(id) < 0) _rvCheckedIds.push(id);
        var idx = _rvCycleRequireSeenIds.indexOf(id);
        if (idx >= 0) _rvCycleRequireSeenIds.splice(idx, 1);
        else _rvCycleRequireSeenIds.push(id);
        _rvSyncCheckedForView(id);
        _rvSave();
        _rvRender();
    };

    window._rvTogglePopupView = function (id) {
        if (_rvCheckedIds.indexOf(id) < 0) _rvCheckedIds.push(id);
        var idx = _rvPopupViewIds.indexOf(id);
        if (idx >= 0) _rvPopupViewIds.splice(idx, 1);
        else _rvPopupViewIds.push(id);
        _rvSyncCheckedForView(id);
        _rvSave();
        _rvRender();
    };

    window._rvToggleSoundView = function (id) {
        if (_rvCheckedIds.indexOf(id) < 0) _rvCheckedIds.push(id);
        var idx = _rvSoundViewIds.indexOf(id);
        if (idx >= 0) _rvSoundViewIds.splice(idx, 1);
        else _rvSoundViewIds.push(id);
        _rvSyncCheckedForView(id);
        _rvSave();
        _rvRender();
    };

    window._rvTogglePinned = function (id) {
        if (_rvCheckedIds.indexOf(id) < 0) _rvCheckedIds.push(id);
        if (_rvPopupViewIds.indexOf(id) < 0) _rvPopupViewIds.push(id);
        var idx = _rvPinnedIds.indexOf(id);
        if (idx >= 0) _rvPinnedIds.splice(idx, 1);
        else _rvPinnedIds.push(id);
        _rvSyncCheckedForView(id);
        _rvSave();
        _rvRender();
    };

    /** Toggle a view's checked state in the RV picker. */
    window._rvCheck = function (el) {
        var id = el.value;
        _rvSyncCheckedForView(id);
        _rvSave();
        _rvRender();
    };

    window._rvCheckAll = function () {
        _rvCheckedIds = _savedViews.map(function (v) { return v.id; });
        _rvSave();
        _rvRender();
    };

    window._rvCheckNone = function () {
        _rvCheckedIds = [];
        _rvSave();
        _rvRender();
    };

    /** Apply checked views to the filter (first replaces, rest OR). */
    window._rvApply = function () {
        var ids = _rvCheckedIds.filter(function (id) { return !!_rfFindViewById(id); });
        var pinned = _rvPinnedIds.filter(function (id) { return !!_rfFindViewById(id); });
        ids = pinned.concat(ids.filter(function (id) { return pinned.indexOf(id) < 0; }));
        if (!ids.length) return;
        window._rfViewsApply(ids[0], false);
        for (var i = 1; i < ids.length; i++) window._rfViewsApply(ids[i], true);
        _rfSyncActiveViewPointers();
        _rvUpdateBtn();
        _rvRender();
    };

    /** Clear all active views. */
    window._rvClear = function () {
        window._rfViewsClearActive();
        _rvUpdateBtn();
        _rvRender();
    };

    /** Update the RV header button active state. */
    function _rvUpdateBtn() {
        var btn = document.getElementById('rv-btn');
        if (!btn) return;
        var active = _activeViewIds.length > 0 || _rvCycleActive;
        btn.className = 'button ' + (active ? 'activeButton' : 'inActiveButton') + (_rvOpen ? ' rv-btn-open' : '');
    }

    /** Start auto-cycle. */
    window._rvCycleStart = function () {
        if (_rvCycleActive) return;
        var seq = _rvGetCycleSequence();
        if (!seq.length && !_rvPinnedIds.length) return;
        var firstIdx = (_rvRunMode === 'cycle') ? _rvFindEligibleCycleIndex(seq, 0) : 0;
        if (_rvRunMode === 'cycle' && seq.length && firstIdx < 0) return;
        _rvCycleActive = true;
        _rvCyclePaused = false;
        _rvRoundHits   = {};
        _rvNewHits     = {};
        _rvLiveCountCache = {};
        _rvCycleIdx    = (firstIdx < 0 ? 0 : firstIdx);
        if (_rvRunMode === 'watchall') window._rvWatchAllTick();
        else _rvApplyCurrentCycleView(seq);
        _rvCycleTimer = setInterval((_rvRunMode === 'watchall') ? window._rvWatchAllTick : window._rvCycleNext, _rvCycleSec * 1000);
        _rvSave();
        _rvUpdateBtn();
        _rvRender();
    };

    window._rvCyclePause = function () {
        if (!_rvCycleActive || _rvCyclePaused) return;
        _rvCyclePaused = true;
        if (_rvCycleTimer) { clearInterval(_rvCycleTimer); _rvCycleTimer = null; }
        _rvRender();
    };

    window._rvCycleResume = function () {
        if (!_rvCycleActive || !_rvCyclePaused) return;
        _rvCyclePaused = false;
        _rvCycleTimer = setInterval((_rvRunMode === 'watchall') ? window._rvWatchAllTick : window._rvCycleNext, _rvCycleSec * 1000);
        _rvRender();
    };

    window._rvCycleStop = function () {
        _rvCycleActive = false;
        _rvCyclePaused = false;
        _rvCycleIdx    = 0;
        _rvRoundHits   = {};
        _rvLiveCountCache = {};
        if (_rvCycleTimer) { clearInterval(_rvCycleTimer); _rvCycleTimer = null; }
        window._rfViewsClearActive();
        _rvUpdateBtn();
        _rvRender();
    };

    /** Advance to next view in cycle. Called by timer and Next button. */
    window._rvCycleNext = function () {
        if (!_rvCycleActive) return;
        if (_rvRunMode === 'watchall') { window._rvWatchAllTick(); return; }
        var seq = _rvGetCycleSequence();
        if (!seq.length) { window._rvCycleStop(); return; }
        var prevIdx = _rvCycleIdx % seq.length;
        var next = _rvFindEligibleCycleIndex(seq, (prevIdx + 1) % seq.length);
        if (next < 0) return;
        if (_rvDetectMode === 'round' && next <= prevIdx) _rvFlushRoundHits(seq.length);
        _rvCycleIdx = next;
        _rvApplyCurrentCycleView(seq);
        if (_rvOpen) _rvRender();
    };

    window._rvWatchAllTick = function () {
        if (!_rvCycleActive) return;
        var pinned = _rvPinnedIds.filter(function (id) { return !!_rfFindViewById(id); });
        var watchIds = _rvCheckedIds.filter(function (id) { return !!_rfFindViewById(id) && pinned.indexOf(id) < 0; });
        var allIds = pinned.concat(watchIds.filter(function (id) { return pinned.indexOf(id) < 0; }));
        if (!allIds.length) return;
        window._rfViewsApply(allIds[0], false);
        for (var ai = 1; ai < allIds.length; ai++) window._rfViewsApply(allIds[ai], true);
        for (var vi = 0; vi < watchIds.length; vi++) {
            var id = watchIds[vi];
            var det = _rvCollectViewDetections(id, settings.rvNotifyLayout === 'sidebar' ? 30 : 6);
            _rvLiveCountCache[id] = det.count;
            var seenMap = _rvSeenIcaosByView[id] || {};
            var newHits = 0;
            for (var si = 0; si < det.icaos.length; si++) {
                var sic = det.icaos[si];
                if (!seenMap[sic]) { seenMap[sic] = 1; newHits++; }
            }
            _rvSeenIcaosByView[id] = seenMap;
            if (newHits > 0) _rvNewHits[id] = newHits;
            if (det.count > 0) _rvSeenHistory[id] = Date.now();
            var popupEnabledForView = (_rvPopupViewIds.indexOf(id) >= 0);
            var shouldPopup = popupEnabledForView && (!_rvPopupOnEntryOnly || newHits > 0);
            var soundEnabledForView = (_rvSoundViewIds.indexOf(id) >= 0);
            if (det.count > 0 && shouldPopup) {
                if (_rvDetectSound && soundEnabledForView) _rvNotifyDetectionSound();
                _rvShowCyclePopup(id, vi, watchIds.length, det);
                break;
            }
        }
        if (_rvOpen) _rvRender();
    };

    function _rvApplyCurrentCycleView(seq) {
        seq = seq || _rvGetCycleSequence();
        var pinned = _rvPinnedIds.filter(function (id2) { return !!_rfFindViewById(id2); });
        if (!seq.length && !pinned.length) return;
        var id = seq.length ? seq[_rvCycleIdx % seq.length] : '';
        if (id) window._rfViewsApply(id, false);
        else window._rfViewsClearActive();
        for (var pi = 0; pi < pinned.length; pi++) {
            if (pinned[pi] !== id) window._rfViewsApply(pinned[pi], true);
        }
        if (!id) return;
        var detLimit = (settings.rvNotifyLayout === 'sidebar') ? 30 : 6;
        var det = _rvCollectViewDetections(id, detLimit);
        _rvLiveCountCache[id] = det.count;
        var seenMap = _rvSeenIcaosByView[id] || {};
        var newHits = 0;
        for (var si = 0; si < det.icaos.length; si++) {
            var sic = det.icaos[si];
            if (!seenMap[sic]) { seenMap[sic] = 1; newHits++; }
        }
        _rvSeenIcaosByView[id] = seenMap;
        if (newHits > 0) _rvNewHits[id] = newHits;
        if (det.count > 0) {
            var v = _rfFindViewById(id);
            _rvRoundHits[id] = { name: v ? (v.name || 'View') : id, count: det.count };
            _rvSeenHistory[id] = Date.now();
        }
        var popupEnabledForView = (_rvPopupViewIds.indexOf(id) >= 0);
        var shouldPopup = popupEnabledForView && (!_rvPopupOnEntryOnly || newHits > 0);
        var soundEnabledForView = (_rvSoundViewIds.indexOf(id) >= 0);
        if (_rvDetectMode === 'step') {
            if (det.count > 0 && _rvDetectSound && soundEnabledForView) _rvNotifyDetectionSound();
            if (shouldPopup && (_rvPopupSec > 0 || det.count > 0)) _rvShowCyclePopup(id, _rvCycleIdx, seq.length, det);
        } else if (det.count > 0) {
            if (_rvDetectSound && soundEnabledForView) _rvNotifyDetectionSound();
            if (shouldPopup && _rvPopupSec > 0) _rvShowCyclePopup(id, _rvCycleIdx, seq.length, det);
        }
    }

    function _rvCountPlanesForView(id) {
        if (!gReady()) return 0;
        var v = _rfFindViewById(id);
        if (!v || !v.state) return 0;
        var cnt = 0;
        for (var i = 0; i < g.planesOrdered.length; i++) {
            if (planePassesViewSnapshot(g.planesOrdered[i], v.state)) cnt++;
        }
        return cnt;
    }

    function _rvCollectViewDetections(viewId, limit) {
        var out = { count: 0, planes: [], icaos: [] };
        if (!gReady()) return out;
        var v = _rfFindViewById(viewId);
        if (!v || !v.state) return out;
        var rx = _rfGetReceiverPos();
        var seenNow = {};
        for (var i = 0; i < g.planesOrdered.length; i++) {
            var p = g.planesOrdered[i];
            if (!planePassesViewSnapshot(p, v.state)) continue;
            out.count++;
            var icao = (p.icao || '').toUpperCase();
            if (icao && !seenNow[icao]) { seenNow[icao] = 1; out.icaos.push(icao); }
            if (out.planes.length >= (limit || 6)) continue;
            var alert = _rfAlertDbEntry(icao);
            var latlon = _rfPlaneLatLon(p);
            var distNm = null;
            if (rx && latlon && !isNaN(latlon.lat) && !isNaN(latlon.lon) && rx.lat !== 0) {
                distNm = haversineNm(rx.lat, rx.lon, latlon.lat, latlon.lon);
            }
            out.planes.push({
                icao: icao,
                callsign: p.flight || p.callsign || icao || '?',
                reg: (alert && alert.reg) || p.registration || '',
                operator: (alert && alert.operator) || getAirlineName((p.flight || '').slice(0, 3)) || '',
                aircraftType: (alert && alert.type) || p.icaoType || p.typeCode || '',
                route: _rfRouteStringForPlane(p) || '',
                category: (alert && alert.category) || '',
                tags: alert ? [alert.tag1, alert.tag2, alert.tag3].filter(Boolean) : [],
                link: (alert && alert.link) || '',
                distNm: distNm
            });
        }
        return out;
    }

    function _rvIsCycleEligible(id) {
        if (_rvCycleRequireSeenIds.indexOf(id) < 0) return true;
        var liveCount = _rvCountPlanesForView(id);
        if (liveCount > 0) {
            _rvSeenHistory[id] = Date.now();
            return true;
        }
        return !!_rvSeenHistory[id];
    }

    function _rvFindEligibleCycleIndex(seq, startIdx) {
        if (!seq || !seq.length) return -1;
        for (var i = 0; i < seq.length; i++) {
            var idx = (startIdx + i) % seq.length;
            if (_rvIsCycleEligible(seq[idx])) return idx;
        }
        return -1;
    }

    function _rvNotifyDetectionSound() {
        if (!_rvDetectSound) return;
        try {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            var ctx = new AC();
            var now = ctx.currentTime;
            var o1 = ctx.createOscillator(), g1 = ctx.createGain();
            o1.type = 'sine'; o1.frequency.value = 880;
            g1.gain.setValueAtTime(0.0001, now);
            g1.gain.exponentialRampToValueAtTime(0.10, now + 0.01);
            g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
            o1.connect(g1); g1.connect(ctx.destination);
            o1.start(now); o1.stop(now + 0.19);
            var o2 = ctx.createOscillator(), g2 = ctx.createGain();
            o2.type = 'sine'; o2.frequency.value = 1175;
            g2.gain.setValueAtTime(0.0001, now + 0.12);
            g2.gain.exponentialRampToValueAtTime(0.09, now + 0.14);
            g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.30);
            o2.connect(g2); g2.connect(ctx.destination);
            o2.start(now + 0.12); o2.stop(now + 0.31);
            setTimeout(function () { try { ctx.close(); } catch (e) {} }, 600);
        } catch (e) {}
    }

    window._rvSetSec = function (val) {
        var n = parseInt(val, 10);
        if (isNaN(n) || n < 3) n = 3;
        _rvCycleSec = n;
        _rvSave();
        // Restart timer with new interval if running
        if (_rvCycleActive && !_rvCyclePaused && _rvCycleTimer) {
            clearInterval(_rvCycleTimer);
            _rvCycleTimer = setInterval(window._rvCycleNext, _rvCycleSec * 1000);
        }
    };

    window._rvSetPopupSec = function (val) {
        var n = parseInt(val, 10);
        if (isNaN(n) || n < 0) n = 0;
        _rvPopupSec = n;
        _rvSave();
    };

    window._rvSetDetectMode = function (mode) {
        _rvDetectMode = (mode === 'round') ? 'round' : 'step';
        _rvSave();
    };

    window._rvSetDetectSound = function (on) {
        _rvDetectSound = !!on;
        _rvSave();
    };

    window._rvSetStickyNotify = function (on) {
        _rvStickyNotify = !!on;
        _rvSave();
    };

    window._rvSetPopupOnEntryOnly = function (on) {
        _rvPopupOnEntryOnly = !!on;
        _rvSave();
    };
    window._rvResetEntryMemory = function () {
        _rvSeenIcaosByView = {};
        _rvNewHits = {};
        if (_rvOpen) _rvRender();
    };
    window._rvSetRunMode = function (mode) {
        _rvRunMode = (mode === 'watchall') ? 'watchall' : 'cycle';
        _rvSave();
        if (_rvOpen) _rvRender();
    };

    /** Build a short human-readable summary from a serialised view state. */
    function _rvBuildViewSummary(vs) {
        if (!vs) return '';
        var lines = [];
        // Tab filters
        if (vs.tabState) {
            var tabLabels = { airports:'Airports', countries:'Countries', operators:'Operators',
                              routes:'Routes', aircraft:'Aircraft' };
            Object.keys(tabLabels).forEach(function (k) {
                var ts = vs.tabState[k];
                if (!ts) return;
                var items = Array.isArray(ts.items) ? ts.items : [];
                if (items.length) {
                    var dir = ts.direction && ts.direction !== 'both' ? ' (' + ts.direction + ')' : '';
                    lines.push(tabLabels[k] + dir + ': ' + items.slice(0, 3).join(', ') + (items.length > 3 ? ' +' + (items.length - 3) : ''));
                }
                if (k === 'aircraft') {
                    var cats = Array.isArray(ts.catFilter) ? ts.catFilter : [];
                    if (cats.length) lines.push('Category: ' + cats.join(', '));
                    if (ts.regCountryFilter) lines.push('Reg country: ' + ts.regCountryFilter);
                }
            });
        }
        // Distance zones
        if (vs.distance && Array.isArray(vs.distance.zones) && vs.distance.zones.length) {
            var zm = vs.distance.mode || 'inside';
            var zl = vs.distance.zones.map(function (z) { return (z.name || 'Zone') + ' ' + z.radiusNm + 'NM'; });
            lines.push((zm === 'outside' ? 'Outside' : 'Within') + ': ' + zl.join(', '));
        }
        // Alerts selected
        if (vs.alerts && Array.isArray(vs.alerts.selectedIcaos) && vs.alerts.selectedIcaos.length) {
            lines.push('Alerts: ' + vs.alerts.selectedIcaos.length + ' selected');
        }
        // Ranges
        if (vs.ranges) {
            var rf2 = vs.ranges, rp = [];
            if (vs.ranges.altMin || vs.ranges.altMax)   rp.push('Alt ' + (vs.ranges.altMin||'') + '\u2013' + (vs.ranges.altMax||'') + 'ft');
            if (vs.ranges.speedMin || vs.ranges.speedMax) rp.push('Spd ' + (vs.ranges.speedMin||'') + '\u2013' + (vs.ranges.speedMax||'') + 'kt');
            if (vs.ranges.callsign) rp.push('CS: ' + vs.ranges.callsign);
            if (rp.length) lines.push(rp.join(' \u2022 '));
        }
        return lines.join('\n');
    }

    function _rvFlushRoundHits(totalViews) {
        var keys = Object.keys(_rvRoundHits);
        if (!keys.length) return;
        _rvNotifyDetectionSound();
        var rows = keys.map(function (id) {
            var h = _rvRoundHits[id];
            return '<div class="rv-popup-round-row"><span class="rv-popup-round-name">' + _rfEscText(h.name || id) + '</span><span class="rv-popup-round-count">' + (h.count || 0) + '</span></div>';
        }).join('');
        var existing = document.getElementById('rv-cycle-popup');
        if (existing) existing.remove();
        var popup = document.createElement('div');
        popup.id = 'rv-cycle-popup';
        popup.className = 'rv-cycle-popup' + (settings.rvNotifyLayout === 'sidebar' ? ' rv-cycle-popup-sidebar' : '');
        popup.innerHTML =
            '<div class="rv-popup-label">Auto-cycle round complete</div>' +
            '<div class="rv-popup-name">Detection summary</div>' +
            '<div class="rv-popup-summary">Detected in ' + keys.length + ' of ' + totalViews + ' views</div>' +
            '<div class="rv-popup-round-list">' + rows + '</div>' +
            '<button class="rv-popup-dismiss" onclick="this.parentNode.remove()">dismiss</button>';
        document.body.appendChild(popup);
        requestAnimationFrame(function () { popup.classList.add('rv-popup-visible'); });
        if (!_rvStickyNotify && _rvPopupSec > 0) {
            _rvPopupTimer = setTimeout(function () {
                popup.classList.remove('rv-popup-visible');
                setTimeout(function () { if (popup.parentNode) popup.remove(); }, 350);
                _rvPopupTimer = null;
            }, _rvPopupSec * 1000);
        }
        _rvRoundHits = {};
    }

    /** Show an on-screen popup when the cycle advances to a new view. */
    function _rvShowCyclePopup(viewId, idx, total, det) {
        // Clear any existing popup timer
        if (_rvPopupTimer) { clearTimeout(_rvPopupTimer); _rvPopupTimer = null; }
        var existing = document.getElementById('rv-cycle-popup');
        if (existing) existing.remove();

        var v = _rfFindViewById(viewId);
        if (!v) return;

        det = det || _rvCollectViewDetections(viewId, 6);
        var acCount = det.count || 0;
        if (acCount > 0) _rvNewHits[viewId] = 0;
        var checkedCount = _rvGetCycleSequence().length;
        var activeCount = _activeViewIds.length;
        var newCount = _rvNewHits[viewId] || 0;

        var summary = _rvBuildViewSummary(v.state);
        var summaryHtml = '';
        if (summary) {
            var summaryLines = summary.split('\n');
            summaryHtml = '<div class="rv-popup-summary">' +
                summaryLines.map(function (l) { return '<div>' + _rfEscText(l) + '</div>'; }).join('') +
                '</div>';
        }

        var aircraftRows = '';
        if (det.planes && det.planes.length) {
            aircraftRows = '<div class="rv-popup-planes">' + det.planes.map(function (p, i) {
                var pid = 'rv-popup-plane-photo-' + i + '-' + (p.icao || 'x');
                return '<div class="rv-popup-plane-row">' +
                    '<div class="rv-popup-plane-main">' +
                    '<div class="rv-popup-plane-cs">' + _rfEscText(p.callsign || p.icao || '?') + '</div>' +
                    '<div class="rv-popup-plane-meta">' + _rfEscText([p.reg, p.aircraftType, p.operator].filter(Boolean).join(' • ')) + '</div>' +
                    (p.route ? '<div class="rv-popup-plane-route">' + _rfEscText(p.route) + '</div>' : '') +
                    '<div class="rv-popup-plane-tags">' +
                    (p.category ? '<span class="rv-popup-chip">' + _rfEscText(p.category) + '</span>' : '') +
                    (p.distNm !== null && p.distNm !== undefined ? '<span class="rv-popup-chip">' + _rfEscText(p.distNm.toFixed(1) + ' NM') + '</span>' : '') +
                    (p.tags || []).slice(0, 2).map(function (t) { return '<span class="rv-popup-chip">' + _rfEscText(t) + '</span>'; }).join('') +
                    '</div>' +
                    (p.link && /^https?:\/\//i.test(p.link) ? '<a class="rv-popup-link" href="' + _rfEscAttr(p.link) + '" target="_blank" rel="noopener">Info ↗</a>' : '') +
                    '</div>' +
                    '<div class="rv-popup-plane-photo" id="' + pid + '"></div>' +
                    '</div>';
            }).join('') + '</div>';
        }

        var popup = document.createElement('div');
        popup.id = 'rv-cycle-popup';
        popup.className = 'rv-cycle-popup' + (settings.rvNotifyLayout === 'sidebar' ? ' rv-cycle-popup-sidebar' : '');
        popup.innerHTML =
            '<div class="rv-popup-label">Auto-cycle \u2014 ' + (idx + 1) + ' of ' + total + '</div>' +
            '<div class="rv-popup-name">' + _rfEscText(v.name || 'View') + '</div>' +
            '<div class="rv-popup-top-summary">Checked: ' + checkedCount + ' • Active: ' + activeCount + (newCount > 0 ? (' • New: ' + newCount) : '') + '</div>' +
            summaryHtml +
            (acCount > 0 ? '<div class="rv-popup-count">' + acCount + ' aircraft detected</div>' : '<div class="rv-popup-count rv-popup-count-none">No aircraft detected</div>') +
            aircraftRows +
            '<button class="rv-popup-dismiss" onclick="this.parentNode.remove()">dismiss</button>';

        document.body.appendChild(popup);

        // Animate in
        requestAnimationFrame(function () { popup.classList.add('rv-popup-visible'); });

        if (det.planes && det.planes.length) {
            det.planes.forEach(function (p, i) {
                if (!p.icao) return;
                var pid = 'rv-popup-plane-photo-' + i + '-' + (p.icao || 'x');
                _rfFetchPlanePhoto(p.icao, function (url) {
                    var ph = document.getElementById(pid);
                    if (!ph) return;
                    if (!url) { ph.style.display = 'none'; return; }
                    ph.innerHTML = '<img src="' + _rfEscAttr(url) + '" alt="aircraft photo">';
                });
            });
        }

        if (!_rvStickyNotify && _rvPopupSec > 0) {
            _rvPopupTimer = setTimeout(function () {
                popup.classList.remove('rv-popup-visible');
                setTimeout(function () { if (popup.parentNode) popup.remove(); }, 400);
                _rvPopupTimer = null;
            }, _rvPopupSec * 1000);
        }
    }

    // ── RR — Robs Reset ───────────────────────────────────────────────────────

    window._rrReset = function () {
        // Stop RV cycle
        if (_rvCycleActive) {
            _rvCycleActive = false;
            _rvCyclePaused = false;
            _rvCycleIdx    = 0;
            if (_rvCycleTimer) { clearInterval(_rvCycleTimer); _rvCycleTimer = null; }
        }
        // Clear cycle popup if showing
        if (_rvPopupTimer) { clearTimeout(_rvPopupTimer); _rvPopupTimer = null; }
        var popup = document.getElementById('rv-cycle-popup');
        if (popup) popup.remove();
        // Close RV panel
        if (_rvOpen) window._rvToggle(false);
        // Clear RV checked selection
        _rvCheckedIds = [];
        _rvPinnedIds = [];
        _rvSave();
        // Clear all active views
        _activeViewIds = [];
        _rfPreViewState = null;
        _rfSyncActiveViewPointers();
        // Clear all RF filters
        _rfClear();
        // Update button states
        _rvUpdateBtn();
        var rrBtn = document.getElementById('rr-btn');
        if (rrBtn) {
            rrBtn.className = 'button activeButton';
            setTimeout(function () {
                var b = document.getElementById('rr-btn');
                if (b) b.className = 'button inActiveButton';
            }, 600);
        }
    };

    /** Re-apply active views after page load once tar1090 is ready. */
    function _rvRestoreActiveViews() {
        if (!_activeViewIds.length) return;
        _rfSyncActiveViewPointers(); // prune stale IDs
        if (!_activeViewIds.length) return;
        // Apply first view's state to set global filter vars
        var first = _rfFindViewById(_activeViewIds[0]);
        if (first) _rfApplyViewState(first.state || {});
        applyFilter();
        _rvUpdateBtn();
        console.log('[robs-filter] restored ' + _activeViewIds.length + ' active view(s)');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // §22 Init & TAR1090 hook
    // ═══════════════════════════════════════════════════════════════════════════

    /** Load all persisted state and start waiting for tar1090 to be ready. */
    function init() {
        _rfLoadAllPersisted();
        console.log('[robs-filter] v' + RF_VERSION + ' build=' + RF_BUILD + ' — waiting for tar1090');

        var attempts = 0;
        var wait = setInterval(function () {
            attempts++;
            try {
                if (document.getElementById('header_side') &&
                    typeof g !== 'undefined' && Array.isArray(g.planesOrdered)) {
                    clearInterval(wait);
                    installFilterHook();
                    inject();
                    _rvRestoreActiveViews();
                    _dbAutoSync();
                    loadAlerts(false);
                    console.log('[robs-filter] v' + RF_VERSION + ' ready — filter hook installed (' +
                                g.planesOrdered.length + ' planes)');
                }
            } catch (e) { /* g not yet defined */ }
            if (attempts > 120) {
                clearInterval(wait);
                console.warn('[robs-filter] timed out waiting for tar1090 to initialise');
            }
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
