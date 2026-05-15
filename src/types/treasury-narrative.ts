/**
 * [INPUT]: /api/treasury-narrative 响应
 * [OUTPUT]: TreasuryNarrativeResponse 及所有嵌套类型，外加 NARRATIVE_METADATA / CONFIDENCE_DISPLAY / INDICATOR_GROUPS 展示常量
 * [POS]: 位于 /types。美债敘事模型类型定义，与 research-OS 后端 core/engine/treasury_narrative_engine.py + config/rules_treasury_narrative.yml 严格对齐。被 lib/api.ts 与 /app/treasury-narrative/page.tsx 引用。
 *
 * [PROTOCOL]:
 * 1. narrative_id 枚举 (N-01 ~ N-13) 与 yml narratives 段一一对应，新增 narrative 必须同步此处。
 * 2. 字段命名 snake_case（直接对应后端 JSONB）；不要在前端做 camelCase 转换。
 * 3. 一旦本文件结构变更，必须同步更新 Header 与 /src/types/.folder.md。
 */

export type NarrativeId =
  | "N-01"
  | "N-02"
  | "N-03"
  | "N-04"
  | "N-05"
  | "N-06"
  | "N-07"
  | "N-08"
  | "N-09"
  | "N-10"
  | "N-11"
  | "N-12"
  | "N-13";

export type ConfidenceLevel =
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "TRANSITION"
  | "N13_OVERRIDE";

export type EvidenceLevel =
  | "full"
  | "partial"
  | "reverse"
  | "missing"
  | "pending"
  | "none";

export type IndicatorStatus = "active" | "pending" | "missing";

export type Cycle =
  | "reflation"
  | "soft_landing"
  | "hard_landing"
  | "stagflation"
  | "pivot"
  | "special";

export type Driver =
  | "policy"
  | "inflation"
  | "fiscal"
  | "supply_shock"
  | "stability_event";

export interface TreasuryEvidenceItem {
  indicator: string; // e.g. 'TERM-05'
  level: EvidenceLevel;
  weight: number;
  contribution: number;
  feature_value?: number | null;
}

export interface TreasuryPrimaryNarrative {
  id: NarrativeId | "N/A";
  name: string;
  cycle?: Cycle;
  driver?: Driver;
  match_score: number; // 0-100
  evidence: TreasuryEvidenceItem[];
}

export interface TreasurySecondaryNarrative {
  id: NarrativeId | "N/A" | null;
  name: string | null;
  match_score: number;
}

export interface TreasuryNarrativeAllScores {
  id: NarrativeId | "N/A";
  score: number;
  active_evidence: number;
  total_signature_count?: number;
  cycle?: Cycle;
  driver?: Driver;
  evidence?: TreasuryEvidenceItem[];
}

export interface TreasuryConfidence {
  raw_delta: number;
  move_value: number | null;
  move_factor: number; // 1.0 / 0.9 / 0.7 / 0.5
  delta: number; // MOVE 修正后
  level: ConfidenceLevel;
}

export interface TreasuryTransitionWindow {
  triggered: boolean;
  primary_changed: boolean;
  triggers: string[]; // ['confidence_low', 'primary_changed']
  candidates: (NarrativeId | "N/A")[];
}

export interface TreasuryIndicatorEvidence {
  available: boolean;
  status: IndicatorStatus;
  value?: number | null;
  weight: number;
  reason?: string;
}

export interface TreasuryAction {
  preferred_models: string[];
  position_bias: string;
  hedge: string[];
  avoid: string[];
  kelly_multiplier: number; // 0 / 0.4 / 0.6 / 0.85 / 1.0
  note: string;
  exit_condition?: string;
}

export interface TreasuryNarrativePayload {
  model: "TreasuryNarrative";
  version: string;
  primary_narrative: TreasuryPrimaryNarrative;
  secondary_narrative: TreasurySecondaryNarrative | null;
  all_scores: TreasuryNarrativeAllScores[];
  confidence: TreasuryConfidence;
  transition_window: TreasuryTransitionWindow;
  n13_triggered: boolean;
  n13_early_warning: boolean;
  indicator_evidence: Record<string, TreasuryIndicatorEvidence>;
  action: TreasuryAction;
  kelly_multiplier: number;
  transition_to_after_intervention?: NarrativeId[];
}

export interface TreasuryAlert {
  type: string;
  level: "INFO" | "WARNING" | "CRITICAL";
  message: string;
}

export interface TreasuryNarrativeResponse {
  run_id: string;
  run_ts: string; // ISO datetime
  data_ts: string;
  model_version: string;
  treasury: TreasuryNarrativePayload;
  report_summary: string;
  alerts: TreasuryAlert[];
  triggered_rules: Record<string, unknown>;
}

// ============================================================================
// Narrative metadata（前端硬编码展示数据，与 yml 一致）
// ============================================================================

export interface NarrativeMetadata {
  id: NarrativeId;
  name_cn: string; // 中文名
  name_en: string;
  cycle: Cycle;
  driver: Driver;
  short_description: string;
  typical_lifespan: string; // e.g. "4-12 周"
  is_override?: boolean; // N-13 only
}

export const NARRATIVE_METADATA: Record<NarrativeId, NarrativeMetadata> = {
  "N-01": {
    id: "N-01",
    name_cn: "再通胀·通胀主导",
    name_en: "Reflation Inflation",
    cycle: "reflation",
    driver: "inflation",
    short_description: "通胀预期重新加速，Fed 鹰派但被动",
    typical_lifespan: "4-12 周",
  },
  "N-02": {
    id: "N-02",
    name_cn: "再通胀·财政主导",
    name_en: "Reflation Fiscal",
    cycle: "reflation",
    driver: "fiscal",
    short_description: "财政擴張驱动通胀，期限溢价回归",
    typical_lifespan: "12-52 周",
  },
  "N-03": {
    id: "N-03",
    name_cn: "软着陆·政策主导",
    name_en: "Soft Landing Policy",
    cycle: "soft_landing",
    driver: "policy",
    short_description: "Fed 主导稳步降息，增长维持",
    typical_lifespan: "12-26 周",
  },
  "N-04": {
    id: "N-04",
    name_cn: "软着陆·通胀主导",
    name_en: "Soft Landing Inflation",
    cycle: "soft_landing",
    driver: "inflation",
    short_description: "通胀回落驱动实际利率下行，增长定锚",
    typical_lifespan: "8-16 周",
  },
  "N-05": {
    id: "N-05",
    name_cn: "硬着陆·政策主导",
    name_en: "Hard Landing Policy",
    cycle: "hard_landing",
    driver: "policy",
    short_description: "Fed 过度紧缩触发衰退，急降息",
    typical_lifespan: "4-12 周",
  },
  "N-06": {
    id: "N-06",
    name_cn: "硬着陆·需求崩塌",
    name_en: "Hard Landing Demand",
    cycle: "hard_landing",
    driver: "inflation",
    short_description: "通胀下行 + 需求崩塌，典型衰退",
    typical_lifespan: "12-26 周",
  },
  "N-07": {
    id: "N-07",
    name_cn: "硬着陆·财政危机",
    name_en: "Hard Landing Fiscal",
    cycle: "hard_landing",
    driver: "fiscal",
    short_description: "财政挤出 + 私部门衰退，罕见组合",
    typical_lifespan: "26+ 周",
  },
  "N-08": {
    id: "N-08",
    name_cn: "滞胀·政策主导",
    name_en: "Stagflation Policy",
    cycle: "stagflation",
    driver: "policy",
    short_description: "Fed 落后通胀，结构性鹰派",
    typical_lifespan: "12-26 周",
  },
  "N-09": {
    id: "N-09",
    name_cn: "滞胀·供应冲击",
    name_en: "Stagflation Supply",
    cycle: "stagflation",
    driver: "supply_shock",
    short_description: "供应端冲击主导，Fed 无力",
    typical_lifespan: "8-26 周",
  },
  "N-10": {
    id: "N-10",
    name_cn: "滞胀·财政主导",
    name_en: "Stagflation Fiscal",
    cycle: "stagflation",
    driver: "fiscal",
    short_description: "财政擴張 + 增长乏力，期限溢价爆发",
    typical_lifespan: "26+ 周",
  },
  "N-11": {
    id: "N-11",
    name_cn: "政策转向·政策主导",
    name_en: "Pivot Policy",
    cycle: "pivot",
    driver: "policy",
    short_description: "降息週期启动初期，曲线急 Bull Steepen",
    typical_lifespan: "4-12 周",
  },
  "N-12": {
    id: "N-12",
    name_cn: "政策转向·通胀主导",
    name_en: "Pivot Inflation",
    cycle: "pivot",
    driver: "inflation",
    short_description: "通胀意外回落触发被动转向",
    typical_lifespan: "8-16 周",
  },
  "N-13": {
    id: "N-13",
    name_cn: "金融稳定特别状态",
    name_en: "Financial Stability",
    cycle: "special",
    driver: "stability_event",
    short_description: "Basis Trade 解除 / Repo 危机，覆盖所有其他敘事",
    typical_lifespan: "1-4 周",
    is_override: true,
  },
};

// ============================================================================
// Confidence display helpers
// ============================================================================

export const CONFIDENCE_DISPLAY: Record<
  ConfidenceLevel,
  { label: string; emoji: string; colorClass: string; kelly: number }
> = {
  HIGH: {
    label: "高（定锚）",
    emoji: "🟢",
    colorClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    kelly: 1.0,
  },
  MEDIUM: {
    label: "中（稳定）",
    emoji: "🟡",
    colorClass: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    kelly: 0.85,
  },
  LOW: {
    label: "低（张力）",
    emoji: "🟠",
    colorClass: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    kelly: 0.6,
  },
  TRANSITION: {
    label: "转换窗口",
    emoji: "🔴",
    colorClass: "bg-red-500/10 text-red-400 border-red-500/30",
    kelly: 0.4,
  },
  N13_OVERRIDE: {
    label: "N-13 金融稳定",
    emoji: "🚨",
    colorClass: "bg-red-600/20 text-red-300 border-red-600/50 animate-pulse",
    kelly: 0,
  },
};

// ============================================================================
// 27 Indicator metadata (5 群分组)
// ============================================================================

export type IndicatorGroup = "POL" | "TERM" | "VOL" | "SUP" | "CRX";

export const INDICATOR_GROUPS: Record<
  IndicatorGroup,
  { name_cn: string; weight: string; description: string }
> = {
  POL: {
    name_cn: "政策路径",
    weight: "25%",
    description: "市场对 Fed 政策路径的定价",
  },
  TERM: {
    name_cn: "期限结构与通胀分解",
    weight: "25%",
    description: "曲线形态 + 真实利率 / 通胀拆分",
  },
  VOL: {
    name_cn: "波动率与不确定性",
    weight: "15%",
    description: "利率波动 + 政策不确定性（信心度调节因子）",
  },
  SUP: {
    name_cn: "供需结构",
    weight: "20%",
    description: "谁在买谁在卖",
  },
  CRX: {
    name_cn: "跨资产确认",
    weight: "15%",
    description: "股、美元、商品、信用是否同步",
  },
};
