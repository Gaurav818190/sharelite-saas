"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";

type GeoRange = "today" | "7d" | "30d" | "custom";
type GeoMetric = "leads" | "valid" | "contacted" | "converted";

type CountryStats = {
  code: string;
  name: string;
  leads: number;
  valid: number;
  contacted: number;
  converted: number;
};

type TopCountry = CountryStats & { rank: number };
type GeoResponse = { countries?: CountryStats[]; topCountries?: TopCountry[] };

const WORLD_MAP_URL = "/world.json";

const getFlag = (code: string) => {
  const normalized = code.trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(normalized)) {
    return "🌐";
  }

  return String.fromCodePoint(
    ...normalized
      .split("")
      .map((letter) => 127397 + letter.charCodeAt(0)),
  );
};

const WavingFlag = ({
  code,
  className = "",
}: {
  code: string;
  className?: string;
}) => (
  <span
    className={`sharelite-waving-flag inline-block origin-left ${className}`}
    role="img"
    aria-label={`${getCountryDisplayName(code)} flag`}
  >
    {getFlag(code)}
  </span>
);

const wavingFlagMarkup = (code: string) =>
  `<span class="sharelite-waving-flag" aria-hidden="true">${getFlag(code)}</span>`;

const COUNTRY_CODE_BY_NAME: Record<string, string> = {
  "aruba": "AW",
  "afghanistan": "AF",
  "angola": "AO",
  "anguilla": "AI",
  "åland islands": "AX",
  "albania": "AL",
  "andorra": "AD",
  "united arab emirates": "AE",
  "argentina": "AR",
  "armenia": "AM",
  "american samoa": "AS",
  "antarctica": "AQ",
  "french southern territories": "TF",
  "antigua and barbuda": "AG",
  "australia": "AU",
  "austria": "AT",
  "azerbaijan": "AZ",
  "burundi": "BI",
  "belgium": "BE",
  "benin": "BJ",
  "bonaire, sint eustatius and saba": "BQ",
  "burkina faso": "BF",
  "bangladesh": "BD",
  "bulgaria": "BG",
  "bahrain": "BH",
  "bahamas": "BS",
  "bosnia and herzegovina": "BA",
  "saint barthélemy": "BL",
  "belarus": "BY",
  "belize": "BZ",
  "bermuda": "BM",
  "bolivia, plurinational state of": "BO",
  "brazil": "BR",
  "barbados": "BB",
  "brunei darussalam": "BN",
  "bhutan": "BT",
  "bouvet island": "BV",
  "botswana": "BW",
  "central african republic": "CF",
  "canada": "CA",
  "cocos (keeling) islands": "CC",
  "switzerland": "CH",
  "chile": "CL",
  "china": "CN",
  "côte d'ivoire": "CI",
  "cameroon": "CM",
  "congo, the democratic republic of the": "CD",
  "congo": "CG",
  "cook islands": "CK",
  "colombia": "CO",
  "comoros": "KM",
  "cabo verde": "CV",
  "costa rica": "CR",
  "cuba": "CU",
  "curaçao": "CW",
  "christmas island": "CX",
  "cayman islands": "KY",
  "cyprus": "CY",
  "czechia": "CZ",
  "germany": "DE",
  "djibouti": "DJ",
  "dominica": "DM",
  "denmark": "DK",
  "dominican republic": "DO",
  "algeria": "DZ",
  "ecuador": "EC",
  "egypt": "EG",
  "eritrea": "ER",
  "western sahara": "EH",
  "spain": "ES",
  "estonia": "EE",
  "ethiopia": "ET",
  "finland": "FI",
  "fiji": "FJ",
  "falkland islands (malvinas)": "FK",
  "france": "FR",
  "faroe islands": "FO",
  "micronesia, federated states of": "FM",
  "gabon": "GA",
  "united kingdom": "GB",
  "georgia": "GE",
  "guernsey": "GG",
  "ghana": "GH",
  "gibraltar": "GI",
  "guinea": "GN",
  "guadeloupe": "GP",
  "gambia": "GM",
  "guinea-bissau": "GW",
  "equatorial guinea": "GQ",
  "greece": "GR",
  "grenada": "GD",
  "greenland": "GL",
  "guatemala": "GT",
  "french guiana": "GF",
  "guam": "GU",
  "guyana": "GY",
  "hong kong": "HK",
  "heard island and mcdonald islands": "HM",
  "honduras": "HN",
  "croatia": "HR",
  "haiti": "HT",
  "hungary": "HU",
  "indonesia": "ID",
  "isle of man": "IM",
  "india": "IN",
  "british indian ocean territory": "IO",
  "ireland": "IE",
  "iran, islamic republic of": "IR",
  "iraq": "IQ",
  "iceland": "IS",
  "israel": "IL",
  "italy": "IT",
  "jamaica": "JM",
  "jersey": "JE",
  "jordan": "JO",
  "japan": "JP",
  "kazakhstan": "KZ",
  "kenya": "KE",
  "kyrgyzstan": "KG",
  "cambodia": "KH",
  "kiribati": "KI",
  "saint kitts and nevis": "KN",
  "korea, republic of": "KR",
  "kuwait": "KW",
  "lao people's democratic republic": "LA",
  "lebanon": "LB",
  "liberia": "LR",
  "libya": "LY",
  "saint lucia": "LC",
  "liechtenstein": "LI",
  "sri lanka": "LK",
  "lesotho": "LS",
  "lithuania": "LT",
  "luxembourg": "LU",
  "latvia": "LV",
  "macao": "MO",
  "saint martin (french part)": "MF",
  "morocco": "MA",
  "monaco": "MC",
  "moldova, republic of": "MD",
  "madagascar": "MG",
  "maldives": "MV",
  "mexico": "MX",
  "marshall islands": "MH",
  "north macedonia": "MK",
  "mali": "ML",
  "malta": "MT",
  "myanmar": "MM",
  "montenegro": "ME",
  "mongolia": "MN",
  "northern mariana islands": "MP",
  "mozambique": "MZ",
  "mauritania": "MR",
  "montserrat": "MS",
  "martinique": "MQ",
  "mauritius": "MU",
  "malawi": "MW",
  "malaysia": "MY",
  "mayotte": "YT",
  "namibia": "NA",
  "new caledonia": "NC",
  "niger": "NE",
  "norfolk island": "NF",
  "nigeria": "NG",
  "nicaragua": "NI",
  "niue": "NU",
  "netherlands": "NL",
  "norway": "NO",
  "nepal": "NP",
  "nauru": "NR",
  "new zealand": "NZ",
  "oman": "OM",
  "pakistan": "PK",
  "panama": "PA",
  "pitcairn": "PN",
  "peru": "PE",
  "philippines": "PH",
  "palau": "PW",
  "papua new guinea": "PG",
  "poland": "PL",
  "puerto rico": "PR",
  "korea, democratic people's republic of": "KP",
  "portugal": "PT",
  "paraguay": "PY",
  "palestine, state of": "PS",
  "french polynesia": "PF",
  "qatar": "QA",
  "réunion": "RE",
  "romania": "RO",
  "russian federation": "RU",
  "rwanda": "RW",
  "saudi arabia": "SA",
  "sudan": "SD",
  "senegal": "SN",
  "singapore": "SG",
  "south georgia and the south sandwich islands": "GS",
  "saint helena, ascension and tristan da cunha": "SH",
  "svalbard and jan mayen": "SJ",
  "solomon islands": "SB",
  "sierra leone": "SL",
  "el salvador": "SV",
  "san marino": "SM",
  "somalia": "SO",
  "saint pierre and miquelon": "PM",
  "serbia": "RS",
  "south sudan": "SS",
  "sao tome and principe": "ST",
  "suriname": "SR",
  "slovakia": "SK",
  "slovenia": "SI",
  "sweden": "SE",
  "eswatini": "SZ",
  "sint maarten (dutch part)": "SX",
  "seychelles": "SC",
  "syrian arab republic": "SY",
  "turks and caicos islands": "TC",
  "chad": "TD",
  "togo": "TG",
  "thailand": "TH",
  "tajikistan": "TJ",
  "tokelau": "TK",
  "turkmenistan": "TM",
  "timor-leste": "TL",
  "tonga": "TO",
  "trinidad and tobago": "TT",
  "tunisia": "TN",
  "türkiye": "TR",
  "tuvalu": "TV",
  "taiwan, province of china": "TW",
  "tanzania, united republic of": "TZ",
  "uganda": "UG",
  "ukraine": "UA",
  "united states minor outlying islands": "UM",
  "uruguay": "UY",
  "united states": "US",
  "uzbekistan": "UZ",
  "holy see (vatican city state)": "VA",
  "saint vincent and the grenadines": "VC",
  "venezuela, bolivarian republic of": "VE",
  "virgin islands, british": "VG",
  "virgin islands, u.s.": "VI",
  "viet nam": "VN",
  "vanuatu": "VU",
  "wallis and futuna": "WF",
  "samoa": "WS",
  "yemen": "YE",
  "south africa": "ZA",
  "zambia": "ZM",
  "zimbabwe": "ZW",
  "russia": "RU",
  "united states of america": "US",
  "south korea": "KR",
  "republic of korea": "KR",
  "north korea": "KP",
  "iran": "IR",
  "iran (islamic republic of)": "IR",
  "vietnam": "VN",
  "laos": "LA",
  "bolivia": "BO",
  "bolivia (plurinational state of)": "BO",
  "venezuela": "VE",
  "venezuela (bolivarian republic of)": "VE",
  "tanzania": "TZ",
  "moldova": "MD",
  "syria": "SY",
  "brunei": "BN",
  "czech republic": "CZ",
  "turkey": "TR",
  "swaziland": "SZ",
  "macedonia": "MK",
  "palestine": "PS",
  "state of palestine": "PS",
  "taiwan": "TW",
  "east timor": "TL",
  "democratic republic of the congo": "CD",
  "republic of the congo": "CG",
  "ivory coast": "CI",
  "cape verde": "CV",
  "micronesia": "FM",
  "federated states of micronesia": "FM",
  "the bahamas": "BS",
  "the gambia": "GM",
  "curacao": "CW",
  "reunion": "RE",
  "kosovo": "XK",
};

const COUNTRY_NAME_ALIASES: Record<string, string> = {
  "russia": "RU",
  "united states of america": "US",
  "south korea": "KR",
  "north korea": "KP",
  "iran": "IR",
  "vietnam": "VN",
  "laos": "LA",
  "bolivia": "BO",
  "venezuela": "VE",
  "tanzania": "TZ",
  "moldova": "MD",
  "syria": "SY",
  "brunei": "BN",
  "czech republic": "CZ",
  "turkey": "TR",
  "swaziland": "SZ",
  "macedonia": "MK",
  "palestine": "PS",
  "east timor": "TL",
  "ivory coast": "CI",
  "cape verde": "CV",
  "bahamas": "BS",
  "the bahamas": "BS",
  "gambia": "GM",
  "the gambia": "GM",
  "curacao": "CW",
  "reunion": "RE",
  "kosovo": "XK",
};

const getCountryCodeFromName = (name: string) => {
  const normalized = name.trim().toLowerCase();
  return COUNTRY_CODE_BY_NAME[normalized] ?? COUNTRY_NAME_ALIASES[normalized] ?? null;
};
const getMetricValue = (country: CountryStats, metric: GeoMetric) => country[metric];

const getCountryDisplayName = (code: string, name?: string | null) => {
  const normalizedCode = code.trim().toUpperCase();
  const cleanedName = typeof name === "string" ? name.trim() : "";

  // Never show an ISO country code as the user-facing country name.
  if (cleanedName && !/^[A-Z]{2}$/.test(cleanedName.toUpperCase())) {
    return cleanedName;
  }

  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    return displayNames.of(normalizedCode) ?? (cleanedName || normalizedCode);
  } catch {
    return cleanedName || normalizedCode;
  }
};
const getMetricLabel = (metric: GeoMetric) =>
  metric === "valid" ? "Valid Leads" : metric === "contacted" ? "Contacted" : metric === "converted" ? "Converted" : "Leads";

export default function GeoAnalytics() {
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [range, setRange] = useState<GeoRange>("7d");
  const [metric, setMetric] = useState<GeoMetric>("leads");
  const [search, setSearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GeoResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(WORLD_MAP_URL);
        if (!response.ok) throw new Error("Unable to load world map.");
        const worldJson = await response.json();
        if (cancelled) return;
        echarts.registerMap("sharelite-world", worldJson);
        setMapReady(true);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load world map.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ range, metric });
        if (range === "custom" && customFrom) params.set("from", customFrom);
        if (range === "custom" && customTo) params.set("to", customTo);
        const response = await fetch(`/api/geo-analytics?${params.toString()}`, { cache: "no-store" });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error ?? "Unable to load Geo Analytics.");
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(err instanceof Error ? err.message : "Unable to load Geo Analytics.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [range, metric, customFrom, customTo]);

  const countries = useMemo(
    () => (data?.countries ?? []).map((country) => ({
      ...country,
      name: getCountryDisplayName(country.code, country.name),
    })),
    [data],
  );
  const topCountries = useMemo(
    () => (data?.topCountries ?? []).map((country) => ({
      ...country,
      name: getCountryDisplayName(country.code, country.name),
    })),
    [data],
  );
  const filteredCountries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return topCountries;
    return countries
      .filter(c => c.name.toLowerCase().includes(query) || c.code.toLowerCase().includes(query))
      .sort((a, b) => getMetricValue(b, metric) - getMetricValue(a, metric))
      .slice(0, 10)
      .map((country, index) => ({
        ...country,
        name: getCountryDisplayName(country.code, country.name),
        rank: index + 1,
      }));
  }, [countries, metric, search, topCountries]);

  const mapData = useMemo(() => countries.map(country => ({
    name: country.name,
    value: getMetricValue(country, metric),
    countryCode: country.code,
    leads: country.leads,
    valid: country.valid,
    contacted: country.contacted,
    converted: country.converted,
  })), [countries, metric]);

  const maxValue = useMemo(() => Math.max(1, ...mapData.map(item => typeof item.value === "number" ? item.value : 0)), [mapData]);
  const selectedCountryData = selectedCountry ? countries.find(c => c.code === selectedCountry) ?? null : null;

  const chartOption = useMemo(() => ({
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      backgroundColor: "#10213D",
      borderColor: "#10213D",
      borderWidth: 0,
      padding: 12,
      textStyle: { color: "#fff", fontSize: 11 },
      extraCssText: "box-shadow:0 12px 30px rgba(15,32,61,.25);border-radius:10px;",
      formatter: (params: any) => {
        const country = params?.data;
        const countryCode = country?.countryCode ?? getCountryCodeFromName(String(params?.name ?? country?.name ?? ""));
        const countryName = getCountryDisplayName(countryCode ?? "", String(params?.name ?? country?.name ?? ""));

        if (!country) {
          return `<div style="min-width:165px"><div style="font-size:13px;font-weight:800">${wavingFlagMarkup(countryCode ?? "")} ${countryName}</div></div>`;
        }

        return `<div style="min-width:165px"><div style="font-size:13px;font-weight:800;margin-bottom:8px">${wavingFlagMarkup(countryCode ?? "")} ${countryName}</div><div style="margin:5px 0">Leads: <b>${country.leads ?? 0}</b></div><div style="margin:5px 0">Valid Leads: <b>${country.valid ?? 0}</b></div><div style="margin:5px 0">Contacted: <b>${country.contacted ?? 0}</b></div><div style="margin:5px 0">Converted: <b>${country.converted ?? 0}</b></div></div>`;
      },
    },
    visualMap: {
      min: 0,
      max: maxValue,
      left: 18,
      bottom: 18,
      calculable: true,
      text: ["High", "Low"],
      textStyle: { color: "#64748B", fontSize: 9 },
      inRange: { color: ["#DCEEFF", "#A8D5FF", "#70B8FF", "#3B92F6", "#1769FF", "#0645C0"] },
      outOfRange: { color: "#D8E1EC" },
    },
    series: [{
      name: getMetricLabel(metric),
      type: "map",
      map: "sharelite-world",
      roam: true,
      // Enlarges only the map; the outer card remains 520px high.
      layoutCenter: ["50%", "48%"],
      layoutSize: "95%",
      selectedMode: "single",
      emphasis: { label: { show: false }, itemStyle: { areaColor: "#1769FF", borderColor: "#fff", borderWidth: 1 } },
      select: { itemStyle: { areaColor: "#0645C0", borderColor: "#fff", borderWidth: 1 } },
      itemStyle: { areaColor: "#D8E1EC", borderColor: "#fff", borderWidth: 0.7 },
      data: mapData,
    }],
  }), [mapData, maxValue, metric]);

  const focusCountry = (code: string) => {
  setSelectedCountry(code);

  const country = countries.find((c) => c.code === code);
  if (!country || !chartRef.current) return;

  chartRef.current.dispatchAction({
    type: "mapSelect",
    seriesIndex: 0,
    name: country.name,
  });
};

  const resetView = () => {
  setRange("7d");
  setMetric("leads");
  setSearch("");
  setCustomFrom("");
  setCustomTo("");
  setSelectedCountry(null);

  chartRef.current?.dispatchAction({
    type: "restore",
  });
};

  const downloadReport = () => {
    if (!countries.length) return;
    const header = "Country,Leads,Valid Leads,Contacted,Converted";
    const rows = countries.map(c => [getCountryDisplayName(c.code, c.name), c.leads, c.valid, c.contacted, c.converted].map(v => `"${String(v).replaceAll('"', '""')}"`).join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sharelite-geo-analytics.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <style jsx>{`
        .sharelite-waving-flag {
          display: inline-block;
          transform-origin: left center;
          animation: sharelite-flag-wave 1.8s ease-in-out infinite;
          will-change: transform;
          filter: drop-shadow(0 2px 2px rgba(15, 32, 61, 0.12));
        }

        @keyframes sharelite-flag-wave {
          0%,
          100% {
            transform: perspective(80px) rotateY(0deg) skewY(0deg);
          }
          25% {
            transform: perspective(80px) rotateY(-10deg) skewY(1deg);
          }
          50% {
            transform: perspective(80px) rotateY(0deg) skewY(-1deg);
          }
          75% {
            transform: perspective(80px) rotateY(10deg) skewY(1deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .sharelite-waving-flag { animation: none; }
        }
      `}</style>
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#DCE5F0] bg-transparent text-xl text-[#10213D]">🌐</div>
          <div>
            <h1 className="text-[22px] font-black tracking-[-0.04em] text-[#10213D]">Geo Analytics</h1>
            <p className="mt-0.5 text-[11px] font-medium text-[#71819B]">Track your global outreach performance with real-time geographical insights.</p>
          </div>
        </div>
        <select value={range} onChange={e => setRange(e.target.value as GeoRange)} className="rounded-lg border border-[#DCE5F0] bg-white px-4 py-2.5 text-[11px] font-bold text-[#10213D] outline-none focus:border-blue-500">
          <option value="today">Today</option><option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option><option value="custom">Custom</option>
        </select>
      </div>

      {range === "custom" && <div className="flex flex-wrap gap-3 rounded-xl border border-[#DCE5F0] bg-white p-4">
        <label><div className="mb-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#7A8AA3]">From</div><input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="rounded-lg border border-[#DCE5F0] px-3 py-2 text-[11px] outline-none focus:border-blue-500" /></label>
        <label><div className="mb-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#7A8AA3]">To</div><input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="rounded-lg border border-[#DCE5F0] px-3 py-2 text-[11px] outline-none focus:border-blue-500" /></label>
      </div>}

      <div className="rounded-xl border border-[#DCE5F0] bg-white p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_220px_minmax(0,1fr)_auto] md:items-end">
          <label><div className="mb-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#71819B]">Metric</div><select value={metric} onChange={e => setMetric(e.target.value as GeoMetric)} className="w-full rounded-lg border border-[#DCE5F0] bg-white px-3 py-2.5 text-[11px] font-bold text-[#10213D] outline-none focus:border-blue-500"><option value="leads">👥 Leads</option><option value="valid">✓ Valid Leads</option><option value="contacted">✉ Contacted</option><option value="converted">◉ Converted</option></select></label>
          <label><div className="mb-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#71819B]">Time Range</div><select value={range} onChange={e => setRange(e.target.value as GeoRange)} className="w-full rounded-lg border border-[#DCE5F0] bg-white px-3 py-2.5 text-[11px] font-bold text-[#10213D] outline-none focus:border-blue-500"><option value="today">Today</option><option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option><option value="custom">Custom</option></select></label>
          <div />
          <button type="button" onClick={resetView} className="w-full rounded-lg border border-[#DCE5F0] bg-white px-4 py-2.5 text-[11px] font-bold text-[#243754] transition hover:border-blue-300 hover:bg-blue-50 md:w-auto">↻ &nbsp; Reset View</button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-semibold text-red-600">{error}</div>}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="overflow-hidden rounded-xl border border-[#DCE5F0] bg-white">
          <div className="border-b border-[#E7EDF5] px-4 py-3"><div className="text-[13px] font-black text-[#10213D]">Global Outreach Map</div><div className="mt-0.5 text-[10px] text-[#7A8AA3]">Country-level outreach activity</div></div>
          <div className="relative">
            {!mapReady || loading ? <div className="flex h-[520px] items-center justify-center"><div className="text-center"><div className="text-4xl opacity-60">🌐</div><div className="mt-3 text-[13px] font-black text-[#10213D]">{loading ? "Loading Geo Analytics..." : "Loading World Map..."}</div><div className="mt-1 text-[10px] text-[#7A8AA3]">Preparing your country activity.</div></div></div> :
              <ReactECharts
  option={chartOption}
  onChartReady={(instance) => {
    chartRef.current = instance;
  }}
                style={{ width: "100%", height: "520px" }}
                onEvents={{
                  click: (params: any) => {
                    const code = params?.data?.countryCode;
                    if (code) setSelectedCountry(code);
                  },
                  mouseover: (params: any) => {
  if (
    chartRef.current &&
    params?.componentType === "series" &&
    params?.seriesType === "map"
  ) {
    chartRef.current.getZr().setCursorStyle("zoom-in");
  }
},
mouseout: () => {
  chartRef.current?.getZr().setCursorStyle("default");
},
                }}
                notMerge
                lazyUpdate
              />}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#DCE5F0] bg-white">
          <div className="border-b border-[#E7EDF5] px-4 py-4"><div className="text-[15px] font-black text-[#10213D]">Top Countries</div><div className="mt-1 text-[10px] text-[#7A8AA3]">Countries with the most leads</div></div>
          <div className="p-3">
            <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A9AB2]">⌕</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search country..." className="w-full rounded-lg border border-[#DCE5F0] bg-white py-2.5 pl-9 pr-3 text-[11px] outline-none focus:border-blue-500" /></div>
            <div className="mt-3">
              <div className="grid grid-cols-[30px_minmax(0,1fr)_70px] gap-2 border-b border-[#E7EDF5] px-2 py-2.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#71819B]"><span>#</span><span>Country</span><span className="text-right">Leads</span></div>
              {filteredCountries.length === 0 ? <div className="px-3 py-14 text-center"><div className="text-[11px] font-bold text-[#64748B]">No geo data yet</div><div className="mt-1 text-[9px] text-[#94A3B8]">Country activity will appear when leads contain country data.</div></div> : <div className="max-h-[430px] overflow-y-auto">{filteredCountries.map(country => <button key={country.code} type="button" onClick={() => focusCountry(country.code)} className={`grid w-full grid-cols-[30px_minmax(0,1fr)_70px] items-center gap-2 border-b border-[#EEF2F7] px-2 py-3 text-left transition ${selectedCountry === country.code ? "bg-blue-50" : "hover:bg-[#F7FAFE]"}`}><span className="text-[10px] font-bold text-[#64748B]">{country.rank}</span><span className="flex min-w-0 items-center gap-2"><WavingFlag code={country.code} className="text-[17px]" /><span className="truncate text-[11px] font-semibold text-[#10213D]">{country.name}</span></span><span className="text-right text-[11px] font-black text-[#10213D]">{country.leads}</span></button>)}</div>}
            </div>
          </div>
        </div>
      </div>

      {selectedCountryData && <div className="rounded-xl border border-[#DCE5F0] bg-white p-5"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#DCE5F0] bg-[#F5F9FF] text-2xl"><WavingFlag code={selectedCountryData.code} className="text-2xl" /></div><div><div className="text-[15px] font-black text-[#10213D]">{selectedCountryData.name}</div><div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#7A8AA3]">Selected Country</div></div></div><div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">{[["Leads", selectedCountryData.leads, "text-blue-600"], ["Valid Leads", selectedCountryData.valid, "text-emerald-600"], ["Contacted", selectedCountryData.contacted, "text-violet-600"], ["Converted", selectedCountryData.converted, "text-orange-500"]].map(([label, value, color]) => <div key={String(label)} className="rounded-lg border border-[#DCE5F0] bg-white p-3"><div className={`text-[9px] font-black uppercase tracking-[0.08em] ${color}`}>{label}</div><div className="mt-1 text-[22px] font-black text-[#10213D]">{value}</div></div>)}</div></div>}

      <div className="flex justify-end"><button type="button" onClick={downloadReport} disabled={!countries.length} className="rounded-lg bg-blue-600 px-4 py-2.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">↓ &nbsp; Download Data</button></div>
    </div>
  );
}
