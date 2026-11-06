import { monthlyCosts, type State } from './domain';
import { LineChart, SectionTitle } from './ui';
import { money } from './Dashboard';

export function Reports({ state }: { state: State }) {
  const monthly = monthlyCosts(state.entries, state.settings.currency).slice(-12);
  const categories = [
    'Fuel',
    'Oil',
    'Tires',
    'Brakes',
    'Battery',
    'Fluids',
    'Inspection',
    'Insurance',
    'Warranty',
    'Trip',
    'Custom',
  ];
  return (
    <div className="two-columns">
      <section className="panel">
        <SectionTitle
          title="Monthly ownership costs"
          detail={`Calendar months · recorded expenses in ${state.settings.currency} only`}
        />
        <LineChart
          values={monthly.map(([, n]) => n)}
          labels={monthly.map(([month]) => month)}
          unit={state.settings.currency}
        />
      </section>
      <section className="panel">
        <SectionTitle title="Where it goes" detail="All recorded dates, grouped by category" />
        <div className="split-list">
          {categories.map((category) => {
            const total = state.entries
              .filter((entry) => entry.category === category && entry.currency === state.settings.currency)
              .reduce((sum, entry) => sum + entry.cost, 0);
            return total ? (
              <div key={category}>
                <span>{category}</span>
                <strong>{money(total, state.settings.currency)}</strong>
              </div>
            ) : null;
          })}
        </div>
        <p className="subtle">
          Missing months are omitted. No cost, distance, depreciation, or exchange rates are estimated.
        </p>
      </section>
    </div>
  );
}
