export type Vec2 = {
  x: number;
  y: number;
};

export type RoomConfig = {
  width: number;
  depth: number;
  foyer: {
    width: number;
    depth: number;
    offsetY: number;
  };
};

export type FurnitureTemplate = {
  id: string;
  name: string;
  category: string;
  width: number;
  depth: number;
  clearance: number;
  color: string;
  collidable?: boolean;
};

export type FurnitureItem = FurnitureTemplate & {
  itemId: string;
  templateId: string;
  x: number;
  y: number;
  rotation: number;
  locked?: boolean;
};

export type CollisionReport = {
  id: string;
  itemIds: string[];
  message: string;
  type: "boundary" | "furniture";
};

export type CollisionResult = {
  invalidItemIds: Set<string>;
  reports: CollisionReport[];
};

export type PlacementPatch = Partial<
  Pick<FurnitureItem, "x" | "y" | "width" | "depth" | "clearance" | "rotation" | "locked">
>;
