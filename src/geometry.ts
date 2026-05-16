import type { CollisionReport, CollisionResult, FurnitureItem, RoomConfig, Vec2 } from "./types";

export const SNAP_METERS = 0.05;

type OrientedBox = {
  center: Vec2;
  halfWidth: number;
  halfDepth: number;
  rotation: number;
};

export type RoomFootprint = {
  bounds: {
    width: number;
    depth: number;
  };
  foyerEndY: number;
  points: Vec2[];
};

export function snapMeters(value: number, step = SNAP_METERS) {
  return Math.round(value / step) * step;
}

export function formatMeters(value: number) {
  return `${value.toFixed(2)} m`;
}

export function normalizeRotation(value: number) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function getRoomFootprint(room: RoomConfig): RoomFootprint {
  const foyerEndY = room.foyer.offsetY + room.foyer.depth;
  const totalWidth = room.width + room.foyer.width;

  return {
    bounds: {
      width: totalWidth,
      depth: room.depth,
    },
    foyerEndY,
    points: [
      { x: 0, y: 0 },
      { x: room.width, y: 0 },
      { x: room.width, y: room.foyer.offsetY },
      { x: totalWidth, y: room.foyer.offsetY },
      { x: totalWidth, y: foyerEndY },
      { x: room.width, y: foyerEndY },
      { x: room.width, y: room.depth },
      { x: 0, y: room.depth },
    ],
  };
}

export function getCollisionBox(item: FurnitureItem): OrientedBox {
  const clearance = item.collidable === false ? 0 : item.clearance;

  return {
    center: { x: item.x, y: item.y },
    halfWidth: (item.width + clearance * 2) / 2,
    halfDepth: (item.depth + clearance * 2) / 2,
    rotation: (normalizeRotation(item.rotation) * Math.PI) / 180,
  };
}

export function getBodyBox(item: FurnitureItem): OrientedBox {
  return {
    center: { x: item.x, y: item.y },
    halfWidth: item.width / 2,
    halfDepth: item.depth / 2,
    rotation: (normalizeRotation(item.rotation) * Math.PI) / 180,
  };
}

export function getBoxCorners(box: OrientedBox): Vec2[] {
  const cos = Math.cos(box.rotation);
  const sin = Math.sin(box.rotation);
  const localCorners = [
    { x: -box.halfWidth, y: -box.halfDepth },
    { x: box.halfWidth, y: -box.halfDepth },
    { x: box.halfWidth, y: box.halfDepth },
    { x: -box.halfWidth, y: box.halfDepth },
  ];

  return localCorners.map((point) => ({
    x: box.center.x + point.x * cos - point.y * sin,
    y: box.center.y + point.x * sin + point.y * cos,
  }));
}

function getAxes(corners: Vec2[]) {
  return [
    normalizeVector({
      x: corners[1].x - corners[0].x,
      y: corners[1].y - corners[0].y,
    }),
    normalizeVector({
      x: corners[3].x - corners[0].x,
      y: corners[3].y - corners[0].y,
    }),
  ];
}

function normalizeVector(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function projectOntoAxis(corners: Vec2[], axis: Vec2) {
  const projections = corners.map((corner) => corner.x * axis.x + corner.y * axis.y);
  return {
    min: Math.min(...projections),
    max: Math.max(...projections),
  };
}

function rangesOverlap(a: { min: number; max: number }, b: { min: number; max: number }) {
  return a.max > b.min && b.max > a.min;
}

export function boxesOverlap(first: OrientedBox, second: OrientedBox) {
  const firstCorners = getBoxCorners(first);
  const secondCorners = getBoxCorners(second);
  const axes = [...getAxes(firstCorners), ...getAxes(secondCorners)];

  return axes.every((axis) =>
    rangesOverlap(projectOntoAxis(firstCorners, axis), projectOntoAxis(secondCorners, axis)),
  );
}

function isPointOnSegment(point: Vec2, start: Vec2, end: Vec2) {
  const cross = (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y);

  if (Math.abs(cross) > 0.000001) {
    return false;
  }

  const dot = (point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y);
  const squaredLength = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;

  return dot >= -0.000001 && dot <= squaredLength + 0.000001;
}

function pointInsidePolygon(point: Vec2, polygon: Vec2[]) {
  if (polygon.some((corner, index) => isPointOnSegment(point, corner, polygon[(index + 1) % polygon.length]))) {
    return true;
  }

  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const current = polygon[index];
    const prior = polygon[previous];
    const intersects =
      current.y > point.y !== prior.y > point.y &&
      point.x < ((prior.x - current.x) * (point.y - current.y)) / (prior.y - current.y) + current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function orientation(a: Vec2, b: Vec2, c: Vec2) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);

  if (Math.abs(value) < 0.000001) {
    return 0;
  }

  return value > 0 ? 1 : 2;
}

function segmentsIntersect(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2) {
  const touchesOnly =
    [a1, a2].some((point) => isPointOnSegment(point, b1, b2)) ||
    [b1, b2].some((point) => isPointOnSegment(point, a1, a2));

  if (touchesOnly) {
    return false;
  }

  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);

  if (o1 !== o2 && o3 !== o4) {
    return true;
  }

  return false;
}

export function boxInsideRoom(box: OrientedBox, room: RoomConfig) {
  const footprint = getRoomFootprint(room);
  const corners = getBoxCorners(box);
  const allCornersInside = corners.every((corner) => pointInsidePolygon(corner, footprint.points));

  if (!allCornersInside) {
    return false;
  }

  for (let index = 0; index < corners.length; index += 1) {
    const boxStart = corners[index];
    const boxEnd = corners[(index + 1) % corners.length];

    for (let wallIndex = 0; wallIndex < footprint.points.length; wallIndex += 1) {
      const wallStart = footprint.points[wallIndex];
      const wallEnd = footprint.points[(wallIndex + 1) % footprint.points.length];

      if (segmentsIntersect(boxStart, boxEnd, wallStart, wallEnd)) {
        return false;
      }
    }
  }

  return true;
}

export function evaluateCollisions(items: FurnitureItem[], room: RoomConfig): CollisionResult {
  const reports: CollisionReport[] = [];
  const invalidItemIds = new Set<string>();

  for (const item of items) {
    if (!boxInsideRoom(getCollisionBox(item), room)) {
      invalidItemIds.add(item.itemId);
      reports.push({
        id: `boundary-${item.itemId}`,
        itemIds: [item.itemId],
        message: `${item.name} 的碰撞体积越过客餐厅边界`,
        type: "boundary",
      });
    }
  }

  for (let index = 0; index < items.length; index += 1) {
    const first = items[index];

    if (first.collidable === false) {
      continue;
    }

    for (let nextIndex = index + 1; nextIndex < items.length; nextIndex += 1) {
      const second = items[nextIndex];

      if (second.collidable === false) {
        continue;
      }

      if (boxesOverlap(getCollisionBox(first), getCollisionBox(second))) {
        invalidItemIds.add(first.itemId);
        invalidItemIds.add(second.itemId);
        reports.push({
          id: `pair-${first.itemId}-${second.itemId}`,
          itemIds: [first.itemId, second.itemId],
          message: `${first.name} 与 ${second.name} 的碰撞体积重叠`,
          type: "furniture",
        });
      }
    }
  }

  return {
    invalidItemIds,
    reports,
  };
}
