import { useEffect, useMemo, useState } from 'react';
import { ICONS } from './data/icons.jsx';

import TopNav from './components/TopNav.jsx';
import Home from './components/Home.jsx';
import Reports from './components/Reports.jsx';
import SearchBuilder from './components/SearchBuilder.jsx';
import SearchFieldsModal from './components/SearchFieldsModal.jsx';
import SubTabs from './components/SubTabs.jsx';
import FilterBar from './components/FilterBar.jsx';
import TableToolbar from './components/TableToolbar.jsx';
import DataTable from './components/DataTable.jsx';
import AIPanel from './components/AIPanel.jsx';
import CustomExportModal from './components/CustomExportModal.jsx';
import AIExportModal from './components/AIExportModal.jsx';
import AskAnalystModal from './components/AskAnalystModal.jsx';
import UserProfileModal from './components/UserProfileModal.jsx';
import Analytics from './components/Analytics.jsx';
import Toast from './components/Toast.jsx';
import { useToast } from './hooks/useToast.js';
import { useAppData } from './hooks/useAppData.js';
import { buildCriteriaSummary } from './utils/searchSummary.js';

export default function App() {
  const { data, error, loading } = useAppData();

  // 'home' | 'module' | 'analytics' | 'reportsHome' — which top-level page is showing
  const [page, setPage] = useState('home');

  const [moduleKey, setModuleKey] = useState('drugs');
  const [viewKey, setViewKey] = useState('basic');
  const [reportContext, setReportContext] = useState(null); // { catKey, catLabel, itemLabel, viewKey }

  const [hiddenCols, setHiddenCols] = useState(new Set());
  const [builderOpen, setBuilderOpen] = useState(false);
  const [conditions, setConditions] = useState([]);
  const [searchSummary, setSearchSummary] = useState('');
  const [fieldsModalOpen, setFieldsModalOpen] = useState(false);

  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [customExportOpen, setCustomExportOpen] = useState(false);
  const [aiExportOpen, setAiExportOpen] = useState(false);
  const [aiExportSeedQuery, setAiExportSeedQuery] = useState('Summarize this result set by phase and indication.');
  const [askAnalystOpen, setAskAnalystOpen] = useState(false);
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const [savedSearches, setSavedSearches] = useState([]);

  const { message, showToast } = useToast();

  useEffect(() => {
    if (data) {
      setSavedSearches(data.savedSearches);
      setConditions(data.searchDefaults.defaultConditions);
    }
  }, [data]);

  const MODULES = data?.modules;
  const REPORTS_CATEGORIES = data?.reportsCategories?.reportsCategories;
  const REPORTS_BASE_LABELS = data?.reportsCategories?.reportsBaseLabels;

  const fileNameSeed = useMemo(
    () => `veridian_export_${moduleKey}_${viewKey}_${new Date().toISOString().slice(0, 10)}`,
    [moduleKey, viewKey]
  );

  if (loading) return <div className="app-loading">Loading Veridian…</div>;
  if (error) return <div className="app-loading app-error">Couldn&apos;t load application data. Please refresh.</div>;

  const baseModule = MODULES[moduleKey];
  const isReportView = moduleKey === 'reports' && reportContext;
  const activeModule = isReportView
    ? {
        ...baseModule,
        desc: `${REPORTS_BASE_LABELS[reportContext.viewKey]} filtered to ${reportContext.catLabel}: ${reportContext.itemLabel}`,
        filters: [`${reportContext.catLabel}: ${reportContext.itemLabel}`],
      }
    : baseModule;
  const activeView = activeModule.views[viewKey];
  const ModuleIcon = ICONS[activeModule.icon];

  const goHome = () => setPage('home');
  const goAnalytics = () => setPage('analytics');
  const goReports = () => setPage('reportsHome');

  const selectModule = (key, opts) => {
    setModuleKey(key);
    setViewKey(Object.keys(MODULES[key].views)[0]);
    setHiddenCols(new Set());
    setPage('module');
    if (key !== 'reports') setReportContext(null);
    if (opts?.openBuilder) setBuilderOpen(true);
  };

  const openReportView = (catKey, itemLabel) => {
    const cat = REPORTS_CATEGORIES[catKey];
    setModuleKey('reports');
    setViewKey(cat.viewKey);
    setHiddenCols(new Set());
    setReportContext({ catKey, catLabel: cat.label, itemLabel, viewKey: cat.viewKey });
    setPage('module');
  };

  const selectView = (key) => {
    setViewKey(key);
    setHiddenCols(new Set());
  };

  const toggleCol = (i) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const addFieldsToBuilder = (fields) => {
    setConditions((prev) => {
      const next = [...prev];
      fields.forEach((f) => {
        next.push({ ...f, join: next.length ? 'AND' : undefined });
      });
      return next;
    });
    setBuilderOpen(true);
    setSearchSummary('');
    const n = fields.length;
    showToast(
      n > 1
        ? `Added ${n} fields to your search builder — review and confirm to run.`
        : `Added "${fields[0].field}" to your search builder — review and confirm to run.`
    );
  };

  const openAIExportWithQuery = (query) => {
    setAiExportSeedQuery(query);
    setAiExportOpen(true);
  };

  return (
    <div className="app">
      <TopNav
        currentModuleKey={moduleKey}
        homeActive={page === 'home'}
        analyticsActive={page === 'analytics'}
        reportsActive={page === 'reportsHome' || (page === 'module' && moduleKey === 'reports')}
        onShowHome={goHome}
        onShowReports={goReports}
        onSelectModule={selectModule}
        onOpenAskAnalyst={() => setAskAnalystOpen(true)}
        onOpenProfile={() => setUserProfileOpen(true)}
        showToast={showToast}
        modules={MODULES}
        platforms={data.platforms}
        navOrderData={data.nav}
        userProfile={data.userProfile}
      />

      <div className="main">
        {page === 'home' && (
          <Home
            onSelectModule={selectModule}
            onSelectModuleView={selectView}
            onOpenBuilder={() => setBuilderOpen(true)}
            onShowAnalytics={goAnalytics}
            savedSearches={savedSearches}
            setSavedSearches={setSavedSearches}
            showToast={showToast}
            modules={MODULES}
            navOrder={data.nav.navOrder}
            platforms={data.platforms}
            homeKpis={data.homeKpis}
            userProfile={data.userProfile}
            homeSearchTags={data.homeSearchTags}
          />
        )}

        {page === 'analytics' && <Analytics />}

        {page === 'reportsHome' && (
          <Reports onOpenReportView={openReportView} reportsCategories={REPORTS_CATEGORIES} />
        )}

        {page === 'module' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div className="topbar">
              {isReportView && (
                <div style={{ marginBottom: 8 }}>
                  <a
                    href="#"
                    className="back-to-reports"
                    onClick={(e) => {
                      e.preventDefault();
                      goReports();
                    }}
                  >
                    ← Back to Reports
                  </a>
                </div>
              )}
              <div className="topbar-title-row">
                <div className="module-heading">
                  <ModuleIcon />
                  <div>
                    <h1>{activeModule.label}</h1>
                    <p>{activeModule.desc}</p>
                  </div>
                </div>
                <div className="topbar-actions">
                  <button className="btn" onClick={() => setFieldsModalOpen(true)}>
                    <ICONS.fields />
                    Search fields
                  </button>
                  <button
                    className={`btn ${builderOpen ? 'active' : ''}`}
                    onClick={() => setBuilderOpen((v) => !v)}
                  >
                    <ICONS.build />
                    Build search
                  </button>
                  <button className="btn" onClick={() => showToast('Search saved to your workspace library.')}>
                    <ICONS.star />
                    Save search
                  </button>
                </div>
              </div>

              <div className="search-row">
                <div className="search-box">
                  <ICONS.search />
                  <input type="text" placeholder="Search drug names, sponsors, indications, NCT-style IDs…" />
                  <span className="kbd">⌘K</span>
                </div>
                <button className="btn btn-ai" onClick={() => setAiPanelOpen(true)}>
                  <ICONS.sparkles />
                  Ask AI
                </button>
              </div>

              <SearchBuilder
                open={builderOpen}
                conditions={conditions}
                setConditions={setConditions}
                onRunSearch={() => {
                  setSearchSummary(buildCriteriaSummary(conditions));
                  showToast('Search executed — results refreshed below.');
                }}
                onClear={() => setSearchSummary('')}
                blankCondition={data.searchDefaults.blankCondition}
                valueOptions={data.valueOptions}
              />

              <SubTabs views={activeModule.views} activeView={viewKey} onSelect={selectView} />
            </div>

            <FilterBar filters={activeModule.filters} onAddFilter={() => setFieldsModalOpen(true)} />

            {searchSummary && (
              <div className="search-summary-banner">
                <span className="ssb-text">
                  Showing results for: <b>{searchSummary}</b>
                </span>
                <button
                  onClick={() => {
                    setBuilderOpen(true);
                  }}
                >
                  Edit search
                </button>
              </div>
            )}

            <TableToolbar
              resultCount={activeModule.count}
              cols={activeView.cols}
              hiddenCols={hiddenCols}
              onToggleCol={toggleCol}
              onQuickExport={() => showToast('Exporting current view to CSV…')}
              onCustomExport={() => setCustomExportOpen(true)}
              onAIExport={() => setAiExportOpen(true)}
            />

            <div className={`content-split ${aiPanelOpen ? 'ai-open' : ''}`}>
              <div className="table-wrap">
                <DataTable
                  view={activeView}
                  resultCount={activeModule.count}
                  hiddenCols={hiddenCols}
                  resetKey={`${moduleKey}-${viewKey}`}
                  valueOptions={data.valueOptions}
                />
              </div>

              <AIPanel
                open={aiPanelOpen}
                onClose={() => setAiPanelOpen(false)}
                moduleLabel={activeModule.label}
                viewLabel={activeView.label}
                rowCount={activeView.rows.length}
                onOpenAIExport={openAIExportWithQuery}
              />
            </div>
          </div>
        )}
      </div>

      <SearchFieldsModal
        open={fieldsModalOpen}
        onClose={() => setFieldsModalOpen(false)}
        moduleKey={moduleKey}
        moduleLabel={activeModule.label}
        onAddFields={addFieldsToBuilder}
        fieldDefs={data.fields.fieldDefs}
        fieldTypeDefaultOp={data.fields.fieldTypeDefaultOp}
        fieldTypeDefaultVal={data.fields.fieldTypeDefaultVal}
        valueOptions={data.valueOptions}
      />

      <CustomExportModal
        open={customExportOpen}
        onClose={() => setCustomExportOpen(false)}
        cols={activeView.cols}
        resultCount={activeModule.count}
        fileNameSeed={fileNameSeed}
        onExport={() => showToast("Custom export queued — you'll get a download notification shortly.")}
      />

      <AIExportModal
        open={aiExportOpen}
        onClose={() => setAiExportOpen(false)}
        initialQuery={aiExportSeedQuery}
        resultCount={activeModule.count}
        onExport={() => showToast('Running AI query across rows and preparing your Excel file…')}
      />

      <AskAnalystModal
        open={askAnalystOpen}
        onClose={() => setAskAnalystOpen(false)}
        currentModuleKey={moduleKey}
        showToast={showToast}
        modules={MODULES}
      />

      <UserProfileModal
        open={userProfileOpen}
        onClose={() => setUserProfileOpen(false)}
        savedSearches={savedSearches}
        onManageSavedSearches={goHome}
        showToast={showToast}
        modules={MODULES}
        profileModuleAccess={data.profileModuleAccess}
        userProfile={data.userProfile}
      />

      <Toast message={message} />
    </div>
  );
}

