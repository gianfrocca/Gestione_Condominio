import { useState, useEffect } from 'react';
import { Save, Thermometer, Droplet, Snowflake, Edit2, Trash2, Check, X, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { readingsAPI, unitsAPI } from '../services/api';

function Readings() {
  const [activeTab, setActiveTab] = useState('cold_water');
  const [units, setUnits] = useState([]);
  const [readings, setReadings] = useState({}); // {unit_id: {value: '', date: ''}}
  const [previousReadings, setPreviousReadings] = useState({}); // {unit_id: {value, date, meter_id}}
  const [historyReadings, setHistoryReadings] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [editingReading, setEditingReading] = useState(null);
  const [selectedReadings, setSelectedReadings] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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
      console.log(`\n🔄 ========== TAB CHANGED TO: ${activeTab} ==========`);
      console.log(`🧹 Resetting ALL state for clean slate...`);

      // CRITICAL: Reset completo e immediato dello state
      // Questo previene qualsiasi contaminazione tra tab
      setPreviousReadings({});
      setReadings({});
      setHistoryReadings([]);
      setFilteredHistory([]);
      setSelectedReadings(new Set());
      setCurrentPage(1);
      setEditingReading(null);
      setDateFrom('');
      setDateTo('');

      console.log(`✅ State reset complete`);
      console.log(`⏳ Loading data for ${activeTab}...`);

      // Carica con un piccolo delay per assicurare il reset completo dello state React
      setTimeout(() => {
        loadPreviousReadings();
        loadHistoryReadings();
      }, 100);
    }
  }, [units, activeTab]);

  useEffect(() => {
    applyFilters();
  }, [historyReadings, dateFrom, dateTo]);

  const loadUnits = async () => {
    try {
      setLoading(true);
      const { data } = await unitsAPI.getAll();
      console.log(`📋 Loaded ${data.length} units`);
      setUnits(data);
    } catch (error) {
      console.error('❌ Errore caricamento unità:', error);
      alert('Errore durante il caricamento delle unità');
    } finally {
      setLoading(false);
    }
  };

  const loadPreviousReadings = async () => {
    console.log(`\n🟢 ========== LOADING PREVIOUS READINGS FOR ${activeTab} ==========`);
    console.log(`📋 Total units to process: ${units.length}`);

    try {
      const previous = {};

      for (const unit of units) {
        // Skip heating/hot_water for commercial units
        if (unit.is_commercial && (activeTab === 'heating' || activeTab === 'hot_water')) {
          console.log(`⏭️ Skip unit ${unit.number} (commercial, tipo: ${activeTab})`);
          continue;
        }

        try {
          console.log(`\n🏢 ===== Processing unit ${unit.number} (ID: ${unit.id}) for ${activeTab} =====`);

          // Get meters for this unit
          const { data: meters } = await readingsAPI.getMetersByUnit(unit.id);
          console.log(`  📊 API returned ${meters?.length || 0} meters for unit ${unit.id}`);

          if (meters && meters.length > 0) {
            console.log(`  📊 All meters for unit ${unit.id}:`, meters.map(m => ({
              id: m.id,
              type: m.type,
              unit_id: m.unit_id
            })));
          }

          // Find meter for current tab type ONLY
          console.log(`  🔎 Looking for meter with type="${activeTab}"...`);
          const meter = meters?.find(m => m.type === activeTab);

          if (meter) {
            console.log(`  ✅ Found meter:`, {
              id: meter.id,
              type: meter.type,
              unit_id: meter.unit_id,
              meter_code: meter.meter_code
            });

            // CRITICAL: Get readings filtered by this specific meter_id
            console.log(`  🔎 Fetching readings for meter_id=${meter.id}...`);
            const { data: allReadings } = await readingsAPI.getAll({ meter_id: meter.id });
            console.log(`  📚 API returned ${allReadings?.length || 0} readings`);

            if (allReadings && allReadings.length > 0) {
              // Log all readings for this meter
              console.log(`  📖 All readings for meter ${meter.id}:`);
              allReadings.forEach((r, idx) => {
                console.log(`    ${idx + 1}. Reading ID ${r.id}: date=${r.reading_date}, value=${r.value}, meter_type=${r.meter_type}`);
              });

              // Sort by date descending
              const sorted = allReadings.sort((a, b) =>
                new Date(b.reading_date) - new Date(a.reading_date)
              );

              const latestReading = sorted[0];
              console.log(`  🎯 Latest (most recent) reading:`, {
                id: latestReading.id,
                date: latestReading.reading_date,
                value: latestReading.value,
                meter_type: latestReading.meter_type,
                type: typeof latestReading.value
              });

              const parsedValue = parseFloat(latestReading.value);
              console.log(`  🔢 Parsed value: ${parsedValue} (type: ${typeof parsedValue})`);

              previous[unit.id] = {
                value: parsedValue,
                date: latestReading.reading_date,
                meter_id: meter.id
              };

              console.log(`  ✅ STORED in previous[${unit.id}]:`, previous[unit.id]);
            } else {
              console.log(`  ⚠️ No readings found for meter ${meter.id} (unit ${unit.number}, type ${activeTab})`);
            }
          } else {
            console.log(`  ⚠️ No meter of type "${activeTab}" found for unit ${unit.number} (ID: ${unit.id})`);
            if (meters && meters.length > 0) {
              console.log(`  ℹ️ Available meter types for this unit:`, meters.map(m => m.type));
            }
          }
        } catch (err) {
          console.error(`  ❌ Error loading readings for unit ${unit.id}:`, err);
        }
      }

      console.log(`\n📦 ========== FINAL previousReadings STATE ==========`);
      console.log(`Total units with previous readings: ${Object.keys(previous).length}`);
      Object.entries(previous).forEach(([unitId, data]) => {
        console.log(`  Unit ${unitId}: value=${data.value}, date=${data.date}, meter_id=${data.meter_id}`);
      });
      console.log(`========================================\n`);

      setPreviousReadings(previous);

      // Initialize new readings with today's date - ALWAYS EMPTY VALUES
      const initialReadings = {};
      units.forEach(unit => {
        if (!unit.is_commercial || activeTab === 'cold_water') {
          initialReadings[unit.id] = {
            value: '',  // CRITICAL: Always start with empty string
            date: new Date().toISOString().split('T')[0]
          };
        }
      });

      console.log(`📝 Initial readings state (all empty):`, initialReadings);
      setReadings(initialReadings);

      console.log(`✅ ========== PREVIOUS READINGS LOADED FOR ${activeTab} ==========\n`);

    } catch (error) {
      console.error('❌ Errore caricamento letture precedenti:', error);
    }
  };

  const loadHistoryReadings = async () => {
    try {
      console.log(`📚 Loading history for meter_type: ${activeTab}`);
      const { data } = await readingsAPI.getAll({ meter_type: activeTab });
      console.log(`✅ Loaded ${data?.length || 0} history readings for ${activeTab}`);
      setHistoryReadings(data || []);
    } catch (error) {
      console.error('❌ Errore caricamento storico:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...historyReadings];

    if (dateFrom) {
      filtered = filtered.filter(r => new Date(r.reading_date) >= new Date(dateFrom));
    }

    if (dateTo) {
      filtered = filtered.filter(r => new Date(r.reading_date) <= new Date(dateTo));
    }

    setFilteredHistory(filtered);
    setCurrentPage(1);
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
    const currentValue = readings[unitId]?.value;
    const previousValue = previousReadings[unitId]?.value;

    // FIX: Gestione corretta dello 0 - controlla se il valore è definito, non se è truthy
    if (currentValue === '' || currentValue === null || currentValue === undefined) {
      return null;
    }

    if (previousValue === null || previousValue === undefined) {
      return null;
    }

    const current = parseFloat(currentValue);
    const previous = parseFloat(previousValue);

    // Anche 0 è un valore valido!
    if (isNaN(current) || isNaN(previous)) {
      return null;
    }

    const consumption = current - previous;
    return consumption >= 0 ? consumption : null;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      console.log(`\n💾 ===== SAVING READINGS FOR ${activeTab} =====`);
      console.log(`📊 Current readings state:`, readings);
      console.log(`📊 Current previousReadings state:`, previousReadings);

      const readingsToSave = [];

      // CRITICAL: Itera SOLO sulle unità che hanno effettivamente un valore inserito
      for (const [unitId, reading] of Object.entries(readings)) {
        // Verifica esplicita che ci sia un valore valido
        const hasValue = reading.value !== '' && reading.value !== null && reading.value !== undefined;
        const hasDate = reading.date && reading.date !== '';

        console.log(`🔍 Unit ${unitId}: hasValue=${hasValue}, value="${reading.value}", hasDate=${hasDate}`);

        if (hasValue && hasDate) {
          const readingData = {
            unit_id: parseInt(unitId),
            meter_type: activeTab,  // CRITICAL: usa sempre il tab attivo corrente
            meter_id: previousReadings[unitId]?.meter_id || null,
            reading_date: reading.date,
            value: parseFloat(reading.value),
            notes: null
          };

          console.log(`  ✅ WILL SAVE for unit ${unitId}:`, readingData);
          readingsToSave.push(readingData);
        } else {
          console.log(`  ⏭️ SKIP unit ${unitId} - no value or no date`);
        }
      }

      if (readingsToSave.length === 0) {
        alert('Inserisci almeno una lettura');
        setSaving(false);
        return;
      }

      console.log(`\n📤 Sending ${readingsToSave.length} readings to backend for ${activeTab}:`);
      console.log(JSON.stringify(readingsToSave, null, 2));

      // NOTA: createBatch già wrappa in { readings: ... }, quindi passiamo solo l'array
      const response = await readingsAPI.createBatch(readingsToSave);
      console.log(`  ✅ Backend response:`, response.data);

      alert('Letture salvate con successo!');

      // Aspetta per assicurare che il DB sia aggiornato
      console.log(`  ⏳ Waiting for DB to update...`);
      await new Promise(resolve => setTimeout(resolve, 500));

      // CRITICAL: Ricarica SOLO i dati per il tab corrente
      console.log(`  🔄 Reloading data for ${activeTab}...`);
      await loadPreviousReadings();
      await loadHistoryReadings();

      console.log(`✅ ===== SAVE COMPLETE FOR ${activeTab} =====\n`);

    } catch (error) {
      console.error('❌ Errore salvataggio letture:', error);
      console.error('❌ Error details:', error.response?.data);
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

      // Aspetta e ricarica
      await new Promise(resolve => setTimeout(resolve, 300));
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

      // Aspetta e ricarica
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadPreviousReadings();
      await loadHistoryReadings();
    } catch (error) {
      console.error('Errore eliminazione lettura:', error);
      alert('Errore durante l\'eliminazione della lettura');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedReadings.size === 0) {
      alert('Seleziona almeno una lettura da eliminare');
      return;
    }

    if (!confirm(`Sei sicuro di voler eliminare ${selectedReadings.size} letture selezionate?`)) return;

    try {
      for (const id of selectedReadings) {
        await readingsAPI.delete(id);
      }
      alert(`${selectedReadings.size} letture eliminate con successo!`);
      setSelectedReadings(new Set());

      await new Promise(resolve => setTimeout(resolve, 300));
      await loadPreviousReadings();
      await loadHistoryReadings();
    } catch (error) {
      console.error('Errore eliminazione letture:', error);
      alert('Errore durante l\'eliminazione delle letture');
    }
  };

  const handleDeleteAll = async () => {
    if (historyReadings.length === 0) {
      alert('Nessuna lettura da eliminare');
      return;
    }

    if (!confirm(`⚠️ ATTENZIONE! Stai per eliminare TUTTE le ${historyReadings.length} letture di ${currentTabConfig?.name}.\n\nQuesta azione è IRREVERSIBILE!\n\nSei assolutamente sicuro?`)) return;

    try {
      for (const reading of historyReadings) {
        await readingsAPI.delete(reading.id);
      }
      alert('Tutte le letture sono state eliminate!');
      setSelectedReadings(new Set());

      await new Promise(resolve => setTimeout(resolve, 300));
      await loadPreviousReadings();
      await loadHistoryReadings();
    } catch (error) {
      console.error('Errore eliminazione letture:', error);
      alert('Errore durante l\'eliminazione delle letture');
    }
  };

  const toggleSelectReading = (id) => {
    const newSelected = new Set(selectedReadings);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedReadings(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedReadings.size === paginatedHistory.length) {
      setSelectedReadings(new Set());
    } else {
      setSelectedReadings(new Set(paginatedHistory.map(r => r.id)));
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const getUnitsForTab = () => {
    return units.filter(unit => {
      if (activeTab === 'cold_water') return true;
      return !unit.is_commercial;
    });
  };

  const currentTabConfig = tabs.find(t => t.id === activeTab);

  // Pagination
  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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
                      {prevReading !== undefined && prevReading !== null ?
                        (typeof prevReading.value === 'number' ? prevReading.value.toFixed(2) : prevReading.value)
                        : '-'
                      }
                    </td>
                    <td className="text-gray-600">
                      {prevReading ? formatDate(prevReading.date) : '-'}
                    </td>
                    <td>
                      {consumption !== null ? (
                        <span className={`font-semibold ${consumption > 0 ? 'text-green-600' : consumption === 0 ? 'text-gray-600' : 'text-gray-400'}`}>
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <History className="h-6 w-6 mr-2 text-gray-600" />
            <h2 className="text-xl font-semibold">Storico Letture - {currentTabConfig?.name}</h2>
            <span className="ml-3 text-sm text-gray-500">({filteredHistory.length} letture)</span>
          </div>

          <div className="flex space-x-2">
            {selectedReadings.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="btn-secondary text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-1 inline" />
                Elimina Selezionate ({selectedReadings.size})
              </button>
            )}
            {historyReadings.length > 0 && (
              <button
                onClick={handleDeleteAll}
                className="btn-secondary text-red-700 hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4 mr-1 inline" />
                Cancella Tutto
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Da:
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input input-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data A:
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input input-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="btn-secondary w-full"
            >
              Rimuovi Filtri
            </button>
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nessuna lettura registrata</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedReadings.size === paginatedHistory.length && paginatedHistory.length > 0}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                    </th>
                    <th>Data</th>
                    <th>Unità</th>
                    <th>Inquilino</th>
                    <th>Valore</th>
                    <th>Note</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedHistory.map((reading) => (
                    editingReading?.id === reading.id ? (
                      <tr key={reading.id} className="bg-yellow-50">
                        <td></td>
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
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedReadings.has(reading.id)}
                            onChange={() => toggleSelectReading(reading.id)}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                        </td>
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-gray-600">
                  Pagina {currentPage} di {totalPages} - Mostrate {paginatedHistory.length} di {filteredHistory.length} letture
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {[...Array(totalPages)].map((_, idx) => (
                    <button
                      key={idx + 1}
                      onClick={() => setCurrentPage(idx + 1)}
                      className={`px-3 py-1 rounded ${
                        currentPage === idx + 1
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Info box */}
      <div className="card bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Informazioni & Debug</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Ogni tipo di contatore (Acqua Fredda/Calda/Riscaldamento) ha il proprio <strong>storico separato</strong></li>
          <li>• Il <strong>Consumo</strong> viene calcolato automaticamente (anche se la lettura precedente è 0)</li>
          <li>• La <strong>Lettura Precedente</strong> è l'ultima lettura registrata per questa unità e questo tipo</li>
          <li>• <strong>Debug:</strong> Apri la Console Browser (F12) per vedere log dettagliati del caricamento letture</li>
          <li>• Usa i <strong>filtri per periodo</strong> per cercare letture in un range di date specifico</li>
          <li>• Seleziona multiple letture con i checkbox per <strong>eliminarle in blocco</strong></li>
        </ul>
      </div>
    </div>
  );
}

export default Readings;
