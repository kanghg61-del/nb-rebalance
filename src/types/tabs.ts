export type TabId =
  | 'today'          // 🗳️ 오늘의 결재
  | 'rebalance-basic'  // 🛡️ 재배치(기본)
  | 'rebalance-custom' // 🎛️ 재배치(임의)
  | 'execution-log'    // 📈 실행 효과
  | 'additional-dist'  // 🧩 추가 분배
  | 'reorder'          // 🚨 리오더 요청
  | 'stock-view'       // 🏬 통합 재고뷰
  | 'channel-detail'   // 📊 채널 별 세부
  | 'channel-io'       // 🚫 채널 IN-OUT (MD 기입)
  | 'ai-summary';      // 🤖 AI 일일 요약(TEST)

export type Tab = { id: TabId; icon: string; label: string; };

// Streamlit 원본 순서·이름·아이콘 정확 매칭
export const TABS: Tab[] = [
  { id: 'today', icon: '🗳️', label: '오늘의 결재' },
  { id: 'rebalance-basic', icon: '🛡️', label: '재배치(기본)' },
  { id: 'rebalance-custom', icon: '🎛️', label: '재배치(임의)' },
  { id: 'execution-log', icon: '📈', label: '실행 효과' },
  { id: 'additional-dist', icon: '🧩', label: '추가 분배' },
  { id: 'reorder', icon: '🚨', label: '리오더 요청' },
  { id: 'stock-view', icon: '🏬', label: '통합 재고뷰' },
  { id: 'channel-detail', icon: '📊', label: '채널 별 세부' },
  { id: 'channel-io', icon: '🚫', label: '채널 IN-OUT (MD 기입)' },
  { id: 'ai-summary', icon: '🤖', label: 'AI 일일 요약(TEST)' },
];
