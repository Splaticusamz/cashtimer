export interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  currentSession: TimerSession | null;
  sessions: TimerSession[];
  hourlyRate: number;
}

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

export interface EditingSessionValue {
  start: string;
  end?: string;
}

export interface EditingSession {
  id: string;
  field: 'startTime' | 'endTime' | `pause-${number}` | 'pause-new';
  tempValue: EditingSessionValue;
}

export interface Currency {
  code: string;
  symbol: string;
  flag: string;
  name: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', flag: '🇺🇸', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', flag: '🇪🇺', name: 'Euro' },
  { code: 'GBP', symbol: '£', flag: '🇬🇧', name: 'British Pound' },
  { code: 'CAD', symbol: '$', flag: '🇨🇦', name: 'Canadian Dollar' }
]; 