import { create } from 'zustand';
import { loadBrandFile } from '../lib/brands/loader';
import { getVendorConfigs } from '../lib/api';
import type { BrandItem, LoadProgress, VendorConfig } from '../lib/brands/types';

interface BrandsState {
  vendors: Record<string, VendorConfig>;
  allItems: BrandItem[];
  loadProgress: LoadProgress;
  error: string | null;
  loaded: boolean;
}

interface BrandsActions {
  loadBrands: () => Promise<void>;
}

export const useBrandsStore = create<BrandsState & BrandsActions>((set, get) => ({
  vendors: {},
  allItems: [],
  loadProgress: { phase: 'fetching', bytesLoaded: 0 },
  error: null,
  loaded: false,

  loadBrands: async () => {
    if (get().loaded) return;

    set({ loadProgress: { phase: 'fetching', bytesLoaded: 0 }, error: null });

    try {
      const vendorConfigs = await getVendorConfigs();
      if (!vendorConfigs || Object.keys(vendorConfigs).length === 0) {
        set({ error: 'No healthcare providers configured', loaded: true });
        return;
      }
      set({ vendors: vendorConfigs });

      const allBrandItems: BrandItem[] = [];
      for (const [vendorName, config] of Object.entries(vendorConfigs)) {
        for (const brandFile of config.brandFiles) {
          try {
            const items = await loadBrandFile(brandFile, (p) => set({ loadProgress: p }));
            for (const item of items) {
              (item as any)._vendor = vendorName;
            }
            allBrandItems.push(...items);
          } catch (err) {
            console.warn(`Failed to load brand file ${brandFile} for ${vendorName}:`, err);
          }
        }
      }

      if (allBrandItems.length === 0) {
        set({ error: 'Failed to load provider directory', loaded: true });
        return;
      }

      set({
        allItems: allBrandItems,
        loadProgress: { phase: 'ready', bytesLoaded: 0 },
        loaded: true,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to initialize',
        loaded: true,
      });
    }
  },
}));
