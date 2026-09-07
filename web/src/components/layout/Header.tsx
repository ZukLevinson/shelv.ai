import type { User, OnlineScannerInfo } from '../../types';
import type { PageMeta } from '../../types/navigation';
import { TopBar } from './TopBar';
import { NavigationToolbar } from './NavigationToolbar';

export interface HeaderProps {
  pageMeta: PageMeta;
  user: User | null;
  isManager: boolean;
  isInventoryOwner: boolean;
  onOpenEditPN: () => void;
  onLogout: () => void;
  holdersCount: number;
  mashaCount: number;
  displayItemsCount: number;
  exporting: boolean;
  onExportExcel: () => void;
  onOpenUploadModal: () => void;
  hasCorrespondentOwner: boolean;
  myInventoryOnly: boolean;
  onToggleMyInventory: () => void;
  onOpenRoomModal: () => void;
  onOpenActionHistory: () => void;
  loading: boolean;
  onRefresh: () => void;
  onlineScannersCount: number;
  onlineScanners: OnlineScannerInfo[];
}

export function Header({
  pageMeta,
  user,
  isManager,
  isInventoryOwner,
  onOpenEditPN,
  onLogout,
  holdersCount,
  mashaCount,
  displayItemsCount,
  exporting,
  onExportExcel,
  onOpenUploadModal,
  hasCorrespondentOwner,
  myInventoryOnly,
  onToggleMyInventory,
  onOpenRoomModal,
  onOpenActionHistory,
  loading,
  onRefresh,
  onlineScannersCount,
  onlineScanners,
}: HeaderProps) {
  return (
    <header className="flex flex-col gap-3 sm:gap-3.5 border-b border-gray-800/80 pb-3.5 sm:pb-4">
      <TopBar
        pageMeta={pageMeta}
        user={user}
        isManager={isManager}
        isInventoryOwner={isInventoryOwner}
        onOpenEditPN={onOpenEditPN}
        onLogout={onLogout}
      />
      <NavigationToolbar
        holdersCount={holdersCount}
        mashaCount={mashaCount}
        displayItemsCount={displayItemsCount}
        isManager={isManager}
        exporting={exporting}
        onExportExcel={onExportExcel}
        onOpenUploadModal={onOpenUploadModal}
        hasCorrespondentOwner={hasCorrespondentOwner}
        myInventoryOnly={myInventoryOnly}
        onToggleMyInventory={onToggleMyInventory}
        onOpenRoomModal={onOpenRoomModal}
        onOpenActionHistory={onOpenActionHistory}
        loading={loading}
        onRefresh={onRefresh}
        onlineScannersCount={onlineScannersCount}
        onlineScanners={onlineScanners}
      />
    </header>
  );
}
