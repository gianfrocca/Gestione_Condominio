import { useState, useEffect } from 'react';
import { Save, Thermometer, Droplet, Snowflake, Edit2, Trash2, Check, X, History } from 'lucide-react';
import { readingsAPI, unitsAPI } from '../services/api';

function Readings() {
  const [activeTab, setActiveTab] = useState('cold_water');
  const [units, setUnits] = useState([]);
  const [readings, setReadings] = useState({}); // {unit_id: {value: '', date: ''}}
  const [previousReadings, setPreviousReadings] = useState({}); // {unit_id: {value, date}}
  const [historyReadings, setHistoryReadings] = useState([]); // All readings for current tab
  const [editingReading, setEditingReading] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const tabs = [
    { id: 'cold_water', name: 'Acqua Fredda', icon: Droplet, color: 'blue' },
    { id: 'hot_water', name: 'Acqua Calda', icon: Thermometer, color: 'red' },
    { id: 'heating', name: 'Riscaldamento/Raffrescamento', icon: Snowflake, color: 'purple' },
  ];

  useEffect(() => {
    loadUnits();
  }, []);

  useEffect(() => {
    if (units.length > 0) {
      loadPreviousReadings();
      loadHistoryReadings();
    }
  }, [units, activeTab]);

  const loadUnits = async () => {
    try {
      setLoading(true);
      const { data } = await unitsAPI.getAll();
      setUnits(data);
    } catch (error) {
      console.error('Errore caricamento unità:', error);
      alert('Errore durante il caricamento delle unità');
    } finally {
      setLoading(false);
    }
  };

  const loadPreviousReadings = async () => {
    try {
      const previous = {};

      for (const unit of units) {
        // Skip heating/hot_water for commercial units
        if (unit.is_commercial && (activeTab === 'heating' || activeTab === 'hot_water')) {
          continue;
        }

        try {
          const { data: meters } = await readingsAPI.getMetersByUnit(unit.id);
          const meter = meters?.find(m => m.type === activeTab);

          if (meter) {
            // Get all readings for this meter
            const { data: allReadings } = await readingsAPI.getAll({ meter_id: meter.id });

            if (allReadings && allReadings.length > 0) {
              // Sort by date descending and get the latest
              const sorted = allReadings.sort((a, b) =>
                new Date(b.reading_date) - new Date(a.reading_date)
              );

              previous[unit.id] = {
                value: sorted[0].value,
                date: sorted[0].reading_date,
                meter_id: meter.id
              };
            }
          }
        } catch (err) {
          console.error(`Error loading readings for unit ${unit.id}:`, err);
        }
      }

      setPreviousReadings(previous);

      // Initialize readings with today's date
      const initialReadings = {};
      units.forEach(unit => {
        if (!unit.is_commercial || activeTab === 'cold_water') {
          initialReadings[unit.id] = {
            value: '',
            date: new Date().toISOString().split('T')[0]
          };
        }
      });
      setReadings(initialReadings);

    } catch (error) {
      console.error('Errore caricamento letture precedenti:', error);
    }
  };

  const loadHistoryReadings = async () => {
    try {
      const { data } = await readingsAPI.getAll({ meter_type: activeTab });
      setHistoryReadings(data || []);
    } catch (error) {
      console.error('Errore caricamento storico:', error);
    }
  };

  const handleReadingChange = (unitId, field, value) => {
    setReadings(prev => ({
      ...prev,
      [unitId]: {
        ...prev[unitId],
        [field]: value
      }
    }));
  };

  const calculateConsumption = (unitId) => {
    const current = parseFloat(readings[unitId]?.value || 0);
    const previous = parseFloat(previousReadings[unitId]?.value || 0);

    if (!current || !previous) return null;

    const consumption = current - previous;
    return consumption >= 0 ? consumption : null;
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const readingsToSave = [];

      for (const [unitId, reading] of Object.entries(readings)) {
        if (reading.value && reading.date) {
          // Prepara la lettura con unit_id e meter_type
          // Il backend creerà automaticamente il meter se non esiste
          readingsToSave.push({
            unit_id: parseInt(unitId),
            meter_type: activeTab,
            meter_id: previousReadings[unitId]?.meter_id || null,
            reading_date: reading.date,
            value: parseFloat(reading.value),
            notes: null
          });
        }
      }

      if (readingsToSave.length === 0) {
        alert('Inserisci almeno una lettura');
        return;
      }

      await readingsAPI.createBatch(readingsToSave);
      alert('Letture salvate con successo!');

      // Reload data
      await loadPreviousReadings();
      await loadHistoryReadings();

    } catch (error) {
      console.error('Errore salvataggio letture:', error);
      alert('Errore durante il salvataggio delle letture: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleEditReading = (reading) => {
    setEditingReading({ ...reading });
  };

  const handleUpdateReading = async () => {
    try {
      await readingsAPI.update(editingReading.id, {
        reading_date: editingReading.reading_date,
        value: editingReading.value,
        notes: editingReading.notes
      });
      alert('Lettura aggiornata con successo!');
      setEditingReading(null);
      await loadPreviousReadings();
      await loadHistoryReadings();
    } catch (error) {
      console.error('Errore aggiornamento lettura:', error);
      alert('Errore durante l\'aggiornamento della lettura');
    }
  };

  const handleDeleteReading = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questa lettura?')) return;

    try {
      await readingsAPI.delete(id);
      alert('Lettura eliminata con successo!');
      await loadPreviousReadings();
      await loadHistoryReadings();
    } catch (error) {
      console.error('Errore eliminazione lettura:', error);
      alert('Errore durante l\'eliminazione della lettura');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const getUnitsForTab = () => {
    return units.filter(unit => {
      if (activeTab === 'cold_water') return true;
      return !unit.is_commercial; // Heating and hot_water only for residential
    });
  };

  const currentTabConfig = tabs.find(t => t.id === activeTab);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Letture Contabilizzatori</h1>
          <p className="mt-1 text-sm text-gray-600">
            Inserisci le letture dei contabilizzatori per tipo
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

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === tab.id
                    ? `border-${tab.color}-500 text-${tab.color}-600`
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="h-5 w-5 mr-2" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Readings Table */}
      <div className="card">
        <div className="flex items-center mb-4">
          {currentTabConfig && <currentTabConfig.icon className={`h-6 w-6 mr-2 text-${currentTabConfig.color}-600`} />}
          <h2 className="text-xl font-semibold">Inserimento Nuove Letture</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Unità</th>
                <th>Inquilino</th>
                <th>Data Lettura</th>
                <th>Valore Attuale</th>
                <th>Lettura Precedente</th>
                <th>Data Precedente</th>
                <th>Consumo</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getUnitsForTab().map((unit) => {
                const consumption = calculateConsumption(unit.id);
                const prevReading = previousReadings[unit.id];

                return (
                  <tr key={unit.id}>
                    <td className="font-medium">{unit.number}</td>
                    <td>{unit.name}</td>
                    <td>
                      <input
                        type="date"
                        value={readings[unit.id]?.date || ''}
                        onChange={(e) => handleReadingChange(unit.id, 'date', e.target.value)}
                        className="input input-sm"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={readings[unit.id]?.value || ''}
                        onChange={(e) => handleReadingChange(unit.id, 'value', e.target.value)}
                        placeholder="Inserisci valore"
                        className="input input-sm w-32"
                      />
                    </td>
                    <td className="text-gray-600 font-medium">
                      {prevReading ? prevReading.value.toFixed(2) : '-'}
                    </td>
                    <td className="text-gray-600">
                      {prevReading ? formatDate(prevReading.date) : '-'}
                    </td>
                    <td>
                      {consumption !== null ? (
                        <span className={`font-semibold ${consumption > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {consumption.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {getUnitsForTab().length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>Nessuna unità disponibile per questo tipo di lettura</p>
          </div>
        )}
      </div>

      {/* History Section */}
      <div className="card">
        <div className="flex items-center mb-4">
          <History className="h-6 w-6 mr-2 text-gray-600" />
          <h2 className="text-xl font-semibold">Storico Letture - {currentTabConfig?.name}</h2>
        </div>

        {historyReadings.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nessuna lettura registrata</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Unità</th>
                  <th>Inquilino</th>
                  <th>Valore</th>
                  <th>Note</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {historyReadings.map((reading) => (
                  editingReading?.id === reading.id ? (
                    <tr key={reading.id} className="bg-yellow-50">
                      <td>
                        <input
                          type="date"
                          value={editingReading.reading_date}
                          onChange={(e) => setEditingReading({ ...editingReading, reading_date: e.target.value })}
                          className="input input-sm"
                        />
                      </td>
                      <td>{reading.unit_number}</td>
                      <td>{reading.unit_name}</td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={editingReading.value}
                          onChange={(e) => setEditingReading({ ...editingReading, value: e.target.value })}
                          className="input input-sm w-32"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editingReading.notes || ''}
                          onChange={(e) => setEditingReading({ ...editingReading, notes: e.target.value })}
                          className="input input-sm"
                          placeholder="Note"
                        />
                      </td>
                      <td>
                        <div className="flex space-x-2">
                          <button
                            onClick={handleUpdateReading}
                            className="text-green-600 hover:text-green-900"
                            title="Salva"
                          >
                            <Check className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => setEditingReading(null)}
                            className="text-red-600 hover:text-red-900"
                            title="Annulla"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={reading.id}>
                      <td className="font-medium">{formatDate(reading.reading_date)}</td>
                      <td>{reading.unit_number}</td>
                      <td>{reading.unit_name}</td>
                      <td className="font-semibold">{parseFloat(reading.value).toFixed(2)}</td>
                      <td className="text-sm text-gray-600">{reading.notes || '-'}</td>
                      <td>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditReading(reading)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Modifica"
                          >
                            <Edit2 className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteReading(reading.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Elimina"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="card bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Informazioni</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Il <strong>Consumo</strong> viene calcolato automaticamente sottraendo la lettura precedente dal valore attuale</li>
          <li>• La <strong>Lettura Precedente</strong> è l'ultima lettura registrata per questa unità</li>
          <li>• Inserisci la <strong>Data Lettura</strong> e il <strong>Valore Attuale</strong> rilevato dal contabilizzatore</li>
          <li>• Le unità commerciali hanno solo letture per Acqua Fredda</li>
          <li>• Nello <strong>Storico</strong> puoi visualizzare, modificare ed eliminare le letture precedenti</li>
        </ul>
      </div>
    </div>
  );
}

export default Readings;
