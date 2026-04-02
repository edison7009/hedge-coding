// ModelPricing.tsx — Model pricing tab using ScrollPanel

import { useState, useEffect, useCallback } from 'react';
import { useAppState } from '../../store/app-state';
import { useT } from '../../i18n/useT';
import { ScrollPanel } from '../common/ScrollPanel';
import type { ModelPrice } from '../../store/app-state';
import './ModelPricing.css';

const CACHE_KEY = 'hc-pricing';
const CACHE_TTL = 86400000; // 24h

async function fetchPricing(force = false): Promise<ModelPrice[]> {
  if (!force) {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) return data;
      }
    } catch {}
  }

  const res = await fetch('https://openrouter.ai/api/v1/models');
  const json = await res.json();
  const models: ModelPrice[] = (json.data || [])
    .filter((m: { pricing?: { prompt?: string } }) => m.pricing && parseFloat(m.pricing.prompt ?? '0') > 0)
    .map((m: { id: string; name: string; pricing: { prompt: string; completion: string }; context_length?: number }) => ({
      id: m.id,
      name: m.name,
      provider: (m.id.split('/')[0] || 'other').replace(/^./, (c: string) => c.toUpperCase()),
      input: parseFloat(m.pricing.prompt) * 1e6,
      output: parseFloat(m.pricing.completion) * 1e6,
      context: m.context_length || 0,
    }))
    .sort((a: ModelPrice, b: ModelPrice) =>
      a.provider.localeCompare(b.provider) || b.input - a.input
    );

  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: models, ts: Date.now() })); } catch {}
  return models;
}

function priceClass(val: number, thresholdHigh: number, thresholdMid: number) {
  if (val >= thresholdHigh) return 'price expensive';
  if (val >= thresholdMid) return 'price mid';
  return 'price cheap';
}

export function ModelPricing() {
  const { dispatch } = useAppState();
  const t = useT();
  const [models, setModels] = useState<ModelPrice[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>('');

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPricing(force);
      setModels(data);
      dispatch({ type: 'SET_PRICING', models: data });
      setUpdatedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => { load(false); }, [load]);

  const filtered = filter
    ? models.filter(m =>
        m.name.toLowerCase().includes(filter.toLowerCase()) ||
        m.id.toLowerCase().includes(filter.toLowerCase()) ||
        m.provider.toLowerCase().includes(filter.toLowerCase())
      )
    : models;

  // Group by provider
  const providerGroups: { provider: string; providerId: string; items: ModelPrice[] }[] = [];
  for (const m of filtered) {
    const last = providerGroups[providerGroups.length - 1];
    
    // Map openrouter string to consistent logo file name
    const providerId = m.provider.toLowerCase().replace(/[^a-z0-9-]/g, '');

    if (last && last.provider === m.provider) {
      last.items.push(m);
    } else {
      providerGroups.push({ provider: m.provider, providerId, items: [m] });
    }
  }

  const cleanModelName = (name: string, provider: string) => {
    const rx = new RegExp(`^${provider}[\\s:-]+`, 'i');
    let cleaned = name.replace(rx, '').trim();
    if (cleaned.toLowerCase().startsWith(provider.toLowerCase())) {
      cleaned = cleaned.slice(provider.length).trim();
    }
    if (!cleaned) return name;
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  };

  const getProviderIcon = (provider: string, providerId: string) => {
    const n = provider.toLowerCase();
    if (n.includes('openai')) return 'chatgpt.svg';
    if (n.includes('anthropic')) return 'claude.svg';
    if (n.includes('google')) return 'gemini.svg';
    if (n.includes('meta')) return 'llama.svg';
    if (n.includes('alibaba')) return 'qwen.svg';
    if (n.includes('zhipu') || n.includes('z-ai')) return 'z-ai.svg';
    if (n.includes('bytedance')) return 'bytedance.svg';
    if (n.includes('tencent')) return 'hunyuan.svg';
    if (n.includes('x-ai')) return 'grok.svg';
    
    // 默认直接拿产商纯字母ID去请求，例如 amazon.svg
    // 如果抛出 404 找不到，下方的 img onError 机制会自动介入替换成首字母。从此一劳永逸！
    return `${providerId}.svg`;
  };

  return (
    <div className="model-pricing-view">
      <div className="pricing-header">
        <input
          className="pricing-search"
          type="text"
          placeholder={t('costintel.search')}
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <div className="pricing-meta">
          {updatedAt && <span className="pricing-updated">{t('costintel.updated')} {updatedAt}</span>}
          <button className="icon-btn xs" onClick={() => load(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>
      </div>

      <ScrollPanel className="pricing-body">
        {loading && (
          <div className="empty-state" style={{opacity: 0.5}}>
            <svg 
              className="spin-loader" 
              width="24" height="24" viewBox="0 0 24 24" 
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <line x1="12" y1="2" x2="12" y2="6"></line>
              <line x1="12" y1="18" x2="12" y2="22"></line>
              <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
              <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
              <line x1="2" y1="12" x2="6" y2="12"></line>
              <line x1="18" y1="12" x2="22" y2="12"></line>
              <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
              <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
            </svg>
          </div>
        )}
        {error && (
          <div className="empty-state">
            <div className="empty-icon">⚠️</div>
            <p>Failed to load: {error}</p>
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <p>No models found.</p>
          </div>
        )}
        {!loading && !error && providerGroups.map(group => {
          const iconFile = getProviderIcon(group.provider, group.providerId);
          return (
          <div key={group.provider} className="provider-section">
            <div className="provider-header">
              {iconFile ? (
                <span className="provider-logo">
                  <img 
                    src={`/models/${iconFile}`} 
                    alt={group.provider} 
                    style={{ width: '16px', height: '16px', objectFit: 'contain' }}
                    onError={(e) => {
                      const t = e.target as HTMLImageElement;
                      t.style.display = 'none';
                      if (t.parentElement) t.parentElement.innerText = group.provider.charAt(0);
                    }}
                  />
                </span>
              ) : (
                <span className="provider-logo" style={{ fontSize: '12px', fontWeight: 'bold' }}>
                  {group.provider.charAt(0)}
                </span>
              )}
              <span>{group.provider}</span>
            </div>
            
            <div className="provider-grid-ticker">
              {group.items.map(m => (
                <div key={m.id} className="pricing-ticker-row">
                  <span className="ticker-name">{cleanModelName(m.name, group.provider)}</span>
                  <div className="ticker-prices">
                    <span className={priceClass(m.input, 10, 1)}>${m.input.toFixed(2)}</span>
                    <span className="ticker-sep">/</span>
                    <span className={priceClass(m.output, 30, 5)}>${m.output.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          );
        })}
      </ScrollPanel>
    </div>
  );
}
