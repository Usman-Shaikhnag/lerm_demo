import { COLORS } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    RefreshControl,
    SectionList,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { styles } from '../assets/styles/records.styles.js';

interface FieldMeta {
    label: string;
    type: string;
}

interface RecordData {
    id: number;
    [key: string]: any;
}

export default function Records() {
    const router = useRouter();
    const { model, title, action_domain, action_id } = useLocalSearchParams<{ model: string; title: string; action_domain?: string; action_id?: string }>();
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [records, setRecords] = useState<RecordData[]>([]);
    const [fields, setFields] = useState<Record<string, FieldMeta>>({});
    const [searchFields, setSearchFields] = useState<Record<string, FieldMeta>>({});
    const [totalCount, setTotalCount] = useState(0);
    const [offset, setOffset] = useState(0);
    const [search, setSearch] = useState('');
    const [searchField, setSearchField] = useState('');
    const [groupBy, setGroupBy] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
    const [error, setError] = useState(false);

    // Modal state for Search/Group dropdowns
    const [modalVisible, setModalVisible] = useState(false);
    const [modalType, setModalType] = useState<'search' | 'group'>('search');

    const LIMIT = 20;

    const fetchRecords = useCallback(async (opts: { reset?: boolean; searchQuery?: string } = {}) => {
        const { reset = false, searchQuery } = opts;
        try {
            if (reset) {
                setLoading(true);
                setOffset(0);
            }
            setError(false);

            const sessionId = await SecureStore.getItemAsync('session_id');
            const serverUrl = await SecureStore.getItemAsync('server_url');

            if (!sessionId || !serverUrl) {
                router.replace('/sign-in');
                return;
            }

            const currentOffset = reset ? 0 : offset;

            const response = await fetch(`${serverUrl}/mobile/records`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `session_id=${sessionId}`,
                    'ngrok-skip-browser-warning': 'true',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    params: {
                        model,
                        limit: LIMIT,
                        offset: currentOffset,
                        search: searchQuery !== undefined ? searchQuery : search,
                        search_field: searchField,
                        group_by: groupBy,
                        ...(action_domain ? { action_domain: JSON.parse(action_domain) } : {}),
                        ...(action_id ? { action_id: parseInt(action_id as string) } : {}),
                    },
                }),
            });

            const data = await response.json();

            if (data.result?.success) {
                const newRecords = data.result.records || [];
                if (reset) {
                    setRecords(newRecords);
                } else {
                    setRecords(prev => {
                        const existingIds = new Set(prev.map(r => r.id));
                        const uniqueNew = newRecords.filter((r: RecordData) => !existingIds.has(r.id));
                        return [...prev, ...uniqueNew];
                    });
                }
                setFields(data.result.fields || {});
                setSearchFields(data.result.search_fields || data.result.fields || {});
                setTotalCount(data.result.total_count || 0);
                setOffset(currentOffset + newRecords.length);
            } else {
                throw new Error(data.result?.error || 'Failed to fetch records');
            }
        } catch (err: any) {
            console.error('Error fetching records:', err);
            setError(true);
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setRefreshing(false);
        }
    }, [model, offset, search, searchField, groupBy, router]);

    useEffect(() => {
        fetchRecords({ reset: true });
    }, [model]); // eslint-disable-line react-hooks/exhaustive-deps

    const groupedRecords = useMemo(() => {
        if (!groupBy) return [];
        const groups: { title: string; data: RecordData[]; key: string; id: string }[] = [];
        records.forEach(r => {
            let val = r[groupBy];
            if (Array.isArray(val) && val.length === 2) val = val[1];
            const title = val !== undefined && val !== null && val !== false && val !== '' ? String(val) : 'None';
            let group = groups.find(g => g.title === title);
            if (!group) {
                group = { title, data: [], key: title, id: title };
                groups.push(group);
            }
            group.data.push(r);
        });
        return groups;
    }, [records, groupBy]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchRecords({ reset: true });
    }, [fetchRecords]);

    const onLoadMore = useCallback(() => {
        if (loadingMore || records.length >= totalCount) return;
        setLoadingMore(true);
        fetchRecords();
    }, [loadingMore, records.length, totalCount, fetchRecords]);

    const onSearch = useCallback(() => {
        fetchRecords({ reset: true, searchQuery: search });
    }, [fetchRecords, search]);

    // Get the primary display field (usually 'name' or first field)
    const fieldKeys = Object.keys(fields);
    const primaryField = fieldKeys.includes('name') ? 'name' :
        fieldKeys.includes('display_name') ? 'display_name' : fieldKeys[0] || 'id';

    // Get secondary fields (exclude primary)
    const secondaryFields = fieldKeys.filter(f => f !== primaryField && f !== 'id').slice(0, 4);

    const formatValue = (value: any, type: string): string => {
        if (value === null || value === undefined || value === false) return '—';
        if (type === 'date' || type === 'datetime') {
            try {
                const d = new Date(value);
                return d.toLocaleDateString();
            } catch {
                return String(value);
            }
        }
        if (type === 'float' || type === 'monetary') {
            return Number(value).toFixed(2);
        }
        if (type === 'boolean') {
            return value ? 'Yes' : 'No';
        }
        return String(value);
    };

    // ── List View Row ──
    const renderListItem = ({ item }: { item: RecordData }) => {
        const primaryValue = item[primaryField] || item.display_name || `#${item.id}`;

        return (
            <TouchableOpacity
                style={styles.listRow}
                activeOpacity={0.6}
                onPress={() => router.push({
                    pathname: '/record-form',
                    params: { model, record_id: item.id.toString(), title: String(primaryValue), ...(action_id ? { action_id } : {}) }
                })}
            >
                <View style={styles.listRowMain}>
                    <Text style={styles.listRowTitle} numberOfLines={1}>{String(primaryValue)}</Text>
                    <View style={styles.listRowFields}>
                        {secondaryFields.map(f => {
                            const meta = fields[f];
                            if (!meta) return null;
                            const val = formatValue(item[f], meta.type);
                            return (
                                <View key={f} style={styles.listFieldChip}>
                                    <Text style={styles.listFieldLabel}>{meta.label}:</Text>
                                    <Text style={styles.listFieldValue} numberOfLines={1}>{val}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
            </TouchableOpacity>
        );
    };

    // Helper for Odoo-like state colors
    const getStateColor = (stateStr: string) => {
        const s = String(stateStr).toLowerCase();
        if (s.includes('done') || s.includes('success') || s.includes('publish') || s.includes('active')) return { bg: '#E8F5E9', text: '#2E7D32' }; // Green
        if (s.includes('cancel') || s.includes('fail') || s.includes('error')) return { bg: '#FFEBEE', text: '#C62828' }; // Red
        if (s.includes('draft') || s.includes('new')) return { bg: '#E3F2FD', text: '#1565C0' }; // Blue
        if (s.includes('progress') || s.includes('wait') || s.includes('pending')) return { bg: '#FFF3E0', text: '#EF6C00' }; // Orange
        return { bg: COLORS.primary + '18', text: COLORS.primary }; // Default Theme
    };

    // ── Kanban View Card ──
    const renderKanbanItem = ({ item }: { item: RecordData }) => {
        const primaryValue = item[primaryField] || item.display_name || `#${item.id}`;
        // Grab a "state"-like field for badge
        const stateField = fieldKeys.find(f => f === 'state' || f === 'stage_id' || f === 'status');
        const stateValue = stateField ? item[stateField] : null;
        const badgeColor = stateValue ? getStateColor(stateValue) : null;

        return (
            <TouchableOpacity
                style={styles.kanbanCard}
                activeOpacity={0.7}
                onPress={() => router.push({
                    pathname: '/record-form',
                    params: { model, record_id: item.id.toString(), title: String(primaryValue), ...(action_id ? { action_id } : {}) }
                })}
            >
                <View style={styles.kanbanHeader}>
                    <Text style={styles.kanbanTitle} numberOfLines={2}>{String(primaryValue)}</Text>
                    {stateValue && badgeColor ? (
                        <View style={[styles.kanbanBadge, { backgroundColor: badgeColor.bg }]}>
                            <Text style={[styles.kanbanBadgeText, { color: badgeColor.text }]}>{String(stateValue).toUpperCase()}</Text>
                        </View>
                    ) : null}
                </View>
                <View style={styles.kanbanBody}>
                    {secondaryFields.slice(0, 3).map(f => {
                        const meta = fields[f];
                        if (!meta || f === stateField) return null;
                        const val = formatValue(item[f], meta.type);
                        return (
                            <Text key={f} style={styles.kanbanFieldText} numberOfLines={1}>
                                <Text style={{ fontWeight: '600' }}>{meta.label}:</Text> {val}
                            </Text>
                        );
                    })}
                </View>
            </TouchableOpacity>
        );
    };

    // ── Footer Loader ──
    const renderFooter = () => {
        if (!loadingMore) return null;
        return (
            <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading records...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centerContainer}>
                <Ionicons name="cloud-offline-outline" size={48} color={COLORS.textLight} />
                <Text style={styles.errorTitle}>Failed to load records</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => fetchRecords({ reset: true })}>
                    <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {title || model}
                </Text>
                <View style={styles.viewToggle}>
                    <TouchableOpacity
                        style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
                        onPress={() => setViewMode('list')}
                    >
                        <Ionicons
                            name="list-outline"
                            size={18}
                            color={viewMode === 'list' ? COLORS.white : COLORS.primary}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleBtn, viewMode === 'kanban' && styles.toggleBtnActive]}
                        onPress={() => setViewMode('kanban')}
                    >
                        <Ionicons
                            name="grid-outline"
                            size={18}
                            color={viewMode === 'kanban' ? COLORS.white : COLORS.primary}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <Ionicons name="search-outline" size={18} color={COLORS.textLight} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search records..."
                    placeholderTextColor={COLORS.textLight}
                    value={search}
                    onChangeText={setSearch}
                    onSubmitEditing={onSearch}
                    returnKeyType="search"
                />
                {search ? (
                    <TouchableOpacity onPress={() => { setSearch(''); fetchRecords({ reset: true, searchQuery: '' }); }}>
                        <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
                    </TouchableOpacity>
                ) : null}
            </View>

            {/* Tools: Search Field and Grouping */}
            {Object.keys(fields).length > 0 && (
                <View style={styles.filterBar}>
                    {/* Search Field Button */}
                    <TouchableOpacity
                        style={styles.filterButton}
                        onPress={() => { setModalType('search'); setModalVisible(true); }}
                    >
                        <Ionicons name="filter" size={16} color={COLORS.textLight} />
                        <Text style={styles.filterButtonText} numberOfLines={1}>
                            Search: {searchField ? (searchFields[searchField]?.label || searchField) : 'All / Default'}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color={COLORS.textLight} />
                    </TouchableOpacity>

                    <View style={styles.filterDivider} />

                    {/* Group By Button */}
                    <TouchableOpacity
                        style={styles.filterButton}
                        onPress={() => { setModalType('group'); setModalVisible(true); }}
                    >
                        <Ionicons name="layers-outline" size={16} color={COLORS.textLight} />
                        <Text style={styles.filterButtonText} numberOfLines={1}>
                            Group: {groupBy ? (searchFields[groupBy]?.label || groupBy) : 'None'}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color={COLORS.textLight} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Dropdown Modal */}
            <Modal
                visible={modalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setModalVisible(false)}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {modalType === 'search' ? 'Select Search Field' : 'Group By'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={modalType === 'search'
                                ? [{ key: '', label: 'All / Default' }, ...Object.entries(searchFields).map(([k, v]) => ({ key: k, label: v.label })).sort((a, b) => a.label.localeCompare(b.label))]
                                : [{ key: '', label: 'None' }, ...Object.entries(searchFields).filter(([k, v]) => ['many2one', 'selection', 'char', 'boolean'].includes(v.type) || k.includes('state')).map(([k, v]) => ({ key: k, label: v.label })).sort((a, b) => a.label.localeCompare(b.label))]
                            }
                            keyExtractor={(item) => item.key}
                            renderItem={({ item }) => {
                                const isActive = modalType === 'search' ? searchField === item.key : groupBy === item.key;
                                return (
                                    <TouchableOpacity
                                        style={[styles.modalOption, isActive && styles.modalOptionActive]}
                                        onPress={() => {
                                            if (modalType === 'search') {
                                                setSearchField(item.key);
                                                if (search) {
                                                    setTimeout(() => fetchRecords({ reset: true, searchQuery: search }), 0);
                                                }
                                            } else {
                                                setGroupBy(item.key);
                                                setTimeout(() => fetchRecords({ reset: true }), 0);
                                            }
                                            setModalVisible(false);
                                        }}
                                    >
                                        <Text style={[styles.modalOptionText, isActive && styles.modalOptionTextActive]}>
                                            {item.label}
                                        </Text>
                                        {isActive && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                                    </TouchableOpacity>
                                );
                            }}
                            showsVerticalScrollIndicator={false}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Count */}
            <View style={styles.countRow}>
                <Text style={styles.countText}>{totalCount} record{totalCount !== 1 ? 's' : ''}</Text>
            </View>

            {/* Records */}
            {viewMode === 'list' ? (
                groupBy ? (
                    <SectionList
                        key="list-view-grouped"
                        sections={groupedRecords}
                        renderItem={renderListItem}
                        keyExtractor={(item) => String(item.id)}
                        renderSectionHeader={({ section: { title } }) => (
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionHeaderText}>{title}</Text>
                            </View>
                        )}
                        contentContainerStyle={styles.listContainer}
                        showsVerticalScrollIndicator={false}
                        stickySectionHeadersEnabled={true}
                        onEndReached={onLoadMore}
                        onEndReachedThreshold={0.3}
                        ListFooterComponent={renderFooter}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="document-outline" size={48} color={COLORS.textLight} />
                                <Text style={styles.emptyText}>No records found</Text>
                            </View>
                        }
                    />
                ) : (
                    <FlatList
                        key="list-view"
                        data={records}
                        renderItem={renderListItem}
                        keyExtractor={(item) => String(item.id)}
                        contentContainerStyle={styles.listContainer}
                        showsVerticalScrollIndicator={false}
                        onEndReached={onLoadMore}
                        onEndReachedThreshold={0.3}
                        ListFooterComponent={renderFooter}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="document-outline" size={48} color={COLORS.textLight} />
                                <Text style={styles.emptyText}>No records found</Text>
                            </View>
                        }
                    />
                )
            ) : (
                groupBy ? (
                    <FlatList
                        key="kanban-view-grouped"
                        data={groupedRecords}
                        renderItem={({ item: group }) => (
                            <View>
                                <View style={styles.sectionHeaderRow}>
                                    <Text style={styles.sectionHeaderText}>{group.title}</Text>
                                </View>
                                <View style={styles.kanbanGroupWrap}>
                                    {group.data.map((record) => (
                                        <View key={record.id} style={styles.kanbanGroupCardWrapper}>
                                            {renderKanbanItem({ item: record })}
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                        keyExtractor={(item) => item.title}
                        contentContainerStyle={styles.listContainer}
                        showsVerticalScrollIndicator={false}
                        onEndReached={onLoadMore}
                        onEndReachedThreshold={0.3}
                        ListFooterComponent={renderFooter}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="document-outline" size={48} color={COLORS.textLight} />
                                <Text style={styles.emptyText}>No records found</Text>
                            </View>
                        }
                    />
                ) : (
                    <FlatList
                        key="kanban-view"
                        data={records}
                        renderItem={renderKanbanItem}
                        keyExtractor={(item) => String(item.id)}
                        numColumns={2}
                        columnWrapperStyle={styles.kanbanRow}
                        contentContainerStyle={styles.listContainer}
                        showsVerticalScrollIndicator={false}
                        onEndReached={onLoadMore}
                        onEndReachedThreshold={0.3}
                        ListFooterComponent={renderFooter}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="document-outline" size={48} color={COLORS.textLight} />
                                <Text style={styles.emptyText}>No records found</Text>
                            </View>
                        }
                    />
                )
            )}

            {/* Floating Action Button (FAB) for Create */}
            <TouchableOpacity
                style={styles.fab}
                activeOpacity={0.8}
                onPress={() => router.push({
                    pathname: '/record-form',
                    params: { model, title: `New ${title || model}`, ...(action_id ? { action_id } : {}) }
                })}
            >
                <Ionicons name="add" size={28} color={COLORS.white} />
            </TouchableOpacity>
        </View>
    );
}
