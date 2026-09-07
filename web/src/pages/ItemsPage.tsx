import React from 'react';
import type { OfficialItem } from '../types';
import { InventoryCatalog } from '../components/InventoryCatalog';

interface ItemsPageProps {
  items: OfficialItem[];
}

export const ItemsPage: React.FC<ItemsPageProps> = ({ items }) => {
  return <InventoryCatalog items={items} />;
};

export default ItemsPage;
