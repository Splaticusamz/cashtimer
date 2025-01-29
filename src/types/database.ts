export interface Database {
  public: {
    Tables: {
      timer_sessions: {
        Row: {
          id: string;
          user_id: string;
          start_time: string;
          end_time: string | null;
          hourly_rate: number;
          earnings: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<TimerSession, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<TimerSession, 'id' | 'created_at' | 'updated_at'>>;
      };
      session_pauses: {
        Row: {
          id: string;
          session_id: string;
          start_time: string;
          end_time: string | null;
          created_at: string;
        };
        Insert: Omit<SessionPause, 'id' | 'created_at'>;
        Update: Partial<Omit<SessionPause, 'id' | 'created_at'>>;
      };
    };
  };
}

export interface TimerSession {
  id: string;
  start_time: string;
  end_time: string | null;
  hourly_rate: number;
  earnings: number;
  user_id: string;
  pauses: SessionPause[];
}

export interface SessionPause {
  start_time: string;
  end_time: string | null;
} 