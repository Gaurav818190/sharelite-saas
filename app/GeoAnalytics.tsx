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

type TopCountry = CountryStats & {
  rank: number;
};

type GeoResponse = {
  countries?: CountryStats[];
  topCountries?: TopCountry[];
  totals?: {
    leads: number;
    valid: number;
    contacted: number;
    converted: number;
  };
  hasGeoData?: boolean;
};

const WORLD_MAP_URL =
  "https://echarts.apache.org/examples/data/asset/geo/world.json";

const FLAG_BY_COUNTRY: Record<string, string> = {
  IN: "🇮🇳",
  US: "🇺🇸",
  GB: "🇬🇧",
  CA: "🇨🇦",
  AU: "🇦🇺",
  DE: "🇩🇪",
  FR: "🇫🇷",
  AE: "🇦🇪",
  SG: "🇸🇬",
  JP: "🇯🇵",
  CN: "🇨🇳",
  BR: "🇧🇷",
  ES: "🇪🇸",
  IT: "🇮🇹",
  NL: "🇳🇱",
  ZA: "🇿🇦",
  NZ: "🇳🇿",
  RU: "🇷🇺",
  MX: "🇲🇽",
  SA: "🇸🇦",
  SE: "🇸🇪",
  NO: "🇳🇴",
  DK: "🇩🇰",
  CH: "🇨🇭",
  BE: "🇧🇪",
  IE: "🇮🇪",
  PT: "🇵🇹",
  PL: "🇵🇱",
  AT: "🇦🇹",
  KR: "🇰🇷",
};

function getFlag(code: string) {
  return FLAG_BY_COUNTRY[code] ?? "🌐";
}

function getMetricValue(
  country: CountryStats,
  metric: GeoMetric,
) {
  return country[metric];
}

function getMetricLabel(metric: GeoMetric) {
  switch (metric) {
    case "valid":
      return "Valid Leads";
    case "contacted":
      return "Contacted";
    case "converted":
      return "Converted";
    default:
      return "Leads";
  }
}

export default function GeoAnalytics() {
  const chartRef = useRef<ReactECharts>(null);

  const [range, setRange] =
    useState<GeoRange>("7d");

  const [metric, setMetric] =
    useState<GeoMetric>("leads");

  const [search, setSearch] =
    useState("");

  const [selectedCountry, setSelectedCountry] =
    useState<string | null>(null);

  const [customFrom, setCustomFrom] =
    useState("");

  const [customTo, setCustomTo] =
    useState("");

  const [mapReady, setMapReady] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [data, setData] =
    useState<GeoResponse | null>(null);

  /*
   * WORLD MAP
   */
  useEffect(() => {
    let cancelled = false;

    async function loadWorldMap() {
      try {
        const response =
          await fetch(WORLD_MAP_URL);

        if (!response.ok) {
          throw new Error(
            "Unable to load world map.",
          );
        }

        const worldJson =
          await response.json();

        if (cancelled) return;

        echarts.registerMap(
          "sharelite-world",
          worldJson,
        );

        setMapReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load world map.",
          );
        }
      }
    }

    void loadWorldMap();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * REAL GEO ANALYTICS DATA
   */
  useEffect(() => {
    let cancelled = false;

    async function loadGeoAnalytics() {
      setLoading(true);
      setError(null);

      try {
        const params =
          new URLSearchParams();

        params.set("range", range);
        params.set("metric", metric);

        if (
          range === "custom" &&
          customFrom
        ) {
          params.set(
            "from",
            customFrom,
          );
        }

        if (
          range === "custom" &&
          customTo
        ) {
          params.set(
            "to",
            customTo,
          );
        }

        const response =
          await fetch(
            `/api/geo-analytics?${params.toString()}`,
            {
              cache: "no-store",
            },
          );

        const body =
          await response
            .json()
            .catch(() => null);

        if (!response.ok) {
          throw new Error(
            body?.error ??
              "Unable to load Geo Analytics.",
          );
        }

        if (!cancelled) {
          setData(body);
        }
      } catch (err) {
        if (!cancelled) {
          setData(null);

          setError(
            err instanceof Error
              ? err.message
              : "Unable to load Geo Analytics.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadGeoAnalytics();

    return () => {
      cancelled = true;
    };
  }, [
    range,
    metric,
    customFrom,
    customTo,
  ]);

  const countries =
    data?.countries ?? [];

  const topCountries =
    data?.topCountries ?? [];

  /*
   * SEARCH
   */
  const filteredCountries =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return topCountries;
      }

      return countries
        .filter(
          (country) =>
            country.name
              .toLowerCase()
              .includes(query) ||
            country.code
              .toLowerCase()
              .includes(query),
        )
        .sort(
          (a, b) =>
            getMetricValue(
              b,
              metric,
            ) -
            getMetricValue(
              a,
              metric,
            ),
        )
        .slice(0, 10)
        .map(
          (country, index) => ({
            ...country,
            rank: index + 1,
          }),
        );
    }, [
      countries,
      metric,
      search,
      topCountries,
    ]);

  /*
   * MAP DATA
   */
  const mapData = useMemo(
    () =>
      countries.map(
        (country) => ({
          name: country.name,
          value: getMetricValue(
            country,
            metric,
          ),
          countryCode:
            country.code,
          leads: country.leads,
          valid: country.valid,
          contacted:
            country.contacted,
          converted:
            country.converted,
        }),
      ),
    [countries, metric],
  );

  const maxValue = useMemo(
    () =>
      Math.max(
        1,
        ...mapData.map(
          (item) =>
            typeof item.value ===
            "number"
              ? item.value
              : 0,
        ),
      ),
    [mapData],
  );

  /*
   * SELECTED COUNTRY
   */
  const selectedCountryData =
    selectedCountry
      ? countries.find(
          (country) =>
            country.code ===
            selectedCountry,
        ) ?? null
      : null;

  /*
   * MAP OPTIONS
   */
  const chartOption = useMemo(
    () => ({
      backgroundColor:
        "transparent",

      tooltip: {
        trigger: "item",

        backgroundColor:
          "#10213D",

        borderColor:
          "#10213D",

        borderWidth: 0,

        padding: 12,

        textStyle: {
          color: "#ffffff",
          fontSize: 11,
        },

        extraCssText:
          "box-shadow:0 12px 30px rgba(15,32,61,.25);border-radius:10px;",

        formatter: (params: any) => {
          const country =
            params?.data;

          if (!country) {
            return `
              <div style="font-weight:700">
                ${params?.name ?? ""}
              </div>
            `;
          }

          return `
            <div style="min-width:165px">
              <div style="
                font-size:13px;
                font-weight:800;
                margin-bottom:8px;
              ">
                ${getFlag(
                  country.countryCode ??
                    "",
                )}
                ${params.name ?? ""}
              </div>

              <div style="margin:5px 0">
                Leads:
                <b>${country.leads ?? 0}</b>
              </div>

              <div style="margin:5px 0">
                Valid Leads:
                <b>${country.valid ?? 0}</b>
              </div>

              <div style="margin:5px 0">
                Contacted:
                <b>${country.contacted ?? 0}</b>
              </div>

              <div style="margin:5px 0">
                Converted:
                <b>${country.converted ?? 0}</b>
              </div>
            </div>
          `;
        },
      },

      visualMap: {
        min: 0,
        max: maxValue,

        left: 18,
        bottom: 18,

        calculable: true,

        text: [
          "High",
          "Low",
        ],

        textStyle: {
          color: "#64748B",
          fontSize: 9,
        },

        inRange: {
          color: [
            "#DCEEFF",
            "#A8D5FF",
            "#70B8FF",
            "#3B92F6",
            "#1769FF",
            "#0645C0",
          ],
        },

        outOfRange: {
          color: "#D8E1EC",
        },
      },

      series: [
        {
          name:
            getMetricLabel(
              metric,
            ),

          type: "map",

          map: "sharelite-world",

          roam: true,

          selectedMode:
            "single",

          emphasis: {
            label: {
              show: false,
            },

            itemStyle: {
              areaColor:
                "#1769FF",

              borderColor:
                "#ffffff",

              borderWidth: 1,
            },
          },

          select: {
            itemStyle: {
              areaColor:
                "#0645C0",

              borderColor:
                "#ffffff",

              borderWidth: 1,
            },
          },

          itemStyle: {
            areaColor:
              "#D8E1EC",

            borderColor:
              "#FFFFFF",

            borderWidth:
              0.7,
          },

          data: mapData,
        },
      ],
    }),
    [
      mapData,
      maxValue,
      metric,
    ],
  );

  /*
   * COUNTRY CLICK
   */
  function handleMapClick(
    params: any,
  ) {
    const code =
      params?.data?.countryCode;

    if (code) {
      setSelectedCountry(code);
    }
  }

  /*
   * COUNTRY LIST CLICK
   */
  function focusCountry(
    code: string,
  ) {
    setSelectedCountry(code);

    const country =
      countries.find(
        (item) =>
          item.code === code,
      );

    if (!country) {
      return;
    }

    chartRef.current
      ?.getEchartsInstance()
      .dispatchAction({
        type: "mapSelect",
        seriesIndex: 0,
        name: country.name,
      });
  }

  /*
   * RESET VIEW
   */
  function resetView() {
    setRange("7d");
    setMetric("leads");
    setSearch("");
    setCustomFrom("");
    setCustomTo("");
    setSelectedCountry(null);

    chartRef.current
      ?.getEchartsInstance()
      .dispatchAction({
        type: "restore",
      });
  }

  /*
   * DOWNLOAD
   */
  function downloadReport() {
    if (!countries.length) {
      return;
    }

    const header =
      "Country,Code,Leads,Valid Leads,Contacted,Converted";

    const rows =
      countries.map(
        (country) =>
          [
            country.name,
            country.code,
            country.leads,
            country.valid,
            country.contacted,
            country.converted,
          ]
            .map(
              (value) =>
                `"${String(
                  value,
                ).replaceAll(
                  '"',
                  '""',
                )}"`,
            )
            .join(","),
      );

    const csv =
      [header, ...rows].join(
        "\n",
      );

    const blob =
      new Blob([csv], {
        type: "text/csv;charset=utf-8;",
      });

    const url =
      URL.createObjectURL(
        blob,
      );

    const link =
      document.createElement(
        "a",
      );

    link.href = url;

    link.download =
      "sharelite-geo-analytics.csv";

    document.body.appendChild(
      link,
    );

    link.click();

    document.body.removeChild(
      link,
    );

    URL.revokeObjectURL(
      url,
    );
  }

  return (
    <div className="space-y-4">

      {/* PAGE HEADER */}

      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">

        <div className="flex items-center gap-3">

          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl text-white shadow-sm">
            🌐
          </div>

          <div>
            <h1 className="text-[22px] font-black tracking-[-0.04em] text-[#10213D]">
              Geo Analytics
            </h1>

            <p className="mt-0.5 text-[11px] font-medium text-[#71819B]">
              Track your global outreach performance with real-time geographical insights.
            </p>
          </div>

        </div>

        <select
          value={range}
          onChange={(event) =>
            setRange(
              event.target
                .value as GeoRange,
            )
          }
          className="rounded-lg border border-[#DCE5F0] bg-white px-4 py-2.5 text-[11px] font-bold text-[#10213D] outline-none focus:border-blue-500"
        >
          <option value="today">
            Today
          </option>

          <option value="7d">
            Last 7 Days
          </option>

          <option value="30d">
            Last 30 Days
          </option>

          <option value="custom">
            Custom
          </option>
        </select>

      </div>

      {/* CUSTOM DATES */}

      {range === "custom" && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-[#DCE5F0] bg-white p-4">

          <div>
            <div className="mb-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#7A8AA3]">
              From
            </div>

            <input
              type="date"
              value={customFrom}
              onChange={(event) =>
                setCustomFrom(
                  event.target.value,
                )
              }
              className="rounded-lg border border-[#DCE5F0] px-3 py-2 text-[11px] outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <div className="mb-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#7A8AA3]">
              To
            </div>

            <input
              type="date"
              value={customTo}
              onChange={(event) =>
                setCustomTo(
                  event.target.value,
                )
              }
              className="rounded-lg border border-[#DCE5F0] px-3 py-2 text-[11px] outline-none focus:border-blue-500"
            />
          </div>

        </div>
      )}

      {/* FILTER BAR */}

      <div className="rounded-xl border border-[#DCE5F0] bg-white p-3">

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_220px_minmax(0,1fr)_auto] md:items-end">

          <div>
            <div className="mb-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#71819B]">
              Metric
            </div>

            <select
              value={metric}
              onChange={(event) =>
                setMetric(
                  event.target
                    .value as GeoMetric,
                )
              }
              className="w-full rounded-lg border border-[#DCE5F0] bg-white px-3 py-2.5 text-[11px] font-bold text-[#10213D] outline-none focus:border-blue-500"
            >
              <option value="leads">
                👥 Leads
              </option>

              <option value="valid">
                ✓ Valid Leads
              </option>

              <option value="contacted">
                ✉ Contacted
              </option>

              <option value="converted">
                ◉ Converted
              </option>
            </select>
          </div>

          <div>
            <div className="mb-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#71819B]">
              Time Range
            </div>

            <select
              value={range}
              onChange={(event) =>
                setRange(
                  event.target
                    .value as GeoRange,
                )
              }
              className="w-full rounded-lg border border-[#DCE5F0] bg-white px-3 py-2.5 text-[11px] font-bold text-[#10213D] outline-none focus:border-blue-500"
            >
              <option value="today">
                Today
              </option>

              <option value="7d">
                Last 7 Days
              </option>

              <option value="30d">
                Last 30 Days
              </option>

              <option value="custom">
                Custom
              </option>
            </select>
          </div>

          <div />

          <div>
            <button
              type="button"
              onClick={resetView}
              className="w-full rounded-lg border border-[#DCE5F0] bg-white px-4 py-2.5 text-[11px] font-bold text-[#243754] transition hover:border-blue-300 hover:bg-blue-50 md:w-auto"
            >
              ↻ &nbsp; Reset View
            </button>
          </div>

        </div>

      </div>

      {/* ERROR */}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-semibold text-red-600">
          {error}
        </div>
      )}

      {/* MAP + TOP COUNTRIES */}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_390px]">

        {/* WORLD MAP CARD */}

        <div className="overflow-hidden rounded-xl border border-[#DCE5F0] bg-white">

          <div className="border-b border-[#E7EDF5] px-4 py-3">

            <div className="text-[13px] font-black text-[#10213D]">
              Global Outreach Map
            </div>

            <div className="mt-0.5 text-[10px] text-[#7A8AA3]">
              Country-level outreach activity
            </div>

          </div>

          <div className="relative">

            {!mapReady ||
            loading ? (
              <div className="flex h-[520px] items-center justify-center">

                <div className="text-center">

                  <div className="text-4xl">
                    🌐
                  </div>

                  <div className="mt-3 text-[13px] font-black text-[#10213D]">
                    {loading
                      ? "Loading Geo Analytics..."
                      : "Loading World Map..."}
                  </div>

                  <div className="mt-1 text-[10px] text-[#7A8AA3]">
                    Preparing your country activity.
                  </div>

                </div>

              </div>
            ) : (
              <ReactECharts
                ref={chartRef}
                option={
                  chartOption
                }
                style={{
                  width:
                    "100%",
                  height:
                    "520px",
                }}
                onEvents={{
                  click:
                    handleMapClick,
                }}
                notMerge
                lazyUpdate
              />
            )}

          </div>

        </div>

        {/* TOP COUNTRIES */}

        <div className="overflow-hidden rounded-xl border border-[#DCE5F0] bg-white">

          <div className="border-b border-[#E7EDF5] px-4 py-4">

            <div className="text-[15px] font-black text-[#10213D]">
              Top Countries
            </div>

            <div className="mt-1 text-[10px] text-[#7A8AA3]">
              Countries with the most leads
            </div>

          </div>

          <div className="p-3">

            <div className="relative">

              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A9AB2]">
                ⌕
              </span>

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search country..."
                className="w-full rounded-lg border border-[#DCE5F0] bg-white py-2.5 pl-9 pr-3 text-[11px] outline-none focus:border-blue-500"
              />

            </div>

            <div className="mt-3">

              <div className="grid grid-cols-[30px_minmax(0,1fr)_70px] gap-2 border-b border-[#E7EDF5] px-2 py-2.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#71819B]">

                <span>
                  #
                </span>

                <span>
                  Country
                </span>

                <span className="text-right">
                  Leads
                </span>

              </div>

              {filteredCountries.length ===
              0 ? (
                <div className="px-3 py-14 text-center">

                  <div className="text-[11px] font-bold text-[#64748B]">
                    No geo data yet
                  </div>

                  <div className="mt-1 text-[9px] text-[#94A3B8]">
                    Country activity will appear when leads contain country data.
                  </div>

                </div>
              ) : (
                <div className="max-h-[430px] overflow-y-auto">

                  {filteredCountries.map(
                    (
                      country,
                    ) => (
                      <button
                        key={
                          country.code
                        }
                        type="button"
                        onClick={() =>
                          focusCountry(
                            country.code,
                          )
                        }
                        className={`grid w-full grid-cols-[30px_minmax(0,1fr)_70px] items-center gap-2 border-b border-[#EEF2F7] px-2 py-3 text-left transition ${
                          selectedCountry ===
                          country.code
                            ? "bg-blue-50"
                            : "hover:bg-[#F7FAFE]"
                        }`}
                      >

                        <span className="text-[10px] font-bold text-[#64748B]">
                          {
                            country.rank
                          }
                        </span>

                        <span className="flex min-w-0 items-center gap-2">

                          <span className="text-[17px]">
                            {getFlag(
                              country.code,
                            )}
                          </span>

                          <span className="truncate text-[11px] font-semibold text-[#10213D]">
                            {
                              country.name
                            }
                          </span>

                        </span>

                        <span className="text-right text-[11px] font-black text-[#10213D]">
                          {
                            country.leads
                          }
                        </span>

                      </button>
                    ),
                  )}

                </div>
              )}

            </div>

          </div>

        </div>

      </div>

      {/* SELECTED COUNTRY */}

      {selectedCountryData && (
        <div className="rounded-xl border border-[#DCE5F0] bg-white p-5">

          <div className="flex items-center justify-between gap-4">

            <div className="flex items-center gap-3">

              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#DCE5F0] bg-[#F5F9FF] text-2xl">
                {getFlag(
                  selectedCountryData.code,
                )}
              </div>

              <div>

                <div className="text-[15px] font-black text-[#10213D]">
                  {
                    selectedCountryData.name
                  }
                </div>

                <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#7A8AA3]">
                  Selected Country
                </div>

              </div>

            </div>

          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">

            <div className="rounded-lg border border-[#DCE5F0] bg-white p-3">

              <div className="text-[9px] font-black uppercase tracking-[0.08em] text-blue-600">
                Leads
              </div>

              <div className="mt-1 text-[22px] font-black text-[#10213D]">
                {
                  selectedCountryData.leads
                }
              </div>

            </div>

            <div className="rounded-lg border border-[#DCE5F0] bg-white p-3">

              <div className="text-[9px] font-black uppercase tracking-[0.08em] text-emerald-600">
                Valid Leads
              </div>

              <div className="mt-1 text-[22px] font-black text-[#10213D]">
                {
                  selectedCountryData.valid
                }
              </div>

            </div>

            <div className="rounded-lg border border-[#DCE5F0] bg-white p-3">

              <div className="text-[9px] font-black uppercase tracking-[0.08em] text-violet-600">
                Contacted
              </div>

              <div className="mt-1 text-[22px] font-black text-[#10213D]">
                {
                  selectedCountryData.contacted
                }
              </div>

            </div>

            <div className="rounded-lg border border-[#DCE5F0] bg-white p-3">

              <div className="text-[9px] font-black uppercase tracking-[0.08em] text-orange-500">
                Converted
              </div>

              <div className="mt-1 text-[22px] font-black text-[#10213D]">
                {
                  selectedCountryData.converted
                }
              </div>

            </div>

          </div>

        </div>
      )}

      {/* DOWNLOAD */}

      <div className="flex justify-end">

        <button
          type="button"
          onClick={downloadReport}
          disabled={
            countries.length ===
            0
          }
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ↓ &nbsp; Download Data
        </button>

      </div>

    </div>
  );
}