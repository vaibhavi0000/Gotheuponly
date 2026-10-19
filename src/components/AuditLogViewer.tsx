import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Download,
  Clock,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { AuditLogEntry, PartnerName } from '../types/calculator.ts';

interface AuditLogViewerProps {
  logs: AuditLogEntry[];
  onRefresh: () => void;
  isLoading?: boolean;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({
  logs,
  onRefresh,
  isLoading = false,
}) => {
  const [search, setSearch] = useState('');
  const [actorFilter, setActorFilter] = useState<'All' | PartnerName>('All');
  const [actionFilter, setActionFilter] = useState<string>('All');

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        log.details.toLowerCase().includes(search.toLowerCase()) ||
        (log.entityName && log.entityName.toLowerCase().includes(search.toLowerCase())) ||
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.actor.toLowerCase().includes(search.toLowerCase());

      const matchesActor = actorFilter === 'All' || log.actor === actorFilter;
      const matchesAction = actionFilter === 'All' || log.action === actionFilter;

      return matchesSearch && matchesActor && matchesAction;
    });
  }, [logs, search, actorFilter, actionFilter]);

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Actor', 'Action', 'Target Entity', 'Details'];
    const rows = filteredLogs.map((l) => [
      `"${new Date(l.timestamp).toLocaleString('en-IN')}"`,
      `"${l.actor}"`,
      `"${l.action}"`,
      `"${(l.entityName || l.entityId || '').replace(/"/g, '""')}"`,
      `"${l.details.replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `partner_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatActionTag = (action: string) => {
    switch (action) {
      case 'LOGIN':
        return { label: 'Partner Login', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'CREATE_PRODUCT':
        return { label: 'Created Product', bg: 'bg-teal-50 text-teal-800 border-teal-200' };
      case 'UPDATE_PRICE':
        return { label: 'Price Adjusted', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'UPDATE_SALES':
        return { label: 'Sales Logged', bg: 'bg-purple-50 text-purple-800 border-purple-200' };
      case 'UPDATE_PRODUCT':
        return { label: 'Calculation Edited', bg: 'bg-slate-100 text-slate-800 border-slate-200' };
      case 'DELETE_PRODUCT':
        return { label: 'Product Deleted', bg: 'bg-rose-50 text-rose-800 border-rose-200' };
      case 'RESET_CATALOG':
        return { label: 'Catalog Reset', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
      default:
        return { label: action.replace(/_/g, ' '), bg: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
              Governance & Security
            </span>
            <span className="text-xs text-slate-400">Server Synchronized</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold mt-1 tracking-tight">
            Partner Audit Trail & Activity Logs
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Immutable records of all calculator adjustments, price revisions, sales updates, and logins by Aditya & Anshuman.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            title="Refresh logs from server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="Download audit logs in CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-12 gap-3">
        {/* Search */}
        <div className="sm:col-span-6 relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search action, model name, details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:border-emerald-500 outline-none"
          />
        </div>

        {/* Partner Filter */}
        <div className="sm:col-span-3">
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value as any)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white outline-none cursor-pointer"
          >
            <option value="All">All Partners</option>
            <option value="Aditya">Aditya</option>
            <option value="Anshuman">Anshuman</option>
          </select>
        </div>

        {/* Action Category Filter */}
        <div className="sm:col-span-3">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white outline-none cursor-pointer"
          >
            <option value="All">All Actions</option>
            <option value="LOGIN">Partner Login</option>
            <option value="UPDATE_PRICE">Price Adjusted</option>
            <option value="UPDATE_SALES">Sales Volume</option>
            <option value="CREATE_PRODUCT">Created Product</option>
            <option value="UPDATE_PRODUCT">Calculation Edited</option>
            <option value="DELETE_PRODUCT">Product Deleted</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Partner</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Target / Product</th>
                <th className="p-3.5">Audit Trail Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-600">No audit records found.</p>
                      <p className="text-[11px] text-slate-400">
                        {search || actorFilter !== 'All' || actionFilter !== 'All'
                          ? 'Try clearing the search or filter.'
                          : 'Audit logs will record automatically as partners log in and adjust products.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const tag = formatActionTag(log.action);
                  const isAditya = log.actor === 'Aditya';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Timestamp */}
                      <td className="p-3.5 font-mono text-slate-500 whitespace-nowrap text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {new Date(log.timestamp).toLocaleString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Partner Actor */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isAditya
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          <User className="w-3 h-3" />
                          <span>{log.actor}</span>
                        </span>
                      </td>

                      {/* Action Tag */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${tag.bg}`}>
                          {tag.label}
                        </span>
                      </td>

                      {/* Entity / Product Name */}
                      <td className="p-3.5 font-medium text-slate-900 max-w-[180px] truncate">
                        {log.entityName || log.entityId ? (
                          <span className="font-semibold text-slate-800">
                            {log.entityName || log.entityId}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>

                      {/* Details */}
                      <td className="p-3.5 text-slate-700">
                        <p className="text-xs leading-relaxed">{log.details}</p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
