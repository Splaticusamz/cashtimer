export interface PauseInterval {
  startTime: Date;
  endTime?: Date;
}

export interface EditValue {
  start: string;
  end: string;
  datetime?: string;
}

export type EditingSession = {
  id: string;
  field: 'startTime' | 'endTime' | `pause-${number}` | 'pause-new';
  tempValue?: string | EditValue;
};

const isEditValue = (value: unknown): value is EditValue => {
  return typeof value === 'object' && value !== null && 
    'start' in value && 'end' in value;
};

if (editingSession?.tempValue && isEditValue(editingSession.tempValue)) {
  const { start, end } = editingSession.tempValue;
} 