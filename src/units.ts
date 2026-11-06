import type { State, Vehicle } from './domain';

export function convertVehicleUnits(state: State, vehicleId: string, unit: Vehicle['unit']): State {
  const vehicle = state.vehicles.find((item) => item.id === vehicleId);
  if (!vehicle) throw new Error('Vehicle is missing. Reload before converting units.');
  if (vehicle.unit === unit) return state;
  const factor = unit === 'km' ? 1.609344 : 1 / 1.609344;
  return {
    ...state,
    vehicles: state.vehicles.map((item) =>
      item.id === vehicleId ? { ...item, unit, odometer: item.odometer * factor } : item,
    ),
    entries: state.entries.map((item) =>
      item.vehicleId === vehicleId
        ? {
            ...item,
            odometer: item.odometer * factor,
            startOdometer: item.startOdometer === undefined ? undefined : item.startOdometer * factor,
          }
        : item,
    ),
    schedules: state.schedules.map((item) =>
      item.vehicleId === vehicleId
        ? { ...item, dueOdometer: item.dueOdometer * factor, leadDistance: item.leadDistance * factor }
        : item,
    ),
    warranties: state.warranties.map((item) =>
      item.vehicleId === vehicleId
        ? {
            ...item,
            expiresOdometer: item.expiresOdometer * factor,
            leadDistance: item.leadDistance * factor,
            updatedAt: new Date().toISOString(),
          }
        : item,
    ),
  };
}
