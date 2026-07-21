'use client';

export function KpiCard({
  title, badge, badgeColor, subtitle,
  metricLabel, metricValue, metricUnit,
  amountLabel, amountValue, amountUnit,
  footer, accent,
}: {
  title: string;
  badge?: string;
  badgeColor?: string;
  subtitle?: string;
  metricLabel: string;
  metricValue: string;
  metricUnit?: string;
  amountLabel: string;
  amountValue: string;
  amountUnit?: string;
  footer?: string;
  accent: string;
}) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${accent}30`,
      borderTop: `3px solid ${accent}`,
      borderRadius: 12,
      padding: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18, color: accent }}>{title.split(' ')[0]}</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{title.split(' ').slice(1).join(' ')}</span>
        </div>
        {badge && (
          <span style={{
            padding: '3px 10px',
            background: (badgeColor ?? accent) + '20',
            color: badgeColor ?? accent,
            border: `1px solid ${badgeColor ?? accent}`,
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 600,
          }}>
            {badge}
          </span>
        )}
      </div>
      {subtitle && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>{subtitle}</div>
      )}

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{metricLabel}</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: accent, lineHeight: 1.1 }}>
          {metricValue}<span style={{ fontSize: 18, marginLeft: 4 }}>{metricUnit ?? ''}</span>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{amountLabel}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>
          {amountValue}<span style={{ fontSize: 18, marginLeft: 4 }}>{amountUnit ?? ''}</span>
        </div>
      </div>

      {footer && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
          {footer}
        </div>
      )}
    </div>
  );
}
