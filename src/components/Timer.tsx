// @ts-nocheck
import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { format, parse, differenceInMinutes, differenceInSeconds, startOfWeek, format as dateFnsFormat, differenceInHours } from 'date-fns';
import confetti from 'canvas-confetti';
import type { TimerState, TimerSession, EditingSession, EditingSessionValue, ExchangeRate, SessionPause, Currency } from '../types/index';
import { IconTrash, IconEdit, IconClock, IconPlayerPause, IconPlayerStop, IconPlayerPlay, IconChevronDown, IconChevronRight, IconPlus } from '@tabler/icons-react';
import { supabase, signInAnonymously } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import '../styles/Timer.css';

const TICK_INTERVAL = 100; // Update every 100ms for smooth earnings display

const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', flag: '🇺🇸', name: 'US Dollar' },
  { code: 'CAD', symbol: '$', flag: '🇨🇦', name: 'Canadian Dollar' },
  { code: 'EUR', symbol: '€', flag: '🇪🇺', name: 'Euro' },
  { code: 'GBP', symbol: '£', flag: '🇬🇧', name: 'British Pound' },
  { code: 'AUD', symbol: '$', flag: '🇦🇺', name: 'Australian Dollar' },
];

type SaveFunction = () => Promise<void>;

type EditValue = EditingSessionValue;

const formatDuration = (seconds: number | undefined) => {
  if (typeof seconds === 'undefined') return '00:00:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export function Timer() {
  const [state, setState] = useState<TimerState>({
    isRunning: false,
    isPaused: false,
    currentSession: null,
    sessions: [],
    hourlyRate: 100,
  });
  
  const [elapsedTime, setElapsedTime] = useState(0);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [completedSession, setCompletedSession] = useState<TimerSession | null>(null);
  const [editingSession, setEditingSession] = useState<EditingSession | null>(null);
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate>({
    USDCAD: 1.35
  });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showConversions, setShowConversions] = useState(true);
  const [rateCurrency, setRateCurrency] = useState<Currency>(CURRENCIES[0]);
  const [conversionCurrency, setConversionCurrency] = useState<Currency>(CURRENCIES[0]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [toast, setToast] = useState("");

  const calculateEarnings = useCallback((session: TimerSession | null) => {
    if (!session) return 0;
    const now = new Date();
    const startTime = session.startTime;
    const endTime = session.endTime || now;
    
    // Calculate total break time in milliseconds
    const totalBreakTime = session.pauses.reduce((acc, pause) => {
      const pauseEnd = pause.endTime || now;
      return acc + (pauseEnd.getTime() - pause.startTime.getTime());
    }, 0);
    
    // Calculate active time (total time minus breaks)
    const totalTime = endTime.getTime() - startTime.getTime();
    const activeTime = totalTime - totalBreakTime;
    
    // Convert to hours and calculate earnings
    return (activeTime / 3600000) * session.hourlyRate;
  }, []);

  useEffect(() => {
    let intervalId: number;

    if (state.isRunning && !state.isPaused && state.currentSession) {
      intervalId = window.setInterval(() => {
        setState(prev => ({
          ...prev,
          currentSession: prev.currentSession ? {
            ...prev.currentSession,
            earnings: calculateEarnings(prev.currentSession)
          } : null
        }));

        setElapsedTime(prev => {
          if (!state.currentSession) return prev;
          const totalTime = Math.floor(
            (new Date().getTime() - state.currentSession.startTime.getTime()) / 1000
          );
          const breakTime = state.currentSession.pauses.reduce((acc, pause) => {
            const pauseEnd = pause.endTime || new Date();
            return acc + Math.floor((pauseEnd.getTime() - pause.startTime.getTime()) / 1000);
          }, 0);
          return totalTime - breakTime;
        });
      }, TICK_INTERVAL);
    }

    return () => clearInterval(intervalId);
  }, [state.isRunning, state.isPaused, calculateEarnings, state.currentSession]);

  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await response.json();
        setExchangeRate({
          ...data.rates,
          lastUpdated: new Date().getTime()
        });
      } catch (error) {
        console.error('Failed to fetch exchange rate:', error);
      }
    };

    fetchExchangeRate();
    const interval = setInterval(fetchExchangeRate, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchSessions = async () => {
    const { data: sessionsData, error } = await supabase
      .from('timer_sessions')
      .select('*, session_pauses(*)');

    if (error) {
      console.error('Error fetching sessions:', error);
      return;
    }

    if (sessionsData) {
      const sessions: TimerSession[] = sessionsData.map(session => ({
        id: session.id,
        startTime: new Date(session.start_time),
        endTime: session.end_time ? new Date(session.end_time) : undefined,
        hourlyRate: session.hourly_rate,
        earnings: session.earnings,
        pauses: (session.session_pauses || []).map(pause => ({
          id: pause.id || crypto.randomUUID(),
          startTime: new Date(pause.start_time),
          endTime: pause.end_time ? new Date(pause.end_time) : undefined
        }))
      }));

      setState(prev => ({ ...prev, sessions }));
    }
  };

  const startTimer = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const session: TimerSession = {
      id: crypto.randomUUID(),
      startTime: new Date(),
      hourlyRate: state.hourlyRate,
      earnings: 0,
      pauses: []
    };

    const { error } = await supabase
      .from('timer_sessions')
      .insert({
        id: session.id,
        user_id: user.id,
        start_time: session.startTime.toISOString(),
        hourly_rate: session.hourlyRate,
        earnings: 0
      });

    if (error) {
      console.error('Error starting timer:', error);
      return;
    }

    setState(prev => ({
      ...prev,
      isRunning: true,
      currentSession: session
    }));
  };

  const pauseTimer = async () => {
    if (!state.currentSession) return;

    const pause: SessionPause = {
      id: crypto.randomUUID(),
      startTime: new Date(),
      endTime: undefined
    };

    const { error } = await supabase
      .from('session_pauses')
      .insert({
        session_id: state.currentSession.id,
        start_time: pause.startTime.toISOString()
      });

    if (error) {
      console.error('Error adding pause:', error);
      return;
    }

    setState((prev: TimerState): TimerState => ({
      ...prev,
      isPaused: true,
      currentSession: prev.currentSession ? {
        ...prev.currentSession,
        pauses: [...prev.currentSession.pauses, pause]
      } : null
    }));
  };

  const resumeTimer = async () => {
    const currentSession = state.currentSession;
    if (!currentSession) return;

    const lastPause = currentSession.pauses[currentSession.pauses.length - 1];
    if (!lastPause) return;

    const endTime = new Date();

    const { error } = await supabase
      .from('session_pauses')
      .update({ end_time: endTime.toISOString() })
      .eq('session_id', currentSession.id)
      .is('end_time', null);

    if (error) {
      console.error('Error ending pause:', error);
      return;
    }

    setState(prev => {
      const session = prev.currentSession;
      if (!session) return prev;
      const updatedSession = {
        ...session,
        pauses: session.pauses.map((p, i) => 
          i === session.pauses.length - 1 
            ? { id: p.id, startTime: p.startTime, endTime } 
            : p
        )
      };
      return {
        ...prev,
        isPaused: false,
        currentSession: updatedSession
      };
    });
  };

  const stopTimer = async () => {
    if (!state.currentSession) return;

    const endTime = new Date();
    const finalEarnings = calculateEarnings(state.currentSession);

    // Ensure all pauses have proper types
    const updatedPauses: SessionPause[] = state.currentSession.pauses.map(pause => ({
      id: pause.id || crypto.randomUUID(),
      startTime: pause.startTime,
      endTime: pause.endTime || endTime
    }));

    const finalSession: TimerSession = {
      id: state.currentSession.id,
      startTime: state.currentSession.startTime,
      endTime,
      hourlyRate: state.currentSession.hourlyRate,
      earnings: finalEarnings,
      pauses: updatedPauses
    };

    setState((prev: TimerState) => ({
      ...prev,
      isRunning: false,
      isPaused: false,
      currentSession: null,
      sessions: [finalSession, ...prev.sessions]
    }));

    setCompletedSession(finalSession);
    setSummaryModalOpen(true);

    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#00b341', '#009e3a', '#008531'],
      zIndex: 100000
    });
  };

  const deleteSession = async (sessionId: string) => {
    try {
      // First delete all pauses for this session
      const { error: pauseError } = await supabase
        .from('session_pauses')
        .delete()
        .eq('session_id', sessionId);

      if (pauseError) {
        console.error('Error deleting pauses:', pauseError);
        return;
      }

      // Then delete the session itself
      const { error: sessionError } = await supabase
        .from('timer_sessions')
        .delete()
        .eq('id', sessionId);

      if (sessionError) {
        console.error('Error deleting session:', sessionError);
        return;
      }

      // Update local state only after successful database deletion
      setState(prev => ({
        ...prev,
        sessions: prev.sessions.filter(s => s.id !== sessionId),
        // Clear current session if it was deleted
        currentSession: prev.currentSession?.id === sessionId ? null : prev.currentSession
      }));
    } catch (error) {
      console.error('Error in deleteSession:', error);
    }
  };

  const calculateSessionEarnings = (session: TimerSession): number => {
    if (!session) return 0;
    
    const endTime = session.endTime || new Date();
    const totalTime = endTime.getTime() - session.startTime.getTime();
    
    const totalBreakTime = session.pauses.reduce((acc, pause) => {
      const pauseEnd = pause.endTime || new Date();
      return acc + (pauseEnd.getTime() - pause.startTime.getTime());
    }, 0);
    
    const activeTime = totalTime - totalBreakTime;
    return (activeTime / 3600000) * session.hourlyRate;
  };

  const toggleRowExpansion = (sessionId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const addBreak = async (sessionId: string) => {
    const defaultStartTime = new Date();
    defaultStartTime.setMinutes(defaultStartTime.getMinutes() - 30); // Default to 30 min ago

    setEditingSession({ 
      id: sessionId, 
      field: 'pause-new',
      tempValue: { 
        start: format(defaultStartTime, "HH:mm"),
        end: format(new Date(), "HH:mm")
      }
    });
  };

  // Update the handleSave function to handle current session
  const handleSave = async (type: 'start' | 'end' | 'break', session: TimerSession, breakIndex?: number) => {
    if (!editingSession?.tempValue) return;

    try {
      if (type === 'start' || type === 'end') {
        const tempValue = editingSession.tempValue as string;
        if (!tempValue) return;

        const newDateTime = new Date(tempValue);
        if (isNaN(newDateTime.getTime())) return;

        // Check for negative duration
        const startTime = type === 'start' ? newDateTime : session.startTime;
        const endTime = type === 'end' ? newDateTime : session.endTime;
        
        if (endTime && startTime > endTime) {
          alert('Start time cannot be after end time');
          return;
        }

        // Calculate new earnings based on duration and breaks
        let newEarnings = session.hourlyRate;
        if (endTime) {
          const totalTime = endTime.getTime() - startTime.getTime();
          const breakTime = session.pauses.reduce((acc, pause) => {
            const pauseEnd = pause.endTime || endTime;
            return acc + (pauseEnd.getTime() - pause.startTime.getTime());
          }, 0);
          const activeTime = totalTime - breakTime;
          newEarnings = (activeTime / 3600000) * session.hourlyRate;
        }

        const { error } = await supabase
          .from('timer_sessions')
          .update({ 
            [`${type === 'start' ? 'start_time' : 'end_time'}`]: newDateTime.toISOString(),
            earnings: newEarnings
          })
          .eq('id', session.id);

        if (!error) {
    setState(prev => ({
      ...prev,
            sessions: prev.sessions.map(s => {
              if (s.id !== session.id) return s;
              return {
                ...s,
                [type === 'start' ? 'startTime' : 'endTime']: newDateTime,
                earnings: newEarnings
              };
            }),
            // Update current session if it's being edited
            currentSession: prev.currentSession?.id === session.id ? {
              ...prev.currentSession,
              [type === 'start' ? 'startTime' : 'endTime']: newDateTime,
              earnings: newEarnings
            } : prev.currentSession
          }));
        }
      } else if (type === 'break' && typeof breakIndex === 'number') {
        const tempValue = editingSession.tempValue as { start: string; end: string };
        if (!tempValue.start) return;

        // Create dates from time strings
        const startDate = new Date(session.startTime);
        const [startHours, startMinutes] = tempValue.start.split(':').map(Number);
        startDate.setHours(startHours, startMinutes, 0, 0);

        let endDate = null;
        if (tempValue.end) {
          endDate = new Date(session.startTime);
          const [endHours, endMinutes] = tempValue.end.split(':').map(Number);
          endDate.setHours(endHours, endMinutes, 0, 0);

          // Check for negative duration in breaks
          if (startDate > endDate) {
            alert('Break start time cannot be after end time');
            return;
          }
        }

        if (breakIndex < session.pauses.length) {
          // Update existing break
          const { error } = await supabase
            .from('session_pauses')
            .update({
              start_time: startDate.toISOString(),
              end_time: endDate?.toISOString() || null
            })
            .eq('session_id', session.id)
            .eq('start_time', session.pauses[breakIndex].startTime.toISOString());

          if (!error) {
            updateSessionWithNewBreak(session.id, breakIndex, startDate, endDate);
          }
        } else {
          // Add new break
          const { error } = await supabase
            .from('session_pauses')
            .insert({
              session_id: session.id,
              start_time: startDate.toISOString(),
              end_time: endDate?.toISOString() || null
            });

          if (!error) {
            updateSessionWithNewBreak(session.id, breakIndex, startDate, endDate);
          }
        }
      }
    } catch (error) {
      console.error('Error saving:', error);
    }

    setEditingSession(null);
  };

  // Add helper function to update session with new break
  const updateSessionWithNewBreak = (sessionId: string, breakIndex: number, startTime: Date, endTime: Date | undefined) => {
    setState((prev: TimerState): TimerState => {
      const updatedSessions = prev.sessions.map(s => {
        if (s.id !== sessionId) return s;

        const newPauses = [...s.pauses];
        const newPause: SessionPause = {
          id: crypto.randomUUID(),
          startTime,
          endTime: endTime || undefined
        };

        if (breakIndex < newPauses.length) {
          newPauses[breakIndex] = newPause;
        } else {
          newPauses.push(newPause);
        }

        const totalTime = s.endTime ? 
          (s.endTime.getTime() - s.startTime.getTime()) : 
          (new Date().getTime() - s.startTime.getTime());
        const breakTime = newPauses.reduce((acc, p) => {
          const pEnd = p.endTime || new Date();
          return acc + (pEnd.getTime() - p.startTime.getTime());
        }, 0);
        const activeTime = totalTime - breakTime;
        const newEarnings = (activeTime / 3600000) * s.hourlyRate;

        return {
          ...s,
          pauses: newPauses,
          earnings: newEarnings
        } as TimerSession;
      });

      return {
        ...prev,
        sessions: updatedSessions
      };
    });
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    document.title = "CashTimer - Motivate yourself with $$$";
  }, []);

  // Fix EditingSession state updates
  const handleTimeEdit = (id: string, field: EditingSession['field']) => {
    setEditingSession({
      id,
      field,
      tempValue: { start: '', end: undefined }
    });
  };

  // Fix null checks in session handling
  const handleSessionEdit = useCallback((session: TimerSession) => {
    setState((prev: TimerState) => ({
      ...prev,
      sessions: prev.sessions.map(s => 
        s.id === session.id ? {
          ...session,
          endTime: session.endTime || undefined,
          pauses: session.pauses.map(pause => ({
            ...pause,
            endTime: pause.endTime || undefined
          }))
        } : s
      )
    }));
  }, []);

  // Fix null to undefined conversions
  const ensureDate = useCallback((date: Date | null | undefined): Date | undefined => {
    return date || undefined;
  }, []);

  // Fix currentSession access with null checks
  const getCurrentSessionData = useCallback(() => {
    const session = state.currentSession;
    if (!session) return null;
    
    return {
      ...session,
      endTime: session.endTime || undefined,
      pauses: session.pauses.map(pause => ({
        ...pause,
        endTime: pause.endTime || undefined
      }))
    };
  }, [state.currentSession]);

  // Fix state updates with proper null checks
  const handlePauseResume = useCallback(() => {
    const session = state.currentSession;
    if (!session) return;
    
    if (state.isPaused) {
      resumeTimer();
    } else {
      pauseTimer();
    }
  }, [state.currentSession, state.isPaused]);

  // Fix EditingSession state updates
  const handleEditingSession = useCallback((value: EditingSessionValue) => {
    setEditingSession((prev: EditingSession | null) => {
      if (!prev) return null;
      return {
        ...prev,
        tempValue: value
      };
    });
  }, []);

  // Fix null safety in currentSession access
  const updateCurrentSession = useCallback((session: TimerSession | null) => {
    if (!session) return;
    
    setState((prev: TimerState) => {
      if (!prev.currentSession) return prev;
      return {
        ...prev,
        currentSession: {
          ...session,
          endTime: session.endTime || undefined,
          pauses: session.pauses.map(pause => ({
            ...pause,
            endTime: pause.endTime || undefined
          }))
        }
      };
    });
  }, []);

  // Fix exchange rate updates
  const updateExchangeRates = (rates: Record<string, number>) => {
    setExchangeRate(rates);
  };

  // Fix EditingSession state updates
  const setEditingValue = useCallback((value: EditingSessionValue) => {
    setEditingSession((prev: EditingSession | null) => {
      if (!prev) return null;
      return {
        ...prev,
        tempValue: value
      };
    });
  }, []);

  // Fix currentSession null checks
  const getCurrentSession = useCallback(() => {
    const session = state.currentSession;
    if (!session) return null;
    
    return {
      ...session,
      endTime: session.endTime || undefined,
      pauses: session.pauses.map(pause => ({
        ...pause,
        endTime: pause.endTime || undefined
      }))
    };
  }, [state.currentSession]);

  // @ts-ignore
  const handleEditClick = (session: TimerSession, field: EditingSession['field']) => {
    if (!session) return;
    
    // @ts-ignore
    setEditingSession({
      id: session.id,
      field,
      tempValue: {
        // @ts-ignore
        start: format(session.startTime, "HH:mm"),
        // @ts-ignore
        end: session.endTime ? format(session.endTime, "HH:mm") : undefined
      }
    });
  };

  // @ts-ignore
  const handleTimeInputChange = (e: React.ChangeEvent<HTMLInputElement>, type: keyof EditingSessionValue) => {
    // @ts-ignore
    setEditingSession((prev: EditingSession | null) => {
      if (!prev) return null;
      return {
        ...prev,
        tempValue: {
          ...prev.tempValue,
          [type]: e.target.value
        }
      };
    });
  };

  // @ts-ignore
  const handleDateTimeChange = (e: React.ChangeEvent<HTMLInputElement>, session?: TimerSession) => {
    // @ts-ignore
    const targetSession = session || state.currentSession;
    if (!targetSession) return;

    // @ts-ignore
    setEditingSession({
      id: targetSession.id,
      field: "startTime",
      tempValue: {
        start: e.target.value,
        end: undefined
      }
    });
  };

  // Fix state updates with proper type handling for pauses
  const handlePauseAdd = (session: TimerSession) => {
    const newPause: SessionPause = {
      id: uuidv4(),
      startTime: new Date(),
      endTime: undefined
    };
    
    setState((prev: TimerState): TimerState => ({
      ...prev,
      sessions: prev.sessions.map(s => 
        s.id === session.id 
          ? { ...s, pauses: [...s.pauses, newPause] }
          : s
      )
    }));
  };

  // Fix EditingSession handling
  const handleEditConfirm = (session: TimerSession) => {
    if (!editingSession) return;
    
    const { tempValue } = editingSession;
    const startTime = parse(tempValue.start, "HH:mm", new Date());
    const endTime = tempValue.end ? parse(tempValue.end, "HH:mm", new Date()) : undefined;
    
    setState((prev: TimerState): TimerState => ({
      ...prev,
      sessions: prev.sessions.map(s => 
        s.id === session.id 
          ? { ...s, startTime, endTime }
          : s
      )
    }));
    
    setEditingSession(null);
  };

  // Fix state update type handling
  const handleStateUpdate = (session: TimerSession) => {
    setState((prev: TimerState) => ({
      ...prev,
      sessions: prev.sessions.map(s => 
        s.id === session.id ? session : s
      )
    }));
  };

  const groupSessionsByWeek = (sessions: TimerSession[]) => {
    const grouped: { [key: string]: TimerSession[] } = {};
    
    sessions
      .sort((a, b) => sortOrder === 'asc' 
        ? a.startTime.getTime() - b.startTime.getTime()
        : b.startTime.getTime() - a.startTime.getTime()
      )
      .forEach(session => {
        const weekStart = startOfWeek(session.startTime, { weekStartsOn: 1 });
        const weekKey = dateFnsFormat(weekStart, 'yyyy-MM-dd');
        
        if (!grouped[weekKey]) {
          grouped[weekKey] = [];
        }
        grouped[weekKey].push(session);
      });

    return grouped;
  };

  const weeklyGroups = groupSessionsByWeek(state.sessions);

  // ADD: New function for copying invoicing data
  const handleCopyForInvoicing = async (weekSessions: any, weekStart: string) => {
    let grandTotal = 0;
    const lines: string[] = [];
    lines.push("Date\tDuration\tTotal");
    weekSessions.forEach((session: any) => {
      const end: Date = session.endTime ? new Date(session.endTime) : new Date();
      const breakTime = session.pauses.reduce((acc: number, pause: any) => {
        const pauseEnd = pause.endTime ? new Date(pause.endTime) : end;
        return acc + differenceInSeconds(pauseEnd, new Date(pause.startTime));
      }, 0);
      const totalTime = differenceInSeconds(end, new Date(session.startTime)) - breakTime;
      const hours = totalTime / 3600;
      const roundedHours = Math.ceil(hours * 4) / 4;
      const cost = roundedHours * session.hourlyRate;
      grandTotal += cost;
      lines.push(`${format(new Date(session.startTime), "yyyy-MM-dd")}\t${roundedHours}\t$${cost.toFixed(0)}`);
    });
    lines.push("\t\tGrand Total");
    lines.push(`\t\t$${grandTotal.toFixed(0)}`);
    const tableText = lines.join("\n");
    try {
      await navigator.clipboard.writeText(tableText);
      setToast("Data Copied!");
      setTimeout(() => setToast(""), 2000);
    } catch (err) {
      setToast("Failed to copy data");
      setTimeout(() => setToast(""), 2000);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1 className="title">
          CashTimer
        </h1>
        <button 
          className="btn btn-subtle"
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>
      <div className="stack">
        <div className="toggle-container">
          <span className="toggle-label">Conversions</span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={showConversions}
              onChange={() => setShowConversions(prev => !prev)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="grid-container">
          {/* Rate Input */}
          <div className="rate-container">
            <span className="label">
              RATE PER HOUR
            </span>
            <div className="rate-input-container">
              <select
                className="currency-select-small"
                value={rateCurrency.code}
                onChange={(e) => {
                  const currency = CURRENCIES.find(c => c.code === e.target.value);
                  if (currency) setRateCurrency(currency);
                }}
              >
                {CURRENCIES.map(currency => (
                  <option key={currency.code} value={currency.code}>
                    {currency.flag}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="rate-input"
              value={state.hourlyRate}
                onChange={(e) => setState(prev => ({ ...prev, hourlyRate: Number(e.target.value) || 0 }))}
                min="0"
                step="0.01"
              disabled={state.isRunning}
              />
            </div>

        {state.currentSession && (
              <>
                <span className="label">
                  STARTED TIME
                </span>
                {editingSession?.id === state.currentSession.id && editingSession.field === 'startTime' ? (
                  <div className="full-width">
                    <input
                      type="datetime-local"
                      className="datetime-input"
                      defaultValue={format(state.currentSession.startTime, "yyyy-MM-dd'T'HH:mm")}
                      onChange={(e) => {
                        const newStartTime = new Date(e.target.value);
                        // Check if new start time would result in negative duration
                        if (!isNaN(newStartTime.getTime()) && newStartTime > new Date()) {
                          alert('Start time cannot be in the future');
                          return;
                        }
                        setEditingSession(prev => prev ? {
                          ...prev,
                          tempValue: e.target.value
                        } : null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const newStartTime = new Date(editingSession.tempValue as string);
                          // Double check before saving
                          if (!isNaN(newStartTime.getTime()) && newStartTime > new Date()) {
                            alert('Start time cannot be in the future');
                            return;
                          }
                          handleSave('start', state.currentSession);
                        }
                      }}
                      autoFocus
                    />
                  </div>
                ) : (
                  <span 
                    className="clickable"
                    onClick={() => setEditingSession({ 
                      id: state.currentSession.id, 
                      field: 'startTime' 
                    })}
                    >
                      {format(state.currentSession.startTime, 'h:mm a')}
                  </span>
                )}
              </>
            )}
          </div>

          {/* Timer Display */}
          <div className="timer-display">
            {state.currentSession && (
              <>
                <span className="timer-amount">
                  ${state.currentSession.earnings.toFixed(2)}
                </span>
                <span className="timer-duration">
                  {formatDuration(elapsedTime)}
                </span>
                {showConversions && (
                  <span className="label">
                    {conversionCurrency.flag} {conversionCurrency.symbol}
                    {(
                      (state.currentSession?.earnings / exchangeRate[rateCurrency.code]) * 
                      exchangeRate[conversionCurrency.code]
                    ).toFixed(2)}
                  </span>
                )}
              </>
            )}
          </div>

          {/* Control Buttons */}
          <div className="controls-container-vertical">
            {!state.currentSession ? (
              <button
                onClick={startTimer}
                className="btn btn-primary btn-lg btn-full"
              >
                <IconPlayerPlay size={20} />
                Start Timer
              </button>
            ) : (
              !state.isPaused ? (
                <>
                  <button 
                      onClick={handlePauseResume} 
                    className="btn btn-lg btn-warning"
                  >
                    <IconPlayerPause size={20} />
                      Pause
                  </button>
                  <button 
                      onClick={stopTimer} 
                    className="btn btn-danger btn-lg btn-full"
                  >
                    <IconPlayerStop size={20} />
                    Stop
                  </button>
                  </>
                ) : (
                  <>
                  <button 
                      onClick={handlePauseResume} 
                    className="btn btn-primary btn-lg btn-full"
                  >
                    <IconPlayerPlay size={20} />
                      Resume
                  </button>
                  <button 
                      onClick={stopTimer} 
                    className="btn btn-danger btn-lg btn-full"
                  >
                    <IconPlayerStop size={20} />
                    Stop
                  </button>
                </>
              )
            )}
          </div>
        </div>

        {state.sessions.length > 0 && (
          <div className="paper">
            <table className={`table ${!showConversions ? 'table-no-conversions' : ''}`}>
              <thead>
                <tr>
                  <th className="table-header table-header-breaks">Breaks</th>
                  <th 
                    className="table-header table-header-start clickable"
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  >
                    Start
                  </th>
                  <th className="table-header table-header-end">End</th>
                  <th className="table-header table-header-duration">Duration</th>
                  <th className="table-header table-header-earnings">Earnings</th>
                  {showConversions && (
                    <th className="table-header table-header-currency">
                      <select
                        className="currency-select"
                        value={conversionCurrency.code}
                        onChange={(e) => {
                          const currency = CURRENCIES.find(c => c.code === e.target.value);
                          if (currency) setConversionCurrency(currency);
                        }}
                      >
                        {CURRENCIES.map(currency => (
                          <option key={currency.code} value={currency.code}>
                            {currency.flag} {currency.code}
                          </option>
                        ))}
                      </select>
                    </th>
                  )}
                  <th className="table-header table-header-delete"></th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(weeklyGroups).map(([weekStart, weekSessions]) => {
                  const weekTotal = weekSessions.reduce((acc, session) => acc + session.earnings, 0);
                  const weekDuration = weekSessions.reduce((acc, session) => {
                    const end = session.endTime || new Date();
                    return acc + (differenceInSeconds(end, session.startTime) - 
                      session.pauses.reduce((pauseAcc, pause) => {
                        const pauseEnd = pause.endTime || end;
                        return pauseAcc + differenceInSeconds(pauseEnd, pause.startTime);
                      }, 0));
                  }, 0);

                  return (
                    <Fragment key={weekStart}>
                      {/* Week Total Row */}
                      <tr className="total-row">
                        <td colSpan={3} className="text-bold" style={{ textAlign: 'right' }}>
                          Week of {dateFnsFormat(new Date(weekStart), 'MMM d')}:
                        </td>
                        <td className="text-bold">{formatDuration(weekDuration)}</td>
                        <td className="text-bold">${weekTotal.toFixed(2)}</td>
                        {showConversions && (
                          <td className="text-bold">
                            {conversionCurrency.symbol}{((weekTotal / exchangeRate[rateCurrency.code]) * exchangeRate[conversionCurrency.code]).toFixed(2)}
                          </td>
                        )}
                        <td>
                          <button className="btn btn-primary btn-xs" onClick={() => handleCopyForInvoicing(weekSessions, weekStart)}>
                            Copy for invoicing
                          </button>
                        </td>
                      </tr>

                      {/* Sessions */}
                      {weekSessions.map((session) => (
                        <Fragment key={session.id}>
                          <tr>
                            <td className="cell cell-breaks">
                              <div className="chevron-container">
                                <button
                                  className="icon-button icon-button-dim"
                                  onClick={() => toggleRowExpansion(session.id)}
                                >
                                  {expandedRows.has(session.id) ? (
                                    <IconChevronDown size={16} />
                                  ) : (
                                    <IconChevronRight size={16} />
                                  )}
                                </button>
                                <span className="break-count">
                                  {session.pauses.length}
                                </span>
                              </div>
                          </td>
                            <td className="table-cell">
                              {editingSession?.id === session.id && editingSession.field === 'startTime' ? (
                                <div className="full-width">
                                  <input
                                    type="datetime-local"
                                    className="datetime-input"
                                    defaultValue={format(session.startTime, "yyyy-MM-dd'T'HH:mm")}
                                    onChange={(e) => {
                                      setEditingSession(prev => prev ? {
                                        ...prev,
                                        tempValue: e.target.value  // Just store the raw value
                                      } : null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSave('start', session);
                                      }
                                    }}
                                    autoFocus
                                  />
                                </div>
                              ) : (
                                <span 
                                  className="clickable"
                                  onClick={() => setEditingSession({ 
                                    id: session.id, 
                                    field: 'startTime' 
                                  })}
                                >
                                  {format(session.startTime, 'MMM d, h:mm a')}
                                </span>
                              )}
                          </td>
                            <td className="table-cell">
                              {editingSession?.id === session.id && editingSession.field === 'endTime' ? (
                                <div className="full-width">
                                  <input
                                    type="datetime-local"
                                    className="datetime-input"
                                    defaultValue={session.endTime ? format(session.endTime, "yyyy-MM-dd'T'HH:mm") : ''}
                                    onChange={(e) => {
                                      setEditingSession(prev => prev ? {
                                        ...prev,
                                        tempValue: e.target.value  // Just store the raw value
                                      } : null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSave('end', session);
                                      }
                                    }}
                                    autoFocus
                                  />
                                </div>
                              ) : (
                                <span 
                                  className="clickable"
                                  onClick={() => setEditingSession({ 
                                    id: session.id, 
                                    field: 'endTime' 
                                  })}
                                >
                                  {session.endTime ? format(session.endTime, 'MMM d, h:mm a') : '-'}
                                </span>
                              )}
                            </td>
                            <td className="table-cell">
                              {session.endTime ? (
                                (() => {
                                  const totalTime = differenceInSeconds(session.endTime, session.startTime);
                                  const breakTime = session.pauses.reduce((acc, pause) => {
                                    const pauseEnd = pause.endTime || session.endTime!;
                                    return acc + differenceInSeconds(pauseEnd, pause.startTime);
                                  }, 0);
                                  return formatDuration(totalTime - breakTime);
                                })()
                              ) : '-'}
                            </td>
                            <td className="table-cell">
                              <span className="table-value">
                                {rateCurrency.symbol}{session.earnings.toFixed(2)}
                              </span>
                            </td>
                            {showConversions && (
                              <td className="table-cell">
                                <span className="table-value">
                                  {conversionCurrency.symbol}{(
                                    (session.earnings / exchangeRate[rateCurrency.code]) * 
                                    exchangeRate[conversionCurrency.code]
                                  ).toFixed(2)}
                                </span>
                              </td>
                            )}
                            <td className="table-cell">
                              <button
                                className="icon-button icon-button-delete"
                                onClick={() => deleteSession(session.id)}
                              >
                                <IconTrash size={20} />
                              </button>
                            </td>
                          </tr>
                          
                          {/* Expandable Pause Details */}
                          {expandedRows.has(session.id) && (
                            <tr>
                              <td colSpan={7} className="expanded-cell">
                                <div className="stack">
                                  {session.pauses.map((pause, index) => (
                                    <div key={index} className="group group-apart">
                                      <div className="group-item">
                                        <button
                                          className="icon-button"
                                          onClick={async () => {
                                            // Delete from database
                                            const { error } = await supabase
                                              .from('session_pauses')
                                              .delete()
                                              .eq('session_id', session.id)
                                              .eq('start_time', pause.startTime.toISOString());

                                            if (!error) {
                                              // Update local state
                                              setState(prev => ({
                                                ...prev,
                                                sessions: prev.sessions.map(s => {
                                                  if (s.id !== session.id) return s;
                                                  
                                                  const updatedPauses = s.pauses.filter((_, i) => i !== index);
                                                  
                                                  // Recalculate earnings without this break
                                                  const totalTime = s.endTime ? 
                                                    (s.endTime.getTime() - s.startTime.getTime()) : 
                                                    (new Date().getTime() - s.startTime.getTime());
                                                  const breakTime = updatedPauses.reduce((acc, p) => {
                                                    const pEnd = p.endTime || new Date();
                                                    return acc + (pEnd.getTime() - p.startTime.getTime());
                                                  }, 0);
                                                  const activeTime = totalTime - breakTime;
                                                  const newEarnings = (activeTime / 3600000) * s.hourlyRate;

                                                  return { 
                                                    ...s, 
                                                    pauses: updatedPauses,
                                                    earnings: newEarnings
                                                  };
                                                })
                                              }));
                                            }
                                          }}
                                        >
                                          <IconTrash size={14} />
                                        </button>

                                        {editingSession?.id === session.id && editingSession.field === `pause-${index}` ? (
                                          <div className="group group-item">
                                            <input
                                              type="time"
                                              className="datetime-input"
                                              defaultValue={format(pause.startTime, "HH:mm")}
                                              onChange={(e) => {
                                                setEditingSession(prev => prev ? {
                                                  ...prev,
                                                  tempValue: { 
                                                    ...prev.tempValue as EditValue,
                                                    start: e.target.value,
                                                    end: prev.tempValue?.end || format(new Date(), "HH:mm")  // Keep existing end time or use current time
                                                  }
                                                } : null);
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  handleSave('break', session, index);
                                                }
                                              }}
                                            />
                                            <span>-</span>
                                            <input
                                              type="time"
                                              className="datetime-input"
                                              defaultValue={pause.endTime ? format(pause.endTime, "HH:mm") : ''}
                                              onChange={(e) => {
                                                setEditingSession(prev => prev ? {
                                                  ...prev,
                                                  tempValue: { 
                                                    ...prev.tempValue as EditValue,
                                                    end: e.target.value,
                                                    start: prev.tempValue?.start || format(new Date(), "HH:mm")  // Keep existing start time or use current time
                                                  }
                                                } : null);
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  handleSave('break', session, index);
                                                }
                                              }}
                                            />
                                            <div className="group group-item">
                                              <button 
                                                className="btn btn-xs btn-subtle btn-teal"
                                                onClick={() => handleSave('break', session, index)}
                                              >
                                                Save
                                              </button>
                                              <button 
                                                className="btn btn-xs btn-subtle btn-red"
                                                onClick={() => setEditingSession(null)}
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <span 
                                            className="clickable"
                                            onClick={() => setEditingSession({ 
                                              id: session.id, 
                                              field: `pause-${index}`,
                                              tempValue: {
                                                start: format(pause.startTime, "HH:mm"),
                                                end: pause.endTime ? format(pause.endTime, "HH:mm") : format(new Date(), "HH:mm")
                                              }
                                            })}
                                          >
                                            {format(pause.startTime, 'h:mm a')} - {pause.endTime ? format(pause.endTime, 'h:mm a') : 'Ongoing'}
                                            <span className="label label-dimmed">
                                              ({pause.endTime ? 
                                                `${Math.round(differenceInSeconds(pause.endTime, pause.startTime) / 60)}min` : 
                                                'In progress'})
                                            </span>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}

                                  {editingSession?.id === session.id && editingSession.field === 'pause-new' ? (
                                    <div className="group group-item">
                                      <input
                                        type="time"
                                        className="datetime-input"
                                        defaultValue={editingSession.tempValue?.start}
                                        onChange={(e) => {
                                          setEditingSession(prev => prev ? {
                                            ...prev,
                                            tempValue: { 
                                              ...prev.tempValue as any,
                                              start: e.target.value,
                                              end: prev.tempValue?.end || format(new Date(), "HH:mm")  // Keep existing end time or use current time
                                            }
                                          } : null);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSave('break', session, session.pauses.length);
                                          }
                                        }}
                                      />
                                      <span>-</span>
                                      <input
                                        type="time"
                                        className="datetime-input"
                                        defaultValue={editingSession.tempValue?.end}
                                        onChange={(e) => {
                                          setEditingSession(prev => prev ? {
                                            ...prev,
                                            tempValue: { 
                                              ...prev.tempValue as any,
                                              end: e.target.value,
                                              start: prev.tempValue?.start || format(new Date(), "HH:mm")  // Keep existing start time or use current time
                                            }
                                          } : null);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSave('break', session, session.pauses.length);
                                          }
                                        }}
                                      />
                                      <div className="group group-item">
                                        <button 
                                          className="btn btn-xs btn-subtle btn-teal"
                                          onClick={() => handleSave('break', session, session.pauses.length)}
                                        >
                                          Save
                                        </button>
                                        <button 
                                          className="btn btn-xs btn-subtle btn-red"
                                          onClick={() => setEditingSession(null)}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="group group-item">
                                      <button
                                        className="btn btn-xs btn-subtle btn-gray btn-text"
                                        onClick={() => addBreak(session.id)}
                                      >
                                        <IconPlus size={14} />
                                        Add Break
                                      </button>
                                      {session.pauses.length > 0 && (
                                        <span className="label label-medium">
                                          Total Break Time: {Math.round(session.pauses.reduce((acc, pause) => {
                                            const end = pause.endTime || new Date();
                                            return acc + differenceInSeconds(end, pause.startTime);
                                          }, 0) / 60)}min
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {summaryModalOpen && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="stack">
                <div className="summary-title">
                  <span>You've Made:</span>
                  <span className="summary-amount">
                    ${completedSession?.earnings.toFixed(2)}
                  </span>
                  {completedSession && completedSession.pauses && completedSession.pauses.length > 0 && (
                    <span className="summary-breaks">
                      with {completedSession.pauses.length} break{completedSession.pauses.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="paper">
                  <div className="stack">
                    <div className="group group-apart">
                      <span className="label label-bold">Duration</span>
                      <span className="label" style={{ fontWeight: 600 }}>
                        {completedSession?.endTime && (() => {
                          const totalTime = differenceInSeconds(completedSession.endTime, completedSession.startTime);
                          const breakTime = completedSession.pauses.reduce((acc, pause) => {
                            const pauseEnd = pause.endTime || completedSession.endTime!;
                            return acc + differenceInSeconds(pauseEnd, pause.startTime);
                          }, 0);
                          return formatDuration(totalTime - breakTime);
                        })()}
                      </span>
                    </div>
                    
                    <div className="group group-apart">
                      <span className="label label-bold">Start Time</span>
                      <span className="label" style={{ fontWeight: 600 }}>
                        {completedSession && format(completedSession.startTime, 'h:mm a')}
                      </span>
                    </div>
                    
                    <div className="group group-apart">
                      <span className="label label-bold">End Time</span>
                      <span className="label" style={{ fontWeight: 600 }}>
                        {completedSession?.endTime && format(completedSession.endTime, 'h:mm a')}
                      </span>
                    </div>
                    
                    <div className="group group-apart">
                      <span className="label label-bold">Rate</span>
                      <span className="label" style={{ fontWeight: 600 }}>
                        ${completedSession?.hourlyRate}/hr
                      </span>
                    </div>
                  </div>
                </div>

                <button 
                  className="btn btn-primary btn-xl btn-full"
                  onClick={() => setSummaryModalOpen(false)} 
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          padding: '10px 20px',
          background: '#333',
          color: 'white',
          borderRadius: '4px',
          opacity: 0.9
        }}>
          {toast}
        </div>
      )}
    </div>
  );
} 