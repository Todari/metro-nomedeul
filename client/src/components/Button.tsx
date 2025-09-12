import { css } from "../../styled-system/css";

type ButtonVariant = 'primary' | 'secondary' | 'destructive';
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = 'primary', ...props }: ButtonProps) {
  return <button className={css({
    px: 4,
    py: 2.5,
    rounded: 'xl',
    fontWeight: 'bold',
    fontSize: 'md',
    bg: variant === 'primary' ? 'orange.600' : variant === 'secondary' ? 'neutral.600' : 'red.600',
    color: 'white',
    _hover: {
      bg: variant === 'primary' ? 'orange.700' : variant === 'secondary' ? 'neutral.700' : 'red.700',
    },
    _active: {
      bg: variant === 'primary' ? 'orange.800' : variant === 'secondary' ? 'neutral.800' : 'red.800',
    },
  })} {...props} />;
}