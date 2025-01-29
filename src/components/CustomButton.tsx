import { Button, ButtonProps } from '@mantine/core';
import { forwardRef, ComponentPropsWithoutRef } from 'react';

type CustomButtonProps = ComponentPropsWithoutRef<'button'> & ButtonProps;

export const CustomButton = forwardRef<HTMLButtonElement, CustomButtonProps>((props, ref) => (
  <Button ref={ref} {...props} />
)); 