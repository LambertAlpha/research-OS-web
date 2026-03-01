/**
 * [INPUT]: (year, month, day) - 年、月（0-based）、日参数。
 * [OUTPUT]: (WEEKDAYS, getDaysInMonth, getFirstDayOfWeek, toDateStr) - 日历计算工具函数集。
 * [POS]: 位于 /lib，被 DatePicker 和 CalendarHeatmap 组件共享使用。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/lib/.folder.md 的描述是否依然准确。
 */

/** 星期标题（周一开始） */
export const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

/** 获取指定月份的天数（month 为 0-based） */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** 获取指定月份第一天是星期几（0=周一, 6=周日） */
export function getFirstDayOfWeek(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

/** 格式化为 YYYY-MM-DD 字符串（month 为 0-based） */
export function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
