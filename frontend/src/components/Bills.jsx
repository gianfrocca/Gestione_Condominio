import { useState, useEffect } from 'react';
import { Plus, Trash2, FileText } from 'lucide-react';
import { billsAPI } from '../services/api';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

function Bills() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    bill_date: format(new Date(), 'yyyy-MM-dd'),
    type: 'electricity',
    amount: '',
    provider: '',
    notes: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    loadBills();
  }, []);

  const loadBills = async () => {
    try {
      setLoading(true);
      const { data } = await billsAPI.getAll();
      setBills(data);
    } catch (error) {
      console.error('Errore caricamento bollette:', error);
      alert('Errore durante il caricamento delle bollette');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('bill_date', formData.bill_date);
      formDataToSend.append('type', formData.type);
      formDataToSend.append('amount', formData.amount);
      formDataToSend.append('provider', formData.provider);
      formDataToSend.append('notes', formData.notes);

      if (selectedFile) {
        formDataToSend.append('file', selectedFile);
      }

      await billsAPI.create(formDataToSend);
      alert('Bolletta salvata con successo!');
      setShowForm(false);
      setFormData({
        bill_date: format(new Date(), 'yyyy-MM-dd'),
        type: 'electricity',
        amount: '',
        provider: '',
        notes: ''
      });
      setSelectedFile(null);
      loadBills();
    } catch (error) {
      console.error('Errore salvataggio bolletta:', error);
      alert('Errore durante il salvataggio della bolletta');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questa bolletta?')) return;

    try {
      await billsAPI.delete(id);
      alert('Bolletta eliminata con successo');
      loadBills();
    } catch (error) {
      console.error('Errore eliminazione bolletta:', error);
      alert('Errore durante l\'eliminazione della bolletta');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bollette</h1>
          <p className="mt-1 text-sm text-gray-600">
            Gestione bollette gas ed energia elettrica
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nuova Bolletta</span>
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Inserisci Bolletta</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Bolletta
                </label>
                <input
                  type="date"
                  value={formData.bill_date}
                  onChange={(e) => setFormData({ ...formData, bill_date: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="input"
                  required
                >
                  <option value="electricity">Energia Elettrica</option>
                  <option value="gas">Metano</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Importo (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="input"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fornitore
                </label>
                <input
                  type="text"
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                  className="input"
                  placeholder="Es: ENEL, ESTRA"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                File Bolletta (PDF o Immagine)
              </label>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => setSelectedFile(e.target.files[0])}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Note
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input"
                rows="3"
                placeholder="Note aggiuntive..."
              ></textarea>
            </div>

            <div className="flex space-x-3">
              <button type="submit" className="btn-primary">
                Salva Bolletta
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-secondary"
              >
                Annulla
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bills List */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Fornitore</th>
                <th>Importo</th>
                <th>File</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bills.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">
                    Nessuna bolletta registrata
                  </td>
                </tr>
              ) : (
                bills.map((bill) => (
                  <tr key={bill.id}>
                    <td>{format(new Date(bill.bill_date), 'dd/MM/yyyy')}</td>
                    <td>
                      <span className={`badge ${bill.type === 'gas' ? 'badge-blue' : 'badge-gray'}`}>
                        {bill.type === 'gas' ? 'Metano' : 'Energia'}
                      </span>
                    </td>
                    <td>{bill.provider || '-'}</td>
                    <td className="font-semibold">€{parseFloat(bill.amount).toFixed(2)}</td>
                    <td>
                      {bill.file_path ? (
                        <FileText className="h-5 w-5 text-primary-600" />
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => handleDelete(bill.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Bills;
