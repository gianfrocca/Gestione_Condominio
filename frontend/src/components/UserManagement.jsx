import { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Key, Save, X, Mail, Phone, Building2 } from 'lucide-react';
import { usersAPI, unitsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    role: 'inquilino',
    unit_id: '',
    full_name: '',
    phone: ''
  });
  const { user: currentUser } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, unitsRes] = await Promise.all([
        usersAPI.getAll(),
        unitsAPI.getAll()
      ]);
      setUsers(usersRes.data);
      setUnits(unitsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Errore durante il caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      email: '',
      role: 'inquilino',
      unit_id: '',
      full_name: '',
      phone: ''
    });
    setEditingUser(null);
    setShowForm(false);
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      email: user.email,
      role: user.role,
      unit_id: user.unit_id || '',
      full_name: user.full_name || '',
      phone: user.phone || ''
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingUser) {
        // Update
        await usersAPI.update(editingUser.id, {
          email: formData.email,
          role: formData.role,
          unit_id: formData.unit_id || null,
          full_name: formData.full_name,
          phone: formData.phone
        });
        alert('Utente aggiornato con successo!');
      } else {
        // Create
        if (!formData.password) {
          alert('La password è obbligatoria per creare un nuovo utente');
          return;
        }
        await usersAPI.create(formData);
        alert('Utente creato con successo!');
      }

      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving user:', error);
      alert(error.response?.data?.message || 'Errore durante il salvataggio');
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm('Sei sicuro di voler disattivare questo utente?')) return;

    try {
      await usersAPI.delete(userId);
      alert('Utente disattivato con successo!');
      loadData();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(error.response?.data?.message || 'Errore durante l\'eliminazione');
    }
  };

  const handleResetPassword = async (userId) => {
    const newPassword = prompt('Inserisci la nuova password (minimo 6 caratteri):');

    if (!newPassword) return;

    if (newPassword.length < 6) {
      alert('La password deve essere di almeno 6 caratteri');
      return;
    }

    try {
      await usersAPI.resetPassword(userId, newPassword);
      alert('Password resettata con successo!');
    } catch (error) {
      console.error('Error resetting password:', error);
      alert(error.response?.data?.message || 'Errore durante il reset della password');
    }
  };

  const getRoleBadge = (role) => {
    const colors = {
      super_admin: 'bg-purple-100 text-purple-800',
      admin: 'bg-blue-100 text-blue-800',
      gestore: 'bg-green-100 text-green-800',
      inquilino: 'bg-gray-100 text-gray-800'
    };

    const labels = {
      super_admin: 'Super Admin',
      admin: 'Admin',
      gestore: 'Gestore',
      inquilino: 'Inquilino'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[role]}`}>
        {labels[role]}
      </span>
    );
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestione Utenti</h1>
          <p className="mt-1 text-sm text-gray-600">
            Gestisci utenti e permessi del sistema
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nuovo Utente</span>
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">
                  {editingUser ? 'Modifica Utente' : 'Nuovo Utente'}
                </h2>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Username */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="input"
                      required
                      disabled={editingUser}
                    />
                    {editingUser && (
                      <p className="text-xs text-gray-500 mt-1">Lo username non può essere modificato</p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password {!editingUser && '*'}
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="input"
                      required={!editingUser}
                      placeholder={editingUser ? 'Lascia vuoto per non modificare' : ''}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="input pl-10"
                        required
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefono
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="input pl-10"
                      />
                    </div>
                  </div>

                  {/* Full Name */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome Completo
                    </label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="input"
                    />
                  </div>

                  {/* Role */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ruolo *
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="input"
                      required
                    >
                      {currentUser.role === 'super_admin' && (
                        <option value="super_admin">Super Admin</option>
                      )}
                      <option value="admin">Admin</option>
                      <option value="gestore">Gestore</option>
                      <option value="inquilino">Inquilino</option>
                    </select>
                  </div>

                  {/* Unit (solo per inquilini) */}
                  {formData.role === 'inquilino' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unità Immobiliare
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Building2 className="h-4 w-4 text-gray-400" />
                        </div>
                        <select
                          value={formData.unit_id}
                          onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                          className="input pl-10"
                        >
                          <option value="">Nessuna</option>
                          {units.map(unit => (
                            <option key={unit.id} value={unit.id}>
                              {unit.number} - {unit.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex justify-end space-x-3 pt-4">
                  <button type="button" onClick={resetForm} className="btn-secondary">
                    Annulla
                  </button>
                  <button type="submit" className="btn-primary flex items-center space-x-2">
                    <Save className="h-4 w-4" />
                    <span>{editingUser ? 'Aggiorna' : 'Crea'} Utente</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Utente</th>
                <th>Email</th>
                <th>Ruolo</th>
                <th>Unità</th>
                <th>Telefono</th>
                <th>Ultimo Accesso</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className={!user.is_active ? 'opacity-50' : ''}>
                  <td>
                    <div>
                      <div className="font-medium text-gray-900">{user.full_name || user.username}</div>
                      <div className="text-sm text-gray-500">@{user.username}</div>
                    </div>
                  </td>
                  <td className="text-sm text-gray-600">{user.email}</td>
                  <td>{getRoleBadge(user.role)}</td>
                  <td className="text-sm text-gray-600">{user.unit_number || '-'}</td>
                  <td className="text-sm text-gray-600">{user.phone || '-'}</td>
                  <td className="text-sm text-gray-600">
                    {user.last_login
                      ? new Date(user.last_login).toLocaleDateString('it-IT')
                      : 'Mai'}
                  </td>
                  <td>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Modifica"
                      >
                        <Edit2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleResetPassword(user.id)}
                        className="text-green-600 hover:text-green-900"
                        title="Reset Password"
                      >
                        <Key className="h-5 w-5" />
                      </button>
                      {user.id !== currentUser.id && (
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Disattiva"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nessun utente trovato</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserManagement;
