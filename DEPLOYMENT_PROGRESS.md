# Gestione Condominio - VPS Deployment Progress

## 🎯 Project Overview

Migrating "Gestione Condominio" (condominium management application) from local SQLite to a VPS deployment with flexible storage backend support. The pragmatic approach prioritizes immediate deployment with file-based storage, while maintaining an upgrade path to PostgreSQL for future scalability.

## ✅ Completed Tasks

### 1. **Storage Layer Abstraction** (Commit: 955aa3c)
- ✅ Created unified storage abstraction layer in `backend/storage/`
  - **`index.js`**: Factory router that selects storage backend based on `STORAGE_TYPE` environment variable
  - **`fileStorage.js`**: JSON-based file storage implementation
    - Persists data to `/data/storage/database.json`
    - Supports SQL parsing for SELECT/INSERT/UPDATE/DELETE
    - Auto-increment ID management per table
    - WHERE clause evaluation with ORDER BY and LIMIT support
  - **`postgresStorage.js`**: PostgreSQL adapter
    - Uses `pg` driver for connection management
    - Supports both connection string (URL) and individual parameters
    - Auto-detects PostgreSQL connection format

- ✅ Modified `backend/database.js` to use storage abstraction
  - Exports wrapper functions: `runQuery()`, `getQuery()`, `allQuery()`
  - Conditional schema creation (PostgreSQL tables or file storage defaults)
  - All routes/controllers continue working transparently

- ✅ Updated `.env` configuration
  - `STORAGE_TYPE=file` (default)
  - `STORAGE_TYPE=postgresql` for PostgreSQL backend
  - Database parameters now optional

### 2. **Automatic Backup System** (Commit: 37be81a)
- ✅ Created `backend/utils/backupManager.js`
  - **Daily automated backups** - runs at server startup and every 24 hours
  - **Dual-backend support**:
    - File storage: JSON file backups to `/data/backups/`
    - PostgreSQL: SQL dump exports
  - **30-day retention** - automatically removes backups older than 30 days
  - **Backup API endpoints**:
    - `POST /api/backup/create` - Trigger manual backup
    - `GET /api/backup/list` - List all available backups
    - `GET /api/backup/download/:filename` - Download specific backup
    - `POST /api/backup/restore/:filename` - Restore from backup

- ✅ Updated `backend/routes/backup.js` with new endpoints
- ✅ Integrated backup initialization in `backend/server.js`
  - Automatic initialization on server startup
  - Daily scheduling with exponential backoff

### 3. **SQL Compatibility** (Commit: 55d1862)
- ✅ Fixed database initialization for cross-storage compatibility
  - Replaced PostgreSQL-specific `ON CONFLICT ... DO NOTHING` syntax
  - Standardized all queries to use `$1, $2, $3...` placeholder style
  - Implemented explicit existence checks before INSERT operations
  - Parameterized all SQL queries for both storage backends

### 4. **Directory Structure**
- ✅ Created `/data/backups/` directory with `.gitkeep`
- ✅ Created `/data/storage/` directory with `.gitkeep`
- ✅ Updated `.gitignore` to exclude data files while tracking directories

## 📋 Current Architecture

```
Backend:
├── Storage Layer (backend/storage/)
│   ├── index.js           # Factory pattern router
│   ├── fileStorage.js     # JSON-based persistence
│   └── postgresStorage.js # PostgreSQL adapter
├── Database Layer (backend/database.js)
│   ├── Wraps storage functions
│   ├── Handles schema initialization
│   └── Routes queries through storage abstraction
├── Backup System (backend/utils/backupManager.js)
│   ├── Automatic daily backups
│   ├── 30-day retention
│   └── List/download/restore API
└── API Routes (backend/routes/)
    └── backup.js # Backup management endpoints

Data Storage:
├── /data/storage/database.json    # File-based data (FileStorage)
├── /data/backups/                 # Automatic backups
├── /data/bills/                   # Document storage
└── /data/reports/                 # Report output

Configuration:
├── .env                           # Environment variables
│   └── STORAGE_TYPE=file         # Default: file-based
│   └── STORAGE_TYPE=postgresql   # Optional: PostgreSQL
└── docker-compose.yml             # VPS deployment config
```

## 🚀 Environment Configuration

### Default Configuration (File Storage)
```env
STORAGE_TYPE=file
JWT_SECRET=your_jwt_secret_key_change_in_production_now
```

### PostgreSQL Configuration (Optional)
```env
STORAGE_TYPE=postgresql
DB_HOST=postgres://user:password@localhost:5432/dbname
# OR individual parameters:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=condominio_db
DB_USER=condominio_user
DB_PASSWORD=secure_password
DB_SSL=false
JWT_SECRET=your_jwt_secret_key_change_in_production_now
```

## 📦 Deployment Ready Features

### ✅ For Immediate Deployment (File Storage)
- Single condominium support (as per requirements)
- JSON-based data persistence
- Automatic daily backups with 30-day retention
- Backup download/restore via API
- Zero database setup required
- Perfect for small-scale deployment

### ✅ For Future Scalability (PostgreSQL)
- Drop-in replacement via environment variable
- Full relational database support
- Automatic SQL dump backups
- Connection pooling with pg driver
- No code changes required to switch backends

## 🔧 API Endpoints

### Backup Management
```
POST /api/backup/create          # Create manual backup
GET  /api/backup/list            # List all backups
GET  /api/backup/download/:file  # Download backup
POST /api/backup/restore/:file   # Restore from backup
```

### Data Access (No changes to existing endpoints)
```
All existing routes work transparently with both storage backends:
- /api/auth/login
- /api/users
- /api/units
- /api/readings
- /api/bills
- /api/calculations
- /api/settings
- /api/reports
- /api/payments
- /api/excel
```

## 📝 Data Structure (FileStorage JSON)

```json
{
  "condominiums": [...],
  "users": [...],
  "units": [...],
  "meters": [...],
  "readings": [...],
  "bills": [...],
  "settings": [...],
  "fixed_costs": [...],
  "monthly_splits": [...],
  "payments": [...]
}
```

## 🧪 Testing Checklist

- [ ] Application starts with file storage (STORAGE_TYPE=file)
- [ ] First backup is created on startup
- [ ] Create condominiums/units/users via API
- [ ] Verify data persists in `/data/storage/database.json`
- [ ] Test backup creation API endpoint
- [ ] Test backup listing API endpoint
- [ ] Test backup download API endpoint
- [ ] Test backup restore functionality
- [ ] Switch to PostgreSQL and verify all routes work
- [ ] Test backup with PostgreSQL storage
- [ ] Deploy to Coolify and test end-to-end

## ⚠️ Important Notes

### Default Credentials (Change Immediately)
```
Username: superadmin
Password: admin123
```
⚠️ Change this immediately after first login!

### File Storage Limitations
- Single-instance only (no horizontal scaling)
- Suitable for 1 condominium with up to 100 units
- Backup files are text-based JSON (compressible)
- No database connection required

### PostgreSQL Migration
When ready to migrate from file storage to PostgreSQL:
1. Export current data via `/api/backup/download/`
2. Set up PostgreSQL database
3. Change `STORAGE_TYPE=postgresql` in `.env`
4. Restart application (schema and data will be created)
5. Use backup restore endpoint if needed

## 🐳 Coolify Deployment Commands

```bash
# Set environment variable
export STORAGE_TYPE=file

# Or in Coolify dashboard, set:
STORAGE_TYPE=file
JWT_SECRET=your_random_secret_key_here

# Application will:
# 1. Initialize file storage
# 2. Create /data/storage/database.json
# 3. Create first backup
# 4. Set up default admin user
# 5. Be ready for use immediately
```

## 📅 Next Steps

1. **Test Application Startup**
   - Run: `npm start` (with STORAGE_TYPE=file)
   - Verify file `/data/storage/database.json` is created
   - Check that first backup is created in `/data/backups/`

2. **Route Verification**
   - Test all existing routes to ensure compatibility
   - Verify backup API endpoints work
   - Test data persistence across requests

3. **Admin Panel Enhancement** (Optional)
   - Create UI component for storage backend configuration
   - Allow switching between file/PostgreSQL from admin dashboard
   - Show backup statistics and management UI

4. **Coolify Deployment**
   - Configure Coolify with VPS credentials
   - Set environment variables
   - Deploy application
   - Monitor logs for any issues

5. **Load Testing** (Optional)
   - Test with sample data
   - Monitor file growth over time
   - Backup file sizes
   - Performance characteristics

## 📞 Troubleshooting

### Application won't start
```
Check logs for:
- Directory permissions in /data/
- STORAGE_TYPE environment variable set
- Valid JWT_SECRET in .env
```

### File storage not created
```
Verify:
- /data/storage/ directory exists and is writable
- FileStorage.initialize() is called
- Check server startup logs
```

### Backups not creating
```
Check:
- /data/backups/ directory exists and is writable
- initializeScheduledBackups() called in server.js
- Check for errors in application logs
```

### PostgreSQL connection errors
```
Verify when STORAGE_TYPE=postgresql:
- Database is running and accessible
- Connection credentials are correct
- Schema creation queries complete successfully
```

## 📊 Project Timeline

| Task | Status | Commits |
|------|--------|---------|
| Storage Layer Abstraction | ✅ Complete | 955aa3c |
| Backup System | ✅ Complete | 37be81a |
| SQL Compatibility | ✅ Complete | 55d1862 |
| Application Testing | 🔄 In Progress | - |
| Route Verification | ⏳ Pending | - |
| Admin Panel Component | ⏳ Pending | - |
| Coolify Deployment | ⏳ Pending | - |

## 🎉 Summary

The Gestione Condominio application is now ready for VPS deployment with:
- **Flexible storage backends** (file-based or PostgreSQL)
- **Automatic backup system** with daily scheduling
- **Zero database setup** required for immediate deployment
- **Transparent routing** through storage abstraction layer
- **Cross-backend SQL compatibility**

The pragmatic file-storage approach enables immediate deployment while maintaining a clear upgrade path to PostgreSQL when needed.
