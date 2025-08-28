from datetime import datetime
from sqlalchemy.orm import Session
from database import SessionLocal, create_tables
from models import WorkOrder, Operation

def create_seed_data():
    create_tables()
    
    db = SessionLocal()
    
    try:
        db.query(Operation).delete()
        db.query(WorkOrder).delete()
        db.commit()
        
        seed_data = [
            {
                "id": "WO-1001",
                "product": "Widget A", 
                "qty": 150,
                "operations": [
                    {
                        "id": "OP-1",
                        "work_order_id": "WO-1001",
                        "index": 1,
                        "machine_id": "M1",
                        "name": "Cut",
                        "start": "2025-08-20T09:00:00Z",
                        "end": "2025-08-20T10:00:00Z"
                    },
                    {
                        "id": "OP-2", 
                        "work_order_id": "WO-1001",
                        "index": 2,
                        "machine_id": "M2",
                        "name": "Assemble",
                        "start": "2025-08-20T10:10:00Z", 
                        "end": "2025-08-20T12:00:00Z"
                    }
                ]
            },
            {
                "id": "WO-1002",
                "product": "Widget B",
                "qty": 75,
                "operations": [
                    {
                        "id": "OP-3",
                        "work_order_id": "WO-1002", 
                        "index": 1,
                        "machine_id": "M1",
                        "name": "Cut",
                        "start": "2025-08-20T09:30:00Z",
                        "end": "2025-08-20T10:30:00Z"
                    },
                    {
                        "id": "OP-4",
                        "work_order_id": "WO-1002",
                        "index": 2, 
                        "machine_id": "M2",
                        "name": "Assemble",
                        "start": "2025-08-20T10:40:00Z",
                        "end": "2025-08-20T12:15:00Z"
                    }
                ]
            }
        ]
        
        for wo_data in seed_data:
            work_order = WorkOrder(
                id=wo_data["id"],
                product=wo_data["product"],
                qty=wo_data["qty"]
            )
            db.add(work_order)
            
            for op_data in wo_data["operations"]:
                operation = Operation(
                    id=op_data["id"],
                    work_order_id=op_data["work_order_id"],
                    index=op_data["index"], 
                    machine_id=op_data["machine_id"],
                    name=op_data["name"],
                    start=datetime.fromisoformat(op_data["start"].replace('Z', '+00:00')),
                    end=datetime.fromisoformat(op_data["end"].replace('Z', '+00:00'))
                )
                db.add(operation)
        
        db.commit()
        print("✅ Seed data created successfully!")
        
        work_orders = db.query(WorkOrder).count()
        operations = db.query(Operation).count() 
        print(f"📊 Created {work_orders} work orders and {operations} operations")
        
    except Exception as e:
        print(f"❌ Error creating seed data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_seed_data()
