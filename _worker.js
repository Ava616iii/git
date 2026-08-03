const EASTMONEY_UT = "bd1d9ddb04089700cf9c27f6f7426281";
const CACHE_TTL_SECONDS = 60;

const STATIC_INFLUENCERS = [
  { avatar: "马", name: "马斯克", handle: "@elonmusk", url: "https://x.com/elonmusk", summary: "等待接入 X API；当前保留账号入口和关键词提醒位。" },
  { avatar: "黄", name: "黄仁勋 / NVIDIA", handle: "@nvidia", url: "https://x.com/nvidia", summary: "等待接入 X API；当前保留账号入口和关键词提醒位。" },
  { avatar: "S", name: "sszcw", handle: "@sszcw", url: "https://x.com/sszcw", summary: "等待接入 X API；当前保留账号入口和关键词提醒位。" },
  { avatar: "V", name: "Valen", handle: "@Valen9223", url: "https://x.com/Valen9223", summary: "等待接入 X API；当前保留账号入口和关键词提醒位。" },
  { avatar: "Y", name: "iYXwivACYC88764", handle: "@iYXwivACYC88764", url: "https://x.com/iYXwivACYC88764", summary: "等待接入 X API；当前保留账号入口和关键词提醒位。" },
  { avatar: "P", name: "PandaTouZi", handle: "@PandaTouZi", url: "https://x.com/PandaTouZi", summary: "等待接入 X API；当前保留账号入口和关键词提醒位。" },
  { avatar: "B", name: "bbloveu7777", handle: "@bbloveu7777", url: "https://x.com/bbloveu7777", summary: "等待接入 X API；当前保留账号入口和关键词提醒位。" }
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (url.pathname === "/data.json" || url.pathname === "/api/data") {
      return getDashboardData(request, env, ctx);
    }

    return env.ASSETS.fetch(request);
  }
};

async function getDashboardData(request, env, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(new URL("/__live-dashboard-cache", request.url), request);
  const cached = await cache.match(cacheKey);
  if (cached) return withCors(cached);

  try {
    const data = await buildDashboardData();
    const response = jsonResponse(data, {
      "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`
    });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (error) {
    const fallback = await env.ASSETS.fetch(new Request(new URL("/data.json", request.url), request));
    const body = await fallback.text();
    return jsonResponse(JSON.parse(body), {
      "X-Data-Warning": `live-source-failed: ${error.message}`
    });
  }
}

async function buildDashboardData() {
  const [stocksRaw, sectorsInRaw, sectorsOutRaw] = await Promise.all([
    fetchEastmoney(stockListUrl("f62", 8, true)),
    fetchEastmoney(sectorListUrl("f62", 8, true)),
    fetchEastmoney(sectorListUrl("f62", 8, false))
  ]);

  const stocks = rows(stocksRaw).map(item => [item.f14, item.f62 || 0, formatPercent(item.f3)]);
  const sectorsIn = rows(sectorsInRaw).map(item => fundRow(item, "+"));
  const sectorsOut = rows(sectorsOutRaw).map(item => fundRow(item, "-"));
  const sectors = rows(sectorsInRaw).map(item => [item.f14, Math.round(Math.abs(item.f62 || 0) / 100000000), formatPercent(item.f3)]);
  const now = new Date();
  const updatedAt = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(now);

  const topSector = sectorsIn[0];
  const topStock = rows(stocksRaw)[0];
  const topOutSector = sectorsOut[0];

  return {
    source: "cloudflare-worker-eastmoney",
    updatedAt,
    overview: {
      news: String(stocks.length + sectorsIn.length + sectorsOut.length),
      stocks: String(stocks.length),
      sectors: String(sectors.length),
      alerts: String(Math.min(23, stocks.length + sectorsIn.length))
    },
    status: {
      mode: "A股盘中监控",
      aShareAlerts: stocks.length + sectorsIn.length,
      overseasAlerts: 0,
      alertEnabled: true
    },
    news: buildNews(topSector, topStock, topOutSector, updatedAt),
    funds: {
      in: sectorsIn,
      out: sectorsOut
    },
    stocks: stocks.map(row => [row[0], Math.round(Math.abs(row[1]) / 100000000), row[2]]),
    sectors,
    xueqiu: {
      name: "南京路彼岸",
      subtitle: "南京路彼岸 · 自选待接入",
      profileUrl: "https://xueqiu.com/u/7273692735",
      summary: "雪球自选需要登录态或授权接口；当前保留用户主页入口和同步位置。",
      rows: [
        { title: "等待接口同步", description: "接入雪球登录态后自动展示具体自选标的、涨跌幅和最近加入时间。", status: "待接入" },
        { title: "行情共振", description: "已先接入 A 股公开行情和板块资金，后续可与自选池交叉匹配。", status: "运行中" },
        { title: "变动提醒", description: "自选股新增、删除和高频查看需要后端登录态支持。", status: "待接入" }
      ]
    },
    influencers: STATIC_INFLUENCERS,
    details: buildDetails(rows(stocksRaw), sectorsIn, sectorsOut)
  };
}

function buildNews(topSector, topStock, topOutSector, updatedAt) {
  const stockName = topStock?.f14 || "高资金净流入个股";
  return [
    {
      time: updatedAt.slice(0, 5),
      source: "A股",
      title: `${topSector?.name || "板块资金"}资金净流入居前`,
      summary: `${topSector?.name || "相关板块"}当前主力净流入约 ${topSector?.value || "--"}，页面数据来自东方财富公开行情接口。`,
      tags: [topSector?.name || "板块资金", "主力净流入", "自动更新"]
    },
    {
      time: updatedAt.slice(0, 5),
      source: "A股",
      title: `${stockName}主力资金排名靠前`,
      summary: `${stockName}进入当前资金净流入靠前列表，涨跌幅 ${formatPercent(topStock?.f3)}。`,
      tags: [stockName, "个股异动", "资金流"]
    },
    {
      time: updatedAt.slice(0, 5),
      source: "A股",
      title: `${topOutSector?.name || "部分板块"}资金净流出靠前`,
      summary: `${topOutSector?.name || "相关板块"}当前主力净流出约 ${topOutSector?.value || "--"}，可结合个股和板块榜单观察。`,
      tags: [topOutSector?.name || "板块资金", "主力净流出"]
    },
    {
      time: updatedAt.slice(0, 5),
      source: "海外",
      title: "海外与大V数据待接入授权接口",
      summary: "X、雪球自选和付费快讯源通常需要登录态或 API Key；当前自动更新覆盖 A 股公开行情与板块资金。",
      tags: ["待接入", "X", "雪球"]
    }
  ];
}

function buildDetails(stockRows, sectorsIn, sectorsOut) {
  const details = {
    "南京路彼岸自选": [
      "已添加雪球用户主页追踪入口：xueqiu.com/u/7273692735。",
      "具体自选股列表需要雪球登录态或后端接口返回。"
    ]
  };

  for (const item of stockRows) {
    details[item.f14] = [
      `${item.f14}当前涨跌幅 ${formatPercent(item.f3)}，主力净流入约 ${formatMoney(item.f62)}。`,
      "数据来自东方财富公开行情接口，适合做盘中监控线索。"
    ];
  }

  for (const item of [...sectorsIn, ...sectorsOut]) {
    details[item.name] = [
      `${item.name}当前资金变化约 ${item.value}。`,
      `代表标的：${item.leaders.join("、") || "等待进一步拆分个股数据"}。`
    ];
  }

  return details;
}

function fundRow(item) {
  return {
    name: item.f14,
    width: Math.max(12, Math.min(100, Math.round(Math.abs(item.f62 || 0) / 50000000))),
    value: formatMoney(item.f62),
    leaders: []
  };
}

async function fetchEastmoney(url) {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json,text/plain,*/*",
      "Referer": "https://quote.eastmoney.com/"
    }
  });
  if (!response.ok) throw new Error(`Eastmoney HTTP ${response.status}`);
  return response.json();
}

function stockListUrl(fid, size, descending) {
  const fs = "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23";
  return eastmoneyUrl({ fs, fid, size, descending });
}

function sectorListUrl(fid, size, descending) {
  return eastmoneyUrl({ fs: "m:90+t:2", fid, size, descending });
}

function eastmoneyUrl({ fs, fid, size, descending }) {
  const params = new URLSearchParams({
    pn: "1",
    pz: String(size),
    po: descending ? "1" : "0",
    np: "1",
    ut: EASTMONEY_UT,
    fltt: "2",
    invt: "2",
    fid,
    fs,
    fields: "f12,f14,f3,f62"
  });
  return `https://push2.eastmoney.com/api/qt/clist/get?${params}`;
}

function rows(payload) {
  return payload?.data?.diff || [];
}

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  const yi = number / 100000000;
  return `${yi > 0 ? "+" : ""}${yi.toFixed(2)}亿`;
}

function jsonResponse(data, headers = {}) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
      ...headers
    }
  });
}

function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders())) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
