/**
 * [INPUT]: N/A - 静态配置文件
 * [OUTPUT]: (IndicatorInfo) - 指标名称、描述、公式、阈值、业务意义
 * [POS]: 位于 /lib，被所有页面和组件引用。提供统一的指标解释，增强前端易读性。
 *
 * [PROTOCOL]:
 * 1. 一旦添加新指标或修改解释，必须同步更新此文件。
 * 2. 描述使用业务语言，面向投资人，避免过度技术化。
 */

export interface IndicatorInfo {
  name: string;
  description: string;
  formula?: string;
  thresholds?: string;
  businessMeaning?: string;
}

/**
 * 指标字典 - 统一管理所有指标的解释
 */
export const INDICATORS: Record<string, IndicatorInfo> = {
  // ========== 核心指标 ==========
  risk_light: {
    name: "风险灯号",
    description: "美元流动性环境的整体评估，基于流动性评分自动分级",
    thresholds: "🟢 绿灯 (≥70分): 流动性充裕 | 🟡 黄灯 (40-69分): 流动性中性 | 🔴 红灯 (<40分): 流动性紧缩",
    businessMeaning: "直接决定市场环境的安全等级。绿灯时可激进操作，黄灯时谨慎，红灯时需要防守。",
  },
  liquidity_score: {
    name: "流动性评分",
    description: "美元流动性健康度的量化评分 (0-100分)",
    formula: "Quantity (40%) + Plumbing (30%) + Vol Gate (30%)",
    thresholds: "≥70分: 充裕 | 40-69分: 中性 | <40分: 紧缩",
    businessMeaning: "评分越高，市场越有利于风险资产。低于40分时需要减仓或对冲。",
  },
  leverage_coef: {
    name: "建议杠杆系数",
    description: "基于流动性环境计算的最优杠杆倍数",
    formula: "leverage = liquidity_score / 100",
    thresholds: "≤0.5x: 保守 | 0.5-0.8x: 适度 | >0.8x: 激进",
    businessMeaning: "直接指导仓位管理。例如 0.6x 意味着在100万资金中建议使用60万风险敞口。",
  },
  hard_stop: {
    name: "一票否决",
    description: "极端市场条件下的强制紧缩触发器",
    thresholds: "SOFR-IORB > 5bp 或 MOVE > 120",
    businessMeaning: "触发后立即降低风险，不论其他指标如何。相当于市场的'熔断机制'。",
  },

  // ========== 流动性指标 (Liquidity) ==========
  walcl: {
    name: "Fed 资产负债表 (WALCL)",
    description: "美联储持有的总资产规模，衡量市场中美元的总供给量",
    formula: "单位: 万亿美元",
    businessMeaning: "资产负债表扩张 (QE) 增加流动性，利好风险资产。收缩 (QT) 减少流动性，风险资产承压。",
  },
  sofr_iorb_spread: {
    name: "SOFR-IORB 利差",
    description: "银行间拆借利率 (SOFR) 与超额准备金利率 (IORB) 的差值，衡量银行体系的资金松紧度",
    formula: "(SOFR - IORB) × 100，单位: bp (基点)",
    thresholds: "<3bp: 正常 | 3-5bp: 警示 | >5bp: 红灯 (一票否决)",
    businessMeaning: "利差扩大意味着银行缺钱，市场流动性收紧。超过5bp触发强制紧缩。",
  },
  wresbal: {
    name: "银行准备金",
    description: "商业银行在美联储的存款余额，衡量银行体系的流动性缓冲",
    formula: "单位: 万亿美元",
    thresholds: ">3万亿: 充裕 | 2-3万亿: 中性 | <2万亿: 紧张",
    businessMeaning: "准备金是银行的'安全垫'。余额下降时，银行倾向于收紧信贷，市场流动性承压。",
  },
  rrp: {
    name: "逆回购 (RRP)",
    description: "货币市场基金等机构在美联储的隔夜存款，吸收市场中的过剩流动性",
    formula: "单位: 亿美元",
    thresholds: "<4000亿: 正常 | >4000亿: 流动性过剩",
    businessMeaning: "RRP 下降意味着资金从'冰箱'流回市场，增加流动性。低于阈值时触发 RRP 缓冲放大器。",
  },
  move: {
    name: "MOVE 利率波动率指数",
    description: "衡量美债期权隐含波动率，反映市场对利率波动的预期",
    thresholds: "<100: 正常 | 100-120: 阻塞 | >120: 关闸 (一票否决)",
    businessMeaning: "MOVE 飙升意味着利率市场混乱，此时所有策略都需要暂停，等待市场稳定。",
  },
  supply_texture: {
    name: "Supply Texture 修正",
    description: "根据美债供给压力和回购市场压力对流动性评分的调整",
    formula: "最多 ±5 分",
    businessMeaning: "当美债大量发行或回购市场紧张时，即使其他指标正常，也需要降低流动性评分。",
  },
  rrp_buffer_amplified: {
    name: "RRP 缓冲放大器",
    description: "当 RRP 低于阈值且准备金下行时触发，放大流动性收紧效应",
    thresholds: "触发条件: RRP < 4000 亿 且 准备金环比下降",
    businessMeaning: "RRP 是市场的'缓冲垫'。耗尽后流动性收紧效应会被放大，需要更保守配置。",
  },
  quantity: {
    name: "Quantity 分项",
    description: "衡量美元流动性的数量维度，基于 Fed 资产负债表、准备金、RRP 等指标",
    formula: "权重 40%",
    businessMeaning: "Quantity 反映市场中美元的'总量'。数值越高，市场流动性越充裕。",
  },
  plumbing: {
    name: "Plumbing 分项",
    description: "衡量银行体系管道的通畅度，基于 SOFR-IORB 利差、信用利差等指标",
    formula: "权重 30%",
    businessMeaning: "Plumbing 反映银行间资金流通是否顺畅。管道阻塞时即使有流动性也无法到达实体。",
  },
  vol_gate: {
    name: "Vol Gate 分项",
    description: "衡量市场波动率闸门状态，基于 MOVE、VIX 等波动率指标",
    formula: "权重 30%",
    businessMeaning: "波动率飙升时市场混乱，此时需要降低风险。Vol Gate 是流动性的'安全阀'。",
  },

  // ========== 宏观指标 (Macro) ==========
  macro_state: {
    name: "宏观状态 (A/B/C/D)",
    description: "基于利率结构和叙事的市场阶段分类",
    thresholds: "A: 增长 | B: 折现率冲击 | C: 衰退 | D: 通胀",
    businessMeaning: "不同状态下的资产表现截然不同。A 状态利好股票，C 状态需要避险。",
  },
  policy_path: {
    name: "政策路径",
    description: "基于 2Y 国债收益率变化，判断 Fed 政策预期的方向",
    formula: "Δ2Y (20天变化)",
    thresholds: "上升: 鹰派预期 | 下降: 鸽派预期",
    businessMeaning: "2Y 对 Fed 政策最敏感。上升意味着市场预期加息或停止降息，利空股票。",
  },
  curve_structure: {
    name: "曲线形态",
    description: "国债收益率曲线的形态，反映市场对未来经济的预期",
    formula: "10Y-2Y (2s10s) 和 30Y-10Y (10s30s) 利差",
    thresholds: "陡峭化: 增长预期 | 平坦化/倒挂: 衰退担忧",
    businessMeaning: "陡峭曲线通常伴随经济复苏，平坦或倒挂曲线是衰退的预警信号。",
  },
  real_be: {
    name: "Real/BE 分解",
    description: "10Y 国债收益率拆分为实际利率 (Real) 和通胀预期 (BE)",
    formula: "Δ10Y = ΔReal + ΔBE",
    businessMeaning: "Real 上升伤害成长股，BE 上升利好价值股和商品。分解后可判断股票板块偏向。",
  },
  term_premium: {
    name: "期限溢价",
    description: "投资者持有长期债券要求的额外补偿，反映对未来不确定性的担忧",
    thresholds: "上升: 不确定性增加 | 下降: 市场平稳",
    businessMeaning: "期限溢价飙升通常伴随市场抛售长债，此时需要警惕风险资产。",
  },
  correlation: {
    name: "SPX vs Δ10Y 相关性",
    description: "股票与利率变化的相关性，反映市场主导叙事",
    formula: "Corr(SPX, Δ10Y) 20D 和 60D",
    thresholds: ">0.3: 正相关 (增长叙事) | <-0.3: 负相关 (折现率冲击) | 其他: 混合",
    businessMeaning: "正相关时股债同涨同跌，说明增长预期主导。负相关时利率上升股票下跌，说明折现率冲击。",
  },
  corr_20d: {
    name: "20天相关性",
    description: "S&P 500 与 10Y 国债收益率变化的 20 天滚动相关性，捕捉短期市场叙事",
    formula: "Corr(SPX 日收益率, Δ10Y 日变化 bp) 20D",
    thresholds: ">0.3: 增长/再通胀信号 | <-0.3: 折现率冲击 | -0.3 至 0.3: 混合状态",
    businessMeaning: "正值时股票与利率同涨，说明市场关注增长。负值时利率上升股票下跌，说明折现率冲击主导。",
  },
  corr_60d: {
    name: "60天相关性",
    description: "S&P 500 与 10Y 国债收益率变化的 60 天滚动相关性，反映中期趋势",
    formula: "Corr(SPX 日收益率, Δ10Y 日变化 bp) 60D",
    thresholds: ">0.3: 增长/再通胀信号 | <-0.3: 折现率冲击 | -0.3 至 0.3: 混合状态",
    businessMeaning: "60D 比 20D 更稳定，能过滤短期噪音。与 20D 冲突时说明叙事正在转换。",
  },
  narrative_state: {
    name: "叙事状态",
    description: "综合 20D 和 60D 相关性判断的市场主导叙事",
    thresholds: "Risk-On: 双正相关 | Risk-Off: 双负相关 | Transition: 符号冲突或中性",
    businessMeaning: "Risk-On 时可激进配置成长股，Risk-Off 时需要防御。Transition 时保持谨慎。",
  },
  gates: {
    name: "闸门矩阵",
    description: "5 个风险开关，任何一个关闭都需要降低风险",
    thresholds: "🟢 开启: 正常 | 🔴 关闭: 需要对冲",
    businessMeaning: "闸门是市场的'保险丝'。关闭后即使看涨也要买保护，避免黑天鹅。",
  },
  correction: {
    name: "纠错档位",
    description: "当模型输出与市场极端信号冲突时的强制修正机制",
    thresholds: "NONE: 无触发 | A/B/C: 递进式风险警告",
    businessMeaning: "防止模型在极端市场中给出过度乐观的建议。档位越高，需要越保守。",
  },

  // ========== 执行矩阵 (Execution) ==========
  rates_action: {
    name: "利率表达",
    description: "基于曲线形态和叙事，给出的利率交易建议",
    businessMeaning: "例如'做多曲线陡峭化'意味着买长期债卖短期债，赌曲线变陡。",
  },
  equity_sector: {
    name: "股票板块偏向",
    description: "基于宏观状态和 Real/BE 分解，推荐的股票板块",
    businessMeaning: "Growth (科技、消费) 在 A 状态表现好，Value (金融、能源) 在 D 状态表现好。",
  },
  hedge_required: {
    name: "对冲要求",
    description: "是否需要买入保护性对冲 (如买入看跌期权)",
    businessMeaning: "当闸门关闭或纠错触发时，即使看多也要买保险，限制下行风险。",
  },
  short_vol: {
    name: "卖波动许可",
    description: "是否允许卖出波动率策略 (如卖出跨式期权)",
    thresholds: "允许: MOVE < 100 且无闸门关闭 | 禁止: MOVE > 100 或任一闸门关闭",
    businessMeaning: "卖波动在平稳市场赚钱，但市场混乱时会巨亏。模型禁止时绝对不要碰。",
  },

  // ========== 市场数据 ==========
  spx: {
    name: "S&P 500 指数",
    description: "美国大盘股指数，最广泛的市场基准",
    businessMeaning: "风险资产的代表。流动性充裕时通常上涨，紧缩时承压。",
  },
  dxy: {
    name: "美元指数 (DXY)",
    description: "美元相对一篮子货币的强弱指数",
    businessMeaning: "美元走强通常伴随流动性收紧和新兴市场承压，对美股也可能有压力。",
  },
  hy_oas: {
    name: "高收益债 OAS",
    description: "垃圾债相对国债的利差，衡量信用风险溢价",
    thresholds: "<400bp: 正常 | 400-500bp: 关注 | >500bp: 警告",
    businessMeaning: "利差扩大意味着投资者担心违约风险，此时股票通常也会承压。",
  },
  ig_oas: {
    name: "投资级债 OAS",
    description: "投资级债券相对国债的利差",
    businessMeaning: "比 HY OAS 更稳定，但同样反映信用风险。扩大时需要警惕。",
  },
  vix: {
    name: "VIX 恐慌指数",
    description: "S&P 500 期权隐含波动率，市场恐慌的温度计",
    thresholds: "<20: 平静 | 20-30: 关注 | >30: 恐慌",
    businessMeaning: "VIX 飙升时市场恐慌，需要降低仓位或买入保护。",
  },
  us10y: {
    name: "10Y 国债收益率",
    description: "无风险利率的基准，影响所有资产定价",
    businessMeaning: "10Y 上升通常对股票不利 (折现率上升)，但如果是因为增长预期上升则可能利好。",
  },

  // ========== 闸门 (Gates) ==========
  move_gate: {
    name: "MOVE 闸门",
    description: "利率波动率闸门，监控美债期权隐含波动率",
    thresholds: "开启: MOVE < 100 | 阻塞: 100-120 | 关闸: MOVE > 120",
    businessMeaning: "MOVE 飙升意味着利率市场混乱。关闸后所有策略暂停，等待市场稳定。",
  },
  sofr_iorb_gate: {
    name: "SOFR-IORB 闸门",
    description: "银行体系流动性闸门，监控银行间拆借利率与超额准备金利率的利差",
    thresholds: "开启: < 3bp | 警示: 3-5bp | 关闸: > 5bp",
    businessMeaning: "利差扩大意味着银行缺钱。关闸后立即降低风险，防止流动性危机。",
  },
  credit_gate: {
    name: "信用利差闸门",
    description: "信用风险闸门，监控高收益债 OAS 利差",
    thresholds: "开启: HY OAS < 400bp | 警告: 400-500bp | 关闸: > 500bp",
    businessMeaning: "信用利差飙升意味着违约风险上升。关闸后减少风险敞口，增加对冲。",
  },
  vix_gate: {
    name: "VIX 闸门",
    description: "股票波动率闸门，监控 VIX 恐慌指数",
    thresholds: "开启: VIX < 25 | 警告: 25-35 | 关闸: VIX > 35",
    businessMeaning: "VIX 飙升意味着市场恐慌。关闸后降低股票敞口，买入保护。",
  },
  curve_gate: {
    name: "曲线闸门",
    description: "收益率曲线闸门，监控曲线倒挂程度",
    thresholds: "开启: 2s10s > -50bp | 警告: -50bp 至 -100bp | 关闸: < -100bp",
    businessMeaning: "深度倒挂通常预示衰退。关闸后降低风险资产配置，增加防御性资产。",
  },
};

/**
 * 根据指标 key 获取指标信息
 */
export function getIndicatorInfo(key: string): IndicatorInfo | null {
  return INDICATORS[key] || null;
}

/**
 * 检查指标是否存在
 */
export function hasIndicator(key: string): boolean {
  return key in INDICATORS;
}
