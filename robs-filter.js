/**
 * routes-filter.js
 * Multi-tab aircraft filter panel for tar1090.
 * Filters AND across: routes, airports (From/To), countries (From/To), operators, aircraft type.
 * Active filters shown as breadcrumb chips. Multiple items within a tab are OR'd.
 */
(function () {
    'use strict';

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
    const settings = { inView: true, displayMode: 'sidebar', sidebarSide: 'right', useLocalDb: true };

    // ResizeObserver / MutationObserver refs - cleaned up when leaving sidebar mode
    var _rfObservers = [];

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
    var _tabVisibility = { summary: true, airports: true, countries: true, operators: true, aircraft: true, alerts: true, distance: true };

    // ── Alerts state ──────────────────────────────────────────────────────────
    var _alertsDb        = null;  // null=not loaded, array when loaded
    var _alertsFetching  = false;
    var _alertsTimestamp = 0;
    var _alertsError     = null;
    var _alertsMoreInfo  = null;  // icao string of currently shown more-info card, or null
    // Filter state for alerts tab (separate from tabState - doesn't cross-filter other tabs)
    var _alertsFilters        = { cmpg: '', category: '', tag: '', liveOnly: true };
    // Map filter: when true, only planes whose ICAO is in the filtered alerts DB are shown
    var _alertsMapFilter      = false;
    var _alertsMapFilterIcaos = null; // pre-built Set<ICAO> for efficient isFiltered checks
    // Selected ICAOs: clicking a row adds/removes; takes priority over broad map filter
    var _alertsSelectedIcaos  = new Set();

    // ── Distance filter state ─────────────────────────────────────────────────
    var _distMap = null;          // Leaflet map instance
    var _distMapMarker = null;    // centre point marker
    var _distMapCircle = null;    // radius circle
    var _leafletReady = false;    // Leaflet loaded flag

    var DIST_LS_KEY        = 'rf_dist_locs_v1';
    var _distanceLocations = [];  // [{name, lat, lon, radiusNm}] persisted in localStorage
    // Applied filter -- only changes when user hits Apply
    var _distanceFilter  = {
        active:       false,
        locationIdx:  -1,
        locationName: '',
        lat:          null,
        lon:          null,
        radiusNm:     50,
        altMode:      'all',  // 'all' or 'between'
        altMin:       0,
        altMax:       50000,
    };
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
    };

    // Shorthand helpers
    function ts()             { return state.tabState[state.activeTab]; }
    function isFilterActive() {
        var ac = state.tabState.aircraft;
        if (ac.catFilter.size > 0 || ac.regCountryFilter !== '') return true;
        if (_alertsSelectedIcaos.size > 0) return true;
        if (_alertsMapFilter && _alertsMapFilterIcaos) return true;
        if (_distanceFilter.active) return true;
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
            // In-view filter
            if (settings.inView && !plane.inView) continue;

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

    function planePassesDistanceFilter(plane) {
        if (!_distanceFilter.active) return true;
        if (_distanceFilter.lat === null || _distanceFilter.lon === null) return true;
        // Accept lat/lon in any numeric form (number, numeric string)
        var plat = +plane.lat;
        var plon = +plane.lon;
        if (isNaN(plat) || isNaN(plon)) return true; // no position known - show plane
        var dist = haversineNm(_distanceFilter.lat, _distanceFilter.lon, plat, plon);
        if (dist > _distanceFilter.radiusNm) return false;
        if (_distanceFilter.altMode === 'between') {
            var alt = typeof plane.altitude === 'number' ? plane.altitude
                    : (plane.alt_baro === 'ground' ? 0
                    : typeof plane.alt_baro === 'number' ? plane.alt_baro : null);
            if (alt === null) return true; // unknown altitude - pass through
            if (alt < _distanceFilter.altMin || alt > _distanceFilter.altMax) return false;
        }
        return true;
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
        return true;
    }

    // ── Filter function (shared logic used by both hook methods) ─────────────
    function rfIsFiltered(plane) {
        if (!isFilterActive()) return false;
        if (settings.inView && !plane.inView) return true;
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
        try {
            if (typeof refreshFilter === 'function') { refreshFilter(); return; }
            if (typeof window.refreshFilter === 'function') { window.refreshFilter(); return; }
            if (gReady()) {
                for (var i = 0; i < g.planesOrdered.length; i++) {
                    var p = g.planesOrdered[i];
                    var filtered = rfIsFiltered(p);
                    if (filtered && typeof p.clearMarker === 'function') p.clearMarker();
                    if (typeof p.updateMarker === 'function') p.updateMarker(true);
                }
            }
            if (g && g.map && typeof g.map.render === 'function') g.map.render();
        } catch (e) {}
    }

    function applyFilter() { triggerRedraw(); }

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

        // Alerts chip: row selection takes priority over broad map filter
        var alActive = state.activeTab === 'alerts' ? ' rf-chip-active' : '';
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
        } else if (_alertsMapFilter && _alertsMapFilterIcaos) {
            var alParts = [];
            if (_alertsFilters.cmpg)     alParts.push(_alertsFilters.cmpg);
            if (_alertsFilters.category) alParts.push(_alertsFilters.category);
            if (_alertsFilters.tag)      alParts.push(_alertsFilters.tag);
            var alSummary2 = (alParts.length > 0 ? alParts.join(' + ') : 'All alerts') + ' (' + _alertsMapFilterIcaos.size + ')';
            chips.push(
                '<div class="rf-chip' + alActive + '" onclick="window._rfSwitchTab(\'alerts\')" title="Click to open Alerts tab">' +
                '<span class="rf-chip-label">Alerts</span>' +
                '<span class="rf-chip-items">' + alSummary2.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>' +
                '<button class="rf-chip-x" onclick="event.stopPropagation();window._rfToggleAlertsMap(false)">&#x2715;</button>' +
                '</div>'
            );
        }

        // Distance filter chip
        if (_distanceFilter.active) {
            var distActive = state.activeTab === 'distance' ? ' rf-chip-active' : '';
            var distParts  = [(_distanceFilter.locationName || 'Custom') + ' ' + _distanceFilter.radiusNm + 'NM'];
            if (_distanceFilter.altMode === 'between') {
                distParts.push(_distanceFilter.altMin + '-' + _distanceFilter.altMax + 'ft');
            }
            chips.push(
                '<div class="rf-chip' + distActive + '" onclick="window._rfSwitchTab(\'distance\')" title="Click to open Distance tab">' +
                '<span class="rf-chip-label">Distance</span>' +
                '<span class="rf-chip-items">' + distParts.join(' | ').replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>' +
                '<button class="rf-chip-x" onclick="event.stopPropagation();window._rfDistClear()">&#x2715;</button>' +
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
        // Build live set when liveOnly is on so the map filter also respects it
        var liveSet = new Set();
        if (_alertsFilters.liveOnly && gReady()) {
            for (var li = 0; li < g.planesOrdered.length; li++) {
                if (g.planesOrdered[li].icao) liveSet.add(g.planesOrdered[li].icao.toUpperCase());
            }
        }
        var set = new Set();
        _alertsDb.forEach(function(a) {
            var icao = a.icao.toUpperCase();
            if (_alertsFilters.cmpg     && a.cmpg     !== _alertsFilters.cmpg)                                                             return;
            if (_alertsFilters.category && a.category !== _alertsFilters.category)                                                          return;
            if (_alertsFilters.tag      && a.tag1 !== _alertsFilters.tag && a.tag2 !== _alertsFilters.tag && a.tag3 !== _alertsFilters.tag) return;
            if (_alertsFilters.liveOnly && !liveSet.has(icao))                                                                             return;
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
            if (ctrlEl)   ctrlEl.innerHTML  = '';
            if (hdrEl)    hdrEl.innerHTML   = '';
            if (listEl)   listEl.innerHTML  = '<div class="rf-empty">Alerts tab is disabled.<br>Enable it in \u2699 Settings.</div>';
            if (statusEl) statusEl.textContent = '';
            return;
        }
        if (_alertsFetching) {
            if (ctrlEl)   ctrlEl.innerHTML  = '';
            if (hdrEl)    hdrEl.innerHTML   = '';
            if (listEl)   listEl.innerHTML  = '<div class="rf-empty">Loading plane-alert-db\u2026</div>';
            if (statusEl) statusEl.textContent = '';
            return;
        }
        if (!_alertsDb && _alertsError) {
            if (ctrlEl)   ctrlEl.innerHTML  = '';
            if (hdrEl)    hdrEl.innerHTML   = '';
            if (listEl)   listEl.innerHTML  = '<div class="rf-empty">Failed to load: ' + _alertsError + '<br><button class="rf-cat-btn" style="margin-top:8px" onclick="window._rfAlertsRefresh()">Retry</button></div>';
            if (statusEl) statusEl.textContent = '';
            return;
        }
        if (!_alertsDb) {
            loadAlerts(false);
            if (ctrlEl)   ctrlEl.innerHTML  = '';
            if (hdrEl)    hdrEl.innerHTML   = '';
            if (listEl)   listEl.innerHTML  = '<div class="rf-empty">Loading\u2026</div>';
            if (statusEl) statusEl.textContent = '';
            return;
        }

        function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

        // Build live ICAO set
        var liveIcaos = new Set();
        if (gReady()) {
            for (var pi = 0; pi < g.planesOrdered.length; pi++) {
                if (g.planesOrdered[pi].icao) liveIcaos.add(g.planesOrdered[pi].icao.toUpperCase());
            }
        }

        // Populate filter dropdowns from the full DB
        var cmpgSet = new Set(), catSet = new Set(), tagSet = new Set();
        _alertsDb.forEach(function(a) {
            if (a.cmpg)     cmpgSet.add(a.cmpg);
            if (a.category) catSet.add(a.category);
            [a.tag1, a.tag2, a.tag3].forEach(function(t) { if (t) tagSet.add(t); });
        });
        function makeSelect(id, placeholder, valSet, cur, handler) {
            var html = '<select class="rf-country-select" id="' + id + '" onchange="' + handler + '">';
            html += '<option value="">' + placeholder + '</option>';
            Array.from(valSet).sort().forEach(function(v) {
                html += '<option value="' + v.replace(/"/g,'&quot;') + '"' + (cur === v ? ' selected' : '') + '>' + v + '</option>';
            });
            return html + '</select>';
        }

        // Controls: dropdowns row + checkboxes row
        if (ctrlEl) {
            ctrlEl.innerHTML =
                '<div class="rf-alerts-filters">' +
                makeSelect('rf-al-cmpg', 'All Types',      cmpgSet, _alertsFilters.cmpg,     'window._rfAlertsFilter()') +
                makeSelect('rf-al-cat',  'All Categories', catSet,  _alertsFilters.category, 'window._rfAlertsFilter()') +
                makeSelect('rf-al-tag',  'All Tags',       tagSet,  _alertsFilters.tag,      'window._rfAlertsFilter()') +
                '</div>' +
                '<div class="rf-alerts-checks">' +
                '<label class="rf-alerts-live-label"><input type="checkbox" id="rf-al-live"' +
                (_alertsFilters.liveOnly ? ' checked' : '') + ' onchange="window._rfAlertsFilter()"> Live only</label>' +
                '<button class="rf-cat-btn' + (_alertsMapFilter ? ' rf-cat-active rf-alerts-mapfilter-btn' : ' rf-alerts-mapfilter-btn') + '"' +
                ' onclick="window._rfToggleAlertsMap(' + (!_alertsMapFilter) + ')">' +
                (_alertsMapFilter ? 'Map Active' : 'Apply to Map') + '</button>' +
                (_alertsSelectedIcaos.size > 0
                    ? '<button class="rf-cat-btn" style="margin-left:auto" onclick="window._rfClearAlerts()">Clear selection</button>'
                    : '') +
                '</div>';
        }

        // Column header -- matches rf-item row layout
        if (hdrEl) {
            hdrEl.innerHTML =
                '<div class="rf-colheader-row rf-al-hdr">' +
                '<span class="rf-al-hdr-live"></span>' +
                '<span class="rf-al-hdr-name">Aircraft</span>' +
                '<span class="rf-al-hdr-type">Type</span>' +
                '<span class="rf-al-hdr-cat">Category</span>' +
                '<span class="rf-al-hdr-info"></span>' +
                '</div>';
        }

        // Filter the DB
        var search = state.searchText.toLowerCase();
        var filtered = _alertsDb.filter(function(a) {
            if (_alertsFilters.cmpg     && a.cmpg     !== _alertsFilters.cmpg)                                                             return false;
            if (_alertsFilters.category && a.category !== _alertsFilters.category)                                                          return false;
            if (_alertsFilters.tag      && a.tag1 !== _alertsFilters.tag && a.tag2 !== _alertsFilters.tag && a.tag3 !== _alertsFilters.tag) return false;
            if (_alertsFilters.liveOnly && !liveIcaos.has(a.icao))                                                                          return false;
            if (search) {
                var hay = (a.icao + ' ' + a.reg + ' ' + a.operator + ' ' + a.type + ' ' + a.cmpg + ' ' + a.category + ' ' + a.tag1 + ' ' + a.tag2 + ' ' + a.tag3).toLowerCase();
                if (!hay.includes(search)) return false;
            }
            return true;
        });

        var displayed = filtered.slice(0, 300);
        var overflow  = filtered.length > 300;

        if (!listEl) return;

        var html = '';

        // Detail card pinned at top of the list (doesn't replace list)
        if (_alertsMoreInfo) {
            var mi = _alertsDb.find(function(a) { return a.icao === _alertsMoreInfo; });
            if (mi) {
                var isLive  = liveIcaos.has(mi.icao);
                var tags    = [mi.tag1, mi.tag2, mi.tag3].filter(Boolean).join(', ');
                var psUrl   = 'https://www.planespotters.net/search?q=' + encodeURIComponent(mi.reg || mi.icao);
                var fr24Url = 'https://www.flightradar24.com/' + encodeURIComponent(mi.reg || mi.icao);
                var adsbUrl = 'https://globe.adsbexchange.com/?icao=' + mi.icao.toLowerCase();
                html +=
                    '<div class="rf-al-detail">' +
                    '<div class="rf-al-detail-hdr">' +
                    (isLive ? '<span class="rf-al-live-dot"></span>' : '') +
                    '<span class="rf-mi-icao">' + esc(mi.icao) + '</span>' +
                    '<span class="rf-mi-reg">' + esc(mi.reg) + '</span>' +
                    (isLive ? '<span class="rf-mi-live-badge">On map</span>' : '') +
                    '<button class="rf-mi-close" onclick="window._rfAlertsMi(null)">&#x2715;</button>' +
                    '</div>' +
                    '<div class="rf-al-detail-body">' +
                    (mi.operator ? '<div class="rf-mi-row"><span class="rf-mi-label">Operator</span><span class="rf-mi-val">' + esc(mi.operator) + '</span></div>' : '') +
                    (mi.type     ? '<div class="rf-mi-row"><span class="rf-mi-label">Aircraft</span><span class="rf-mi-val">' + esc(mi.type) + (mi.icaoType ? ' (' + esc(mi.icaoType) + ')' : '') + '</span></div>' : '') +
                    (mi.cmpg     ? '<div class="rf-mi-row"><span class="rf-mi-label">Type</span><span class="rf-mi-val">' + esc(mi.cmpg) + '</span></div>' : '') +
                    (mi.category ? '<div class="rf-mi-row"><span class="rf-mi-label">Category</span><span class="rf-mi-val">' + esc(mi.category) + '</span></div>' : '') +
                    (tags        ? '<div class="rf-mi-row"><span class="rf-mi-label">Tags</span><span class="rf-mi-val">' + esc(tags) + '</span></div>' : '') +
                    '</div>' +
                    '<div class="rf-mi-links">' +
                    (mi.link ? '<a class="rf-mi-link" href="' + esc(mi.link) + '" target="_blank" rel="noopener">Reference</a>' : '') +
                    '<a class="rf-mi-link" href="' + psUrl   + '" target="_blank" rel="noopener">Planespotters</a>' +
                    '<a class="rf-mi-link" href="' + fr24Url + '" target="_blank" rel="noopener">FR24</a>' +
                    '<a class="rf-mi-link" href="' + adsbUrl + '" target="_blank" rel="noopener">ADSBx</a>' +
                    '</div>' +
                    '<div id="rf-mi-img-wrap" class="rf-mi-img-wrap"><span class="rf-mi-img-loading">Loading photo\u2026</span></div>' +
                    '</div>';
                // async photo load
                (function(icao, wrapId) {
                    // defer so innerHTML is committed first
                    setTimeout(function() {
                        fetch('https://api.planespotters.net/pub/photos/hex/' + icao.toLowerCase())
                            .then(function(r) { return r.json(); })
                            .then(function(d) {
                                var wrap = document.getElementById(wrapId);
                                if (!wrap) return;
                                if (d && d.photos && d.photos.length > 0) {
                                    var ph = d.photos[0];
                                    wrap.innerHTML = '<a href="' + ph.link + '" target="_blank" rel="noopener">' +
                                        '<img class="rf-mi-img" src="' + ph.thumbnail_large.src + '" alt="photo"></a>' +
                                        '<div class="rf-mi-photo-credit">\u00a9 ' + esc(ph.photographer) + ' via Planespotters</div>';
                                } else {
                                    wrap.innerHTML = '<div class="rf-mi-img-none">No photo available</div>';
                                }
                            })
                            .catch(function() {
                                var wrap = document.getElementById(wrapId);
                                if (wrap) wrap.innerHTML = '<div class="rf-mi-img-none">Photo unavailable</div>';
                            });
                    }, 0);
                })(mi.icao, 'rf-mi-img-wrap');
            } else {
                _alertsMoreInfo = null;
            }
        }

        // List rows -- same rf-item pattern as other tabs
        if (displayed.length === 0) {
            html += '<div class="rf-empty">No matches' + (search ? ' for "' + search + '"' : '') + '</div>';
        } else {
            displayed.forEach(function(a) {
                var live    = liveIcaos.has(a.icao);
                var sel     = _alertsSelectedIcaos.has(a.icao);
                var classes = 'rf-item rf-al-item' + (sel ? ' rf-item-active' : '') + (live ? ' rf-al-live' : '');
                html +=
                    '<div class="' + classes + '" data-icao="' + esc(a.icao) + '" onclick="window._rfToggleAlert(this)">' +
                    '<span class="rf-al-live-cell">' + (live ? '<span class="rf-al-live-dot"></span>' : '') + '</span>' +
                    '<span class="rf-item-name rf-al-name">' +
                        '<span class="rf-al-name-top"><span class="rf-al-icao">' + esc(a.icao) + '</span>' +
                        (a.reg ? ' <span class="rf-al-reg">' + esc(a.reg) + '</span>' : '') + '</span>' +
                        (a.operator ? '<span class="rf-al-op-small">' + esc(a.operator) + '</span>' : '') +
                    '</span>' +
                    '<span class="rf-al-type-col">' + esc(a.type || a.icaoType || '') + '</span>' +
                    '<span class="rf-al-cat-col">' + esc(a.category || '') + '</span>' +
                    '<button class="rf-al-info-btn" onclick="event.stopPropagation();window._rfAlertsMi(\'' + esc(a.icao) + '\')">\u2139</button>' +
                    '</div>';
            });
            if (overflow) html += '<div class="rf-empty" style="font-size:10px;padding:8px">Showing 300 of ' + filtered.length + ' \u2014 refine search</div>';
        }

        listEl.innerHTML = html;

        if (statusEl) {
            var liveCount = filtered.filter(function(a) { return liveIcaos.has(a.icao); }).length;
            var selCount  = _alertsSelectedIcaos.size;
            statusEl.textContent = filtered.length + ' entries' +
                (liveCount > 0 ? ' \u2022 ' + liveCount + ' live' : '') +
                (selCount  > 0 ? ' \u2022 ' + selCount  + ' selected' : '');
        }
    }

    // ── Summary tab rendering ─────────────────────────────────────────────────
    function buildSummaryPanel() {
        buildBreadcrumb();
        var searchEl = document.getElementById('rf-search');
        if (searchEl) searchEl.style.display = 'none';
        var ctrlEl = document.getElementById('rf-controls');
        if (ctrlEl) ctrlEl.innerHTML = '';
        var hdrEl = document.getElementById('rf-colheader');
        if (hdrEl) hdrEl.innerHTML = '';
        var listEl = document.getElementById('rf-list');
        if (!listEl) return;

        if (!gReady()) {
            listEl.innerHTML = '<div class="rf-empty">Waiting for aircraft data\u2026</div>';
            return;
        }

        var planes  = g.planesOrdered;
        var total   = planes.length;
        var altBands = [0, 0, 0, 0, 0, 0, 0]; // ground, <5k, 5-10k, 10-20k, 20-30k, 30-40k, 40k+
        var militaryList  = [];
        var emergencyList = [];
        var unusualList   = [];
        var operatorCounts = {};
        var routeCounts    = {};

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

            // Altitude
            var isGround = p.alt_baro === 'ground';
            var altNum   = isGround ? -1 : (typeof p.alt_baro === 'number' ? p.alt_baro : null);
            if (altNum !== null) {
                if (isGround || altNum < 0)   altBands[0]++;
                else if (altNum < 5000)        altBands[1]++;
                else if (altNum < 10000)       altBands[2]++;
                else if (altNum < 20000)       altBands[3]++;
                else if (altNum < 30000)       altBands[4]++;
                else if (altNum < 40000)       altBands[5]++;
                else                           altBands[6]++;
            }

            // Military
            if (isMilitaryAircraft(p)) militaryList.push(p);

            // Emergency squawks
            if (p.squawk === '7500' || p.squawk === '7600' || p.squawk === '7700') emergencyList.push(p);

            // Unusual: very low fixed-wing (not helicopter, not ground)
            if (!isGround && altNum !== null && altNum > 0 && altNum < 1000 && typeof p.lat === 'number') {
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
            if (route && route.fromIcao && route.toIcao) {
                var rk = route.fromIcao + ' \u2013 ' + route.toIcao;
                routeCounts[rk] = (routeCounts[rk] || 0) + 1;
            }

            // Closest aircraft (needs known position)
            if (rxLat !== null && typeof p.lat === 'number' && typeof p.lon === 'number') {
                closestPlanes.push({ plane: p, dist: haversineNm(rxLat, rxLon, p.lat, p.lon) });
            }
        }

        if (closestPlanes.length) {
            closestPlanes.sort(function (a, b) { return a.dist - b.dist; });
            closestPlanes = closestPlanes.slice(0, 5);
        }

        var topOps    = Object.keys(operatorCounts).map(function(k){ return [k, operatorCounts[k]]; })
                               .sort(function(a,b){ return b[1]-a[1]; }).slice(0, 6);
        var topRoutes = Object.keys(routeCounts).map(function(k){ return [k, routeCounts[k]]; })
                               .sort(function(a,b){ return b[1]-a[1]; }).slice(0, 6);
        var altMax    = Math.max.apply(null, altBands.concat([1]));

        function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
        function planeName(q) { return esc(q.flight || q.name || q.icao || '?'); }
        function planeReg(q)  { return esc(q.registration || ''); }
        function planeType(q) { return esc(q.typeLong || q.icaoType || ''); }
        function altStr(q) {
            if (q.alt_baro === 'ground') return 'Ground';
            if (typeof q.alt_baro === 'number') return q.alt_baro.toLocaleString() + '\u2009ft';
            return '';
        }

        var html = '<div class="rf-summary-content">';

        // Overview
        var onGround = altBands[0];
        var airborne = total - onGround;
        html += '<div class="rf-sum-section">';
        html += '<div class="rf-sum-title">Overview</div>';
        html += '<div class="rf-sum-overview">';
        html += '<div class="rf-sum-stat"><div class="rf-sum-num">' + total + '</div><div class="rf-sum-label">total aircraft</div></div>';
        html += '<div class="rf-sum-stat"><div class="rf-sum-num">' + airborne + '</div><div class="rf-sum-label">airborne</div></div>';
        html += '<div class="rf-sum-stat"><div class="rf-sum-num">' + onGround + '</div><div class="rf-sum-label">on ground</div></div>';
        if (militaryList.length > 0) {
            html += '<div class="rf-sum-stat rf-sum-stat-mil"><div class="rf-sum-num">' + militaryList.length + '</div><div class="rf-sum-label">military</div></div>';
        }
        if (emergencyList.length > 0) {
            html += '<div class="rf-sum-stat rf-sum-stat-emg"><div class="rf-sum-num">' + emergencyList.length + '</div><div class="rf-sum-label">emergency</div></div>';
        }
        html += '</div>';
        html += '</div>';

        // Altitude distribution
        var altLabels = ['Ground', '<5k', '5-10k', '10-20k', '20-30k', '30-40k', '40k+'];
        var altColors = ['#888888', '#7ce8c8', '#7cb9e8', '#7c8fe8', '#a87ce8', '#e87c7c', '#e8a87c'];
        html += '<div class="rf-sum-section">';
        html += '<div class="rf-sum-title">Altitude Distribution</div>';
        html += '<div class="rf-sum-altbars">';
        for (var bi = 0; bi < 7; bi++) {
            var pct = altBands[bi] > 0 ? Math.max(4, Math.round(altBands[bi] / altMax * 100)) : 0;
            html += '<div class="rf-sum-altbar-col">' +
                '<div class="rf-sum-altbar-wrap"><div class="rf-sum-altbar-fill" style="height:' + pct + '%;background:' + altColors[bi] + '"></div></div>' +
                '<div class="rf-sum-altbar-cnt">' + (altBands[bi] > 0 ? altBands[bi] : '') + '</div>' +
                '<div class="rf-sum-altbar-lbl">' + altLabels[bi] + '</div>' +
                '</div>';
        }
        html += '</div>';
        html += '</div>';

        // Attention required
        var hasAttn = emergencyList.length > 0 || unusualList.length > 0 || militaryList.length > 0;
        html += '<div class="rf-sum-section">';
        html += '<div class="rf-sum-title">Attention</div>';
        if (!hasAttn) {
            html += '<div class="rf-sum-none">Nothing unusual right now.</div>';
        } else {
            // Emergency squawks first
            emergencyList.forEach(function (q) {
                var sq = q.squawk;
                var desc = sq === '7500' ? 'Hijack declared' : sq === '7600' ? 'Radio failure' : 'General emergency';
                html += '<div class="rf-sum-attn-row rf-sum-attn-emg">' +
                    '<span class="rf-sum-squawk">SQWK ' + sq + '</span>' +
                    ' <span class="rf-sum-aname">' + planeName(q) + '</span>' +
                    (planeReg(q) ? ' <span class="rf-sum-reg">' + planeReg(q) + '</span>' : '') +
                    ' <span class="rf-sum-type">' + planeType(q) + '</span>' +
                    ' <span class="rf-sum-altbadge">' + altStr(q) + '</span>' +
                    ' <span class="rf-sum-attn-desc">' + desc + '</span>' +
                    '</div>';
            });
            // Military
            militaryList.slice(0, 8).forEach(function (q) {
                html += '<div class="rf-sum-attn-row rf-sum-attn-mil">' +
                    '<span class="rf-sum-mil-badge">MIL</span>' +
                    ' <span class="rf-sum-aname">' + planeName(q) + '</span>' +
                    (planeReg(q) ? ' <span class="rf-sum-reg">' + planeReg(q) + '</span>' : '') +
                    ' <span class="rf-sum-type">' + planeType(q) + '</span>' +
                    ' <span class="rf-sum-altbadge">' + altStr(q) + '</span>' +
                    '</div>';
            });
            if (militaryList.length > 8) {
                html += '<div class="rf-sum-more">and ' + (militaryList.length - 8) + ' more military</div>';
            }
            // Very low aircraft
            unusualList.slice(0, 4).forEach(function (item) {
                var q = item.plane;
                html += '<div class="rf-sum-attn-row">' +
                    '<span class="rf-sum-low-badge">LOW</span>' +
                    ' <span class="rf-sum-aname">' + planeName(q) + '</span>' +
                    (planeReg(q) ? ' <span class="rf-sum-reg">' + planeReg(q) + '</span>' : '') +
                    ' <span class="rf-sum-type">' + planeType(q) + '</span>' +
                    ' <span class="rf-sum-attn-desc">' + esc(item.reason) + '</span>' +
                    '</div>';
            });
        }
        html += '</div>';

        // Closest aircraft (only if we have receiver position)
        if (closestPlanes.length > 0) {
            html += '<div class="rf-sum-section">';
            html += '<div class="rf-sum-title">Closest Aircraft</div>';
            closestPlanes.forEach(function (item) {
                var q = item.plane;
                html += '<div class="rf-sum-close-row">' +
                    '<span class="rf-sum-dist">' + item.dist.toFixed(0) + '\u2009nm</span>' +
                    ' <span class="rf-sum-aname">' + planeName(q) + '</span>' +
                    (planeReg(q) ? ' <span class="rf-sum-reg">' + planeReg(q) + '</span>' : '') +
                    ' <span class="rf-sum-type">' + planeType(q) + '</span>' +
                    ' <span class="rf-sum-altbadge">' + altStr(q) + '</span>' +
                    (typeof q.gs === 'number' ? ' <span class="rf-sum-speed">' + Math.round(q.gs) + '\u2009kt</span>' : '') +
                    '</div>';
            });
            html += '</div>';
        }

        // Busiest operators
        if (topOps.length > 0) {
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

        // Busiest routes
        if (topRoutes.length > 0) {
            html += '<div class="rf-sum-section">';
            html += '<div class="rf-sum-title">Busiest Routes</div>';
            html += '<div class="rf-sum-bar-list">';
            var rtMax = topRoutes[0][1] || 1;
            topRoutes.forEach(function (rt) {
                var w = Math.round(rt[1] / rtMax * 100);
                html += '<div class="rf-sum-bar-row">' +
                    '<div class="rf-sum-bar-label">' + esc(rt[0]) + '</div>' +
                    '<div class="rf-sum-bar-track"><div class="rf-sum-bar-fill rf-sum-bar-fill-route" style="width:' + w + '%"></div></div>' +
                    '<div class="rf-sum-bar-cnt">' + rt[1] + '</div>' +
                    '</div>';
            });
            html += '</div>';
            html += '</div>';
        }

        html += '<div class="rf-sum-footer">Refreshes every 3s. Filters active on other tabs do not affect this view.</div>';
        html += '</div>';

        listEl.innerHTML = html;

        var statusEl = document.getElementById('rf-status');
        if (statusEl) statusEl.textContent = total + ' aircraft';
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
            listEl.innerHTML =
                '<div class="rf-settings-content">' +

                // ── Intro ─────────────────────────────────────────────────────
                '<div class="rf-set-intro">' +
                '<p>tar1090 is a web-based aircraft tracking interface that decodes ADS-B transponder signals and plots them on a live map. ' +
                'This version adds <strong>Robs Filters</strong> on top: a panel that lets you narrow down what is shown on the map by airport, country, operator, aircraft type, or distance. ' +
                'The <strong><a class="rf-set-link" onclick="window._rfSwitchTab(\'summary\')">Summary tab</a></strong> interprets the live data \u2014 aircraft counts, altitude bands, military contacts, emergency squawks, and busiest routes \u2014 rather than just displaying it.' +
                '</p>' +
                '<p style="margin:0">This panel is still beta. Things may break. Filters work by patching tar1090\'s internal <code>isFiltered</code> function and are re-evaluated on every data refresh.</p>' +
                '</div>' +

                '<div class="rf-set-divider"></div>' +

                // ── Filter behaviour ──────────────────────────────────────────
                '<div class="rf-set-group">' +
                '<div class="rf-set-group-title">Filter Behaviour</div>' +
                '<label class="rf-set-toggle">' +
                '<input type="checkbox" id="rf-inview-toggle"' + (settings.inView ? ' checked' : '') + ' onchange="window._rfSetInView(this.checked)">' +
                '<div class="rf-set-toggle-body">' +
                '<div class="rf-set-toggle-label">Only show aircraft in map view</div>' +
                '<div class="rf-set-toggle-desc">When on, filter lists and the map filter only consider aircraft currently visible in the viewport.</div>' +
                '</div>' +
                '</label>' +
                '</div>' +

                '<div class="rf-set-divider"></div>' +

                // ── Panel layout ──────────────────────────────────────────────
                '<div class="rf-set-group">' +
                '<div class="rf-set-group-title">Panel Layout</div>' +
                '<div class="rf-set-radio-group">' +
                '<label class="rf-set-radio"><input type="radio" name="rf-display-mode" value="popup"' + (settings.displayMode !== 'sidebar' ? ' checked' : '') + ' onchange="window._rfSetDisplayMode(\'popup\')"><span>Popup</span><span class="rf-set-radio-desc">Floats over the map, draggable</span></label>' +
                '<label class="rf-set-radio"><input type="radio" name="rf-display-mode" value="sidebar"' + (settings.displayMode === 'sidebar' ? ' checked' : '') + ' onchange="window._rfSetDisplayMode(\'sidebar\')"><span>Sidebar</span><span class="rf-set-radio-desc">Docks alongside tar1090\'s info panel</span></label>' +
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
                dbStatusHtml() +
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

                // ── About ─────────────────────────────────────────────────────
                '<div class="rf-set-group">' +
                '<div class="rf-set-group-title">About <span class="rf-beta-badge">BETA</span></div>' +
                '<div class="rf-set-about-warn">' +
                '<strong>Work in progress</strong> \u2014 use at your own risk.<br>' +
                'Known issues: alerts tab filtering has bugs; distance zone saving is rough; cross-tab state can desync after rapid switching.' +
                '</div>' +
                '<div style="font-size:11px;color:#aaa;line-height:1.7;margin-top:8px">' +
                'Filters are <strong>AND-ed across tabs</strong> and <strong>OR-ed within a tab</strong>. ' +
                'Active filters appear as chips in the breadcrumb bar above the tabs.' +
                '</div>' +
                '<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">' +
                '<a href="https://github.com/robertcanavan/tar1090-robs-filters" target="_blank" class="rf-set-link-btn">&#128279; GitHub</a>' +
                '<a href="https://github.com/robertcanavan/tar1090-robs-filters/issues" target="_blank" class="rf-set-link-btn">&#x26a0; Report Issue</a>' +
                '</div>' +
                '<div class="rf-about-made">Made by Rob \u2014 solving problems that are entirely his own fault, one tab at a time.</div>' +
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

        // Saved locations dropdown - uses _distanceForm for selected index
        var locOpts = '<option value="">-- Select saved location --</option>';
        _distanceLocations.forEach(function (loc, idx) {
            var sel = (_distanceForm.locationIdx === idx) ? ' selected' : '';
            locOpts += '<option value="' + idx + '"' + sel + '>' +
                loc.name.replace(/</g, '&lt;').replace(/>/g, '&gt;') +
                ' (' + loc.lat.toFixed(4) + ', ' + loc.lon.toFixed(4) + ')' +
                '</option>';
        });

        // Use _distanceForm for all input values so auto-refresh doesn't wipe edits
        var altAll = _distanceForm.altMode !== 'between';
        var altRng = altAll ? 'display:none' : '';

        var statusText = '';
        if (_distanceFilter.active) {
            var sp = [(_distanceFilter.locationName || 'Custom') + ' \u2014 ' + _distanceFilter.radiusNm + ' NM'];
            if (_distanceFilter.altMode === 'between') {
                sp.push(_distanceFilter.altMin.toLocaleString() + ' \u2013 ' + _distanceFilter.altMax.toLocaleString() + ' ft');
            }
            statusText = sp.join(' | ');
        }

        var listEl = document.getElementById('rf-list');
        if (listEl) {
            listEl.innerHTML =
                '<div class="rf-dist-content">' +

                '<div id="rf-dist-map" class="rf-dist-map"></div>' +

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
                (_distanceLocations.length > 0 || (_distanceForm.lat && _distanceForm.lon)
                    ? '<button class="rf-cat-btn rf-dist-savebtn" onclick="window._rfDistSaveLoc()">Save</button>'
                    : '') +
                '</div>' +

                '<div class="rf-setting-section-title" style="margin-top:6px">Saved Locations</div>' +
                '<div class="rf-dist-row">' +
                '<select id="rf-dist-locsel" class="rf-dist-select" onchange="window._rfDistSelectLoc(this.value)">' +
                locOpts +
                '</select>' +
                (_distanceLocations.length > 0
                    ? '<button class="rf-cat-btn rf-dist-delbtn" onclick="window._rfDistDeleteLoc()">Delete</button>'
                    : '') +
                '</div>' +

                '<div class="rf-setting-divider"></div>' +
                '<div class="rf-setting-section-title">Altitude</div>' +

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

                '<div class="rf-setting-divider"></div>' +

                '<div class="rf-dist-row">' +
                '<button class="rf-cat-btn' + (_distanceFilter.active ? ' rf-cat-active' : '') + '" onclick="window._rfDistApply()">' +
                (_distanceFilter.active ? 'Update Filter' : 'Apply Filter') +
                '</button>' +
                (_distanceFilter.active
                    ? '<button class="rf-cat-btn rf-dist-clearbtn" onclick="window._rfDistClear()">Clear</button>'
                    : '') +
                '</div>' +

                (statusText
                    ? '<div class="rf-dist-status">' + statusText.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</div>'
                    : '') +

                '</div>';

            // Initialise Leaflet map after DOM update
            setTimeout(function() { _rfInitDistMap(); }, 0);
        }

        var statusEl = document.getElementById('rf-status');
        if (statusEl) {
            if (_distanceFilter.active && gReady()) {
                var cnt = 0;
                for (var di = 0; di < g.planesOrdered.length; di++) {
                    if (planePassesDistanceFilter(g.planesOrdered[di])) cnt++;
                }
                statusEl.textContent = cnt + ' aircraft in zone';
            } else {
                statusEl.textContent = '';
            }
        }

        var btn = document.getElementById('rf-btn');
        if (btn) btn.className = 'button ' + (isFilterActive() ? 'activeButton' : 'inActiveButton');
    }

    // ── Panel rendering ───────────────────────────────────────────────────────
    function buildPanel() {
        var tab = state.activeTab;

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
            if (isFilterActive() || settings.inView) {
                var matched = 0;
                if (gReady()) {
                    for (var k = 0; k < g.planesOrdered.length; k++) {
                        var plane = g.planesOrdered[k];
                        if (settings.inView && !plane.inView) continue;
                        if (planePassesAllFilters(plane, null)) matched++;
                    }
                }
                var inViewLabel = settings.inView ? ' (in view)' : '';
                statusEl.textContent = matched + ' matched' + inViewLabel;
            } else {
                statusEl.textContent = allEntries.length + ' items \u2022 ' + totalAircraft + ' aircraft';
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

    window._rfSetInView = function (on) {
        settings.inView = !!on;
        saveSettings();
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
                try { localStorage.setItem(DB_KEY_ROUTES_PFX + code, JSON.stringify(routeMap)); localStorage.setItem(DB_KEY_ROUTES_PFX + code + '_ts', String(Date.now())); } catch(e) {}
                if (state.panelOpen) buildPanel();
            })
            .catch(function() { _localDb.routesFetched[code] = true; }) // 404 = no routes, don't retry
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
        if (prefix.length === 3) _dbFetchRoutesForAirline(prefix);
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
                inView:      settings.inView,
                displayMode: settings.displayMode,
                sidebarSide: settings.sidebarSide,
                useLocalDb:  settings.useLocalDb,
            }));
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
        }
    }

    window._rfAlertsFilter = function () {
        var cmpgEl = document.getElementById('rf-al-cmpg');
        var catEl  = document.getElementById('rf-al-cat');
        var tagEl  = document.getElementById('rf-al-tag');
        var liveEl = document.getElementById('rf-al-live');
        if (cmpgEl) _alertsFilters.cmpg     = cmpgEl.value;
        if (catEl)  _alertsFilters.category  = catEl.value;
        if (tagEl)  _alertsFilters.tag       = tagEl.value;
        if (liveEl) _alertsFilters.liveOnly  = liveEl.checked;
        if (_alertsMapFilter) { buildAlertsMapFilterSet(); applyFilter(); }
        buildPanel();
    };

    window._rfToggleAlertsMap = function (on) {
        _alertsMapFilter = !!on;
        buildAlertsMapFilterSet();
        applyFilter();
        buildPanel();
    };

    window._rfToggleAlert = function (el) {
        var icao = el.dataset.icao;
        if (!icao) return;
        if (_alertsSelectedIcaos.has(icao)) { _alertsSelectedIcaos.delete(icao); }
        else                                { _alertsSelectedIcaos.add(icao); }
        applyFilter();
        buildPanel();
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
        if (tab === 'distance' && !on && _distanceFilter.active) {
            _distanceFilter.active = false;
            applyFilter();
        }
        try { localStorage.setItem(TAB_VIS_KEY, JSON.stringify(_tabVisibility)); } catch (e) {}
        buildPanel();
    };

    // Keep old names as aliases for backwards compat (settings HTML used them before)
    window._rfSetAlertsEnabled   = function (on) { window._rfSetTabVisible('alerts',   on); };
    window._rfSetDistanceEnabled = function (on) { window._rfSetTabVisible('distance', on); };

    // ── Distance tab handlers ─────────────────────────────────────────────────

    function _rfGetReceiverPos() {
        try {
            var c = g.map.getView().getCenter();
            if (window.ol && ol.proj && ol.proj.toLonLat) {
                var ll = ol.proj.toLonLat(c);
                return { lat: ll[1], lon: ll[0] };
            }
            if (c && c.length >= 2) return { lat: c[1], lon: c[0] };
        } catch(e) {}
        try { if (typeof SiteLat !== 'undefined') return { lat: SiteLat, lon: SiteLon }; } catch(e) {}
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

        // Destroy stale map if container was recreated
        if (_distMap) {
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
        }).setView([lat, lon], 8);

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

    window._rfDistSelectLoc = function (val) {
        var idx = parseInt(val, 10);
        if (isNaN(idx) || idx < 0 || idx >= _distanceLocations.length) {
            _distanceForm.locationIdx = -1;
            buildPanel();
            return;
        }
        var loc = _distanceLocations[idx];
        _distanceForm.locationIdx  = idx;
        _distanceForm.locationName = loc.name;
        _distanceForm.lat          = String(loc.lat);
        _distanceForm.lon          = String(loc.lon);
        _distanceForm.radiusNm     = String(loc.radiusNm);
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
        buildPanel();
    };

    window._rfDistDeleteLoc = function () {
        var idx = _distanceForm.locationIdx;
        if (idx < 0 || idx >= _distanceLocations.length) return;
        _distanceLocations.splice(idx, 1);
        _distanceForm.locationIdx = -1;
        try { localStorage.setItem(DIST_LS_KEY, JSON.stringify(_distanceLocations)); } catch (e) {}
        buildPanel();
    };

    window._rfDistAltMode = function (mode) {
        _distanceForm.altMode = mode;
        var rangeEl = document.getElementById('rf-dist-alt-range');
        if (rangeEl) rangeEl.style.display = mode === 'between' ? '' : 'none';
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

        _distanceFilter.lat          = lat;
        _distanceFilter.lon          = lon;
        _distanceFilter.radiusNm     = radius;
        _distanceFilter.locationName = _distanceForm.locationName.trim() || (lat.toFixed(4) + ',' + lon.toFixed(4));
        _distanceFilter.altMode      = _distanceForm.altMode;
        if (_distanceFilter.altMode === 'between') {
            _distanceFilter.altMin = parseInt(_distanceForm.altMin, 10) || 0;
            _distanceFilter.altMax = parseInt(_distanceForm.altMax, 10) || 50000;
        }
        _distanceFilter.active = true;
        console.log('[RF] Distance filter applied:', JSON.stringify(_distanceFilter));
        console.log('[RF] isFilterActive:', isFilterActive(), '| customFilter:', typeof window.customFilter);
        applyFilter();
        buildPanel();
    };

    window._rfDistClear = function () {
        _distanceFilter.active = false;
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
        _distanceFilter.active = false;
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
    };

    // ── Toggle panel ──────────────────────────────────────────────────────────
    function togglePanel() {
        state.panelOpen = !state.panelOpen;
        var panel = document.getElementById('rf-panel');
        if (!panel) return;
        panel.style.display = state.panelOpen ? 'flex' : 'none';
        if (state.panelOpen) { applyPanelMode(); buildPanel(); }
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

    // ── DOM injection ─────────────────────────────────────────────────────────
    function inject() {
        var headerSide = document.getElementById('header_side');
        if (!headerSide || document.getElementById('rf-btn')) return;

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
            '  <button class="rf-close" onclick="window._rfClosePanel()">&#x2715;</button>',
            '</div>',
            '<div id="rf-breadcrumb" class="rf-breadcrumb" style="display:none"></div>',
            '<input id="rf-search" class="rf-search" type="text" placeholder="Search\u2026" oninput="window._rfOnSearch(this.value)">',
            '<div class="rf-tabs">',
            '  <div id="rf-tab-summary"   class="rf-tab rf-tab-active" onclick="window._rfSwitchTab(\'summary\')">Summary</div>',
            '  <div id="rf-tab-airports"  class="rf-tab"               onclick="window._rfSwitchTab(\'airports\')">Airports</div>',
            '  <div id="rf-tab-countries" class="rf-tab"               onclick="window._rfSwitchTab(\'countries\')">Countries</div>',
            '  <div id="rf-tab-operators" class="rf-tab"               onclick="window._rfSwitchTab(\'operators\')">Operators</div>',
            '  <div id="rf-tab-aircraft"  class="rf-tab"               onclick="window._rfSwitchTab(\'aircraft\')">Aircraft</div>',
            '  <div id="rf-tab-alerts"    class="rf-tab"               onclick="window._rfSwitchTab(\'alerts\')">Alerts</div>',
            '  <div id="rf-tab-distance"  class="rf-tab"               onclick="window._rfSwitchTab(\'distance\')">Distance</div>',
            '  <div id="rf-tab-settings"  class="rf-tab rf-tab-gear"   onclick="window._rfSwitchTab(\'settings\')">&#9881;</div>',
            '</div>',
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

        // Load persisted settings
        try {
            var sv = localStorage.getItem(SETTINGS_KEY);
            if (sv) { var sp = JSON.parse(sv); if (typeof sp.inView === 'boolean') settings.inView = sp.inView; if (sp.displayMode === 'popup' || sp.displayMode === 'sidebar') settings.displayMode = sp.displayMode; if (sp.sidebarSide === 'left') settings.sidebarSide = 'left'; if (typeof sp.useLocalDb === 'boolean') settings.useLocalDb = sp.useLocalDb; }
            applyPanelMode();
            if (settings.useLocalDb) _dbAutoSync();
        } catch (e) {}
        try {
            var tv = localStorage.getItem(TAB_VIS_KEY);
            if (tv) {
                var tp = JSON.parse(tv);
                Object.keys(_tabVisibility).forEach(function (k) {
                    if (tp.hasOwnProperty(k)) _tabVisibility[k] = !!tp[k];
                });
            }
        } catch (e) {}
        try {
            var distSaved = localStorage.getItem(DIST_LS_KEY);
            if (distSaved) _distanceLocations = JSON.parse(distSaved) || [];
        } catch (e) { _distanceLocations = []; }

        installFilterHook();

        // Apply initial tab visibility
        Object.keys(_tabVisibility).forEach(function (k) {
            if (!_tabVisibility[k]) {
                var tabEl = document.getElementById('rf-tab-' + k);
                if (tabEl) tabEl.style.display = 'none';
            }
        });

        if (_tabVisibility.alerts) loadAlerts(false);

        // Also update tab active highlight correctly (tabs are managed via class, not DOM state)
        // Re-wire _rfSwitchTab to update tab highlights
        var origSwitch = window._rfSwitchTab;
        window._rfSwitchTab = function (tab) {
            ['summary','airports','countries','operators','aircraft','alerts','distance','settings'].forEach(function (t) {
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
                        if (_distanceFilter.active) {
                            var cnt2 = 0;
                            for (var ti = 0; ti < g.planesOrdered.length; ti++) {
                                if (planePassesDistanceFilter(g.planesOrdered[ti])) cnt2++;
                            }
                            statusEl2.textContent = cnt2 + ' aircraft in zone';
                        } else {
                            statusEl2.textContent = '';
                        }
                    }
                } else {
                    buildPanel();
                }
            }
            if (isFilterActive()) triggerRedraw();
        }, 3000);
    }

    // ── Debug helper ──────────────────────────────────────────────────────────
    window.rfDebug = function () {
        try {
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
        } catch (e) {
            console.error('[RF] debug error:', e);
        }
    };

    console.log('[robs-filter] loaded - run window.rfDebug() in console to inspect data');

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
