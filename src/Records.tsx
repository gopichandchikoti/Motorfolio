import { useState } from 'react';
import { Check, Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { dueStatus, odometer, type Entry, type State } from './domain';
import { Empty, SectionTitle } from './ui';
import { money, shortDate } from './Dashboard';
import { download, downloadAttachment } from './storage';
import { exportCsv } from './transfer';
import type { FormKind } from './Forms';

export function Records({
  state,
  trip,
  open,
  remove,
}: {
  state: State;
  trip: boolean;
  open: (form: FormKind) => void;
  remove: (entry: Entry) => void;
}) {
  const [search, setSearch] = useState('');
  const [vehicle, setVehicle] = useState('all');
  const [category, setCategory] = useState('all');
  const [expenseCategory, setExpenseCategory] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const records = state.entries
    .filter(
      (entry) =>
        (!trip || entry.type === 'trip') &&
        (vehicle === 'all' || entry.vehicleId === vehicle) &&
        (category === 'all' || entry.type === category) &&
        (expenseCategory === 'all' || entry.category === expenseCategory) &&
        (!from || entry.date >= from) &&
        (!to || entry.date <= to) &&
        `${entry.title} ${entry.provider} ${entry.category} ${entry.notes}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="panel">
      <div className="toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            aria-label="Search activity"
            placeholder="Search your records…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select aria-label="Filter vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
          <option value="all">All vehicles</option>
          {state.vehicles.map((v) => (
            <option value={v.id} key={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        {!trip && (
          <select aria-label="Filter type" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All types</option>
            {['fuel', 'service', 'expense', 'trip'].map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        )}
        <button
          className="button secondary"
          onClick={() => download('Motorfolio-activity.csv', exportCsv(records), 'text/csv')}
        >
          <Download size={15} />
          Export results
        </button>
      </div>
      <div className="toolbar date-filter">
        {!trip && (
          <select
            aria-label="Filter category"
            value={expenseCategory}
            onChange={(event) => setExpenseCategory(event.target.value)}
          >
            <option value="all">All categories</option>
            {[...new Set(state.entries.map((entry) => entry.category))].sort().map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        )}
        <label>
          From
          <input aria-label="From date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input aria-label="To date" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <span className="subtle">{records.length} matching records</span>
      </div>
      {records.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Vehicle / date</th>
                <th>Odometer</th>
                <th>{trip ? 'Trip distance' : 'Amount'}</th>
                <th>Details</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((entry) => {
                const v = state.vehicles.find((item) => item.id === entry.vehicleId);
                const quantity = entry.liters / (state.settings.volume === 'gal' ? 3.785411784 : 1);
                return (
                  <tr key={entry.id}>
                    <td>
                      <strong>{entry.title}</strong>
                      <small>
                        {entry.category} · {entry.provider || 'No provider'}
                      </small>
                      {entry.corrected && <span className="tag warning">Odometer corrected</span>}
                    </td>
                    <td>
                      {v?.name}
                      <small>{entry.date}</small>
                    </td>
                    <td>
                      {entry.odometer.toLocaleString()} {v?.unit}
                    </td>
                    <td>
                      {trip
                        ? `${(entry.odometer - (entry.startOdometer ?? entry.odometer)).toLocaleString()} ${v?.unit}`
                        : money(entry.cost, entry.currency)}
                    </td>
                    <td>
                      {entry.type === 'fuel' ? (
                        <>
                          <span className="tag">{entry.full ? 'Full tank' : 'Partial'}</span>
                          <small>
                            {quantity.toFixed(2)} {state.settings.volume} · {money(entry.cost / quantity, entry.currency)}/{state.settings.volume}
                          </small>
                        </>
                      ) : (
                        entry.type
                      )}
                      {entry.receipt && (
                        <button
                          className="text-link receipt-link"
                          onClick={() => {
                            if (entry.receipt) downloadAttachment(entry.receiptName ?? 'receipt', entry.receipt);
                          }}
                        >
                          Download receipt
                        </button>
                      )}
                    </td>
                    <td>
                      <div className="row">
                        <button
                          className="icon-button"
                          aria-label={`Edit ${entry.title}`}
                          onClick={() => open({ type: 'entry', item: entry })}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="icon-button danger"
                          aria-label={`Delete ${entry.title}`}
                          onClick={() => remove(entry)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No records here yet" text="Add an activity or adjust the filters to find what you need." />
      )}
    </section>
  );
}

export function Maintenance({
  state,
  open,
  save,
  remove,
}: {
  state: State;
  open: (form: FormKind) => void;
  save: (state: State) => void;
  remove: (id: string) => void;
}) {
  return (
    <section className="panel">
      <SectionTitle
        title="Your maintenance calendar"
        detail="Date or mileage, whichever comes first. Intervals are chosen by you."
      />
      {state.schedules.length ? (
        <div className="maintenance-list">
          {[...state.schedules]
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
            .map((item) => {
              const vehicle = state.vehicles.find((v) => v.id === item.vehicleId);
              const status = dueStatus(item, vehicle ? odometer(vehicle, state.entries) : 0);
              return (
                <div className="maintenance-row" key={item.id}>
                  <div>
                    <span className={`tag ${['Overdue', 'Due soon'].includes(status) ? 'warning' : ''}`}>{status}</span>
                    <h3>{item.title}</h3>
                    <p>
                      {vehicle?.name} ·{' '}
                      {item.dueDate ? `${shortDate(item.dueDate)} ${item.dueDate.slice(0, 4)}` : 'Mileage reminder'}
                      {item.dueOdometer ? ` or ${item.dueOdometer.toLocaleString()} ${vehicle?.unit}` : ''}
                    </p>
                    <small>
                      Lead time: {item.leadDays} days / {item.leadDistance} {vehicle?.unit}
                    </small>
                  </div>
                  <div className="actions">
                    <button
                      className="button secondary"
                      onClick={() =>
                        save({
                          ...state,
                          schedules: state.schedules.map((s) =>
                            s.id === item.id ? { ...s, completed: !s.completed } : s,
                          ),
                        })
                      }
                    >
                      <Check size={14} />
                      {item.completed ? 'Reopen' : 'Complete'}
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Edit ${item.title}`}
                      onClick={() => open({ type: 'schedule', item })}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-button danger"
                      aria-label={`Delete reminder ${item.title}`}
                      onClick={() => remove(item.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        <Empty
          title="Make room for the road ahead"
          text="Set a date and mileage reminder for the next thing your vehicle needs."
        >
          <button className="button primary" onClick={() => open({ type: 'schedule' })}>
            <Plus size={16} />
            Add reminder
          </button>
        </Empty>
      )}
    </section>
  );
}
