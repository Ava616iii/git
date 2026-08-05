import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EASTMONEY_UT = "bd1d9ddb04089700cf9c27f6f7426281";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "data.json");

const STATIC_INFLUENCERS = [
  { avatar: "马", name: "马斯克", handle: "@elonmusk", url: "https://x.com/elonmusk", summary: "最新动态：谈及机器人出租车扩张节奏，已翻译并提取关键词。" },
  { avatar: "黄", name: "黄仁勋 / NVIDIA", handle: "@nvidia", url: "https://x.com/nvidia", summary: "最新动态：强调端侧 AI 和推理成本下降，关联 AI PC、芯片链。" },
  { avatar: "S", name: "sszcw", handle: "@sszcw", url: "https://x.com/sszcw", summary: "盘中观点触发关键词提醒后进入复核队列。" },
  { avatar: "V", name: "Valen", handle: "@Valen9223", url: "https://x.com/Valen9223", summary: "重点监控盘中观点、主题发酵和个股提及。" },
  { avatar: "Y", name: "iYXwivACYC88764", handle: "@iYXwivACYC88764", url: "https://x.com/iYXwivACYC88764", summary: "发现关键词后进入待复核队列。" },
  { avatar: "P", name: "PandaTouZi", handle: "@PandaTouZi", url: "https://x.com/PandaTouZi", summary: "关注中概、A股映射和跨市场异动。" },
  { avatar: "B", name: "bbloveu7777", handle: "@bbloveu7777", url: "https://x.com/bbloveu7777", summary: "高频捕捉情绪变化和短线线索。" }
];

async function main() {
  const data = await buildDashboardData();
  await writeFile(OUTPUT, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`Updated ${path.relative(ROOT, OUTPUT)}`);
}

async function buildDashboardData() {
  const [stocksRaw, sectorsInRaw, sectorsOutRaw] = await Promise.all([
    fetchEastmoney(stockListUrl("f62", 8, true)),
    fetchEastmoney(sectorListUrl("f62", 8, true)),
    fetchEastmoney(sectorListUrl("f62", 8, false))
  ]);

  const stocks = rows(stocksRaw).map((item) => [item.f14, item.f62 || 0, formatPercent(item.f3)]);
  const sectorsIn = rows(sectorsInRaw).map(fundRow);
  const sectorsOut = rows(sectorsOutRaw).map(fundRow);
  const sectors = rows(sectorsInRaw).map((item) => [item.f14, Math.round(Math.abs(item.f62 || 0) / 100000000), formatPercent(item.f3)]);

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
    source: "github-actions-eastmoney",
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
    stocks: stocks.map((row) => [row[0], Math.round(Math.abs(row[1]) / 100000000), row[2]]),
    sectors,
    xueqiu: {
      name: "南京路彼岸",
      subtitle: "雪球自选同步入口",
      profileUrl: "https://xueqiu.com/u/7273692735",
      summary: "雪球自选需要登录态或授权接口；这里保留入口和同步位。",
      rows: [
        { title: "等待接口同步", description: "接入雪球登录态后自动展示具体自选标的、涨跌幅和最近加入时间。", status: "待接入" },
        { title: "行情共振", description: "先接入 A 股公开行情和板块资金，后续再与自选池交叉匹配。", status: "运行中" },
        { title: "变动提醒", description: "自选股新增、删除和高频查看需要后端支持。", status: "待接入" }
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
      title: "海外与大V位保留为后续扩展",
      summary: "X、雪球和付费讯源需要授权或额外接口；当前自动刷新先覆盖 A 股公开数据。",
      tags: ["待接入", "X", "雪球"]
    }
  ];
}

function buildDetails(stockRows, sectorsIn, sectorsOut) {
  const details = {
    "南京路彼岸自选": [
      "已保留雪球用户主页追踪入口：xueqiu.com/u/7273692735。",
      "具体自选股列表需要雪球登录态或后端接口返回。"
    ]
  };

  for (const item of stockRows) {
    details[item.f14] = [
      `${item.f14}当前涨跌幅 ${formatPercent(item.f3)}，主力净流入约 ${formatMoney(item.f62)}。`,
      "数据来自东方财富公开行情接口，适合做盘中监控。"
    ];
  }

  for (const item of [...sectorsIn, ...sectorsOut]) {
    details[item.name] = [
      `${item.name}当前资金变化约 ${item.value}。`,
      "可继续与个股榜单交叉观察。"
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
      Accept: "application/json,text/plain,*/*",
      Referer: "https://quote.eastmoney.com/"
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

await main();
