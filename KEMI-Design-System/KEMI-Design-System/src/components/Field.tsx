import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "./cx";

export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

export interface FieldProps {
  label: string;
  hint?: string;
  /** 무슨 일이 있었는지 + 할 수 있는 일. 있으면 hint 대신 표시 */
  error?: string;
  children: (control: FieldControlProps) => ReactNode;
  className?: string;
}

export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const message = error ?? hint;
  return (
    <div className={cx("field", className)}>
      <label className="field__label" htmlFor={id}>{label}</label>
      {children({ id, "aria-describedby": message ? hintId : undefined, "aria-invalid": error ? true : undefined })}
      {message && <span id={hintId} className={cx("field__hint", error && "field__hint--error")}>{message}</span>}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx("input", className)} {...rest} />;
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx("select", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx("textarea", className)} {...rest} />;
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
}

export function Checkbox({ label, className, ...rest }: CheckboxProps) {
  return (
    <label className={cx("check", className)}>
      <input type="checkbox" {...rest} />
      {label}
    </label>
  );
}
