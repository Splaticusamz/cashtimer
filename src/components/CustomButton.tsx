import { Button, ButtonProps } from '@mantine/core';
import { ReactNode } from 'react';

interface CustomButtonProps extends Omit<ButtonProps, 'leftIcon'> {
  leftIcon?: ReactNode;
}

export const CustomButton = ({ leftIcon, ...props }: CustomButtonProps) => (
  <Button {...props} leftSection={leftIcon} />
); 