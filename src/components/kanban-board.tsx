"use client";

import {
  closestCenter,
  DragCancelEvent,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CheckCircle2, Clock3, LayoutGrid, List, Plus } from "lucide-react";

import { createTaskAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  projectName: string;
  projectDescription: string | null;
  tasks: TaskCard[];
  assignees: { id: string; email: string }[];
};

type DragData = {
  type: "column" | "task";
  status?: TaskStatus;
};

const PRIORITY_OPTIONS: TaskPriority[] = [TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.URGENT];

function PriorityPill({ priority }: { priority: TaskPriority }) {
  const tone =
    priority === TaskPriority.LOW
      ? "bg-slate-700/50 text-sky-300"
      : priority === TaskPriority.MEDIUM
        ? "bg-sky-600/20 text-sky-300"
        : priority === TaskPriority.HIGH
          ? "bg-rose-600/20 text-rose-300"
          : "bg-red-600/20 text-red-300";

  return <span className={cn("inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium", tone)}>{priority}</span>;
}

function TaskCardPreview({ task }: { task: TaskCard }) {
  const isDone = task.status === TaskStatus.DONE;

  return (
    <article
      className={cn(
        "rounded-md border border-[#1a2434] bg-[#070f1c] p-3 text-sm shadow-sm",
        isDone && "border-slate-600 bg-slate-900/70 ring-1 ring-inset ring-slate-600/60",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <PriorityPill priority={task.priority} />
        {isDone && (
          <span className="inline-flex items-center gap-1 rounded bg-slate-700/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-200">
            <CheckCircle2 className="size-3" />
            Completed
          </span>
        )}
      </div>
      <p className={cn("text-[13px] text-slate-100", isDone && "text-slate-400 line-through")}>{task.title}</p>
      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="size-3" />
          {formatDurationFromMinutes(task.estimationMinutes)}
        </span>
        {task.assigneeEmail && (
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-sky-700/30 text-[10px] font-medium text-sky-300">
            {task.assigneeEmail.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
    </article>
  );
}

function SortableTaskCard({ task }: { task: TaskCard }) {
  const isDone = task.status === TaskStatus.DONE;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", status: task.status } satisfies DragData,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "rounded-md border border-[#1a2434] bg-[#070f1c] p-3 text-sm shadow-sm",
        "transition-colors hover:border-[#2a3c58]",
        isDone && "border-slate-600 bg-slate-900/70 ring-1 ring-inset ring-slate-600/60",
        isDragging && "opacity-60",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <PriorityPill priority={task.priority} />
        {isDone && (
          <span className="inline-flex items-center gap-1 rounded bg-slate-700/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-200">
            <CheckCircle2 className="size-3" />
            Completed
          </span>
        )}
      </div>
      <p className={cn("text-[13px] text-slate-100", isDone && "text-slate-400 line-through")}>{task.title}</p>
      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="size-3" />
          {formatDurationFromMinutes(task.estimationMinutes)}
        </span>
        {task.assigneeEmail && (
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-sky-700/30 text-[10px] font-medium text-sky-300">
            {task.assigneeEmail.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
    </article>
  );
}

function SortableColumn({
  status,
  tasks,
  dimmed,
  onAddTask,
}: {
  status: TaskStatus;
  tasks: TaskCard[];
  dimmed?: boolean;
  onAddTask: (status: TaskStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: status,
    data: { type: "column", status } satisfies DragData,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={cn(
        "h-[calc(100svh-13rem)] w-[500px] min-w-0 rounded-lg border border-[#111c2c] bg-[#040b16] p-3",
        dimmed && "opacity-80",
        isDragging && "opacity-50",
      )}
    >
      <div className="mb-3 flex items-center justify-between text-xs text-slate-300" {...attributes} {...listeners}>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
          <span>{TASK_STATUS_LABELS[status]}</span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{tasks.length}</span>
        </div>
        <button
          type="button"
          className="text-slate-400 hover:text-slate-200"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onAddTask(status)}
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

function ColumnPreview({ status, tasks }: { status: TaskStatus; tasks: TaskCard[] }) {
  return (
    <section className="h-[calc(100svh-13rem)] w-full min-w-0 rounded-lg border border-[#111c2c] bg-[#040b16] p-3">
      <div className="mb-3 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
          <span>{TASK_STATUS_LABELS[status]}</span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{tasks.length}</span>
        </div>
      </div>
    </section>
  );
}

function CreateTaskDialog({
  open,
  onClose,
  onSubmit,
  projectId,
  assignees,
  defaultStatus,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
  projectId: string;
  assignees: { id: string; email: string }[];
  defaultStatus: TaskStatus;
  submitting: boolean;
}) {
  const [estimationHours, setEstimationHours] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <DialogContent
      onClose={onClose}
      className="max-w-2xl border-[#172334] bg-[#020814] p-6 text-slate-100 shadow-[0_12px_48px_rgba(0,0,0,0.55)]"
    >
      <form
        action={onSubmit}
        className="space-y-5"
      >
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="estimation" value={estimationHours ? `${estimationHours}h` : ""} />

        <DialogHeader className="space-y-1">
          <DialogTitle className="text-3xl font-semibold text-slate-100">Create Task</DialogTitle>
          <DialogDescription className="text-base text-slate-400">Add a new task to your project board.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="task-title" className="text-base font-medium text-slate-200">Title</Label>
          <Input
            id="task-title"
            name="title"
            placeholder="What needs to be done?"
            required
            className="h-11 border-[#132134] bg-[#060f1d] text-base text-slate-100 placeholder:text-slate-500"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-description" className="text-base font-medium text-slate-200">
            Description <span className="font-normal text-slate-500">(optional)</span>
          </Label>
          <Textarea
            id="task-description"
            name="description"
            placeholder="Add more details..."
            className="min-h-[112px] border-[#132134] bg-[#060f1d] text-base text-slate-100 placeholder:text-slate-500"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="task-status" className="text-base font-medium text-slate-200">Status</Label>
            <select
              id="task-status"
              name="status"
              defaultValue={defaultStatus}
              className="h-11 w-full rounded-md border border-[#132134] bg-[#060f1d] px-3 text-base text-slate-100 outline-none focus:border-[#274a72]"
            >
              {TASK_STATUS_ORDER.map((status) => (
                <option key={status} value={status} className="bg-[#060f1d] text-slate-100">
                  {TASK_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-priority" className="text-base font-medium text-slate-200">Priority</Label>
            <select
              id="task-priority"
              name="priority"
              defaultValue={TaskPriority.MEDIUM}
              className="h-11 w-full rounded-md border border-[#132134] bg-[#060f1d] px-3 text-base text-slate-100 outline-none focus:border-[#274a72]"
            >
              {PRIORITY_OPTIONS.map((priority) => (
                <option key={priority} value={priority} className="bg-[#060f1d] text-slate-100">
                  {priority.charAt(0) + priority.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-assignee" className="text-base font-medium text-slate-200">Assignee</Label>
          <select
            id="task-assignee"
            name="assigneeId"
            defaultValue=""
            className="h-11 w-full rounded-md border border-[#132134] bg-[#060f1d] px-3 text-base text-slate-100 outline-none focus:border-[#274a72]"
          >
            <option value="" className="bg-[#060f1d] text-slate-400">
              Unassigned
            </option>
            {assignees.map((assignee) => (
              <option key={assignee.id} value={assignee.id} className="bg-[#060f1d] text-slate-100">
                {assignee.email}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="task-due-date" className="text-base font-medium text-slate-200">Due Date <span className="font-normal text-slate-500">(optional)</span></Label>
            <Input
              id="task-due-date"
              name="dueDate"
              type="date"
              className="h-11 border-[#132134] bg-[#060f1d] text-base text-slate-100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-estimation" className="text-base font-medium text-slate-200">Estimation (hours) <span className="font-normal text-slate-500">(optional)</span> </Label>
            <Input
              id="task-estimation"
              type="number"
              min={0}
              step={1}
              value={estimationHours}
              onChange={(event) => setEstimationHours(event.target.value)}
              placeholder="e.g., 8"
              className="h-11 border-[#132134] bg-[#060f1d] text-base text-slate-100 placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-10 border border-[#1a2a3d] bg-[#070f1c] px-5 text-base text-slate-200 hover:bg-[#0c1627]"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="h-10 bg-sky-600 px-5 text-base text-white hover:bg-sky-500"
          >
            {submitting ? "Creating..." : "Create Task"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}

export function KanbanBoard({ projectId, projectName, projectDescription, tasks: initialTasks, assignees }: KanbanBoardProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [columnOrder, setColumnOrder] = useState<TaskStatus[]>(TASK_STATUS_ORDER);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<TaskStatus | null>(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createTaskStatus, setCreateTaskStatus] = useState<TaskStatus>(TaskStatus.TODO);
  const [pending, startTransition] = useTransition();
  const [createPending, startCreateTransition] = useTransition();
  const dragStartTasksRef = useRef<TaskCard[] | null>(null);
  const activeTaskInitialStatusRef = useRef<TaskStatus | null>(null);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const sensors = useSensors(useSensor(PointerSensor));

  const grouped = useMemo(() => {
    return columnOrder.reduce<Record<TaskStatus, TaskCard[]>>((acc, status) => {
      acc[status] = tasks.filter((task) => task.status === status);
      return acc;
    }, {
      [TaskStatus.TODO]: [],
      [TaskStatus.IN_PROGRESS]: [],
      [TaskStatus.DONE]: [],
    });
  }, [tasks, columnOrder]);

  function persistStatusChange(taskId: string, status: TaskStatus, previousTasks: TaskCard[]) {
    startTransition(async () => {
      const response = await fetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, projectId }),
      });

      if (!response.ok) {
        setTasks(previousTasks);
      }
    });
  }

  function onDragStart(event: DragStartEvent) {
    const data = event.active.data.current as DragData | undefined;
    if (data?.type === "task") {
      setActiveTaskId(String(event.active.id));
      dragStartTasksRef.current = tasks;
      activeTaskInitialStatusRef.current = tasks.find((task) => task.id === String(event.active.id))?.status ?? null;
      return;
    }
    if (data?.type === "column") {
      setActiveColumnId(event.active.id as TaskStatus);
    }
  }

  function onDragCancel(_event: DragCancelEvent) {
    if (dragStartTasksRef.current) {
      setTasks(dragStartTasksRef.current);
    }
    setActiveTaskId(null);
    setActiveColumnId(null);
    dragStartTasksRef.current = null;
    activeTaskInitialStatusRef.current = null;
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) {
      return;
    }

    const activeData = active.data.current as DragData | undefined;
    const overData = over.data.current as DragData | undefined;

    if (activeData?.type !== "task") {
      return;
    }

    const overStatus = overData?.type === "column" ? overData.status : overData?.status;
    if (!overStatus) {
      return;
    }

    setTasks((prev) => {
      const activeIndex = prev.findIndex((task) => task.id === String(active.id));
      if (activeIndex === -1) {
        return prev;
      }

      const next = [...prev];
      next[activeIndex] = { ...next[activeIndex], status: overStatus };

      if (overData?.type === "task") {
        const overIndex = prev.findIndex((task) => task.id === String(over.id));
        if (overIndex !== -1 && overIndex !== activeIndex) {
          return arrayMove(next, activeIndex, overIndex);
        }
      }

      return next;
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    setActiveTaskId(null);
    setActiveColumnId(null);

    if (!over) {
      if (dragStartTasksRef.current) {
        setTasks(dragStartTasksRef.current);
      }
      dragStartTasksRef.current = null;
      activeTaskInitialStatusRef.current = null;
      return;
    }

    const activeData = active.data.current as DragData | undefined;
    const overData = over.data.current as DragData | undefined;

    if (activeData?.type === "column" && overData?.type === "column") {
      const oldIndex = columnOrder.indexOf(active.id as TaskStatus);
      const newIndex = columnOrder.indexOf(over.id as TaskStatus);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        setColumnOrder((prev) => arrayMove(prev, oldIndex, newIndex));
      }
      dragStartTasksRef.current = null;
      activeTaskInitialStatusRef.current = null;
      return;
    }

    if (activeData?.type !== "task") {
      dragStartTasksRef.current = null;
      activeTaskInitialStatusRef.current = null;
      return;
    }

    const taskId = String(active.id);
    const droppedStatus =
      overData?.type === "column"
        ? overData.status
        : overData?.type === "task"
          ? overData.status
          : undefined;

    if (!droppedStatus) {
      dragStartTasksRef.current = null;
      activeTaskInitialStatusRef.current = null;
      return;
    }

    setTasks((prev) => {
      const taskIndex = prev.findIndex((task) => task.id === taskId);
      if (taskIndex === -1) {
        return prev;
      }

      const next = [...prev];
      next[taskIndex] = { ...next[taskIndex], status: droppedStatus };
      return next;
    });

    const initialStatus = activeTaskInitialStatusRef.current;
    if (initialStatus && droppedStatus !== initialStatus) {
      persistStatusChange(taskId, droppedStatus, dragStartTasksRef.current ?? tasks);
    }

    dragStartTasksRef.current = null;
    activeTaskInitialStatusRef.current = null;
  }

  const activeTask = activeTaskId ? tasks.find((task) => task.id === activeTaskId) ?? null : null;
  const activeColumn = activeColumnId ?? null;

  function openCreateTask(status: TaskStatus) {
    setCreateTaskStatus(status);
    setCreateTaskOpen(true);
  }

  function submitCreateTask(formData: FormData) {
    startCreateTransition(async () => {
      await createTaskAction(formData);
      setCreateTaskOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-[#0e1827] bg-[#020814] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">{projectName}</h1>
          <p className="text-sm text-slate-400">{projectDescription || "No description"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" className="gap-1.5 bg-[#0d1726] text-slate-100 hover:bg-[#132238]">
            <LayoutGrid className="size-3.5" />
            Board
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5 text-slate-300 hover:text-slate-100">
            <List className="size-3.5" />
            List
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-sky-600 hover:bg-sky-500"
            onClick={() => openCreateTask(TaskStatus.TODO)}
          >
            <Plus className="size-3.5" />
            Add Task
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragCancel={onDragCancel}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
          <div className={cn("flex gap-3 overflow-x-auto pb-2", pending && "opacity-85")}>
            {columnOrder.map((status) => (
              <SortableColumn
                key={status}
                status={status}
                tasks={grouped[status]}
                dimmed={pending}
                onAddTask={openCreateTask}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeTask ? <TaskCardPreview task={activeTask} /> : null}
          {!activeTask && activeColumn ? <ColumnPreview status={activeColumn} tasks={grouped[activeColumn]} /> : null}
        </DragOverlay>
      </DndContext>

      <CreateTaskDialog
        open={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        onSubmit={submitCreateTask}
        projectId={projectId}
        assignees={assignees}
        defaultStatus={createTaskStatus}
        submitting={createPending}
      />
    </div>
  );
}
