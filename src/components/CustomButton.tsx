import { Button, ButtonProps } from '@mantine/core';
import { ReactNode } from 'react';

interface CustomButtonProps extends ButtonProps {
  leftIcon?: ReactNode;
}

export const CustomButton = ({ leftIcon, ...props }: CustomButtonProps) => (
  <Button {...props} leftIcon={leftIcon} />
); 