import styled from '@emotion/styled'
import type { ButtonHTMLAttributes } from 'react'
import { colors, radius, spacing, typography } from '../tokens'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

export const Button = ({ children, ...props }: ButtonProps) => {
  return <ButtonRoot {...props}>{children}</ButtonRoot>
}

const ButtonRoot = styled.button`
  border: 0;
  border-radius: ${radius.md};
  padding: ${spacing.sm} ${spacing.lg};
  font-size: ${typography.body};
  font-weight: 600;
  color: ${colors.onPrimary};
  background: ${colors.primary};
  cursor: pointer;

  &:hover {
    background: ${colors.primaryHover};
  }
`
