export interface TimerSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  hourlyRate: number;
  earnings: number;
  pauses: SessionPause[];
}

export interface SessionPause {
  id: string;
  startTime: Date;
  endTime?: Date;
}

export interface ExchangeRate {
  [key: string]: number;
} 