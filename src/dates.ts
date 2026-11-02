// 날짜 계산. init과 log add가 함께 쓴다.

// 로컬 시간대 기준 YYYY-MM-DD.
export function localDate(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// 윤년을 포함한 실제 달력 날짜인지 본다. Date 객체를 쓰지 않는다(두 자리 연도 보정 같은 함정을 피한다).
export function isCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth;
}
