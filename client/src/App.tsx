import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import GanttChart from './components/GanttChart';
import { WorkOrder, Operation } from './types';
import { api } from './services/api';
import './App.css';

function App() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [machines, setMachines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: number; type: 'error' | 'warning' | 'success'; title: string; message: string }>>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [workOrdersData, machinesData] = await Promise.all([
        api.getWorkOrders(),
        api.getMachines()
      ]);
      setWorkOrders(workOrdersData);
      setMachines(machinesData);
    } catch (err) {
      setError('Veri yüklenirken hata oluştu. Sunucunun çalıştığından emin olun.');
      console.error('❌ Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type: 'error' | 'warning' | 'success', title: string, message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  // Yardımcılar
  const formatDT = (d: Date) => format(d, 'dd.MM HH:mm', { locale: tr });

  const findOpContext = (operationId: string) => {
    for (const wo of workOrders) {
      const op = wo.operations.find(o => o.id === operationId);
      if (op) return { op, wo };
    }
    return null;
  };

  const roundUpToHour = (d: Date) => {
    const r = new Date(d);
    if (r.getMinutes() > 0 || r.getSeconds() > 0 || r.getMilliseconds() > 0) {
      r.setHours(r.getHours() + 1);
      r.setMinutes(0, 0, 0);
    } else {
      r.setMinutes(0, 0, 0);
    }
    return r;
  };

  const classifyRuleError = (raw: string, operationId: string, updates: Partial<Operation>) => {
    const text = (raw || '').toLowerCase();
    const ctx = findOpContext(operationId);
    const start = updates.start ? new Date(updates.start) : null;
    const end = updates.end ? new Date(updates.end) : null;

    if (text.includes('r1') || text.includes('precedence') || text.includes('öncelik') || text.includes('once') || text.includes('önceki')) {
      let tip = 'Bu operasyon, önceki operasyon bitmeden başlayamaz.';
      if (ctx && typeof ctx.op.index === 'number' && ctx.op.index > 0) {
        const prev = ctx.wo.operations.find(o => o.index === ctx.op.index - 1);
        if (prev) {
          const prevEnd = new Date(prev.end);
          tip += ` Öneri: Başlangıcı en erken ${formatDT(prevEnd)} sonrasına taşıyın.`;
        }
      }
      return {
        rule: 'R1',
        title: 'Sıralama Kuralı (R1)',
        message: tip,
        type: 'warning' as const,
      };
    }
    if (text.includes('r2') || text.includes('overlap') || text.includes('çakış') || text.includes('conflict') || text.includes('aynı makine')) {
      let tip = 'Aynı makinede aynı zaman aralığında iki operasyon olamaz.';
      if (updates.machineId && start && end) {
        const overlaps: Array<{ id: string; start: Date; end: Date }> = [];
        for (const wo of workOrders) {
          for (const o of wo.operations) {
            if (o.machineId !== updates.machineId || o.id === operationId) continue;
            const os = new Date(o.start);
            const oe = new Date(o.end);
            const isOverlap = !(oe <= start || os >= end);
            if (isOverlap) overlaps.push({ id: o.id, start: os, end: oe });
          }
        }
        if (overlaps.length > 0) {
          const latestEnd = overlaps.reduce((acc, cur) => (cur.end > acc ? cur.end : acc), overlaps[0].end);
          tip += ` Bu makinede dolu aralıklar var. Öneri: En erken ${formatDT(latestEnd)} sonrasına taşıyın veya farklı bir makine seçin.`;
        }
      }
      return {
        rule: 'R2',
        title: 'Makine Çakışması (R2)',
        message: tip,
        type: 'error' as const,
      };
    }
    if (text.includes('r3') || text.includes('past') || text.includes('geçmiş') || text.includes('now') || text.includes('şu an')) {
      let tip = 'Operasyon başlangıcı şimdi saatinden önce olamaz.';
      const now = new Date();
      const suggest = formatDT(roundUpToHour(now));
      tip += ` Öneri: Başlangıcı ${suggest} veya sonrasına taşıyın.`;
      return {
        rule: 'R3',
        title: 'Geçmişe Planlama Yok (R3)',
        message: tip,
        type: 'warning' as const,
      };
    }
    return {
      rule: 'GENERIC',
      title: 'Planlama Hatası',
      message: (raw ? `${raw}. ` : '') + 'Lütfen saat aralığını ve makineyi kontrol edip tekrar deneyin.',
      type: 'error' as const,
    };
  };

  const handleOperationUpdate = async (operationId: string, updates: Partial<Operation>) => {
    try {
      await api.updateOperation(operationId, updates);
      setWorkOrders(prevWorkOrders => 
        prevWorkOrders.map(wo => ({
          ...wo,
          operations: wo.operations.map(op => 
            op.id === operationId ? { ...op, ...updates } : op
          )
        }))
      );
      setError(null);
      showToast('success', 'Güncellendi', 'Operasyon planı başarıyla güncellendi.');
    } catch (err: any) {
      console.error('Error updating operation:', err);
      const backendError = err?.response?.data?.error || err?.message || '';
      const classified = classifyRuleError(backendError, operationId, updates);
      showToast(classified.type, classified.title, classified.message);
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="App">
        <div className="loading">
          <div className="spinner"></div>
          <p>İş emirleri yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      {}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            <div className="toast-icon" aria-hidden>
              {t.type === 'success' ? '✓' : t.type === 'warning' ? '!' : '✕'}
            </div>
            <div className="toast-content">
              <div className="toast-title">{t.title}</div>
              <div className="toast-message">{t.message}</div>
            </div>
          </div>
        ))}
      </div>
      {error && (
        <div className="error" style={{margin:"16px auto", maxWidth: 960}}>
          <h2>Hata</h2>
          <p>{error}</p>
          <div style={{display:'flex', gap:8}}>
            <button onClick={() => setError(null)} className="retry-button">Kapat</button>
            <button onClick={loadData} className="retry-button">Yenile</button>
          </div>
        </div>
      )}
      <GanttChart 
        workOrders={workOrders}
        machines={machines}
        onOperationUpdate={handleOperationUpdate}
      />
    </div>
  );
}

export default App;
