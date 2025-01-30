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

export interface Currency {
  code: string;
  symbol: string;
  flag: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', flag: '🇬🇧' },
  { code: 'CAD', symbol: '$', flag: '🇨🇦' },
  // Add more currencies as needed
];

export interface EditingSession {
  id: string;
  field: 'startTime' | 'endTime' | `pause-${number}` | 'pause-new';
  tempValue?: { start?: string; end?: string } | string;
} 