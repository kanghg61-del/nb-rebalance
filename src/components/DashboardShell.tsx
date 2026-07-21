'use client';
import { createContext, useContext, useState } from 'react';
import { TABS, type TabId } from '@/types/tabs';
import { TodayTab } from './tabs/TodayTab';
import { RebalanceBasicTab } from './tabs/RebalanceBasicTab';
import { RebalanceCustomTab } from './tabs/RebalanceCustomTab';
import { ExecutionLogTab } from './tabs/ExecutionLogTab';
import { AdditionalDistTab } from './tabs/AdditionalDistTab';
import { ReorderTab } from './tabs/ReorderTab';
import { StockViewTab } from './tabs/StockViewTab';
import { ChannelDetailTab } from './tabs/ChannelDetailTab';
import { ChannelIOTab } from './tabs/ChannelIOTab';
import { AiSummaryTab } from './tabs/AiSummaryTab';
import { AppHeader } from './AppHeader';
import { DataSourceCard } from './DataSourceCard';

const APP_VERSION = '0.1.0';
const APP_STAGE = 'v0.9';

const TabCtx = createContext<{ tab: TabId; setTab: (t: TabId) => void }>({ tab: 'today', setTab: () => {} });
export function useTabNav() { return useContext(TabCtx); }

export function DashboardShell() {
  const [tab, setTab] = useState<TabId>('today');

  return (
    <TabCtx.Provider value={{ tab, setTab }}>
      <main style={{ minHeight: '100vh', padding: '16px 14px 40px' }}>
        <AppHeader stage={APP_STAGE} version={APP_VERSION} />
        <div style={{ margin: '16px 0' }}><DataSourceCard /></div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20, borderBottom: '1px solid var(--border-strong)' }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                background: tab === t.id ? 'var(--accent)' : 'var(--bg-card)',
                border: tab === t.id ? '1px solid var(--accent)' : '1px solid var(--border-strong)',
                borderRadius: '10px 10px 0 0',
                padding: '10px 20px',
                color: tab === t.id ? '#0A141F' : 'var(--text-primary)',
                fontSize: 14, fontWeight: 700, marginBottom: -1, cursor: 'pointer',
              }}>
              <span style={{ marginRight: 4 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        <section>
          {tab === 'today' && <TodayTab />}
          {tab === 'rebalance-basic' && <RebalanceBasicTab />}
          {tab === 'rebalance-custom' && <RebalanceCustomTab />}
          {tab === 'execution-log' && <ExecutionLogTab />}
          {tab === 'additional-dist' && <AdditionalDistTab />}
          {tab === 'reorder' && <ReorderTab />}
          {tab === 'stock-view' && <StockViewTab />}
          {tab === 'channel-detail' && <ChannelDetailTab />}
          {tab === 'channel-io' && <ChannelIOTab />}
          {tab === 'ai-summary' && <AiSummaryTab />}
        </section>
      </main>
    </TabCtx.Provider>
  );
}
