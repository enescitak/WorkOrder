const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(bodyParser.json());

let workOrders = [
  {
    id: "WO-1001",
    product: "Widget A",
    qty: 100,
    operations: [
      {
        id: "OP-1",
        workOrderId: "WO-1001",
        index: 1,
        machineId: "M1",
        name: "Cut",
        start: "2025-08-20T09:00:00Z",
        end: "2025-08-20T10:00:00Z"
      },
      {
        id: "OP-2",
        workOrderId: "WO-1001",
        index: 2,
        machineId: "M2",
        name: "Assemble",
        start: "2025-08-20T10:10:00Z",
        end: "2025-08-20T12:00:00Z"
      }
    ]
  },
  {
    id: "WO-1002",
    product: "Widget B",
    qty: 50,
    operations: [
      {
        id: "OP-3",
        workOrderId: "WO-1002",
        index: 1,
        machineId: "M1",
        name: "Cut",
        start: "2025-08-20T09:30:00Z",
        end: "2025-08-20T10:30:00Z"
      },
      {
        id: "OP-4",
        workOrderId: "WO-1002",
        index: 2,
        machineId: "M2",
        name: "Assemble",
        start: "2025-08-20T10:40:00Z",
        end: "2025-08-20T12:15:00Z"
      }
    ]
  }
];

app.get('/api/workorders', (req, res) => {
  res.json(workOrders);
});

app.get('/api/workorders/:id', (req, res) => {
  const workOrder = workOrders.find(wo => wo.id === req.params.id);
  if (!workOrder) {
    return res.status(404).json({ error: 'İş emri bulunamadı' });
  }
  res.json(workOrder);
});

function validateSchedulingRules(operationId, updates, workOrders) {
  let targetOperation = null;
  let targetWorkOrder = null;
  
  for (let wo of workOrders) {
    const operation = wo.operations.find(op => op.id === operationId);
    if (operation) {
      targetOperation = operation;
      targetWorkOrder = wo;
      break;
    }
  }
  
  if (!targetOperation) {
    return { valid: false, error: 'Operation not found' };
  }
  
  const updatedOperation = { ...targetOperation, ...updates };
  const newStart = new Date(updatedOperation.start);
  const newEnd = new Date(updatedOperation.end);
  const now = new Date();
  
  if (newStart < now) {
    return { 
      valid: false, 
      error: `Operation cannot start in the past. Current time: ${now.toISOString()}` 
    };
  }
  
  const sortedOps = targetWorkOrder.operations
    .map(op => op.id === operationId ? updatedOperation : op)
    .sort((a, b) => a.index - b.index);
    
  for (let i = 1; i < sortedOps.length; i++) {
    const prevOp = sortedOps[i - 1];
    const currentOp = sortedOps[i];
    
    if (new Date(currentOp.start) < new Date(prevOp.end)) {
      return { 
        valid: false, 
        error: `Operation ${currentOp.id} (index ${currentOp.index}) cannot start before operation ${prevOp.id} (index ${prevOp.index}) ends at ${prevOp.end}` 
      };
    }
  }
  
  const allOperations = workOrders.flatMap(wo => wo.operations)
    .map(op => op.id === operationId ? updatedOperation : op)
    .filter(op => op.machineId === updatedOperation.machineId && op.id !== operationId);
    
  for (let otherOp of allOperations) {
    const otherStart = new Date(otherOp.start);
    const otherEnd = new Date(otherOp.end);
    
    if (!(newEnd <= otherStart || newStart >= otherEnd)) {
      return { 
        valid: false, 
        error: `Operation ${updatedOperation.id} overlaps with operation ${otherOp.id} on machine ${updatedOperation.machineId}. Other operation: ${otherOp.start} to ${otherOp.end}` 
      };
    }
  }
  
  return { valid: true };
}

app.put('/api/operations/:id', (req, res) => {
  const { id } = req.params;
  const { start, end, machineId } = req.body;
  
  if (!start && !end && !machineId) {
    return res.status(400).json({ error: 'At least one field (start, end, machineId) must be provided' });
  }
  
  let targetOperation = null;
  let targetWorkOrderIndex = -1;
  let targetOperationIndex = -1;
  
  for (let woIndex = 0; woIndex < workOrders.length; woIndex++) {
    const opIndex = workOrders[woIndex].operations.findIndex(op => op.id === id);
    if (opIndex !== -1) {
      targetOperation = workOrders[woIndex].operations[opIndex];
      targetWorkOrderIndex = woIndex;
      targetOperationIndex = opIndex;
      break;
    }
  }
  
  if (!targetOperation) {
    return res.status(404).json({ error: 'Operation not found' });
  }
  
  const updates = {};
  if (start) updates.start = start;
  if (end) updates.end = end;
  if (machineId) updates.machineId = machineId;
  
  const validation = validateSchedulingRules(id, updates, workOrders);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  
  Object.assign(workOrders[targetWorkOrderIndex].operations[targetOperationIndex], updates);
  
  res.json({ 
    message: 'Operation updated successfully',
    operation: workOrders[targetWorkOrderIndex].operations[targetOperationIndex]
  });
});

app.get('/api/machines', (req, res) => {
  const machineIds = [...new Set(workOrders.flatMap(wo => wo.operations.map(op => op.machineId)))];
  res.json(machineIds.sort());
});

app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor`);
});
