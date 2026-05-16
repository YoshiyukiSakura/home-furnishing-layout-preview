import { CheckCircle2, Home, Plus, RotateCcw, Ruler } from "lucide-react";
import type { FurnitureTemplate, RoomConfig } from "../types";
import { formatMeters } from "../geometry";

type SidebarProps = {
  room: RoomConfig;
  templates: FurnitureTemplate[];
  enforceCollision: boolean;
  onAddFurniture: (templateId: string) => void;
  onRoomChange: (room: RoomConfig) => void;
  onResetLayout: () => void;
  onToggleEnforceCollision: () => void;
};

export function Sidebar({
  room,
  templates,
  enforceCollision,
  onAddFurniture,
  onRoomChange,
  onResetLayout,
  onToggleEnforceCollision,
}: SidebarProps) {
  const updateRoom = (field: "width" | "depth", value: number) => {
    if (!Number.isFinite(value)) {
      return;
    }

    onRoomChange({
      ...room,
      [field]: Math.max(2.5, Math.min(12, value)),
    });
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <Home size={18} strokeWidth={2.2} />
        </span>
        <div>
          <h1>客厅排版</h1>
          <p>俯瞰布局 · 米制碰撞</p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <Ruler size={16} />
          <span>客餐厅尺寸</span>
        </div>
        <div className="field-grid">
          <label>
            <span>宽度</span>
            <input
              type="number"
              min="2.5"
              max="12"
              step="0.05"
              value={room.width}
              onChange={(event) => updateRoom("width", Number(event.target.value))}
            />
          </label>
          <label>
            <span>进深</span>
            <input
              type="number"
              min="2.5"
              max="12"
              step="0.05"
              value={room.depth}
              onChange={(event) => updateRoom("depth", Number(event.target.value))}
            />
          </label>
        </div>
        <div className="metric-line">
          <span>客餐厅</span>
          <strong>{(room.width * room.depth).toFixed(1)} m²</strong>
        </div>
        <div className="metric-line compact">
          <span>玄关</span>
          <strong>{(room.foyer.width * room.foyer.depth).toFixed(1)} m²</strong>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <Plus size={16} />
          <span>家具库</span>
        </div>
        <div className="template-list">
          {templates.map((template) => (
            <button
              className="template-row"
              key={template.id}
              onClick={() => onAddFurniture(template.id)}
              type="button"
            >
              <span className="swatch" style={{ backgroundColor: template.color }} />
              <span className="template-copy">
                <strong>{template.name}</strong>
                <small>
                  {formatMeters(template.width)} x {formatMeters(template.depth)}
                  {template.collidable === false ? " · 可叠放" : ` · 余量 ${formatMeters(template.clearance)}`}
                </small>
              </span>
              <Plus size={15} />
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="toggle-row">
          <button
            aria-pressed={enforceCollision}
            className={`toggle ${enforceCollision ? "is-on" : ""}`}
            onClick={onToggleEnforceCollision}
            type="button"
          >
            <span />
          </button>
          <div>
            <strong>拖拽阻挡</strong>
            <small>{enforceCollision ? "放开时回到最近合法位置" : "允许保留冲突位置"}</small>
          </div>
        </div>
        <button className="secondary-action" onClick={onResetLayout} type="button">
          <RotateCcw size={16} />
          还原初始布局
        </button>
        <div className="status-note">
          <CheckCircle2 size={15} />
          碰撞盒按家具尺寸外扩余量计算
        </div>
      </section>

      <section className="panel reference-panel">
        <div className="panel-heading">
          <Home size={16} />
          <span>户型参考</span>
        </div>
        <img src="/reference-plan.svg" alt="户型参考图" />
      </section>
    </aside>
  );
}
