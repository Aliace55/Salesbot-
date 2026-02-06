import React, { useState, useEffect } from 'react';
import { Pencil, Check, X, ExternalLink } from 'lucide-react';

export function EditableProperty({
    label,
    value,
    name,
    onSave,
    icon: Icon,
    isLink,
    external,
    badge,
    type = 'text',
    options = [] // For select inputs if needed later
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [currentValue, setCurrentValue] = useState(value || '');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setCurrentValue(value || '');
    }, [value]);

    const handleSave = async () => {
        if (currentValue === value) {
            setIsEditing(false);
            return;
        }

        setLoading(true);
        try {
            await onSave(name, currentValue);
            setIsEditing(false);
        } catch (error) {
            console.error("Failed to save property", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setCurrentValue(value || '');
        setIsEditing(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') handleCancel();
    };

    // Render View Mode
    if (!isEditing) {
        return (
            <div className="group relative pl-2 -ml-2 rounded hover:bg-slate-800/50 transition-colors py-1">
                <div className="text-[10px] text-slate-500 mb-0.5">{label}</div>
                <div className="flex items-center text-slate-300 min-h-[20px]">
                    {Icon && <Icon size={12} className="mr-1.5 text-slate-500" />}

                    <div className="flex-1 truncate cursor-pointer" onClick={() => setIsEditing(true)}>
                        {value ? (
                            isLink ? (
                                <span className="text-blue-400 hover:underline flex items-center gap-1">
                                    {value}
                                    {external && <ExternalLink size={10} />}
                                </span>
                            ) : badge ? (
                                <StatusBadge status={value} />
                            ) : (
                                <span>{value}</span>
                            )
                        ) : (
                            <span className="text-slate-600 italic text-xs">Add {label}</span>
                        )}
                    </div>

                    <button
                        onClick={() => setIsEditing(true)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-blue-400 transition-opacity absolute right-0 top-1"
                    >
                        <Pencil size={12} />
                    </button>
                </div>
            </div>
        );
    }

    // Render Edit Mode
    return (
        <div className="py-1 bg-slate-800/50 rounded px-2 -mx-2">
            <div className="text-[10px] text-blue-400 mb-0.5 font-medium">{label}</div>
            <div className="flex items-center space-x-1">
                <input
                    autoFocus
                    type={type}
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="p-1 bg-blue-600 hover:bg-blue-500 text-white rounded shadow-sm disabled:opacity-50"
                >
                    <Check size={14} />
                </button>
                <button
                    onClick={handleCancel}
                    disabled={loading}
                    className="p-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    );
}

// Helper for Badge (duplicated from Contacts, could be shared utility)
function StatusBadge({ status }) {
    const colors = {
        'NEW': 'text-blue-400 bg-blue-400/10 border-blue-400/20',
        'ACTIVE': 'text-green-400 bg-green-400/10 border-green-400/20',
        'COMPLETED': 'text-slate-400 bg-slate-400/10 border-slate-400/20',
        'OPTED_OUT': 'text-red-400 bg-red-400/10 border-red-400/20',
    };
    const style = colors[status] || colors['NEW'];

    return (
        <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${style}`}>
            {status?.replace(/_/g, ' ') || 'NEW'}
        </span>
    );
}
