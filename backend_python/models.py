from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class WorkOrder(Base):
    __tablename__ = "work_orders"
    
    id = Column(String, primary_key=True)
    product = Column(String, nullable=False)
    qty = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    operations = relationship("Operation", back_populates="work_order", cascade="all, delete-orphan")

class Operation(Base):
    __tablename__ = "operations"
    
    id = Column(String, primary_key=True)
    work_order_id = Column(String, ForeignKey("work_orders.id"), nullable=False)
    index = Column(Integer, nullable=False)  # precedence order within the WO
    machine_id = Column(String, nullable=False)  # lane key
    name = Column(String, nullable=False)
    start = Column(DateTime(timezone=True), nullable=False)
    end = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    work_order = relationship("WorkOrder", back_populates="operations")
