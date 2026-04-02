"use client";

import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { useMemo, useState, useTransition } from "react";

import { TASK_STATUS_LABELS, TASK_STATUS_ORDER } from "@/lib/constants";
import { cn, formatDurationFromMinutes } from "@/lib/utils";

type TaskCard = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimationMinutes: number | null;
  dueDate: string | null;
  assigneeEmail: string | null;
};

type KanbanBoardProps = {
  projectId: string;
  tasks: TaskCard[];
};

export function KanbanBoard({ projectId, tasks: initialTasks }: KanbanBoardProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor));

  const grouped = useMemo(() => {
    return TASK_STATUS_ORDER.reduce<Record<TaskStatus, TaskCard[]>>((acc, status) => {
      acc[status] = tasks.filter((task) => task.status === status);
      return acc;
    }, {
      [TaskStatus.TODO]: [],
      [TaskStatus.IN_PROGRESS]: [],
      [TaskStatus.DONE]: [],
    });
  }, [tasks]);

  function inferStatusFromContainer(containerId: string): TaskStatus | null {
    if (containerId === TaskStatus.TODO) return TaskStatus.TODO;
    if (containerId === TaskStatus.IN_PROGRESS) return TaskStatus.IN_PROGRESS;
    if (containerId === TaskStatus.DONE) return TaskStatus.DONE;
    return null;
  }

  function onDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id);
    const task = tasks.find((item) => item.id === taskId);
    if (!task || !event.over) return;

    const overId = String(event.over.id);
    const overStatus = inferStatusFromContainer(overId) ?? tasks.find((item) => item.id === overId)?.status;
    if (!overStatus || overStatus === task.status) return;

    const previous = tasks;
    const next = tasks.map((item) => (item.id === taskId ? { ...item, status: overStatus } : item));
    setTasks(next);

    startTransition(async () => {
      const response = await fetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: overStatus, projectId }),
      });

      if (!response.ok) {
        setTasks(previous);
      }
    });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid gap-4 xl:grid-cols-3">
        {TASK_STATUS_ORDER.map((status) => (
          <section key={status} className="rounded-xl border border-border/70 bg-card/70 p-3">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-medium">{TASK_STATUS_LABELS[status]}</h3>
              <span className="text-xs text-muted-foreground">{grouped[status].length}</span>
            </div>
            <SortableContext items={grouped[status].map((task) => task.id)} strategy={verticalListSortingStrategy}>
              <div id={status} className={cn("space-y-3 rounded-lg p-1", pending && "opacity-80")}>
                {grouped[status].map((task) => (
                  <article
                    id={task.id}
                    key={task.id}
                    className="rounded-lg border border-border/60 bg-background/80 p-3 transition hover:border-primary/70"
                  >
                    <p className="text-sm font-medium">{task.title}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>{task.priority}</span>
                      <span>{formatDurationFromMinutes(task.estimationMinutes)}</span>
                      <span>{task.assigneeEmail ?? "Unassigned"}</span>
                      <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due"}</span>
                    </div>
                  </article>
                ))}
              </div>
            </SortableContext>
          </section>
        ))}
      </div>
    </DndContext>
  );
}
