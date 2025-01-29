export type PauseInterval = {
  startTime: Date;
  endTime: Date | null;
};

export type TimerSession = {
  id: string;
  startTime: Date;
  endTime: Date | null;
  hourlyRate: number;
  earnings: number;
  pauses: PauseInterval[];
};

export type EditValue = {
  start?: string;
  end?: string;
};

export type EditingSession = {
  id: string;
  field: string;
  tempValue: EditValue | string;
};

const isEditValue = (value: unknown): value is EditValue => {
  return typeof value === 'object' && value !== null && 
    'start' in value && 'end' in value;
};

if (editingSession?.tempValue && isEditValue(editingSession.tempValue)) {
  const { start, end } = editingSession.tempValue;
} 