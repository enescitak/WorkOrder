from pydantic import BaseModel, field_serializer
from datetime import datetime, timezone
from typing import List, Optional

class OperationBase(BaseModel):
    work_order_id: str
    index: int
    machine_id: str
    name: str
    start: datetime
    end: datetime

class OperationCreate(OperationBase):
    id: str

class OperationUpdate(BaseModel):
    machine_id: Optional[str] = None
    start: Optional[datetime] = None
    end: Optional[datetime] = None

class Operation(OperationBase):
    id: str
    created_at: datetime
    updated_at: datetime
    
    @field_serializer('start', 'end', 'created_at', 'updated_at')
    def serialize_datetime(self, dt: datetime) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt.isoformat().replace('+00:00', 'Z')
    
    class Config:
        from_attributes = True

class WorkOrderBase(BaseModel):
    product: str
    qty: int

class WorkOrderCreate(WorkOrderBase):
    id: str
    operations: List[OperationCreate] = []

class WorkOrder(WorkOrderBase):
    id: str
    created_at: datetime
    updated_at: datetime
    operations: List[Operation] = []
    
    @field_serializer('created_at', 'updated_at')
    def serialize_datetime(self, dt: datetime) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt.isoformat().replace('+00:00', 'Z')
    
    class Config:
        from_attributes = True

class ValidationError(BaseModel):
    error: str
