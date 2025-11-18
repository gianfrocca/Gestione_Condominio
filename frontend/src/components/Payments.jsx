import { useState, useEffect } from 'react';
import { DollarSign, Plus, Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { paymentsAPI, unitsAPI } from '../services/api';

function Payments() {
  const [payments, setPayments] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPayment, setNewPayment] = useState({
    unit_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_type: 'bonifico',
    reference_month: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadPayments(),
        loadSummaries(),
        loadUnits()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async () => {
    try {
      const { data } = await paymentsAPI.getAll();
      setPayments(data);
    } catch (error) {
      console.error('Errore caricamento pagamenti:', error);
    }
  };

  const loadSummaries = async () => {
    try {
      const { data } = await paymentsAPI.getSummaryAll();
      setSummaries(data);
    } catch (error) {
      console.error('Errore caricamento riepilogo:', error);
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

  const handleAddPayment = async () => {
    try {
      if (!newPayment.unit_id || !newPayment.amount || !newPayment.payment_date) {
        alert('Unità, importo e data sono obbligatori');
        return;
      }

      await paymentsAPI.create(newPayment);
      setShowAddForm(false);
      setNewPayment({
        unit_id: '',
        payment_date: new Date().toISOString().split('T')[0],
        amount: '',
        payment_type: 'bonifico',
        reference_month: '',
        notes: ''
      });
      await loadData();
      alert('Pagamento registrato con successo!');
    } catch (error) {
      console.error('Errore creazione pagamento:', error);
      alert('Errore durante la registrazione del pagamento');
    }
  };

  const handleDeletePayment = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questo pagamento?')) {
      return;
    }

    try {
      await paymentsAPI.delete(id);
      await loadData();
      alert('Pagamento eliminato con successo!');
    } catch (error) {
      console.error('Errore eliminazione pagamento:', error);
      alert('Errore durante l\'eliminazione del pagamento');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'in_credito':
        return <span className="badge badge-green">In Credito</span>;
      case 'in_debito':
        return <span className="badge badge-red">In Debito</span>;
      default:
        return <span className="badge badge-gray">Pari</span>;
    }
  };

  const getBalanceIcon = (balance) => {
    if (balance > 0) return <TrendingUp className="h-5 w-5 text-green-600" />;
    if (balance < 0) return <TrendingDown className="h-5 w-5 text-red-600" />;
    return <Minus className="h-5 w-5 text-gray-600" />;
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
          <h1 className="text-3xl font-bold text-gray-900">Pagamenti</h1>
          <p className="mt-1 text-sm text-gray-600">
            Gestisci i versamenti degli inquilini e visualizza i saldi
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Registra Pagamento</span>
        </button>
      </div>

      {/* Add Payment Form */}
      {showAddForm && (
        <div className="card bg-blue-50">
          <h2 className="text-xl font-semibold mb-4">Nuovo Pagamento</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unità *
              </label>
              <select
                value={newPayment.unit_id}
                onChange={(e) => setNewPayment({ ...newPayment, unit_id: e.target.value })}
                className="input"
              >
                <option value="">Seleziona unità</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.number} - {unit.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Pagamento *
              </label>
              <input
                type="date"
                value={newPayment.payment_date}
                onChange={(e) => setNewPayment({ ...newPayment, payment_date: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Importo (€) *
              </label>
              <input
                type="number"
                step="0.01"
                value={newPayment.amount}
                onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                placeholder="0.00"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo Pagamento
              </label>
              <select
                value={newPayment.payment_type}
                onChange={(e) => setNewPayment({ ...newPayment, payment_type: e.target.value })}
                className="input"
              >
                <option value="bonifico">Bonifico</option>
                <option value="contanti">Contanti</option>
                <option value="assegno">Assegno</option>
                <option value="altro">Altro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mese di Riferimento
              </label>
              <input
                type="month"
                value={newPayment.reference_month}
                onChange={(e) => setNewPayment({ ...newPayment, reference_month: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Note
              </label>
              <input
                type="text"
                value={newPayment.notes}
                onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                placeholder="Note opzionali"
                className="input"
              />
            </div>
          </div>

          <div className="mt-4 flex space-x-2">
            <button onClick={handleAddPayment} className="btn-primary">
              Salva Pagamento
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="btn-secondary"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaries.map((summary) => (
          <div key={summary.unit_id} className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">{summary.unit_number}</h3>
              {getBalanceIcon(summary.balance)}
            </div>
            <p className="text-sm text-gray-600 mb-3">{summary.unit_name}</p>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Dovuto:</span>
                <span className="font-medium text-red-600">{formatCurrency(summary.total_due)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pagato:</span>
                <span className="font-medium text-green-600">{formatCurrency(summary.total_paid)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="font-semibold">Saldo:</span>
                <span className={`font-bold ${summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(summary.balance)}
                </span>
              </div>
            </div>

            <div className="mt-3">
              {getStatusBadge(summary.status)}
            </div>
          </div>
        ))}
      </div>

      {/* Payments Table */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <DollarSign className="h-5 w-5 mr-2" />
          Storico Pagamenti
        </h2>

        {payments.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nessun pagamento registrato</p>
            <p className="text-sm mt-1">Clicca su "Registra Pagamento" per iniziare</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Unità</th>
                  <th>Inquilino</th>
                  <th>Importo</th>
                  <th>Tipo</th>
                  <th>Riferimento</th>
                  <th>Note</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="font-medium">{formatDate(payment.payment_date)}</td>
                    <td>{payment.unit_number}</td>
                    <td>{payment.unit_name}</td>
                    <td className="font-semibold text-green-600">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td>
                      <span className="badge badge-blue capitalize">
                        {payment.payment_type || 'N/D'}
                      </span>
                    </td>
                    <td className="text-gray-600">
                      {payment.reference_month ? formatDate(payment.reference_month + '-01') : '-'}
                    </td>
                    <td className="text-gray-600 text-sm">
                      {payment.notes || '-'}
                    </td>
                    <td>
                      <button
                        onClick={() => handleDeletePayment(payment.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Elimina"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Total Summary */}
      {summaries.length > 0 && (
        <div className="card bg-gray-50">
          <h2 className="text-xl font-semibold mb-4">Riepilogo Generale</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Totale Dovuto</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(summaries.reduce((sum, s) => sum + s.total_due, 0))}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Totale Pagato</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(summaries.reduce((sum, s) => sum + s.total_paid, 0))}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Saldo Complessivo</p>
              <p className={`text-2xl font-bold ${
                summaries.reduce((sum, s) => sum + s.balance, 0) >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}>
                {formatCurrency(summaries.reduce((sum, s) => sum + s.balance, 0))}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Payments;
