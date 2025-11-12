import { useState, useEffect } from 'react';
import { Plus, Save } from 'lucide-react';
import { readingsAPI, unitsAPI } from '../services/api';
import { format } from 'date-fns';

function Readings() {
  const [units, setUnits] = useState([]);
  const [readings, setReadings] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUnits();
  }, []);

  useEffect(() => {
    if (units.length > 0) {
      initializeReadings();
    }
  }, [units, selectedMonth]);

  const loadUnits = async () => {
    try {
      const { data } = await unitsAPI.getAll();
      setUnits(data);
    } catch (error) {
      console.error('Errore caricamento unità:', error);
      alert('Errore durante il caricamento delle unità');
    }
  };

  const initializeReadings = () => {
    const newReadings = [];

    units.forEach(unit => {
      if (!unit.is_commercial) {
        newReadings.push(
          { unit_id: unit.id, unit_name: `${unit.number} - ${unit.name}`, type: 'heating', value: '' },
          { unit_id: unit.id, unit_name: `${unit.number} - ${unit.name}`, type: 'hot_water', value: '' }
        );
      }
      newReadings.push({
        unit_id: unit.id,
        unit_name: `${unit.number} - ${unit.name}`,
        type: 'cold_water',
        value: ''
      });
    });

    setReadings(newReadings);
  };

  const handleValueChange = (index, value) => {
    const updated = [...readings];
    updated[index].value = value;
    setReadings(updated);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const readingsToSave = readings
        .filter(r => r.value !== '')
        .map(r => ({
          meter_id: r.meter_id || null, // TODO: gestire meter_id
          reading_date: `${selectedMonth}-01`,
          value: parseFloat(r.value),
          notes: `${r.type} - ${r.unit_name}`
        }));

      if (readingsToSave.length === 0) {
        alert('Inserisci almeno una lettura');
        return;
      }

      await readingsAPI.createBatch(readingsToSave);
      alert('Letture salvate con successo!');
      initializeReadings(); // Reset form
    } catch (error) {
      console.error('Errore salvataggio letture:', error);
      alert('Errore durante il salvataggio delle letture');
    } finally {
      setSaving(false);
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'heating': return 'Riscaldamento';
      case 'hot_water': return 'Acqua Calda';
      case 'cold_water': return 'Acqua Fredda';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Letture Contabilizzatori</h1>
          <p className="mt-1 text-sm text-gray-600">
            Inserisci le letture mensili per ogni unità
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center space-x-2"
        >
          <Save className="h-5 w-5" />
          <span>{saving ? 'Salvataggio...' : 'Salva Letture'}</span>
        </button>
      </div>

      {/* Month Selector */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Mese di riferimento
        </label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="input max-w-xs"
        />
      </div>

      {/* Readings Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Unità</th>
                <th>Tipo</th>
                <th>Lettura</th>
                <th>Unità Misura</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {readings.map((reading, index) => (
                <tr key={index}>
                  <td className="font-medium">{reading.unit_name}</td>
                  <td>{getTypeLabel(reading.type)}</td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={reading.value}
                      onChange={(e) => handleValueChange(index, e.target.value)}
                      className="input max-w-xs"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="text-gray-500">
                    {reading.type === 'heating' ? 'kWh' : 'm³'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Readings;
