import {
  cloneElement,
  isValidElement,
  useId,
  type ReactNode,
  type FormEvent,
} from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Play, Inbox } from 'lucide-react';
export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="product-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Panel({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
export function Empty({
  title = '아직 표시할 내용이 없어요',
  description = '새로운 이야기를 시작해 보세요.',
  children,
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="product-empty">
      <Inbox size={32} strokeWidth={1.2} />
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      {children}
    </div>
  );
}
export function Button({
  children,
  onClick,
  disabled,
  variant = '',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`p-button ${variant}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
export function ActionLink({
  to,
  children,
  secondary = false,
}: {
  to: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link className={`p-button ${secondary ? 'secondary' : ''}`} to={to}>
      {children}
      <ArrowUpRight size={16} />
    </Link>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  const control = isValidElement<{ id?: string; 'aria-describedby'?: string }>(
    children,
  )
    ? cloneElement(children, {
        id,
        ...(hint ? { 'aria-describedby': `${id}-hint` } : {}),
      })
    : children;
  return (
    <div className="p-field">
      <label htmlFor={id}>{label}</label>
      {control}
      {hint && (
        <small id={`${id}-hint`} className="muted">
          {hint}
        </small>
      )}
    </div>
  );
}
export function Form({
  children,
  onSubmit,
  className = '',
}: {
  children: ReactNode;
  onSubmit: (data: FormData) => void;
  className?: string;
}) {
  return (
    <form
      className={`p-form ${className}`}
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      {children}
    </form>
  );
}
export function Tag({
  children,
  tone = '',
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`p-tag ${tone}`}>{children}</span>;
}
export function Artwork({
  index,
  title,
  play = false,
}: {
  index: number;
  title?: string;
  play?: boolean;
}) {
  return (
    <div className={`artwork artwork-${index % 4}`}>
      <div className="art-grain" />
      <div className="art-shape shape-one" />
      <div className="art-shape shape-two" />
      <div className="art-shape shape-three" />
      <span className="art-label">
        {
          [
            'MOMENTS OF LIGHT',
            'THE SMALL THINGS',
            'A DIFFERENT PERSPECTIVE',
            'NATURALLY, YOURS',
          ][index % 4]
        }
      </span>
      {title && <strong>{title}</strong>}
      {play && (
        <span className="play-circle">
          <Play size={18} fill="currentColor" />
        </span>
      )}
      <span className="art-foot">KEMI STUDIO — SAMPLE FILM</span>
    </div>
  );
}
export function FileName({
  name = 'attachment',
  label = '첨부 파일 (시연: 파일명만 기록)',
}: {
  name?: string;
  label?: string;
}) {
  return (
    <Field label={label}>
      <input type="file" name={name} />
    </Field>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return <p className="notice">{children}</p>;
}
