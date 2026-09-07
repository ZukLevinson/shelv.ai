import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL, WS_URL } from '../config';
import type { Room, OfficialItem, AnomalyReport, InventoryHolder, OnlineScannerInfo } from '../types';
import type { UndoToastData } from '../components/UndoToast';

export const useInventoryData = (isAuthenticated: boolean) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [items, setItems] = useState<OfficialItem[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyReport | null>(null);
  const [mashaList, setMashaList] = useState<any[]>([]);
  const [holders, setHolders] = useState<InventoryHolder[]>([]);
  const [onlineScannersCount, setOnlineScannersCount] = useState<number>(0);
  const [onlineScanners, setOnlineScanners] = useState<OnlineScannerInfo[]>([]);
  const [undoToast, setUndoToast] = useState<UndoToastData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [roomsRes, itemsRes, anomaliesRes, mashaRes, holdersRes, onlineRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/inventory/rooms`),
        axios.get(`${API_BASE_URL}/api/inventory/items`),
        axios.get(`${API_BASE_URL}/api/anomalies`),
        axios.get(`${API_BASE_URL}/api/inventory/masha-registry`),
        axios.get(`${API_BASE_URL}/api/inventory/holders`),
        axios.get(`${API_BASE_URL}/api/sweep/scanners/online`).catch(() => ({ data: { count: 0, scanners: [] } })),
      ]);
      setRooms(roomsRes.data);
      setItems(itemsRes.data);
      setAnomalies(anomaliesRes.data);
      setMashaList(mashaRes.data);
      setHolders(holdersRes.data);
      if (onlineRes?.data) {
        setOnlineScannersCount(onlineRes.data.count || 0);
        setOnlineScanners(onlineRes.data.scanners || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    fetchData();

    const ws = new WebSocket(WS_URL);
    ws.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data);
        if (data.type === 'ANOMALIES_UPDATED') {
          setAnomalies(data.payload);
        } else if (data.type === 'SCANNERS_ONLINE_CHANGED') {
          setOnlineScannersCount(data.payload?.count || 0);
          setOnlineScanners(data.payload?.scanners || []);
        } else if (data.type === 'CONNECTED' && data.payload?.onlineScannersCount !== undefined) {
          setOnlineScannersCount(data.payload.onlineScannersCount);
          setOnlineScanners(data.payload.scanners || []);
        } else if (data.type === 'ACTION_LOGGED') {
          setUndoToast({
            actionId: data.payload.id,
            description: data.payload.description,
            durationMs: 12000,
          });
        } else if (
          data.type === 'ITEM_SCANNED' ||
          data.type === 'TRANSFER_APPROVED' ||
          data.type === 'INVENTORY_SYNCED' ||
          data.type === 'MASHA_UPDATED' ||
          data.type === 'ROOMS_UPDATED' ||
          data.type === 'HOLDERS_UPDATED' ||
          data.type === 'SCANS_UPDATED' ||
          data.type === 'ACTION_REVERTED'
        ) {
          fetchData();
        }
      } catch {}
    };

    return () => ws.close();
  }, [isAuthenticated, fetchData]);

  return {
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
  };
};
