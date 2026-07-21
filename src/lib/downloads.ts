/**
 * 클라이언트 사이드 다운로드 유틸 — 진짜 XLSX (SheetJS) + CSV fallback
 * SheetJS는 CDN에서 lazy load (npm 패키지 없이 동작)
 */

let _XLSX: any = null;
async function loadXLSX(): Promise<any> {
  if (_XLSX) return _XLSX;
  if (typeof window === 'undefined') return null;
  const w = window as any;
  if (w.XLSX) { _XLSX = w.XLSX; return _XLSX; }
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('SheetJS 로드 실패'));
    document.head.appendChild(s);
  });
  _XLSX = w.XLSX; return _XLSX;
}

export function csvEscape(v: any): string {
  const s = String(v ?? '');
  if (/[,"\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
export function toCsv(rows: any[], headers: string[]): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const r of rows) lines.push(headers.map(h => csvEscape(r[h])).join(','));
  return lines.join('\r\n');
}
export function downloadCsv(rows: any[], headers: string[], filename: string) {
  const csv = toCsv(rows, headers);
  const bom = '﻿';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
  triggerBlob(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}
function triggerBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

/**
 * 진짜 XLSX 다운로드 (다중 시트 · 컬럼폭 자동)
 * @param sheets { 시트명: { rows, headers } }
 */
export async function downloadXlsx(sheets: Record<string, { rows: any[]; headers: string[] }>, filename: string) {
  try {
    const XLSX = await loadXLSX();
    if (!XLSX) throw new Error('브라우저 환경 아님');
    const wb = XLSX.utils.book_new();
    for (const [name, { rows, headers }] of Object.entries(sheets)) {
      const data = [headers, ...rows.map(r => headers.map(h => r[h]))];
      const ws = XLSX.utils.aoa_to_sheet(data);
      // 컬럼 폭 자동 (최대 22자)
      ws['!cols'] = headers.map(h => {
        const maxLen = Math.max(h.length, ...rows.map(r => String(r[h] ?? '').length));
        return { wch: Math.min(22, Math.max(8, maxLen + 2)) };
      });
      // 헤더 굵게
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c: C });
        if (ws[addr]) ws[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: '1E2D40' } } };
      }
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));  // 시트명 31자 제한
    }
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    triggerBlob(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
  } catch (e) {
    console.error('XLSX 다운로드 실패, CSV fallback:', e);
    // Fallback CSV (첫 시트만)
    const first = Object.values(sheets)[0];
    if (first) downloadCsv(first.rows, first.headers, filename);
  }
}

// 매트릭스 → 회전 실행용 rows
export function matrixToRotationRows(items: any[], CHANNELS: string[], CH_SHORT: Record<string, string>) {
  const rows: any[] = [];
  const WH: Record<string, string> = { '공홈': 'NBGH', '무신사': 'NBMS', '29CM': 'NB29' };
  for (const it of items) {
    for (const ch of CHANNELS) {
      const mv = it.moves[ch] ?? 0;
      if (mv === 0) continue;
      const outQty = Math.max(0, -mv), inQty = Math.max(0, mv);
      const inv = it.inv[ch] ?? 0, ord = it.ord[ch] ?? 0;
      const wocCur = ord > 0 ? +(inv / ord).toFixed(1) : null;
      const wocAfter = ord > 0 ? +((inv + inQty - outQty) / ord).toFixed(1) : null;
      const oldShort = Math.max(0, ord - inv);
      const newShort = Math.max(0, ord - (inv + inQty - outQty));
      const relief = Math.round((oldShort - newShort) * it.price / 10000);
      const outValue = outQty > 0 ? Math.round(outQty * it.price / 10000) : 0;
      const inList = CHANNELS.filter(c => (it.moves[c] ?? 0) > 0).map(c => `${CH_SHORT[c]}+${(it.moves[c] ?? 0).toLocaleString()}`).join(' / ');
      const inWh = CHANNELS.filter(c => (it.moves[c] ?? 0) > 0).map(c => WH[c] ?? '-').join(' / ');
      rows.push({
        '단품코드': it.code, '스타일코드': it.code.slice(0, 10), '스타일명': it.name,
        '내 채널 현재고': inv, '내 채널 주판': ord,
        '현 재고주수': wocCur !== null ? `${wocCur}주` : '',
        'OUT 수량(장)': outQty, 'IN 수량(장)': inQty,
        '이동 후 재고주수': wocAfter !== null ? `${wocAfter}주` : '',
        '받는 채널 분배': inList, '받는 채널 매장코드': inWh,
        '내 채널 매장코드': WH[ch] ?? '-',
        '단품 정상가(원)': it.price,
        'OUT 매출가치(만원)': outValue, '결품해소 회수(만원)': relief,
        '채널': ch,
      });
    }
  }
  return rows;
}

// 회전 xlsx (채널별 시트 + 전체 매트릭스)
export function rotationSheets(items: any[], CHANNELS: string[], CH_SHORT: Record<string, string>) {
  const all = matrixToRotationRows(items, CHANNELS, CH_SHORT);
  const headers = ['단품코드','스타일코드','스타일명','내 채널 현재고','내 채널 주판','현 재고주수','OUT 수량(장)','IN 수량(장)','이동 후 재고주수','받는 채널 분배','받는 채널 매장코드','내 채널 매장코드','단품 정상가(원)','OUT 매출가치(만원)','결품해소 회수(만원)'];
  const sheets: Record<string, { rows: any[]; headers: string[] }> = {};
  for (const ch of CHANNELS) {
    const chRows = all.filter(r => r['채널'] === ch).map(({ 채널, ...rest }) => rest).sort((a, b) => Number(b['OUT 수량(장)']) - Number(a['OUT 수량(장)']));
    if (chRows.length > 0) sheets[CH_SHORT[ch] ?? ch] = { rows: chRows, headers };
  }
  sheets['전체 회전 매트릭스'] = { rows: all, headers: [...headers, '채널'] };
  return sheets;
}

// 물류용 (FROM/TO 형식)
export function matrixToLogisticsRows(items: any[], CHANNELS: string[], CH_SHORT: Record<string, string>) {
  const rows: any[] = [];
  const WH: Record<string, string> = { '공홈': 'NBGH', '무신사': 'NBMS', '29CM': 'NB29' };
  for (const it of items) {
    const outs = CHANNELS.filter(c => (it.moves[c] ?? 0) < 0);
    const ins = CHANNELS.filter(c => (it.moves[c] ?? 0) > 0);
    if (outs.length === 0 || ins.length === 0) continue;
    for (const outCh of outs) {
      const outQty = -(it.moves[outCh] ?? 0);
      for (const inCh of ins) {
        const totalIn = ins.reduce((s, c) => s + (it.moves[c] ?? 0), 0);
        const inShare = totalIn > 0 ? ((it.moves[inCh] ?? 0) / totalIn) : 0;
        const qty = Math.round(outQty * inShare);
        if (qty <= 0) continue;
        rows.push({
          'FROM 채널': outCh, 'FROM 사이트': WH[outCh] ?? '-',
          'TO 채널': inCh, 'TO 사이트': WH[inCh] ?? '-',
          '단품코드': it.code, '스타일명': it.name,
          '이동수량(장)': qty, '단가(원)': it.price,
          '금액(만원)': Math.round(qty * it.price / 10000),
        });
      }
    }
  }
  return rows;
}
export function logisticsSheets(items: any[], CHANNELS: string[], CH_SHORT: Record<string, string>) {
  const all = matrixToLogisticsRows(items, CHANNELS, CH_SHORT);
  const headers = ['FROM 채널','FROM 사이트','TO 채널','TO 사이트','단품코드','스타일명','이동수량(장)','단가(원)','금액(만원)'];
  const sheets: Record<string, { rows: any[]; headers: string[] }> = { '전체 물류이동': { rows: all, headers } };
  for (const ch of CHANNELS) {
    const chRows = all.filter(r => r['FROM 채널'] === ch);
    if (chRows.length > 0) sheets[`FROM ${CH_SHORT[ch] ?? ch}`] = { rows: chRows, headers };
  }
  return sheets;
}


/**
 * exceljs 기반 조건부 서식 XLSX (조건부 색상 · 굵게)
 * 사용 시나리오: 회전 결과 · 물류용 (bar/gradient 대체 · 셀 색상만)
 */
export async function downloadXlsxStyled(
  sheets: Record<string, { rows: any[]; headers: string[]; colorMap?: Record<string, 'grade' | 'move' | 'woc'> }>,
  filename: string
) {
  if (typeof window === 'undefined') return;
  try {
    const ExcelJS = (await import('exceljs' as any)).default;
    const wb = new ExcelJS.Workbook();
    for (const [name, { rows, headers, colorMap }] of Object.entries(sheets)) {
      const ws = wb.addWorksheet(name.slice(0, 31));
      const headerRow = ws.addRow(headers);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2D40' } };
      ws.columns = headers.map(h => ({ width: Math.max(8, Math.min(22, h.length + 2)) }));
      for (const r of rows) {
        const row = ws.addRow(headers.map(h => r[h]));
        headers.forEach((h, i) => {
          const kind = colorMap?.[h];
          const v = r[h];
          const cell = row.getCell(i + 1);
          if (kind === 'grade' && typeof v === 'string') {
            if (v.includes('X')) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B1E1E' } }; cell.font = { color: { argb: 'FFFF5A5F' }, bold: true }; }
            else if (v.includes('M')) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5A4500' } }; cell.font = { color: { argb: 'FFFFC000' }, bold: true }; }
            else if (v.includes('S')) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4D3E' } }; cell.font = { color: { argb: 'FF4AE3B5' }, bold: true }; }
          }
          if (kind === 'move' && typeof v === 'number') {
            if (v > 0) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4D3E' } }; cell.font = { color: { argb: 'FF4AE3B5' }, bold: true }; }
            else if (v < 0) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B1E1E' } }; cell.font = { color: { argb: 'FFFF5A5F' }, bold: true }; }
          }
          if (kind === 'woc') {
            const num = typeof v === 'string' ? parseFloat(v) : v;
            if (typeof num === 'number' && !isNaN(num)) {
              if (num < 1) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B1E1E' } }; cell.font = { color: { argb: 'FFFF5A5F' }, bold: true }; }
              else if (num < 4) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5A4500' } }; cell.font = { color: { argb: 'FFFFC000' }, bold: true }; }
              else { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4D3E' } }; cell.font = { color: { argb: 'FF4AE3B5' }, bold: true }; }
            }
          }
        });
      }
    }
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    triggerBlob(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
  } catch (e) {
    console.error('Styled XLSX 실패, 기본 XLSX fallback:', e);
    const simple: any = {};
    for (const [name, { rows, headers }] of Object.entries(sheets)) simple[name] = { rows, headers };
    await downloadXlsx(simple, filename);
  }
}
