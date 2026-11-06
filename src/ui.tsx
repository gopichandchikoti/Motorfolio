import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { ArrowUpRight, Check, ChevronRight, CircleHelp, LockKeyhole, Moon, Sun, X } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  count?: number;
}
interface ShellProps {
  name: string;
  subtitle: string;
  logo: ReactNode;
  items: NavItem[];
  page: string;
  theme: string;
  onTheme: () => void;
  children: ReactNode;
  footer: ReactNode;
}
export function Shell(props: ShellProps) {
  const [exportError, setExportError] = useState('');
  useEffect(() => {
    const handler = (event: Event) => {
      if (event instanceof CustomEvent) setExportError(String(event.detail));
    };
    window.addEventListener('export-error', handler);
    return () => window.removeEventListener('export-error', handler);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = props.theme;
  }, [props.theme]);
  return (
    <div className="app-shell">
      <a
        href="#content"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('content')?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <a className="brand" href={`#${props.items[0].id}`}>
          <span className="brand-mark">{props.logo}</span>
          <span>
            {props.name}
            <small>{props.subtitle}</small>
          </span>
        </a>
        <span className="nav-caption">YOUR WORKSPACE</span>
        <nav aria-label="Main navigation">
          {props.items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={props.page === item.id ? 'active' : ''}
              aria-current={props.page === item.id ? 'page' : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.count ? <b>{item.count}</b> : null}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <LockKeyhole size={17} />
            <div>
              <strong>Yours. And only yours.</strong>
              <p>Local storage. No account. No tracking.</p>
            </div>
          </div>
          <button className="theme-button" onClick={props.onTheme}>
            {props.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            {props.theme === 'dark' ? 'Light appearance' : 'Dark appearance'}
            <span aria-hidden="true">↗</span>
          </button>
          <div className="sidebar-version">
            {props.name} <span>v1.0.0</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <strong>{props.items.find((item) => item.id === props.page)?.label ?? 'Overview'}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-label">
              <span className="status-dot" /> Local-first
            </span>
            <a href="#settings" aria-label="Help and settings" className="icon-button">
              <CircleHelp size={19} />
            </a>
            <span className="avatar">ME</span>
          </div>
        </header>
        <main id="content" tabIndex={-1}>
          {exportError && (
            <div className="notice error" role="alert">
              {exportError}
              <button className="icon-button" aria-label="Dismiss export error" onClick={() => setExportError('')}>
                ×
              </button>
            </div>
          )}
          {props.children}
        </main>
        <footer>
          {props.footer}
          <span>Made for the everyday.</span>
        </footer>
      </div>
    </div>
  );
}

export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-action">{action}</div>
    </div>
  );
}

export function Modal({
  title,
  children,
  close,
  submit,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  submit?: (event: FormEvent<HTMLFormElement>) => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={close} aria-labelledby="modal-title">
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-button" onClick={close} aria-label="Close dialog">
          <X size={20} />
        </button>
      </div>
      {submit ? (
        <form onSubmit={submit}>
          <div className="form-grid">{children}</div>
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={close}>
              Cancel
            </button>
            <button className="button primary" disabled={busy} type="submit">
              <Check size={17} />
              {busy ? 'Saving…' : 'Save record'}
            </button>
          </div>
        </form>
      ) : (
        <div className="modal-body">{children}</div>
      )}
    </dialog>
  );
}

export function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  const id = useId();
  const nodes = Children.toArray(children);
  const hint = nodes.some((child) => isValidElement(child) && child.type === 'small');
  return (
    <div className={wide ? 'field wide' : 'field'}>
      <label htmlFor={id}>{label}</label>
      {nodes.map((child) => {
        if (!isValidElement<{ id?: string; 'aria-describedby'?: string }>(child)) return child;
        if (child.type === 'small') return cloneElement(child, { id: `${id}-hint` });
        if (['input', 'select', 'textarea'].includes(String(child.type)))
          return cloneElement(child, { id, 'aria-describedby': hint ? `${id}-hint` : undefined });
        return child;
      })}
    </div>
  );
}

export function Empty({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-symbol">↗</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}

export function Metric({
  label,
  value,
  unit,
  detail,
  icon,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="metric">
      <div className="metric-label">
        {label}
        {icon}
      </div>
      <div className="metric-value">
        {value}
        <span>{unit}</span>
      </div>
      <p>{detail}</p>
    </div>
  );
}

export function SectionTitle({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {action}
    </div>
  );
}

export function LinkButton({ to, children }: { to: string; children: ReactNode }) {
  return (
    <a className="text-link" href={`#${to}`}>
      {children}
      <ArrowUpRight size={15} />
    </a>
  );
}

export function LineChart({
  values,
  labels,
  unit,
  color = 'var(--accent)',
}: {
  values: (number | null)[];
  labels: string[];
  unit: string;
  color?: string;
}) {
  const valid = values.filter((n): n is number => n !== null);
  if (!valid.length)
    return (
      <Empty
        title="A little more data, a clearer picture."
        text="Your chart will appear when valid measurements are available."
      />
    );
  const high = Math.max(...valid, 1) * 1.15;
  const points = values.map((value, index) =>
    value === null ? null : `${35 + (index * 600) / Math.max(1, values.length - 1)},${160 - (value / high) * 130}`,
  );
  const segments: string[][] = [[]];
  points.forEach((point) => {
    if (point) segments[segments.length - 1].push(point);
    else segments.push([]);
  });
  return (
    <div className="chart">
      <svg
        viewBox="0 0 675 190"
        role="img"
        aria-label={values.map((v, i) => `${labels[i]}: ${v === null ? 'missing' : v.toFixed(1)} ${unit}`).join('; ')}
      >
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line x1="35" x2="650" y1={30 + i * 43} y2={30 + i * 43} stroke="var(--line)" strokeDasharray="3 5" />
            <text x="0" y={34 + i * 43}>
              {((high * (3 - i)) / 3).toFixed(0)}
            </text>
          </g>
        ))}
        {segments
          .filter((s) => s.length)
          .map((s, i) => (
            <polyline
              key={i}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={s.join(' ')}
            />
          ))}
        {points.map(
          (p, i) =>
            p && (
              <circle
                key={i}
                cx={p.split(',')[0]}
                cy={p.split(',')[1]}
                r="4"
                fill={color}
                stroke="var(--panel)"
                strokeWidth="2"
              />
            ),
        )}
        {labels.map((label, i) => (
          <text textAnchor="middle" key={`${label}-${i}`} x={35 + (i * 600) / Math.max(1, values.length - 1)} y="185">
            {label}
          </text>
        ))}
      </svg>
      <span className="chart-unit">{unit} · actual recorded values · gaps mean unavailable</span>
    </div>
  );
}
