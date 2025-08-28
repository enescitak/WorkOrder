import axios from 'axios';
import { WorkOrder, Operation } from '../types';
const API_BASE = 'http://localhost:5002/api';
export const api = {
  getWorkOrders: async (): Promise<WorkOrder[]> => {
    const response = await axios.get(`${API_BASE}/workorders`);
    const apiWorkOrders = response.data as any[];
    const mapped: WorkOrder[] = apiWorkOrders.map((wo) => ({
      id: wo.id,
      product: wo.product,
      qty: wo.qty,
      operations: (wo.operations || []).map((op: any): Operation => ({
        id: op.id,
        workOrderId: op.work_order_id,
        index: op.index,
        machineId: op.machine_id,
        name: op.name,
        start: op.start,
        end: op.end,
      })),
    }));
    return mapped;
  },
  getMachines: async (): Promise<string[]> => {
    const response = await axios.get(`${API_BASE}/machines`);
    return response.data;
  },
  updateOperation: async (operationId: string, updates: Partial<Operation>): Promise<void> => {
    const payload: any = {};
    if (updates.machineId !== undefined) payload.machine_id = updates.machineId;
    if (updates.start !== undefined) payload.start = updates.start;
    if (updates.end !== undefined) payload.end = updates.end;
    await axios.put(`${API_BASE}/operations/${operationId}`, payload);
  }
};
