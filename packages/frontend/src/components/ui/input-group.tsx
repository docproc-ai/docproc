import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { buttonVariants } from './button'

// Input Group Context
type InputGroupContextValue = {
  disabled?: boolean
}

const InputGroupContext = React.createContext<InputGroupContextValue>({})

function useInputGroupContext() {
  return React.useContext(InputGroupContext)
}

// Input Group
interface InputGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  disabled?: boolean
}

function InputGroup({
  className,
  disabled,
  children,
  ...props
}: InputGroupProps) {
  return (
    <InputGroupContext.Provider value={{ disabled }}>
      <div
        data-slot="input-group"
        data-disabled={disabled}
        className={cn(
          'flex items-center rounded-lg border border-input bg-background shadow-sm shadow-black/5',
          'focus-within:ring-2 focus-within:ring-ring/20 focus-within:border-ring',
          'data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </InputGroupContext.Provider>
  )
}

// Input Group Input
interface InputGroupInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  asChild?: boolean
}

function InputGroupInput({
  className,
  disabled,
  asChild,
  ...props
}: InputGroupInputProps) {
  const context = useInputGroupContext()
  const Comp = asChild ? Slot : 'input'

  return (
    <Comp
      data-slot="input-group-input"
      disabled={context.disabled || disabled}
      className={cn(
        'flex-1 min-w-0 bg-transparent px-3 py-2 text-sm',
        'placeholder:text-muted-foreground',
        'focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

// Input Group Addon
const inputGroupAddonVariants = cva(
  'flex items-center justify-center text-sm text-muted-foreground px-3',
  {
    variants: {
      align: {
        'inline-start': 'border-r border-input',
        'inline-end': 'border-l border-input',
      },
    },
    defaultVariants: {
      align: 'inline-start',
    },
  },
)

interface InputGroupAddonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof inputGroupAddonVariants> {
  asChild?: boolean
}

function InputGroupAddon({
  className,
  align,
  children,
  asChild,
  ...props
}: InputGroupAddonProps) {
  const Comp = asChild ? Slot : 'div'

  return (
    <Comp
      data-slot="input-group-addon"
      className={cn(inputGroupAddonVariants({ align }), className)}
      {...props}
    >
      {children}
    </Comp>
  )
}

// Input Group Button
interface InputGroupButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

function InputGroupButton({
  className,
  variant = 'ghost',
  size = 'icon',
  asChild,
  disabled,
  ...props
}: InputGroupButtonProps) {
  const context = useInputGroupContext()
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="input-group-button"
      disabled={context.disabled || disabled}
      className={cn(
        buttonVariants({ variant, size }),
        'rounded-none border-0 shadow-none',
        'first:rounded-l-lg last:rounded-r-lg',
        className,
      )}
      {...props}
    />
  )
}

export {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
  useInputGroupContext,
}
