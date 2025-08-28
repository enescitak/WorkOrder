from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import uvicorn

from database import get_db, create_tables
from models import WorkOrder, Operation
from schemas import WorkOrder as WorkOrderSchema, OperationUpdate
from validation import validate_scheduling_rules
from config import settings

app = FastAPI(title="Work Order Timeline API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    create_tables()

@app.get("/")
async def root():
    return {"message": "Work Order Timeline API v2.0 - FastAPI + PostgreSQL"}

@app.get("/api/workorders", response_model=List[WorkOrderSchema])
async def get_workorders(db: Session = Depends(get_db)):
    work_orders = db.query(WorkOrder).all()
    return work_orders

@app.get("/api/workorders/{work_order_id}", response_model=WorkOrderSchema)
async def get_workorder(work_order_id: str, db: Session = Depends(get_db)):
    work_order = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found")
    return work_order

@app.put("/api/operations/{operation_id}")
async def update_operation(
    operation_id: str, 
    updates: OperationUpdate, 
    db: Session = Depends(get_db)
):
    
    operation = db.query(Operation).filter(Operation.id == operation_id).first()
    if not operation:
        raise HTTPException(status_code=404, detail="Operation not found")
    
    update_dict = {k: v for k, v in updates.dict().items() if v is not None}
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="At least one field (start, end, machine_id) must be provided")
    
    validation = validate_scheduling_rules(db, operation_id, update_dict)
    if not validation.valid:
        raise HTTPException(status_code=400, detail=validation.error)
    
    for key, value in update_dict.items():
        setattr(operation, key, value)

    db.flush()
    db.commit()
    
    updated_operation = db.query(Operation).filter(Operation.id == operation_id).first()
    db.refresh(updated_operation)
    
    return {
        "message": "Operation updated successfully",
        "operation": updated_operation
    }

@app.get("/api/machines")
async def get_machines(db: Session = Depends(get_db)):
    machines = db.query(Operation.machine_id).distinct().all()
    return sorted([machine[0] for machine in machines])

if __name__ == "__main__":
    uvicorn.run(
        "main:app", 
        host=settings.api_host, 
        port=settings.api_port, 
        reload=True
    )
