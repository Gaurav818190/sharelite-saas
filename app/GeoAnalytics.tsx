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
  if (!/^[A-Z]{2}$/.test(normalized)) return "🌐";
  return String.fromCodePoint(
    ...normalized.split("").map((letter) => 127397 + letter.charCodeAt(0)),
  );
};

const getCountryDisplayName = (code: string, name?: string | null) => {
  const normalized = code.trim().toUpperCase();
  const cleaned = typeof name === "string" ? name.trim() : "";
  if (cleaned && !/^[A-Z]{2}$/.test(cleaned.toUpperCase())) return cleaned;
  try {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    return names.of(normalized) ?? (cleaned || normalized);
  } catch {
    return cleaned || normalized;
  }
};

const ECHARTS_MAP_NAMES: Record<string, string> = {
  US: "United States of America",
  GB: "United Kingdom",
  RU: "Russia",
  KR: "South Korea",
  KP: "North Korea",
  IR: "Iran",
  SY: "Syria",
  TZ: "Tanzania",
  BO: "Bolivia",
  VE: "Venezuela",
  LA: "Laos",
  VN: "Vietnam",
  MD: "Moldova",
  CZ: "Czech Republic",
  CD: "Democratic Republic of the Congo",
  CG: "Republic of the Congo",
  MM: "Myanmar",
  MK: "North Macedonia",
  PS: "Palestine",
  CI: "Ivory Coast",
  BN: "Brunei",
  TL: "East Timor",
};

const getMapCountryName = (country: CountryStats) =>
  ECHARTS_MAP_NAMES[country.code.toUpperCase()] ?? country.name;

const getMetricValue = (country: CountryStats, metric: GeoMetric) => country[metric];
const getMetricLabel = (metric: GeoMetric) => {
  if (metric === "valid") return "Valid Leads";
  if (metric === "contacted") return "Contacted";
  if (metric === "converted") return "Converted";
  return "Leads";
};

const WavingFlag = ({ code, className = "" }: { code: string; className?: string }) => (
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

    const loadWorldMap = async () => {
      const sources = [
        WORLD_MAP_URL,
        "https://cdn.jsdelivr.net/npm/echarts@5/map/json/world.json",
      ];

      for (const source of sources) {
        try {
          const response = await fetch(source, { cache: "force-cache" });
          if (!response.ok) continue;

          const worldJson = await response.json();
          if (cancelled) return;

          echarts.registerMap("sharelite-world", worldJson);
          setMapReady(true);
          setError(null);
          return;
        } catch {
          // Try the next source.
        }
      }

      if (!cancelled) {
        setMapReady(false);
        setError("World map could not be loaded. Please check the world.json file in /public.");
      }
    };

    loadWorldMap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !chartRef.current) return;
    const timer = window.setTimeout(() => chartRef.current?.resize(), 50);
    const onResize = () => chartRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [mapReady]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
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
          setSelectedCountry(null);
          setError(err instanceof Error ? err.message : "Unable to load Geo Analytics.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [range, metric, customFrom, customTo]);

  const countries = useMemo(
    () => (data?.countries ?? []).map((country) => ({ ...country, name: getCountryDisplayName(country.code, country.name) })),
    [data],
  );

  const topCountries = useMemo(
    () => (data?.topCountries ?? []).map((country) => ({ ...country, name: getCountryDisplayName(country.code, country.name) })),
    [data],
  );

  const filteredCountries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return topCountries;
    return countries
      .filter((country) => country.name.toLowerCase().includes(query) || country.code.toLowerCase().includes(query))
      .sort((a, b) => getMetricValue(b, metric) - getMetricValue(a, metric))
      .slice(0, 10)
      .map((country, index) => ({ ...country, rank: index + 1 }));
  }, [countries, metric, search, topCountries]);

  const mapData = useMemo(
    () => countries.map((country) => ({
      name: getMapCountryName(country),
      value: getMetricValue(country, metric),
      countryCode: country.code,
      leads: country.leads,
      valid: country.valid,
      contacted: country.contacted,
      converted: country.converted,
    })),
    [countries, metric],
  );

  const maxValue = useMemo(
    () => Math.max(1, ...mapData.map((item) => typeof item.value === "number" ? item.value : 0)),
    [mapData],
  );

  // Keep the detail boxes visible even when the user has not clicked a country yet.
  // If nothing is selected, use the first country in the current metric ranking.
  const selectedCountryData = useMemo(() => {
    const preferredCode =
      selectedCountry ??
      topCountries[0]?.code ??
      countries[0]?.code ??
      null;

    return preferredCode
      ? countries.find((country) => country.code === preferredCode) ?? null
      : null;
  }, [countries, selectedCountry, topCountries]);

  const selectedFunnel = useMemo(() => {
    if (!selectedCountryData) return [];
    const leads = selectedCountryData.leads;
    const percentage = (value: number) => leads > 0 ? Math.min(100, (value / leads) * 100) : 0;
    return [
      { label: "Leads", value: leads, percentage: 100, color: "bg-blue-600", textColor: "text-blue-600" },
      { label: "Valid Leads", value: selectedCountryData.valid, percentage: percentage(selectedCountryData.valid), color: "bg-emerald-500", textColor: "text-emerald-600" },
      { label: "Contacted", value: selectedCountryData.contacted, percentage: percentage(selectedCountryData.contacted), color: "bg-violet-500", textColor: "text-violet-600" },
      { label: "Converted", value: selectedCountryData.converted, percentage: percentage(selectedCountryData.converted), color: "bg-orange-500", textColor: "text-orange-600" },
    ];
  }, [selectedCountryData]);

  const selectedCountryInsights = useMemo(() => {
    if (!selectedCountryData) return { validationRate: 0, contactRate: 0, conversionRate: 0, pipelineCompletion: 0 };
    const leads = selectedCountryData.leads;
    const rate = (value: number) => leads > 0 ? (value / leads) * 100 : 0;
    return {
      validationRate: rate(selectedCountryData.valid),
      contactRate: rate(selectedCountryData.contacted),
      conversionRate: rate(selectedCountryData.converted),
      pipelineCompletion: rate(selectedCountryData.converted),
    };
  }, [selectedCountryData]);

  const countryComparison = useMemo(() => {
    if (!selectedCountryData) return null;
    const totals = countries.reduce(
      (acc, country) => ({
        leads: acc.leads + country.leads,
        valid: acc.valid + country.valid,
        contacted: acc.contacted + country.contacted,
        converted: acc.converted + country.converted,
      }),
      { leads: 0, valid: 0, contacted: 0, converted: 0 },
    );
    const rate = (value: number, total: number) => total > 0 ? (value / total) * 100 : 0;
    return {
      selected: {
        validationRate: rate(selectedCountryData.valid, selectedCountryData.leads),
        contactRate: rate(selectedCountryData.contacted, selectedCountryData.leads),
        conversionRate: rate(selectedCountryData.converted, selectedCountryData.leads),
      },
      overall: {
        validationRate: rate(totals.valid, totals.leads),
        contactRate: rate(totals.contacted, totals.leads),
        conversionRate: rate(totals.converted, totals.leads),
      },
    };
  }, [countries, selectedCountryData]);

  const selectedMetricValue = selectedCountryData ? getMetricValue(selectedCountryData, metric) : 0;
  const totalMetricValue = countries.reduce((total, country) => total + getMetricValue(country, metric), 0);
  const selectedCountryShare = totalMetricValue > 0 ? (selectedMetricValue / totalMetricValue) * 100 : 0;

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
        if (!country) return `<div>${String(params?.name ?? "")}</div>`;
        const code = String(country.countryCode ?? "");
        const name = getCountryDisplayName(code, String(params?.name ?? country.name ?? ""));
        return `<div style="min-width:165px"><div style="font-size:13px;font-weight:800;margin-bottom:8px">${wavingFlagMarkup(code)} ${name}</div><div style="margin:5px 0">Leads: <b>${country.leads ?? 0}</b></div><div style="margin:5px 0">Valid Leads: <b>${country.valid ?? 0}</b></div><div style="margin:5px 0">Contacted: <b>${country.contacted ?? 0}</b></div><div style="margin:5px 0">Converted: <b>${country.converted ?? 0}</b></div></div>`;
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
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    setSelectedCountry(normalized);
    const country = countries.find((item) => item.code === normalized);
    if (!country || !chartRef.current) return;
    chartRef.current.dispatchAction({
      type: "mapSelect",
      seriesIndex: 0,
      name: getMapCountryName(country),
    });
  };

  const resetView = () => {
    setRange("7d");
    setMetric("leads");
    setSearch("");
    setCustomFrom("");
    setCustomTo("");
    setSelectedCountry(null);
    chartRef.current?.dispatchAction({ type: "restore" });
  };

  const downloadReport = () => {
    if (!countries.length) return;
    const header = "Country,Leads,Valid Leads,Contacted,Converted";
    const rows = countries.map((country) => [
      getCountryDisplayName(country.code, country.name),
      country.leads,
      country.valid,
      country.contacted,
      country.converted,
    ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
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
        .sharelite-waving-flag { display:inline-block; transform-origin:left center; animation:sharelite-flag-wave 1.8s ease-in-out infinite; will-change:transform; filter:drop-shadow(0 2px 2px rgba(15,32,61,.12)); }
        @keyframes sharelite-flag-wave { 0%,100%{transform:perspective(80px) rotateY(0deg) skewY(0deg)} 25%{transform:perspective(80px) rotateY(-10deg) skewY(1deg)} 50%{transform:perspective(80px) rotateY(0deg) skewY(-1deg)} 75%{transform:perspective(80px) rotateY(10deg) skewY(1deg)} }
        @media (prefers-reduced-motion:reduce){.sharelite-waving-flag{animation:none}}
      `}</style>

      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#DCE5F0] text-xl">🌐</div>
          <div>
            <h1 className="text-[22px] font-black tracking-[-0.04em] text-[#10213D]">Geo Analytics</h1>
            <p className="mt-0.5 text-[12px] font-medium text-[#71819B]">Track your global outreach performance with real-time geographical insights.</p>
          </div>
        </div>
        <select value={range} onChange={(e) => setRange(e.target.value as GeoRange)} className="rounded-lg border border-[#DCE5F0] bg-white px-4 py-2.5 text-[12px] font-bold text-[#10213D] outline-none focus:border-blue-500">
          <option value="today">Today</option><option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option><option value="custom">Custom</option>
        </select>
      </div>

      {range === "custom" && <div className="flex flex-wrap gap-3 rounded-xl border border-[#DCE5F0] bg-white p-4">
        <label><div className="mb-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#7A8AA3]">From</div><input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-lg border border-[#DCE5F0] px-3 py-2 text-[12px] outline-none focus:border-blue-500" /></label>
        <label><div className="mb-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#7A8AA3]">To</div><input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded-lg border border-[#DCE5F0] px-3 py-2 text-[12px] outline-none focus:border-blue-500" /></label>
      </div>}

      <div className="rounded-xl border border-[#DCE5F0] bg-white p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_220px_minmax(0,1fr)_auto] md:items-end">
          <label><div className="mb-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#71819B]">Metric</div><select value={metric} onChange={(e) => setMetric(e.target.value as GeoMetric)} className="w-full rounded-lg border border-[#DCE5F0] bg-white px-3 py-2.5 text-[12px] font-bold text-[#10213D] outline-none focus:border-blue-500"><option value="leads">Leads</option><option value="valid">Valid Leads</option><option value="contacted">Contacted</option><option value="converted">Converted</option></select></label>
          <label><div className="mb-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#71819B]">Time Range</div><select value={range} onChange={(e) => setRange(e.target.value as GeoRange)} className="w-full rounded-lg border border-[#DCE5F0] bg-white px-3 py-2.5 text-[12px] font-bold text-[#10213D] outline-none focus:border-blue-500"><option value="today">Today</option><option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option><option value="custom">Custom</option></select></label>
          <div />
          <button type="button" onClick={resetView} className="w-full rounded-lg border border-[#DCE5F0] bg-white px-4 py-2.5 text-[12px] font-bold text-[#243754] transition hover:border-blue-300 hover:bg-blue-50 md:w-auto">↻ &nbsp; Reset View</button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-600">{error}</div>}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="overflow-hidden rounded-xl border border-[#DCE5F0] bg-white">
          <div className="border-b border-[#E7EDF5] px-4 py-3"><div className="text-[14px] font-black text-[#10213D]">Global Outreach Map</div><div className="mt-0.5 text-[11px] text-[#7A8AA3]">Country-level outreach activity</div></div>
          <div className="relative">
            {!mapReady || loading ? <div className="flex h-[460px] items-center justify-center"><div className="text-center"><div className="text-4xl opacity-60">🌐</div><div className="mt-3 text-[14px] font-black text-[#10213D]">{loading ? "Loading Geo Analytics..." : "Loading World Map..."}</div><div className="mt-1 text-[10px] text-[#7A8AA3]">Preparing your country activity.</div></div></div> :
              <ReactECharts option={chartOption} onChartReady={(instance) => { chartRef.current = instance; }} style={{ width: "100%", height: "460px" }} onEvents={{
                click: (params: any) => { const code = params?.data?.countryCode; if (code) focusCountry(code); },
                mouseover: (params: any) => { if (chartRef.current && params?.componentType === "series" && params?.seriesType === "map") chartRef.current.getZr().setCursorStyle("zoom-in"); },
                mouseout: () => chartRef.current?.getZr().setCursorStyle("default"),
              }} notMerge lazyUpdate />}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#DCE5F0] bg-white">
          <div className="border-b border-[#E7EDF5] px-4 py-4"><div className="text-[16px] font-black text-[#10213D]">Top Countries</div><div className="mt-1 text-[12px] text-[#7A8AA3]">Countries with the most leads</div></div>
          <div className="p-3">
            <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A9AB2]">⌕</span><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search country..." className="w-full rounded-lg border border-[#DCE5F0] bg-white py-2.5 pl-9 pr-3 text-[12px] outline-none focus:border-blue-500" /></div>
            <div className="mt-3"><div className="grid grid-cols-[30px_minmax(0,1fr)_70px] gap-2 border-b border-[#E7EDF5] px-2 py-2.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#71819B]"><span>#</span><span>Country</span><span className="text-right">Leads</span></div>
              {filteredCountries.length === 0 ? <div className="px-3 py-14 text-center"><div className="text-[12px] font-bold text-[#64748B]">No geo data yet</div><div className="mt-1 text-[9px] text-[#94A3B8]">Country activity will appear when leads contain country data.</div></div> : <div className="max-h-[430px] overflow-y-auto">{filteredCountries.map((country) => <button key={country.code} type="button" onClick={() => focusCountry(country.code)} className={`grid w-full grid-cols-[30px_minmax(0,1fr)_70px] items-center gap-2 border-b border-[#EEF2F7] px-2 py-3 text-left transition ${selectedCountry === country.code ? "bg-blue-50" : "hover:bg-[#F7FAFE]"}`}><span className="text-[10px] font-bold text-[#64748B]">{country.rank}</span><span className="flex min-w-0 items-center gap-2"><WavingFlag code={country.code} className="text-[18px]" /><span className="truncate text-[12px] font-semibold text-[#10213D]">{country.name}</span></span><span className="text-right text-[12px] font-black text-[#10213D]">{country.leads}</span></button>)}</div>}
            </div>
          </div>
        </div>
      </div>

      {selectedCountryData && (
        <div className="rounded-xl border border-[#DCE5F0] bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#DCE5F0] bg-[#F5F9FF]">
                <WavingFlag code={selectedCountryData.code} className="text-xl" />
              </div>
              <div>
                <div className="text-[15px] font-black text-[#10213D]">{selectedCountryData.name}</div>
                <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#7A8AA3]">{selectedCountry ? "Selected country" : "Top country"}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[560px]">
              {[
                ["Leads", selectedCountryData.leads, "text-blue-600"],
                ["Valid Leads", selectedCountryData.valid, "text-emerald-600"],
                ["Contacted", selectedCountryData.contacted, "text-violet-600"],
                ["Converted", selectedCountryData.converted, "text-orange-500"],
              ].map(([label, value, color]) => (
                <div key={String(label)} className="rounded-lg border border-[#E7EDF5] bg-[#FAFCFF] px-3 py-2">
                  <div className={`text-[8px] font-black uppercase tracking-[0.08em] ${color}`}>{label}</div>
                  <div className="mt-0.5 text-[18px] font-black text-[#10213D]">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="min-h-[178px] rounded-xl border border-[#DCE5F0] bg-[#FBFDFF] p-3">
              <div className="text-[12px] font-black text-[#10213D]">Conversion Funnel</div>
              <div className="mt-0.5 text-[9px] text-[#7A8AA3]">Lead pipeline</div>
              <div className="mt-3 space-y-2.5">
                {selectedFunnel.map((stage) => (
                  <div key={stage.label}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[9px] font-bold text-[#243754]">{stage.label}</span>
                      <span className={`text-[9px] font-black ${stage.textColor}`}>{stage.value} · {stage.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#EAF0F6]">
                      <div className={`h-full rounded-full ${stage.color}`} style={{ width: `${stage.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="min-h-[178px] rounded-xl border border-[#DCE5F0] bg-[#FBFDFF] p-3">
              <div className="text-[12px] font-black text-[#10213D]">Lead Quality</div>
              <div className="mt-0.5 text-[9px] text-[#7A8AA3]">Country performance</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  ["Validation", selectedCountryInsights.validationRate, "text-emerald-600"],
                  ["Contact", selectedCountryInsights.contactRate, "text-violet-600"],
                  ["Conversion", selectedCountryInsights.conversionRate, "text-orange-500"],
                  ["Completion", selectedCountryInsights.pipelineCompletion, "text-blue-600"],
                ].map(([label, value, color]) => (
                  <div key={String(label)} className="rounded-lg border border-[#E7EDF5] bg-white p-2">
                    <div className="text-[8px] font-black uppercase tracking-[0.06em] text-[#7A8AA3]">{label}</div>
                    <div className={`mt-1 text-[16px] font-black ${color}`}>{Number(value).toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="min-h-[178px] rounded-xl border border-[#DCE5F0] bg-[#FBFDFF] p-3">
              <div className="text-[12px] font-black text-[#10213D]">Country vs World</div>
              <div className="mt-0.5 text-[9px] text-[#7A8AA3]">Rate comparison</div>
              <div className="mt-3 space-y-3">
                {countryComparison && [
                  ["Validation", countryComparison.selected.validationRate, countryComparison.overall.validationRate, "bg-emerald-500"],
                  ["Contact", countryComparison.selected.contactRate, countryComparison.overall.contactRate, "bg-violet-500"],
                  ["Conversion", countryComparison.selected.conversionRate, countryComparison.overall.conversionRate, "bg-orange-500"],
                ].map(([label, selected, overall, color]) => (
                  <div key={String(label)}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[9px] font-bold text-[#243754]">{label}</span>
                      <span className="text-[8px] font-bold text-[#7A8AA3]">{Number(selected).toFixed(1)}% / {Number(overall).toFixed(1)}%</span>
                    </div>
                    <div className="relative h-1.5 overflow-hidden rounded-full bg-[#E8EEF5]">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-[#C9D5E3]" style={{ width: `${Math.min(100, Number(overall))}%` }} />
                      <div className={`absolute inset-y-0 left-0 rounded-full ${color}`} style={{ width: `${Math.min(100, Number(selected))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[8px] text-[#94A3B8]">Country / overall</div>
            </div>

            <div className="min-h-[178px] rounded-xl border border-[#DCE5F0] bg-[#FBFDFF] p-3">
              <div className="text-[12px] font-black text-[#10213D]">{getMetricLabel(metric)} Share</div>
              <div className="mt-0.5 text-[9px] text-[#7A8AA3]">Contribution to selected metric</div>
              <div className="mt-5 text-center">
                <div className="text-[30px] font-black tracking-[-0.04em] text-blue-600">{selectedCountryShare.toFixed(1)}%</div>
                <div className="mt-1 text-[9px] text-[#7A8AA3]">{selectedMetricValue} of {totalMetricValue}</div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#EAF0F6]">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, selectedCountryShare)}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end"><button type="button" onClick={downloadReport} disabled={!countries.length} className="rounded-lg bg-blue-600 px-4 py-2.5 text-[12px] font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">↓ &nbsp; Download Data</button></div>
    </div>
  );
}
