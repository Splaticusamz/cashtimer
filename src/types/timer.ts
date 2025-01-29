export interface PauseInterval {
  startTime: Date;
  endTime?: Date;
}

export interface EditValue {
  start?: string;
  end?: string;
  datetime?: string;
}

export type EditingSession = {
  id: string;
  field: 'startTime' | 'endTime' | `pause-${number}` | 'pause-new';
  tempValue?: string | EditValue;
}; 