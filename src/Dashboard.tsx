import { ArrowRight, Car, Coins, Fuel, Gauge, Plus, Route, Wrench } from 'lucide-react';
import { dueStatus, efficiency, odometer, ownership, type State, type Vehicle } from './domain';
import { Empty, LineChart, LinkButton, Metric, SectionTitle } from './ui';
import type { FormKind } from './Forms';

export const money = (amount: number, currency: string) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
export const shortDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function CarArt() {
  return (
    <svg className="car-art" viewBox="0 0 480 210" role="img" aria-label="Original sedan illustration">
      <ellipse cx="245" cy="173" rx="190" ry="12" fill="#000" opacity=".09" />
      <path
        d="M44 139 67 112 140 99 192 57Q199 51 214 51H306Q318 52 328 64L369 106 416 121Q434 125 438 143L434 159H52Z"
        fill="#dce7dc"
      />
      <path d="M154 98 197 63H242V98ZM250 63H301Q308 64 314 72L338 98H250Z" fill="#416653" />
      <path
        d="M51 139 116 132H365L434 142M242 104V152M346 104 354 151M158 104 151 150"
        fill="none"
        stroke="#93ac99"
        strokeWidth="2"
      />
      <path d="M50 131 87 123 81 139H45M405 127 429 137H405Z" fill="#f5d79a" />
      <circle cx="119" cy="153" r="29" fill="#243c31" />
      <circle cx="119" cy="153" r="16" fill="#a8b9ab" />
      <circle cx="365" cy="153" r="29" fill="#243c31" />
      <circle cx="365" cy="153" r="16" fill="#a8b9ab" />
      <circle cx="119" cy="153" r="7" fill="#647e6c" />
      <circle cx="365" cy="153" r="7" fill="#647e6c" />
      <path d="M259 111H273M171 111H184" stroke="#6f8c76" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function VehicleHero({
  vehicle,
  state,
  choose,
  open,
}: {
  vehicle: Vehicle;
  state: State;
  choose: (id: string) => void;
  open: (form: FormKind) => void;
}) {
  return (
    <section className="vehicle-hero">
      <div className="vehicle-copy">
        <span className="hero-label">
          <Car size={14} /> YOUR GARAGE
        </span>
        <select
          aria-label="Selected vehicle"
          className="vehicle-selector"
          value={vehicle.id}
          onChange={(e) => choose(e.target.value)}
        >
          {state.vehicles.map((v) => (
            <option value={v.id} key={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <p>
          {vehicle.year} {vehicle.make} {vehicle.model}
          <span className="hero-divider">/</span>
          {vehicle.trim || 'Personal vehicle'}
        </p>
        <div className="vehicle-meta">
          <div>
            <small>CURRENT ODOMETER</small>
            <strong>
              {odometer(vehicle, state.entries).toLocaleString()} <span>{vehicle.unit}</span>
            </strong>
          </div>
          <button className="hero-link" onClick={() => open({ type: 'vehicle', item: vehicle })}>
            Vehicle details <ArrowRight size={14} />
          </button>
        </div>
      </div>
      <div className="vehicle-image">
        {vehicle.photo ? <img src={vehicle.photo} alt={vehicle.name} /> : <CarArt />}
        <span className="illustration-label">{vehicle.photo ? 'Your vehicle photo' : 'Vehicle illustration'}</span>
      </div>
    </section>
  );
}

export function Dashboard({
  state,
  vehicle,
  open,
  choose,
}: {
  state: State;
  vehicle?: Vehicle;
  open: (form: FormKind) => void;
  choose: (id: string) => void;
}) {
  if (!vehicle)
    return (
      <section className="welcome-garage">
        <div>
          <span className="eyebrow">A CLEARER ROAD AHEAD</span>
          <h2>
            Every mile has a story.
            <br />
            Keep yours in one place.
          </h2>
          <p>Fuel, service, and the little things that keep you moving. Start with your first vehicle.</p>
          <button className="button primary" onClick={() => open({ type: 'vehicle' })}>
            <Plus size={16} />
            Add your first vehicle
          </button>
        </div>
        <CarArt />
      </section>
    );
  const insights = ownership(state.entries, vehicle, state.settings.currency);
  const readings = efficiency(state.entries, vehicle).slice(-7);
  const average = readings.length ? readings.reduce((sum, reading) => sum + reading.mpg, 0) / readings.length : null;
  const schedules = state.schedules
    .filter((item) => item.vehicleId === vehicle.id && !item.completed)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const records = state.entries
    .filter((entry) => entry.vehicleId === vehicle.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  return (
    <>
      <VehicleHero vehicle={vehicle} state={state} choose={choose} open={open} />
      <div className="metrics">
        <Metric
          label="Recorded ownership cost"
          value={money(insights.total, state.settings.currency)}
          icon={<Coins />}
          detail={`All recorded expenses in ${state.settings.currency}`}
        />
        <Metric
          label="Average fuel efficiency"
          value={average?.toFixed(1) ?? '—'}
          unit="MPG"
          icon={<Fuel />}
          detail={average ? `${readings.length} valid full-tank intervals` : 'Add two full fills to calculate'}
        />
        <Metric
          label="Cost per mile"
          value={insights.perMile === null ? '—' : money(insights.perMile, state.settings.currency)}
          icon={<Route />}
          detail="Across the recorded odometer span"
        />
        <Metric
          label="Upcoming services"
          value={schedules.length}
          icon={<Wrench />}
          detail={schedules.length ? 'A little care goes a long way' : 'You’re all caught up'}
        />
      </div>
      <div className="two-columns">
        <section className="panel">
          <SectionTitle
            title="A feel for your fuel"
            detail="Efficiency over your last full-fill intervals"
            action={<span className="tag">US MPG</span>}
          />
          <LineChart
            values={readings.map((x) => x.mpg)}
            labels={readings.map((x) => shortDate(x.date))}
            unit="US MPG"
          />
        </section>
        <section className="panel">
          <SectionTitle title="A little care, up ahead" action={<LinkButton to="maintenance">See all</LinkButton>} />
          {schedules.length ? (
            <div className="schedule-list">
              {schedules.slice(0, 3).map((item) => {
                const status = dueStatus(item, odometer(vehicle, state.entries));
                return (
                  <div className="schedule-item" key={item.id}>
                    <span className="schedule-icon">
                      <Wrench size={16} />
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <p>
                        {item.dueDate ? shortDate(item.dueDate) : 'Mileage reminder'}
                        {item.dueOdometer ? ` · ${item.dueOdometer.toLocaleString()} ${vehicle.unit}` : ''}
                      </p>
                      <span className={`tag ${status === 'Scheduled' ? '' : 'warning'}`}>{status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty title="Nothing on the calendar yet" text="Add a reminder so the next service doesn’t slip by." />
          )}
          <button className="add-schedule" onClick={() => open({ type: 'schedule' })}>
            <Plus size={14} />
            Add a reminder
          </button>
        </section>
      </div>
      <section className="panel">
        <SectionTitle
          title="Recently on the road"
          detail="The latest from your ownership log"
          action={<LinkButton to="activity">View activity</LinkButton>}
        />
        {records.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Date</th>
                  <th>Odometer</th>
                  <th>Cost</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <span className="cell-icon">{entry.type === 'fuel' ? <Fuel /> : <Gauge />}</span>
                      <strong>{entry.title}</strong>
                      <small>{entry.provider || entry.category}</small>
                    </td>
                    <td>{shortDate(entry.date)}</td>
                    <td>
                      {entry.odometer.toLocaleString()} <span className="muted">{vehicle.unit}</span>
                    </td>
                    <td>{money(entry.cost, entry.currency)}</td>
                    <td>
                      <span className="tag">
                        {entry.type === 'fuel' ? (entry.full ? 'Full tank' : 'Partial fill') : 'Recorded'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="A fresh page for your vehicle"
            text="Log a fill-up or service to start building your ownership history."
          />
        )}
      </section>
    </>
  );
}
