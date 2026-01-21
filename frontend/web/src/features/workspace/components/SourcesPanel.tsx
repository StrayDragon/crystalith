import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  TextField,
  Typography,
  Stack,
  CircularProgress,
  Tooltip,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  InputAdornment,
  Checkbox,
  Menu,
  MenuItem,
  Select,
  FormControl,
  Chip,
  Paper,
  Skeleton,
  Divider,
  alpha,
  Link,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  MoreHoriz as MoreHorizIcon,
  Delete as DeleteIcon,
  Description as DescriptionIcon,
  CloudUpload as CloudUploadIcon,
  Language as LanguageIcon,
  School as ScholarIcon,
  Article as ArticleIcon,
  Speed as SpeedIcon,
  Psychology as PsychologyIcon,
  ExpandMore as ExpandMoreIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';

import type { AsyncStatus } from '../../../shared/types';
import type { ApiSourceSearchResult, SourceItem } from '../types';
import SourceDetailDialog from './SourceDetailDialog';

interface SourcesPanelProps {
  sources: SourceItem[];
  onSourceClick: (source: SourceItem) => void;
  onUpload: (file: File | null) => void;
  uploadState: AsyncStatus;
  searchState: AsyncStatus;
  searchNotice: string;
  searchResults: ApiSourceSearchResult[];
  onSearch: (payload: { query: string; engine: string; mode: string }) => void;
  onRemoveSources: (sourceIds: number[]) => Promise<boolean>;
  onRemoveSource: (sourceId: number) => Promise<boolean>;
  isDemo: boolean;
  error: string;
  isLoading: boolean;
  removeState: AsyncStatus;
  onRetry: () => void;
}

function SourcesPanel({
  sources,
  onSourceClick,
  onUpload,
  uploadState,
  searchState,
  searchNotice,
  searchResults,
  onSearch,
  onRemoveSources,
  onRemoveSource,
  isDemo,
  error,
  isLoading,
  removeState,
  onRetry,
}: SourcesPanelProps) {
  const uploadDisabled = isDemo || uploadState === 'loading';
  const isSearching = searchState === 'loading';
  const [searchQuery, setSearchQuery] = useState('');
  const [engine, setEngine] = useState('Web');
  const [mode, setMode] = useState('Fast Research');
  const [selectedSourceIds, setSelectedSourceIds] = useState<Record<number, boolean>>({});
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [activeSourceId, setActiveSourceId] = useState<number | null>(null);
  const [batchMenuAnchorEl, setBatchMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [engineMenuAnchor, setEngineMenuAnchor] = useState<null | HTMLElement>(null);
  const [modeMenuAnchor, setModeMenuAnchor] = useState<null | HTMLElement>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<SourceItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenDetail = useCallback((source: SourceItem) => {
    setSelectedSource(source);
    setDetailDialogOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailDialogOpen(false);
  }, []);

  useEffect(() => {
    if (!sources.length) {
      setSelectedSourceIds({});
      return;
    }
    // Default to all sources selected
    setSelectedSourceIds((prev) => {
      const next: Record<number, boolean> = {};
      const hasExistingSelection = Object.keys(prev).length > 0;
      sources.forEach((source) => {
        // If user has made selections before, preserve them; otherwise select all by default
        next[source.id] = hasExistingSelection ? Boolean(prev[source.id]) : true;
      });
      return next;
    });
  }, [sources]);

  const allSelected = useMemo(
    () => sources.length > 0 && sources.every((source) => selectedSourceIds[source.id]),
    [sources, selectedSourceIds],
  );
  const selectedIds = useMemo(
    () => sources.filter((source) => selectedSourceIds[source.id]).map((source) => source.id),
    [sources, selectedSourceIds],
  );
  const removeDisabled = isDemo || removeState === 'loading' || selectedIds.length === 0;

  function handleToggleAll() {
    if (allSelected) {
      setSelectedSourceIds({});
      return;
    }
    const next: Record<number, boolean> = {};
    sources.forEach((source) => {
      next[source.id] = true;
    });
    setSelectedSourceIds(next);
  }

  function handleToggleSource(id: number) {
    setSelectedSourceIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  const handleSearch = () => {
    if (isSearching) return;
    onSearch({ query: searchQuery, engine, mode });
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, sourceId: number) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setActiveSourceId(sourceId);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setActiveSourceId(null);
  };

  const getEngineIcon = () => {
    switch (engine) {
      case 'Scholar':
        return <ScholarIcon fontSize="small" />;
      case 'Docs':
        return <ArticleIcon fontSize="small" />;
      default:
        return <LanguageIcon fontSize="small" />;
    }
  };

  const getModeIcon = () => {
    return mode === 'Deep Research' ? (
      <PsychologyIcon fontSize="small" />
    ) : (
      <SpeedIcon fontSize="small" />
    );
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5, p: { xs: 1.5, sm: 2 }, minHeight: 0 }}>
      {/* Upload Button */}
      <Button
        component="label"
        variant="outlined"
        fullWidth
        size="small"
        startIcon={uploadState === 'loading' ? <CircularProgress size={12} /> : <CloudUploadIcon fontSize="small" />}
        disabled={uploadDisabled}
        sx={{
          borderRadius: 5,
          py: 0.875,
          borderStyle: 'dashed',
          borderWidth: 1,
          fontSize: '0.75rem',
          '&:hover': {
            borderStyle: 'dashed',
            bgcolor: 'action.hover',
          },
        }}
      >
        {uploadState === 'loading' ? '上传中…' : '添加来源'}
        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept=".txt,.md,.markdown,text/plain,text/markdown"
          onChange={(event) => onUpload(event.target.files?.[0] ?? null)}
          disabled={uploadDisabled}
        />
      </Button>

      {/* Search Section - Like image 1 design */}
      <Paper
        variant="outlined"
        sx={{
          borderRadius: 2.5,
          overflow: 'hidden',
        }}
      >
        {/* Search Input */}
        <TextField
          fullWidth
          size="small"
          placeholder="在网络中搜索新来源"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSearch();
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={handleSearch}
                  disabled={isSearching}
                  sx={{
                    width: 28,
                    height: 28,
                    bgcolor: 'primary.main',
                    color: 'white',
                    borderRadius: '50%',
                    '&:hover': { bgcolor: 'primary.dark' },
                    '&.Mui-disabled': { bgcolor: 'grey.300' },
                  }}
                >
                  {isSearching ? <CircularProgress size={14} color="inherit" /> : <ArrowForwardIcon sx={{ fontSize: 16 }} />}
                </IconButton>
              </InputAdornment>
            ),
            sx: { fontSize: '0.8125rem' },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              '& fieldset': { border: 'none' },
            },
          }}
        />

        {/* Search Options - Below search bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 1,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'grey.50',
          }}
        >
          {/* Engine Select */}
          <Button
            variant="outlined"
            size="small"
            onClick={(e) => setEngineMenuAnchor(e.currentTarget)}
            startIcon={getEngineIcon()}
            endIcon={<ExpandMoreIcon sx={{ fontSize: 14 }} />}
            sx={{
              borderRadius: 5,
              textTransform: 'none',
              fontSize: '0.75rem',
              py: 0.25,
              px: 1.25,
              borderColor: 'divider',
              color: 'text.primary',
              '&:hover': { borderColor: 'grey.400' },
            }}
          >
            {engine}
          </Button>
          <Menu
            anchorEl={engineMenuAnchor}
            open={Boolean(engineMenuAnchor)}
            onClose={() => setEngineMenuAnchor(null)}
          >
            {['Web', 'Scholar', 'Docs'].map((opt) => (
              <MenuItem
                key={opt}
                selected={engine === opt}
                onClick={() => { setEngine(opt); setEngineMenuAnchor(null); }}
                sx={{ fontSize: '0.75rem' }}
              >
                {opt}
              </MenuItem>
            ))}
          </Menu>

          {/* Mode Select */}
          <Button
            variant="outlined"
            size="small"
            onClick={(e) => setModeMenuAnchor(e.currentTarget)}
            startIcon={getModeIcon()}
            endIcon={<ExpandMoreIcon sx={{ fontSize: 14 }} />}
            sx={{
              borderRadius: 5,
              textTransform: 'none',
              fontSize: '0.75rem',
              py: 0.25,
              px: 1.25,
              borderColor: 'divider',
              color: 'text.primary',
              '&:hover': { borderColor: 'grey.400' },
            }}
          >
            {mode}
          </Button>
          <Menu
            anchorEl={modeMenuAnchor}
            open={Boolean(modeMenuAnchor)}
            onClose={() => setModeMenuAnchor(null)}
          >
            {['Fast Research', 'Deep Research'].map((opt) => (
              <MenuItem
                key={opt}
                selected={mode === opt}
                onClick={() => { setMode(opt); setModeMenuAnchor(null); }}
                sx={{ fontSize: '0.75rem' }}
              >
                {opt}
              </MenuItem>
            ))}
          </Menu>
        </Box>
      </Paper>

      {/* Search Status */}
      {(isSearching || searchNotice) && (
        <Typography variant="caption" color="text.secondary">
          {isSearching ? '搜索中…' : searchNotice}
        </Typography>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="caption" fontWeight={600}>
              搜索结果
            </Typography>
            <Chip label={`${searchResults.length} 条`} size="small" />
          </Stack>
          <Stack spacing={1}>
            {searchResults.map((item) => (
              <Box
                key={`${item.title}-${item.url}`}
                component={Link}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                sx={{
                  display: 'block',
                  p: 1,
                  borderRadius: 1.5,
                  bgcolor: 'grey.50',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: 'grey.100',
                  },
                }}
              >
                <Typography variant="caption" fontWeight={600} color="text.primary" sx={{ display: 'block', mb: 0.25, lineHeight: 1.3 }}>
                  {item.title}
                </Typography>
                {item.snippet && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25, fontSize: '0.625rem', lineHeight: 1.3 }}>
                    {item.snippet}
                  </Typography>
                )}
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.625rem' }}>
                  {item.source || '来源推荐'}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Select All & Batch Actions */}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
          选择所有来源
        </Typography>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Checkbox
            checked={allSelected}
            onChange={handleToggleAll}
            size="small"
            sx={{ '&.Mui-checked': { color: 'primary.main' } }}
          />
          <IconButton
            size="small"
            onClick={(e) => setBatchMenuAnchorEl(e.currentTarget)}
            disabled={removeDisabled}
            sx={{ border: '1px solid', borderColor: 'divider', width: 22, height: 22 }}
          >
            <MoreHorizIcon fontSize="small" />
          </IconButton>
          <Menu
            anchorEl={batchMenuAnchorEl}
            open={Boolean(batchMenuAnchorEl)}
            onClose={() => setBatchMenuAnchorEl(null)}
          >
            <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, py: 0.75, display: 'block', fontSize: '0.6875rem' }}>
              已选择 {selectedIds.length} 个来源
            </Typography>
            <Divider />
            <MenuItem
              onClick={async () => {
                setBatchMenuAnchorEl(null);
                const label =
                  selectedIds.length === 1
                    ? '确定要移除已选的 1 个来源吗？'
                    : `确定要移除已选的 ${selectedIds.length} 个来源吗？`;
                if (!window.confirm(label)) return;
                const success = await onRemoveSources(selectedIds);
                if (success) {
                  setSelectedSourceIds({});
                }
              }}
              sx={{ color: 'error.main' }}
            >
              <ListItemIcon>
                <DeleteIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: '0.75rem' }}>删除已选来源</ListItemText>
            </MenuItem>
          </Menu>
        </Stack>
      </Stack>

      {/* Sources List */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {isLoading ? (
          <Stack spacing={1}>
            <Skeleton variant="rounded" height={36} sx={{ borderRadius: 2 }} />
            <Skeleton variant="rounded" height={36} sx={{ borderRadius: 2 }} />
            <Skeleton variant="rounded" height={36} width="70%" sx={{ borderRadius: 2 }} />
          </Stack>
        ) : sources.length === 0 ? (
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              textAlign: 'center',
              borderStyle: 'dashed',
              borderRadius: 2.5,
              bgcolor: 'grey.50',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              暂无来源。添加文档后这里会展示来源列表。
            </Typography>
          </Paper>
        ) : (
          <List disablePadding sx={{ '& .MuiListItem-root': { mb: 0.5 } }}>
            {sources.map((source) => (
              <ListItem
                key={source.id}
                disablePadding
                secondaryAction={
                  <Stack direction="row" alignItems="center" spacing={0.25}>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, source.id)}
                      sx={{
                        width: 22,
                        height: 22,
                        opacity: 0,
                        transition: 'opacity 0.2s',
                        '.MuiListItem-root:hover &': { opacity: 1 },
                      }}
                    >
                      <MoreHorizIcon fontSize="small" />
                    </IconButton>
                    <Checkbox
                      checked={Boolean(selectedSourceIds[source.id])}
                      onChange={() => handleToggleSource(source.id)}
                      size="small"
                    />
                  </Stack>
                }
              >
                <ListItemButton
                  onClick={() => handleOpenDetail(source)}
                  sx={{
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    py: 0.75,
                    px: 1,
                    minHeight: 36,
                    '&:hover': {
                      borderColor: 'grey.300',
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: 1.5,
                        bgcolor: 'grey.100',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <DescriptionIcon fontSize="small" color="action" />
                    </Box>
                  </ListItemIcon>
                  <ListItemText
                    primary={source.title}
                    primaryTypographyProps={{
                      variant: 'caption',
                      fontWeight: 600,
                      noWrap: true,
                      fontSize: '0.75rem',
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* Source Item Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            const source = sources.find((s) => s.id === activeSourceId);
            if (source) onSourceClick(source);
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <DescriptionIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>查看摘要</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={async () => {
            if (isDemo || removeState === 'loading' || !activeSourceId) return;
            const source = sources.find((s) => s.id === activeSourceId);
            handleMenuClose();
            if (!source) return;
            if (!window.confirm(`确定要删除「${source.title}」吗？此操作不可撤销。`)) return;
            await onRemoveSource(activeSourceId);
          }}
          disabled={isDemo || removeState === 'loading'}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>{removeState === 'loading' ? '删除中…' : '删除来源'}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Error State */}
      {error && (
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="caption" color="error">
            {error}
          </Typography>
          <Button size="small" onClick={onRetry} sx={{ minWidth: 'auto' }}>
            重试
          </Button>
        </Stack>
      )}

      {/* Source Detail Dialog */}
      <SourceDetailDialog
        open={detailDialogOpen}
        source={selectedSource}
        onClose={handleCloseDetail}
      />
    </Box>
  );
}

export default memo(SourcesPanel);
