import { AlertTriangle, CheckCircle2, Copy, Lock, MousePointer2, RotateCw, Trash2 } from "lucide-react";
import type { CollisionReport, FurnitureItem, PlacementPatch } from "../types";
import { formatMeters, normalizeRotation } from "../geometry";

type InspectorProps = {
  selectedItem?: FurnitureItem;
  selectedReports: CollisionReport[];
  totalReports: CollisionReport[];
  onDelete: (itemId: string) => void;
  onDuplicate: (itemId: string) => void;
  onRotate: (itemId: string) => void;
  onUpdate: (itemId: string, patch: PlacementPatch) => void;
};

type NumberFieldProps = {
  disabled?: boolean;
  label: string;
  min?: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
};

function NumberField({ disabled, label, min, step, value, onChange }: NumberFieldProps) {
  return (
    <label>
      <span>{label}</span>
      <input
        disabled={disabled}
        min={min}
        step={step}
        type="number"
        value={Number(value.toFixed(2))}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function Inspector({
  selectedItem,
  selectedReports,
  totalReports,
  onDelete,
  onDuplicate,
  onRotate,
  onUpdate,
}: InspectorProps) {
  if (!selectedItem) {
    return (
      <aside className="inspector">
        <section className="panel empty-state">
          <MousePointer2 size={22} />
          <h2>选择家具</h2>
          <p>点击画布中的家具后可调整坐标、尺寸、旋转角度和碰撞余量。</p>
        </section>
        <CollisionSummary reports={totalReports} />
      </aside>
    );
  }

  const isLocked = selectedItem.locked === true;

  return (
    <aside className="inspector">
      <section className="panel selected-panel">
        <div className="selected-heading">
          <span className="selected-swatch" style={{ backgroundColor: selectedItem.color }} />
          <div>
            <h2>{selectedItem.name}</h2>
            <p>
              {formatMeters(selectedItem.width)} x {formatMeters(selectedItem.depth)}
            </p>
          </div>
        </div>

        <div className="action-grid">
          <button disabled={isLocked} onClick={() => onRotate(selectedItem.itemId)} type="button">
            <RotateCw size={15} />
            旋转 15°
          </button>
          <button disabled={isLocked} onClick={() => onDuplicate(selectedItem.itemId)} type="button">
            <Copy size={15} />
            复制
          </button>
          <button
            aria-pressed={isLocked}
            onClick={() => onUpdate(selectedItem.itemId, { locked: !isLocked })}
            type="button"
          >
            <Lock size={15} />
            {isLocked ? "解锁" : "锁定"}
          </button>
          <button className="danger" disabled={isLocked} onClick={() => onDelete(selectedItem.itemId)} type="button">
            <Trash2 size={15} />
            删除
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <MousePointer2 size={16} />
          <span>位置</span>
        </div>
        <div className="field-grid">
          <NumberField
            disabled={isLocked}
            label="X"
            min={0}
            step={0.05}
            value={selectedItem.x}
            onChange={(value) => onUpdate(selectedItem.itemId, { x: value })}
          />
          <NumberField
            disabled={isLocked}
            label="Y"
            min={0}
            step={0.05}
            value={selectedItem.y}
            onChange={(value) => onUpdate(selectedItem.itemId, { y: value })}
          />
          <NumberField
            disabled={isLocked}
            label="角度"
            step={15}
            value={normalizeRotation(selectedItem.rotation)}
            onChange={(value) => onUpdate(selectedItem.itemId, { rotation: normalizeRotation(value) })}
          />
          <NumberField
            disabled={isLocked || selectedItem.collidable === false}
            label="余量"
            min={0}
            step={0.05}
            value={selectedItem.clearance}
            onChange={(value) => onUpdate(selectedItem.itemId, { clearance: Math.max(0, value) })}
          />
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <Lock size={16} />
          <span>尺寸</span>
        </div>
        <div className="field-grid">
          <NumberField
            disabled={isLocked}
            label="宽"
            min={0.1}
            step={0.05}
            value={selectedItem.width}
            onChange={(value) => onUpdate(selectedItem.itemId, { width: Math.max(0.1, value) })}
          />
          <NumberField
            disabled={isLocked}
            label="深"
            min={0.1}
            step={0.05}
            value={selectedItem.depth}
            onChange={(value) => onUpdate(selectedItem.itemId, { depth: Math.max(0.1, value) })}
          />
        </div>
      </section>

      <CollisionSummary reports={selectedReports.length > 0 ? selectedReports : totalReports} compact />
    </aside>
  );
}

function CollisionSummary({ reports, compact = false }: { reports: CollisionReport[]; compact?: boolean }) {
  const hasReports = reports.length > 0;

  return (
    <section className={`panel collision-panel ${hasReports ? "has-issues" : ""}`}>
      <div className="panel-heading">
        {hasReports ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
        <span>{hasReports ? "碰撞提示" : "碰撞状态"}</span>
      </div>
      {hasReports ? (
        <ul className={compact ? "compact-list" : undefined}>
          {reports.slice(0, compact ? 4 : 8).map((report) => (
            <li key={report.id}>{report.message}</li>
          ))}
        </ul>
      ) : (
        <p>当前布局没有家具碰撞或越界。</p>
      )}
    </section>
  );
}
