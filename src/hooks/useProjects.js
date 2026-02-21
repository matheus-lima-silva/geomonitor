import { useCallback, useEffect, useState } from 'react';
import { createProject, subscribeProjects } from '../services/projectService';

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeProjects(
      (data) => {
        setProjects(data);
        setLoading(false);
      },
      () => setLoading(false),
    );

    return () => unsub?.();
  }, []);

  const refresh = useCallback(async () => null, []);

  const addProject = useCallback(async (project) => {
    await createProject(project);
  }, []);

  return {
    projects,
    loading,
    addProject,
    refresh,
  };
}
