// Streamlit 원본 색상 팔레트 (app_v20.py woc_color/mv_color/qty_color 정밀 매칭)
export const CLR = {
  red_bg: '#5B1E1E', red_fg: '#FF5A5F',
  yel_bg: '#5A4500', yel_fg: '#FFC000',
  grn_bg: '#1B4D3E', grn_fg: '#4AE3B5',
  sum_bg: '#1E2D40', sum_fg: '#4AE3B5',
  panel: '#0E1B2A', card: '#101E2E', border: '#1F2E42',
  text: '#FFFFFF', muted: '#8FA3BD',
  blue: '#1A5490', green: '#2C6B4A', orange: '#5A3F1A', purple: '#4A2C5C',
};
export const CHANNELS = ['공홈', '무신사', '29CM'] as const;
export const CH_SHORT: Record<string, string> = {
  '공홈': '공홈', '무신사': '무신', '29CM': '29CM',
};
export function wocStyle(w: number | null | undefined): React.CSSProperties {
  if (w === null || w === undefined) return { color: CLR.muted, textAlign: 'right' };
  if (w < 1) return { backgroundColor: CLR.red_bg, color: CLR.red_fg, fontWeight: 700, textAlign: 'right' };
  if (w < 4) return { backgroundColor: CLR.yel_bg, color: CLR.yel_fg, fontWeight: 700, textAlign: 'right' };
  return { backgroundColor: CLR.grn_bg, color: CLR.grn_fg, fontWeight: 700, textAlign: 'right' };
}
