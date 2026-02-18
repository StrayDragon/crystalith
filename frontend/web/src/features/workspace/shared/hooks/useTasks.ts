import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getTaskV1TasksTaskIdGet as getTask,
  listTasksV1NotebooksNotebookIdTasksGet as listNotebookTasks,
  type TaskRead,
} from '../../../../api/generated';
import { unwrapData } from '../../../../api/unwrap';
import { useWorkspaceStore } from '../state/workspaceStore';

interface TaskState {
  tasks: TaskRead[];
  isLoading: boolean;
  error: string;
}

export function useTasks() {
  const activeNotebookId = useWorkspaceStore((s) => s.activeNotebookId);
  const connectionState = useWorkspaceStore((s) => s.connectionState);
  const isConnected = connectionState === 'live';
  const [taskState, setTaskState] = useState<TaskState>({
    tasks: [],
    isLoading: false,
    error: '',
  });
  const pollingRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollingRef.current.forEach((timer) => clearTimeout(timer));
      pollingRef.current.clear();
    };
  }, []);

  // Clear tasks when notebook changes
  useEffect(() => {
    setTaskState({ tasks: [], isLoading: false, error: '' });
    pollingRef.current.forEach((timer) => clearTimeout(timer));
    pollingRef.current.clear();
  }, [activeNotebookId]);

  const fetchTasks = useCallback(async () => {
    if (!activeNotebookId || !isConnected) return [];
    setTaskState((prev) => ({ ...prev, isLoading: true, error: '' }));
    try {
      const tasks = await unwrapData(listNotebookTasks<true>({
        path: { notebook_id: activeNotebookId },
      }));
      setTaskState({ tasks, isLoading: false, error: '' });
      return tasks;
    } catch (error) {
      setTaskState((prev) => ({
        ...prev,
        isLoading: false,
        error: '获取任务列表失败。',
      }));
      return [];
    }
  }, [isConnected, activeNotebookId]);

  const fetchTask = useCallback(
    async (taskId: number) => {
      if (!isConnected) return null;
      try {
        const task = await unwrapData(getTask<true>({
          path: { task_id: taskId },
        }));
        setTaskState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) => (t.id === task.id ? task : t)),
        }));
        return task;
      } catch (error) {
        return null;
      }
    },
    [isConnected],
  );

  const pollTask = useCallback(
    (
      taskId: number,
      onComplete?: (task: TaskRead) => void,
      onError?: (error: string) => void,
      intervalMs = 2000,
      maxAttempts = 60,
    ) => {
      if (!isConnected) return () => {};

      let attempts = 0;

      const poll = async () => {
        attempts += 1;
        const task = await fetchTask(taskId);

        if (!task) {
          pollingRef.current.delete(taskId);
          onError?.('任务不存在或已被删除。');
          return;
        }

        if (task.status === 'completed') {
          pollingRef.current.delete(taskId);
          onComplete?.(task);
          return;
        }

        if (task.status === 'failed') {
          pollingRef.current.delete(taskId);
          onError?.(task.error || '任务执行失败。');
          return;
        }

        if (task.status === 'cancelled') {
          pollingRef.current.delete(taskId);
          onError?.('任务已取消。');
          return;
        }

        if (attempts >= maxAttempts) {
          pollingRef.current.delete(taskId);
          onError?.('任务超时，请稍后重试。');
          return;
        }

        // Continue polling
        const timer = setTimeout(poll, intervalMs);
        pollingRef.current.set(taskId, timer);
      };

      // Start polling
      void poll();

      // Return cleanup function
      return () => {
        const timer = pollingRef.current.get(taskId);
        if (timer) {
          clearTimeout(timer);
          pollingRef.current.delete(taskId);
        }
      };
    },
    [fetchTask, isConnected],
  );

  const stopPolling = useCallback((taskId: number) => {
    const timer = pollingRef.current.get(taskId);
    if (timer) {
      clearTimeout(timer);
      pollingRef.current.delete(taskId);
    }
  }, []);

  const stopAllPolling = useCallback(() => {
    pollingRef.current.forEach((timer) => clearTimeout(timer));
    pollingRef.current.clear();
  }, []);

  return {
    tasks: taskState.tasks,
    isLoading: taskState.isLoading,
    error: taskState.error,
    fetchTasks,
    fetchTask,
    pollTask,
    stopPolling,
    stopAllPolling,
    isConnected,
  };
}
