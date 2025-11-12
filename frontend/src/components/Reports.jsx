import { useState } from 'react';
import { FileDown, Calculator } from 'lucide-react';
import { calculationsAPI, reportsAPI } from '../services/api';
import { format } from 'date-fns';

function Reports() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [calculating, setCalculating] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [calculationResult, setCalculationResult] = useState(null);

  const handleCalculate = async () => {
    try {
      setCalculating(true);
      const { data } = await calculationsAPI.calculate(selectedMonth);
      setCalculationResult(data);
      alert('Calcolo completato con successo!');
    } catch (error) {
      console.error('Errore calcolo:', error);
      alert('Errore durante il calcolo: ' + (error.response?.data?.error || error.message));
    } finally {
      setCalculating(false);
    }
  };

  const handleGenerateMonthlyPDF = async () => {
    try {
      setGeneratingPDF(true);
      const response = await reportsAPI.generateMonthly(selectedMonth);

      // Download del PDF
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report-${selectedMonth}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      alert('Report PDF generato con successo!');
    } catch (error) {
      console.error('Errore generazione PDF:', error);
      alert('Errore durante la generazione del PDF');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleGenerateAnnualPDF = async () => {
    try {
      setGeneratingPDF(true);
      const response = await reportsAPI.generateAnnual(selectedYear);

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report-annuale-${selectedYear}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      alert('Report annuale PDF generato con successo!');
    } catch (error) {
      console.error('Errore generazione PDF annuale:', error);
      alert('Errore durante la generazione del PDF annuale');
    } finally {
      setGeneratingPDF(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Report e Calcoli</h1>
        <p className="mt-1 text-sm text-gray-600">
          Genera report PDF e calcola ripartizioni spese
        </p>
      </div>

      {/* Monthly Report */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Report Mensile</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleziona Mese
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input max-w-xs"
            />
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleCalculate}
              disabled={calculating}
              className="btn-primary flex items-center space-x-2"
            >
              <Calculator className="h-5 w-5" />
              <span>{calculating ? 'Calcolando...' : 'Calcola Ripartizione'}</span>
            </button>

            <button
              onClick={handleGenerateMonthlyPDF}
              disabled={generatingPDF}
              className="btn-secondary flex items-center space-x-2"
            >
              <FileDown className="h-5 w-5" />
              <span>{generatingPDF ? 'Generando...' : 'Genera PDF'}</span>
            </button>
          </div>
        </div>

        {/* Calculation Results */}
        {calculationResult && (
          <div className="mt-6 border-t pt-6">
            <h3 className="font-semibold mb-4">Risultati Calcolo</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-600 font-medium">Totale Metano</p>
                <p className="text-2xl font-bold text-blue-900">
                  €{calculationResult.total_gas_cost.toFixed(2)}
                </p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-yellow-600 font-medium">Totale Energia</p>
                <p className="text-2xl font-bold text-yellow-900">
                  €{calculationResult.total_elec_cost.toFixed(2)}
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-600 font-medium">Totale Complessivo</p>
                <p className="text-2xl font-bold text-green-900">
                  €{calculationResult.total_cost.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Unità</th>
                    <th>Gas</th>
                    <th>Energia</th>
                    <th>Totale</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {calculationResult.units.map((unit) => (
                    <tr key={unit.unit_id}>
                      <td className="font-medium">
                        {unit.unit_number} - {unit.unit_name}
                      </td>
                      <td>
                        €{(unit.costs.gas_heating + unit.costs.gas_hot_water).toFixed(2)}
                      </td>
                      <td>
                        €{(unit.costs.elec_fixed + unit.costs.elec_heating +
                           unit.costs.elec_cooling + unit.costs.elec_hot_water +
                           unit.costs.elec_cold_water).toFixed(2)}
                      </td>
                      <td className="font-bold text-primary-600">
                        €{unit.costs.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Annual Report */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Report Annuale</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleziona Anno
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="input max-w-xs"
            >
              {[...Array(5)].map((_, i) => {
                const year = new Date().getFullYear() - i;
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </select>
          </div>

          <button
            onClick={handleGenerateAnnualPDF}
            disabled={generatingPDF}
            className="btn-primary flex items-center space-x-2"
          >
            <FileDown className="h-5 w-5" />
            <span>{generatingPDF ? 'Generando...' : 'Genera Report Annuale PDF'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Reports;
