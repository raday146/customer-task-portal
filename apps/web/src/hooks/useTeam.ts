import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { TeamMember } from '../api/types';

export function useTeam() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  useEffect(() => {
    api
      .users()
      .then(setTeam)
      .catch(() => setTeam([]));
  }, []);
  return team;
}
