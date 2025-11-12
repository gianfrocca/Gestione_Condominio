import { useState, useEffect } from 'react';
import { Home, FileText, Settings as SettingsIcon, TrendingUp } from 'lucide-react';
import { calculationsAPI, billsAPI } from '../services/api';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentBills, setRecentBills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Ottieni l'anno corrente
      const currentYear = new Date().getFullYear();

      // Carica statistiche annuali
      const { data: annualData } = await calculationsAPI.getAnnualSummary(currentYear);
      setStats(annualData);

      // Carica bollette recenti
      const { data: billsData } = await billsAPI.getAll({ year: currentYear });
      setRecentBills(billsData.slice(0, 5));
    } catch (error) {
      console.error('Errore caricamento dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const totalCost = stats?.reduce((sum, unit) => sum + unit.total_cost, 0) || 0;
  const totalGas = stats?.reduce((sum, unit) => sum + unit.total_gas, 0) || 0;
  const totalElec = stats?.reduce((sum, unit) => sum + unit.total_elec, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Panoramica gestione condominio
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Anno corrente</p>
          <p className="text-2xl font-bold text-primary-600">{new Date().getFullYear()}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Totale Spese Anno</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                €{totalCost.toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-primary-100 rounded-full">
              <TrendingUp className="h-6 w-6 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Metano</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                €{totalGas.toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <Home className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Energia Elettrica</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                €{totalElec.toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <SettingsIcon className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Bills and Units Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Bills */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Bollette Recenti</h2>
          <div className="space-y-3">
            {recentBills.length === 0 ? (
              <p className="text-gray-500 text-sm">Nessuna bolletta registrata</p>
            ) : (
              recentBills.map((bill) => (
                <div key={bill.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-sm">
                        {bill.type === 'gas' ? 'Metano' : 'Energia Elettrica'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(bill.bill_date), 'dd MMMM yyyy', { locale: it })}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold text-gray-900">
                    €{parseFloat(bill.amount).toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Units Summary */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Riepilogo Unità</h2>
          <div className="space-y-2">
            {stats && stats.length > 0 ? (
              stats.map((unit) => (
                <div key={unit.unit_number} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                  <div>
                    <p className="font-medium text-sm">{unit.unit_number} - {unit.unit_name}</p>
                    <p className="text-xs text-gray-500">{unit.months_count} mesi</p>
                  </div>
                  <span className="font-semibold text-sm text-gray-900">
                    €{parseFloat(unit.total_cost).toFixed(2)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">Nessun dato disponibile</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
