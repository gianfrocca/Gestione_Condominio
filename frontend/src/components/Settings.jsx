import { useState, useEffect } from 'react';
import { Save, Settings as SettingsIcon, Building2, Calendar, Sliders, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { settingsAPI, unitsAPI } from '../services/api';

function Settings() {
  const [activeTab, setActiveTab] = useState('parametri');
  const [settings, setSettings] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [newUnit, setNewUnit] = useState(null);

  useEffect(() => {
    loadSettings();
    loadUnits();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data } = await settingsAPI.getAll();
      setSettings(data);
    } catch (error) {
      console.error('Errore caricamento impostazioni:', error);
      alert('Errore durante il caricamento delle impostazioni');
    } finally {
      setLoading(false);
    }
  };

  const loadUnits = async () => {
    try {
      const { data } = await unitsAPI.getAll();
      setUnits(data);
    } catch (error) {
      console.error('Errore caricamento unità:', error);
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings(settings.map(s => s.key === key ? { ...s, value } : s));
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      await settingsAPI.updateMultiple(settings);
      alert('Impostazioni salvate con successo!');
    } catch (error) {
      console.error('Errore salvataggio impostazioni:', error);
      alert('Errore durante il salvataggio delle impostazioni');
    } finally {
      setSaving(false);
    }
  };

  const getSetting = (key) => {
    return settings.find(s => s.key === key);
  };

  // Unit management functions
  const handleEditUnit = (unit) => {
    setEditingUnit({ ...unit });
  };

  const handleCancelEdit = () => {
    setEditingUnit(null);
  };

  const handleSaveUnit = async () => {
    try {
      await unitsAPI.update(editingUnit.id, editingUnit);
      setUnits(units.map(u => u.id === editingUnit.id ? editingUnit : u));
      setEditingUnit(null);
      alert('Unità aggiornata con successo!');
    } catch (error) {
      console.error('Errore aggiornamento unità:', error);
      alert('Errore durante l\'aggiornamento dell\'unità');
    }
  };

  const handleDeleteUnit = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questa unità? Questa azione eliminerà anche tutte le letture e i dati associati.')) {
      return;
    }

    try {
      await unitsAPI.delete(id);
      setUnits(units.filter(u => u.id !== id));
      alert('Unità eliminata con successo!');
    } catch (error) {
      console.error('Errore eliminazione unità:', error);
      alert('Errore durante l\'eliminazione dell\'unità');
    }
  };

  const handleAddUnit = () => {
    setNewUnit({
      number: '',
      name: '',
      surface_area: '',
      is_inhabited: true,
      is_commercial: false,
      foglio: '',
      particella: '',
      sub: '',
      notes: ''
    });
  };

  const handleCancelAdd = () => {
    setNewUnit(null);
  };

  const handleSaveNewUnit = async () => {
    try {
      if (!newUnit.number || !newUnit.name || !newUnit.surface_area) {
        alert('Nome, Inquilino e Superficie sono obbligatori');
        return;
      }

      const { data } = await unitsAPI.create(newUnit);
      setUnits([...units, data]);
      setNewUnit(null);
      alert('Unità creata con successo!');
      loadUnits(); // Reload to get complete data
    } catch (error) {
      console.error('Errore creazione unità:', error);
      alert('Errore durante la creazione dell\'unità');
    }
  };

  const tabs = [
    { id: 'parametri', name: 'Parametri Consumi', icon: Sliders },
    { id: 'stagionalita', name: 'Stagionalità', icon: Calendar },
    { id: 'unita', name: 'Unità Immobiliari', icon: Building2 },
  ];

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
          <h1 className="text-3xl font-bold text-gray-900">Impostazioni</h1>
          <p className="mt-1 text-sm text-gray-600">
            Configura parametri di calcolo, stagionalità e unità immobiliari
          </p>
        </div>
        {activeTab !== 'unita' && (
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="btn-primary flex items-center space-x-2"
          >
            <Save className="h-5 w-5" />
            <span>{saving ? 'Salvataggio...' : 'Salva Impostazioni'}</span>
          </button>
        )}
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
                    ? 'border-primary-500 text-primary-600'
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

      {/* Tab Content */}
      {activeTab === 'parametri' && (
        <div className="space-y-6">
          {/* Gas Settings */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <SettingsIcon className="h-5 w-5 mr-2" />
              Parametri Metano
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quota Involontaria (%)
                </label>
                <input
                  type="number"
                  value={getSetting('gas_involuntary_pct')?.value || ''}
                  onChange={(e) => handleSettingChange('gas_involuntary_pct', e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quota Volontaria (%)
                </label>
                <input
                  type="number"
                  value={getSetting('gas_voluntary_pct')?.value || ''}
                  onChange={(e) => handleSettingChange('gas_voluntary_pct', e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Electricity Settings */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Parametri Energia Elettrica</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quota Involontaria (%)
                </label>
                <input
                  type="number"
                  value={getSetting('elec_involuntary_pct')?.value || ''}
                  onChange={(e) => handleSettingChange('elec_involuntary_pct', e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quota Volontaria (%)
                </label>
                <input
                  type="number"
                  value={getSetting('elec_voluntary_pct')?.value || ''}
                  onChange={(e) => handleSettingChange('elec_voluntary_pct', e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Fixed Costs */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Costi Fissi</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Luci Scale (€/mese)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={getSetting('staircase_lights_cost')?.value || ''}
                  onChange={(e) => handleSettingChange('staircase_lights_cost', e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quota Fissa Commerciale Acqua (€/mese)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={getSetting('commercial_water_fixed')?.value || ''}
                  onChange={(e) => handleSettingChange('commercial_water_fixed', e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'stagionalita' && (
        <div className="space-y-6">
          {/* Summer/Winter Periods */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Periodi Stagionali</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mese Inizio Estate (1-12)
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={getSetting('summer_start_month')?.value || ''}
                  onChange={(e) => handleSettingChange('summer_start_month', e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mese Fine Estate (1-12)
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={getSetting('summer_end_month')?.value || ''}
                  onChange={(e) => handleSettingChange('summer_end_month', e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Summer Percentages */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Percentuali Estate</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Raffrescamento (%)
                </label>
                <input
                  type="number"
                  value={getSetting('summer_cooling_pct')?.value || ''}
                  onChange={(e) => handleSettingChange('summer_cooling_pct', e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Acqua Calda Sanitaria (%)
                </label>
                <input
                  type="number"
                  value={getSetting('summer_hot_water_pct')?.value || ''}
                  onChange={(e) => handleSettingChange('summer_hot_water_pct', e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Acqua Fredda (%)
                </label>
                <input
                  type="number"
                  value={getSetting('summer_cold_water_pct')?.value || ''}
                  onChange={(e) => handleSettingChange('summer_cold_water_pct', e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Winter Percentages */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Percentuali Inverno</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Riscaldamento (%)
                </label>
                <input
                  type="number"
                  value={getSetting('winter_heating_pct')?.value || ''}
                  onChange={(e) => handleSettingChange('winter_heating_pct', e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Acqua Calda Sanitaria (%)
                </label>
                <input
                  type="number"
                  value={getSetting('winter_hot_water_pct')?.value || ''}
                  onChange={(e) => handleSettingChange('winter_hot_water_pct', e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Acqua Fredda (%)
                </label>
                <input
                  type="number"
                  value={getSetting('winter_cold_water_pct')?.value || ''}
                  onChange={(e) => handleSettingChange('winter_cold_water_pct', e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'unita' && (
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Gestione Unità Immobiliari</h2>
              <button
                onClick={handleAddUnit}
                className="btn-primary flex items-center space-x-2"
                disabled={newUnit !== null}
              >
                <Plus className="h-5 w-5" />
                <span>Aggiungi Unità</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Inquilino</th>
                    <th>Superficie (mq)</th>
                    <th>Commerciale</th>
                    <th>Foglio</th>
                    <th>Particella</th>
                    <th>Sub</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {newUnit && (
                    <tr className="bg-blue-50">
                      <td>
                        <input
                          type="text"
                          value={newUnit.number}
                          onChange={(e) => setNewUnit({ ...newUnit, number: e.target.value })}
                          placeholder="Es: Apt. 1"
                          className="input input-sm"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={newUnit.name}
                          onChange={(e) => setNewUnit({ ...newUnit, name: e.target.value })}
                          placeholder="Nome inquilino"
                          className="input input-sm"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={newUnit.surface_area}
                          onChange={(e) => setNewUnit({ ...newUnit, surface_area: e.target.value })}
                          placeholder="mq"
                          className="input input-sm w-24"
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={newUnit.is_commercial}
                          onChange={(e) => setNewUnit({ ...newUnit, is_commercial: e.target.checked })}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={newUnit.foglio}
                          onChange={(e) => setNewUnit({ ...newUnit, foglio: e.target.value })}
                          placeholder="Foglio"
                          className="input input-sm w-20"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={newUnit.particella}
                          onChange={(e) => setNewUnit({ ...newUnit, particella: e.target.value })}
                          placeholder="Part."
                          className="input input-sm w-20"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={newUnit.sub}
                          onChange={(e) => setNewUnit({ ...newUnit, sub: e.target.value })}
                          placeholder="Sub"
                          className="input input-sm w-20"
                        />
                      </td>
                      <td>
                        <div className="flex space-x-2">
                          <button
                            onClick={handleSaveNewUnit}
                            className="text-green-600 hover:text-green-900"
                            title="Salva"
                          >
                            <Check className="h-5 w-5" />
                          </button>
                          <button
                            onClick={handleCancelAdd}
                            className="text-red-600 hover:text-red-900"
                            title="Annulla"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {units.map((unit) => (
                    editingUnit?.id === unit.id ? (
                      <tr key={unit.id} className="bg-yellow-50">
                        <td>
                          <input
                            type="text"
                            value={editingUnit.number}
                            onChange={(e) => setEditingUnit({ ...editingUnit, number: e.target.value })}
                            className="input input-sm"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={editingUnit.name}
                            onChange={(e) => setEditingUnit({ ...editingUnit, name: e.target.value })}
                            className="input input-sm"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            value={editingUnit.surface_area}
                            onChange={(e) => setEditingUnit({ ...editingUnit, surface_area: e.target.value })}
                            className="input input-sm w-24"
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={editingUnit.is_commercial}
                            onChange={(e) => setEditingUnit({ ...editingUnit, is_commercial: e.target.checked })}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={editingUnit.foglio || ''}
                            onChange={(e) => setEditingUnit({ ...editingUnit, foglio: e.target.value })}
                            className="input input-sm w-20"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={editingUnit.particella || ''}
                            onChange={(e) => setEditingUnit({ ...editingUnit, particella: e.target.value })}
                            className="input input-sm w-20"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={editingUnit.sub || ''}
                            onChange={(e) => setEditingUnit({ ...editingUnit, sub: e.target.value })}
                            className="input input-sm w-20"
                          />
                        </td>
                        <td>
                          <div className="flex space-x-2">
                            <button
                              onClick={handleSaveUnit}
                              className="text-green-600 hover:text-green-900"
                              title="Salva"
                            >
                              <Check className="h-5 w-5" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="text-red-600 hover:text-red-900"
                              title="Annulla"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={unit.id}>
                        <td className="font-medium">{unit.number}</td>
                        <td>{unit.name}</td>
                        <td>{unit.surface_area}</td>
                        <td>
                          <span className={`badge ${unit.is_commercial ? 'badge-blue' : 'badge-gray'}`}>
                            {unit.is_commercial ? 'Sì' : 'No'}
                          </span>
                        </td>
                        <td className="text-gray-600">{unit.foglio || '-'}</td>
                        <td className="text-gray-600">{unit.particella || '-'}</td>
                        <td className="text-gray-600">{unit.sub || '-'}</td>
                        <td>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEditUnit(unit)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Modifica"
                            >
                              <Edit2 className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteUnit(unit.id)}
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
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
