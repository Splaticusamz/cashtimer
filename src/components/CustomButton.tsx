import { Button, ButtonProps } from '@mantine/core';
import { forwardRef } from 'react';

export const CustomButton = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => (
  <Button ref={ref} {...props} />
)); 