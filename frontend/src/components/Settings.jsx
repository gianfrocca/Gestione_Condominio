import { useState, useEffect } from 'react';
import { Save, Settings as SettingsIcon } from 'lucide-react';
import { settingsAPI, unitsAPI } from '../services/api';

function Settings() {
  const [settings, setSettings] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const handleUnitChange = async (id, field, value) => {
    try {
      const unit = units.find(u => u.id === id);
      await unitsAPI.update(id, { ...unit, [field]: value });
      setUnits(units.map(u => u.id === id ? { ...u, [field]: value } : u));
    } catch (error) {
      console.error('Errore aggiornamento unità:', error);
      alert('Errore durante l\'aggiornamento dell\'unità');
    }
  };

  const getSetting = (key) => {
    return settings.find(s => s.key === key);
  };

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
            Configura parametri di calcolo e unità
          </p>
        </div>
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="btn-primary flex items-center space-x-2"
        >
          <Save className="h-5 w-5" />
          <span>{saving ? 'Salvataggio...' : 'Salva Impostazioni'}</span>
        </button>
      </div>

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
        <div className="space-y-6">
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

          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">Stagionalità</h3>
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

          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">Percentuali Estate</h3>
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
                  Acqua Calda (%)
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

          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">Percentuali Inverno</h3>
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
                  Acqua Calda (%)
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

          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">Costi Fissi</h3>
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
      </div>

      {/* Units Configuration */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Configurazione Unità</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Numero</th>
                <th>Nome</th>
                <th>Superficie (mq)</th>
                <th>Abitato</th>
                <th>Commerciale</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {units.map((unit) => (
                <tr key={unit.id}>
                  <td className="font-medium">{unit.number}</td>
                  <td>{unit.name}</td>
                  <td>{unit.surface_area}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={unit.is_inhabited}
                      onChange={(e) => handleUnitChange(unit.id, 'is_inhabited', e.target.checked)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                  </td>
                  <td>
                    <span className={`badge ${unit.is_commercial ? 'badge-blue' : 'badge-gray'}`}>
                      {unit.is_commercial ? 'Sì' : 'No'}
                    </span>
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

export default Settings;
