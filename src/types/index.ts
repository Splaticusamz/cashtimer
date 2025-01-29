export interface TimerSession {
  id: string;
  user_id: string;
  startTime: Date;
  endTime: Date | null;
  hourlyRate: number;
  earnings: number;
  pauses: SessionPause[];
}

export interface SessionPause {
  id: string;
  session_id: string;
  startTime: Date;
  endTime: Date | null;
}

export interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  currentSession: TimerSession | null;
  sessions: TimerSession[];
  hourlyRate: number;
} 