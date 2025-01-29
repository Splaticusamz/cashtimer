import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { Button, NumberInput, Table, Stack, Text, Group, Paper, Container, ActionIcon } from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { format, differenceInSeconds } from 'date-fns';
import confetti from 'canvas-confetti';
import { TimerState } from '../types';
import { IconTrash, IconPlayerPause, IconPlayerStop, IconPlayerPlay, IconChevronDown, IconChevronRight, IconPlus } from '@tabler/icons-react';
import { supabase } from '../lib/supabase';

const TICK_INTERVAL = 100; // Update every 100ms for smooth earnings display

type Currency = {
  code: string;
  symbol: string;
  flag: string;
  name: string;
};

const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', flag: '🇺🇸', name: 'US Dollar' },
  { code: 'CAD', symbol: '$', flag: '🇨🇦', name: 'Canadian Dollar' },
  { code: 'EUR', symbol: '€', flag: '🇪🇺', name: 'Euro' },
  { code: 'GBP', symbol: '£', flag: '🇬🇧', name: 'British Pound' },
  { code: 'AUD', symbol: '$', flag: '🇦🇺', name: 'Australian Dollar' },
];

type ExchangeRate = {
  [key: string]: number;
  lastUpdated: number;  // Change from Date to number, store timestamp instead
};

type EditingSession = {
  id: string;
  field: 'startTime' | 'endTime' | `pause-${number}` | 'pause-new';
  tempValue?: string | { start?: string; end?: string };
};

type EditValue = {
  start?: string;
  end?: string;
  datetime?: string;
};

const formatDuration = (seconds: number): string => {
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
    USDCAD: 1.35,
    lastUpdated: Date.now() // Use timestamp instead of Date object
  });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(CURRENCIES[1]); // Default to CAD

  const calculateEarnings = useCallback((session: TimerSession) => {
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
          lastUpdated: Date.now()
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
    const { data: sessions, error } = await supabase
      .from('timer_sessions')
      .select(`
        *,
        session_pauses (*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sessions:', error);
      return;
    }

    setState(prev => ({
      ...prev,
      sessions: sessions.map(session => ({
        ...session,
        startTime: new Date(session.start_time),
        endTime: session.end_time ? new Date(session.end_time) : null,
        hourlyRate: session.hourly_rate,
        earnings: session.earnings,
        pauses: session.session_pauses.map((pause: any) => ({
          startTime: new Date(pause.start_time),
          endTime: pause.end_time ? new Date(pause.end_time) : null
        }))
      }))
    }));
  };

  const startTimer = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('No authenticated user');
      return;
    }

    const session = {
      start_time: new Date().toISOString(),
      hourly_rate: state.hourlyRate,
      earnings: 0,
      user_id: user.id  // Use the actual user ID
    };

    const { data, error } = await supabase
      .from('timer_sessions')
      .insert([session])
      .select()
      .single();

    if (error) {
      console.error('Error starting timer:', error);
      return;
    }

    setState(prev => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      currentSession: {
        id: data.id,
        startTime: new Date(data.start_time),
        hourlyRate: data.hourly_rate,
        earnings: 0,
        pauses: []
      }
    }));
  };

  const pauseTimer = async () => {
    if (!state.currentSession) return;

    const pause = {
      session_id: state.currentSession.id,
      start_time: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('session_pauses')
      .insert([pause])
      .select()
      .single();

    if (error) {
      console.error('Error creating pause:', error);
      return;
    }

    setState(prev => {
      if (!prev.currentSession) return prev;

      return {
        ...prev,
        isPaused: true,
        currentSession: {
          ...prev.currentSession,
          pauses: [
            ...prev.currentSession.pauses,
            { startTime: new Date(data.start_time) }
          ]
        }
      };
    });
  };

  const resumeTimer = async () => {
    if (!state.currentSession) return;
    
    const lastPause = state.currentSession.pauses[state.currentSession.pauses.length - 1];
    
    const { error } = await supabase
      .from('session_pauses')
      .update({ end_time: new Date().toISOString() })
      .eq('session_id', state.currentSession.id)
      .is('end_time', null);

    if (error) {
      console.error('Error updating pause:', error);
      return;
    }

    setState(prev => {
      if (!prev.currentSession) return prev;

      const updatedPauses = [...prev.currentSession.pauses];
      if (lastPause) {
        updatedPauses[updatedPauses.length - 1] = {
          ...lastPause,
          endTime: new Date()
        };
      }

      return {
        ...prev,
        isPaused: false,
        currentSession: {
          ...prev.currentSession,
          pauses: updatedPauses
        }
      };
    });
  };

  const stopTimer = async () => {
    if (!state.currentSession) return;

    // If there's an active pause, end it
    if (state.isPaused) {
      const { error: pauseError } = await supabase
        .from('session_pauses')
        .update({ end_time: new Date().toISOString() })
        .eq('session_id', state.currentSession.id)
        .is('end_time', null);

      if (pauseError) {
        console.error('Error ending pause:', pauseError);
        return;
      }
    }

    const finalEarnings = calculateEarnings(state.currentSession);
    const endTime = new Date();

    const { error } = await supabase
      .from('timer_sessions')
      .update({ 
        end_time: endTime.toISOString(),
        earnings: finalEarnings
      })
      .eq('id', state.currentSession.id);

    if (error) {
      console.error('Error stopping timer:', error);
      return;
    }

    const finalSession = {
      ...state.currentSession,
      endTime,
      earnings: finalEarnings,
      pauses: state.currentSession.pauses.map(pause => ({
        ...pause,
        endTime: pause.endTime || endTime // Ensure all pauses are ended
      }))
    };

    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#00b341', '#009e3a', '#008531'],
    });

    setCompletedSession(finalSession);
    setSummaryModalOpen(true);

    setState(prev => ({
      ...prev,
      isRunning: false,
      isPaused: false,
      currentSession: null,
      sessions: [finalSession, ...prev.sessions]
    }));
  };

  const deleteSession = (sessionId: string) => {
    setState(prev => ({
      ...prev,
      sessions: prev.sessions.filter(s => s.id !== sessionId)
    }));
  };

  const calculateSessionEarnings = (startTime: Date, endTime: Date, hourlyRate: number): number => {
    const durationInHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    return durationInHours * hourlyRate;
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

  // Replace handleSave with this simpler version
  const handleSave = async (type: 'start' | 'end' | 'break', session: TimerSession, index?: number) => {
    if (!editingSession?.tempValue) return;

    try {
      if (type === 'break') {
        const value = editingSession.tempValue as EditValue;
        if (!value.start || !value.end) return;

        const startDate = new Date(session.startTime);
        const [startHours, startMinutes] = value.start.split(':').map(Number);
        startDate.setHours(startHours, startMinutes);

        const endDate = new Date(session.startTime);
        const [endHours, endMinutes] = value.end.split(':').map(Number);
        endDate.setHours(endHours, endMinutes);

        if (index !== undefined && index < session.pauses.length) {
          // Update existing break
          await supabase
            .from('session_pauses')
            .update({
              start_time: startDate.toISOString(),
              end_time: endDate.toISOString()
            })
            .eq('session_id', session.id)
            .eq('start_time', session.pauses[index].startTime.toISOString());
        } else {
          // Add new break
          await supabase
            .from('session_pauses')
            .insert([{
              session_id: session.id,
              start_time: startDate.toISOString(),
              end_time: endDate.toISOString()
            }]);
        }

        await fetchSessions(); // Refresh all data
      } else {
        const newDate = new Date(editingSession.tempValue as string);
        if (isNaN(newDate.getTime())) return;

        await supabase
          .from('timer_sessions')
          .update({ 
            [type === 'start' ? 'start_time' : 'end_time']: newDate.toISOString()
          })
          .eq('id', session.id);

        await fetchSessions(); // Refresh all data
      }
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setEditingSession(null);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const currentSession = state.currentSession!; // Add non-null assertion
  // OR
  if (!state.currentSession) return null;

  return (
    <Container size="lg" px={{ base: 20, sm: 40 }} py={60}>
      <Group position="apart" mb={40}>
        <Text size="xl" weight={700} style={{ color: '#00b5a9' }}>
          CashTimer
        </Text>
        <Button 
          variant="subtle" 
          color="gray" 
          onClick={handleLogout}
        >
          Logout
        </Button>
      </Group>
      <Stack spacing={40}>
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '40px',
          padding: '30px',
          background: '#1A1B1E',
          borderRadius: '16px',
          border: '1px solid #2C2E33'
        }}>
          {/* Rate Input */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Text size="xs" weight={700} color="dimmed" style={{ letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '8px' }}>
              RATE PER HOUR
            </Text>
            <NumberInput
              value={state.hourlyRate}
              onChange={(val) => setState(prev => ({ ...prev, hourlyRate: Number(val) || 0 }))}
              min={0}
              step={0.01}
              disabled={state.isRunning}
              size="md"
              hideControls
              styles={{
                input: {
                  fontSize: '1.8rem',
                  textAlign: 'center',
                  height: '50px',
                  width: '100%',
                  background: '#0e0f11',
                  border: '2px solid #25272b',
                  borderRadius: '12px',
                  marginBottom: '24px',
                  '&:focus': {
                    borderColor: '#00c9b8',
                    boxShadow: '0 0 0 3px rgba(0, 201, 184, 0.15)'
                  }
                }
              }}
            />

            {state.currentSession && (
              <>
                <Text size="xs" weight={700} color="dimmed" style={{ letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  STARTED TIME
                </Text>
                {editingSession?.id === state.currentSession.id && editingSession.field === 'startTime' ? (
                  <Group
                    style={{ 
                      flexDirection: 'row' as const,
                      width: '100%'
                    }}
                  >
                    <div style={{ width: '100%' }}>
                      <input
                        type="datetime-local"
                        defaultValue={format(state.currentSession.startTime, "yyyy-MM-dd'T'HH:mm")}
                        style={{
                          width: '100%',
                          background: '#141517',
                          border: '1px solid #2C2E33',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: '#C1C2C5',
                          fontSize: '0.95rem'
                        }}
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
                            handleSave('start', state.currentSession);
                          }
                        }}
                        autoFocus
                      />
                    </div>
                    <Group spacing={4} mt={8}>
                      <Button 
                        size="xs" 
                        variant="subtle" 
                        color="teal"
                        onClick={() => handleSave('start', state.currentSession)}
                      >
                        Save
                      </Button>
                      <Button 
                        size="xs" 
                        variant="subtle" 
                        color="red"
                        onClick={() => setEditingSession(null)}
                      >
                        Cancel
                      </Button>
                    </Group>
                  </Group>
                ) : (
                  <Text 
                    size="lg" 
                    weight={600}
                    onClick={() => setEditingSession({ id: state.currentSession.id, field: 'startTime' })}
                    style={{ 
                      cursor: 'pointer', 
                      '&:hover': { 
                        color: '#00b5a9',
                        textDecoration: 'underline' 
                      } as React.CSSProperties
                    }}
                  >
                    {format(state.currentSession.startTime, 'h:mm a')}
                  </Text>
                )}
              </>
            )}
          </div>

          {/* Timer Display */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            transform: 'scale(1.1)',
            transformOrigin: 'center'
          }}>
            {state.currentSession && (
              <>
                <Text 
                  style={{ 
                    fontSize: '4rem',
                    fontWeight: 900,
                    background: 'linear-gradient(135deg, #00e6d4 0%, #00b5a9 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    lineHeight: 0.9,
                    marginBottom: '12px',
                    letterSpacing: '-0.03em',
                    textShadow: '0 0 40px rgba(0, 230, 212, 0.25)'
                  }}
                >
                  ${state.currentSession.earnings.toFixed(2)}
                </Text>
                <Text 
                  style={{
                    fontSize: '2.5rem',
                    fontWeight: 800,
                    color: '#909296',
                    letterSpacing: '-0.02em',
                    marginBottom: '16px'
                  }}
                >
                  {formatDuration(elapsedTime)}
                </Text>
                <Text size="md" color="dimmed" style={{ marginTop: 4 }}>
                  {selectedCurrency.flag} {selectedCurrency.symbol}
                  {Math.round(
                    (state.currentSession?.earnings * exchangeRate[`USD${selectedCurrency.code}`]) * 100
                  ) / 100}
                </Text>
              </>
            )}
          </div>

          {/* Control Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {!state.currentSession ? (
              <Button 
                onClick={startTimer} 
                size="lg"
                radius="xl"
                fullWidth
                leftSection={<IconPlayerPlay size={20} />}
                style={{ 
                  background: 'linear-gradient(135deg, #00e6d4 0%, #00b5a9 100%)',
                  border: 'none',
                  boxShadow: '0 4px 24px rgba(0, 181, 169, 0.2)'
                }}
              >
                Start Timer
              </Button>
            ) : (
              !state.isPaused ? (
                <>
                  <Button 
                    onClick={pauseTimer} 
                    color="#ffd700" 
                    size="lg"
                    radius="xl"
                    style={{ 
                      flex: 1,
                      background: 'linear-gradient(135deg, #ffd700 0%, #ffb700 100%)',
                      border: 'none',
                      boxShadow: '0 4px 24px rgba(255, 215, 0, 0.2)'
                    }}
                    leftSection={<IconPlayerPause size={20} />}
                  >
                    Pause
                  </Button>
                  <Button
                    onClick={stopTimer}
                    size="lg"
                    radius="xl"
                    fullWidth
                    left={<IconPlayerStop size={20} />}
                    styles={{
                      root: {
                        background: '#1A1B1E',
                        border: '1px solid #2C2E33',
                        boxShadow: '0 4px 24px rgba(0, 181, 169, 0.2)'
                      }
                    }}
                  >
                    Stop Timer
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    onClick={resumeTimer} 
                    color="#00b5a9" 
                    size="lg"
                    radius="xl"
                    style={{ 
                      flex: 1,
                      background: 'linear-gradient(135deg, #00e6d4 0%, #00b5a9 100%)',
                      border: 'none',
                      boxShadow: '0 4px 24px rgba(0, 181, 169, 0.2)'
                    }}
                    leftSection={<IconPlayerPlay size={20} />}
                  >
                    Resume
                  </Button>
                  <Button
                    onClick={stopTimer}
                    size="lg"
                    radius="xl"
                    fullWidth
                    left={<IconPlayerStop size={20} />}
                    styles={{
                      root: {
                        background: '#1A1B1E',
                        border: '1px solid #2C2E33',
                        boxShadow: '0 4px 24px rgba(0, 181, 169, 0.2)'
                      }
                    }}
                  >
                    Stop Timer
                  </Button>
                </>
              )
            )}
          </div>
        </div>

        {state.sessions.length > 0 && (
          <Paper 
            withBorder 
            p={40} 
            style={{ 
              borderColor: '#2C2E33',
              background: 'linear-gradient(155deg, #1A1B1E 0%, #141517 100%)',
              overflow: 'hidden'
            }}
          >
            <Table 
              striped 
              highlightOnHover
              style={{
                tableLayout: 'fixed',
                width: '100%',
                '--mantine-color-dark-filled': '#0e0f11',
                '--mantine-color-dark-filled-hover': '#141517'
              }}
            >
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th style={{ ...tableHeaderStyle, width: '80px' }}>Breaks</th>
                  <th style={{ ...tableHeaderStyle, width: '20%' }}>Start</th>
                  <th style={{ ...tableHeaderStyle, width: '20%' }}>End</th>
                  <th style={{ ...tableHeaderStyle, width: '15%' }}>Duration</th>
                  <th style={{ ...tableHeaderStyle, width: '15%' }}>Earnings</th>
                  <th style={{ ...tableHeaderStyle, width: '15%' }}>
                    <select
                      value={selectedCurrency.code}
                      onChange={(e) => {
                        const currency = CURRENCIES.find(c => c.code === e.target.value);
                        if (currency) setSelectedCurrency(currency);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#909296',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        margin: '0 auto',
                        display: 'block',
                        '&:hover': {
                          background: '#1A1B1E'
                        }
                      }}
                    >
                      {CURRENCIES.map(currency => (
                        <option key={currency.code} value={currency.code}>
                          {currency.flag} {currency.code}
                        </option>
                      ))}
                    </select>
                  </th>
                  <th style={{ ...tableHeaderStyle, width: '5%' }}></th>
                </tr>
              </thead>
              <tbody>
                {state.sessions.map((session) => (
                  <Fragment key={session.id}>
                    <tr style={{ transition: 'all 0.2s ease' }}>
                      <td style={{ ...tableCellStyle, width: '80px', padding: '20px 0 20px 24px', textAlign: 'left' }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px' 
                        }}>
                          <ActionIcon 
                            onClick={() => toggleRowExpansion(session.id)}
                            variant="subtle"
                            color="gray"
                            style={{ opacity: 0.8 }}
                          >
                            {expandedRows.has(session.id) ? (
                              <IconChevronDown size={16} />
                            ) : (
                              <IconChevronRight size={16} />
                            )}
                          </ActionIcon>
                          <span style={{ 
                            color: '#909296', 
                            fontSize: '0.9rem',
                            lineHeight: 1 
                          }}>
                            {session.pauses.length}
                          </span>
                        </div>
                      </td>
                      <td style={tableCellStyle}>
                        {editingSession?.id === session.id && editingSession.field === 'startTime' ? (
                          <div style={{ width: '100%' }}>
                            <input
                              type="datetime-local"
                              defaultValue={format(session.startTime, "yyyy-MM-dd'T'HH:mm")}
                              style={{
                                width: '100%',
                                background: '#141517',
                                border: '1px solid #2C2E33',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                color: '#C1C2C5',
                                fontSize: '0.95rem'
                              }}
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
                                  handleSave('start', session);
                                }
                              }}
                              autoFocus
                            />
                            <Group spacing={4} mt={8}>
                              <Button 
                                size="xs" 
                                variant="subtle" 
                                color="teal"
                                onClick={() => handleSave('start', session)}
                              >
                                Save
                              </Button>
                              <Button 
                                size="xs" 
                                variant="subtle" 
                                color="red"
                                onClick={() => setEditingSession(null)}
                              >
                                Cancel
                              </Button>
                            </Group>
                          </div>
                        ) : (
                          <Text 
                            onClick={() => setEditingSession({ id: session.id, field: 'startTime' })}
                            style={{ cursor: 'pointer' }}
                          >
                            {format(session.startTime, 'MMM d, h:mm a')}
                          </Text>
                        )}
                      </td>
                      <td style={tableCellStyle}>
                        {editingSession?.id === session.id && editingSession.field === 'endTime' ? (
                          <Group spacing={4} direction="column" style={{ width: '100%' }}>
                            <input
                              type="datetime-local"
                              defaultValue={session.endTime ? format(session.endTime, "yyyy-MM-dd'T'HH:mm") : ''}
                              style={{
                                width: '100%',
                                background: '#141517',
                                border: '1px solid #2C2E33',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                color: '#C1C2C5',
                                fontSize: '0.95rem'
                              }}
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
                                  handleSave('end', session);
                                }
                              }}
                              autoFocus
                            />
                            <Group spacing={4} mt={8}>
                              <Button 
                                size="xs" 
                                variant="subtle" 
                                color="teal"
                                onClick={() => handleSave('end', session)}
                              >
                                Save
                              </Button>
                              <Button 
                                size="xs" 
                                variant="subtle" 
                                color="red"
                                onClick={() => setEditingSession(null)}
                              >
                                Cancel
                              </Button>
                            </Group>
                          </Group>
                        ) : (
                          <Text 
                            onClick={() => setEditingSession({ id: session.id, field: 'endTime' })}
                            style={{ cursor: 'pointer' }}
                          >
                            {session.endTime ? format(session.endTime, 'MMM d, h:mm a') : '-'}
                          </Text>
                        )}
                      </td>
                      <td style={tableCellStyle}>
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
                      <td style={tableCellStyle}>
                        <Text span style={{ color: '#909296', fontWeight: 600 }}>
                          ${session.earnings.toFixed(2)}
                        </Text>
                      </td>
                      <td style={tableCellStyle}>
                        <Text span style={{ color: '#909296', fontWeight: 600 }}>
                          {selectedCurrency.symbol}{(session.earnings * exchangeRate[selectedCurrency.code]).toFixed(2)}
                        </Text>
                      </td>
                      <td style={tableCellStyle}>
                        <ActionIcon 
                          color="red" 
                          onClick={() => deleteSession(session.id)}
                          variant="light"
                          size="lg"
                          style={{
                            margin: '0 auto',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              transform: 'scale(1.1)',
                              background: 'rgba(255, 71, 87, 0.15)'
                            }
                          }}
                        >
                          <IconTrash size={20} />
                        </ActionIcon>
                      </td>
                    </tr>
                    
                    {/* Expandable Pause Details */}
                    {expandedRows.has(session.id) && (
                      <tr>
                        <td colSpan={7} style={{ 
                          padding: '16px 24px',
                          backgroundColor: '#141517'
                        }}>
                          <Stack spacing="md">
                            {session.pauses.map((pause, index) => (
                              <Group key={index} position="apart" align="center" style={{ 
                                padding: '12px 16px',
                                background: '#1A1B1E',
                                borderRadius: '8px',
                                border: '1px solid #2C2E33'
                              }}>
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '12px',
                                  width: '100%'
                                }}>
                                  <ActionIcon
                                    color="red"
                                    variant="subtle"
                                    size="sm"
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
                                  </ActionIcon>

                                  {editingSession?.id === session.id && editingSession.field === `pause-${index}` ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <input
                                        type="time"
                                        defaultValue={format(pause.startTime, "HH:mm")}
                                        style={{
                                          width: '110px',
                                          background: '#0e0f11',
                                          border: '1px solid #2C2E33',
                                          borderRadius: '6px',
                                          padding: '4px 8px',
                                          color: '#C1C2C5',
                                          fontSize: '0.9rem'
                                        }}
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
                                      <Text>-</Text>
                                      <input
                                        type="time"
                                        defaultValue={pause.endTime ? format(pause.endTime, "HH:mm") : ''}
                                        style={{
                                          width: '110px',
                                          background: '#0e0f11',
                                          border: '1px solid #2C2E33',
                                          borderRadius: '6px',
                                          padding: '4px 8px',
                                          color: '#C1C2C5',
                                          fontSize: '0.9rem'
                                        }}
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
                                      <Group spacing={4}>
                                        <Button 
                                          size="xs" 
                                          variant="subtle" 
                                          color="teal"
                                          onClick={() => handleSave('break', session, index)}
                                        >
                                          Save
                                        </Button>
                                        <Button 
                                          size="xs" 
                                          variant="subtle" 
                                          color="red"
                                          onClick={() => setEditingSession(null)}
                                        >
                                          Cancel
                                        </Button>
                                      </Group>
                                    </div>
                                  ) : (
                                    <Text 
                                      onClick={() => setEditingSession({ id: session.id, field: `pause-${index}` })}
                                      style={{ cursor: 'pointer', fontSize: '0.9rem' }}
                                    >
                                      {format(pause.startTime, 'h:mm a')} - {pause.endTime ? format(pause.endTime, 'h:mm a') : 'Ongoing'}
                                      <Text component="span" size="xs" color="dimmed" ml={8}>
                                        ({pause.endTime ? 
                                          `${Math.round(differenceInSeconds(pause.endTime, pause.startTime) / 60)}min` : 
                                          'In progress'})
                                      </Text>
                                    </Text>
                                  )}
                                </div>
                              </Group>
                            ))}

                            {editingSession?.id === session.id && editingSession.field === 'pause-new' ? (
                              <Group 
                                spacing={8}
                                style={{ 
                                  width: '100%',
                                  display: 'flex',
                                  flexDirection: 'column' as const
                                }}
                              >
                                <input
                                  type="time"
                                  defaultValue={editingSession.tempValue?.start}
                                  style={{
                                    width: '110px',
                                    background: '#0e0f11',
                                    border: '1px solid #2C2E33',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    color: '#C1C2C5',
                                    fontSize: '0.9rem'
                                  }}
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
                                <Text>-</Text>
                                <input
                                  type="time"
                                  defaultValue={editingSession.tempValue?.end}
                                  style={{
                                    width: '110px',
                                    background: '#0e0f11',
                                    border: '1px solid #2C2E33',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    color: '#C1C2C5',
                                    fontSize: '0.9rem'
                                  }}
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
                                <Group spacing={4}>
                                  <Button 
                                    size="xs" 
                                    variant="subtle" 
                                    color="teal"
                                    onClick={() => handleSave('break', session, session.pauses.length)}
                                  >
                                    Save
                                  </Button>
                                  <Button 
                                    size="xs" 
                                    variant="subtle" 
                                    color="red"
                                    onClick={() => setEditingSession(null)}
                                  >
                                    Cancel
                                  </Button>
                                </Group>
                              </Group>
                            ) : (
                              <Group position="apart" mt={8}>
                                <Button
                                  size="xs"
                                  variant="subtle"
                                  color="gray"
                                  onClick={() => addBreak(session.id)}
                                  leftSection={<IconPlus size={14} />}
                                  style={{ fontWeight: 500 }}
                                >
                                  Add Break
                                </Button>
                                {session.pauses.length > 0 && (
                                  <Text size="sm" color="dimmed" weight={500}>
                                    Total Break Time: {Math.round(session.pauses.reduce((acc, pause) => {
                                      const end = pause.endTime || new Date();
                                      return acc + differenceInSeconds(end, pause.startTime);
                                    }, 0) / 60)}min
                                  </Text>
                                )}
                              </Group>
                            )}
                          </Stack>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </Table>
          </Paper>
        )}

        {summaryModalOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999
            }}
            onClick={() => setSummaryModalOpen(false)}
          >
            <Paper
              p={40}
              radius="xl"
              style={{
                width: '500px',
                background: 'linear-gradient(155deg, #1A1B1E 0%, #141517 100%)',
                boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
                border: '1px solid #2C2E33',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  bottom: -100,
                  left: -100,
                  width: 300,
                  height: 300,
                  background: 'radial-gradient(circle, rgba(0,181,169,0.15) 0%, transparent 70%)'
                }
              }}
              onClick={e => e.stopPropagation()}
            >
              <Stack spacing={32} align="center">
                <Text 
                  size="xl" 
                  weight={700}
                  color="dimmed"
                  style={{ 
                    letterSpacing: '0.1em', 
                    textTransform: 'uppercase',
                    fontFeatureSettings: '"calt" off, "liga" off'
                  }}
                >
                  Session Summary
                </Text>
                <Text 
                  size="3.5rem" 
                  weight={800} 
                  style={{ 
                    background: 'linear-gradient(135deg, #00e6d4 0%, #00b5a9 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    lineHeight: 1,
                    textShadow: '0 0 25px rgba(0, 230, 212, 0.15)'
                  }}
                >
                  ${completedSession?.earnings.toFixed(2)}
                </Text>
                <Paper 
                  withBorder 
                  p={32}
                  radius="lg" 
                  style={{ 
                    width: '100%',
                    backgroundColor: '#141517',
                    border: '1px solid #2C2E33'
                  }}
                >
                  <Stack spacing={24}>
                    <Group position="apart">
                      <Text size="sm" color="dimmed" sx={{ letterSpacing: '0.05em' }}>Duration</Text>
                      <Text size="md" weight={600}>
                        {completedSession?.endTime && (() => {
                          const totalTime = differenceInSeconds(completedSession.endTime, completedSession.startTime);
                          const breakTime = completedSession.pauses.reduce((acc, pause) => {
                            const pauseEnd = pause.endTime || completedSession.endTime!;
                            return acc + differenceInSeconds(pauseEnd, pause.startTime);
                          }, 0);
                          return formatDuration(totalTime - breakTime);
                        })()}
                      </Text>
                    </Group>
                    
                    <Group position="apart">
                      <Text size="sm" color="dimmed" sx={{ letterSpacing: '0.05em' }}>Start Time</Text>
                      <Text size="md" weight={600}>
                        {completedSession && format(completedSession.startTime, 'h:mm a')}
                      </Text>
                    </Group>
                    
                    <Group position="apart">
                      <Text size="sm" color="dimmed" sx={{ letterSpacing: '0.05em' }}>End Time</Text>
                      <Text size="md" weight={600}>
                        {completedSession?.endTime && format(completedSession.endTime, 'h:mm a')}
                      </Text>
                    </Group>
                    
                    <Group position="apart">
                      <Text size="sm" color="dimmed" sx={{ letterSpacing: '0.05em' }}>Rate</Text>
                      <Text size="md" weight={600}>
                        ${completedSession?.hourlyRate}/hr
                      </Text>
                    </Group>
                  </Stack>
                </Paper>

                <Button 
                  fullWidth 
                  onClick={() => setSummaryModalOpen(false)} 
                  color="teal"
                  size="xl"
                  radius="xl"
                  sx={{
                    height: '56px',
                    fontSize: '1.1rem',
                    fontWeight: 600
                  }}
                >
                  Close
                </Button>
              </Stack>
            </Paper>
          </div>
        )}
      </Stack>
    </Container>
  );
}

const tableHeaderStyle = {
  width: '100%',
  padding: '12px 16px',
  color: '#C1C2C5',
  fontWeight: 500,
  fontSize: '0.9rem',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  background: '#1A1B1E',
  borderBottom: '1px solid #2C2E33',
  backdropFilter: 'blur(10px)',
  textAlign: 'center' as const
};

const tableCellStyle = {
  padding: '20px 24px',
  fontSize: '0.95rem',
  color: '#C1C2C5',
  borderBottom: '1px solid rgba(44, 46, 51, 0.5)',
  textAlign: 'center' as const
}; 
