import React, { useState, useEffect } from 'react';
import GanttChart from './components/GanttChart';
import { WorkOrder, Operation } from './types';
import { api } from './services/api';
import './App.css';

function App() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [machines, setMachines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err: any) {
      console.error('Error updating operation:', err);
      const errorMessage = err.response?.data?.error || 'Operasyon güncellenirken hata oluştu.';
      setError(`❌ Drag & Drop Failed: ${errorMessage}`);
      setTimeout(() => setError(null), 5000);
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
