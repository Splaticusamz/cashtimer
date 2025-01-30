import { TimerSession, SessionPause } from './index';

export type Database = {
  public: {
    Tables: {
      timer_sessions: {
        Row: TimerSession;
        Insert: Omit<TimerSession, 'id'>;
      };
      session_pauses: {
        Row: SessionPause;
        Insert: Omit<SessionPause, 'id'>;
      };
    };
  };
}; 