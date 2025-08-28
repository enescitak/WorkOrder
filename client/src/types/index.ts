export interface Operation {
  id: string;
  workOrderId: string;
  index: number;
  machineId: string;
  name: string;
  start: string;
  end: string;
}

export interface WorkOrder {
  id: string;
  product: string;
  qty: number;
  operations: Operation[];
}

export interface TimelineData {
  workOrders: WorkOrder[];
  machines: string[];
}
