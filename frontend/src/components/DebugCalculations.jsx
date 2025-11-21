import { useState } from 'react';
import { Bug, Search, CheckCircle, XCircle, AlertCircle, Play } from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';

function DebugCalculations() {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [dateFrom, setDateFrom] = useState(format(firstDayOfMonth, 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(lastDayOfMonth, 'yyyy-MM-dd'));
  const [calculationType, setCalculationType] = useState('both');
  const [loading, setLoading] = useState(false);
  const [debugData, setDebugData] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [runningTests, setRunningTests] = useState(false);

  const handleDebug = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:3000/api/calculations/debug`, {
        params: { dateFrom, dateTo, type: calculationType },
        headers: { Authorization: `Bearer ${token}` }
      });
      setDebugData(response.data);
    } catch (error) {
      console.error('Errore debug:', error);
      alert('Errore durante il debug: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleRunTests = async () => {
    try {
      setRunningTests(true);
      setTestResults(null);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:3000/api/calculations/debug/run-tests`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTestResults(response.data);
    } catch (error) {
      console.error('Errore esecuzione test:', error);
      setTestResults({
        success: false,
        error: error.response?.data?.error || error.message,
        output: error.response?.data?.output || ''
      });
    } finally {
      setRunningTests(false);
    }
  };

  const renderPercentageInfo = (category) => {
    const hasRedistribution = category.original_pct !== category.adjusted_pct;
    return (
      <div className={`p-3 rounded ${category.has_consumption ? 'bg-green-50' : 'bg-gray-50'}`}>
        <div className="font-medium">{category.original_pct.toFixed(1)}%</div>
        {hasRedistribution && (
          <div className="text-sm text-blue-600 font-semibold">
            → {category.adjusted_pct.toFixed(1)}%
          </div>
        )}
        <div className="text-xs text-gray-600 mt-1">
          Consumo: {category.total_consumption.toFixed(0)}
        </div>
        <div className="text-xs font-semibold mt-1">
          €{category.cost.toFixed(2)}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Bug className="w-8 h-8 text-orange-600" />
          <h1 className="text-3xl font-bold">Debug Calcoli</h1>
        </div>
        <p className="text-gray-600">
          Analisi dettagliata dei calcoli di ripartizione per verificare la correttezza della logica
        </p>
      </div>

      {/* Form di input */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Parametri Debug</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Data Inizio</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Data Fine</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Tipo</label>
            <select
              value={calculationType}
              onChange={(e) => setCalculationType(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="both">Entrambi</option>
              <option value="gas">Solo Gas</option>
              <option value="electricity">Solo Elettricità</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleDebug}
              disabled={loading}
              className="w-full bg-orange-600 text-white py-2 rounded hover:bg-orange-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              {loading ? (
                'Caricamento...'
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Analizza
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Test Logica Calcoli */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Test Logica Calcoli</h2>
            <p className="text-sm text-gray-600 mt-1">
              Esegui test automatici per verificare la correttezza della logica di ripartizione
            </p>
          </div>
          <button
            onClick={handleRunTests}
            disabled={runningTests}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
          >
            {runningTests ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Esecuzione...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Esegui Test
              </>
            )}
          </button>
        </div>

        {/* Risultati test */}
        {testResults && (
          <div className={`mt-4 p-4 rounded border-l-4 ${testResults.success ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
            <div className="flex items-start gap-3 mb-3">
              {testResults.success ? (
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-semibold text-lg">
                  {testResults.message || (testResults.success ? 'Test completati con successo!' : 'Errore durante i test')}
                </div>
                {testResults.error && (
                  <div className="text-sm text-red-700 mt-1">
                    {testResults.error}
                  </div>
                )}
              </div>
            </div>

            {/* Output dei test */}
            {testResults.output && (
              <div className="mt-3">
                <div className="text-xs font-semibold text-gray-700 mb-2">Output Test:</div>
                <div className="bg-gray-900 text-gray-100 p-4 rounded text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap">{testResults.output}</pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Risultati debug */}
      {debugData && (
        <div className="space-y-6">
          {/* Info Periodo */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Informazioni Periodo</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-600">Da</div>
                <div className="font-semibold">{debugData.period.from}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">A</div>
                <div className="font-semibold">{debugData.period.to}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Numero Mesi</div>
                <div className="font-semibold text-blue-600">{debugData.period.numMonths}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Stagione</div>
                <div className="font-semibold">
                  {debugData.period.season === 'summer' ? '☀️ Estate' : '❄️ Inverno'}
                </div>
              </div>
            </div>
          </div>

          {/* Verifica Totali */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Verifica Totali</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded">
                <div className="text-sm text-gray-600">Totale da Calcolo</div>
                <div className="text-2xl font-bold">€{debugData.verification.total_from_calculation.toFixed(2)}</div>
              </div>
              <div className="p-4 bg-green-50 rounded">
                <div className="text-sm text-gray-600">Totale da Bollette</div>
                <div className="text-2xl font-bold">€{debugData.verification.total_from_bills.toFixed(2)}</div>
              </div>
              <div className={`p-4 rounded ${debugData.verification.matches ? 'bg-green-100' : 'bg-red-100'}`}>
                <div className="text-sm text-gray-600">Differenza</div>
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold">€{debugData.verification.difference.toFixed(2)}</div>
                  {debugData.verification.matches ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Debug GAS */}
          {debugData.gasCalculation && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">🔥 Debug Calcoli GAS</h2>

              {/* Totale e Detrazioni */}
              <div className="mb-6 p-4 bg-gray-50 rounded">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Totale Bollette</div>
                    <div className="font-bold text-lg">€{debugData.gasCalculation.total.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Parti Comuni</div>
                    <div className="font-semibold text-red-600">-€{debugData.gasCalculation.common_areas_cost.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Rimanente</div>
                    <div className="font-bold text-lg">€{debugData.gasCalculation.remaining_after_common.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Bollette nel Periodo</div>
                    <div className="font-semibold">{debugData.bills.gas.count}</div>
                  </div>
                </div>
              </div>

              {/* Involontaria */}
              <div className="mb-6">
                <h3 className="font-semibold text-lg mb-3">Quota Involontaria</h3>
                <div className="p-4 bg-yellow-50 rounded border-l-4 border-yellow-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xl">{debugData.gasCalculation.involuntary.percentage.toFixed(1)}%</div>
                      <div className="text-sm text-gray-600 mt-1">{debugData.gasCalculation.involuntary.note}</div>
                    </div>
                    <div className="text-2xl font-bold text-yellow-700">
                      €{debugData.gasCalculation.involuntary.cost.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Volontaria */}
              <div className="mb-6">
                <h3 className="font-semibold text-lg mb-3">Quote Volontarie</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-600 mb-2">🔥 Riscaldamento</div>
                    {renderPercentageInfo(debugData.gasCalculation.voluntary.categories.heating)}
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-2">🚿 ACS (Acqua Calda)</div>
                    {renderPercentageInfo(debugData.gasCalculation.voluntary.categories.hot_water)}
                  </div>
                </div>

                {/* Redistribuzione */}
                {debugData.gasCalculation.voluntary.redistribution.active && (
                  <div className="p-4 bg-blue-50 rounded border-l-4 border-blue-500">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <div className="font-semibold text-blue-900">Redistribuzione Attiva</div>
                        <div className="text-sm mt-1">{debugData.gasCalculation.voluntary.redistribution.note}</div>
                        <div className="text-sm mt-2">
                          <span className="font-semibold">Categorie a zero: </span>
                          {debugData.gasCalculation.voluntary.redistribution.zero_consumption_categories.join(', ')}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Verifica Percentuali */}
              <div className={`p-4 rounded ${debugData.gasCalculation.verification.should_be_100 ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Verifica Somma Percentuali</div>
                    <div className="text-sm text-gray-600">La somma deve essere 100%</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold">
                      {debugData.gasCalculation.verification.sum_percentages.toFixed(1)}%
                    </div>
                    {debugData.gasCalculation.verification.should_be_100 ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-600" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Debug ELETTRICITÀ */}
          {debugData.electricityCalculation && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">⚡ Debug Calcoli ELETTRICITÀ</h2>

              {/* Totale e Detrazioni */}
              <div className="mb-6 p-4 bg-gray-50 rounded">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Totale Bollette</div>
                    <div className="font-bold text-lg">€{debugData.electricityCalculation.total.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Parti Comuni</div>
                    <div className="font-semibold text-red-600">-€{debugData.electricityCalculation.common_areas_cost.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Luci Scale</div>
                    <div className="font-semibold text-red-600">-€{debugData.electricityCalculation.staircase_lights.total_cost.toFixed(2)}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {debugData.electricityCalculation.staircase_lights.num_units} unità × €{debugData.electricityCalculation.staircase_lights.per_unit_total.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Forfait Commerciali</div>
                    <div className="font-semibold text-red-600">-€{debugData.electricityCalculation.commercial_water_forfait.total_cost.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Rimanente</div>
                    <div className="font-bold text-lg">€{debugData.electricityCalculation.remaining_after_deductions.toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {/* Involontaria */}
              <div className="mb-6">
                <h3 className="font-semibold text-lg mb-3">Quota Involontaria</h3>
                <div className="p-4 bg-yellow-50 rounded border-l-4 border-yellow-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xl">{debugData.electricityCalculation.involuntary.percentage.toFixed(1)}%</div>
                      <div className="text-sm text-gray-600 mt-1">{debugData.electricityCalculation.involuntary.note}</div>
                    </div>
                    <div className="text-2xl font-bold text-yellow-700">
                      €{debugData.electricityCalculation.involuntary.cost.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Volontaria */}
              <div className="mb-6">
                <h3 className="font-semibold text-lg mb-3">Quote Volontarie</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-600 mb-2">🔥 Riscaldamento</div>
                    {renderPercentageInfo(debugData.electricityCalculation.voluntary.categories.heating)}
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-2">❄️ Raffrescamento</div>
                    {renderPercentageInfo(debugData.electricityCalculation.voluntary.categories.cooling)}
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-2">🚿 ACS</div>
                    {renderPercentageInfo(debugData.electricityCalculation.voluntary.categories.hot_water)}
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-2">💧 ACF</div>
                    {renderPercentageInfo(debugData.electricityCalculation.voluntary.categories.cold_water)}
                  </div>
                </div>

                {/* Redistribuzione */}
                {debugData.electricityCalculation.voluntary.redistribution.active && (
                  <div className="p-4 bg-blue-50 rounded border-l-4 border-blue-500">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <div className="font-semibold text-blue-900">Redistribuzione Attiva</div>
                        <div className="text-sm mt-1">{debugData.electricityCalculation.voluntary.redistribution.note}</div>
                        <div className="text-sm mt-2">
                          <span className="font-semibold">Categorie a zero: </span>
                          {debugData.electricityCalculation.voluntary.redistribution.zero_consumption_categories.join(', ')}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Verifica Percentuali */}
              <div className={`p-4 rounded ${debugData.electricityCalculation.verification.should_be_100 ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Verifica Somma Percentuali</div>
                    <div className="text-sm text-gray-600">La somma deve essere 100%</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold">
                      {debugData.electricityCalculation.verification.sum_percentages.toFixed(1)}%
                    </div>
                    {debugData.electricityCalculation.verification.should_be_100 ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-600" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabella Unità */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Dettaglio per Unità</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unità</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Superficie</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Abitato</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Commerciale</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Totale</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {debugData.units.map((unit, idx) => (
                    <tr key={idx} className={!unit.is_inhabited ? 'bg-gray-50' : ''}>
                      <td className="px-4 py-3 text-sm font-medium">{unit.unit_number}</td>
                      <td className="px-4 py-3 text-sm">{unit.unit_name}</td>
                      <td className="px-4 py-3 text-sm text-right">{unit.surface_area} m²</td>
                      <td className="px-4 py-3 text-sm text-center">
                        {unit.is_inhabited ? '✓' : '✗'}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        {unit.is_commercial ? '✓' : '✗'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">
                        €{unit.costs.total.toFixed(2)}
                      </td>
                    </tr>
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

export default DebugCalculations;
