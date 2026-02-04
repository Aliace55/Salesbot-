import React from 'react';

/**
 * Loading skeleton component for better perceived performance
 */
export function Skeleton({ className = '', variant = 'text' }) {
    const baseClass = 'animate-pulse bg-slate-700/50 rounded';

    const variants = {
        text: 'h-4 w-full',
        title: 'h-6 w-3/4',
        avatar: 'h-10 w-10 rounded-full',
        card: 'h-32 w-full rounded-xl',
        row: 'h-12 w-full',
        button: 'h-9 w-24 rounded-lg',
        badge: 'h-5 w-16 rounded-full'
    };

    return <div className={`${baseClass} ${variants[variant]} ${className}`} />;
}

/**
 * Table skeleton for loading states
 */
export function TableSkeleton({ rows = 5, columns = 4 }) {
    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex gap-4 px-4 py-3 bg-slate-800/30 rounded-lg">
                {Array.from({ length: columns }).map((_, i) => (
                    <Skeleton key={i} className="h-4 flex-1" />
                ))}
            </div>

            {/* Rows */}
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex gap-4 px-4 py-4 border border-slate-700/30 rounded-lg">
                    {Array.from({ length: columns }).map((_, j) => (
                        <Skeleton key={j} className="h-4 flex-1" />
                    ))}
                </div>
            ))}
        </div>
    );
}

/**
 * Card skeleton for dashboard widgets
 */
export function CardSkeleton({ hasChart = false }) {
    return (
        <div className="p-6 bg-slate-800/30 border border-slate-700/50 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
                <Skeleton variant="title" className="w-32" />
                <Skeleton variant="badge" />
            </div>
            {hasChart ? (
                <Skeleton className="h-48 w-full rounded-lg" />
            ) : (
                <div className="space-y-2">
                    <Skeleton variant="text" />
                    <Skeleton variant="text" className="w-2/3" />
                </div>
            )}
        </div>
    );
}

/**
 * Contact list skeleton
 */
export function ContactListSkeleton({ count = 5 }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-slate-800/20 rounded-xl border border-slate-700/30">
                    <Skeleton variant="avatar" />
                    <div className="flex-1 space-y-2">
                        <Skeleton variant="title" className="w-40" />
                        <Skeleton variant="text" className="w-24" />
                    </div>
                    <Skeleton variant="badge" />
                </div>
            ))}
        </div>
    );
}

/**
 * Pipeline skeleton
 */
export function PipelineSkeleton() {
    return (
        <div className="space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <CardSkeleton key={i} />
                ))}
            </div>

            {/* Table */}
            <TableSkeleton rows={8} columns={5} />
        </div>
    );
}

/**
 * Inbox skeleton
 */
export function InboxSkeleton() {
    return (
        <div className="flex gap-4 h-[600px]">
            {/* Conversation list */}
            <div className="w-1/3 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-slate-800/20 rounded-lg border border-slate-700/30">
                        <Skeleton variant="avatar" className="h-8 w-8" />
                        <div className="flex-1 space-y-1">
                            <Skeleton variant="text" className="w-24" />
                            <Skeleton variant="text" className="w-full h-3" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Message area */}
            <div className="flex-1 bg-slate-800/20 rounded-xl border border-slate-700/30 p-6">
                <div className="space-y-4">
                    <Skeleton variant="title" className="w-48" />
                    <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} variant="text" className={i % 2 === 0 ? 'w-3/4' : 'w-1/2 ml-auto'} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default {
    Skeleton,
    TableSkeleton,
    CardSkeleton,
    ContactListSkeleton,
    PipelineSkeleton,
    InboxSkeleton
};
