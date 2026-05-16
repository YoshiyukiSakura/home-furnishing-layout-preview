import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Layers, Ruler } from "lucide-react";
import { defaultRoom, furnitureTemplates, initialFurniture } from "./data";
import { evaluateCollisions, getRoomFootprint, normalizeRotation, snapMeters } from "./geometry";
import { Inspector } from "./components/Inspector";
import { LayoutCanvas } from "./components/LayoutCanvas";
import { Sidebar } from "./components/Sidebar";
import type { FurnitureItem, FurnitureTemplate, PlacementPatch, RoomConfig } from "./types";

type LastValidPlacement = Pick<FurnitureItem, "x" | "y" | "rotation" | "width" | "depth" | "clearance">;

const STORAGE_KEY = "living-room-layout-planner-state-v1";
const STORAGE_VERSION = 1;
const initialSelectedItemId = initialFurniture[1]?.itemId;
const customCabinetHorizontal = initialFurniture.find((item) => item.itemId === "item-custom-cabinet-horizontal");

type PersistedLayoutState = {
  enforceCollision: boolean;
  items: FurnitureItem[];
  room: RoomConfig;
  savedAt: string;
  selectedItemId?: string;
  version: typeof STORAGE_VERSION;
};

function placementFromItem(item: FurnitureItem): LastValidPlacement {
  return {
    x: item.x,
    y: item.y,
    rotation: item.rotation,
    width: item.width,
    depth: item.depth,
    clearance: item.clearance,
  };
}

function createItemId(templateId: string) {
  return `${templateId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function templateToItem(template: FurnitureTemplate, itemId: string, x: number, y: number): FurnitureItem {
  return {
    ...template,
    itemId,
    templateId: template.id,
    x,
    y,
    rotation: 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeSavedRoom(value: unknown): RoomConfig {
  if (!isRecord(value)) {
    return defaultRoom;
  }

  const foyer = isRecord(value.foyer) ? value.foyer : {};

  return {
    width: isFiniteNumber(value.width) ? value.width : defaultRoom.width,
    depth: isFiniteNumber(value.depth) ? value.depth : defaultRoom.depth,
    foyer: {
      width: isFiniteNumber(foyer.width) ? foyer.width : defaultRoom.foyer.width,
      depth: defaultRoom.foyer.depth,
      offsetY: isFiniteNumber(foyer.offsetY) ? foyer.offsetY : defaultRoom.foyer.offsetY,
    },
  };
}

function normalizeSavedItem(value: unknown): FurnitureItem | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.itemId !== "string" ||
    typeof value.templateId !== "string" ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.category !== "string" ||
    typeof value.color !== "string" ||
    !isFiniteNumber(value.width) ||
    !isFiniteNumber(value.depth) ||
    !isFiniteNumber(value.clearance) ||
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.y) ||
    !isFiniteNumber(value.rotation)
  ) {
    return null;
  }

  const migratedName =
    value.templateId === "coffee-table" || value.id === "coffee-table" ? "小孩游戏桌" : value.name;
  const migratedY =
    value.itemId === "item-custom-cabinet-horizontal" && customCabinetHorizontal ? customCabinetHorizontal.y : value.y;

  return {
    id: value.id,
    name: migratedName,
    category: value.category,
    width: value.width,
    depth: value.depth,
    clearance: value.clearance,
    color: value.color,
    itemId: value.itemId,
    templateId: value.templateId,
    x: value.x,
    y: migratedY,
    rotation: value.rotation,
    collidable: value.collidable === false ? false : undefined,
    locked: value.locked === true ? true : undefined,
  };
}

function parseLayoutState(value: unknown): PersistedLayoutState | null {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return null;
  }

  const items = value.items.map(normalizeSavedItem).filter((item): item is FurnitureItem => item !== null);

  if (items.length === 0) {
    return null;
  }

  const selectedItemId =
    typeof value.selectedItemId === "string" && items.some((item) => item.itemId === value.selectedItemId)
      ? value.selectedItemId
      : items[0]?.itemId;

  return {
    version: STORAGE_VERSION,
    room: normalizeSavedRoom(value.room),
    items,
    selectedItemId,
    enforceCollision: value.enforceCollision !== false,
    savedAt: typeof value.savedAt === "string" ? value.savedAt : new Date().toISOString(),
  };
}

function readLocalLayoutState(): PersistedLayoutState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? parseLayoutState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function findOpenPlacement(template: FurnitureTemplate, itemId: string, items: FurnitureItem[], room: RoomConfig) {
  const footprint = getRoomFootprint(room);
  const fallback = {
    x: snapMeters(room.width / 2),
    y: snapMeters(room.depth / 2),
  };

  for (let y = 0.45; y <= room.depth - 0.35; y += 0.25) {
    for (let x = 0.45; x <= footprint.bounds.width - 0.35; x += 0.25) {
      const candidate = templateToItem(template, itemId, snapMeters(x), snapMeters(y));
      const result = evaluateCollisions([...items, candidate], room);

      if (!result.invalidItemIds.has(itemId)) {
        return { x: candidate.x, y: candidate.y };
      }
    }
  }

  return fallback;
}

export default function App() {
  const [room, setRoom] = useState<RoomConfig>(defaultRoom);
  const [items, setItems] = useState<FurnitureItem[]>(initialFurniture);
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>(initialSelectedItemId);
  const [enforceCollision, setEnforceCollision] = useState(true);
  const [hasLoadedServerState, setHasLoadedServerState] = useState(false);
  const lastValidPlacement = useRef<Record<string, LastValidPlacement>>(
    Object.fromEntries(initialFurniture.map((item) => [item.itemId, placementFromItem(item)])),
  );

  const collisionResult = useMemo(() => evaluateCollisions(items, room), [items, room]);
  const selectedItem = useMemo(
    () => items.find((item) => item.itemId === selectedItemId),
    [items, selectedItemId],
  );
  const selectedReports = useMemo(
    () => collisionResult.reports.filter((report) => selectedItemId && report.itemIds.includes(selectedItemId)),
    [collisionResult.reports, selectedItemId],
  );

  const rememberIfValid = useCallback((nextItems: FurnitureItem[], itemId: string, nextRoom = room) => {
    const nextCollision = evaluateCollisions(nextItems, nextRoom);
    const item = nextItems.find((candidate) => candidate.itemId === itemId);

    if (item && !nextCollision.invalidItemIds.has(itemId)) {
      lastValidPlacement.current[itemId] = placementFromItem(item);
    }
  }, [room]);

  const updateItem = useCallback(
    (itemId: string, patch: PlacementPatch) => {
      setItems((currentItems) => {
        const nextItems = currentItems.map((item) =>
          item.itemId === itemId
            ? {
                ...item,
                ...patch,
                x: patch.x === undefined ? item.x : snapMeters(patch.x),
                y: patch.y === undefined ? item.y : snapMeters(patch.y),
                rotation:
                  patch.rotation === undefined ? item.rotation : normalizeRotation(snapMeters(patch.rotation, 1)),
              }
            : item,
        );

        rememberIfValid(nextItems, itemId);
        return nextItems;
      });
    },
    [rememberIfValid],
  );

  const addFurniture = useCallback(
    (templateId: string) => {
      const template = furnitureTemplates.find((candidate) => candidate.id === templateId);

      if (!template) {
        return;
      }

      const itemId = createItemId(template.id);
      const placement = findOpenPlacement(template, itemId, items, room);
      const item = templateToItem(template, itemId, placement.x, placement.y);

      setItems((currentItems) => [...currentItems, item]);
      setSelectedItemId(itemId);
      lastValidPlacement.current[itemId] = placementFromItem(item);
    },
    [items, room],
  );

  const beginDrag = useCallback(
    (itemId: string) => {
      setSelectedItemId(itemId);
      const item = items.find((candidate) => candidate.itemId === itemId);

      if (!item || collisionResult.invalidItemIds.has(itemId)) {
        return;
      }

      lastValidPlacement.current[itemId] = placementFromItem(item);
    },
    [collisionResult.invalidItemIds, items],
  );

  const endDrag = useCallback(
    (itemId: string) => {
      setItems((currentItems) => {
        const currentCollision = evaluateCollisions(currentItems, room);

        if (!enforceCollision || !currentCollision.invalidItemIds.has(itemId)) {
          rememberIfValid(currentItems, itemId);
          return currentItems;
        }

        const fallback = lastValidPlacement.current[itemId];

        if (!fallback) {
          return currentItems;
        }

        return currentItems.map((item) => (item.itemId === itemId ? { ...item, ...fallback } : item));
      });
    },
    [enforceCollision, rememberIfValid, room],
  );

  const rotateItem = useCallback(
    (itemId: string) => {
      updateItem(itemId, {
        rotation: normalizeRotation((items.find((item) => item.itemId === itemId)?.rotation ?? 0) + 15),
      });
    },
    [items, updateItem],
  );

  const deleteItem = useCallback((itemId: string) => {
    setItems((currentItems) => currentItems.filter((item) => item.itemId !== itemId));
    setSelectedItemId((currentSelected) => (currentSelected === itemId ? undefined : currentSelected));
    delete lastValidPlacement.current[itemId];
  }, []);

  const duplicateItem = useCallback(
    (itemId: string) => {
      const source = items.find((item) => item.itemId === itemId);

      if (!source) {
        return;
      }

      const footprint = getRoomFootprint(room);
      const nextId = createItemId(source.templateId);
      const offsetCandidate = {
        ...source,
        itemId: nextId,
        x: snapMeters(Math.min(footprint.bounds.width - source.width / 2, source.x + 0.35)),
        y: snapMeters(Math.min(room.depth - source.depth / 2, source.y + 0.35)),
      };
      const offsetCollision = evaluateCollisions([...items, offsetCandidate], room);
      const finalItem = offsetCollision.invalidItemIds.has(nextId)
        ? {
            ...source,
            itemId: nextId,
            ...findOpenPlacement(source, nextId, items, room),
          }
        : offsetCandidate;

      setItems((currentItems) => [...currentItems, finalItem]);
      setSelectedItemId(nextId);
      lastValidPlacement.current[nextId] = placementFromItem(finalItem);
    },
    [items, room],
  );

  const resetLayout = useCallback(() => {
    setRoom(defaultRoom);
    setItems(initialFurniture);
    setSelectedItemId(initialSelectedItemId);
    setEnforceCollision(true);
    lastValidPlacement.current = Object.fromEntries(
      initialFurniture.map((item) => [item.itemId, placementFromItem(item)]),
    );
  }, []);

  const updateRoom = useCallback((nextRoom: RoomConfig) => {
    setRoom({
      width: snapMeters(nextRoom.width),
      depth: snapMeters(nextRoom.depth),
      foyer: nextRoom.foyer,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const applyState = (state: PersistedLayoutState) => {
      setRoom(state.room);
      setItems(state.items);
      setSelectedItemId(state.selectedItemId);
      setEnforceCollision(state.enforceCollision);
      lastValidPlacement.current = Object.fromEntries(
        state.items.map((item) => [item.itemId, placementFromItem(item)]),
      );
    };

    const loadServerState = async () => {
      let state: PersistedLayoutState | null = null;

      try {
        const response = await fetch("/api/layout-state", { cache: "no-store" });
        const payload = (await response.json()) as unknown;

        if (isRecord(payload)) {
          state = parseLayoutState(payload.state);
        }
      } catch {
        state = null;
      }

      const localState = state ? null : readLocalLayoutState();
      const nextState = state ?? localState;

      if (cancelled) {
        return;
      }

      if (nextState) {
        applyState(nextState);
      }

      setHasLoadedServerState(true);
    };

    void loadServerState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedServerState) {
      return;
    }

    const payload: PersistedLayoutState = {
      version: STORAGE_VERSION,
      room,
      items,
      selectedItemId,
      enforceCollision,
      savedAt: new Date().toISOString(),
    };
    const timeoutId = window.setTimeout(() => {
      void fetch("/api/layout-state", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ state: payload }),
      })
        .then((response) => {
          if (response.ok) {
            window.localStorage.removeItem(STORAGE_KEY);
          }
        })
        .catch(() => {
          // Keep editing responsive even if the server is temporarily unavailable.
        });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [enforceCollision, hasLoadedServerState, items, room, selectedItemId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;

      if (!selectedItem || selectedItem.locked || target?.matches("input, textarea, select")) {
        return;
      }

      const nudge = event.shiftKey ? 0.25 : 0.05;
      const movement: Record<string, PlacementPatch> = {
        ArrowLeft: { x: selectedItem.x - nudge },
        ArrowRight: { x: selectedItem.x + nudge },
        ArrowUp: { y: selectedItem.y - nudge },
        ArrowDown: { y: selectedItem.y + nudge },
      };

      if (event.key in movement) {
        event.preventDefault();
        updateItem(selectedItem.itemId, movement[event.key]);
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteItem(selectedItem.itemId);
      }

      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        rotateItem(selectedItem.itemId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteItem, rotateItem, selectedItem, updateItem]);

  const hasCollisions = collisionResult.reports.length > 0;

  return (
    <div className="app-shell">
      <Sidebar
        enforceCollision={enforceCollision}
        room={room}
        templates={furnitureTemplates}
        onAddFurniture={addFurniture}
        onResetLayout={resetLayout}
        onRoomChange={updateRoom}
        onToggleEnforceCollision={() => setEnforceCollision((value) => !value)}
      />

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="topbar-kicker">绿城·云诵桂月轩 F户型</span>
            <h2>客餐厅俯瞰布局</h2>
          </div>
          <div className="topbar-metrics">
            <span>
              <Ruler size={15} />
              {room.width.toFixed(2)} x {room.depth.toFixed(2)} m · 玄关 {room.foyer.width.toFixed(2)} x{" "}
              {room.foyer.depth.toFixed(2)} m
            </span>
            <span>
              <Layers size={15} />
              {items.length} 件
            </span>
            <span className={hasCollisions ? "status-pill warn" : "status-pill ok"}>
              {hasCollisions ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
              {hasCollisions ? `${collisionResult.reports.length} 个冲突` : "无冲突"}
            </span>
          </div>
        </header>

        <LayoutCanvas
          invalidItemIds={collisionResult.invalidItemIds}
          items={items}
          room={room}
          selectedItemId={selectedItemId}
          onBeginDrag={beginDrag}
          onEndDrag={endDrag}
          onMoveItem={updateItem}
          onSelectItem={setSelectedItemId}
        />
      </main>

      <Inspector
        selectedItem={selectedItem}
        selectedReports={selectedReports}
        totalReports={collisionResult.reports}
        onDelete={deleteItem}
        onDuplicate={duplicateItem}
        onRotate={rotateItem}
        onUpdate={updateItem}
      />
    </div>
  );
}
