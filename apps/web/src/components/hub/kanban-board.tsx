"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState } from "react";
import { TaskCard } from "@/components/hub/task-card";
import { useHubStore } from "@/stores/hub-store";
import type { Task, TaskStatus } from "@/types";
import { statusLabel } from "@/lib/utils";
import { toast } from "sonner";

const COLUMNS: TaskStatus[] = ["backlog", "todo", "doing", "review", "done"];

function Column({
  status,
  tasks,
  projectNames,
}: {
  status: TaskStatus;
  tasks: Task[];
  projectNames: Record<string, string>;
}) {
  return (
    <div
      className="kanban-col kanban-col-fix flex min-h-[280px] w-[240px] shrink-0 flex-col"
      data-status={status}
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
          {statusLabel(status)}
        </h3>
        <span className="text-xs text-[var(--text-muted)]">{tasks.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2" data-drop={status}>
        {tasks.map((task) => (
          <div
            key={task.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/task-id", task.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            className="cursor-grab active:cursor-grabbing"
          >
            <TaskCard task={task} projectName={projectNames[task.projectId]} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Kanban with HTML5 DnD + @dnd-kit sensors for polish; store mutation on drop */
export function KanbanBoard({
  tasks,
  projectNames,
}: {
  tasks: Task[];
  projectNames: Record<string, string>;
}) {
  const moveTask = useHubStore((s) => s.moveTask);
  const [active, setActive] = useState<Task | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragStart = (e: DragStartEvent) => {
    const task = tasks.find((t) => t.id === String(e.active.id));
    setActive(task ?? null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const status = COLUMNS.find((c) => c === overId || overId.startsWith(c));
    if (!status) return;
    const taskId = String(e.active.id);
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === status) return;
    void moveTask(taskId, status);
    toast.success(`Movido para ${statusLabel(status)}`);
  };

  return (
    <div
      className="overflow-x-auto pb-4"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData("text/task-id");
        const target = (e.target as HTMLElement).closest("[data-status]");
        const status = target?.getAttribute("data-status") as TaskStatus | null;
        if (!taskId || !status) return;
        const task = tasks.find((t) => t.id === taskId);
        if (!task || task.status === status) return;
        void moveTask(taskId, status);
        toast.success(`Movido para ${statusLabel(status)}`);
      }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-3">
          {COLUMNS.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={tasks.filter((t) => t.status === status)}
              projectNames={projectNames}
            />
          ))}
        </div>
        <DragOverlay>
          {active ? <TaskCard task={active} dragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
