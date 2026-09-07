import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { LoadingScreen } from './components/layout/LoadingScreen';
import { Header } from './components/layout/Header';
import { RoleBanners } from './components/layout/RoleBanners';
import { MetricQuickCards } from './components/layout/MetricQuickCards';
import { Footer } from './components/layout/Footer';
import { AppModals } from './components/layout/AppModals';
import { AppRoutes } from './routes/AppRoutes';
import { usePageTitle } from './hooks/usePageTitle';
import { useInventoryData } from './hooks/useInventoryData';
import { useInventoryFilter } from './hooks/useInventoryFilter';
import { useAppModals } from './hooks/useAppModals';
import { useExcelExport } from './hooks/useExcelExport';

function AppContent() {
  const { user, logout, isManager, isInventoryOwner, isScanner, needsOnboarding, isLoading, isAuthenticated } = useAuth();
  const pageMeta = usePageTitle();

  const {
    rooms,
    items,
    anomalies,
    mashaList,
    holders,
    onlineScannersCount,
    onlineScanners,
    undoToast,
    setUndoToast,
    loading,
    fetchData,
  } = useInventoryData(isAuthenticated);

  const {
    myInventoryOnly,
    setMyInventoryOnly,
    hasCorrespondentOwner,
    displayRooms,
    displayItems,
    displayAnomalies,
  } = useInventoryFilter(user, rooms, items, anomalies);

  const modals = useAppModals();
  const { exporting, handleExportExcel } = useExcelExport();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-2.5 sm:p-6 md:p-8 space-y-3.5 sm:space-y-8 max-w-full overflow-x-hidden">
      {/* Top Header */}
      <Header
        pageMeta={pageMeta}
        user={user}
        isManager={isManager}
        isInventoryOwner={isInventoryOwner}
        onOpenEditPN={modals.openEditPNModal}
        onLogout={logout}
        holdersCount={holders.length}
        mashaCount={mashaList.length}
        displayItemsCount={displayItems.length}
        exporting={exporting}
        onExportExcel={handleExportExcel}
        onOpenUploadModal={modals.openUploadModal}
        hasCorrespondentOwner={hasCorrespondentOwner}
        myInventoryOnly={myInventoryOnly}
        onToggleMyInventory={() => {
          if (hasCorrespondentOwner) {
            setMyInventoryOnly(!myInventoryOnly);
          }
        }}
        onOpenRoomModal={modals.openRoomModal}
        onOpenActionHistory={modals.openActionHistory}
        loading={loading}
        onRefresh={fetchData}
        onlineScannersCount={onlineScannersCount}
        onlineScanners={onlineScanners}
      />

      {/* Role and permission alert banners */}
      <RoleBanners
        user={user}
        isInventoryOwner={isInventoryOwner}
        isScanner={isScanner}
        hasCorrespondentOwner={hasCorrespondentOwner}
        onOpenEditPN={modals.openEditPNModal}
      />

      {/* Metric Quick Cards */}
      <MetricQuickCards
        displayAnomalies={displayAnomalies}
        myInventoryOnly={myInventoryOnly}
      />

      {/* Page Routes */}
      <main>
        <AppRoutes
          user={user}
          displayRooms={displayRooms}
          displayItems={displayItems}
          displayAnomalies={displayAnomalies}
          holders={holders}
          mashaList={mashaList}
          onlineScannersCount={onlineScannersCount}
          onlineScanners={onlineScanners}
          myInventoryOnly={myInventoryOnly}
          onManageRooms={modals.openRoomModal}
          onRefresh={fetchData}
        />
      </main>

      {/* Application Modals Layer */}
      <AppModals
        isManager={isManager}
        needsOnboarding={needsOnboarding}
        rooms={rooms}
        isUploadModalOpen={modals.isUploadModalOpen}
        onCloseUploadModal={modals.closeUploadModal}
        isRoomModalOpen={modals.isRoomModalOpen}
        onCloseRoomModal={modals.closeRoomModal}
        isActionHistoryOpen={modals.isActionHistoryOpen}
        onCloseActionHistory={modals.closeActionHistory}
        isEditPNModalOpen={modals.isEditPNModalOpen}
        onCloseEditPNModal={modals.closeEditPNModal}
        undoToast={undoToast}
        onCloseUndoToast={() => setUndoToast(null)}
        onRefreshData={fetchData}
      />

      {/* Global Application Footer */}
      <Footer />
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
