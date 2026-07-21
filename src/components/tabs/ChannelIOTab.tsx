'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CLR, CHANNELS } from '@/lib/theme';
import { downloadCsv } from '@/lib/downloads';

type ExclRow = { style: string; channel: string; direction: 'IN' | 'OUT'; from?: string; to?: string; note?: string };

export function ChannelIOTab() {
  const [data, setData] = useState<ExclRow[]>([]);
  const [source, setSource] = useState('');
  const [ch, setCh] = useState('공홈');
  const [dir, setDir] = useState<'전체' | 'IN' | 'OUT'>('전체');
  const [activeOnly, setActiveOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [newRule, setNewRule] = useState<ExclRow>({ style: '', channel: '공홈', direction: 'IN', from: '', to: '', note: '' });
  const [bulkStyles, setBulkStyles] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/gh/ch-excl', { cache: 'no-store' });
      const j = await res.json();
      if (j.status === 'ok' || j.status === 'fallback') {
        setData(Array.isArray(j.data) ? j.data : []); setSource(j.source ?? '');
      }
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    let f = data.filter(r => r.channel === ch);
    if (dir !== '전체') f = f.filter(r => r.direction === dir);
    if (activeOnly) {
      const today = new Date().toISOString().slice(0, 10);
      f = f.filter(r => {
        const fromOk = !r.from || r.from <= today;
        const toOk = !r.to || r.to >= today;
        return fromOk && toOk;
      });
    }
    return f;
  }, [data, ch, dir, activeOnly]);

  const stats = useMemo(() => {
    const s: Record<string, { in: number; out: number }> = {};
    for (const c of CHANNELS) s[c] = { in: 0, out: 0 };
    for (const r of data) {
      if (!s[r.channel]) continue;
      if (r.direction === 'IN') s[r.channel].in++;
      else if (r.direction === 'OUT') s[r.channel].out++;
    }
    return s;
  }, [data]);

  function addRule() {
    if (!newRule.style.trim()) { alert('스타일코드 입력 필요'); return; }
    const next = [...data, { ...newRule, channel: ch, style: newRule.style.trim().toUpperCase() }];
    setData(next);
    setNewRule({ style: '', channel: ch, direction: newRule.direction, from: '', to: '', note: '' });
    setStatus('✅ 임시 추가 (미저장) — 저장 버튼 필요');
  }
  function addBulk() {
    const styles = bulkStyles.split(/[\s,\n]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
    if (styles.length === 0) { alert('스타일코드 목록 입력 필요'); return; }
    const next = [...data];
    for (const sty of styles) {
      // 중복 방지
      if (next.some(r => r.channel === ch && r.direction === newRule.direction && r.style === sty)) continue;
      next.push({ style: sty, channel: ch, direction: newRule.direction, from: newRule.from ?? '', to: newRule.to ?? '', note: newRule.note ?? '(대량 등록)' });
    }
    setData(next); setBulkStyles('');
    setStatus(`✅ 대량 임시 추가 ${styles.length}건 (미저장)`);
  }
  function editRule(idx: number, key: keyof ExclRow, val: string) {
    const next = [...data]; (next[idx] as any)[key] = val; setData(next);
    setStatus('✏️ 임시 편집 (미저장) — 저장 버튼 필요');
  }
  function removeRule(idx: number) {
    const next = [...data]; next.splice(idx, 1); setData(next);
    setStatus('🗑️ 임시 삭제 (미저장) — 저장 버튼 필요');
  }
  async function save() {
    setSaving(true); setStatus('');
    try {
      const res = await fetch('/api/gh/ch-excl/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      const j = await res.json();
      setStatus(j.status === 'ok' ? `✅ 영구 저장 완료 (${data.length}건 · GitHub data/ch_excl.json · 웹 재시작·재배포 후에도 유지)` : `⚠️ ${j.message || '저장 실패'}`);
    } catch (e) { setStatus('❌ ' + e); }
    finally { setSaving(false); }
  }
  function downloadChCsv() {
    const rows = data.filter(r => r.channel === ch).map(r => ({ 채널: r.channel, 방향: r.direction, 스타일: r.style, 시작일: r.from ?? '', 종료일: r.to ?? '', 메모: r.note ?? '' }));
    downloadCsv(rows, ['채널','방향','스타일','시작일','종료일','메모'], `ch_excl_${ch}_${new Date().toISOString().slice(0,10)}`);
  }
  function downloadAllCsv() {
    const rows = data.map(r => ({ 채널: r.channel, 방향: r.direction, 스타일: r.style, 시작일: r.from ?? '', 종료일: r.to ?? '', 메모: r.note ?? '' }));
    downloadCsv(rows, ['채널','방향','스타일','시작일','종료일','메모'], `ch_excl_all_${new Date().toISOString().slice(0,10)}`);
  }
  async function uploadCsv(f: File) {
    try {
      const text = await f.text();
      const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { alert('CSV 형식 오류'); return; }
      const header = lines[0].split(',');
      const iCh = header.indexOf('채널'), iDir = header.indexOf('방향'), iSty = header.indexOf('스타일');
      const iFr = header.indexOf('시작일'), iTo = header.indexOf('종료일'), iNo = header.indexOf('메모');
      if (iCh < 0 || iDir < 0 || iSty < 0) { alert('필수 컬럼(채널·방향·스타일) 누락'); return; }
      const rows: ExclRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const c = lines[i].split(',');
        rows.push({
          channel: c[iCh]?.trim() ?? '',
          direction: (c[iDir]?.trim().toUpperCase() as 'IN' | 'OUT') ?? 'OUT',
          style: c[iSty]?.trim().toUpperCase() ?? '',
          from: iFr >= 0 ? c[iFr]?.trim() : '',
          to: iTo >= 0 ? c[iTo]?.trim() : '',
          note: iNo >= 0 ? c[iNo]?.trim() : '',
        });
      }
      const valid = rows.filter(r => r.channel && r.style);
      if (confirm(`업로드 ${valid.length}건 · 기존 ${data.length}건 → 병합 또는 교체?\nOK=병합 / 취소=교체`)) {
        // 병합
        const key = (r: ExclRow) => `${r.channel}|${r.direction}|${r.style}`;
        const map = new Map<string, ExclRow>();
        for (const r of data) map.set(key(r), r);
        for (const r of valid) map.set(key(r), r);
        setData(Array.from(map.values()));
        setStatus(`✅ 병합 완료 · ${valid.length}건 반영 (미저장)`);
      } else {
        setData(valid);
        setStatus(`✅ 교체 완료 · ${valid.length}건 (미저장)`);
      }
    } catch (e) { alert('업로드 실패: ' + e); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  }

  return (
    <div style={{ fontFamily: 'Inter, "Noto Sans KR", sans-serif', width: '100%' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: CLR.text, marginBottom: 6 }}>🚫 채널별 IN·OUT 제외 관리 (채널 담당 MD)</h2>
      <p style={{ fontSize: 12, color: CLR.muted, marginBottom: 10 }}>
        🟢 IN 제외 = 이 채널로 재고를 받지 않음(수신 차단) · 🔴 OUT 제외 = 이 채널에서 재고를 빼지 않음(반출 차단) · 시작일/종료일 미설정 = 상시 적용
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 12 }}>
        {CHANNELS.map(c => (
          <button key={c} onClick={() => { setCh(c); setNewRule(r => ({ ...r, channel: c })); }}
            style={{ background: CLR.card, border: `2px solid ${ch === c ? CLR.grn_fg : CLR.border}`, borderRadius: 6, padding: 12, textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: 11, color: CLR.muted }}>{c}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: CLR.text, marginTop: 4 }}>{(stats[c]?.in ?? 0) + (stats[c]?.out ?? 0)}건</div>
            <div style={{ fontSize: 10, color: CLR.muted, marginTop: 2 }}>🟢 IN {stats[c]?.in ?? 0} · 🔴 OUT {stats[c]?.out ?? 0}</div>
          </button>
        ))}
      </div>

      {/* 방향 필터 + 활성 기간 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: CLR.panel, padding: 3, borderRadius: 4 }}>
          {(['전체', 'IN', 'OUT'] as const).map(d => (
            <button key={d} onClick={() => setDir(d)} style={{ padding: '6px 14px', background: dir === d ? CLR.grn_fg : 'transparent', color: dir === d ? '#0A141F' : CLR.text, border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{d}</button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: CLR.text, fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} /> 오늘 활성인 규칙만
        </label>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={downloadChCsv} style={{ padding: '7px 12px', background: CLR.panel, color: CLR.text, border: `1px solid ${CLR.border}`, borderRadius: 3, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>⬇️ {ch} CSV</button>
          <button onClick={downloadAllCsv} style={{ padding: '7px 12px', background: CLR.panel, color: CLR.text, border: `1px solid ${CLR.border}`, borderRadius: 3, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>⬇️ 전체 CSV</button>
          <label style={{ padding: '7px 12px', background: CLR.panel, color: CLR.text, border: `1px solid ${CLR.border}`, borderRadius: 3, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📂 CSV 업로드
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) void uploadCsv(f); }} />
          </label>
          <button onClick={save} disabled={saving} style={{ padding: '7px 14px', background: CLR.grn_fg, color: '#0A141F', border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{saving ? '저장 중...' : '💾 GitHub 저장'}</button>
        </div>
      </div>

      {/* 신규 규칙 · 단건 */}
      <div style={{ background: CLR.card, border: `1px solid ${CLR.border}`, borderRadius: 6, padding: 12, marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: CLR.text, marginBottom: 6 }}>➕ 신규 규칙 추가 · {ch}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1.2fr 2fr auto', gap: 6, alignItems: 'center' }}>
          <input placeholder="스타일코드 (예: SPPPG25U05)" value={newRule.style} onChange={e => setNewRule({ ...newRule, style: e.target.value })} style={inpStyle} />
          <select value={newRule.direction} onChange={e => setNewRule({ ...newRule, direction: e.target.value as any })} style={inpStyle}>
            <option value="IN">🟢 IN 제외</option>
            <option value="OUT">🔴 OUT 제외</option>
          </select>
          <input type="date" value={newRule.from ?? ''} onChange={e => setNewRule({ ...newRule, from: e.target.value })} style={inpStyle} placeholder="시작일" />
          <input type="date" value={newRule.to ?? ''} onChange={e => setNewRule({ ...newRule, to: e.target.value })} style={inpStyle} placeholder="종료일" />
          <input placeholder="메모 (선택)" value={newRule.note ?? ''} onChange={e => setNewRule({ ...newRule, note: e.target.value })} style={inpStyle} />
          <button onClick={addRule} style={{ padding: '8px 14px', background: CLR.grn_fg, color: '#0A141F', border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>단건 추가</button>
        </div>
      </div>

      {/* 신규 규칙 · 대량 */}
      <div style={{ background: CLR.card, border: `1px solid ${CLR.border}`, borderRadius: 6, padding: 12, marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: CLR.text, marginBottom: 6 }}>📋 대량 규칙 추가 · {ch} (방향·기간은 위 신규 규칙 값 사용)</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <textarea placeholder="스타일코드를 줄바꿈·쉼표·공백으로 구분해서 붙여넣기" value={bulkStyles} onChange={e => setBulkStyles(e.target.value)} style={{ ...inpStyle, flex: 1, height: 60, resize: 'vertical' }} />
          <button onClick={addBulk} style={{ padding: '10px 14px', background: CLR.grn_fg, color: '#0A141F', border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>대량 추가</button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 12, color: CLR.text }}>📋 <b>{ch}</b> · 필터 <b>{dir}</b>{activeOnly ? ' · 활성만' : ''} — {filtered.length.toLocaleString()}건 (총 {data.length.toLocaleString()}건)</div>
      </div>
      {status && <div style={{ padding: 8, marginBottom: 8, background: status.startsWith('✅') ? 'rgba(74,227,181,0.1)' : 'rgba(255,192,0,0.1)', color: status.startsWith('✅') ? CLR.grn_fg : CLR.yel_fg, fontSize: 12, borderRadius: 3 }}>{status}</div>}
      <div style={{ fontSize: 10, color: CLR.muted, marginBottom: 6 }}>📡 로드 소스: {source}</div>

      <div style={{ background: CLR.card, border: `1px solid ${CLR.border}`, borderRadius: 4, overflow: 'auto', maxHeight: 480 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#0A1826' }}>
            <tr>
              <th style={th()}>#</th><th style={th()}>채널</th><th style={th()}>방향</th>
              <th style={th()}>스타일코드</th><th style={th()}>시작일</th><th style={th()}>종료일</th>
              <th style={th()}>활성</th>
              <th style={th()}>메모</th><th style={th()}></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: CLR.muted }}>로딩 중...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: CLR.muted }}>등록된 규칙 없음</td></tr>}
            {filtered.map((r, i) => {
              const originalIdx = data.indexOf(r);
              const today = new Date().toISOString().slice(0, 10);
              const active = (!r.from || r.from <= today) && (!r.to || r.to >= today);
              return (
                <tr key={i} style={{ borderTop: `1px solid ${CLR.border}` }}>
                  <td style={{ ...td(), color: CLR.muted }}>{i + 1}</td>
                  <td style={{ ...td(), color: CLR.text }}>{r.channel}</td>
                  <td style={{ ...td(), color: r.direction === 'IN' ? CLR.grn_fg : CLR.red_fg, fontWeight: 700 }}>{r.direction === 'IN' ? '🟢 IN' : '🔴 OUT'}</td>
                  <td style={{ ...td(), fontFamily: 'ui-monospace, monospace', color: CLR.text }}>{r.style}</td>
                  <td style={td()}><input type="date" value={r.from ?? ''} onChange={e => editRule(originalIdx, 'from', e.target.value)} style={{ width: 120, padding: '3px 6px', background: CLR.panel, border: `1px solid ${CLR.border}`, borderRadius: 3, color: CLR.text, fontSize: 11 }} /></td>
                  <td style={td()}><input type="date" value={r.to ?? ''} onChange={e => editRule(originalIdx, 'to', e.target.value)} style={{ width: 120, padding: '3px 6px', background: CLR.panel, border: `1px solid ${CLR.border}`, borderRadius: 3, color: CLR.text, fontSize: 11 }} /></td>
                  <td style={{ ...td(), color: active ? CLR.grn_fg : CLR.red_fg }}>{active ? '✓ 활성' : '⚫ 비활성'}</td>
                  <td style={td()}><input type="text" value={r.note ?? ''} onChange={e => editRule(originalIdx, 'note', e.target.value)} style={{ width: 140, padding: '3px 6px', background: CLR.panel, border: `1px solid ${CLR.border}`, borderRadius: 3, color: CLR.text, fontSize: 11 }} placeholder="메모" /></td>
                  <td style={td()}><button onClick={() => removeRule(originalIdx)} style={{ padding: '3px 8px', background: 'transparent', color: CLR.red_fg, border: `1px solid ${CLR.red_fg}`, borderRadius: 3, fontSize: 11, cursor: 'pointer' }}>삭제</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inpStyle: React.CSSProperties = { padding: '7px 9px', background: CLR.panel, border: `1px solid ${CLR.border}`, borderRadius: 3, color: CLR.text, fontSize: 12 };
function th(align: any = 'left'): any { return { padding: '10px 8px', textAlign: align, color: CLR.text, fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', borderBottom: `2px solid ${CLR.border}`, background: '#0A1826' }; }
function td(align: any = 'left'): any { return { padding: '7px 8px', textAlign: align, fontSize: 12, whiteSpace: 'nowrap' }; }
