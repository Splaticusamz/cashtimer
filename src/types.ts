export interface TimerSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  hourlyRate: number;
  earnings: number;
  pauses: PauseInterval[];
}

export interface PauseInterval {
  startTime: Date;
  endTime?: Date;
}

export interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  currentSession: TimerSession | null;
  sessions: TimerSession[];
  hourlyRate: number;
} 