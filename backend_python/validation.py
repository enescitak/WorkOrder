from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from models import Operation, WorkOrder

class ValidationResult:
    def __init__(self, valid: bool, error: Optional[str] = None):
        self.valid = valid
        self.error = error

def validate_scheduling_rules(
    db: Session, 
    operation_id: str, 
    updates: Dict[str, Any]
) -> ValidationResult:
    
    operation = db.query(Operation).filter(Operation.id == operation_id).first()
    if not operation:
        return ValidationResult(False, "Operation not found")
    
    work_order = db.query(WorkOrder).filter(WorkOrder.id == operation.work_order_id).first()
    if not work_order:
        return ValidationResult(False, "Work order not found")
    
    updated_start = updates.get('start', operation.start)
    updated_end = updates.get('end', operation.end)  
    updated_machine_id = updates.get('machine_id', operation.machine_id)
    
    if isinstance(updated_start, str):
        if updated_start.endswith('Z'):
            updated_start = datetime.fromisoformat(updated_start.replace('Z', '+00:00'))
        else:
            dt = datetime.fromisoformat(updated_start)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            updated_start = dt
    if isinstance(updated_end, str):
        if updated_end.endswith('Z'):
            updated_end = datetime.fromisoformat(updated_end.replace('Z', '+00:00'))
        else:
            dt = datetime.fromisoformat(updated_end)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            updated_end = dt
    
    now = datetime.now(timezone.utc)
    
    if updated_start.tzinfo is None:
        updated_start = updated_start.replace(tzinfo=timezone.utc)
    
    if updated_start < now:
        return ValidationResult(
            False, 
            f"Operation cannot start in the past. Current time: {now.isoformat().replace('+00:00', 'Z')}"
        )
    
    all_ops_in_wo = db.query(Operation).filter(Operation.work_order_id == operation.work_order_id).all()
    
    ops_for_validation = []
    for op in all_ops_in_wo:
        if op.id == operation_id:
            ops_for_validation.append({
                'id': op.id,
                'index': op.index,
                'start': updated_start,
                'end': updated_end,
                'machine_id': updated_machine_id
            })
        else:
            op_start = op.start
            op_end = op.end
            if op_start.tzinfo is None:
                op_start = op_start.replace(tzinfo=timezone.utc)
            if op_end.tzinfo is None:
                op_end = op_end.replace(tzinfo=timezone.utc)
                
            ops_for_validation.append({
                'id': op.id, 
                'index': op.index,
                'start': op_start,
                'end': op_end,
                'machine_id': op.machine_id
            })
    
    ops_for_validation.sort(key=lambda x: x['index'])
    
    for i in range(1, len(ops_for_validation)):
        prev_op = ops_for_validation[i - 1]
        current_op = ops_for_validation[i]
        
        if current_op['start'] < prev_op['end']:
            return ValidationResult(
                False,
                f"Operation {current_op['id']} (index {current_op['index']}) cannot start before operation {prev_op['id']} (index {prev_op['index']}) ends at {prev_op['end'].isoformat().replace('+00:00', 'Z')}"
            )
    
    all_operations = db.query(Operation).all()
    
    for other_op in all_operations:
        if other_op.id == operation_id:
            continue
            
        if other_op.machine_id != updated_machine_id:
            continue
            
        other_start = other_op.start
        other_end = other_op.end
        
        if other_start.tzinfo is None:
            other_start = other_start.replace(tzinfo=timezone.utc)
        if other_end.tzinfo is None:
            other_end = other_end.replace(tzinfo=timezone.utc)
        
        if not (updated_end <= other_start or updated_start >= other_end):
            return ValidationResult(
                False,
                f"Operation {operation_id} overlaps with operation {other_op.id} on machine {updated_machine_id}. Other operation: {other_start.isoformat().replace('+00:00', 'Z')} to {other_end.isoformat().replace('+00:00', 'Z')}"
            )
    
    return ValidationResult(True)
