import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { format, startOfHour, eachHourOfInterval, parseISO, addHours, subHours } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  useSensor, 
  useSensors, 
  PointerSensor,
  TouchSensor,
  DragStartEvent,
  useDraggable,
  useDroppable,
  MeasuringStrategy,
  pointerWithin
} from '@dnd-kit/core';
import { WorkOrder, Operation } from '../types';
import './GanttChart.css';
const DraggableOperation: React.FC<{
  operation: Operation;
  workOrderColor: string;
  position: { left: string; width: string };
  isHighlighted: boolean;
  isConflicting: boolean;
  onClick: (operation: Operation, event: React.MouseEvent) => void;
}> = ({ operation, workOrderColor, position, isHighlighted, isConflicting, onClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: operation.id,
  });
  const style = {
    ...position,
    backgroundColor: workOrderColor,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`operation-bar ${isDragging ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''} ${isConflicting ? 'conflicting' : ''}`}
      onClick={(e) => { if (isDragging) return; onClick(operation, e); }}
      {...listeners}
      {...attributes}
    >
      <div className="operation-content">
        <span className="operation-title">
          {operation.workOrderId} · {operation.name}
        </span>
        <span className="operation-time">
          {format(parseISO(operation.start), 'HH:mm', { locale: tr })} - 
          {format(parseISO(operation.end), 'HH:mm', { locale: tr })}
        </span>
      </div>
    </div>
  );
};
const DroppableTimeCell: React.FC<{
  machine: string;
  timeSlot: Date;
}> = ({ machine, timeSlot }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `${machine}::${timeSlot.getTime()}`,
  });
  return (
    <div ref={setNodeRef} className={`time-cell ${isOver ? 'drop-zone-over' : ''}`}></div>
  );
};
interface GanttChartProps {
  workOrders: WorkOrder[];
  machines: string[];
  onOperationUpdate: (operationId: string, updates: Partial<Operation>) => void;
}
const GanttChart: React.FC<GanttChartProps> = ({ workOrders, machines, onOperationUpdate }) => {
  const [draggedOperation, setDraggedOperation] = useState<Operation | null>(null);
  const [highlightedWorkOrderId, setHighlightedWorkOrderId] = useState<string | null>(null);
  const [conflictingOperations, setConflictingOperations] = useState<Set<string>>(new Set());
  const [selectedWorkOrderFilter, setSelectedWorkOrderFilter] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const filteredWorkOrders = useMemo(() => {
    if (!selectedWorkOrderFilter) return workOrders;
    return workOrders.filter(wo => wo.id === selectedWorkOrderFilter);
  }, [workOrders, selectedWorkOrderFilter]);
  const timeRange = useMemo(() => {
    const now = new Date();
    const sixHoursBefore = subHours(now, 6);
    const rangeStart = startOfHour(sixHoursBefore); // grid saat başından başlar
    const rangeEnd = addHours(rangeStart, 48);
    return { start: rangeStart, end: rangeEnd };
  }, []);
  const timeSlots = useMemo(() => {
    const slots = eachHourOfInterval({
      start: timeRange.start,
      end: timeRange.end
    });
    return slots.slice(0, -1);
  }, [timeRange]);
  
  useEffect(() => {
    const computeZoom = (width: number) => {
      if (width < 640) return 0.6;
      if (width < 1024) return 0.8;
      if (width < 1280) return 0.95;
      if (width < 1536) return 1.05;
      if (width < 1920) return 1.15;
      return 1.3;
    };
    const handleResize = () => {
      setZoomLevel(computeZoom(window.innerWidth));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  // Her saat slotu için sabit piksel genişliği (48 * 84 = 4032px toplam)
  const slotWidth = useMemo(() => {
    return 84 * zoomLevel;
  }, [zoomLevel]);

  // Toplam timeline genişliği slot sayısı ile belirlenir
  const timelineWidth = useMemo(() => {
    return slotWidth * timeSlots.length;
  }, [slotWidth, timeSlots.length]);
  const gridColumns = useMemo(() => {
    return `repeat(${timeSlots.length}, ${slotWidth}px)`;
  }, [timeSlots.length, slotWidth]);
  const gridStyle = useMemo(() => ({
    display: 'grid',
    gridTemplateColumns: gridColumns,
    width: `${timelineWidth}px`,
    ['--slot-width' as any]: `${slotWidth}px`,
    ['--timeline-width' as any]: `${timelineWidth}px`
  }), [gridColumns, timelineWidth, slotWidth]);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 9,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 8,
      },
    })
  );
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const operation = findOperationById(active.id as string);
    setDraggedOperation(operation);
  };
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedOperation(null);
    if (!over) {
      return;
    }
    const operationId = active.id as string;
    const overId = String(over.id);
    const sep = '::';
    const sepIndex = overId.lastIndexOf(sep);
    const newMachineId = sepIndex >= 0 ? overId.slice(0, sepIndex) : '';
    const timeSlotStr = sepIndex >= 0 ? overId.slice(sepIndex + sep.length) : '';
    if (!newMachineId || !timeSlotStr) {
      return;
    }
    const operation = findOperationById(operationId);
    if (!operation) {
      return;
    }
    const ts = Number(timeSlotStr);
    if (Number.isNaN(ts)) {
      return;
    }
    const newStartTime = new Date(ts);
    const durationMs = parseISO(operation.end).getTime() - parseISO(operation.start).getTime();
    const newEndTime = new Date(newStartTime.getTime() + durationMs);
    const sameMachine = operation.machineId === newMachineId;
    const sameStart = parseISO(operation.start).getTime() === newStartTime.getTime();
    const sameEnd = parseISO(operation.end).getTime() === newEndTime.getTime();
    if (sameMachine && sameStart && sameEnd) {
      return;
    }
    const updates = {
      machineId: newMachineId,
      start: newStartTime.toISOString(),
      end: newEndTime.toISOString()
    };
    onOperationUpdate(operationId, updates);
  };
  const findOperationById = (operationId: string): Operation | null => {
    for (const wo of workOrders) {
      const operation = wo.operations.find(op => op.id === operationId);
      if (operation) return operation;
    }
    return null;
  };
  const handleOperationClick = (operation: Operation, event: React.MouseEvent) => {
    event.stopPropagation();
    setHighlightedWorkOrderId(operation.workOrderId);
  };
  const handleClearHighlight = () => {
    setHighlightedWorkOrderId(null);
  };
  const detectConflicts = useMemo(() => {
    const conflicts = new Set<string>();
    const allOperations = workOrders.flatMap(wo => wo.operations);
    for (let i = 0; i < allOperations.length; i++) {
      for (let j = i + 1; j < allOperations.length; j++) {
        const op1 = allOperations[i];
        const op2 = allOperations[j];
        if (op1.machineId !== op2.machineId) continue;
        const start1 = parseISO(op1.start);
        const end1 = parseISO(op1.end);
        const start2 = parseISO(op2.start);
        const end2 = parseISO(op2.end);
        if (!(end1 <= start2 || start1 >= end2)) {
          conflicts.add(op1.id);
          conflicts.add(op2.id);
        }
      }
    }
    return conflicts;
  }, [workOrders]);
  useEffect(() => {
    setConflictingOperations(detectConflicts);
  }, [detectConflicts]);
  const getOperationPosition = (operation: Operation) => {
    const startTime = parseISO(operation.start);
    const endTime = parseISO(operation.end);
    const hourMs = 60 * 60 * 1000;
    const startMsFromRange = startTime.getTime() - timeRange.start.getTime();
    const endMsFromRange = endTime.getTime() - timeRange.start.getTime();
    const startHours = startMsFromRange / hourMs;
    const endHours = endMsFromRange / hourMs;
    const leftPx = Math.round(startHours * slotWidth);
    const rightPx = Math.round(endHours * slotWidth);
    const widthPx = Math.max(2, rightPx - leftPx - 1);
    return {
      left: `${leftPx}px`,
      width: `${widthPx}px`
    };
  };
  const getOperationColor = (workOrderId: string) => {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];
    const index = workOrders.findIndex(wo => wo.id === workOrderId);
    return colors[index % colors.length];
  };
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [nowTick, setNowTick] = useState(0);
  const nowLabel = format(new Date(), 'HH:mm', { locale: tr });
  const getNowLeftPx = useCallback(() => {
    const now = new Date();
    const machineColumnWidthPx = 88;
    const hourMs = 60 * 60 * 1000;
    const msFromStart = now.getTime() - timeRange.start.getTime();
    const hoursFromStart = msFromStart / hourMs; // kesirli saat
    const leftPx = machineColumnWidthPx + (hoursFromStart * slotWidth);
    return leftPx;
  }, [timeRange.start, slotWidth]);
  useEffect(() => {
    const id = setInterval(() => setNowTick(t => t + 1), 60000);
    const handleResize = () => setNowTick(t => t + 1);
    window.addEventListener('resize', handleResize);
    return () => {
      clearInterval(id);
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  useEffect(() => {
    if (containerRef.current && nowTick === 0) {
      const container = containerRef.current;
      const containerWidth = container.offsetWidth;
      const nowLeft = getNowLeftPx();
      const scrollLeft = Math.max(0, nowLeft - containerWidth / 2);
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [nowTick, getNowLeftPx]);
  return (
    <div className="gantt-chart" onClick={handleClearHighlight}>
      <div className="gantt-header">
        <h2>İş Emri Zaman Çizelgesi</h2>
        <div className="filters">
          <div className="filter-group">
            <label htmlFor="wo-filter">Work Order Filter:</label>
            <select 
              id="wo-filter"
              value={selectedWorkOrderFilter || ''}
              onChange={(e) => setSelectedWorkOrderFilter(e.target.value || null)}
              className="filter-select"
            >
              <option value="">All Work Orders</option>
              {workOrders.map(wo => (
                <option key={wo.id} value={wo.id}>
                  {wo.id} - {wo.product}
                </option>
              ))}
            </select>
          </div>
          {conflictingOperations.size > 0 && (
            <div className="conflict-warning">
              ⚠️ {conflictingOperations.size} operations have conflicts
            </div>
          )}
        </div>
        {highlightedWorkOrderId && (
          <div className="highlight-info">
            <span>Highlighted: {highlightedWorkOrderId}</span>
            <button 
              className="clear-highlight-btn"
              onClick={handleClearHighlight}
            >
              Clear Highlight
            </button>
          </div>
        )}
      </div>
      <DndContext 
        sensors={sensors} 
        onDragStart={handleDragStart} 
        onDragEnd={handleDragEnd}
        collisionDetection={pointerWithin}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      >
        <div className="gantt-container" ref={containerRef}>
          <div className="time-header" key={timeSlots.length}>
            <div className="machine-label"></div>
            <div
              className="time-slots"
              style={gridStyle}
            >
              {timeSlots.map((slot, index) => (
                <div key={index} className="time-slot" data-hour={slot.getHours()}>
                  <span className="time-slot-label">{format(slot, 'HH:mm', { locale: tr })}</span>
                </div>
              ))}
            </div>
          </div>
          {machines.map(machine => (
            <div key={machine} className="machine-row">
              <div className="machine-label">{machine}</div>
              <div 
                className="timeline-row"
                style={gridStyle}
              >
                {timeSlots.map((slot, index) => (
                  <DroppableTimeCell
                    key={`${machine}-${slot.getTime()}`}
                    machine={machine}
                    timeSlot={slot}
                  />
                ))}
                {filteredWorkOrders.flatMap(wo =>
                  wo.operations
                    .filter(op => op.machineId === machine)
                    .map(operation => {
                      const position = getOperationPosition(operation);
                      return (
                      <DraggableOperation
                        key={operation.id}
                        operation={operation}
                        workOrderColor={getOperationColor(operation.workOrderId)}
                        position={position}
                        isHighlighted={highlightedWorkOrderId === operation.workOrderId}
                        isConflicting={conflictingOperations.has(operation.id)}
                        onClick={handleOperationClick}
                      />
                    )})
                )}
              </div>
            </div>
          ))}
          <div 
            className="now-line" 
            style={{ left: `${getNowLeftPx()}px` }}
            title={`Now ${nowLabel}`}
          >
            <div className="now-line-label">Now {nowLabel}</div>
          </div>
        </div>
        <DragOverlay>
          {draggedOperation && (
            <div
              className="operation-bar dragging"
              style={{
                backgroundColor: getOperationColor(draggedOperation.workOrderId)
              }}
            >
              <div className="operation-content">
                <span className="operation-title">
                  {draggedOperation.workOrderId} - {draggedOperation.name}
                </span>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
      <div className="legend">
        <h3>İş Emirleri</h3>
        {workOrders.map(wo => (
          <div key={wo.id} className="legend-item">
            <div 
              className="legend-color" 
              style={{ backgroundColor: getOperationColor(wo.id) }}
            />
            <span>{wo.id} - {wo.product} ({wo.qty} adet)</span>
          </div>
        ))}
      </div>
    </div>
  );
};
export default GanttChart;