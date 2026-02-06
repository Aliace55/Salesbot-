import React, { useState } from 'react';
import { ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, Settings, Eye } from 'lucide-react';

export function CRMTable({
    data = [],
    columns = [],
    selectedIds = new Set(),
    onSelect, // (id) => void
    onSelectAll, // (ids) => void
    onSort, // (columnId) => void
    sortBy,
    sortOrder,
    onRowClick, // (item) => void
    loading = false,
    emptyMessage = "No records found"
}) {
    const [visibleColumns, setVisibleColumns] = useState(
        columns.filter(c => !c.hidden).map(c => c.id)
    );
    const [showColumnPicker, setShowColumnPicker] = useState(false);

    const handleHeaderClick = (colId) => {
        if (onSort) onSort(colId);
    };

    const toggleColumn = (colId) => {
        setVisibleColumns(prev => {
            if (prev.includes(colId)) return prev.filter(id => id !== colId);
            return [...prev, colId];
        });
    };

    const finalColumns = columns.filter(c => visibleColumns.includes(c.id));

    return (
        <div className="flex flex-col h-full bg-[#1e293b] rounded-lg border border-slate-700/50 overflow-hidden shadow-sm">
            {/* Toolbar Area (if needed in future, e.g. bulk actions) */}
            <div className="flex items-center justify-between p-2 border-b border-slate-700/50 bg-slate-800/20">
                <div className="text-xs text-slate-500 font-medium px-2">
                    {data.length} records
                    {selectedIds.size > 0 && <span className="text-blue-400 ml-2">• {selectedIds.size} selected</span>}
                </div>
                <div className="relative">
                    <button
                        onClick={() => setShowColumnPicker(!showColumnPicker)}
                        className="flex items-center space-x-1 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                    >
                        <Settings size={14} />
                        <span>Columns</span>
                    </button>

                    {showColumnPicker && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1">
                            <div className="px-3 py-2 border-b border-slate-700/50 text-xs font-semibold text-slate-400">
                                Visible Columns
                            </div>
                            <div className="max-h-60 overflow-y-auto p-1">
                                {columns.map(col => (
                                    <label key={col.id} className="flex items-center px-2 py-1.5 hover:bg-slate-700/50 rounded cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={visibleColumns.includes(col.id)}
                                            onChange={() => toggleColumn(col.id)}
                                            className="rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500/20 w-3.5 h-3.5"
                                        />
                                        <span className="ml-2 text-xs text-slate-300">{col.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-800/80 sticky top-0 z-10 backdrop-blur-sm">
                        <tr>
                            <th className="py-3 px-4 w-10 border-b border-slate-700/50">
                                <input
                                    type="checkbox"
                                    checked={data.length > 0 && selectedIds.size === data.length}
                                    onChange={(e) => {
                                        if (e.target.checked) onSelectAll(data.map(d => d.id));
                                        else onSelectAll([]);
                                    }}
                                    className="rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500/20 w-4 h-4 cursor-pointer"
                                />
                            </th>
                            {finalColumns.map(col => (
                                <th
                                    key={col.id}
                                    onClick={() => handleHeaderClick(col.id)}
                                    className="py-3 px-4 text-xs font-semibold text-slate-400 border-b border-slate-700/50 cursor-pointer hover:bg-slate-700/30 hover:text-slate-200 transition-colors select-none whitespace-nowrap"
                                    style={{ width: col.width }}
                                >
                                    <div className="flex items-center space-x-1">
                                        <span>{col.label}</span>
                                        {sortBy === col.id && (
                                            sortOrder === 'asc' ? <ArrowUp size={12} className="text-blue-400" /> : <ArrowDown size={12} className="text-blue-400" />
                                        )}
                                        {sortBy !== col.id && <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-30" />}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50 text-sm">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td className="p-4"><div className="h-4 w-4 bg-slate-700/50 rounded"></div></td>
                                    {finalColumns.map(col => (
                                        <td key={col.id} className="p-4"><div className="h-4 bg-slate-700/50 rounded w-2/3"></div></td>
                                    ))}
                                </tr>
                            ))
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={finalColumns.length + 1} className="py-12 text-center text-slate-500">
                                    <p>{emptyMessage}</p>
                                </td>
                            </tr>
                        ) : (
                            data.map((item) => (
                                <tr
                                    key={item.id}
                                    onClick={() => onRowClick && onRowClick(item)}
                                    className={`
                                        group transition-colors cursor-default
                                        ${selectedIds.has(item.id) ? 'bg-blue-900/10 hover:bg-blue-900/20' : 'hover:bg-slate-800/30'}
                                    `}
                                >
                                    <td className="py-2.5 px-4 border-b border-slate-700/30" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(item.id)}
                                            onChange={() => onSelect(item.id)}
                                            className="rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500/20 w-4 h-4 cursor-pointer"
                                        />
                                    </td>
                                    {finalColumns.map(col => (
                                        <td
                                            key={col.id}
                                            className="py-2.5 px-4 text-slate-300 border-b border-slate-700/30 whitespace-nowrap overflow-hidden text-ellipsis max-w-xs"
                                        >
                                            {col.render ? col.render(item) : (item[col.id] || '-')}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination / Footer could go here */}
        </div>
    );
}
