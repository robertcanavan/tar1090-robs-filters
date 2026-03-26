/**
 * routes-filter.js
 * Multi-tab aircraft filter panel for tar1090.
 * Filters AND across: routes, airports (From/To), countries (From/To), operators, aircraft type.
 * Active filters shown as breadcrumb chips. Multiple items within a tab are OR'd.
 */
(function () {
    'use strict';
    var RF_BUILD = '2026-03-26a';

    // ── State ─────────────────────────────────────────────────────────────────
    // Each tab has its own independent filter state. All active tabs are AND-ed.
    const state = {
        panelOpen:    false,
        activeTab:    'summary',
        tabState: {
            airports:  { items: new Set(), direction: 'both', sortBy: 'count', sortDir: 'desc' },
            countries: { items: new Set(), direction: 'both', sortBy: 'count', sortDir: 'desc' },
            operators: { items: new Set(), direction: 'both', sortBy: 'count', sortDir: 'desc' },
            aircraft:  { items: new Set(), direction: 'both', sortBy: 'count', sortDir: 'desc', catFilter: new Set(), regCountryFilter: '' },
        },
        searchText:   '',
        refreshTimer: null,
    };

    // Module-level settings (not part of tab filter state)
    const settings = {
        displayMode: 'sidebar',
        sidebarSide: 'right',
        useLocalDb: true,
        routeKnownOnly: true,
        hideAllScope: true,
        homeOverride: false,
        homeLat: '',
        homeLon: '',
        homeZoom: 12,
    };

    // ResizeObserver / MutationObserver refs - cleaned up when leaving sidebar mode
    var _rfObservers = [];
    var _rfMapResizeTimer = null;
    var _rfMapInsetState = null;

    // ── Local database constants ──────────────────────────────────────────────
    var DB_AIRPORTS_URL    = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv';
    var DB_AIRLINES_URL    = 'https://raw.githubusercontent.com/vradarserver/standing-data/main/airlines/schema-01/airlines.csv';
    var DB_ROUTES_URL      = 'https://raw.githubusercontent.com/vradarserver/standing-data/main/routes/schema-01/{P}/{CODE}-all.csv';
    var DB_SYNC_MS         = 24 * 60 * 60 * 1000;
    var DB_KEY_AIRPORTS    = 'rf_db_airports_v1';
    var DB_KEY_AIRPORTS_TS = 'rf_db_airports_ts';
    var DB_KEY_AIRLINES    = 'rf_db_airlines_v1';
    var DB_KEY_AIRLINES_TS = 'rf_db_airlines_ts';
    var DB_KEY_ROUTES_PFX  = 'rf_db_rt_';

    var _localDb = {
        airports:       null,  // {ICAO: {n:name, c:iso2}} loaded from localStorage/fetch
        airlines:       null,  // {CODE: name}
        routes:         {},    // {CALLSIGN: {dep, arr}} lazy-populated per airline
        routesFetched:  {},    // airline codes already fetched
        routesFetching: {},    // airline codes currently in-flight
        st: {
            airports: { busy: false, err: null, count: 0, ts: 0 },
            airlines: { busy: false, err: null, count: 0, ts: 0 }
        }
    };

    // ── Per-tab visibility (persisted) ────────────────────────────────────────
    var TAB_VIS_KEY    = 'rf_tab_vis_v1';
    var SETTINGS_KEY   = 'rf_settings_v1';
    var HOME_KEY       = 'rf_home_v1';
    var VIEWS_KEY      = 'rf_views_v1';
    var PERSIST_COOKIE_KEY = 'rf_persist_v1';
    var HOME_COOKIE_KEY = 'rf_home_cookie_v1';
    var _tabVisibility = { summary: true, airports: true, countries: true, operators: true, aircraft: true, views: true, alerts: true, distance: true };
    var _savedViews = [];
    var _activeViewId = '';
    var _rfQuickSelectedViewId = '';

    // ── Summary section visibility (persisted) ────────────────────────────────
    var SUMMARY_SETTINGS_KEY = 'rf_sum_settings_v1';
    var _summarySettings = {
        altitude:      true,   // Altitude Distribution chart
        attention:     true,   // Emergency / military / low-altitude alerts
        closest:       true,   // Closest aircraft list
        speed:         true,   // Speed leaders (fastest planes)
        highflyers:    true,   // High flyers (highest altitude)
        types:         true,   // Most common aircraft types
        operators:     true,   // Busiest operators
        routes:        true,   // Busiest routes
        methods:       true,   // Tracking method breakdown (ADS-B / MLAT / etc.)
        range:         true,   // Range & coverage (furthest aircraft)
        arrivals:      true,   // Recent arrivals (appeared in last 5 min)
        countries:     true,   // Countries visible (from registration prefix)
        slowest:       true,   // Slowest airborne aircraft (> 30 kt)
    };

    // Runtime panel scope used by all tabs (does not clear filters):
    //  - all:      all aircraft currently received
    //  - inview:   only aircraft currently in map viewport
    //  - filtered: only aircraft that pass all currently applied filters
    var _panelScope = 'all';

    // Quick-filter set populated by clicking items on the Summary tab.
    // When non-empty only these ICAOs are shown on the map.
    var _sumFilter = new Set();

    // Indexed click-data array: onclick uses window._rfSumFilterIdx(n) instead of
    // embedding JSON directly in HTML attributes (double-quotes would break the attribute).
    var _sumClickData = [];

    // Saved OL map view before a filter-driven auto-pan so we can restore it on clear.
    var _mapViewSaved = null;
    // Saved OL map view before global cross-tab auto-fit starts.
    var _autoFitSavedView = null;
    // One-time recenter on first RF panel open.
    var _rfDidInitialHomeCenter = false;
    // Home pick mode state (click map to set home).
    var _rfHomePickHandler = null;
    var _rfCookieOk = null;
    var _rfLocalStorageOk = null;

    // Tracks first-seen timestamp per ICAO for "Recent Arrivals" section.
    // {icao: timestampMs} — pruned each refresh to only include current planes.
    var _sumArrivals = {};

    // ── Alerts state ──────────────────────────────────────────────────────────
    var _alertsDb        = null;  // null=not loaded, array when loaded
    var _alertsFetching  = false;
    var _alertsTimestamp = 0;
    var _alertsError     = null;
    var _alertsMoreInfo  = null;  // icao string of currently shown more-info card, or null
    // Filter state for alerts tab (separate from tabState - doesn't cross-filter other tabs)
    var _alertsFilters        = { cmpg: '', category: '', tag: '' };
    // Map filter: when true, only planes whose ICAO is in the filtered alerts DB are shown
    var _alertsMapFilter      = false;
    var _alertsMapFilterIcaos = null; // pre-built Set<ICAO> for efficient isFiltered checks
    // Selected ICAOs: clicking a row adds/removes; takes priority over broad map filter
    var _alertsSelectedIcaos  = new Set();
    // Lightweight photo cache for alerts cards (icao -> thumbnail url)
    // (currently unused in basic alerts mode, kept for future opt-in enrichments)
    var _alertsPhotoCache     = {};
    var _alertsPhotoInflight  = {};
    // Per-render indexed click data for Alerts tab (avoids fragile inline quoting).
    var _alertsClickData      = [];

    // ── Distance filter state ─────────────────────────────────────────────────
    var _distMap = null;          // Leaflet map instance (mini-map in panel)
    var _distMapMarker = null;    // centre point marker on mini-map
    var _distMapCircle = null;    // radius circle on mini-map
    var _leafletReady = false;    // Leaflet loaded flag

    var _distOLLayer  = null;     // OL vector layer drawn on the TAR1090 main map
    var _distOLSource = null;     // vector source for that layer

    var DIST_LS_KEY        = 'rf_dist_locs_v1';
    var DIST_ZONES_KEY     = 'rf_dist_zones_v2';      // persists active zones array
    var DIST_MODE_KEY      = 'rf_dist_mode_v1';       // inside | outside | maponly
    var _distanceLocations = [];  // [{name, lat, lon, radiusNm}] persisted in localStorage
    // Active zones array — multiple zones with OR logic
    // Each zone: {lat, lon, radiusNm, name, altMode, altMin, altMax}
    var _distanceZones     = [];
    // Distance behavior mode:
    //  inside  = include aircraft inside any zone
    //  outside = include aircraft outside all zones
    //  maponly = do not filter aircraft, only show zone overlay on map
    var _distanceMode      = 'inside';
    // Form working state -- tracks what the user is currently typing
    // Used to repopulate the form on auto-refresh without wiping edits
    var _distanceForm = {
        locationIdx:  -1,
        locationName: '',
        lat:          '',
        lon:          '',
        radiusNm:     '50',
        altMode:      'all',
        altMin:       '0',
        altMax:       '50000',
        mapZoom:      8,
    };

    // Shorthand helpers
    function ts()             { return state.tabState[state.activeTab]; }
    function isFilterActive() {
        var ac = state.tabState.aircraft;
        if (ac.catFilter.size > 0 || ac.regCountryFilter !== '') return true;
        if (_alertsSelectedIcaos.size > 0) return true;
        if (_alertsMapFilter && _alertsMapFilterIcaos) return true;
        if (_distanceZones.length > 0 && _distanceMode !== 'maponly') return true;
        if (_sumFilter.size > 0) return true;
        return Object.values(state.tabState).some(function(s) { return s.items.size > 0; });
    }

    // ── ICAO airline code → full name ─────────────────────────────────────────
    const AIRLINE_NAMES = {
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
        'GWI':'Germanwings','EWG':'Eurowings','TUI':'TUI fly',
    };

    function getAirlineName(code) {
        if (!code || code === 'unknown') return null;
        var uc = code.toUpperCase();
        if (_localDb.airlines && _localDb.airlines[uc]) return _localDb.airlines[uc];
        return AIRLINE_NAMES[uc] || uc;
    }

    // ── ISO 3166-1 alpha-2 → Country name ─────────────────────────────────────
    const ISO_COUNTRY = {
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
        'MT':'Malta',
    };

    function countryFromIso(iso2) {
        if (!iso2) return 'Unknown';
        return ISO_COUNTRY[iso2.toUpperCase()] || iso2.toUpperCase();
    }

    // ── Emoji flag from ISO 3166-1 alpha-2 ────────────────────────────────────
    function flagFromIso(iso2) {
        if (!iso2 || iso2.length !== 2) return '';
        const base = 0x1F1E6;
        return String.fromCodePoint(base + iso2.charCodeAt(0) - 65) +
               String.fromCodePoint(base + iso2.charCodeAt(1) - 65);
    }

    // ── ICAO airport prefix → Country ─────────────────────────────────────────
    const PREFIX_COUNTRY = {
        'EG':'United Kingdom','EI':'Ireland','EH':'Netherlands','EB':'Belgium',
        'EL':'Luxembourg','ED':'Germany','ET':'Germany','LF':'France','LE':'Spain',
        'GC':'Spain','LP':'Portugal','LG':'Greece','LI':'Italy','LM':'Malta',
        'LH':'Hungary','LO':'Austria','LK':'Czech Republic','LZ':'Slovakia','EP':'Poland',
        'LD':'Croatia','LJ':'Slovenia','LB':'Bulgaria','LR':'Romania','LY':'Serbia',
        'LW':'North Macedonia','LA':'Albania','LQ':'Bosnia & Herzegovina',
        'EK':'Denmark','EN':'Norway','ES':'Sweden','EF':'Finland','BI':'Iceland',
        'EV':'Latvia','EY':'Lithuania','EE':'Estonia','UK':'Ukraine','UM':'Belarus',
        'LT':'Turkey','LL':'Israel','LC':'Cyprus',
        'UU':'Russia','UL':'Russia','UW':'Russia','UI':'Russia','UN':'Russia','UT':'Russia','UE':'Russia',
        'OE':'Saudi Arabia','OM':'UAE','OB':'Bahrain','OK':'Kuwait','OI':'Iran',
        'OJ':'Jordan','OS':'Syria','OL':'Lebanon','OY':'Yemen','OP':'Pakistan','OA':'Afghanistan',
        'VT':'India','VE':'India','VI':'India','VN':'Nepal','VL':'Laos','VB':'Myanmar',
        'VD':'Cambodia','VV':'Vietnam','WA':'Indonesia','WI':'Indonesia','WM':'Malaysia',
        'WS':'Singapore','VH':'Thailand','RJ':'Japan','RK':'South Korea','RC':'Taiwan',
        'ZB':'China','ZG':'China','ZH':'China','ZL':'China','ZP':'China','ZS':'China',
        'ZU':'China','ZW':'China','ZY':'China',
        'YM':'Australia','YB':'Australia','YP':'Australia','YS':'Australia','YT':'Australia',
        'NZ':'New Zealand','FA':'South Africa','FB':'Botswana','FQ':'Mozambique',
        'FW':'Malawi','FV':'Zimbabwe','FK':'Cameroon','FN':'Angola','HA':'Ethiopia',
        'HH':'Eritrea','HK':'Kenya','HS':'Sudan','HT':'Tanzania','HU':'Uganda',
        'DN':'Nigeria','DG':'Ghana','DI':'Ivory Coast','GM':'Morocco','DT':'Tunisia',
        'HL':'Libya','HE':'Egypt','CY':'Canada','CF':'Canada','CG':'Canada','CZ':'Canada',
        'MM':'Mexico','MU':'Cuba','MD':'Dominican Republic','MK':'Jamaica',
        'SB':'Brazil','SN':'Brazil','SS':'Brazil','SA':'Argentina','SC':'Chile',
        'SP':'Peru','SE':'Ecuador','SK':'Colombia','SV':'Venezuela','SU':'Uruguay',
    };

    function getCountryFromAirport(icao) {
        if (!icao || icao.length < 2) return 'Unknown';
        if (icao[0] === 'K') return 'United States';
        if (icao[0] === 'P' && icao.length === 4) return 'United States';
        if (icao[0] === 'C') return 'Canada';
        return PREFIX_COUNTRY[icao.substring(0, 2).toUpperCase()] || ('Other (' + icao.substring(0, 2).toUpperCase() + ')');
    }

    // Hardcoded country-name → ISO-3166-1 alpha-2 lookup.
    // Covers all names produced by getCountryFromAirport() and _rfRegCountry().
    const COUNTRY_ISO2_MAP = {
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
        'Switzerland':'CH','Namibia':'NA','Israel':'IL',
    };

    // Get ISO2 for a country name — tries dynamic DB map first, then hardcoded.
    function _toIso2(name) {
        if (!name) return '';
        try { var v = _countryIso2.get(name); if (v) return v; } catch(e) {}
        return COUNTRY_ISO2_MAP[name] || '';
    }

    // Flag emoji for an ICAO airport code (e.g. "EGLL" → 🇬🇧).
    function airportFlag(icao) {
        var iso2 = _toIso2(getCountryFromAirport(icao));
        return iso2 ? flagFromIso(iso2) : '';
    }

    // ── Aircraft category lookup ──────────────────────────────────────────────
    // Key = ICAO type designator, value = category ID
    // 1=Heavy  2=Jet  3=Business  4=Turboprop  5=Helicopter  6=Military  7=Light
    const AIRCRAFT_CATEGORIES = {
        // Heavy / wide-body
        'A124':1,'A225':1,'A306':1,'A30B':1,'A310':1,'A332':1,'A333':1,'A342':1,
        'A343':1,'A345':1,'A346':1,'A359':1,'A35K':1,'A388':1,'B703':1,'B741':1,
        'B742':1,'B743':1,'B744':1,'B748':1,'B74S':1,'B762':1,'B763':1,'B764':1,
        'B772':1,'B77L':1,'B77W':1,'B788':1,'B789':1,'B78X':1,'IL96':1,'MD11':1,
        'DC8':1,'IL62':1,
        // Narrow-body jet
        'A19N':2,'A20N':2,'A21N':2,'A318':2,'A319':2,'A320':2,'A321':2,'A32N':2,
        'A32S':2,'B461':2,'B462':2,'B463':2,'B712':2,'B732':2,'B733':2,'B734':2,
        'B735':2,'B736':2,'B737':2,'B738':2,'B739':2,'B38M':2,'B39M':2,'B3XM':2,
        'B752':2,'B753':2,'CRJ1':2,'CRJ2':2,'CRJ7':2,'CRJ9':2,'CRJX':2,
        'E135':2,'E145':2,'E170':2,'E175':2,'E190':2,'E195':2,'E290':2,'E295':2,
        'E75L':2,'E75S':2,'MD80':2,'MD81':2,'MD82':2,'MD83':2,'MD88':2,'MD90':2,
        'TU54':2,'DC9':2,'D328':2,'B190':2,
        // Business jet
        'C25A':3,'C25B':3,'C25C':3,'C25M':3,'C510':3,'C525':3,'C55B':3,'C560':3,
        'C56X':3,'C680':3,'C700':3,'C750':3,'CL30':3,'CL35':3,'CL60':3,'CL65':3,
        'F2TH':3,'F900':3,'FA20':3,'FA50':3,'FA7X':3,'FA8X':3,'GL5T':3,'GL7T':3,
        'GLEX':3,'G150':3,'G280':3,'G550':3,'G600':3,'G650':3,'HA4T':3,'LJ35':3,
        'LJ45':3,'LJ60':3,'LJ75':3,'PC24':3,'PRM1':3,'BE40':3,'E50P':3,
        'E545':3,'E550':3,'EA50':3,'P180':3,
        // Turboprop
        'AT43':4,'AT44':4,'AT45':4,'AT46':4,'AT72':4,'AT73':4,'AT75':4,'AT76':4,
        'ATP':4,'BE20':4,'BE99':4,'C208':4,'C212':4,'DH8A':4,'DH8B':4,'DH8C':4,
        'DH8D':4,'DHC6':4,'DHC7':4,'E120':4,'F27':4,'F50':4,'F60':4,'JS31':4,
        'JS32':4,'JS41':4,'L410':4,'PC12':4,'SF34':4,'SB20':4,'SW4':4,'Y12':4,
        'AN24':4,'AN26':4,'MA60':4,'C295':4,
        // Helicopter
        'A109':5,'A119':5,'A139':5,'A149':5,'A169':5,'A189':5,'AS32':5,'AS50':5,
        'AS55':5,'AS65':5,'B06':5,'B06T':5,'B105':5,'B212':5,'B222':5,'B230':5,
        'B407':5,'B412':5,'B427':5,'B429':5,'B430':5,'B505':5,'BK17':5,'CH47':5,
        'EC25':5,'EC30':5,'EC35':5,'EC45':5,'EC55':5,'EC75':5,'H160':5,'H175':5,
        'H215':5,'H225':5,'K126':5,'K226':5,'MI8':5,'MI17':5,'R22':5,'R44':5,
        'R66':5,'S61':5,'S76':5,'S92':5,'UH60':5,'AW139':5,'NH90':5,'TIGR':5,
        // Military - fighters / attack
        'F15':6,'F15E':6,'F16C':6,'F16D':6,'F16':6,'F18':6,'F18E':6,'F18F':6,'F18G':6,
        'FA18':6,'F22':6,'F35':6,'FA35':6,'F104':6,'F111':6,'F14':6,'AV8B':6,'A10':6,
        'EUFI':6,'GRIF':6,'JAS3':6,'TPHN':6,'TRNT':6,'TORN':6,'MIRF':6,'MIR2':6,
        'RFAL':6,'SU27':6,'SU30':6,'SU35':6,'SU57':6,'MIG29':6,'MIG31':6,'MIG35':6,
        'B1':6,'B2':6,'B21':6,'B52':6,'TU95':6,'TU22':6,'TU160':6,
        // Military - transports / tankers / ISR
        'C17':6,'C130':6,'C5':6,'A400':6,'C27':6,'C141':6,'C5M':6,'C130J':6,
        'KC135':6,'KC46':6,'MRTT':6,'KC10':6,'KC130':6,'K35R':6,
        'P8':6,'P3':6,'P1':6,'P3C':6,'E3':6,'E7':6,'E2':6,'E6':6,'E8':6,
        'RC135':6,'U2':6,'SR71':6,'TR1':6,'RQ4':6,'MQ9':6,'MQ1':6,
        // Military - trainers
        'HAWK':6,'T38':6,'T45':6,'T6':6,'T6A':6,'T50':6,'M346':6,'L39':6,'L159':6,
        'PC9':6,'PC21':6,'MB339':6,'MB326':6,'SF260':6,'G120':4,'G12T':4,
        'AJET':6,'T37':6,'T2':6,
        // Military - helicopters (military variants - civilian ones already in helicopter section)
        'AH64':5,'MH60':5,'HH60':5,'CH53':5,'MH53':5,
        'V22':6,'MV22':6,'CV22':6,'LYNX':5,'PUMA':5,
        'MERL':5,'SH60':5,'SH3':5,
        // Light / piston
        'C172':7,'C152':7,'C182':7,'C206':7,'C210':7,'PA28':7,'P28A':7,'PA32':7,'PA24':7,
        'SR20':7,'SR22':7,'DA40':7,'DA42':7,'DA62':7,'DA20':7,'BE58':7,'BE36':7,
        'C150':7,'C177':7,'C162':7,'TB20':7,'TB21':7,'TB10':7,'TOBA':7,'P2006':7,
        'P210':7,'DR40':7,'RF6':7,'G115':7,'A210':7,'BR23':7,'SIRA':7,'EV97':7,
        'RV4':7,'RV6':7,'RV7':7,'RV8':7,'C120':7,'C170':7,'PA18':7,'PA22':7,
        // Additional types from live data
        'BCS1':2,'BCS3':2,          // Airbus A220-100/300
        'A339':1,'A337':1,          // A330-900neo, Beluga XL
        'TBM7':4,'TBM8':4,'TBM9':4, // TBM 700/850/900/910
        'E55P':3,'C68A':3,'C550':3,'C551':3, // bizjets
        'BE9L':4,'BE90':4,          // King Air variants
        'G2CA':5,                   // Guimbal Cabri G2
        'A35K':1,                   // A350-1000 (duplicate safety)
        'G103':7,                   // Grob G-103 glider
    };

    // ADS-B emitter category (plane.category) → our category ID
    // These are the values broadcast by the aircraft's Mode S transponder
    const ADSB_CAT_MAP = {
        'A1':7, // Light  < 15500 lbs
        'A2':7, // Small  15500-75000 lbs
        'A3':2, // Large  75000-300000 lbs
        'A4':2, // High vortex large (B757)
        'A5':1, // Heavy  > 300000 lbs
        'A6':2, // High performance > 5g, > 400kts
        'A7':5, // Rotorcraft
        'B1':7, // Glider / sailplane
        'B2':7, // Lighter-than-air
        'B4':7, // Ultralight
        'B6':7, // UAV
    };

    // Category display info
    const CATEGORY_INFO = {
        1: { label: 'Heavy',      emoji: '✈', color: '#e8a87c' },
        2: { label: 'Jet',        emoji: '✈', color: '#7cb9e8' },
        3: { label: 'Business',   emoji: '🛩', color: '#a8e87c' },
        4: { label: 'Turboprop',  emoji: '✈', color: '#e8d87c' },
        5: { label: 'Helicopter', emoji: '🚁', color: '#b87ce8' },
        6: { label: 'Military',   emoji: '✈', color: '#e87c7c' },
        7: { label: 'Light',      emoji: '🛩', color: '#7ce8c8' },
        0: { label: '',           emoji: '✈', color: '#888888' },
    };

    // ── ICAO 24-bit hex → registration country ────────────────────────────────
    // Ranges are [startHex, endHex, iso2] sorted by start. Binary search used.
    const ICAO_RANGES = [
        [0x004000,0x0043FF,'ZW'],[0x006000,0x006FFF,'MZ'],[0x008000,0x008FFF,'ZA'],
        [0x00A000,0x00A3FF,'BW'],[0x010000,0x017FFF,'EG'],[0x018000,0x01FFFF,'LY'],
        [0x020000,0x027FFF,'MA'],[0x028000,0x02FFFF,'TN'],[0x030000,0x033FFF,'GH'],
        [0x034000,0x034FFF,'NG'],[0x035000,0x038FFF,'NG'],[0x038000,0x03FFFF,'NG'],
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
        [0xEB0000,0xEBFFFF,'VE'],
    ];

    function getRegCountryFromIcao(icaoHex) {
        if (!icaoHex || icaoHex.length < 4) return null;
        var n = parseInt(icaoHex, 16);
        if (isNaN(n)) return null;
        var lo = 0, hi = ICAO_RANGES.length - 1;
        while (lo <= hi) {
            var mid = (lo + hi) >> 1;
            var r = ICAO_RANGES[mid];
            if (n < r[0]) hi = mid - 1;
            else if (n > r[1]) lo = mid + 1;
            else return { iso2: r[2], name: countryFromIso(r[2]) };
        }
        return null;
    }

    // ── Module-level caches (rebuilt on every getAircraftData call) ───────────
    let _airportLabels   = new Map(); // icao → "Airport Name"
    let _airportIso2     = new Map(); // icao → iso2
    let _countryIso2     = new Map(); // country name → iso2
    let _aircraftIcaoMap = new Map(); // typeKey (typeLong) → icaoType
    let _aircraftAdsbCat = new Map(); // typeKey → ADS-B category ('A5' etc.)
    let _aircraftWtc     = new Map(); // typeKey → wake turbulence category ('H','M','L','J')
    let _aircraftRegCountries = new Map(); // typeKey → Map<name, iso2>
    let _allRegCountries      = new Map(); // name → iso2 (for country dropdown)
    let _militaryTypeKeys     = new Set(); // typeKeys where at least one plane is military
    var _catCounts = {}; // catId → count of aircraft in that category (populated by getAircraftData)

    function getAircraftCategory(typeKey) {
        if (!typeKey) return 0;
        var icao = _aircraftIcaoMap.get(typeKey) || typeKey;
        // 1. ICAO type lookup (most precise)
        var byIcao = AIRCRAFT_CATEGORIES[icao.toUpperCase()];
        if (byIcao) return byIcao;
        // 2. ADS-B emitter category
        var adsb = _aircraftAdsbCat.get(typeKey);
        if (adsb === 'A7') return 5; // rotorcraft
        if (adsb === 'A5') return 1; // heavy
        if (adsb === 'A6') return 6; // high performance (military jets)
        if (adsb === 'A4') return 1; // high vortex large (B757/heavy)
        if (adsb === 'A1' || adsb === 'B1' || adsb === 'B4') return 7; // light/glider/ultralight
        // 3. Wake turbulence category
        var wtc = _aircraftWtc.get(typeKey);
        if (wtc === 'J') return 1; // super-heavy (A380)
        if (wtc === 'H') return 1; // heavy
        if (adsb === 'A3') return 2; // large = medium jet
        if (adsb === 'A2') return wtc === 'L' ? 7 : 3; // small: light or bizjet
        if (wtc === 'L') return 7; // light
        return 0;
    }

    // Returns true if a plane should be treated as military.
    // Mirrors tar1090's 'U' filter which uses plane.military (set by readsb ICAO hex range analysis).
    function isMilitaryAircraft(plane) {
        if (plane.military) return true;
        if (plane.category === 'A6') return true;
        var t = plane.typeLong || plane.icaoType;
        if (t && getAircraftCategory(t) === 6) return true;
        return false;
    }

    // ── Route cache lookup ────────────────────────────────────────────────────
    function getCacheEntry(plane) {
        try {
            const name = plane.name || plane.flight;
            if (!name) return null;
            const normalized = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
            const entry = g.route_cache[normalized];
            return (entry && entry._airports && entry._airports.length >= 2) ? entry : null;
        } catch (e) { return null; }
    }

    // ── Route parsing ─────────────────────────────────────────────────────────
    function parseRoute(plane) {
        if (!plane.routeString) {
            return settings.useLocalDb ? _dbGetRoute(plane) : null;
        }
        const raw = plane.routeString.replace(/^\?\?\s*/, '').trim();
        if (!raw) return null;
        const parts = raw.split(' - ').map(function (s) { return s.trim(); });
        if (parts.length < 2) return null;
        const cache = getCacheEntry(plane);
        const fromIcao = cache ? cache._airports[0].icao                          : (parts[0].length === 4 ? parts[0] : null);
        const toIcao   = cache ? cache._airports[cache._airports.length - 1].icao : (parts[parts.length - 1].length === 4 ? parts[parts.length - 1] : null);
        return {
            full:        raw,
            fromDisplay: parts[0],
            toDisplay:   parts[parts.length - 1],
            fromIcao:    fromIcao,
            toIcao:      toIcao,
        };
    }

    // ── Data aggregation ──────────────────────────────────────────────────────
    function getAircraftData(excludeTab) {
        const airports  = new Map(); // icao → {from, to}
        const countries = new Map(); // country name → {from, to}
        const operators = new Map();
        const aircraft  = new Map();
        _airportLabels   = new Map();
        _airportIso2     = new Map();
        _countryIso2     = new Map();
        _aircraftIcaoMap = new Map();
        _aircraftAdsbCat = new Map();
        _aircraftWtc     = new Map();
        _aircraftRegCountries = new Map();
        _allRegCountries      = new Map();
        _militaryTypeKeys     = new Set();
        _catCounts = {};

        if (!gReady()) return { airports, countries, operators, aircraft };

        function apInc(map, key, dir) {
            if (!map.has(key)) map.set(key, { from: 0, to: 0 });
            map.get(key)[dir]++;
        }

        for (var i = 0; i < g.planesOrdered.length; i++) {
            var plane = g.planesOrdered[i];

            // Cross-tab filter: skip planes that don't pass other tabs' active filters
            if (!planePassesAllFilters(plane, excludeTab)) continue;
            // Runtime scope filter (all / inview / filtered)
            if (_panelScope === 'inview' && !plane.inView) continue;
            if (_panelScope === 'filtered' && !planePassesAllFilters(plane, null)) continue;

            // Aircraft tab: typeKey = typeLong if available, else icaoType
            // Skip surface vehicles (ADS-B category C0-C3 = ground/surface)
            var isSurface = plane.category && plane.category[0] === 'C';
            var typeKey = (!isSurface && (plane.typeLong || plane.icaoType)) || null;
            // Military aircraft with no type get a placeholder so they appear in the list
            if (!typeKey && !isSurface && isMilitaryAircraft(plane)) typeKey = '(Military)';
            if (typeKey) {
                // Populate metadata maps for all planes so lookups work regardless of filter
                if (plane.icaoType && !_aircraftIcaoMap.has(typeKey))
                    _aircraftIcaoMap.set(typeKey, plane.icaoType);
                if (plane.category && !_aircraftAdsbCat.has(typeKey))
                    _aircraftAdsbCat.set(typeKey, plane.category);
                if (plane.wtc && !_aircraftWtc.has(typeKey))
                    _aircraftWtc.set(typeKey, plane.wtc);
                if (isMilitaryAircraft(plane))
                    _militaryTypeKeys.add(typeKey);
                // Count per category for button badges
                var cId = isMilitaryAircraft(plane) ? 6 : getAircraftCategory(typeKey);
                if (cId) _catCounts[cId] = (_catCounts[cId] || 0) + 1;
                // Count only planes that also pass the aircraft tab's catFilter and regCountryFilter,
                // so the count next to each type matches what gets highlighted on the map
                var acCur = state.tabState.aircraft;
                var passesCat = acCur.catFilter.size === 0;
                if (!passesCat) {
                    passesCat = true;
                    acCur.catFilter.forEach(function(catId) {
                        if (catId === 6) { if (!isMilitaryAircraft(plane)) passesCat = false; }
                        else { if (getAircraftCategory(typeKey) !== catId) passesCat = false; }
                    });
                }
                var passesRc = !acCur.regCountryFilter;
                if (!passesRc && plane.icao) {
                    var rcCheck = getRegCountryFromIcao(plane.icao);
                    passesRc = !!(rcCheck && rcCheck.name === acCur.regCountryFilter);
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
                        if (!_aircraftRegCountries.has(typeKey)) _aircraftRegCountries.set(typeKey, new Map());
                        _aircraftRegCountries.get(typeKey).set(rcInfo.name, rcInfo.iso2);
                    }
                }
            }

            var cache = getCacheEntry(plane);

            // Operators: prefer route_cache airline_code, fall back to callsign prefix with local DB
            if (cache && cache.airline_code) {
                var code = cache.airline_code.toUpperCase();
                operators.set(code, (operators.get(code) || 0) + 1);
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

            // Airports: ICAO key, {from,to} counts, display label, iso2
            [
                [depAp, route.fromIcao || route.fromDisplay, 'from'],
                [arrAp, route.toIcao   || route.toDisplay,   'to'],
            ].forEach(function (triple) {
                var ap = triple[0], fallback = triple[1], dir = triple[2];
                var key = (ap && ap.icao) ? ap.icao : fallback;
                if (!key) return;
                apInc(airports, key, dir);
                if (!_airportLabels.has(key)) {
                    var lbl = (ap && ap.name) ? ap.name : (_dbGetAirportName(key) || key);
                    _airportLabels.set(key, lbl);
                }
                if (!_airportIso2.has(key)) {
                    if (ap && ap.countryiso2) _airportIso2.set(key, ap.countryiso2);
                    else { var aIso2 = _dbGetAirportIso2(key); if (aIso2) _airportIso2.set(key, aIso2); }
                }
            });

            // Countries: {from,to} counts, prefer countryiso2 from cache
            [
                [depAp, route.fromIcao, 'from'],
                [arrAp, route.toIcao,   'to'],
            ].forEach(function (triple) {
                var ap = triple[0], fallbackIcao = triple[1], dir = triple[2];
                var cName, iso2;
                if (ap && ap.countryiso2) {
                    iso2  = ap.countryiso2;
                    cName = countryFromIso(iso2);
                } else if (fallbackIcao) {
                    iso2  = _dbGetAirportIso2(fallbackIcao);
                    cName = iso2 ? countryFromIso(iso2) : getCountryFromAirport(fallbackIcao);
                }
                if (!cName) return;
                apInc(countries, cName, dir);
                if (iso2) _countryIso2.set(cName, iso2);
            });
        }

        return { airports, countries, operators, aircraft };
    }

    // ── Per-plane filter check ────────────────────────────────────────────────
    // Returns true if the plane passes a single tab's filter.
    function planePassesFilter(plane, tabName, items, direction) {
        if (tabName === 'operators') {
            var cache = getCacheEntry(plane);
            return !!(cache && cache.airline_code && items.has(cache.airline_code.toUpperCase()));
        }
        if (tabName === 'aircraft') {
            var ac = state.tabState.aircraft;
            var t = plane.typeLong || plane.icaoType;
            if (ac.items.size > 0) {
                var tMatch = t && ac.items.has(t);
                var milMatch = ac.items.has('(Military)') && isMilitaryAircraft(plane);
                if (!tMatch && !milMatch) return false;
            }
            if (ac.catFilter.size > 0) {
                var cfOk = true;
                ac.catFilter.forEach(function(catId) {
                    if (catId === 6) { if (!isMilitaryAircraft(plane)) cfOk = false; }
                    else { if (getAircraftCategory(t) !== catId) cfOk = false; }
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
        if (!route) return false; // no route = can't match airport/country filter
        if (tabName === 'airports') {
            var dep = route.fromIcao || route.fromDisplay;
            var arr = route.toIcao   || route.toDisplay;
            if (direction === 'from') return items.has(dep);
            if (direction === 'to')   return items.has(arr);
            return items.has(dep) || items.has(arr);
        }
        if (tabName === 'countries') {
            var cache2  = getCacheEntry(plane);
            var depAp   = cache2 ? cache2._airports[0]                          : null;
            var arrAp   = cache2 ? cache2._airports[cache2._airports.length - 1] : null;
            var depCN   = depAp && depAp.countryiso2
                ? countryFromIso(depAp.countryiso2)
                : getCountryFromAirport(route.fromIcao || '');
            var arrCN   = arrAp && arrAp.countryiso2
                ? countryFromIso(arrAp.countryiso2)
                : getCountryFromAirport(route.toIcao || '');
            if (direction === 'from') return items.has(depCN);
            if (direction === 'to')   return items.has(arrCN);
            return items.has(depCN) || items.has(arrCN);
        }
        return false;
    }

    // ── Distance / haversine helpers ──────────────────────────────────────────
    function haversineNm(lat1, lon1, lat2, lon2) {
        var R    = 3440.065; // Earth radius in nautical miles
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a    = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                   Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                   Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function _rfBearing(lat1, lon1, lat2, lon2) {
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var la1  = lat1 * Math.PI / 180;
        var la2  = lat2 * Math.PI / 180;
        var y    = Math.sin(dLon) * Math.cos(la2);
        var x    = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }

    function _rfCardinal(deg) {
        var dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
        return dirs[Math.round(deg / 22.5) % 16];
    }

    // Infer country name from aircraft registration prefix (ICAO standard prefixes).
    // Falls back to a coarse ICAO hex block check when no registration is available.
    function _rfRegCountry(reg, icao) {
        if (reg) {
            var r = reg.toUpperCase();
            var pfx = [
                ['G-','UK'],         ['D-','Germany'],    ['F-','France'],
                ['I-','Italy'],      ['EC-','Spain'],     ['SE-','Sweden'],
                ['PH-','Netherlands'],['OO-','Belgium'],  ['LN-','Norway'],
                ['OY-','Denmark'],   ['EI-','Ireland'],   ['TF-','Iceland'],
                ['SP-','Poland'],    ['OE-','Austria'],   ['HB-','Switzerland'],
                ['OK-','Czechia'],   ['OM-','Slovakia'],  ['LX-','Luxembourg'],
                ['SX-','Greece'],    ['HA-','Hungary'],   ['YR-','Romania'],
                ['LZ-','Bulgaria'],  ['9A-','Croatia'],   ['S5-','Slovenia'],
                ['9H-','Malta'],     ['LY-','Lithuania'], ['YL-','Latvia'],
                ['ES-','Estonia'],   ['OH-','Finland'],   ['YU-','Serbia'],
                ['RA-','Russia'],    ['EW-','Belarus'],   ['UP-','Kazakhstan'],
                ['UR-','Ukraine'],   ['4X-','Israel'],    ['TC-','Turkey'],
                ['A6-','UAE'],       ['HZ-','Saudi Arabia'],['9V-','Singapore'],
                ['VH-','Australia'], ['ZK-','New Zealand'],['ZS-','S. Africa'],
                ['JA','Japan'],      ['HL','S. Korea'],   ['B-','China'],
                ['VT-','India'],     ['SU-','Egypt'],     ['ET-','Ethiopia'],
                ['CN-','Morocco'],   ['5Y-','Kenya'],     ['AP-','Pakistan'],
                ['VN-','Vietnam'],   ['HS-','Thailand'],
                ['N','USA'],         ['C-','Canada'],     ['XA-','Mexico'],
                ['CC-','Chile'],     ['PT-','Brazil'],    ['LV-','Argentina'],
                ['PP-','Brazil'],
            ];
            for (var pi = 0; pi < pfx.length; pi++) {
                if (r.indexOf(pfx[pi][0]) === 0) return pfx[pi][1];
            }
        }
        // ICAO hex block fallback for unregistered / no-reg aircraft
        if (icao) {
            var n = parseInt(icao, 16);
            if (n >= 0x3C0000 && n <= 0x3FFFFF) return 'Germany';
            if (n >= 0x400000 && n <= 0x43FFFF) return 'UK';
            if (n >= 0x380000 && n <= 0x3BFFFF) return 'France';
            if (n >= 0x340000 && n <= 0x37FFFF) return 'Spain';
            if (n >= 0x300000 && n <= 0x33FFFF) return 'Italy';
            if (n >= 0x4A0000 && n <= 0x4A7FFF) return 'Netherlands';
            if (n >= 0x448000 && n <= 0x44FFFF) return 'Belgium';
            if (n >= 0x4A8000 && n <= 0x4AFFFF) return 'Norway';
            if (n >= 0x458000 && n <= 0x45FFFF) return 'Denmark';
            if (n >= 0x480000 && n <= 0x487FFF) return 'Ireland';
            if (n >= 0x4B0000 && n <= 0x4B7FFF) return 'Poland';
            if (n >= 0x460000 && n <= 0x467FFF) return 'Finland';
            if (n >= 0x440000 && n <= 0x447FFF) return 'Austria';
            if (n >= 0x4C8000 && n <= 0x4CFFFF) return 'Switzerland';
            if (n >= 0x488000 && n <= 0x48FFFF) return 'Iceland';
            if (n >= 0x468000 && n <= 0x46FFFF) return 'Greece';
            if (n >= 0x4B8000 && n <= 0x4BFFFF) return 'Portugal';
            if (n >= 0x4C0000 && n <= 0x4C7FFF) return 'Romania';
            if (n >= 0x450000 && n <= 0x457FFF) return 'Bulgaria';
            if (n >= 0x470000 && n <= 0x477FFF) return 'Hungary';
            if (n >= 0x478000 && n <= 0x47FFFF) return 'Croatia';
            if (n >= 0x100000 && n <= 0x1FFFFF) return 'Russia';
            if (n >= 0xA00000 && n <= 0xAFFFFF) return 'USA';
            if (n >= 0xC00000 && n <= 0xC3FFFF) return 'Canada';
            if (n >= 0x7C0000 && n <= 0x7FFFFF) return 'Australia';
            if (n >= 0x800000 && n <= 0x83FFFF) return 'India';
            if (n >= 0x680000 && n <= 0x6BFFFF) return 'Turkey';
            if (n >= 0x898000 && n <= 0x8BFFFF) return 'Japan';
        }
        return null;
    }

    function planePassesDistanceFilter(plane) {
        if (_distanceZones.length === 0) return true;
        if (_distanceMode === 'maponly') return true;
        // tar1090 stores position as plane.position = [lon, lat] (OL convention).
        // plane.lat / plane.lon do NOT exist on PlaneObject — always use .position.
        var plat, plon;
        if (plane.position && plane.position.length >= 2) {
            plon = +plane.position[0];
            plat = +plane.position[1];
        } else {
            plat = +plane.lat;
            plon = +plane.lon;
        }
        if (isNaN(plat) || isNaN(plon)) return true; // no position — show plane
        // Test if plane is within ANY active zone (OR logic)
        var insideAny = false;
        for (var zi = 0; zi < _distanceZones.length; zi++) {
            var zone = _distanceZones[zi];
            var dist = haversineNm(zone.lat, zone.lon, plat, plon);
            if (dist > zone.radiusNm) continue;
            if (zone.altMode === 'between') {
                var alt = typeof plane.altitude === 'number' ? plane.altitude
                        : (plane.altitude === 'ground' ? 0
                        : typeof plane.alt_baro === 'number' ? plane.alt_baro : null);
                if (alt !== null && (alt < zone.altMin || alt > zone.altMax)) continue;
            }
            insideAny = true;
            break;
        }
        return _distanceMode === 'outside' ? !insideAny : insideAny;
    }

    // ── Cross-tab filter helper ───────────────────────────────────────────────
    // Returns true if plane passes all tab filters, optionally excluding one tab.
    function planePassesAllFilters(plane, excludeTab) {
        var tabs = Object.keys(state.tabState);
        for (var i = 0; i < tabs.length; i++) {
            var tabName = tabs[i];
            if (tabName === excludeTab) continue;
            var s = state.tabState[tabName];
            var hasFilter = s.items.size > 0;
            if (tabName === 'aircraft') hasFilter = hasFilter || s.catFilter.size > 0 || s.regCountryFilter !== '';
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
        // Summary quick-filter
        if (_sumFilter.size > 0) {
            var si = plane.icao ? plane.icao.toUpperCase() : '';
            if (!_sumFilter.has(si)) return false;
        }
        return true;
    }

    // ── Filter function (shared logic used by both hook methods) ─────────────
    function rfIsFiltered(plane) {
        if (!isFilterActive()) return false;
        return !planePassesAllFilters(plane, null);
    }

    // ── Filter hook: use tar1090's customFilter API + patch isFiltered ────────
    function installFilterHook() {
        // Method 1: window.customFilter — the supported tar1090 filter API.
        // tar1090 calls this for each plane every render cycle.
        var origCustom = window.customFilter;
        window.customFilter = function (plane) {
            if (typeof origCustom === 'function' && origCustom(plane)) return true;
            return rfIsFiltered(plane);
        };

        // Method 2: patch PlaneObject.prototype.isFiltered as a fallback for
        // tar1090 versions that check this directly.
        try {
            if (typeof PlaneObject === 'undefined') return true;
            var _orig = PlaneObject.prototype.isFiltered;
            PlaneObject.prototype.isFiltered = function () {
                if (_orig && _orig.call(this)) return true;
                return rfIsFiltered(this);
            };
        } catch (e) {
            console.warn('[routes-filter] could not patch isFiltered:', e);
        }
        return true;
    }

    // ── Redraw trigger ────────────────────────────────────────────────────────
    function triggerRedraw() {
        // refreshFilter() is tar1090's own filter refresh function.
        // It calls refresh(true) → updateVisible() → plane.updateVisible() on each plane,
        // which recalculates plane.visible = checkVisible() && !isFiltered().
        // Our patched isFiltered is called there, then mapRefresh hides/shows markers.
        try {
            if (typeof refreshFilter === 'function') {
                refreshFilter();
            } else if (typeof window.refreshFilter === 'function') {
                window.refreshFilter();
            } else if (gReady()) {
                // Fallback: manually call updateVisible + updateFeatures on each plane
                if (typeof updateVisible === 'function') updateVisible();
                for (var i = 0; i < g.planesOrdered.length; i++) {
                    var p = g.planesOrdered[i];
                    if (typeof p.updateFeatures === 'function') p.updateFeatures(true);
                }
            }
        } catch (e) { console.warn('[RF] triggerRedraw error:', e); }
    }

    function _rfScopeLabel() {
        return _panelScope === 'inview' ? 'in view' : (_panelScope === 'filtered' ? 'filtered' : 'all');
    }
    function _rfScopeBadgeLabel() {
        return _panelScope === 'inview' ? 'In View' : (_panelScope === 'filtered' ? 'Filtered' : 'All');
    }

    function _rfEscText(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    }
    function _rfEscAttr(s) {
        return _rfEscText(s).replace(/"/g, '&quot;');
    }

    function _rfDefaultViewMap() {
        return {
            enabled: false,
            mode: 'dynamic', // dynamic | fixed
            autoCenter: true,
            autoZoom: true,
            fixedCenterLat: null,
            fixedCenterLon: null,
            fixedZoom: null,
        };
    }

    function _rfNormalizeViewMap(mapCfg) {
        var d = _rfDefaultViewMap();
        var m = (mapCfg && typeof mapCfg === 'object') ? mapCfg : {};
        return {
            enabled: !!m.enabled,
            mode: (m.mode === 'fixed') ? 'fixed' : 'dynamic',
            autoCenter: (typeof m.autoCenter === 'boolean') ? m.autoCenter : true,
            autoZoom: (typeof m.autoZoom === 'boolean') ? m.autoZoom : true,
            fixedCenterLat: (typeof m.fixedCenterLat === 'number' && !isNaN(m.fixedCenterLat)) ? m.fixedCenterLat : d.fixedCenterLat,
            fixedCenterLon: (typeof m.fixedCenterLon === 'number' && !isNaN(m.fixedCenterLon)) ? m.fixedCenterLon : d.fixedCenterLon,
            fixedZoom: (typeof m.fixedZoom === 'number' && !isNaN(m.fixedZoom)) ? m.fixedZoom : d.fixedZoom,
        };
    }

    function _rfEnsureViewShape(v) {
        if (!v || typeof v !== 'object') return;
        v.map = _rfNormalizeViewMap(v.map);
    }

    function _rfGetCurrentMapSnapshot() {
        var m = _rfOLMap();
        if (!m || !m.getView) return null;
        var v = m.getView();
        var c = v.getCenter();
        var ll = _rfLonLatFromMapCoord(c);
        if (!ll) return null;
        return {
            lat: ll.lat,
            lon: ll.lon,
            zoom: v.getZoom(),
        };
    }

    function _rfTabStateToPlain() {
        var out = {};
        Object.keys(state.tabState).forEach(function(tab) {
            var src = state.tabState[tab];
            out[tab] = {
                items: Array.from(src.items || []),
                direction: src.direction || 'both',
                sortBy: src.sortBy || 'count',
                sortDir: src.sortDir || 'desc',
            };
            if (tab === 'aircraft') {
                out[tab].catFilter = Array.from(src.catFilter || []);
                out[tab].regCountryFilter = src.regCountryFilter || '';
            }
        });
        return out;
    }

    function _rfApplyTabStatePlain(plain) {
        if (!plain || typeof plain !== 'object') return;
        Object.keys(state.tabState).forEach(function(tab) {
            var src = plain[tab];
            if (!src) return;
            var dst = state.tabState[tab];
            dst.items = new Set(Array.isArray(src.items) ? src.items : []);
            if (tab === 'airports' || tab === 'countries') {
                dst.direction = (src.direction === 'from' || src.direction === 'to' || src.direction === 'both') ? src.direction : 'both';
            }
            dst.sortBy = (src.sortBy === 'name' || src.sortBy === 'count') ? src.sortBy : dst.sortBy;
            dst.sortDir = (src.sortDir === 'asc' || src.sortDir === 'desc') ? src.sortDir : dst.sortDir;
            if (tab === 'aircraft') {
                dst.catFilter = new Set(Array.isArray(src.catFilter) ? src.catFilter : []);
                dst.regCountryFilter = String(src.regCountryFilter || '');
            }
        });
    }

    function _rfCaptureViewState() {
        return {
            panelScope: _panelScope,
            tabState: _rfTabStateToPlain(),
            alerts: {
                filters: {
                    cmpg: _alertsFilters.cmpg || '',
                    category: _alertsFilters.category || '',
                    tag: _alertsFilters.tag || '',
                },
                mapFilter: !!_alertsMapFilter,
                selectedIcaos: Array.from(_alertsSelectedIcaos || []),
            },
            distance: {
                zones: JSON.parse(JSON.stringify(_distanceZones || [])),
                mode: _distanceMode,
            },
            summary: {
                sumFilter: Array.from(_sumFilter || []),
            },
            map: _rfDefaultViewMap(),
        };
    }

    function _rfApplyViewState(vs) {
        if (!vs || typeof vs !== 'object') return false;
        if (vs.panelScope === 'all' || vs.panelScope === 'inview' || vs.panelScope === 'filtered') {
            _panelScope = (settings.hideAllScope && vs.panelScope === 'all') ? 'inview' : vs.panelScope;
        }
        _rfApplyTabStatePlain(vs.tabState || {});

        var af = (vs.alerts && vs.alerts.filters) || {};
        _alertsFilters.cmpg = String(af.cmpg || '');
        _alertsFilters.category = String(af.category || '');
        _alertsFilters.tag = String(af.tag || '');
        _alertsMapFilter = !!(vs.alerts && vs.alerts.mapFilter);
        _alertsSelectedIcaos = new Set((vs.alerts && Array.isArray(vs.alerts.selectedIcaos)) ? vs.alerts.selectedIcaos : []);
        buildAlertsMapFilterSet();

        if (vs.distance && Array.isArray(vs.distance.zones)) {
            _distanceZones = vs.distance.zones.filter(function(z) {
                return z && typeof z.lat === 'number' && typeof z.lon === 'number' && z.radiusNm > 0;
            });
        } else {
            _distanceZones = [];
        }
        if (vs.distance && (vs.distance.mode === 'inside' || vs.distance.mode === 'outside' || vs.distance.mode === 'maponly')) {
            _distanceMode = vs.distance.mode;
        }
        _rfPersistDistFilter();

        _sumFilter.clear();
        var sf = vs.summary && Array.isArray(vs.summary.sumFilter) ? vs.summary.sumFilter : [];
        sf.forEach(function(ic) { _sumFilter.add(String(ic || '').toUpperCase()); });
        return true;
    }

    function _rfPersistViews() {
        try { localStorage.setItem(VIEWS_KEY, JSON.stringify(_savedViews)); } catch (e) {}
        _rfSavePersistBackup();
    }

    function _rfViewsOptionsHtml() {
        var h = '<option value="">Views</option>';
        for (var i = 0; i < _savedViews.length; i++) {
            var v = _savedViews[i];
            _rfEnsureViewShape(v);
            h += '<option value="' + _rfEscAttr(v.id) + '"' + (_activeViewId === v.id ? ' selected' : '') + '>' + _rfEscText(v.name || ('View ' + (i + 1))) + '</option>';
        }
        return h;
    }

    function _rfFindViewById(id) {
        for (var i = 0; i < _savedViews.length; i++) {
            if (_savedViews[i] && _savedViews[i].id === id) return _savedViews[i];
        }
        return null;
    }

    function _rfGetActiveView() {
        if (!_activeViewId) return null;
        return _rfFindViewById(_activeViewId);
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
            v.animate({ center: fc, zoom: cfg.fixedZoom, duration: forceNow ? 650 : 500 });
            return;
        }
        if (!cfg.autoCenter && !cfg.autoZoom) return;
        _rfAutoFitFilteredPlanes({
            autoCenter: cfg.autoCenter,
            autoZoom: cfg.autoZoom,
            forceNow: !!forceNow,
        });
    }

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
        v.animate({ center: c, zoom: targetZoom, duration: 700 });
    }

    function _rfScopeToggleHtml() {
        var btns = [];
        btns.push('<button class="rf-sum-scope-btn rf-scope-home-btn" onclick="window._rfCenterHome(true)" title="Center map on home position">\u2302</button>');
        if (!settings.hideAllScope) {
            btns.push('<button class="rf-sum-scope-btn' + (_panelScope === 'all' ? ' rf-sum-scope-active' : '') + '" ' +
                'onclick="window._rfSetPanelScope(\'all\')" title="Include all currently loaded aircraft">All aircraft</button>');
        }
        btns.push('<button class="rf-sum-scope-btn' + (_panelScope === 'inview' ? ' rf-sum-scope-active' : '') + '" ' +
            'onclick="window._rfSetPanelScope(\'inview\')" title="Only aircraft visible in the current map viewport">In map view</button>');
        btns.push('<button class="rf-sum-scope-btn' + (_panelScope === 'filtered' ? ' rf-sum-scope-active' : '') + '" ' +
            'onclick="window._rfSetPanelScope(\'filtered\')" title="Only aircraft matching active filters">Filtered view</button>');
        return '<div class="rf-sum-scope-wrap">' +
            '<div class="rf-sum-scope-btns">' + btns.join('') + '</div>' +
        '</div>';
    }

    function _rfRenderScopeHeader() {
        var el = document.getElementById('rf-scope-global');
        if (el) el.innerHTML = _rfScopeToggleHtml();
        _rfRenderViewQuickMenu();
    }

    function _rfRenderViewQuickMenu() {
        var el = document.getElementById('rf-view-quick-menu');
        if (!el) return;
        var av = _rfGetActiveView();
        var badge = '<div class="rf-active-view-badge-empty">No active view</div>';
        if (av) {
            _rfEnsureViewShape(av);
            var modeLbl = !av.map.enabled ? 'Map Off' : (av.map.mode === 'fixed' ? 'Map Fixed' : 'Map Dynamic');
            badge = '<div class="rf-active-view-badge" title="Active view: ' + _rfEscAttr(av.name || '') + '">' +
                '<span class="rf-active-view-name">' + _rfEscText(av.name || 'View') + '</span>' +
                '<span class="rf-active-view-mode">' + modeLbl + '</span></div>';
        }
        if (!_rfQuickSelectedViewId) _rfQuickSelectedViewId = _activeViewId || '';
        var opt = '<option value="">Select view...</option>';
        for (var i = 0; i < _savedViews.length; i++) {
            var v = _savedViews[i];
            _rfEnsureViewShape(v);
            opt += '<option value="' + _rfEscAttr(v.id) + '"' + (_rfQuickSelectedViewId === v.id ? ' selected' : '') + '>' + _rfEscText(v.name || ('View ' + (i + 1))) + '</option>';
        }
        el.innerHTML =
            '<div class="rf-view-quick-head">Views</div>' +
            badge +
            '<select class="rf-views-select rf-views-select-compact" onchange="window._rfViewsQuickPick(this.value)">' + opt + '</select>' +
            '<div class="rf-view-quick-actions">' +
            '<button class="rf-cat-btn" onclick="window._rfViewsApplyQuick()">Apply</button>' +
            '<button class="rf-cat-btn" onclick="window._rfViewsSavePrompt()">Save Current</button>' +
            '<button class="rf-cat-btn" onclick="window._rfSwitchTab(\'views\');window._rfToggleViewQuickMenu(false)">Manage</button>' +
            '</div>';
    }

    function applyFilter() {
        triggerRedraw();
        // Keep the main-map ring in sync with the active filter state
        if (_distanceZones.length > 0) {
            _rfDrawDistOnMainMap();
        } else {
            _rfClearDistOnMainMap();
        }
        // Map behavior: active view controls auto-center/zoom, else fallback to legacy behavior.
        var av = _rfGetActiveView();
        if (av && av.map) _rfApplyMapBehaviorConfig(av.map, true);
        else _rfAutoFitFilteredPlanes();
        _rfRenderScopeHeader();
    }

    // ── Breadcrumb generation ─────────────────────────────────────────────────
    var TAB_LABELS = {
        airports:'Airports', countries:'Countries',
        operators:'Operators', aircraft:'Aircraft',
    };

    function buildBreadcrumb() {
        var el = document.getElementById('rf-breadcrumb');
        if (!el) return;

        var chips = [];
        var tabs  = Object.keys(state.tabState);
        for (var i = 0; i < tabs.length; i++) {
            var tabName = tabs[i];
            var s = state.tabState[tabName];
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

            var activeClass = tabName === state.activeTab ? ' rf-chip-active' : '';
            chips.push(
                '<div class="rf-chip' + activeClass + '" onclick="window._rfSwitchTab(\'' + tabName + '\')" title="Click to open this filter tab">' +
                '<span class="rf-chip-label">' + TAB_LABELS[tabName] + '</span>' +
                '<span class="rf-chip-items">' + summary.replace(/&/g, '&amp;').replace(/</g, '&lt;') + dirLabel + '</span>' +
                '<button class="rf-chip-x" onclick="event.stopPropagation();window._rfClearTab(\'' + tabName + '\')">&#x2715;</button>' +
                '</div>'
            );
        }

        // Alerts chip: row selection takes priority; facets are shown even without map filter.
        var alActive = state.activeTab === 'alerts' ? ' rf-chip-active' : '';
        var alFacetActive = !!(_alertsFilters.cmpg || _alertsFilters.category || _alertsFilters.tag);
        if (_alertsSelectedIcaos.size > 0) {
            var alSummary = _alertsSelectedIcaos.size === 1
                ? Array.from(_alertsSelectedIcaos)[0]
                : _alertsSelectedIcaos.size + ' aircraft';
            chips.push(
                '<div class="rf-chip' + alActive + '" onclick="window._rfSwitchTab(\'alerts\')" title="Click to open Alerts tab">' +
                '<span class="rf-chip-label">Alerts</span>' +
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
                '<div class="rf-chip' + alActive + '" onclick="window._rfSwitchTab(\'alerts\')" title="Click to open Alerts tab">' +
                '<span class="rf-chip-label">Alerts</span>' +
                '<span class="rf-chip-items">' + alSummary2.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>' +
                '<button class="rf-chip-x" onclick="event.stopPropagation();window._rfClearAlertsFacets()">&#x2715;</button>' +
                '</div>'
            );
        }

        // Distance filter chip
        if (_distanceZones.length > 0) {
            var distActive  = state.activeTab === 'distance' ? ' rf-chip-active' : '';
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

        // Summary quick-filter chip
        if (_sumFilter.size > 0) {
            var sfActive = state.activeTab === 'summary' ? ' rf-chip-active' : '';
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

    // ── Alerts CSV fetch / parse / cache ─────────────────────────────────────
    var ALERTS_CSV_URL = 'https://raw.githubusercontent.com/sdr-enthusiasts/plane-alert-db/main/plane-alert-db.csv';
    var ALERTS_LS_KEY  = 'rf_alerts_v1';
    var ALERTS_MAX_AGE = 24 * 60 * 60 * 1000; // 24h

    function parseAlertsCsv(text) {
        var lines = text.split('\n');
        if (lines.length < 2) return [];
        function parseLine(line) {
            var result = [], cur = '', inQ = false;
            for (var i = 0; i < line.length; i++) {
                var c = line[i];
                if (c === '"') { inQ = !inQ; }
                else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
                else { cur += c; }
            }
            result.push(cur.trim());
            return result;
        }
        var result = [];
        for (var i = 1; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var p = parseLine(line);
            if (!p[0]) continue;
            result.push({
                icao:     p[0].toUpperCase(),
                reg:      p[1] || '',
                operator: p[2] || '',
                type:     p[3] || '',
                icaoType: p[4] || '',
                cmpg:     p[5] || '',
                tag1:     p[6] || '',
                tag2:     p[7] || '',
                tag3:     p[8] || '',
                category: p[9] || '',
                link:     p[10] || '',
            });
        }
        return result;
    }

    function loadAlerts(forceRefresh) {
        if (_alertsFetching) return;
        if (!forceRefresh) {
            try {
                var cached = localStorage.getItem(ALERTS_LS_KEY);
                if (cached) {
                    var obj = JSON.parse(cached);
                    if (obj && obj.data && (Date.now() - obj.ts) < ALERTS_MAX_AGE) {
                        _alertsDb        = obj.data;
                        _alertsTimestamp = obj.ts;
                        buildAlertsMapFilterSet();
                        if (_alertsMapFilter) applyFilter();
                        if (state.panelOpen && state.activeTab === 'alerts') buildPanel();
                        return;
                    }
                }
            } catch(e) {}
        }
        _alertsFetching = true;
        _alertsError    = null;
        if (state.panelOpen && state.activeTab === 'alerts') buildPanel();
        fetch(ALERTS_CSV_URL)
            .then(function(r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.text();
            })
            .then(function(text) {
                _alertsDb        = parseAlertsCsv(text);
                _alertsTimestamp = Date.now();
                _alertsFetching  = false;
                buildAlertsMapFilterSet();
                try {
                    localStorage.setItem(ALERTS_LS_KEY, JSON.stringify({ data: _alertsDb, ts: _alertsTimestamp }));
                } catch(e) {}
                if (_alertsMapFilter) applyFilter();
                if (state.panelOpen && state.activeTab === 'alerts') buildPanel();
            })
            .catch(function(e) {
                _alertsError    = e.message || 'Fetch failed';
                _alertsFetching = false;
                if (state.panelOpen && state.activeTab === 'alerts') buildPanel();
            });
    }

    // ── Build the pre-filtered ICAO set used by isFiltered ───────────────────
    function buildAlertsMapFilterSet() {
        if (!_alertsMapFilter || !_alertsDb) { _alertsMapFilterIcaos = null; return; }
        var set = new Set();
        _alertsDb.forEach(function(a) {
            var icao = a.icao.toUpperCase();
            if (_alertsFilters.cmpg     && a.cmpg     !== _alertsFilters.cmpg)                                                             return;
            if (_alertsFilters.category && a.category !== _alertsFilters.category)                                                          return;
            if (_alertsFilters.tag      && a.tag1 !== _alertsFilters.tag && a.tag2 !== _alertsFilters.tag && a.tag3 !== _alertsFilters.tag) return;
            set.add(icao);
        });
        _alertsMapFilterIcaos = set;
    }

    // ── Alerts tab rendering ──────────────────────────────────────────────────
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
            if (listEl) listEl.innerHTML = '<div class="rf-empty">Alerts tab is disabled.<br>Enable it in \u2699 Settings.</div>';
            if (statusEl) statusEl.textContent = '';
            return;
        }
        if (_alertsFetching) {
            if (ctrlEl) ctrlEl.innerHTML = '';
            if (hdrEl)  hdrEl.innerHTML = '';
            if (listEl) listEl.innerHTML = '<div class="rf-empty">Loading plane-alert-db\u2026</div>';
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

        function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
        function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }
        if (hdrEl) hdrEl.innerHTML = '';

        // Live ICAOs currently present on map
        var liveIcaos = new Set();
        if (gReady()) {
            for (var li = 0; li < g.planesOrdered.length; li++) {
                if (g.planesOrdered[li].icao) liveIcaos.add(g.planesOrdered[li].icao.toUpperCase());
            }
        }

        // Facet values
        var cmpgSet = new Set(), catSet = new Set(), tagSet = new Set();
        _alertsDb.forEach(function(a) {
            if (a.cmpg) cmpgSet.add(a.cmpg);
            if (a.category) catSet.add(a.category);
            [a.tag1, a.tag2, a.tag3].forEach(function(t) { if (t) tagSet.add(t); });
        });
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
                    '<button class="rf-cat-btn' + (_alertsMapFilter ? ' rf-cat-active rf-alerts-mapfilter-btn' : ' rf-alerts-mapfilter-btn') + '" id="rf-al-map-btn">' + (_alertsMapFilter ? 'Filter On' : 'Filter') + '</button>' +
                    '<button class="rf-cat-btn" id="rf-al-clear-facets">Clear facets</button>' +
                    (_alertsSelectedIcaos.size > 0 ? '<button class="rf-cat-btn" id="rf-al-clear-selected">Clear selection</button>' : '') +
                '</div>';
        }

        // Build live plane map for scope-aware filtering (all / inview / filtered)
        var livePlaneMap = {};
        if (gReady()) {
            for (var lpi = 0; lpi < g.planesOrdered.length; lpi++) {
                var lp = g.planesOrdered[lpi];
                if (lp.icao) livePlaneMap[lp.icao.toUpperCase()] = lp;
            }
        }

        // Main filtered set
        var search = (state.searchText || '').toLowerCase();
        function matchesFacet(a) {
            if (_alertsFilters.cmpg && a.cmpg !== _alertsFilters.cmpg) return false;
            if (_alertsFilters.category && a.category !== _alertsFilters.category) return false;
            if (_alertsFilters.tag && a.tag1 !== _alertsFilters.tag && a.tag2 !== _alertsFilters.tag && a.tag3 !== _alertsFilters.tag) return false;
            var p = livePlaneMap[(a.icao || '').toUpperCase()];
            if (!p) return false; // alerts tab follows current aircraft scope
            if (_panelScope === 'inview' && !p.inView) return false;
            if (_panelScope === 'filtered' && !planePassesAllFilters(p, 'alerts')) return false;
            if (search) {
                var hay = (a.icao + ' ' + a.reg + ' ' + a.operator + ' ' + a.type + ' ' + a.cmpg + ' ' + a.category + ' ' + a.tag1 + ' ' + a.tag2 + ' ' + a.tag3).toLowerCase();
                if (!hay.includes(search)) return false;
            }
            return true;
        }
        function alertScore(a) {
            var score = 0;
            if (liveIcaos.has(a.icao)) score += 70;
            if (_alertsSelectedIcaos.has(a.icao)) score += 40;
            if (a.category) score += 8;
            if (a.cmpg) score += 6;
            if (a.link) score += 4;
            if (a.tag1 || a.tag2 || a.tag3) score += 6;
            return score;
        }
        var filtered = _alertsDb.filter(matchesFacet).sort(function(a, b) { return alertScore(b) - alertScore(a); });
        var displayed = filtered.slice(0, 300);
        var overflow = filtered.length > 300;

        var hotNow = displayed.filter(function(a) { return liveIcaos.has(a.icao); }).slice(0, 5);
        var html = '';
        if (hotNow.length > 0) {
            html += '<div class="rf-al-hot-wrap"><div class="rf-al-hot-title">Hot Now</div><div class="rf-al-hot-list">';
            hotNow.forEach(function(a) {
                html += '<button class="rf-al-hot-chip" data-rf-action="toggle" data-rf-icao="' + escAttr(a.icao) + '">' +
                    '<span class="rf-al-hot-icao">' + esc(a.icao) + '</span>' +
                    (a.reg ? '<span class="rf-al-hot-reg">' + esc(a.reg) + '</span>' : '') +
                    '</button>';
            });
            html += '</div></div>';
        }

        if (displayed.length === 0) {
            html += '<div class="rf-empty">No matches' + (search ? ' for "' + esc(search) + '"' : '') + '</div>';
        } else {
            displayed.forEach(function(a) {
                var live = liveIcaos.has(a.icao);
                var sel = _alertsSelectedIcaos.has(a.icao);
                var tags = [a.tag1, a.tag2, a.tag3].filter(Boolean);
                var classes = 'rf-item rf-al-item rf-al-card' + (sel ? ' rf-item-active' : '') + (live ? ' rf-al-live' : '');
                html += '<div class="' + classes + '" data-rf-action="toggle" data-rf-icao="' + escAttr(a.icao) + '">' +
                    '<div class="rf-al-card-head">' +
                        '<span class="rf-al-live-cell">' + (live ? '<span class="rf-al-live-dot"></span>' : '') + '</span>' +
                        '<span class="rf-al-name-top"><span class="rf-al-icao">' + esc(a.icao) + '</span>' + (a.reg ? ' <span class="rf-al-reg">' + esc(a.reg) + '</span>' : '') + '</span>' +
                        '<span class="rf-al-type-col">' + esc(a.type || a.icaoType || '') + '</span>' +
                        '<button class="rf-al-info-btn" data-rf-action="info" data-rf-icao="' + escAttr(a.icao) + '">\u2139</button>' +
                    '</div>' +
                    '<div class="rf-al-card-sub">' + (a.operator ? '<span class="rf-al-op-small">' + esc(a.operator) + '</span>' : '<span class="rf-al-op-small rf-muted">Unknown operator</span>') + '</div>' +
                    '<div class="rf-al-card-tags">' +
                        (a.cmpg ? '<button class="rf-al-pill rf-al-pill-cmpg" data-rf-action="facet" data-rf-field="cmpg" data-rf-value="' + escAttr(a.cmpg) + '">' + esc(a.cmpg) + '</button>' : '') +
                        (a.category ? '<button class="rf-al-pill rf-al-pill-cat" data-rf-action="facet" data-rf-field="category" data-rf-value="' + escAttr(a.category) + '">' + esc(a.category) + '</button>' : '') +
                        tags.map(function(t) { return '<button class="rf-al-pill rf-al-pill-tag" data-rf-action="facet" data-rf-field="tag" data-rf-value="' + escAttr(t) + '">' + esc(t) + '</button>'; }).join('') +
                        (a.link ? '<a class="rf-al-pill rf-al-pill-link" href="' + escAttr(a.link) + '" target="_blank" rel="noopener">Intel</a>' : '') +
                    '</div>' +
                '</div>';
            });
            if (overflow) html += '<div class="rf-empty" style="font-size:10px;padding:8px">Showing 300 of ' + filtered.length + ' — refine search</div>';
        }
        listEl.innerHTML = html;

        // Controls events
        if (ctrlEl) {
            var cmpgEl = document.getElementById('rf-al-cmpg');
            var catEl = document.getElementById('rf-al-cat');
            var tagEl = document.getElementById('rf-al-tag');
            var mapBtn = document.getElementById('rf-al-map-btn');
            var clearFacetsBtn = document.getElementById('rf-al-clear-facets');
            var clearSelBtn = document.getElementById('rf-al-clear-selected');
            if (cmpgEl) cmpgEl.onchange = window._rfAlertsFilter;
            if (catEl) catEl.onchange = window._rfAlertsFilter;
            if (tagEl) tagEl.onchange = window._rfAlertsFilter;
            if (mapBtn) mapBtn.onclick = function() { window._rfToggleAlertsMap(!_alertsMapFilter); };
            if (clearFacetsBtn) clearFacetsBtn.onclick = function() {
                _alertsFilters.cmpg = ''; _alertsFilters.category = ''; _alertsFilters.tag = '';
                buildPanel();
            };
            if (clearSelBtn) clearSelBtn.onclick = window._rfClearAlerts;
        }

        // Delegated list click handling
        listEl.onclick = function(ev) {
            var t = ev.target;
            if (!t) return;
            if (t.closest('a.rf-al-pill-link')) return; // allow normal link navigation
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
            var liveCount = filtered.filter(function(a) { return liveIcaos.has(a.icao); }).length;
            var selCount = _alertsSelectedIcaos.size;
            statusEl.textContent = filtered.length + ' entries' +
                (liveCount > 0 ? ' • ' + liveCount + ' live' : '') +
                (selCount > 0 ? ' • ' + selCount + ' selected' : '');
        }
    }

    // ── Summary tab rendering ─────────────────────────────────────────────────
    function buildSummaryPanel() {
        buildBreadcrumb();
        var searchEl = document.getElementById('rf-search');
        if (searchEl) searchEl.style.display = 'none';
        var hdrEl = document.getElementById('rf-colheader');
        if (hdrEl) hdrEl.innerHTML = '';

        // ── Scope toggle in the controls bar ──────────────────────────────────
        var ctrlEl = document.getElementById('rf-controls');
        if (ctrlEl) ctrlEl.innerHTML = '';

        var listEl = document.getElementById('rf-list');
        if (!listEl) return;

        // Reset per-render click-data lookup (avoids stale indices across refreshes)
        _sumClickData = [];

        if (!gReady()) {
            listEl.innerHTML = '<div class="rf-empty">Waiting for aircraft data\u2026</div>';
            return;
        }

        // Ensure plane-alert-db is loaded even if the user never opens the Alerts tab.
        // (Summary "Attention" can show alert-matched aircraft.)
        try {
            if (_summarySettings.attention && !_alertsDb && !_alertsFetching) loadAlerts(false);
        } catch(e) {}

        // All planes are used for arrivals tracking (so moving in/out of view doesn't
        // reset first-seen times). Statistics use the scope-filtered set.
        var allPlanes = g.planesOrdered;
        var nowMs     = Date.now();

        // Update arrivals tracking on ALL planes regardless of scope
        var currentIcaos = {};
        for (var ci = 0; ci < allPlanes.length; ci++) {
            currentIcaos[allPlanes[ci].icao] = true;
            if (!_sumArrivals[allPlanes[ci].icao]) _sumArrivals[allPlanes[ci].icao] = nowMs;
        }
        Object.keys(_sumArrivals).forEach(function(ic) { if (!currentIcaos[ic]) delete _sumArrivals[ic]; });

        // Apply runtime scope filter (shared with all tabs)
        var planes = allPlanes.filter(function(p) {
            if (_panelScope === 'inview') return !!p.inView;
            if (_panelScope === 'filtered') return planePassesAllFilters(p, null);
            return true;
        });

        var total   = planes.length;
        var altBands     = [0, 0, 0, 0, 0, 0, 0]; // ground, <5k, 5-10k, 10-20k, 20-30k, 30-40k, 40k+
        var altBandIcaos = [[], [], [], [], [], [], []]; // ICAOs per band for click-to-filter
        var militaryList  = [];
        var emergencyList = [];
        var unusualList   = [];
        var onGroundIcaos = [];
        var trackingIcaos = [];
        var withRouteIcaos = [];
        var noRouteIcaos = [];
        var operatorCounts = {};
        var routeCounts    = {};
        var typeCounts     = {};
        var speedList      = [];
        var slowestList    = [];
        var highList       = [];
        var methodCounts   = { adsb: 0, mlat: 0, tisb: 0, modes: 0, other: 0 };
        var countryCounts  = {};
        var distList       = [];

        // Receiver position - try tar1090 globals
        var rxLat = null, rxLon = null;
        try {
            if (typeof SiteLat !== 'undefined' && typeof SiteLon !== 'undefined' && SiteLat && SiteLon) {
                rxLat = +SiteLat; rxLon = +SiteLon;
            } else if (typeof g !== 'undefined' && g.SitePosition && g.SitePosition.lat) {
                rxLat = g.SitePosition.lat; rxLon = g.SitePosition.lng;
            }
        } catch (e) {}

        var closestPlanes = [];

        for (var i = 0; i < planes.length; i++) {
            var p = planes[i];

            // Altitude — tar1090 uses plane.altitude ('ground' string or number)
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

            // Military
            if (isMilitaryAircraft(p)) militaryList.push(p);

            // Emergency squawks
            if (p.squawk === '7500' || p.squawk === '7600' || p.squawk === '7700') emergencyList.push(p);

            // Unusual: very low fixed-wing (not helicopter, not ground)
            if (!isGround && altNum !== null && altNum > 0 && altNum < 1000 &&
                    p.position && p.position.length >= 2) {
                var cat = getAircraftCategory(p.typeLong || p.icaoType);
                if (cat !== 5) unusualList.push({ plane: p, reason: 'Very low (' + Math.round(altNum) + ' ft)' });
            }

            // Operator counts
            var cEntry = getCacheEntry(p);
            if (cEntry && cEntry.airline_code) {
                var opName = getAirlineName(cEntry.airline_code);
                if (opName && opName !== cEntry.airline_code) {
                    operatorCounts[opName] = (operatorCounts[opName] || 0) + 1;
                }
            }

            // Route counts
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

            // Aircraft type counts
            var tCode = p.icaoType || (p.typeLong ? p.typeLong.split(' ')[0] : null);
            if (tCode) typeCounts[tCode] = (typeCounts[tCode] || 0) + 1;

            // Speed leaders / slowest — ground speed (gs), airborne only
            if (!isGround && typeof p.gs === 'number' && p.gs > 0) speedList.push(p);
            // Slowest: airborne and actually moving (gs > 30 kt excludes parked/taxiing)
            if (!isGround && typeof p.gs === 'number' && p.gs > 30) slowestList.push(p);

            // High flyers
            if (!isGround && typeof altNum === 'number' && altNum > 0) highList.push(p);

            // Tracking method
            var at = (p.addrtype || '').toLowerCase();
            if (at.indexOf('adsb') === 0 || at.indexOf('adsr') === 0) methodCounts.adsb++;
            else if (at === 'mlat')                                     methodCounts.mlat++;
            else if (at.indexOf('tisb') === 0)                          methodCounts.tisb++;
            else if (at === 'mode_s')                                   methodCounts.modes++;
            else                                                        methodCounts.other++;
            // Tracking = aircraft with a known tracking method and a live position.
            if (at && p.icao) {
                var hasPos = (p.position && p.position.length >= 2) || (!isNaN(+p.lat) && !isNaN(+p.lon));
                if (hasPos) trackingIcaos.push(p.icao.toUpperCase());
            }

            // Countries (registration prefix → ICAO hex fallback)
            var ctry = _rfRegCountry(p.registration, p.icao);
            if (ctry) countryCounts[ctry] = (countryCounts[ctry] || 0) + 1;

            // Closest + furthest — use plane.position [lon, lat] (tar1090 convention)
            if (rxLat !== null) {
                var cLat, cLon;
                if (p.position && p.position.length >= 2) {
                    cLon = +p.position[0]; cLat = +p.position[1];
                } else {
                    cLat = +p.lat; cLon = +p.lon;
                }
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

        speedList.sort(function(a, b) { return b.gs - a.gs; });
        speedList = speedList.slice(0, 5);

        slowestList.sort(function(a, b) { return a.gs - b.gs; });
        slowestList = slowestList.slice(0, 5);

        highList.sort(function(a, b) {
            var aA = typeof a.altitude === 'number' ? a.altitude : (typeof a.alt_baro === 'number' ? a.alt_baro : 0);
            var bA = typeof b.altitude === 'number' ? b.altitude : (typeof b.alt_baro === 'number' ? b.alt_baro : 0);
            return bA - aA;
        });
        highList = highList.slice(0, 5);

        // Alert DB matches — planes currently on scope that appear in _alertsDb
        var alertsList = [];
        if (_alertsDb && _alertsDb.length) {
            var _aLiveMap = {};
            for (var ali = 0; ali < planes.length; ali++) {
                if (planes[ali].icao) _aLiveMap[planes[ali].icao.toUpperCase()] = planes[ali];
            }
            _alertsDb.forEach(function(a) {
                var lp = _aLiveMap[(a.icao || '').toUpperCase()];
                if (lp) alertsList.push({ plane: lp, alert: a });
            });
        }

        var topOps    = Object.keys(operatorCounts).map(function(k){ return [k, operatorCounts[k]]; })
                               .sort(function(a,b){ return b[1]-a[1]; }).slice(0, 6);
        var topRoutes = Object.keys(routeCounts).map(function(k){ return [k, routeCounts[k]]; })
                               .sort(function(a,b){ return b[1]-a[1]; }).slice(0, 6);
        var topTypes  = Object.keys(typeCounts).map(function(k){ return [k, typeCounts[k]]; })
                               .sort(function(a,b){ return b[1]-a[1]; }).slice(0, 8);
        var topCountries = Object.keys(countryCounts).map(function(k){ return [k, countryCounts[k]]; })
                               .sort(function(a,b){ return b[1]-a[1]; }).slice(0, 8);
        var altMax    = Math.max.apply(null, altBands.concat([1]));

        // Range: furthest aircraft with bearing
        var furthestItem = null;
        if (distList.length > 0) {
            distList.sort(function(a, b) { return b.dist - a.dist; });
            furthestItem = distList[0];
        }

        // Recent arrivals: first seen within last 5 minutes, sorted newest first
        var ARRIVAL_WINDOW_MS = 5 * 60 * 1000;
        var recentArrivals = planes.filter(function(p) {
            var fs = _sumArrivals[p.icao];
            return fs && (nowMs - fs) < ARRIVAL_WINDOW_MS;
        }).sort(function(a, b) {
            return (_sumArrivals[b.icao] || 0) - (_sumArrivals[a.icao] || 0);
        }).slice(0, 8);

        function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
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
        // Renders a clickable plane row. selected = ICAO is in _sumFilter.
        function planeRow(q, extraHtml) {
            var ic   = (q.icao || '').toUpperCase();
            var sel  = _sumFilter.size > 0 && _sumFilter.has(ic);
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

        var html = '<div class="rf-summary-content">';

        // ── Overview (always shown) ───────────────────────────────────────────────
        var onGround = altBands[0];
        var airborne = total - onGround;
        var milIdx   = militaryList.length > 0 ? (_sumClickData.push(militaryList.map(function(q){ return q.icao; })) - 1) : -1;
        var gndIdx   = onGroundIcaos.length > 0 ? (_sumClickData.push(onGroundIcaos.slice()) - 1) : -1;
        var trkIdx   = trackingIcaos.length > 0 ? (_sumClickData.push(trackingIcaos.slice()) - 1) : -1;
        var wrIdx    = withRouteIcaos.length > 0 ? (_sumClickData.push(withRouteIcaos.slice()) - 1) : -1;
        var nrIdx    = noRouteIcaos.length > 0 ? (_sumClickData.push(noRouteIcaos.slice()) - 1) : -1;
        var alrtIdx  = alertsList.length > 0 ? (_sumClickData.push(alertsList.map(function(x){ return x.plane.icao; })) - 1) : -1;
        html += '<div class="rf-sum-section">';
        html += '<div class="rf-sum-title">Overview <span class="rf-sum-scope-badge">' + _rfScopeBadgeLabel() + '</span></div>';
        html += '<div class="rf-sum-overview">';
        html += '<div class="rf-sum-stat"><div class="rf-sum-num">' + total + '</div><div class="rf-sum-label">loaded aircraft</div></div>';
        html += '<div class="rf-sum-stat"><div class="rf-sum-num">' + airborne + '</div><div class="rf-sum-label">airborne</div></div>';
        html += '<div class="rf-sum-stat' + (onGroundIcaos.length > 0 ? ' rf-sum-stat-click' : '') + '"' +
            (onGroundIcaos.length > 0 ? ' onclick="window._rfSumFilterIdx(' + gndIdx + ')" title="Filter on-ground aircraft"' : '') + '>' +
            '<div class="rf-sum-num">' + onGround + '</div><div class="rf-sum-label">on ground</div></div>';
        html += '<div class="rf-sum-stat' + (trackingIcaos.length > 0 ? ' rf-sum-stat-click' : '') + '"' +
            (trackingIcaos.length > 0 ? ' onclick="window._rfSumFilterIdx(' + trkIdx + ')" title="Filter tracked aircraft"' : '') + '>' +
            '<div class="rf-sum-num">' + trackingIcaos.length + '</div><div class="rf-sum-label">tracking</div></div>';
        html += '<div class="rf-sum-stat' + (withRouteIcaos.length > 0 ? ' rf-sum-stat-click' : '') + '"' +
            (withRouteIcaos.length > 0 ? ' onclick="window._rfSumFilterIdx(' + wrIdx + ')" title="Filter aircraft with route data"' : '') + '>' +
            '<div class="rf-sum-num">' + withRouteIcaos.length + '</div><div class="rf-sum-label">with route</div></div>';
        html += '<div class="rf-sum-stat' + (noRouteIcaos.length > 0 ? ' rf-sum-stat-click' : '') + '"' +
            (noRouteIcaos.length > 0 ? ' onclick="window._rfSumFilterIdx(' + nrIdx + ')" title="Filter aircraft without route data"' : '') + '>' +
            '<div class="rf-sum-num">' + noRouteIcaos.length + '</div><div class="rf-sum-label">no route</div></div>';
        html += '<div class="rf-sum-stat' + (alertsList.length > 0 ? ' rf-sum-stat-click' : '') + '"' +
            (alertsList.length > 0 ? ' onclick="window._rfSumFilterIdx(' + alrtIdx + ')" title="Filter alert-matched aircraft"' : '') + '>' +
            '<div class="rf-sum-num">' + alertsList.length + '</div><div class="rf-sum-label">alert</div></div>';
        if (militaryList.length > 0) {
            html += '<div class="rf-sum-stat rf-sum-stat-mil rf-sum-stat-click" onclick="window._rfSumFilterIdx(' + milIdx + ')" title="Filter military aircraft">' +
                '<div class="rf-sum-num">' + militaryList.length + '</div><div class="rf-sum-label">military</div></div>';
        }
        if (emergencyList.length > 0) {
            html += '<div class="rf-sum-stat rf-sum-stat-emg"><div class="rf-sum-num">' + emergencyList.length + '</div><div class="rf-sum-label">emergency</div></div>';
        }
        html += '</div>';
        html += '</div>';

        // ── Altitude distribution ─────────────────────────────────────────────────
        if (_summarySettings.altitude) {
            var altLabels  = ['Ground', '< 5,000', '5–10k', '10–20k', '20–30k', '30–40k', '40k+'];
            var altColors  = ['#6e6e6e', '#7ce8c8', '#7cb9e8', '#7c8fe8', '#a87ce8', '#e87c7c', '#e8a87c'];
            var altFullLbls= ['Ground', 'Under 5,000 ft', '5,000–10,000 ft', '10,000–20,000 ft', '20,000–30,000 ft', '30,000–40,000 ft', '40,000 ft+'];
            html += '<div class="rf-sum-section">';
            html += '<div class="rf-sum-title">Altitude Distribution <span class="rf-sum-title-sub">click band to filter</span></div>';
            html += '<div class="rf-sum-altchart">';
            for (var bi = 0; bi < 7; bi++) {
                var cnt     = altBands[bi];
                var barPct  = cnt > 0 ? Math.max(3, Math.round(cnt / altMax * 100)) : 0;
                var realPct = total > 0 ? Math.round(cnt / total * 100) : 0;
                var showInside = barPct >= 22 && cnt > 0;
                // Check if this band is the active _sumFilter (all its ICAOs are selected)
                var bandIcaos  = altBandIcaos[bi];
                var bandActive = cnt > 0 && _sumFilter.size > 0 && bandIcaos.length > 0 &&
                    bandIcaos.every(function(ic){ return _sumFilter.has(ic); });
                var bandIdx    = cnt > 0 ? (_sumClickData.push(bandIcaos.slice()) - 1) : -1;
                html += '<div class="rf-sum-altrow' + (bandActive ? ' rf-sum-altrow-active' : '') + (cnt > 0 ? ' rf-sum-altrow-clickable' : '') + '" ' +
                    (cnt > 0 ? 'onclick="window._rfSumFilterIdx(' + bandIdx + ')" ' : '') +
                    'title="' + altFullLbls[bi] + ': ' + cnt + ' aircraft (' + realPct + '%)' + (cnt > 0 ? ' — click to filter' : '') + '">' +
                    '<div class="rf-sum-altrow-lbl" style="color:' + altColors[bi] + '">' + altLabels[bi] + '</div>' +
                    '<div class="rf-sum-altrow-track">' +
                        (cnt > 0
                            ? '<div class="rf-sum-altrow-fill" style="width:' + barPct + '%;background:' + altColors[bi] + '">' +
                                (showInside ? '<span class="rf-sum-altrow-inner">' + cnt + '</span>' : '') +
                              '</div>' +
                              (!showInside ? '<span class="rf-sum-altrow-outer">' + cnt + '</span>' : '')
                            : '') +
                    '</div>' +
                    '<div class="rf-sum-altrow-pct">' + (cnt > 0 ? realPct + '%' : '—') + '</div>' +
                    '</div>';
            }
            html += '</div>';
            html += '</div>';
        }

        // ── Attention required ────────────────────────────────────────────────────
        if (_summarySettings.attention) {
            var hasAttn = emergencyList.length > 0 || unusualList.length > 0 || militaryList.length > 0 || _alertsDb || _alertsFetching || _alertsError;
            html += '<div class="rf-sum-section">';
            html += '<div class="rf-sum-title">Attention</div>';
            if (!hasAttn) {
                html += '<div class="rf-sum-none">Nothing unusual right now.</div>';
            } else {
                // Emergency squawks — clickable header filters all emergency planes
                if (emergencyList.length > 0) {
                    var emgIdx = _sumClickData.push(emergencyList.map(function(q){ return q.icao; })) - 1;
                    html += '<div class="rf-sum-attn-hdr" onclick="window._rfSumFilterIdx(' + emgIdx + ')" title="Click to filter all emergency aircraft">' +
                        '<span class="rf-sum-squawk-hdr">&#9888; Emergency (' + emergencyList.length + ')</span>' +
                        '</div>';
                    emergencyList.forEach(function (q) {
                        var sq   = q.squawk;
                        var desc = sq === '7500' ? 'Hijack' : sq === '7600' ? 'Radio fail' : 'Emergency';
                        html += planeRow(q, '<span class="rf-sum-squawk">SQWK\u00a0' + sq + ' ' + desc + '</span>');
                    });
                }
                // Military — clickable header filters all military planes
                if (militaryList.length > 0) {
                    var milIdx = _sumClickData.push(militaryList.map(function(q){ return q.icao; })) - 1;
                    html += '<div class="rf-sum-attn-hdr" onclick="window._rfSumFilterIdx(' + milIdx + ')" title="Click to filter all military aircraft">' +
                        '<span class="rf-sum-mil-badge">MIL (' + militaryList.length + ')</span>' +
                        '</div>';
                    militaryList.slice(0, 8).forEach(function (q) {
                        html += planeRow(q, '<span class="rf-sum-mil-badge">MIL</span>');
                    });
                    if (militaryList.length > 8) {
                        html += '<div class="rf-sum-more">and ' + (militaryList.length - 8) + ' more \u2014 <span class="rf-sum-link" onclick="window._rfSumFilterIdx(' + milIdx + ')">filter all</span></div>';
                    }
                }
                // Very low aircraft
                if (unusualList.length > 0) {
                    var lowIdx = _sumClickData.push(unusualList.map(function(i){ return i.plane.icao; })) - 1;
                    html += '<div class="rf-sum-attn-hdr" onclick="window._rfSumFilterIdx(' + lowIdx + ')" title="Click to filter all low-altitude aircraft">' +
                        '<span class="rf-sum-low-badge">LOW (' + unusualList.length + ')</span>' +
                        '</div>';
                    unusualList.slice(0, 4).forEach(function (item) {
                        html += planeRow(item.plane, '<span class="rf-sum-low-badge">LOW</span> <span class="rf-sum-attn-desc">' + esc(item.reason) + '</span>');
                    });
                }
                // Plane alert DB status/matches (always shown so visibility is obvious)
                if (_alertsFetching) {
                    html += '<div class="rf-sum-attn-hdr"><span class="rf-sum-alert-badge">\u2605 Alerts (loading\u2026)</span></div>';
                } else if (_alertsError) {
                    html += '<div class="rf-sum-attn-hdr"><span class="rf-sum-alert-badge">\u2605 Alerts (error)</span></div>';
                    html += '<div class="rf-sum-none">plane-alert-db failed to load: ' + esc(_alertsError) + '</div>';
                } else if (_alertsDb) {
                    if (alertsList.length > 0) {
                        var alIdx = _sumClickData.push(alertsList.map(function(x){ return x.plane.icao; })) - 1;
                        html += '<div class="rf-sum-attn-hdr" onclick="window._rfSumFilterIdx(' + alIdx + ')" title="Click to filter all alert-matched aircraft">' +
                            '<span class="rf-sum-alert-badge">\u2605 Alerts (' + alertsList.length + ')</span>' +
                            '</div>';
                        alertsList.slice(0, 6).forEach(function(item) {
                            var tags = [item.alert.tag1, item.alert.tag2, item.alert.tag3].filter(Boolean).join(' \u00b7 ');
                            var label = tags || item.alert.category || item.alert.cmpg || 'Alert';
                            html += planeRow(item.plane, '<span class="rf-sum-alert-tag">' + esc(label) + '</span>');
                        });
                        if (alertsList.length > 6) {
                            html += '<div class="rf-sum-more">and ' + (alertsList.length - 6) + ' more \u2014 <span class="rf-sum-link" onclick="window._rfSumFilterIdx(' + alIdx + ')">filter all</span></div>';
                        }
                    } else {
                        html += '<div class="rf-sum-attn-hdr"><span class="rf-sum-alert-badge">\u2605 Alerts (0)</span></div>';
                        html += '<div class="rf-sum-none">No alert-matched aircraft in the current summary scope.</div>';
                    }
                }
            }
            html += '</div>';
        }

        // ── Closest aircraft ──────────────────────────────────────────────────────
        if (_summarySettings.closest && closestPlanes.length > 0) {
            html += '<div class="rf-sum-section">';
            html += '<div class="rf-sum-title">Closest Aircraft</div>';
            closestPlanes.forEach(function (item) {
                var q = item.plane;
                html += planeRow(q, '<span class="rf-sum-dist">' + item.dist.toFixed(0) + '\u2009nm</span>');
            });
            html += '</div>';
        }

        // ── Speed leaders ─────────────────────────────────────────────────────────
        if (_summarySettings.speed && speedList.length > 0) {
            html += '<div class="rf-sum-section">';
            html += '<div class="rf-sum-title">Speed Leaders</div>';
            var spdMax = speedList[0].gs || 1;
            speedList.forEach(function (q, idx) {
                var spdPct = Math.round(q.gs / spdMax * 100);
                var ic = (q.icao || '').toUpperCase();
                var sel = _sumFilter.size > 0 && _sumFilter.has(ic);
                html += '<div class="rf-sum-leader-row' + (sel ? ' rf-sum-plane-sel' : '') + '" onclick="window._rfSumFilterIcao(\'' + ic + '\')" title="Click to filter to this aircraft">' +
                    '<div class="rf-sum-leader-rank">' + (idx + 1) + '</div>' +
                    '<div class="rf-sum-leader-info">' +
                        '<div class="rf-sum-leader-name">' + planeName(q) +
                            (planeReg(q) ? ' <span class="rf-sum-reg">' + planeReg(q) + '</span>' : '') +
                            ' <span class="rf-sum-type">' + planeType(q) + '</span>' +
                        '</div>' +
                        '<div class="rf-sum-leader-bar-wrap"><div class="rf-sum-leader-bar rf-sum-leader-bar-spd" style="width:' + spdPct + '%"></div></div>' +
                    '</div>' +
                    '<div class="rf-sum-leader-val">' + Math.round(q.gs) + '\u2009kt</div>' +
                    '</div>';
            });
            html += '</div>';
        }

        // ── Slowest aircraft ──────────────────────────────────────────────────────
        if (_summarySettings.slowest && slowestList.length > 0) {
            html += '<div class="rf-sum-section">';
            html += '<div class="rf-sum-title">Slowest Airborne</div>';
            var slowMax = slowestList[slowestList.length - 1].gs || 1;
            slowestList.forEach(function (q, idx) {
                var spdPct = Math.max(4, Math.round(q.gs / slowMax * 100));
                var ic = (q.icao || '').toUpperCase();
                var sel = _sumFilter.size > 0 && _sumFilter.has(ic);
                html += '<div class="rf-sum-leader-row' + (sel ? ' rf-sum-plane-sel' : '') + '" onclick="window._rfSumFilterIcao(\'' + ic + '\')" title="Click to filter to this aircraft">' +
                    '<div class="rf-sum-leader-rank">' + (idx + 1) + '</div>' +
                    '<div class="rf-sum-leader-info">' +
                        '<div class="rf-sum-leader-name">' + planeName(q) +
                            (planeReg(q) ? ' <span class="rf-sum-reg">' + planeReg(q) + '</span>' : '') +
                            ' <span class="rf-sum-type">' + planeType(q) + '</span>' +
                        '</div>' +
                        '<div class="rf-sum-leader-bar-wrap"><div class="rf-sum-leader-bar rf-sum-leader-bar-slow" style="width:' + spdPct + '%"></div></div>' +
                    '</div>' +
                    '<div class="rf-sum-leader-val">' + Math.round(q.gs) + '\u2009kt</div>' +
                    '</div>';
            });
            html += '</div>';
        }

        // ── High flyers ───────────────────────────────────────────────────────────
        if (_summarySettings.highflyers && highList.length > 0) {
            html += '<div class="rf-sum-section">';
            html += '<div class="rf-sum-title">High Flyers</div>';
            var hiMax = altNum2(highList[0]) || 1;
            highList.forEach(function (q, idx) {
                var hiAlt = altNum2(q);
                var hiPct = Math.round(hiAlt / hiMax * 100);
                var ic = (q.icao || '').toUpperCase();
                var sel = _sumFilter.size > 0 && _sumFilter.has(ic);
                html += '<div class="rf-sum-leader-row' + (sel ? ' rf-sum-plane-sel' : '') + '" onclick="window._rfSumFilterIcao(\'' + ic + '\')" title="Click to filter to this aircraft">' +
                    '<div class="rf-sum-leader-rank">' + (idx + 1) + '</div>' +
                    '<div class="rf-sum-leader-info">' +
                        '<div class="rf-sum-leader-name">' + planeName(q) +
                            (planeReg(q) ? ' <span class="rf-sum-reg">' + planeReg(q) + '</span>' : '') +
                            ' <span class="rf-sum-type">' + planeType(q) + '</span>' +
                        '</div>' +
                        '<div class="rf-sum-leader-bar-wrap"><div class="rf-sum-leader-bar rf-sum-leader-bar-alt" style="width:' + hiPct + '%"></div></div>' +
                    '</div>' +
                    '<div class="rf-sum-leader-val">' + hiAlt.toLocaleString() + '\u2009ft</div>' +
                    '</div>';
            });
            html += '</div>';
        }

        // ── Aircraft types ────────────────────────────────────────────────────────
        if (_summarySettings.types && topTypes.length > 0) {
            html += '<div class="rf-sum-section">';
            html += '<div class="rf-sum-title">Aircraft Types</div>';
            html += '<div class="rf-sum-types-grid">';
            topTypes.forEach(function (t) {
                html += '<div class="rf-sum-type-pill">' +
                    '<span class="rf-sum-type-code">' + esc(t[0]) + '</span>' +
                    '<span class="rf-sum-type-cnt">' + t[1] + '</span>' +
                    '</div>';
            });
            html += '</div>';
            html += '</div>';
        }

        // ── Busiest operators ─────────────────────────────────────────────────────
        if (_summarySettings.operators && topOps.length > 0) {
            html += '<div class="rf-sum-section">';
            html += '<div class="rf-sum-title">Busiest Operators</div>';
            html += '<div class="rf-sum-bar-list">';
            var opMax = topOps[0][1] || 1;
            topOps.forEach(function (op) {
                var w = Math.round(op[1] / opMax * 100);
                html += '<div class="rf-sum-bar-row">' +
                    '<div class="rf-sum-bar-label">' + esc(op[0]) + '</div>' +
                    '<div class="rf-sum-bar-track"><div class="rf-sum-bar-fill" style="width:' + w + '%"></div></div>' +
                    '<div class="rf-sum-bar-cnt">' + op[1] + '</div>' +
                    '</div>';
            });
            html += '</div>';
            html += '</div>';
        }

        // ── Busiest routes ────────────────────────────────────────────────────────
        if (_summarySettings.routes && topRoutes.length > 0) {
            html += '<div class="rf-sum-section">';
            html += '<div class="rf-sum-title">Busiest Routes</div>';
            html += '<div class="rf-sum-bar-list">';
            var rtMax = topRoutes[0][1] || 1;
            topRoutes.forEach(function (rt) {
                var w    = Math.round(rt[1] / rtMax * 100);
                // rt[0] = "EGLL – LFPG" — add flag to each airport code
                var parts = rt[0].split(' \u2013 ');
                var rtLabel = parts.map(function(ap) {
                    var f = airportFlag(ap.trim());
                    return (f ? f + '\u2009' : '') + esc(ap.trim());
                }).join(' <span style="color:#555">\u2013</span> ');
                html += '<div class="rf-sum-bar-row">' +
                    '<div class="rf-sum-bar-label">' + rtLabel + '</div>' +
                    '<div class="rf-sum-bar-track"><div class="rf-sum-bar-fill rf-sum-bar-fill-route" style="width:' + w + '%"></div></div>' +
                    '<div class="rf-sum-bar-cnt">' + rt[1] + '</div>' +
                    '</div>';
            });
            html += '</div>';
            html += '</div>';
        }

        // ── Tracking methods ──────────────────────────────────────────────────────
        if (_summarySettings.methods) {
            var hasMethods = methodCounts.adsb + methodCounts.mlat + methodCounts.tisb +
                             methodCounts.modes + methodCounts.other > 0;
            if (hasMethods) {
                var methodDefs = [
                    { key: 'adsb',  label: 'ADS-B',   cls: 'rf-sum-meth-adsb'  },
                    { key: 'mlat',  label: 'MLAT',    cls: 'rf-sum-meth-mlat'  },
                    { key: 'tisb',  label: 'TIS-B',   cls: 'rf-sum-meth-tisb'  },
                    { key: 'modes', label: 'Mode S',  cls: 'rf-sum-meth-modes' },
                    { key: 'other', label: 'Other',   cls: 'rf-sum-meth-other' },
                ];
                html += '<div class="rf-sum-section">';
                html += '<div class="rf-sum-title">Tracking Methods</div>';
                html += '<div class="rf-sum-methods">';
                methodDefs.forEach(function (m) {
                    var cnt = methodCounts[m.key];
                    if (cnt === 0) return;
                    var pct = Math.round(cnt / total * 100);
                    html += '<div class="rf-sum-meth-item ' + m.cls + '">' +
                        '<div class="rf-sum-meth-cnt">' + cnt + '</div>' +
                        '<div class="rf-sum-meth-label">' + m.label + '</div>' +
                        '<div class="rf-sum-meth-pct">' + pct + '%</div>' +
                        '</div>';
                });
                html += '</div>';
                html += '</div>';
            }
        }

        // ── Range & coverage ──────────────────────────────────────────────────────
        if (_summarySettings.range && furthestItem && rxLat !== null) {
            var fq     = furthestItem.plane;
            var fBear  = _rfBearing(rxLat, rxLon, furthestItem.lat, furthestItem.lon);
            var fCard  = _rfCardinal(fBear);
            html += '<div class="rf-sum-section">';
            html += '<div class="rf-sum-title">Range &amp; Coverage</div>';
            html += '<div class="rf-sum-range-row">' +
                '<div class="rf-sum-range-compass"><div class="rf-sum-range-arrow" style="transform:rotate(' + Math.round(fBear) + 'deg)">&#9650;</div></div>' +
                '<div class="rf-sum-range-info">' +
                    '<div class="rf-sum-range-dist">' + furthestItem.dist.toFixed(0) + '<span class="rf-sum-range-unit">\u2009nm</span></div>' +
                    '<div class="rf-sum-range-detail">' +
                        fCard + ' \u2022 ' +
                        '<span class="rf-sum-aname">' + planeName(fq) + '</span>' +
                        (planeReg(fq) ? ' <span class="rf-sum-reg">' + planeReg(fq) + '</span>' : '') +
                        ' <span class="rf-sum-type">' + planeType(fq) + '</span>' +
                    '</div>' +
                '</div>' +
                '</div>';
            html += '</div>';
        }

        // ── Countries ─────────────────────────────────────────────────────────────
        if (_summarySettings.countries && topCountries.length > 0) {
            html += '<div class="rf-sum-section">';
            html += '<div class="rf-sum-title">Countries</div>';
            html += '<div class="rf-sum-bar-list">';
            var ctMax = topCountries[0][1] || 1;
            topCountries.forEach(function (c) {
                var w    = Math.round(c[1] / ctMax * 100);
                var iso2 = _toIso2(c[0]);
                var flag = iso2 ? flagFromIso(iso2) + '\u2009' : '';
                html += '<div class="rf-sum-bar-row">' +
                    '<div class="rf-sum-bar-label">' + flag + esc(c[0]) + '</div>' +
                    '<div class="rf-sum-bar-track"><div class="rf-sum-bar-fill rf-sum-bar-fill-country" style="width:' + w + '%"></div></div>' +
                    '<div class="rf-sum-bar-cnt">' + c[1] + '</div>' +
                    '</div>';
            });
            html += '</div>';
            html += '</div>';
        }

        // ── Recent arrivals ───────────────────────────────────────────────────────
        if (_summarySettings.arrivals) {
            html += '<div class="rf-sum-section">';
            html += '<div class="rf-sum-title">Recent Arrivals <span class="rf-sum-title-sub">(last 5 min)</span></div>';
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

        html += '<div class="rf-sum-footer">Refreshes every 3s &bull; Manage sections in <span class="rf-sum-footer-link" onclick="window._rfSwitchTab(\'settings\')">Settings &#9881;</span></div>';
        html += '</div>';

        listEl.innerHTML = html;

        var statusEl = document.getElementById('rf-status');
        if (statusEl) statusEl.textContent = total + ' aircraft' + (_panelScope !== 'all' ? ' (' + _rfScopeLabel() + ')' : '');
        var btn = document.getElementById('rf-btn');
        if (btn) btn.className = 'button ' + (isFilterActive() ? 'activeButton' : 'inActiveButton');
    }

    // ── Settings tab rendering ────────────────────────────────────────────────
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
                  '<strong>Storage warning</strong> — localStorage is blocked in this browser session. ' +
                  'RF is running in cookie-only fallback mode. Use Export JSON for reliable backups.' +
                  '</div>'
                : '';
            var homeLocOpts = '<option value="">Select saved distance location…</option>';
            for (var hli = 0; hli < _distanceLocations.length; hli++) {
                var hl = _distanceLocations[hli];
                var nm = String(hl && hl.name ? hl.name : ('Location ' + (hli + 1)));
                nm = nm.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
                homeLocOpts += '<option value="' + hli + '">' + nm + '</option>';
            }
            listEl.innerHTML =
                '<div class="rf-settings-content">' +

                // ── Intro ─────────────────────────────────────────────────────
                '<div class="rf-set-intro">' +
                '<p><strong>Robs Filters</strong> adds quick filtering and map-focused insights to tar1090.' +
                'The <strong><a class="rf-set-link" onclick="window._rfSwitchTab(\'summary\')">Summary tab</a></strong> gives a live overview of traffic mix, altitude bands, hotspots, and notable aircraft.' +
                '</p>' +
                '<p style="margin:0">Tip: use <strong>In map view</strong> for day-to-day tracking, then switch to <strong>Filtered view</strong> when you want to focus on a specific subset.</p>' +
                '</div>' +

                '<div class="rf-set-divider"></div>' +

                // ── Panel layout ──────────────────────────────────────────────
                '<div class="rf-set-group">' +
                '<div class="rf-set-group-title">Display & Scope</div>' +
                '<div class="rf-set-radio-group">' +
                '<label class="rf-set-radio"><input type="radio" name="rf-display-mode" value="popup"' + (settings.displayMode !== 'sidebar' ? ' checked' : '') + ' onchange="window._rfSetDisplayMode(\'popup\')"><span>Popup</span><span class="rf-set-radio-desc">Floats over the map, draggable</span></label>' +
                '<label class="rf-set-radio"><input type="radio" name="rf-display-mode" value="sidebar"' + (settings.displayMode === 'sidebar' ? ' checked' : '') + ' onchange="window._rfSetDisplayMode(\'sidebar\')"><span>Sidebar</span><span class="rf-set-radio-desc">Docks alongside tar1090\'s info panel</span></label>' +
                '</div>' +
                '<label class="rf-set-toggle" style="margin-top:8px">' +
                '<input type="checkbox"' + (settings.hideAllScope ? ' checked' : '') + ' onchange="window._rfSetHideAllScope(this.checked)">' +
                '<div class="rf-set-toggle-body">' +
                '<div class="rf-set-toggle-label">Hide "All aircraft" scope button</div>' +
                '<div class="rf-set-toggle-desc">Recommended when tar1090 runs in API/globe mode, where the browser only has map-loaded chunks and "All" can be misleading. ' +
                'For full global all-aircraft behavior, disable API mode in docker (set READSB_ENABLE_API=false and remove --tar1090-use-api).</div>' +
                '</div>' +
                '</label>' +
                '<div class="rf-set-divider"></div>' +
                '<div class="rf-set-group-title">Home Position</div>' +
                '<div class="rf-set-group-desc">Detected: ' + detTxt + '</div>' +
                '<label class="rf-set-toggle" style="margin-top:6px">' +
                '<input type="checkbox"' + (settings.homeOverride ? ' checked' : '') + ' onchange="window._rfSetHomeOverride(this.checked)">' +
                '<div class="rf-set-toggle-body">' +
                '<div class="rf-set-toggle-label">Override home position</div>' +
                '<div class="rf-set-toggle-desc">Use custom home center and zoom for the home button and first panel open.</div>' +
                '</div>' +
                '</label>' +
                '<div class="rf-dist-row" style="margin-top:6px">' +
                '<label class="rf-dist-label">Lat</label>' +
                '<input class="rf-dist-input rf-dist-small" type="number" step="0.00001" min="-90" max="90" value="' + String(settings.homeLat).replace(/"/g,'&quot;') + '" oninput="window._rfSetHomeValue(\'lat\',this.value)">' +
                '<label class="rf-dist-label">Lon</label>' +
                '<input class="rf-dist-input rf-dist-small" type="number" step="0.00001" min="-180" max="180" value="' + String(settings.homeLon).replace(/"/g,'&quot;') + '" oninput="window._rfSetHomeValue(\'lon\',this.value)">' +
                '<button class="rf-cat-btn" onclick="window._rfUseDetectedHome()" title="Use auto-detected tar1090 home position">Use detected</button>' +
                '</div>' +
                '<div class="rf-dist-row" style="margin-top:6px;flex-wrap:wrap">' +
                '<button class="rf-cat-btn" onclick="window._rfPickHomeFromMap()" title="Click once on the main map to set home position">Pick from map</button>' +
                '<select id="rf-home-dist-loc" class="rf-dist-input" style="min-width:170px">' + homeLocOpts + '</select>' +
                '<button class="rf-cat-btn" onclick="window._rfUseDistLocForHome()">Use saved location</button>' +
                '</div>' +
                '<div class="rf-dist-row" style="margin-top:6px">' +
                '<label class="rf-dist-label">Zoom</label>' +
                '<input class="rf-dist-input rf-dist-small" type="number" step="1" min="2" max="19" value="' + String(settings.homeZoom).replace(/"/g,'&quot;') + '" oninput="window._rfSetHomeValue(\'zoom\',this.value)">' +
                '<button class="rf-cat-btn" onclick="window._rfCenterHome(true)" title="Center map on configured home">\u2302 Center</button>' +
                '</div>' +
                '</div>' +

                '<div class="rf-set-divider"></div>' +

                // ── Data sources ──────────────────────────────────────────────
                '<div class="rf-set-group">' +
                '<div class="rf-set-group-title">Data Sources</div>' +
                '<label class="rf-set-toggle">' +
                '<input type="checkbox"' + (settings.useLocalDb ? ' checked' : '') + ' onchange="window._rfSetUseLocalDb(this.checked)">' +
                '<div class="rf-set-toggle-body">' +
                '<div class="rf-set-toggle-label">Use local databases</div>' +
                '<div class="rf-set-toggle-desc">Downloads airports, airlines and routes from community databases once per 24h. ' +
                'Sources: OurAirports, VRS Standing Data. Reduces live API calls and enriches filter data.</div>' +
                '</div>' +
                '</label>' +
                '<label class="rf-set-toggle">' +
                '<input type="checkbox"' + (settings.routeKnownOnly ? ' checked' : '') + ' onchange="window._rfSetRouteKnownOnly(this.checked)">' +
                '<div class="rf-set-toggle-body">' +
                '<div class="rf-set-toggle-label">Route lookups for known airline prefixes only</div>' +
                '<div class="rf-set-toggle-desc">Reduces 404 route CSV requests by skipping callsign prefixes that are not in the airline database (common for GA, military, and special flights). Disable this only if you want aggressive lookup attempts.</div>' +
                '</div>' +
                '</label>' +
                dbStatusHtml() +
                '</div>' +

                '<div class="rf-set-divider"></div>' +

                // ── Summary display ───────────────────────────────────────────
                '<div class="rf-set-group">' +
                '<div class="rf-set-group-title">Summary Tab Sections</div>' +
                '<div class="rf-set-group-desc">Choose which sections are shown on the Summary tab.</div>' +
                [
                    ['altitude',   'Altitude Distribution', 'Bar chart showing how many aircraft are in each altitude band'],
                    ['attention',  'Attention Alerts',      'Emergency squawks, military contacts, and very-low aircraft'],
                    ['closest',    'Closest Aircraft',      'The 5 aircraft nearest to your receiver'],
                    ['speed',      'Speed Leaders',         'The 5 fastest airborne aircraft by ground speed'],
                    ['highflyers', 'High Flyers',           'The 5 highest-altitude aircraft currently visible'],
                    ['types',      'Aircraft Types',        'Most common ICAO type codes seen right now'],
                    ['operators',  'Busiest Operators',     'Airlines or operators with the most aircraft visible'],
                    ['routes',     'Busiest Routes',        'Airport-pair routes with the most flights right now'],
                    ['methods',    'Tracking Methods',      'Breakdown of ADS-B, MLAT, TIS-B and Mode S contacts'],
                    ['range',      'Range & Coverage',      'Furthest aircraft detected and its bearing from your receiver'],
                    ['countries',  'Countries',             'Top countries visible, identified from aircraft registrations'],
                    ['arrivals',   'Recent Arrivals',       'Aircraft that first appeared in the last 5 minutes'],
                    ['slowest',    'Slowest Airborne',      'The 5 slowest airborne aircraft currently flying (> 30 kt ground speed)'],
                ].map(function (s) {
                    return '<label class="rf-set-toggle">' +
                        '<input type="checkbox"' + (_summarySettings[s[0]] ? ' checked' : '') + ' onchange="window._rfSetSummarySection(\'' + s[0] + '\',this.checked)">' +
                        '<div class="rf-set-toggle-body">' +
                        '<div class="rf-set-toggle-label">' + s[1] + '</div>' +
                        '<div class="rf-set-toggle-desc">' + s[2] + '</div>' +
                        '</div>' +
                        '</label>';
                }).join('') +
                '</div>' +

                '<div class="rf-set-divider"></div>' +

                // ── Visible tabs ──────────────────────────────────────────────
                '<div class="rf-set-group">' +
                '<div class="rf-set-group-title">Visible Tabs</div>' +
                '<div class="rf-set-group-desc">Hide tabs you do not use. Changes take effect immediately.</div>' +
                '<div class="rf-set-tabs-grid">' +
                [
                    ['summary',   'Summary',   'Insights and overview'],
                    ['airports',  'Airports',  'Filter by departure/arrival airport'],
                    ['countries', 'Countries', 'Filter by origin/destination country'],
                    ['operators', 'Operators', 'Filter by airline or operator'],
                    ['aircraft',  'Aircraft',  'Filter by type or category'],
                    ['views',     'Views',     'Saved filter presets and quick recall'],
                    ['alerts',    'Alerts',    'Plane alert database matches'],
                    ['distance',  'Distance',  'Filter by distance from a point'],
                ].map(function (t) {
                    return '<label class="rf-set-tabvis">' +
                        '<input type="checkbox"' + (_tabVisibility[t[0]] ? ' checked' : '') + ' onchange="window._rfSetTabVisible(\'' + t[0] + '\',this.checked)">' +
                        '<div><div class="rf-set-tabvis-name">' + t[1] + '</div><div class="rf-set-tabvis-desc">' + t[2] + '</div></div>' +
                        '</label>';
                }).join('') +
                '</div>' +
                '</div>' +

                '<div class="rf-set-divider"></div>' +

                // ── Alerts database ───────────────────────────────────────────
                '<div class="rf-set-group">' +
                '<div class="rf-set-group-title">Alerts Database</div>' +
                '<div class="rf-set-group-desc">' + (_alertsTimestamp ? 'Last updated: ' + new Date(_alertsTimestamp).toLocaleString() : 'Not yet loaded') + '</div>' +
                '<button class="rf-cat-btn" style="margin-top:6px" onclick="window._rfAlertsRefresh()">Refresh Now</button>' +
                '</div>' +

                '<div class="rf-set-divider"></div>' +

                // ── Backup / Restore ──────────────────────────────────────────
                '<div class="rf-set-group">' +
                '<div class="rf-set-group-title">Backup & Restore</div>' +
                '<div class="rf-set-group-desc">Export your RF config (home, distance, tabs, summary) to a JSON file and re-import it later.</div>' +
                '<div class="rf-set-group-desc" style="margin-top:6px">Storage mode: localStorage ' + (_rfLocalStorageOk ? 'available' : 'blocked') +
                ' | cookies ' + (_rfCookieOk ? 'available' : 'blocked') + '. ' +
                'Cookie backup keys: home=' + (_rfCookieGet(HOME_COOKIE_KEY) ? 'present' : 'missing') +
                ', snapshot=' + (_rfCookieGet(PERSIST_COOKIE_KEY) ? 'present' : 'missing') + '.</div>' +
                storageWarnBackup +
                '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' +
                '<button class="rf-cat-btn" onclick="window._rfExportPersist()">Export JSON</button>' +
                '<button class="rf-cat-btn" onclick="window._rfImportPersistPick()">Import JSON</button>' +
                '<button class="rf-cat-btn" onclick="window._rfResetPersist()">Reset Saved Data</button>' +
                '</div>' +
                '<input id="rf-import-json" type="file" accept="application/json,.json" style="display:none" onchange="window._rfImportPersistFile(this)">' +
                '</div>' +

                '<div class="rf-set-divider"></div>' +

                // ── About ─────────────────────────────────────────────────────
                '<div class="rf-set-group">' +
                '<div class="rf-set-group-title">About <span class="rf-beta-badge">BETA</span></div>' +
                '<div class="rf-set-about-warn">' +
                '<strong>Robs Filters is actively developed and still in beta.</strong><br>' +
                'Feedback and bug reports are welcome.' +
                '</div>' +
                '<div style="font-size:11px;color:#aaa;line-height:1.7;margin-top:8px">' +
                'Filter logic: selections are <strong>AND-ed across tabs</strong> and <strong>OR-ed within each tab</strong>. ' +
                'Active filters appear as breadcrumb chips so you can quickly see why aircraft are included or excluded.' +
                '</div>' +
                '<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">' +
                '<a href="https://github.com/robertcanavan/tar1090-robs-filters" target="_blank" class="rf-set-link-btn">&#128279; GitHub</a>' +
                '<a href="https://github.com/robertcanavan/tar1090-robs-filters/issues" target="_blank" class="rf-set-link-btn">&#x26a0; Report Issue</a>' +
                '</div>' +
                '<div class="rf-about-made">Made by Rob.</div>' +
                '</div>' +

                '</div>';
        }
        var statusEl = document.getElementById('rf-status');
        if (statusEl) statusEl.textContent = '';
        var btn = document.getElementById('rf-btn');
        if (btn) btn.className = 'button ' + (isFilterActive() ? 'activeButton' : 'inActiveButton');
    }

    // ── Distance tab rendering ────────────────────────────────────────────────
    function buildDistancePanel() {
        buildBreadcrumb();
        var searchEl = document.getElementById('rf-search');
        if (searchEl) searchEl.style.display = 'none';
        var ctrlEl = document.getElementById('rf-controls');
        if (ctrlEl) ctrlEl.innerHTML = '';
        var hdrEl = document.getElementById('rf-colheader');
        if (hdrEl) hdrEl.innerHTML = '';

        // Use _distanceForm for all input values so auto-refresh doesn't wipe edits
        var altAll = _distanceForm.altMode !== 'between';
        var altRng = altAll ? 'display:none' : '';

        var listEl = document.getElementById('rf-list');
        if (listEl) {
            // Auto-populate centre from receiver position BEFORE building HTML
            if (!_distanceForm.lat || !_distanceForm.lon) {
                var rp0 = _rfGetReceiverPos();
                _distanceForm.lat = rp0.lat.toFixed(5);
                _distanceForm.lon = rp0.lon.toFixed(5);
            }

            // ── Active zones section ──────────────────────────────────────────
            var zonesHtml = '';
            if (_distanceZones.length > 0) {
                var ZONE_COLORS_UI = ['#00c8e6','#f0e040','#e040fb','#69f080','#ff9800','#ff4444'];
                zonesHtml += '<div class="rf-setting-section-title" style="margin:4px 0">Active Zones (' + _distanceZones.length + ')</div>';
                zonesHtml += '<div class="rf-dist-mode-note">Mode: ' + (_distanceMode === 'outside' ? 'Outside zones (exclude inside)' : (_distanceMode === 'maponly' ? 'Map only (no filtering)' : 'Inside zones')) + '</div>';
                zonesHtml += '<div class="rf-dist-active-zone-list">';
                _distanceZones.forEach(function(z, i) {
                    var c = ZONE_COLORS_UI[i % ZONE_COLORS_UI.length];
                    var altInfo = z.altMode === 'between'
                        ? ' \u2014 ' + z.altMin.toLocaleString() + '\u2013' + z.altMax.toLocaleString() + 'ft'
                        : '';
                    zonesHtml +=
                        '<div class="rf-dist-zone-pill">' +
                        '<span class="rf-dist-zone-dot" style="background:' + c + '"></span>' +
                        '<span class="rf-dist-zone-pill-text">' +
                        z.name.replace(/&/g,'&amp;').replace(/</g,'&lt;') +
                        ' \u2014 ' + z.radiusNm + '\u00a0NM' + altInfo +
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

            // ── Saved locations section ───────────────────────────────────────
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
                ((_distanceForm.lat && _distanceForm.lon)
                    ? parseFloat(_distanceForm.lat).toFixed(5) + ', ' + parseFloat(_distanceForm.lon).toFixed(5)
                    : 'Click the map to set a centre point') +
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
                ' value="' + _distanceForm.radiusNm + '"' +
                ' oninput="window._rfDistRadiusChanged(this.value)">' +
                '<span class="rf-dist-unit">NM</span>' +
                '</div>' +

                '<div class="rf-dist-mode-wrap">' +
                '<button class="rf-sum-scope-btn' + (_distanceMode === 'inside' ? ' rf-sum-scope-active' : '') + '" onclick="window._rfSetDistMode(\'inside\')" title="Filter to aircraft inside active zone(s)">Inside</button>' +
                '<button class="rf-sum-scope-btn' + (_distanceMode === 'outside' ? ' rf-sum-scope-active' : '') + '" onclick="window._rfSetDistMode(\'outside\')" title="Filter to aircraft outside active zone(s)">Outside</button>' +
                '<button class="rf-sum-scope-btn' + (_distanceMode === 'maponly' ? ' rf-sum-scope-active' : '') + '" onclick="window._rfSetDistMode(\'maponly\')" title="Do not filter aircraft; only draw active zone(s) on map">Map only</button>' +
                '</div>' +

                '<div class="rf-dist-row" style="margin-top:4px;gap:6px">' +
                '<button class="rf-cat-btn rf-cat-active" onclick="window._rfDistApply()" title="Add this zone to the active filter">+ Add Zone</button>' +
                ((_distanceForm.lat && _distanceForm.lon)
                    ? '<button class="rf-cat-btn rf-dist-savebtn" onclick="window._rfDistSaveLoc()" title="Save this location and add as an active zone">&#128190; Save &amp; Add</button>'
                    : '') +
                '</div>' +

                '<div class="rf-setting-divider"></div>' +

                savedLocsHtml +

                '<div class="rf-setting-section-title" style="margin:4px 0">Altitude</div>' +

                '<div class="rf-dist-row rf-dist-alt-row">' +
                '<label class="rf-dist-radio-label">' +
                '<input type="radio" name="rf-dist-alt" value="all" id="rf-dist-alt-all"' + (altAll ? ' checked' : '') +
                ' onchange="window._rfDistAltMode(\'all\')"> All altitudes' +
                '</label>' +
                '<label class="rf-dist-radio-label">' +
                '<input type="radio" name="rf-dist-alt" value="between" id="rf-dist-alt-btw"' + (!altAll ? ' checked' : '') +
                ' onchange="window._rfDistAltMode(\'between\')"> Between' +
                '</label>' +
                '</div>' +

                '<div id="rf-dist-alt-range" style="' + altRng + '">' +
                '<div class="rf-dist-row">' +
                '<input id="rf-dist-alt-min" class="rf-dist-input rf-dist-small" type="number" min="0" max="99999"' +
                ' value="' + _distanceForm.altMin + '"' +
                ' oninput="window._rfDistFormUpdate(\'altMin\',this.value)">' +
                '<span class="rf-dist-unit">ft</span>' +
                '<span class="rf-dist-to">to</span>' +
                '<input id="rf-dist-alt-max" class="rf-dist-input rf-dist-small" type="number" min="0" max="99999"' +
                ' value="' + _distanceForm.altMax + '"' +
                ' oninput="window._rfDistFormUpdate(\'altMax\',this.value)">' +
                '<span class="rf-dist-unit">ft</span>' +
                '</div>' +
                '</div>' +

                '</div>';

            // Initialise Leaflet map after DOM update
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

        var btn = document.getElementById('rf-btn');
        if (btn) btn.className = 'button ' + (isFilterActive() ? 'activeButton' : 'inActiveButton');
    }

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
                '<div class="rf-set-group-desc">Capture your current filters as reusable presets. Views are also available from the header dropdown next to map scope.</div>' +
                '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' +
                '<button class="rf-cat-btn" onclick="window._rfViewsSavePrompt()">Save current as new view</button>' +
                (_activeViewId ? '<button class="rf-cat-btn" onclick="window._rfViewsRename(\'' + _rfEscAttr(_activeViewId) + '\')">Rename active view</button>' : '') +
                (_activeViewId ? '<button class="rf-cat-btn" onclick="window._rfViewsDeleteActive()">Delete active view</button>' : '') +
                '</div>' +
                '</div>';
            if (_savedViews.length === 0) {
                html += '<div class="rf-empty" style="margin-top:10px">No views saved yet. Build filters in any tab, then click <strong>Save View</strong>.</div>';
            } else {
                html += '<div class="rf-set-divider"></div><div class="rf-set-group"><div class="rf-set-group-title">Your Views (' + _savedViews.length + ')</div>';
                for (var i = 0; i < _savedViews.length; i++) {
                    var v = _savedViews[i];
                    _rfEnsureViewShape(v);
                    var isActive = _activeViewId === v.id;
                    var when = v.updatedAt ? new Date(v.updatedAt).toLocaleString() : '';
                    var mapModeLbl = !v.map.enabled ? 'Off' : (v.map.mode === 'fixed' ? 'Fixed' : 'Dynamic');
                    var fixedLat = (typeof v.map.fixedCenterLat === 'number') ? v.map.fixedCenterLat.toFixed(5) : '';
                    var fixedLon = (typeof v.map.fixedCenterLon === 'number') ? v.map.fixedCenterLon.toFixed(5) : '';
                    var fixedZoom = (typeof v.map.fixedZoom === 'number') ? String(Math.round(v.map.fixedZoom)) : '';
                    html += '<div class="rf-view-item' + (isActive ? ' rf-view-item-active' : '') + '">' +
                        '<div class="rf-view-item-name">' + _rfEscText(v.name || ('View ' + (i + 1))) + '</div>' +
                        '<div class="rf-view-item-meta">' + _rfEscText(when) + ' • Map: ' + mapModeLbl + '</div>' +
                        '<div class="rf-view-map-cfg">' +
                            '<label class="rf-set-toggle"><input type="checkbox"' + (v.map.enabled ? ' checked' : '') + ' onchange="window._rfViewsSetMapEnabled(\'' + _rfEscAttr(v.id) + '\',this.checked)"><div class="rf-set-toggle-body"><div class="rf-set-toggle-label">Enable map behavior</div></div></label>' +
                            '<div class="rf-view-inline-row">' +
                                '<button class="rf-cat-btn' + (!v.map.enabled ? ' rf-cat-active' : '') + '" onclick="window._rfViewsSetMapMode(\'' + _rfEscAttr(v.id) + '\',\'off\')">Off</button>' +
                                '<button class="rf-cat-btn' + (v.map.enabled && v.map.mode === 'dynamic' ? ' rf-cat-active' : '') + '" onclick="window._rfViewsSetMapMode(\'' + _rfEscAttr(v.id) + '\',\'dynamic\')">Dynamic</button>' +
                                '<button class="rf-cat-btn' + (v.map.enabled && v.map.mode === 'fixed' ? ' rf-cat-active' : '') + '" onclick="window._rfViewsSetMapMode(\'' + _rfEscAttr(v.id) + '\',\'fixed\')">Fixed</button>' +
                            '</div>' +
                            '<div class="rf-view-inline-row">' +
                                '<label class="rf-set-toggle"><input type="checkbox"' + (v.map.autoCenter ? ' checked' : '') + ' onchange="window._rfViewsSetMapToggle(\'' + _rfEscAttr(v.id) + '\',\'autoCenter\',this.checked)"><div class="rf-set-toggle-body"><div class="rf-set-toggle-label">Auto center</div></div></label>' +
                                '<label class="rf-set-toggle"><input type="checkbox"' + (v.map.autoZoom ? ' checked' : '') + ' onchange="window._rfViewsSetMapToggle(\'' + _rfEscAttr(v.id) + '\',\'autoZoom\',this.checked)"><div class="rf-set-toggle-body"><div class="rf-set-toggle-label">Auto zoom</div></div></label>' +
                            '</div>' +
                            '<div class="rf-view-inline-row">' +
                                '<button class="rf-cat-btn" onclick="window._rfViewsUseCurrentMap(\'' + _rfEscAttr(v.id) + '\')">Use current map</button>' +
                            '</div>' +
                            '<div class="rf-view-inline-row">' +
                                '<input class="rf-dist-input rf-dist-small" type="number" step="0.00001" min="-90" max="90" value="' + _rfEscAttr(fixedLat) + '" placeholder="Lat" oninput="window._rfViewsSetFixedValue(\'' + _rfEscAttr(v.id) + '\',\'lat\',this.value)">' +
                                '<input class="rf-dist-input rf-dist-small" type="number" step="0.00001" min="-180" max="180" value="' + _rfEscAttr(fixedLon) + '" placeholder="Lon" oninput="window._rfViewsSetFixedValue(\'' + _rfEscAttr(v.id) + '\',\'lon\',this.value)">' +
                                '<input class="rf-dist-input rf-dist-small" type="number" step="1" min="2" max="19" value="' + _rfEscAttr(fixedZoom) + '" placeholder="Zoom" oninput="window._rfViewsSetFixedValue(\'' + _rfEscAttr(v.id) + '\',\'zoom\',this.value)">' +
                            '</div>' +
                        '</div>' +
                        '<div class="rf-view-item-actions">' +
                        '<button class="rf-cat-btn" onclick="window._rfViewsApply(\'' + _rfEscAttr(v.id) + '\')">Apply</button>' +
                        '<button class="rf-cat-btn" onclick="window._rfViewsRename(\'' + _rfEscAttr(v.id) + '\')">Rename</button>' +
                        '<button class="rf-cat-btn" onclick="window._rfViewsSavePrompt(\'' + _rfEscAttr(v.id) + '\')">Overwrite</button>' +
                        '<button class="rf-cat-btn" onclick="window._rfViewsDelete(\'' + _rfEscAttr(v.id) + '\')">Delete</button>' +
                        '</div></div>';
                }
                html += '</div>';
            }
            html += '</div>';
            listEl.innerHTML = html;
        }
        var statusEl = document.getElementById('rf-status');
        if (statusEl) statusEl.textContent = _savedViews.length + ' saved view' + (_savedViews.length === 1 ? '' : 's');
    }

    // ── Panel rendering ───────────────────────────────────────────────────────
    function buildPanel() {
        var tab = state.activeTab;
        _rfRenderScopeHeader();

        // Summary tab: separate rendering path
        if (tab === 'summary') {
            buildSummaryPanel();
            return;
        }

        // Settings tab: separate rendering path
        if (tab === 'settings') {
            buildSettingsPanel();
            return;
        }

        // Distance tab: separate rendering path
        if (tab === 'distance') {
            buildDistancePanel();
            return;
        }

        // Views tab: separate rendering path
        if (tab === 'views') {
            buildViewsPanel();
            return;
        }

        // Alerts tab: separate rendering path
        if (tab === 'alerts') {
            buildAlertsPanel();
            return;
        }

        // Restore search visibility (may have been hidden when settings was active)
        var searchEl2 = document.getElementById('rf-search');
        if (searchEl2) searchEl2.style.display = '';

        var data = getAircraftData(tab);
        var airports = data.airports, countries = data.countries;
        var operators = data.operators, aircraft = data.aircraft;

        var cur          = ts();
        var hasDirection = (tab === 'airports' || tab === 'countries');
        var hasFromTo    = hasDirection;

        // Breadcrumb
        buildBreadcrumb();

        // Controls: direction toggle OR aircraft category filter
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
                // Category filter row: All + one button per category
                var catHtml = '<div class="rf-cat-filter">';
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
                // Country dropdown
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

        // Pick the data map for the active tab
        var dataMap;
        if      (tab === 'airports')  dataMap = airports;
        else if (tab === 'operators') dataMap = operators;
        else if (tab === 'aircraft')  dataMap = aircraft;
        else                          dataMap = countries;

        // Search filter (also searches display labels)
        var search = state.searchText.toLowerCase();
        var allEntries = [];
        dataMap.forEach(function (v, k) {
            // Aircraft tab: optionally filter by selected category
            if (tab === 'aircraft' && cur.catFilter.size > 0) {
                var kPass = true;
                cur.catFilter.forEach(function(catId) {
                    if (catId === 6) { if (!_militaryTypeKeys.has(k)) kPass = false; }
                    else { if (getAircraftCategory(k) !== catId) kPass = false; }
                });
                if (!kPass) return;
            }
            if (!search) { allEntries.push([k, v]); return; }
            if (k.toLowerCase().includes(search)) { allEntries.push([k, v]); return; }
            if (tab === 'airports'  && (_airportLabels.get(k) || '').toLowerCase().includes(search)) { allEntries.push([k, v]); return; }
            if (tab === 'operators' && (getAirlineName(k) || '').toLowerCase().includes(search))     { allEntries.push([k, v]); return; }
        });

        // Sort
        function sortVal(v) {
            if (v && typeof v === 'object') {
                if (cur.sortBy === 'from')  return v.from;
                if (cur.sortBy === 'to')    return v.to;
                return v.from + v.to;
            }
            return v || 0;
        }
        allEntries.sort(function (a, b) {
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

        // Column headers
        var hdrEl = document.getElementById('rf-colheader');
        if (hdrEl) {
            function sortBtn(col, lbl) {
                var ind = cur.sortBy === col ? (cur.sortDir === 'desc' ? ' ▼' : ' ▲') : '';
                return '<span class="rf-col-sort' + (cur.sortBy === col ? ' rf-col-active' : '') +
                    '" onclick="window._rfSetSort(\'' + col + '\')">' + lbl + ind + '</span>';
            }
            if (hasFromTo) {
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

        var totalAircraft = g.planesOrdered ? g.planesOrdered.length : 0;

        function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

        if (allEntries.length === 0) {
            var base = tab === 'aircraft'
                ? 'No aircraft data yet.'
                : 'No route data yet.\nAircraft routes load gradually\nafter initial connection.';
            var msg = totalAircraft === 0 ? base : 'No matches' + (state.searchText ? ' for "' + state.searchText + '"' : '');
            listEl.innerHTML = '<div class="rf-empty">' + msg.replace(/\n/g, '<br>') + '</div>';
        } else {
            var html = '';
            for (var j = 0; j < allEntries.length; j++) {
                var key = allEntries[j][0];
                var val = allEntries[j][1];
                var active = cur.items.has(key) ? ' rf-item-active' : '';
                var enc    = encodeURIComponent(key);

                if (hasFromTo) {
                    var display, flag = '';
                    if (tab === 'airports') {
                        var aIso2 = _airportIso2.get(key);
                        flag    = aIso2 ? '<span class="rf-flag">' + flagFromIso(aIso2) + '</span>' : '';
                        display = esc(_airportLabels.get(key) || key);
                    } else {
                        // Countries
                        var cIso2 = _countryIso2.get(key);
                        flag    = cIso2 ? '<span class="rf-flag">' + flagFromIso(cIso2) + '</span>' : '';
                        display = esc(key);
                    }
                    var fr = val && typeof val === 'object' ? val.from : 0;
                    var to = val && typeof val === 'object' ? val.to   : 0;
                    html += '<div class="rf-item rf-item-multi' + active + '" data-key="' + enc + '" onclick="window._rfToggle(this)">' +
                        flag +
                        '<span class="rf-item-name">' + display + '</span>' +
                        '<span class="rf-item-count">' + fr + '</span>' +
                        '<span class="rf-item-count">' + to + '</span>' +
                        '</div>';

                } else if (tab === 'aircraft') {
                    var catId = getAircraftCategory(key);
                    var info  = CATEGORY_INFO[catId];
                    // Country flags: up to 4 flags for this type
                    var rcMap = _aircraftRegCountries.get(key);
                    var flags = '';
                    if (rcMap && rcMap.size > 0) {
                        var rcEntries = Array.from(rcMap.entries());
                        var shown = rcEntries.slice(0, 4);
                        shown.forEach(function(e) { flags += flagFromIso(e[1]); });
                        if (rcMap.size > 4) flags += '+';
                    }
                    html += '<div class="rf-item rf-item-ac' + active + '" data-key="' + enc + '" onclick="window._rfToggle(this)">' +
                        '<span class="rf-ac-icon">' + info.emoji + '</span>' +
                        '<span class="rf-item-name">' + esc(key) + '</span>' +
                        '<span class="rf-ac-country">' + flags + '</span>' +
                        (info.label ? '<span class="rf-ac-cat" style="color:' + info.color + '">' + info.label + '</span>' : '<span class="rf-ac-cat"></span>') +
                        '<span class="rf-item-count">' + val + '</span>' +
                        '</div>';

                } else {
                    // Operators
                    var opDisplay = tab === 'operators' ? esc(getAirlineName(key) || key) : esc(key);
                    html += '<div class="rf-item' + active + '" data-key="' + enc + '" onclick="window._rfToggle(this)">' +
                        '<span class="rf-item-name">' + opDisplay + '</span>' +
                        '<span class="rf-item-count">' + val + '</span>' +
                        '</div>';
                }
            }
            listEl.innerHTML = html;
        }

        // Status bar
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

        // Sync toolbar button
        var btn = document.getElementById('rf-btn');
        if (btn) {
            btn.className = 'button ' + (isFilterActive() ? 'activeButton' : 'inActiveButton');
        }
    }

    // ── Public handlers ───────────────────────────────────────────────────────
    window._rfToggle = function (el) {
        var key = decodeURIComponent(el.dataset.key);
        var cur = ts();
        if (cur.items.has(key)) cur.items.delete(key);
        else cur.items.add(key);
        applyFilter();
        buildPanel();
    };

    window._rfSwitchTab = function (tab) {
        state.activeTab   = tab;
        state.searchText  = '';
        var searchEl = document.getElementById('rf-search');
        if (searchEl) searchEl.value = '';
        // Do NOT clear selections -- preserve cross-tab filter state
        applyFilter();
        buildPanel();
    };

    window._rfSetDirection = function (dir) {
        ts().direction = dir;
        applyFilter();
        buildPanel();
    };

    window._rfSetSort = function (col) {
        var cur = ts();
        if (cur.sortBy === col) {
            cur.sortDir = cur.sortDir === 'desc' ? 'asc' : 'desc';
        } else {
            cur.sortBy  = col;
            cur.sortDir = col === 'name' ? 'asc' : 'desc';
        }
        buildPanel();
    };

    window._rfSetAircraftCat = function (catId) {
        var cf = state.tabState.aircraft.catFilter;
        if (catId === 0) {
            cf.clear();
        } else if (cf.has(catId)) {
            cf.delete(catId);
        } else {
            cf.add(catId);
        }
        buildPanel();
    };

    window._rfSelectAircraftCat = function (catId) {
        var data = getAircraftData();
        data.aircraft.forEach(function (count, key) {
            var match = catId === 6 ? _militaryTypeKeys.has(key) : getAircraftCategory(key) === catId;
            if (match) state.tabState.aircraft.items.add(key);
        });
        applyFilter();
        buildPanel();
    };

    window._rfSetRegCountryFilter = function (val) {
        state.tabState.aircraft.regCountryFilter = val;
        applyFilter();
        buildPanel();
    };

    window._rfSetPanelScope = function (mode) {
        if (mode !== 'all' && mode !== 'inview' && mode !== 'filtered') mode = 'all';
        if (settings.hideAllScope && mode === 'all') mode = 'inview';
        _panelScope = mode;
        applyFilter();
        buildPanel();
    };

    window._rfCenterHome = function (useConfiguredZoom) {
        _rfCenterHome(!!useConfiguredZoom);
    };

    window._rfSetHideAllScope = function (on) {
        settings.hideAllScope = !!on;
        if (settings.hideAllScope && _panelScope === 'all') _panelScope = 'inview';
        saveSettings();
        applyFilter();
        buildPanel();
    };

    window._rfSetHomeOverride = function (on) {
        settings.homeOverride = !!on;
        saveSettings();
        buildPanel();
    };

    window._rfSetHomeValue = function (field, val) {
        if (field === 'lat') settings.homeLat = val;
        else if (field === 'lon') settings.homeLon = val;
        else if (field === 'zoom') settings.homeZoom = parseInt(val, 10) || 12;
        saveSettings();
    };

    window._rfUseDetectedHome = function () {
        var d = _rfDetectHomePos();
        if (!d) return;
        settings.homeOverride = true;
        settings.homeLat = d.lat.toFixed(5);
        settings.homeLon = d.lon.toFixed(5);
        saveSettings();
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
        saveSettings();
        buildPanel();
    };

    window._rfPickHomeFromMap = function () {
        var m = _rfOLMap();
        if (!m) return;
        // Cancel previous pick handler if still attached.
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
                saveSettings();
                if (state.panelOpen && state.activeTab === 'settings') buildPanel();
            }
            if (statusEl) statusEl.textContent = '';
            if (tgt && tgt.style) tgt.style.cursor = '';
            try { m.un('singleclick', _rfHomePickHandler); } catch (e) {}
            _rfHomePickHandler = null;
        };
        m.on('singleclick', _rfHomePickHandler);
    };

    window._rfExportPersist = function () {
        try {
            var snap = _rfBuildPersistSnapshot();
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
        } catch (e) {
            alert('Export failed: ' + e);
        }
    };

    window._rfImportPersistPick = function () {
        var inp = document.getElementById('rf-import-json');
        if (!inp) return;
        inp.value = '';
        inp.click();
    };

    window._rfImportPersistFile = function (input) {
        if (!input || !input.files || !input.files[0]) return;
        var file = input.files[0];
        var reader = new FileReader();
        reader.onload = function () {
            try {
                var snap = JSON.parse(String(reader.result || '{}'));
                if (!_rfApplyPersistSnapshot(snap)) throw new Error('Invalid snapshot');
                saveSettings();
                try { localStorage.setItem(TAB_VIS_KEY, JSON.stringify(_tabVisibility)); } catch (e) {}
                try { localStorage.setItem(SUMMARY_SETTINGS_KEY, JSON.stringify(_summarySettings)); } catch (e) {}
                try { localStorage.setItem(DIST_LS_KEY, JSON.stringify(_distanceLocations)); } catch (e) {}
                _rfPersistViews();
                _rfPersistDistFilter();
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

    window._rfResetPersist = function () {
        if (!confirm('Reset all saved RF data (home, distance, tabs, summary, cookies)?')) return;
        try { localStorage.removeItem(SETTINGS_KEY); } catch (e) {}
        try { localStorage.removeItem(HOME_KEY); } catch (e) {}
        try { localStorage.removeItem('rf_persist_snapshot_v1'); } catch (e) {}
        try { localStorage.removeItem(TAB_VIS_KEY); } catch (e) {}
        try { localStorage.removeItem(SUMMARY_SETTINGS_KEY); } catch (e) {}
        try { localStorage.removeItem(DIST_LS_KEY); } catch (e) {}
        try { localStorage.removeItem(DIST_ZONES_KEY); } catch (e) {}
        try { localStorage.removeItem(DIST_MODE_KEY); } catch (e) {}
        try { localStorage.removeItem(VIEWS_KEY); } catch (e) {}
        try { localStorage.removeItem(ALERTS_LS_KEY); } catch (e) {}
        try { document.cookie = HOME_COOKIE_KEY + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'; } catch (e) {}
        try { document.cookie = PERSIST_COOKIE_KEY + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'; } catch (e) {}

        settings.displayMode = 'sidebar';
        settings.sidebarSide = 'right';
        settings.useLocalDb = true;
        settings.routeKnownOnly = true;
        settings.hideAllScope = true;
        settings.homeOverride = false;
        settings.homeLat = '';
        settings.homeLon = '';
        settings.homeZoom = 12;

        Object.keys(_tabVisibility).forEach(function (k) { _tabVisibility[k] = true; });
        Object.keys(_summarySettings).forEach(function (k) { _summarySettings[k] = true; });
        _distanceLocations = [];
        _distanceZones = [];
        _distanceMode = 'inside';
        _savedViews = [];
        _activeViewId = '';

        _rfProbeStorage();
        applyPanelMode();
        applyFilter();
        buildPanel();
    };

    window._rfSetDisplayMode = function (mode) {
        settings.displayMode = mode;
        saveSettings();
        applyPanelMode();
        buildPanel();
    };

    window._rfSetSidebarSide = function (side) {
        settings.sidebarSide = side;
        saveSettings();
        applyPanelMode();
    };

    // ─────────────────────────────────────────────────────────────────────────
    // ── Local Database (airports / airlines / routes from external CSV sources)
    // ─────────────────────────────────────────────────────────────────────────

    // Minimal RFC 4180 CSV line parser
    function _dbParseLine(line) {
        var fields = [], cur = '', inQ = false;
        for (var i = 0; i < line.length; i++) {
            var c = line[i];
            if (c === '"') { inQ = !inQ; }
            else if (c === ',' && !inQ) { fields.push(cur); cur = ''; }
            else { cur += c; }
        }
        fields.push(cur);
        return fields;
    }

    function _dbNeedSync(tsKey) {
        try { return (Date.now() - parseInt(localStorage.getItem(tsKey) || '0', 10)) > DB_SYNC_MS; }
        catch(e) { return true; }
    }

    // ── Airports (OurAirports) ────────────────────────────────────────────────
    function _dbLoadAirports() {
        try {
            var raw = localStorage.getItem(DB_KEY_AIRPORTS);
            if (!raw) return;
            _localDb.airports = JSON.parse(raw);
            _localDb.st.airports.count = Object.keys(_localDb.airports).length;
            _localDb.st.airports.ts    = parseInt(localStorage.getItem(DB_KEY_AIRPORTS_TS) || '0', 10);
        } catch(e) { _localDb.airports = null; }
    }

    function _dbFetchAirports() {
        if (_localDb.st.airports.busy) return;
        _localDb.st.airports.busy = true;
        _localDb.st.airports.err  = null;
        if (state.panelOpen && state.activeTab === 'settings') buildPanel();
        fetch(DB_AIRPORTS_URL)
            .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
            .then(function(text) {
                // OurAirports columns: 0=id 1=ident 2=type 3=name 8=iso_country
                var lines = text.split('\n'), db = {};
                for (var i = 1; i < lines.length; i++) {
                    var f = _dbParseLine(lines[i]);
                    if (f.length < 9) continue;
                    var ident = f[1].trim(), type = f[2].trim();
                    if (ident.length !== 4) continue;
                    if (type === 'heliport' || type === 'closed') continue;
                    db[ident.toUpperCase()] = { n: f[3].trim(), c: f[8].trim() };
                }
                _localDb.airports = db;
                _localDb.st.airports.count = Object.keys(db).length;
                _localDb.st.airports.ts    = Date.now();
                try { localStorage.setItem(DB_KEY_AIRPORTS, JSON.stringify(db)); localStorage.setItem(DB_KEY_AIRPORTS_TS, String(Date.now())); } catch(e) {}
            })
            .catch(function(e) { _localDb.st.airports.err = e.message; })
            .finally(function() {
                _localDb.st.airports.busy = false;
                if (state.panelOpen && state.activeTab === 'settings') buildPanel();
            });
    }

    function _dbGetAirportName(icao) {
        if (!icao || !_localDb.airports) return null;
        var a = _localDb.airports[icao.toUpperCase()];
        return a ? a.n : null;
    }
    function _dbGetAirportIso2(icao) {
        if (!icao || !_localDb.airports) return null;
        var a = _localDb.airports[icao.toUpperCase()];
        return a ? a.c : null;
    }

    // ── Airlines (VRS Standing Data) ─────────────────────────────────────────
    function _dbLoadAirlines() {
        try {
            var raw = localStorage.getItem(DB_KEY_AIRLINES);
            if (!raw) return;
            _localDb.airlines = JSON.parse(raw);
            _localDb.st.airlines.count = Object.keys(_localDb.airlines).length;
            _localDb.st.airlines.ts    = parseInt(localStorage.getItem(DB_KEY_AIRLINES_TS) || '0', 10);
        } catch(e) { _localDb.airlines = null; }
    }

    function _dbFetchAirlines() {
        if (_localDb.st.airlines.busy) return;
        _localDb.st.airlines.busy = true;
        _localDb.st.airlines.err  = null;
        if (state.panelOpen && state.activeTab === 'settings') buildPanel();
        fetch(DB_AIRLINES_URL)
            .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
            .then(function(text) {
                // VRS airlines: 0=Code 1=Name 2=ICAO 3=IATA ...
                var lines = text.split('\n'), db = {};
                for (var i = 1; i < lines.length; i++) {
                    var f = _dbParseLine(lines[i]);
                    if (f.length < 2) continue;
                    var icaoCode = (f[2] || '').trim().toUpperCase();
                    var name     = (f[1] || '').trim();
                    if (icaoCode.length >= 2 && name) db[icaoCode] = name;
                }
                _localDb.airlines = db;
                _localDb.st.airlines.count = Object.keys(db).length;
                _localDb.st.airlines.ts    = Date.now();
                try { localStorage.setItem(DB_KEY_AIRLINES, JSON.stringify(db)); localStorage.setItem(DB_KEY_AIRLINES_TS, String(Date.now())); } catch(e) {}
            })
            .catch(function(e) { _localDb.st.airlines.err = e.message; })
            .finally(function() {
                _localDb.st.airlines.busy = false;
                if (state.panelOpen && state.activeTab === 'settings') buildPanel();
            });
    }

    // ── Routes (VRS Standing Data - lazy loaded per airline) ─────────────────
    function _dbFetchRoutesForAirline(airlineCode) {
        var code = airlineCode.toUpperCase();
        if (_localDb.routesFetched[code] || _localDb.routesFetching[code]) return;
        // Check localStorage cache first
        try {
            var cached = localStorage.getItem(DB_KEY_ROUTES_PFX + code);
            var cachedTs = parseInt(localStorage.getItem(DB_KEY_ROUTES_PFX + code + '_ts') || '0', 10);
            var missTs = parseInt(localStorage.getItem(DB_KEY_ROUTES_PFX + code + '_miss_ts') || '0', 10);
            // Negative cache: known missing route file, skip retries for sync window.
            if (missTs && (Date.now() - missTs) < DB_SYNC_MS) {
                _localDb.routesFetched[code] = true;
                return;
            }
            if (cached && (Date.now() - cachedTs) < DB_SYNC_MS) {
                Object.assign(_localDb.routes, JSON.parse(cached));
                _localDb.routesFetched[code] = true;
                if (state.panelOpen) buildPanel();
                return;
            }
        } catch(e) {}
        _localDb.routesFetching[code] = true;
        var url = DB_ROUTES_URL.replace('{P}', code[0]).replace('{CODE}', code);
        fetch(url)
            .then(function(r) { if (!r.ok) throw new Error(r.status); return r.text(); })
            .then(function(text) {
                // VRS routes: 0=Callsign 1=Code 2=Number 3=AirlineCode 4=AirportCodes
                var lines = text.split('\n'), routeMap = {};
                for (var i = 1; i < lines.length; i++) {
                    var f = _dbParseLine(lines[i]);
                    if (f.length < 5) continue;
                    var callsign = f[0].trim().toUpperCase();
                    var aps = f[4].trim().split('-');
                    if (aps.length >= 2 && callsign)
                        routeMap[callsign] = { dep: aps[0].toUpperCase(), arr: aps[aps.length - 1].toUpperCase() };
                }
                Object.assign(_localDb.routes, routeMap);
                _localDb.routesFetched[code] = true;
                try {
                    localStorage.setItem(DB_KEY_ROUTES_PFX + code, JSON.stringify(routeMap));
                    localStorage.setItem(DB_KEY_ROUTES_PFX + code + '_ts', String(Date.now()));
                    localStorage.removeItem(DB_KEY_ROUTES_PFX + code + '_miss_ts');
                } catch(e) {}
                if (state.panelOpen) buildPanel();
            })
            .catch(function() {
                _localDb.routesFetched[code] = true; // 404 = no routes, don't retry
                try { localStorage.setItem(DB_KEY_ROUTES_PFX + code + '_miss_ts', String(Date.now())); } catch(e) {}
            })
            .finally(function() { delete _localDb.routesFetching[code]; });
    }

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
                toIcao:      entry.arr,
            };
        }
        // Trigger lazy fetch for this airline (first 3 alpha chars of callsign)
        var prefix = cs.replace(/[^A-Z]/g, '').substring(0, 3);
        if (prefix.length === 3) {
            // Only fetch for known airline ICAO prefixes if airline DB is loaded.
            // This suppresses noisy 404s for GA/military/special prefixes.
            if (!settings.routeKnownOnly || !_localDb.airlines || _localDb.airlines[prefix]) _dbFetchRoutesForAirline(prefix);
        }
        return null;
    }

    // ── Sync helpers ──────────────────────────────────────────────────────────
    function _dbAutoSync() {
        if (!settings.useLocalDb) return;
        if (!_localDb.airports) _dbLoadAirports();
        if (!_localDb.airports || _dbNeedSync(DB_KEY_AIRPORTS_TS)) _dbFetchAirports();
        if (!_localDb.airlines) _dbLoadAirlines();
        if (!_localDb.airlines || _dbNeedSync(DB_KEY_AIRLINES_TS)) _dbFetchAirlines();
    }

    window._rfSetUseLocalDb = function(on) {
        settings.useLocalDb = !!on;
        saveSettings();
        if (settings.useLocalDb) _dbAutoSync();
        buildPanel();
    };
    window._rfSetRouteKnownOnly = function(on) {
        settings.routeKnownOnly = !!on;
        saveSettings();
        buildPanel();
    };
    window._rfDbSyncAirports = function() { _dbFetchAirports(); };
    window._rfDbSyncAirlines = function() { _dbFetchAirlines(); };
    window._rfDbClearRoutes  = function() {
        _localDb.routes = {};
        _localDb.routesFetched = {};
        try {
            var rem = [];
            for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.startsWith(DB_KEY_ROUTES_PFX)) rem.push(k); }
            rem.forEach(function(k) { localStorage.removeItem(k); });
        } catch(e) {}
        buildPanel();
    };

    // Returns status HTML for the settings panel Local Databases section
    function dbStatusHtml() {
        if (!settings.useLocalDb) return '';
        var ast = _localDb.st.airports, lst = _localDb.st.airlines;
        var rCount = Object.keys(_localDb.routes).length;
        var fmtTs = function(ts) { return ts ? new Date(ts).toLocaleString() : 'Never'; };
        function dbRow(label, url, st, syncFn) {
            var info = st.busy ? '<span style="color:#888">Downloading...</span>'
                : st.err ? '<span style="color:#f66">Error: ' + st.err + '</span>'
                : st.count ? st.count.toLocaleString() + ' entries'
                : 'Not downloaded';
            return '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:5px 0;border-bottom:1px solid #222">' +
                '<div style="flex:1;min-width:0">' +
                '<div style="font-size:11px;color:#ccc">' + label + '</div>' +
                '<div style="font-size:10px;color:#555;margin-top:1px"><a href="' + url + '" target="_blank" style="color:#555">' + url.replace('https://','').split('/').pop() + '</a></div>' +
                '<div style="font-size:10px;color:#666;margin-top:1px">' + info + ' &bull; Last sync: ' + fmtTs(st.ts) + '</div>' +
                '</div>' +
                (st.busy ? '' : '<button class="rf-clear" style="padding:2px 8px;font-size:10px;margin-left:8px;flex-shrink:0" onclick="' + syncFn + '">Sync</button>') +
                '</div>';
        }
        return '<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:4px;padding:6px 10px;margin-top:4px">' +
            dbRow('Airports', DB_AIRPORTS_URL, ast, 'window._rfDbSyncAirports()') +
            dbRow('Airlines', DB_AIRLINES_URL, lst, 'window._rfDbSyncAirlines()') +
            '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0">' +
            '<div><div style="font-size:11px;color:#ccc">Routes (lazy per-airline)</div>' +
            '<div style="font-size:10px;color:#666;margin-top:1px">' + rCount.toLocaleString() + ' routes cached &bull; fetched on demand</div></div>' +
            '<button class="rf-clear" style="padding:2px 8px;font-size:10px;margin-left:8px" onclick="window._rfDbClearRoutes()">Clear</button>' +
            '</div>' +
            '</div>';
    }

    // ─────────────────────────────────────────────────────────────────────────

    function saveSettings() {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify({
                displayMode: settings.displayMode,
                sidebarSide: settings.sidebarSide,
                useLocalDb:  settings.useLocalDb,
                routeKnownOnly: settings.routeKnownOnly,
                hideAllScope: settings.hideAllScope,
                homeOverride: settings.homeOverride,
                homeLat: settings.homeLat,
                homeLon: settings.homeLon,
                homeZoom: settings.homeZoom,
            }));
        } catch (e) {}
        try {
            // Also persist Home settings in a dedicated key so they survive
            // schema tweaks to the main settings payload.
            localStorage.setItem(HOME_KEY, JSON.stringify({
                homeOverride: settings.homeOverride,
                homeLat: settings.homeLat,
                homeLon: settings.homeLon,
                homeZoom: settings.homeZoom,
            }));
        } catch (e) {}
        try {
            // Dedicated home cookie backup: always tiny, so do not size-gate it.
            if (_rfCookieOk !== false) {
                _rfCookieSet(HOME_COOKIE_KEY, JSON.stringify({
                    homeOverride: settings.homeOverride,
                    homeLat: settings.homeLat,
                    homeLon: settings.homeLon,
                    homeZoom: settings.homeZoom,
                }), 365);
            }
        } catch (e) {}
        _rfSavePersistBackup();
    }

    function _rfCookieSet(name, value, days) {
        try {
            var exp = '';
            var maxAge = '';
            if (days) {
                var d = new Date();
                d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
                exp = '; expires=' + d.toUTCString();
                maxAge = '; max-age=' + String(days * 24 * 60 * 60);
            }
            // Try modern form first, then fallback minimal form.
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
        // Probe localStorage
        try {
            localStorage.setItem('__rf_probe_ls', '1');
            _rfLocalStorageOk = localStorage.getItem('__rf_probe_ls') === '1';
            localStorage.removeItem('__rf_probe_ls');
        } catch (e) {
            _rfLocalStorageOk = false;
        }
        // Probe cookies
        try {
            _rfCookieSet('__rf_probe_ck', '1', 1);
            _rfCookieOk = _rfCookieGet('__rf_probe_ck') === '1';
            // delete probe cookie
            document.cookie = '__rf_probe_ck=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
        } catch (e) {
            _rfCookieOk = false;
        }
    }

    function _rfBuildPersistSnapshot() {
        return {
            v: 1,
            savedAt: Date.now(),
            settings: {
                displayMode: settings.displayMode,
                sidebarSide: settings.sidebarSide,
                useLocalDb: settings.useLocalDb,
                routeKnownOnly: settings.routeKnownOnly,
                hideAllScope: settings.hideAllScope,
                homeOverride: settings.homeOverride,
                homeLat: settings.homeLat,
                homeLon: settings.homeLon,
                homeZoom: settings.homeZoom,
            },
            distance: {
                locations: _distanceLocations,
                zones: _distanceZones,
                mode: _distanceMode,
            },
            tabs: _tabVisibility,
            summary: _summarySettings,
            views: _savedViews,
        };
    }

    function _rfApplyPersistSnapshot(snap) {
        if (!snap || typeof snap !== 'object') return false;
        var s = snap.settings || {};
        if (s.displayMode === 'popup' || s.displayMode === 'sidebar') settings.displayMode = s.displayMode;
        if (s.sidebarSide === 'left' || s.sidebarSide === 'right') settings.sidebarSide = s.sidebarSide;
        if (typeof s.useLocalDb === 'boolean') settings.useLocalDb = s.useLocalDb;
        if (typeof s.routeKnownOnly === 'boolean') settings.routeKnownOnly = s.routeKnownOnly;
        if (typeof s.hideAllScope === 'boolean') settings.hideAllScope = s.hideAllScope;
        if (typeof s.homeOverride === 'boolean') settings.homeOverride = s.homeOverride;
        if (typeof s.homeLat === 'string' || typeof s.homeLat === 'number') settings.homeLat = String(s.homeLat);
        if (typeof s.homeLon === 'string' || typeof s.homeLon === 'number') settings.homeLon = String(s.homeLon);
        if (typeof s.homeZoom === 'number' || typeof s.homeZoom === 'string') settings.homeZoom = parseInt(s.homeZoom, 10) || 12;

        var d = snap.distance || {};
        if (Array.isArray(d.locations)) _distanceLocations = d.locations;
        if (Array.isArray(d.zones)) _distanceZones = d.zones;
        if (d.mode === 'inside' || d.mode === 'outside' || d.mode === 'maponly') _distanceMode = d.mode;

        var t = snap.tabs || {};
        Object.keys(_tabVisibility).forEach(function (k) {
            if (t.hasOwnProperty(k)) _tabVisibility[k] = !!t[k];
        });
        var ss = snap.summary || {};
        Object.keys(_summarySettings).forEach(function (k) {
            if (ss.hasOwnProperty(k)) _summarySettings[k] = !!ss[k];
        });
        if (Array.isArray(snap.views)) {
            _savedViews = snap.views;
            for (var vi = 0; vi < _savedViews.length; vi++) _rfEnsureViewShape(_savedViews[vi]);
        }
        return true;
    }

    function _rfSavePersistBackup() {
        var raw = '';
        try {
            var snap = _rfBuildPersistSnapshot();
            raw = JSON.stringify(snap);
        } catch (e) { return; }
        try {
            // localStorage copy (same-origin) for export/recover convenience
            localStorage.setItem('rf_persist_snapshot_v1', raw);
        } catch (e) {}
        try {
            // Cookie backup has tight size limits; keep best-effort.
            if (raw.length < 3500 && _rfCookieOk !== false) _rfCookieSet(PERSIST_COOKIE_KEY, raw, 365);
        } catch (e) {}
    }

    // ── Sidebar position helpers ──────────────────────────────────────────────

    // Position the RF panel flush to the right of tar1090's sidebar/infoblock.
    // Called on first open and by observers whenever the reference elements change.
    // The RF panel is NEVER hidden by this function - it always stays visible when open,
    // it just repositions as the tar1090 sidebars show, hide, or resize.
    function _rfPositionNextToSidebar() {
        if (settings.displayMode !== 'sidebar') return;
        var panel = document.getElementById('rf-panel');
        if (!panel || !state.panelOpen) return;

        panel.style.display = 'flex';

        var sidebarEl = document.getElementById('sidebar_container');
        var infoEl    = document.getElementById('selected_infoblock');
        var vw        = window.innerWidth;
        var panelW    = panel.offsetWidth || 400;

        // Build a list of candidate left-side reference elements.
        // Only count an element if it has real size AND its right edge leaves room
        // for the RF panel - this prevents a full-width overlay from pushing us off-screen.
        var leftPos = 0;
        [sidebarEl, infoEl].forEach(function(el) {
            if (!el) return;
            var r = el.getBoundingClientRect();
            // Must have visible size and not consume the whole viewport width
            if (r.width < 10 || r.height < 10) return;
            if (r.right > vw - 20) return; // element fills viewport - skip
            if (r.right > leftPos) leftPos = r.right;
        });

        var layoutEl  = document.getElementById('layout_container');
        var hdrEl     = document.getElementById('header_side');
        var topOffset = layoutEl ? layoutEl.getBoundingClientRect().top
                      : hdrEl   ? hdrEl.getBoundingClientRect().bottom
                      : 0;
        topOffset = Math.max(0, topOffset);

        // Clamp so panel always stays within the viewport
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
        if (settings.displayMode !== 'sidebar' || !state.panelOpen) {
            _rfClearMapInset();
            return;
        }
        var panel = document.getElementById('rf-panel');
        var el = _rfGetMapInsetElement();
        if (!panel || !el) return;

        if (!_rfMapInsetState || _rfMapInsetState.el !== el) {
            _rfMapInsetState = {
                el: el,
                marginLeft: el.style.marginLeft || '',
                marginRight: el.style.marginRight || '',
                width: el.style.width || ''
            };
        }

        var inset = Math.max(280, panel.offsetWidth || 400);
        var pr = panel.getBoundingClientRect();
        var panelOnLeft = ((pr.left + (pr.width / 2)) < (window.innerWidth / 2));
        if (panelOnLeft) {
            el.style.marginLeft = inset + 'px';
            el.style.marginRight = '';
        } else {
            el.style.marginLeft = '';
            el.style.marginRight = inset + 'px';
        }
        el.style.width = 'calc(100% - ' + inset + 'px)';
    }

    function _rfNudgeMainMapResize() {
        try {
            if (_rfMapResizeTimer) {
                clearTimeout(_rfMapResizeTimer);
                _rfMapResizeTimer = null;
            }
        } catch (e) {}

        function _doResize() {
            var m = _rfOLMap();
            if (m) {
                try { if (typeof m.updateSize === 'function') m.updateSize(); } catch (e1) {}
                try { if (typeof m.render === 'function') m.render(); } catch (e2) {}
                try { if (typeof m.renderSync === 'function') m.renderSync(); } catch (e3) {}
            }
            // Also emit window resize for any tar1090 listeners/layout hooks.
            try { window.dispatchEvent(new Event('resize')); } catch (e4) {}
        }

        _doResize();
        // Sidebar/info animations can settle a frame later; retry once after delay.
        _rfMapResizeTimer = setTimeout(function () {
            _rfMapResizeTimer = null;
            _doResize();
        }, 120);
    }

    function _rfAttachObservers() {
        _rfDetachObservers();
        var targets = ['sidebar_container', 'selected_infoblock', 'layout_container']
            .map(function(id) { return document.getElementById(id); })
            .filter(Boolean);
        var panel = document.getElementById('rf-panel');

        targets.forEach(function(el) {
            // Watch for size changes (sidebar resize handle dragging)
            if (window.ResizeObserver) {
                var ro = new ResizeObserver(_rfPositionNextToSidebar);
                ro.observe(el);
                _rfObservers.push(ro);
            }
            // Watch for style/class changes (show/hide)
            var opts = { attributes: true, attributeFilter: ['style', 'class'] };
            // Also watch layout_container for child additions/removals:
            // selected_infoblock may be added/removed from DOM rather than just shown/hidden
            if (el.id === 'layout_container') opts.childList = true;
            var mo = new MutationObserver(_rfPositionNextToSidebar);
            mo.observe(el, opts);
            _rfObservers.push(mo);
        });

        // Watch RF panel width changes from user resize drag.
        if (panel && window.ResizeObserver) {
            var pro = new ResizeObserver(function () {
                _rfPositionNextToSidebar();
                _rfNudgeMainMapResize();
            });
            pro.observe(panel);
            _rfObservers.push(pro);
        }

        // Reposition when the browser window is resized
        window.addEventListener('resize', _rfPositionNextToSidebar);
        _rfObservers.push({ disconnect: function() {
            window.removeEventListener('resize', _rfPositionNextToSidebar);
        }});
    }

    function applyPanelMode() {
        var panel = document.getElementById('rf-panel');
        if (!panel) return;
        panel.classList.remove('rf-sidebar', 'rf-sidebar-left', 'rf-sidebar-right');
        // Clear all inline positions set by drag or previous mode
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

    window._rfAlertsFilter = function () {
        var cmpgEl = document.getElementById('rf-al-cmpg');
        var catEl  = document.getElementById('rf-al-cat');
        var tagEl  = document.getElementById('rf-al-tag');
        if (cmpgEl) _alertsFilters.cmpg     = cmpgEl.value;
        if (catEl)  _alertsFilters.category  = catEl.value;
        if (tagEl)  _alertsFilters.tag       = tagEl.value;
        if (_alertsMapFilter) { buildAlertsMapFilterSet(); applyFilter(); }
        buildPanel();
    };

    // Clickable card badges: toggle cmpg/category/tag filter quickly.
    window._rfAlertsQuick = function (field, value) {
        if (!value) return;
        if (field === 'cmpg') _alertsFilters.cmpg = (_alertsFilters.cmpg === value ? '' : value);
        else if (field === 'category') _alertsFilters.category = (_alertsFilters.category === value ? '' : value);
        else if (field === 'tag') _alertsFilters.tag = (_alertsFilters.tag === value ? '' : value);
        if (_alertsMapFilter) { buildAlertsMapFilterSet(); applyFilter(); }
        buildPanel();
    };

    window._rfClearAlertsFacets = function () {
        _alertsFilters.cmpg = '';
        _alertsFilters.category = '';
        _alertsFilters.tag = '';
        if (_alertsMapFilter) { buildAlertsMapFilterSet(); applyFilter(); }
        buildPanel();
    };

    window._rfAlertsQuickIdx = function (idx) {
        var d = _alertsClickData[idx];
        if (!d || !d.type) return;
        window._rfAlertsQuick(d.type, d.value || '');
    };

    window._rfToggleAlertsMap = function (on) {
        _alertsMapFilter = !!on;
        buildAlertsMapFilterSet();
        applyFilter();
        buildPanel();
    };

    window._rfToggleAlert = function (elOrIcao) {
        var icao = '';
        if (typeof elOrIcao === 'string') icao = elOrIcao;
        else if (elOrIcao && elOrIcao.dataset) icao = elOrIcao.dataset.icao || '';
        icao = (icao || '').toUpperCase();
        if (!icao) return;
        if (_alertsSelectedIcaos.has(icao)) { _alertsSelectedIcaos.delete(icao); }
        else                                { _alertsSelectedIcaos.add(icao); }
        applyFilter();
        buildPanel();
    };

    window._rfAlertsToggleIdx = function (idx) {
        var d = _alertsClickData[idx];
        if (!d || d.type !== 'icao') return;
        window._rfToggleAlert(d.value || '');
    };

    window._rfClearAlerts = function () {
        _alertsSelectedIcaos.clear();
        applyFilter();
        buildPanel();
    };

    window._rfAlertsMi = function (icao) {
        _alertsMoreInfo = icao;
        buildPanel();
    };

    window._rfAlertsRefresh = function () {
        _alertsDb    = null;
        _alertsError = null;
        loadAlerts(true);
        buildPanel();
    };

    // Generic tab visibility handler -- used by settings checkboxes for all tabs
    window._rfSetTabVisible = function (tab, on) {
        _tabVisibility[tab] = !!on;
        var el = document.getElementById('rf-tab-' + tab);
        if (el) el.style.display = on ? '' : 'none';
        // Side effects
        if (tab === 'alerts' && on && !_alertsDb && !_alertsFetching) loadAlerts(false);
        if (tab === 'distance' && !on && _distanceZones.length > 0) {
            _distanceZones = [];
            applyFilter();
        }
        try { localStorage.setItem(TAB_VIS_KEY, JSON.stringify(_tabVisibility)); } catch (e) {}
        _rfSavePersistBackup();
        buildPanel();
    };

    window._rfViewsApplyFromSelect = function (id) {
        if (!id) return;
        window._rfViewsApply(id);
    };
    window._rfViewsQuickPick = function (id) {
        _rfQuickSelectedViewId = id || '';
    };
    window._rfViewsApplyQuick = function () {
        if (!_rfQuickSelectedViewId) return;
        window._rfViewsApply(_rfQuickSelectedViewId);
        window._rfToggleViewQuickMenu(false);
    };
    window._rfToggleViewQuickMenu = function (force) {
        var menu = document.getElementById('rf-view-quick-menu');
        var btn = document.getElementById('rf-view-quick-btn');
        if (!menu || !btn) return;
        var show = (typeof force === 'boolean') ? force : (menu.style.display !== 'block');
        menu.style.display = show ? 'block' : 'none';
        btn.className = 'rf-view-quick-btn' + (show ? ' rf-view-quick-btn-active' : '');
        if (show) _rfRenderViewQuickMenu();
    };

    window._rfViewsApply = function (id) {
        var v = _rfFindViewById(id);
        if (!v) return;
        _rfEnsureViewShape(v);
        if (!_rfApplyViewState(v.state || {})) return;
        _activeViewId = id;
        // "yes sounds good": switch to Summary when applying a view
        state.activeTab = 'summary';
        applyFilter();
        buildPanel();
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
        _rfPersistViews();
        _rfRenderScopeHeader();
        buildPanel();
    };

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
            _activeViewId = existing.id;
        } else {
            var id = 'view_' + now + '_' + Math.random().toString(36).slice(2, 8);
            var mapCfg = _rfDefaultViewMap();
            if (mNow) {
                mapCfg.fixedCenterLat = mNow.lat;
                mapCfg.fixedCenterLon = mNow.lon;
                mapCfg.fixedZoom = mNow.zoom;
            }
            _savedViews.push({ id: id, name: name, state: stateSnap, map: mapCfg, createdAt: now, updatedAt: now });
            _activeViewId = id;
        }
        _rfPersistViews();
        _rfRenderScopeHeader();
        if (state.activeTab === 'views') buildPanel();
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
        if (_activeViewId === id) _activeViewId = '';
        _rfPersistViews();
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
        _rfPersistViews();
        if (_activeViewId === id) _rfApplyMapBehaviorConfig(v.map, true);
        if (state.activeTab === 'views') buildPanel();
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
        _rfPersistViews();
        if (_activeViewId === id) _rfApplyMapBehaviorConfig(v.map, true);
        if (state.activeTab === 'views') buildPanel();
    };

    window._rfViewsSetMapToggle = function (id, key, on) {
        var v = _rfFindViewById(id);
        if (!v) return;
        _rfEnsureViewShape(v);
        if (key !== 'autoCenter' && key !== 'autoZoom') return;
        v.map[key] = !!on;
        v.updatedAt = Date.now();
        _rfPersistViews();
        if (_activeViewId === id) _rfApplyMapBehaviorConfig(v.map, true);
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
        _rfPersistViews();
        if (state.activeTab === 'views') buildPanel();
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
            if (n < 2) n = 2;
            if (n > 19) n = 19;
            v.map.fixedZoom = n;
        } else {
            return;
        }
        v.updatedAt = Date.now();
        _rfPersistViews();
    };

    // Keep old names as aliases for backwards compat (settings HTML used them before)
    window._rfSetAlertsEnabled   = function (on) { window._rfSetTabVisible('alerts',   on); };
    window._rfSetDistanceEnabled = function (on) { window._rfSetTabVisible('distance', on); };

    // Summary section visibility toggle
    window._rfSetSummarySection = function (section, on) {
        _summarySettings[section] = !!on;
        try { localStorage.setItem(SUMMARY_SETTINGS_KEY, JSON.stringify(_summarySettings)); } catch (e) {}
        _rfSavePersistBackup();
        if (state.activeTab === 'summary') buildPanel();
    };

    // Summary quick-filter handlers
    window._rfSumFilterIcao = function (icao) {
        icao = (icao || '').toUpperCase();
        var adding = !_sumFilter.has(icao);
        console.info('[RF] summary click single', icao, 'adding=', adding);
        if (adding) {
            _rfSaveMapView();
            _sumFilter.add(icao);
        } else {
            _sumFilter.delete(icao);
            _rfClearSelectedAircraftInTar1090();
            if (_sumFilter.size === 0) _rfRestoreMapView();
        }
        applyFilter();
        buildPanel();
        if (adding) _rfPanToIcaos([icao]);
    };

    // Primary handler for group filters: index into _sumClickData (avoids JSON-in-onclick).
    window._rfSumFilterIdx = function (idx) {
        var icaos = (_sumClickData[idx] || []);
        console.info('[RF] summary click group idx=', idx, 'count=', icaos.length);
        _sumFilter.clear();
        if (icaos.length) {
            _rfSaveMapView();
            icaos.forEach(function(ic){ _sumFilter.add((ic || '').toUpperCase()); });
        } else {
            _rfClearSelectedAircraftInTar1090();
            _rfRestoreMapView();
        }
        applyFilter();
        buildPanel();
        if (icaos.length) _rfPanToIcaos(icaos);
    };

    // Kept for any external callers; now also handles save/pan.
    window._rfSumFilterSet = function (icaos) {
        _sumFilter.clear();
        if (icaos && icaos.length) {
            _rfSaveMapView();
            icaos.forEach(function(ic){ _sumFilter.add((ic || '').toUpperCase()); });
            _rfPanToIcaos(icaos);
        } else {
            _rfClearSelectedAircraftInTar1090();
            _rfRestoreMapView();
        }
        applyFilter();
        buildPanel();
    };

    window._rfClearSumFilter = function () {
        _sumFilter.clear();
        _rfClearSelectedAircraftInTar1090();
        _rfRestoreMapView();
        applyFilter();
        buildPanel();
    };

    // Legacy scope handlers removed. Scope is now controlled only via _rfSetPanelScope.

    // ── Distance tab handlers ─────────────────────────────────────────────────

    // Safely get tar1090's OL map instance.
    // tar1090 stores it as `OLMap` (let-declared in script.js, shared global scope).
    // `g.map` does NOT exist — never use it.
    function _rfOLMap() {
        // Primary: OLMap is a let-global in script.js; all non-module scripts
        // share the same global lexical environment in browsers.
        try { if (typeof OLMap !== 'undefined' && OLMap && OLMap.getView) return OLMap; } catch(e) {}
        // Fallback: scan window for any ol.Map instance (catches var-declared maps)
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

    // ── Map view save / restore / pan helpers ────────────────────────────────
    // Called before any filter-driven auto-pan; only saves once per filter session.
    function _rfSaveMapView() {
        if (_mapViewSaved) return;
        var m = _rfOLMap();
        if (!m) return;
        var v = m.getView();
        _mapViewSaved = { center: v.getCenter().slice(), zoom: v.getZoom() };
    }

    // Animates back to the saved view and clears the snapshot.
    function _rfRestoreMapView() {
        if (!_mapViewSaved) return;
        var m = _rfOLMap();
        if (m) m.getView().animate({ center: _mapViewSaved.center, zoom: _mapViewSaved.zoom, duration: 600 });
        _mapViewSaved = null;
    }

    // Convert lon/lat to map projection across OL builds.
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

    function _rfClearSelectedAircraftInTar1090() {
        try { if (typeof selectPlaneByHex === 'function') { selectPlaneByHex(null); } } catch (e) {}
        try { if (typeof selectPlaneByHex === 'function') { selectPlaneByHex(''); } } catch (e) {}
        try { if (typeof selectPlaneByICAO === 'function') { selectPlaneByICAO(null); } } catch (e) {}
        try { if (typeof selectPlaneByIcao === 'function') { selectPlaneByIcao(null); } } catch (e) {}
        try { if (typeof setSelectedPlane === 'function') { setSelectedPlane(null); } } catch (e) {}
        try { if (typeof setSelectedIcao === 'function') { setSelectedIcao(null); } } catch (e) {}
        try { if (typeof selectPlane === 'function') { selectPlane(null); } } catch (e) {}
        try { if (window && typeof window.selectPlaneByHex === 'function') { window.selectPlaneByHex(null); } } catch (e) {}
        try { if (window && typeof window.selectPlaneByICAO === 'function') { window.selectPlaneByICAO(null); } } catch (e) {}
        try { if (window && typeof window.selectPlaneByIcao === 'function') { window.selectPlaneByIcao(null); } } catch (e) {}
        try { if (window && typeof window.setSelectedPlane === 'function') { window.setSelectedPlane(null); } } catch (e) {}
        try { if (window && typeof window.setSelectedIcao === 'function') { window.setSelectedIcao(null); } } catch (e) {}
        try { if (window && typeof window.selectPlane === 'function') { window.selectPlane(null); } } catch (e) {}
        try { if (typeof SelectedPlane !== 'undefined') SelectedPlane = null; } catch (e) {}
        try { if (typeof selectedPlane !== 'undefined') selectedPlane = null; } catch (e) {}
        try { if (window && window.hasOwnProperty('SelectedPlane')) window.SelectedPlane = null; } catch (e) {}
        try { if (window && window.hasOwnProperty('selectedPlane')) window.selectedPlane = null; } catch (e) {}
        try { if (typeof refreshSelected === 'function') refreshSelected(); } catch (e) {}
        try { if (typeof refreshSelectedPlane === 'function') refreshSelectedPlane(); } catch (e) {}
        try { if (window && typeof window.refreshSelected === 'function') window.refreshSelected(); } catch (e) {}
        try { if (window && typeof window.refreshSelectedPlane === 'function') window.refreshSelectedPlane(); } catch (e) {}
        // Fallback: if infobox is still open, click a close control to untoggle
        // tar1090's selected-aircraft info state.
        try {
            var ib = document.getElementById('selected_infoblock');
            if (ib) {
                var closeBtn = ib.querySelector('.close, .closeButton, .infoblockClose, .btn-close, button[title*="Close"], button[aria-label*="Close"]');
                if (!closeBtn) {
                    var btns = ib.querySelectorAll('button');
                    for (var bi = 0; bi < btns.length; bi++) {
                        var t = ((btns[bi].textContent || '') + '').trim();
                        if (t === '×' || t === '✕' || t === '✖' || t === 'X') { closeBtn = btns[bi]; break; }
                    }
                }
                if (closeBtn) closeBtn.click();
            }
        } catch (e) {}
    }

    // Resolve plane coordinates robustly (supports [lon,lat] and [lat,lon]).
    function _rfPlaneLatLon(plane) {
        if (!plane) return null;
        if (plane.position && plane.position.length >= 2) {
            var a = +plane.position[0], b = +plane.position[1];
            // tar1090 normal convention is [lon, lat]
            if (!isNaN(a) && !isNaN(b) && Math.abs(a) <= 180 && Math.abs(b) <= 90) return { lat: b, lon: a };
            // fallback in case source provides [lat, lon]
            if (!isNaN(a) && !isNaN(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180) return { lat: a, lon: b };
        }
        var lat = +plane.lat, lon = +plane.lon;
        if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat: lat, lon: lon };
        return null;
    }

    // Pan / fit the OL map to show the given array of ICAOs at their current positions.
    function _rfPanToIcaos(icaos) {
        if (!icaos || !icaos.length) return;
        var m = _rfOLMap();
        if (!m || !g || !g.planesOrdered) { console.warn('[RF] pan skip: map/planes unavailable'); return; }
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
        if (!pts.length) { console.warn('[RF] pan skip: no matching positions for', icaos.length, 'icaos'); return; }
        var view = m.getView();
        if (!view) { console.warn('[RF] pan skip: no map view'); return; }
        if (pts.length === 1) {
            view.animate({ center: pts[0], zoom: Math.max(view.getZoom(), 10), duration: 600 });
        } else {
            // Avoid relying on ol.extent being present in all builds.
            var minX = pts[0][0], minY = pts[0][1], maxX = pts[0][0], maxY = pts[0][1];
            for (var ei = 1; ei < pts.length; ei++) {
                if (pts[ei][0] < minX) minX = pts[ei][0];
                if (pts[ei][1] < minY) minY = pts[ei][1];
                if (pts[ei][0] > maxX) maxX = pts[ei][0];
                if (pts[ei][1] > maxY) maxY = pts[ei][1];
            }
            view.fit([minX, minY, maxX, maxY], { padding: [60, 60, 60, 60], maxZoom: 11, duration: 600 });
        }
        console.info('[RF] pan applied to', pts.length, 'aircraft');
    }

    // Save/restore helpers for global auto-fit (all tabs).
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
        if (m && m.getView) m.getView().animate({ center: _autoFitSavedView.center, zoom: _autoFitSavedView.zoom, duration: 700 });
        _autoFitSavedView = null;
    }

    // Fit current map to all aircraft that pass the active cross-tab filters.
    function _rfAutoFitFilteredPlanes(opts) {
        opts = opts || {};
        var doCenter = opts.autoCenter !== false;
        var doZoom = opts.autoZoom !== false;
        var m = _rfOLMap();
        if (!m || !m.getView || !gReady()) return;
        if (!doCenter && !doZoom) return;
        if (!isFilterActive()) {
            _rfRestoreAutoFitView();
            return;
        }
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
            if (doZoom) oneOpts.zoom = Math.max(view.getZoom(), 10);
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
        var cx = (minX + maxX) / 2;
        var cy = (minY + maxY) / 2;
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

    function _rfGetReceiverPos() {
        try {
            var m = _rfOLMap();
            if (!m) throw new Error('no map');
            var c = m.getView().getCenter();
            if (window.ol && ol.proj && ol.proj.toLonLat) {
                var ll = ol.proj.toLonLat(c);
                // Sanity-check: valid lat/lon (not projected meter values)
                if (!isNaN(ll[1]) && Math.abs(ll[1]) <= 90 && Math.abs(ll[0]) <= 180) {
                    return { lat: ll[1], lon: ll[0] };
                }
            }
            // Do NOT fall through with raw projected coords — they would be
            // in metres (EPSG:3857) and useless as lat/lon degrees.
        } catch(e) {}
        try { if (typeof SiteLat !== 'undefined' && SiteLat) return { lat: +SiteLat, lon: +SiteLon }; } catch(e) {}
        try { if (typeof g !== 'undefined' && g.SitePosition && g.SitePosition.lat) return { lat: g.SitePosition.lat, lon: g.SitePosition.lng }; } catch(e) {}
        return { lat: 53.07, lon: -0.77 };
    }

    function _rfLoadLeaflet(cb) {
        if (window.L && _leafletReady) { cb(); return; }
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
        var s = document.createElement('script');
        s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        s.onload = function() {
            _leafletReady = true;
            // Fix icon paths so marker images load from CDN
            if (window.L && L.Icon && L.Icon.Default) {
                delete L.Icon.Default.prototype._getIconUrl;
                L.Icon.Default.mergeOptions({
                    iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                    shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                });
            }
            cb();
        };
        document.head.appendChild(s);
    }

    function _rfInitDistMap() {
        if (!_leafletReady) {
            _rfLoadLeaflet(function() { _rfInitDistMap(); });
            return;
        }
        var container = document.getElementById('rf-dist-map');
        if (!container) return;

        // Preserve zoom level across panel auto-refreshes
        var savedZoom = _distanceForm.mapZoom || 8;

        // Destroy stale map if container was recreated
        if (_distMap) {
            savedZoom = _distMap.getZoom();
            _distanceForm.mapZoom = savedZoom;
            try { _distMap.remove(); } catch(e) {}
            _distMap = null; _distMapMarker = null; _distMapCircle = null;
        }

        // Starting centre: use saved form values or receiver position
        var lat = parseFloat(_distanceForm.lat);
        var lon = parseFloat(_distanceForm.lon);
        if (isNaN(lat) || isNaN(lon)) {
            var rp = _rfGetReceiverPos();
            lat = rp.lat; lon = rp.lon;
        }

        _distMap = L.map(container, {
            zoomControl:       true,
            attributionControl: false,
            scrollWheelZoom:   true,
        }).setView([lat, lon], savedZoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            subdomains: 'abc',
        }).addTo(_distMap);

        // Place marker + circle if we have valid coords
        if (!isNaN(parseFloat(_distanceForm.lat))) {
            _rfUpdateDistMapPin(lat, lon);
        }

        // Click → set centre point
        _distMap.on('click', function(e) {
            var clat = e.latlng.lat;
            var clon = e.latlng.lng;
            _distanceForm.lat = clat.toFixed(5);
            _distanceForm.lon = clon.toFixed(5);
            _rfUpdateDistMapPin(clat, clon);
            // Update coordinate display
            var coordEl = document.getElementById('rf-dist-coords');
            if (coordEl) coordEl.textContent = clat.toFixed(5) + ', ' + clon.toFixed(5);
        });
    }

    function _rfUpdateDistMapPin(lat, lon) {
        if (!_distMap) return;
        var radiusNm = parseFloat(_distanceForm.radiusNm) || 50;
        var radiusM  = radiusNm * 1852;

        if (_distMapMarker) {
            _distMapMarker.setLatLng([lat, lon]);
        } else {
            _distMapMarker = L.circleMarker([lat, lon], {
                radius:      7,
                color:       '#fff',
                fillColor:   '#00596b',
                fillOpacity: 1,
                weight:      2,
            }).addTo(_distMap);
        }

        if (_distMapCircle) {
            _distMapCircle.setLatLng([lat, lon]);
            _distMapCircle.setRadius(radiusM);
        } else {
            _distMapCircle = L.circle([lat, lon], {
                radius:      radiusM,
                color:       '#00596b',
                fillColor:   '#00596b',
                fillOpacity: 0.08,
                weight:      2,
            }).addTo(_distMap);
        }
    }

    function _rfPersistDistFilter() {
        try {
            if (_distanceZones.length > 0) {
                localStorage.setItem(DIST_ZONES_KEY, JSON.stringify(_distanceZones));
            } else {
                localStorage.removeItem(DIST_ZONES_KEY);
            }
            localStorage.setItem(DIST_MODE_KEY, _distanceMode);
            _rfSavePersistBackup();
        } catch(e) {}
    }

    // ── Main-map OL overlay (distance rings) ─────────────────────────────────
    // Build a geodesic ring geometry in EPSG:3857 (same technique as tar1090 range rings)
    function _rfGeodesicPoly(lat, lon, radiusM, npts) {
        // TAR is a let-global in script.js — use typeof, NOT window.TAR
        try {
            if (typeof TAR !== 'undefined' && TAR.utils &&
                typeof TAR.utils.make_geodesic_circle === 'function') {
                var g2 = TAR.utils.make_geodesic_circle([lon, lat], radiusM, npts);
                g2.transform('EPSG:4326', 'EPSG:3857');
                return g2;
            }
        } catch (e) {}
        // Fallback: sample the circle in WGS84, project each point to EPSG:3857.
        // Use LineString (ol.geom.Polygon may not exist in this OL build).
        var R  = 6371008.8;
        var d  = radiusM / R;
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
        // ol.geom.LineString is confirmed present in this OL build
        return new ol.geom.LineString(pts);
    }

    var ZONE_COLORS_OL   = ['#00c8e6','#f0e040','#e040fb','#69f080','#ff9800','#ff4444'];
    var ZONE_FILLS_OL    = [
        'rgba(0,200,230,0.05)','rgba(240,224,64,0.05)','rgba(224,64,251,0.05)',
        'rgba(105,240,128,0.05)','rgba(255,152,0,0.05)','rgba(255,68,68,0.05)',
    ];

    // Build zone features and add them to `src`, tagging each with _rfDist=true
    function _rfBuildZoneFeatures(src) {
        _distanceZones.forEach(function(zone, i) {
            var color   = ZONE_COLORS_OL[i % ZONE_COLORS_OL.length];
            var fill    = ZONE_FILLS_OL [i % ZONE_FILLS_OL.length];
            var radiusM = zone.radiusNm * 1852;
            var center  = ol.proj.fromLonLat([zone.lon, zone.lat]);

            var ringGeom = _rfGeodesicPoly(zone.lat, zone.lon, radiusM, 90);
            var ringFeat = new ol.Feature({ geometry: ringGeom });
            ringFeat.set('_rfDist', true);
            ringFeat.setStyle(new ol.style.Style({
                stroke: new ol.style.Stroke({ color: color, width: 2, lineDash: [10, 5] }),
                fill:   new ol.style.Fill  ({ color: fill }),
            }));

            var dotFeat = new ol.Feature({ geometry: new ol.geom.Point(center) });
            dotFeat.set('_rfDist', true);
            dotFeat.setStyle(new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 5,
                    fill:   new ol.style.Fill  ({ color: color }),
                    stroke: new ol.style.Stroke({ color: '#fff', width: 1.5 }),
                }),
            }));

            var lbl = zone.name.replace(/&amp;/g, '&') + '\n' + zone.radiusNm + ' NM';
            var lblFeat = new ol.Feature({ geometry: new ol.geom.Point(center) });
            lblFeat.set('_rfDist', true);
            lblFeat.setStyle(new ol.style.Style({
                text: new ol.style.Text({
                    text:      lbl,
                    font:      'bold 12px sans-serif',
                    fill:      new ol.style.Fill  ({ color: '#fff' }),
                    stroke:    new ol.style.Stroke({ color: 'rgba(0,0,0,0.75)', width: 3 }),
                    offsetY:   20,
                    textAlign: 'center',
                }),
            }));

            src.addFeatures([ringFeat, dotFeat, lblFeat]);
        });
    }

    // Remove all _rfDist-tagged features from a source
    function _rfRemoveDistFeatures(src) {
        try {
            var rem = src.getFeatures().filter(function(f) { return f.get('_rfDist'); });
            rem.forEach(function(f) { src.removeFeature(f); });
        } catch(e) {}
    }

    function _rfDrawDistOnMainMap() {
        if (_distanceZones.length === 0) { _rfClearDistOnMainMap(); return; }
        try {
            if (!window.ol || !gReady()) return;

            var src = null; // the ol.source.Vector we will add features to

            // ── Path A: our own dedicated layer ──────────────────────────────
            if (!_distOLSource) {
                _distOLSource = new ol.source.Vector({ wrapX: false });
                _distOLLayer  = new ol.layer.Vector({
                    source: _distOLSource, zIndex: 9999, renderOrder: null,
                });
                var added = false;
                // Try tar1090's layer collection (let-global `layers` from script.js)
                try {
                    if (typeof layers !== 'undefined' && layers &&
                        typeof layers.push === 'function') {
                        layers.push(_distOLLayer);
                        added = true;
                        console.log('[RF] dist overlay: added via layers.push');
                    }
                } catch(e1) { console.warn('[RF] layers.push failed:', e1); }
                // Try OLMap.addLayer()
                if (!added) {
                    try {
                        var m = _rfOLMap();
                        if (m) { m.addLayer(_distOLLayer); added = true; console.log('[RF] dist overlay: added via OLMap.addLayer'); }
                    } catch(e2) { console.warn('[RF] OLMap.addLayer failed:', e2); }
                }
                if (!added) {
                    // Can't add our layer — abandon it
                    console.warn('[RF] dist overlay: could not add layer, will use siteCircleFeatures fallback');
                    _distOLSource = null; _distOLLayer = null;
                }
            }

            if (_distOLSource) {
                _distOLSource.clear();
                src = _distOLSource;
            }

            // ── Path B: siteCircleFeatures fallback ──────────────────────────
            // siteCircleFeatures is a let-global in script.js; it is already
            // attached to siteCircleLayer which is always on the map.
            if (!src) {
                try {
                    if (typeof siteCircleFeatures !== 'undefined' && siteCircleFeatures) {
                        _rfRemoveDistFeatures(siteCircleFeatures);
                        src = siteCircleFeatures;
                        console.log('[RF] dist overlay: using siteCircleFeatures fallback');
                    }
                } catch(e3) { console.warn('[RF] siteCircleFeatures fallback failed:', e3); }
            }

            if (!src) { console.warn('[RF] dist overlay: no source available, giving up'); return; }

            _rfBuildZoneFeatures(src);

            // Force a render pass
            try { var m2 = _rfOLMap(); if (m2) m2.render(); } catch(e) {}

        } catch(e) { console.warn('[RF] dist OL overlay error:', e, e.stack); }
    }

    function _rfClearDistOnMainMap() {
        // Clear from our dedicated source
        try { if (_distOLSource) _distOLSource.clear(); } catch(e) {}
        // Clear from siteCircleFeatures fallback
        try {
            if (typeof siteCircleFeatures !== 'undefined' && siteCircleFeatures) {
                _rfRemoveDistFeatures(siteCircleFeatures);
            }
        } catch(e) {}
    }

    window._rfPanToDistZone = function () {
        try {
            var map = _rfOLMap();
            if (_distanceZones.length === 0 || !gReady() || !map || !window.ol) return;
            // Compute bounding extent covering all active zones
            var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            _distanceZones.forEach(function(zone) {
                var c = ol.proj.fromLonLat([zone.lon, zone.lat]);
                var r = zone.radiusNm * 1852 * 1.35;
                if (c[0] - r < minX) minX = c[0] - r;
                if (c[1] - r < minY) minY = c[1] - r;
                if (c[0] + r > maxX) maxX = c[0] + r;
                if (c[1] + r > maxY) maxY = c[1] + r;
            });
            map.getView().fit([minX, minY, maxX, maxY], { duration: 600, padding: [30, 30, 30, 30] });
        } catch(e) {}
    };

    window._rfDistRadiusChanged = function(val) {
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

    // Called by oninput on every form field -- keeps _distanceForm in sync without re-rendering
    window._rfDistFormUpdate = function (field, value) {
        _distanceForm[field] = value;
    };

    // Load a saved location into the edit form (doesn't activate it)
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

    // Toggle a saved location on/off in the active zones list
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
        _rfPersistDistFilter();
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
        try { localStorage.setItem(DIST_LS_KEY, JSON.stringify(_distanceLocations)); } catch (e) {}
        _rfSavePersistBackup();
        // Add or update in active zones
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
        _rfPersistDistFilter();
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
        try { localStorage.setItem(DIST_LS_KEY, JSON.stringify(_distanceLocations)); } catch (e) {}
        _rfSavePersistBackup();
        // Also remove from active zones if it was active
        _distanceZones = _distanceZones.filter(function(z) { return z.name !== locName; });
        _rfPersistDistFilter();
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
        try { localStorage.setItem(DIST_MODE_KEY, _distanceMode); } catch(e) {}
        applyFilter();
        buildPanel();
    };

    window._rfDistApply = function () {
        // Read radius and alt from DOM (still input fields), rest comes from _distanceForm
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
        // Replace existing zone with same name, or push a new one
        var existingApplyIdx = -1;
        for (var k = 0; k < _distanceZones.length; k++) {
            if (_distanceZones[k].name === zoneName) { existingApplyIdx = k; break; }
        }
        if (existingApplyIdx >= 0) _distanceZones[existingApplyIdx] = newZone;
        else _distanceZones.push(newZone);
        _rfPersistDistFilter();
        applyFilter();
        buildPanel();
    };

    window._rfDistClear = function () {
        _distanceZones = [];
        _rfPersistDistFilter();
        applyFilter();
        buildPanel();
    };

    window._rfDistRemoveZone = function (idx) {
        _distanceZones.splice(idx, 1);
        _rfPersistDistFilter();
        applyFilter();
        buildPanel();
    };

    window._rfClearTab = function (tab) {
        state.tabState[tab].items.clear();
        if (tab === 'aircraft') {
            state.tabState.aircraft.catFilter.clear();
            state.tabState.aircraft.regCountryFilter = '';
        }
        applyFilter();
        buildPanel();
    };

    window._rfClear = function () {
        Object.values(state.tabState).forEach(function (s) { s.items.clear(); });
        state.tabState.aircraft.catFilter.clear();
        state.tabState.aircraft.regCountryFilter = '';
        _alertsMapFilter      = false;
        _alertsMapFilterIcaos = null;
        _alertsSelectedIcaos.clear();
        _distanceZones = [];
        _sumFilter.clear();
        _rfRestoreMapView();
        applyFilter();
        buildPanel();
    };

    window._rfOnSearch = function (val) {
        state.searchText = val;
        buildPanel();
    };

    window._rfClosePanel = function () {
        state.panelOpen = false;
        var panel = document.getElementById('rf-panel');
        if (panel) panel.style.display = 'none';
        _rfClearMapInset();
        if (settings.displayMode === 'sidebar') _rfNudgeMainMapResize();
    };

    // ── Toggle panel ──────────────────────────────────────────────────────────
    function togglePanel() {
        state.panelOpen = !state.panelOpen;
        var panel = document.getElementById('rf-panel');
        if (!panel) return;
        panel.style.display = state.panelOpen ? 'flex' : 'none';
        if (state.panelOpen) {
            applyPanelMode();
            buildPanel();
            if (!_rfDidInitialHomeCenter) {
                _rfCenterHome(true);
                _rfDidInitialHomeCenter = true;
            }
            if (settings.displayMode === 'sidebar') _rfNudgeMainMapResize();
        } else {
            _rfClearMapInset();
            if (settings.displayMode === 'sidebar') _rfNudgeMainMapResize();
        }
    }

    // ── Drag support ──────────────────────────────────────────────────────────
    function makeDraggable(panel, handle) {
        var startX, startY, startLeft, startTop;
        handle.addEventListener('mousedown', function (e) {
            if (settings.displayMode === 'sidebar') return;
            if (e.target.classList.contains('rf-close')) return;
            startX    = e.clientX;
            startY    = e.clientY;
            startLeft = panel.offsetLeft;
            startTop  = panel.offsetTop;
            function onMove(e) {
                panel.style.right = 'auto';
                panel.style.left  = (startLeft + e.clientX - startX) + 'px';
                panel.style.top   = (startTop  + e.clientY - startY) + 'px';
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

    // ── DOM injection ─────────────────────────────────────────────────────────
    function _rfIsEditingInputs() {
        if (!state.panelOpen) return false;
        var ae = document.activeElement;
        if (!ae) return false;
        var tag = (ae.tagName || '').toUpperCase();
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return false;
        var panel = document.getElementById('rf-panel');
        return !!(panel && panel.contains(ae));
    }

    function inject() {
        var headerSide = document.getElementById('header_side');
        if (!headerSide || document.getElementById('rf-btn')) return;
        _rfProbeStorage();

        var btnContainer = headerSide.querySelector('.buttonContainer') || headerSide;

        var spacer = document.createElement('div');
        spacer.className = 'buttonSpacer';

        var btn = document.createElement('div');
        btn.id        = 'rf-btn';
        btn.title     = 'Robs Filters - Filter by Route / Airport / Country / Operator / Type';
        btn.className = 'button inActiveButton';
        btn.onclick   = togglePanel;
        btn.innerHTML = '<span class="buttonText" style="font-size:9px;letter-spacing:-0.5px">RF</span>';

        btnContainer.appendChild(spacer);
        btnContainer.appendChild(btn);

        var panel = document.createElement('div');
        panel.id = 'rf-panel';
        panel.style.display = 'none';
        panel.innerHTML = [
            '<div class="rf-header" id="rf-drag-handle">',
            '  <span>Robs Filters</span>',
            '  <div class="rf-header-actions">',
            '    <button class="rf-resize-handle" id="rf-resize-handle" title="Resize sidebar panel" aria-label="Resize sidebar panel">&#8644;</button>',
            '    <button class="rf-view-quick-btn" id="rf-view-quick-btn" title="Views quick menu" aria-label="Views quick menu" onclick="event.stopPropagation();window._rfToggleViewQuickMenu()">&#128065;</button>',
            '    <button class="rf-close" onclick="window._rfClosePanel()">&#x2715;</button>',
            '  </div>',
            '</div>',
            '<div id="rf-view-quick-menu" class="rf-view-quick-menu" style="display:none"></div>',
            '<div id="rf-breadcrumb" class="rf-breadcrumb" style="display:none"></div>',
            '<input id="rf-search" class="rf-search" type="text" placeholder="Search\u2026" oninput="window._rfOnSearch(this.value)">',
            '<div class="rf-tabs">',
            '  <div id="rf-tab-summary"   class="rf-tab rf-tab-active" onclick="window._rfSwitchTab(\'summary\')">Summary</div>',
            '  <div id="rf-tab-airports"  class="rf-tab"               onclick="window._rfSwitchTab(\'airports\')">Airports</div>',
            '  <div id="rf-tab-countries" class="rf-tab"               onclick="window._rfSwitchTab(\'countries\')">Countries</div>',
            '  <div id="rf-tab-operators" class="rf-tab"               onclick="window._rfSwitchTab(\'operators\')">Operators</div>',
            '  <div id="rf-tab-aircraft"  class="rf-tab"               onclick="window._rfSwitchTab(\'aircraft\')">Aircraft</div>',
            '  <div id="rf-tab-views"     class="rf-tab"               onclick="window._rfSwitchTab(\'views\')">Views</div>',
            '  <div id="rf-tab-alerts"    class="rf-tab"               onclick="window._rfSwitchTab(\'alerts\')">Alerts</div>',
            '  <div id="rf-tab-distance"  class="rf-tab"               onclick="window._rfSwitchTab(\'distance\')">Distance</div>',
            '  <div id="rf-tab-settings"  class="rf-tab rf-tab-gear"   onclick="window._rfSwitchTab(\'settings\')">&#9881;</div>',
            '</div>',
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
            var btn = document.getElementById('rf-view-quick-btn');
            if (!menu || menu.style.display !== 'block') return;
            var t = evt.target;
            if (menu.contains(t) || (btn && btn.contains(t))) return;
            window._rfToggleViewQuickMenu(false);
        });

        // Load persisted settings
        try {
            var sv = localStorage.getItem(SETTINGS_KEY);
            if (sv) {
                var sp = JSON.parse(sv);
                if (sp.displayMode === 'popup' || sp.displayMode === 'sidebar') settings.displayMode = sp.displayMode;
                if (sp.sidebarSide === 'left') settings.sidebarSide = 'left';
                if (typeof sp.useLocalDb === 'boolean') settings.useLocalDb = sp.useLocalDb;
                if (typeof sp.routeKnownOnly === 'boolean') settings.routeKnownOnly = sp.routeKnownOnly;
                if (typeof sp.hideAllScope === 'boolean') settings.hideAllScope = sp.hideAllScope;
                if (typeof sp.homeOverride === 'boolean') settings.homeOverride = sp.homeOverride;
                if (typeof sp.homeLat === 'string' || typeof sp.homeLat === 'number') settings.homeLat = String(sp.homeLat);
                if (typeof sp.homeLon === 'string' || typeof sp.homeLon === 'number') settings.homeLon = String(sp.homeLon);
                if (typeof sp.homeZoom === 'number' || typeof sp.homeZoom === 'string') settings.homeZoom = parseInt(sp.homeZoom, 10) || 12;
            }
            // Dedicated home key takes precedence if present.
            var hv = localStorage.getItem(HOME_KEY);
            if (hv) {
                var hp = JSON.parse(hv);
                if (typeof hp.homeOverride === 'boolean') settings.homeOverride = hp.homeOverride;
                if (typeof hp.homeLat === 'string' || typeof hp.homeLat === 'number') settings.homeLat = String(hp.homeLat);
                if (typeof hp.homeLon === 'string' || typeof hp.homeLon === 'number') settings.homeLon = String(hp.homeLon);
                if (typeof hp.homeZoom === 'number' || typeof hp.homeZoom === 'string') settings.homeZoom = parseInt(hp.homeZoom, 10) || 12;
            }
            // Dedicated home cookie backup (used when localStorage is wiped on browser close).
            var hcv = _rfCookieGet(HOME_COOKIE_KEY);
            if (hcv) {
                var hcp = JSON.parse(hcv);
                if (typeof hcp.homeOverride === 'boolean') settings.homeOverride = hcp.homeOverride;
                if (typeof hcp.homeLat === 'string' || typeof hcp.homeLat === 'number') settings.homeLat = String(hcp.homeLat);
                if (typeof hcp.homeLon === 'string' || typeof hcp.homeLon === 'number') settings.homeLon = String(hcp.homeLon);
                if (typeof hcp.homeZoom === 'number' || typeof hcp.homeZoom === 'string') settings.homeZoom = parseInt(hcp.homeZoom, 10) || 12;
            }
            // If localStorage was wiped, try cookie backup snapshot.
            if (!sv && !hv) {
                var cv = _rfCookieGet(PERSIST_COOKIE_KEY);
                if (cv) _rfApplyPersistSnapshot(JSON.parse(cv));
            }
            applyPanelMode();
            if (settings.useLocalDb) _dbAutoSync();
        } catch (e) {}
        try {
            var vv = localStorage.getItem(VIEWS_KEY);
            if (vv) {
                var vp = JSON.parse(vv);
                if (Array.isArray(vp)) _savedViews = vp;
            }
            for (var vi = 0; vi < _savedViews.length; vi++) _rfEnsureViewShape(_savedViews[vi]);
        } catch (e) { _savedViews = []; }
        try {
            var tv = localStorage.getItem(TAB_VIS_KEY);
            if (tv) {
                var tp = JSON.parse(tv);
                Object.keys(_tabVisibility).forEach(function (k) {
                    if (tp.hasOwnProperty(k)) _tabVisibility[k] = !!tp[k];
                });
            }
        } catch (e) {}
        // photos toggle removed in basic alerts mode
        try {
            var ssv = localStorage.getItem(SUMMARY_SETTINGS_KEY);
            if (ssv) {
                var ssp = JSON.parse(ssv);
                Object.keys(_summarySettings).forEach(function (k) {
                    if (ssp.hasOwnProperty(k)) _summarySettings[k] = !!ssp[k];
                });
            }
        } catch (e) {}
        // Apply the persisted default scope to the runtime session scope
        _panelScope = 'all';
        if (settings.hideAllScope && _panelScope === 'all') _panelScope = 'inview';
        try {
            var distSaved = localStorage.getItem(DIST_LS_KEY);
            if (distSaved) _distanceLocations = JSON.parse(distSaved) || [];
        } catch (e) { _distanceLocations = []; }
        try {
            var distZonesRaw = localStorage.getItem(DIST_ZONES_KEY);
            if (distZonesRaw) {
                var dz = JSON.parse(distZonesRaw);
                if (Array.isArray(dz) && dz.length > 0) {
                    _distanceZones = dz.filter(function(z) {
                        return z && typeof z.lat === 'number' && typeof z.lon === 'number' && z.radiusNm > 0;
                    });
                    // Pre-populate the form with the first zone
                    if (_distanceZones.length > 0) {
                        var fz = _distanceZones[0];
                        _distanceForm.lat          = String(fz.lat);
                        _distanceForm.lon          = String(fz.lon);
                        _distanceForm.radiusNm     = String(fz.radiusNm);
                        _distanceForm.locationName = fz.name || '';
                        _distanceForm.altMode      = fz.altMode || 'all';
                        _distanceForm.altMin       = String(fz.altMin || 0);
                        _distanceForm.altMax       = String(fz.altMax || 50000);
                    }
                }
            }
        } catch(e) { _distanceZones = []; }
        try {
            var dm = localStorage.getItem(DIST_MODE_KEY);
            if (dm === 'inside' || dm === 'outside' || dm === 'maponly') _distanceMode = dm;
        } catch(e) {}

        installFilterHook();

        // If distance zones were restored from localStorage, draw their rings on the map.
        // Short delay ensures the OL map and layers are fully initialised.
        if (_distanceZones.length > 0) {
            setTimeout(_rfDrawDistOnMainMap, 800);
        }

        // Apply initial tab visibility
        Object.keys(_tabVisibility).forEach(function (k) {
            if (!_tabVisibility[k]) {
                var tabEl = document.getElementById('rf-tab-' + k);
                if (tabEl) tabEl.style.display = 'none';
            }
        });

        // Keep backup snapshot fresh on startup too.
        _rfSavePersistBackup();

        if (_tabVisibility.alerts) loadAlerts(false);

        // Also update tab active highlight correctly (tabs are managed via class, not DOM state)
        // Re-wire _rfSwitchTab to update tab highlights
        var origSwitch = window._rfSwitchTab;
        window._rfSwitchTab = function (tab) {
            ['summary','airports','countries','operators','aircraft','views','alerts','distance','settings'].forEach(function (t) {
                var el = document.getElementById('rf-tab-' + t);
                if (el) el.className = 'rf-tab' + (t === 'settings' ? ' rf-tab-gear' : '') + (t === tab ? ' rf-tab-active' : '');
            });
            origSwitch(tab);
        };

        state.refreshTimer = setInterval(function () {
            if (state.panelOpen) {
                // Distance panel: skip full rebuild when user has focus inside an input
                // to prevent stealing the cursor every 3 seconds
                if (state.activeTab === 'distance') {
                    // Never rebuild distance tab on timer - would destroy the Leaflet map
                    // Only update the status count
                    var statusEl2 = document.getElementById('rf-status');
                    if (statusEl2 && gReady()) {
                        if (_distanceZones.length > 0) {
                            var cnt2 = 0;
                            for (var ti = 0; ti < g.planesOrdered.length; ti++) {
                                if (planePassesDistanceFilter(g.planesOrdered[ti])) cnt2++;
                            }
                            if (_distanceMode === 'outside') statusEl2.textContent = cnt2 + ' aircraft outside zone' + (_distanceZones.length > 1 ? 's' : '');
                            else if (_distanceMode === 'maponly') statusEl2.textContent = 'Map only mode (no aircraft filtering)';
                            else statusEl2.textContent = cnt2 + ' aircraft in zone' + (_distanceZones.length > 1 ? 's' : '');
                        } else {
                            statusEl2.textContent = '';
                        }
                    }
                } else {
                    // Avoid stealing cursor/focus while user is typing in panel inputs.
                    if (!_rfIsEditingInputs()) buildPanel();
                }
            }
            // Keep active view map behavior synced as aircraft move.
            var avTick = _rfGetActiveView();
            if (avTick && avTick.map && avTick.map.enabled) {
                _rfApplyMapBehaviorConfig(avTick.map, false);
            }
            if (isFilterActive()) triggerRedraw();
        }, 3000);
    }

    // ── Debug helper ──────────────────────────────────────────────────────────
    window.rfDebug = function () {
        try {
            console.log('[RF] build:', RF_BUILD);
            getAircraftData(); // populate _aircraftIcaoMap/_aircraftAdsbCat/_aircraftWtc
            var planes = g.planesOrdered || [];
            console.log('[RF] Total aircraft:', planes.length);
            var sample = planes.slice(0, 8);
            sample.forEach(function (p, i) {
                console.log('[RF] Plane', i, p.icao, {
                    callsign:    p.callsign,
                    flight:      p.flight,
                    typeLong:    p.typeLong,
                    icaoType:    p.icaoType,
                    routeString: p.routeString,
                    // ADS-B emitter category (A1=light, A3=large, A5=heavy, A7=rotorcraft)
                    category:    p.category,
                    // Wake turbulence category (L/M/H/J) from aircraft DB
                    wtc:         p.wtc,
                    // Type data object if present
                    typeData:    p.typeData,
                    // Other potential category fields
                    species:     p.species,
                    engType:     p.engType,
                    engMount:    p.engMount,
                });
            });

            // Category summary
            var cats = {}, wtcs = {};
            planes.forEach(function (p) {
                if (p.category) cats[p.category] = (cats[p.category] || 0) + 1;
                if (p.wtc)      wtcs[p.wtc]      = (wtcs[p.wtc]      || 0) + 1;
            });
            console.log('[RF] ADS-B category breakdown:', cats);
            console.log('[RF] Wake turbulence category breakdown:', wtcs);

            // Aircraft category resolution check
            console.log('[RF] Category resolution for visible types:');
            var seen = {};
            planes.forEach(function (p) {
                var key = p.typeLong || p.icaoType;
                if (!key || seen[key]) return;
                seen[key] = true;
                var catId = getAircraftCategory(key);
                var info  = CATEGORY_INFO[catId];
                if (catId === 0) {
                    console.log('[RF]  UNRESOLVED:', key, '| icaoType:', p.icaoType, '| adsb cat:', p.category, '| wtc:', p.wtc);
                }
            });

            var cacheKeys = Object.keys(g.route_cache || {});
            console.log('[RF] route_cache entries:', cacheKeys.length);

            // Alert DB matching diagnostics
            var liveSet = new Set();
            planes.forEach(function(p) { if (p.icao) liveSet.add((p.icao + '').toUpperCase()); });
            var alertCount = _alertsDb ? _alertsDb.length : 0;
            var matches = 0, sample = [];
            if (_alertsDb) {
                _alertsDb.forEach(function(a) {
                    var ic = (a.icao || '').toUpperCase();
                    if (liveSet.has(ic)) {
                        matches++;
                        if (sample.length < 12) sample.push(ic);
                    }
                });
            }
            console.log('[RF] alerts db status:', {
                loaded: !!_alertsDb,
                fetching: _alertsFetching,
                error: _alertsError,
                rows: alertCount,
                liveMatches: matches,
                sampleMatches: sample
            });
            console.log('[RF] storage status:', {
                localStorageOk: _rfLocalStorageOk,
                cookieOk: _rfCookieOk,
                settingsKey: !!localStorage.getItem(SETTINGS_KEY),
                homeKey: !!localStorage.getItem(HOME_KEY),
                homeCookie: _rfCookieGet(HOME_COOKIE_KEY) ? 'present' : 'missing',
                persistCookie: _rfCookieGet(PERSIST_COOKIE_KEY) ? 'present' : 'missing',
            });
            var fnCandidates = [
                'selectPlaneByHex','selectPlaneByICAO','selectPlaneByIcao','selectPlane',
                'setSelectedPlane','setSelectedIcao',
                'setFollowSelected','toggleFollowSelected',
                'setShowTrace','toggleShowTrace',
                'refreshSelected','refreshSelectedPlane'
            ];
            var fnFound = [];
            for (var fi = 0; fi < fnCandidates.length; fi++) {
                var nm = fnCandidates[fi];
                try { if (window && typeof window[nm] === 'function') fnFound.push(nm); } catch (e) {}
            }
            var varState = {};
            try { varState.FollowSelected = (typeof FollowSelected !== 'undefined') ? FollowSelected : '(undef)'; } catch (e) { varState.FollowSelected = '(err)'; }
            try { varState.showTrace = (typeof showTrace !== 'undefined') ? showTrace : '(undef)'; } catch (e) { varState.showTrace = '(err)'; }
            try { varState.ShowTrace = (typeof ShowTrace !== 'undefined') ? ShowTrace : '(undef)'; } catch (e) { varState.ShowTrace = '(err)'; }
            try { varState.SelectedPlane = (typeof SelectedPlane !== 'undefined') ? SelectedPlane : '(undef)'; } catch (e) { varState.SelectedPlane = '(err)'; }
            console.log('[RF] track hooks detected:', { functions: fnFound, vars: varState });
        } catch (e) {
            console.error('[RF] debug error:', e);
        }
    };

    console.log('[robs-filter] loaded build=' + RF_BUILD + ' - run window.rfDebug() in console to inspect data');

    // ── Helpers ───────────────────────────────────────────────────────────────
    function gReady() {
        try { return typeof g !== 'undefined' && Array.isArray(g.planesOrdered); }
        catch (e) { return false; }
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    function init() {
        var attempts = 0;
        var wait = setInterval(function () {
            attempts++;
            if (document.getElementById('header_side') && gReady()) {
                clearInterval(wait);
                inject();
            } else if (attempts > 120) {
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
