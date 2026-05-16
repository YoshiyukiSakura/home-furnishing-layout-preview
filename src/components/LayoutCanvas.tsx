import { useMemo, useRef, useState } from "react";
import type { FurnitureItem, PlacementPatch, RoomConfig, Vec2 } from "../types";
import { formatMeters, getRoomFootprint, snapMeters } from "../geometry";

const SCALE = 92;
const PADDING = 78;
const GRID_STEP = 0.5;

type DragState = {
  itemId: string;
  origin: Vec2;
  startPointer: Vec2;
};

type LayoutCanvasProps = {
  room: RoomConfig;
  items: FurnitureItem[];
  invalidItemIds: Set<string>;
  selectedItemId?: string;
  onBeginDrag: (itemId: string) => void;
  onEndDrag: (itemId: string) => void;
  onMoveItem: (itemId: string, patch: PlacementPatch) => void;
  onSelectItem: (itemId?: string) => void;
};

export function LayoutCanvas({
  room,
  items,
  invalidItemIds,
  selectedItemId,
  onBeginDrag,
  onEndDrag,
  onMoveItem,
  onSelectItem,
}: LayoutCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const footprint = useMemo(() => getRoomFootprint(room), [room]);
  const widthPx = footprint.bounds.width * SCALE;
  const mainWidthPx = room.width * SCALE;
  const depthPx = room.depth * SCALE;
  const canvasWidth = widthPx + PADDING * 2;
  const canvasHeight = depthPx + PADDING * 2;
  const footprintPoints = footprint.points.map((point) => `${point.x * SCALE},${point.y * SCALE}`).join(" ");

  const grid = useMemo(() => {
    const vertical = Array.from({ length: Math.floor(footprint.bounds.width / GRID_STEP) + 1 }, (_, index) =>
      Number((index * GRID_STEP).toFixed(2)),
    ).filter((value) => value <= footprint.bounds.width);
    const horizontal = Array.from({ length: Math.floor(room.depth / GRID_STEP) + 1 }, (_, index) =>
      Number((index * GRID_STEP).toFixed(2)),
    ).filter((value) => value <= room.depth);

    return { vertical, horizontal };
  }, [footprint.bounds.width, room.depth]);

  const pointerToRoom = (event: React.PointerEvent<SVGSVGElement | SVGGElement>): Vec2 => {
    const svg = svgRef.current;

    if (!svg) {
      return { x: 0, y: 0 };
    }

    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvasWidth - PADDING;
    const y = ((event.clientY - rect.top) / rect.height) * canvasHeight - PADDING;

    return {
      x: x / SCALE,
      y: y / SCALE,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<SVGGElement>, item: FurnitureItem) => {
    event.stopPropagation();

    if (item.locked) {
      onSelectItem(item.itemId);
      return;
    }

    svgRef.current?.setPointerCapture(event.pointerId);
    onSelectItem(item.itemId);
    onBeginDrag(item.itemId);
    setDragState({
      itemId: item.itemId,
      origin: { x: item.x, y: item.y },
      startPointer: pointerToRoom(event),
    });
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragState) {
      return;
    }

    const pointer = pointerToRoom(event);
    onMoveItem(dragState.itemId, {
      x: snapMeters(dragState.origin.x + pointer.x - dragState.startPointer.x),
      y: snapMeters(dragState.origin.y + pointer.y - dragState.startPointer.y),
    });
  };

  const finishDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragState) {
      return;
    }

    svgRef.current?.releasePointerCapture(event.pointerId);
    onEndDrag(dragState.itemId);
    setDragState(null);
  };

  const sortedItems = useMemo(
    () => [...items].sort((first, second) => Number(first.collidable !== false) - Number(second.collidable !== false)),
    [items],
  );

  return (
    <div className="canvas-shell">
      <svg
        aria-label="客厅俯瞰布局画布"
        className="layout-canvas"
        ref={svgRef}
        role="application"
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onPointerDown={() => onSelectItem(undefined)}
      >
        <defs>
          <pattern id="small-grid" width={SCALE * 0.1} height={SCALE * 0.1} patternUnits="userSpaceOnUse">
            <path d={`M ${SCALE * 0.1} 0 L 0 0 0 ${SCALE * 0.1}`} fill="none" stroke="#d8dfd7" strokeWidth="0.65" />
          </pattern>
          <clipPath id="room-clip">
            <polygon points={footprintPoints} />
          </clipPath>
        </defs>

        <g transform={`translate(${PADDING} ${PADDING})`}>
          <polygon className="room-floor" points={footprintPoints} />
          <rect clipPath="url(#room-clip)" fill="url(#small-grid)" width={widthPx} height={depthPx} opacity="0.72" />

          <g clipPath="url(#room-clip)">
            {grid.vertical.map((x) => (
              <line className="grid-major" key={`v-${x}`} x1={x * SCALE} x2={x * SCALE} y1={0} y2={depthPx} />
            ))}
            {grid.horizontal.map((y) => (
              <line className="grid-major" key={`h-${y}`} x1={0} x2={widthPx} y1={y * SCALE} y2={y * SCALE} />
            ))}
          </g>

          {sortedItems.map((item) => (
            <FurnitureNode
              invalid={invalidItemIds.has(item.itemId)}
              item={item}
              key={item.itemId}
              selected={selectedItemId === item.itemId}
              onPointerDown={handlePointerDown}
            />
          ))}

          <text className="room-label" x={mainWidthPx / 2} y={depthPx / 2 - 12}>
            客餐厅
          </text>
          <text className="room-sub-label" x={mainWidthPx / 2} y={depthPx / 2 + 12}>
            {(room.width * room.depth).toFixed(1)} m²
          </text>
          <text className="foyer-label" x={(room.width + room.foyer.width / 2) * SCALE} y={(room.foyer.offsetY + room.foyer.depth / 2) * SCALE - 4}>
            玄关
          </text>
          <text className="foyer-sub-label" x={(room.width + room.foyer.width / 2) * SCALE} y={(room.foyer.offsetY + room.foyer.depth / 2) * SCALE + 16}>
            {(room.foyer.width * room.foyer.depth).toFixed(1)} m²
          </text>

          <RoomShell depthPx={depthPx} footprintPoints={footprintPoints} mainWidthPx={mainWidthPx} room={room} widthPx={widthPx} />
        </g>

        <DimensionLine
          label={formatMeters(room.width)}
          x1={PADDING}
          x2={PADDING + mainWidthPx}
          y={PADDING - 34}
        />
        <g transform={`translate(${PADDING - 44} ${PADDING})`}>
          <line className="dimension-line" x1="0" x2="0" y1="0" y2={depthPx} />
          <text className="dimension-text vertical" transform={`translate(-10 ${depthPx / 2}) rotate(-90)`}>
            {formatMeters(room.depth)}
          </text>
        </g>
      </svg>
    </div>
  );
}

function RoomShell({
  depthPx,
  footprintPoints,
  mainWidthPx,
  room,
  widthPx,
}: {
  depthPx: number;
  footprintPoints: string;
  mainWidthPx: number;
  room: RoomConfig;
  widthPx: number;
}) {
  const foyerTop = room.foyer.offsetY * SCALE;
  const foyerBottom = (room.foyer.offsetY + room.foyer.depth) * SCALE;
  const entryDoorX = (room.width + 0.42) * SCALE;
  const balconyStart = 1.55 * SCALE;
  const balconyEnd = Math.min(mainWidthPx - 1.25 * SCALE, 4.3 * SCALE);

  return (
    <>
      <path
        className="wall-line"
        d={`M 0 0 H ${mainWidthPx} V ${foyerTop} H ${widthPx} V ${foyerBottom} H ${mainWidthPx} V ${depthPx} H 0 V 0`}
      />
      <DoorGap side="north" x={2.35 * SCALE} y={0} width={0.75 * SCALE} />
      <DoorGap side="north" x={4.28 * SCALE} y={0} width={0.78 * SCALE} />
      <DoorGap side="north" x={entryDoorX} y={foyerTop} width={0.82 * SCALE} />
      <DoorGap side="west" x={0} y={2.12 * SCALE} width={0.82 * SCALE} />
      <DoorGap side="east" x={mainWidthPx} y={(room.foyer.offsetY + room.foyer.depth + 0.22) * SCALE} width={0.82 * SCALE} />
      <DoorGap side="south" x={balconyStart} y={depthPx} width={balconyEnd - balconyStart} />

      <RoomDoor label="书房门" side="north" x={2.35 * SCALE} y={0} width={0.75 * SCALE} swing="out" />
      <RoomDoor label="厨房门" side="north" x={4.28 * SCALE} y={0} width={0.78 * SCALE} swing="out" />
      <RoomDoor label="入户门" side="north" x={entryDoorX} y={foyerTop} width={0.82 * SCALE} swing="out" />
      <RoomDoor label="主卧门" side="west" x={0} y={2.12 * SCALE} width={0.82 * SCALE} swing="out" />
      <RoomDoor
        label="次卧1门"
        side="east"
        x={mainWidthPx}
        y={(room.foyer.offsetY + room.foyer.depth + 0.22) * SCALE}
        width={0.82 * SCALE}
        swing="out"
      />

      <line className="balcony-line" x1={balconyStart} x2={balconyEnd} y1={depthPx} y2={depthPx} />
      <text className="door-label" x={(balconyStart + balconyEnd) / 2} y={depthPx + 30}>
        阳台推拉门
      </text>
      <text className="scale-label" x={widthPx - 8} y={16}>
        1格=0.5m
      </text>
      <polygon className="room-inner-line" points={footprintPoints} />
    </>
  );
}

function DoorGap({
  side,
  width,
  x,
  y,
}: {
  side: "north" | "south" | "east" | "west";
  width: number;
  x: number;
  y: number;
}) {
  const horizontal = side === "north" || side === "south";

  return (
    <line
      className="door-gap"
      x1={x}
      x2={horizontal ? x + width : x}
      y1={y}
      y2={horizontal ? y : y + width}
    />
  );
}

function RoomDoor({
  label,
  side,
  swing,
  width,
  x,
  y,
}: {
  label: string;
  side: "north" | "south" | "east" | "west";
  swing: "in" | "out";
  width: number;
  x: number;
  y: number;
}) {
  const inward = swing === "in";
  const leafLength = width * 0.9;

  if (side === "north") {
    const hingeX = x + width;
    const direction = inward ? 1 : -1;
    const arcPath = `M ${hingeX - leafLength} ${y} A ${leafLength} ${leafLength} 0 0 ${inward ? 1 : 0} ${hingeX} ${
      y + leafLength * direction
    }`;

    return (
      <g className={`room-door ${swing}`}>
        <line className="door-leaf" x1={hingeX} x2={hingeX} y1={y} y2={y + leafLength * direction} />
        <path className="door-arc" d={arcPath} />
        <text className="door-label" x={x + width / 2} y={y + (inward ? 32 : -16)}>
          {label}
        </text>
      </g>
    );
  }

  if (side === "south") {
    const hingeX = x;
    const direction = inward ? -1 : 1;
    const arcPath = `M ${hingeX + leafLength} ${y} A ${leafLength} ${leafLength} 0 0 ${inward ? 0 : 1} ${hingeX} ${
      y + leafLength * direction
    }`;

    return (
      <g className={`room-door ${swing}`}>
        <line className="door-leaf" x1={hingeX} x2={hingeX} y1={y} y2={y + leafLength * direction} />
        <path className="door-arc" d={arcPath} />
        <text className="door-label" x={x + width / 2} y={y + (inward ? -16 : 32)}>
          {label}
        </text>
      </g>
    );
  }

  if (side === "east") {
    const hingeY = y;
    const direction = inward ? -1 : 1;
    const arcPath = `M ${x} ${hingeY + leafLength} A ${leafLength} ${leafLength} 0 0 ${inward ? 1 : 0} ${
      x + leafLength * direction
    } ${hingeY}`;

    return (
      <g className={`room-door ${swing}`}>
        <line className="door-leaf" x1={x} x2={x + leafLength * direction} y1={hingeY} y2={hingeY} />
        <path className="door-arc" d={arcPath} />
        <text className="door-label" x={x + (inward ? -42 : 48)} y={y + width / 2}>
          {label}
        </text>
      </g>
    );
  }

  const hingeY = y + width;
  const direction = inward ? 1 : -1;
  const arcPath = `M ${x} ${hingeY - leafLength} A ${leafLength} ${leafLength} 0 0 ${inward ? 1 : 0} ${
    x + leafLength * direction
  } ${hingeY}`;

  return (
    <g className={`room-door ${swing}`}>
      <line className="door-leaf" x1={x} x2={x + leafLength * direction} y1={hingeY} y2={hingeY} />
      <path className="door-arc" d={arcPath} />
      <text className="door-label" x={x + (inward ? 42 : -48)} y={y + width / 2}>
        {label}
      </text>
    </g>
  );
}

function DimensionLine({ label, x1, x2, y }: { label: string; x1: number; x2: number; y: number }) {
  return (
    <g>
      <line className="dimension-line" x1={x1} x2={x2} y1={y} y2={y} />
      <line className="dimension-tick" x1={x1} x2={x1} y1={y - 10} y2={y + 10} />
      <line className="dimension-tick" x1={x2} x2={x2} y1={y - 10} y2={y + 10} />
      <text className="dimension-text" x={(x1 + x2) / 2} y={y - 10}>
        {label}
      </text>
    </g>
  );
}

function FurnitureNode({
  invalid,
  item,
  selected,
  onPointerDown,
}: {
  invalid: boolean;
  item: FurnitureItem;
  selected: boolean;
  onPointerDown: (event: React.PointerEvent<SVGGElement>, item: FurnitureItem) => void;
}) {
  const clearanceWidth = (item.width + (item.collidable === false ? 0 : item.clearance * 2)) * SCALE;
  const clearanceDepth = (item.depth + (item.collidable === false ? 0 : item.clearance * 2)) * SCALE;
  const bodyWidth = item.width * SCALE;
  const bodyDepth = item.depth * SCALE;
  const labelY = bodyDepth < 48 ? -2 : -6;
  const sizeY = bodyDepth < 48 ? 12 : 13;

  return (
    <g
      className={`furniture-node ${selected ? "is-selected" : ""} ${invalid ? "is-invalid" : ""} ${
        item.locked ? "is-locked" : ""
      }`}
      onPointerDown={(event) => onPointerDown(event, item)}
      transform={`translate(${item.x * SCALE} ${item.y * SCALE}) rotate(${item.rotation})`}
    >
      <rect
        className="collision-box"
        height={clearanceDepth}
        rx="7"
        width={clearanceWidth}
        x={-clearanceWidth / 2}
        y={-clearanceDepth / 2}
      />
      <rect
        className="furniture-body"
        fill={item.color}
        height={bodyDepth}
        rx="6"
        width={bodyWidth}
        x={-bodyWidth / 2}
        y={-bodyDepth / 2}
      />
      <rect
        className="furniture-highlight"
        height={Math.max(0, bodyDepth - 10)}
        rx="4"
        width={Math.max(0, bodyWidth - 10)}
        x={-(bodyWidth - 10) / 2}
        y={-(bodyDepth - 10) / 2}
      />
      <rect
        className="selected-ring"
        height={bodyDepth + 10}
        rx="8"
        width={bodyWidth + 10}
        x={-(bodyWidth + 10) / 2}
        y={-(bodyDepth + 10) / 2}
      />
      <text className="furniture-label" y={labelY}>
        {item.name}
      </text>
      <text className="furniture-size" y={sizeY}>
        {item.width.toFixed(2)} x {item.depth.toFixed(2)}
      </text>
    </g>
  );
}
