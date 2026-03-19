import { useState, useEffect, useMemo, type DependencyList } from 'react';

/**
 * Manages multi-selection state for SongTable instances.
 *
 * @param resetDeps - When any dependency changes, the selection is cleared.
 *                    Typical deps: search keyword, selected artist/album, etc.
 * @returns `selectedIds`, `setSelectedIds`, and `selectionProps` that can be
 *          spread directly onto `<SongTable />`.
 */
export function useSelection(resetDeps: DependencyList) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Reset selection when dependencies change
    useEffect(() => {
        setSelectedIds(new Set());
    }, resetDeps);

    const selectionProps = useMemo(
        () => ({
            enableSelection: true as const,
            selectedIds,
            onSelectionChange: setSelectedIds,
        }),
        [selectedIds],
    );

    return { selectedIds, setSelectedIds, selectionProps };
}
