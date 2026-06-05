import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { searchBrands, collapseBrands } from '../lib/brands/loader';
import type { BrandItem } from '../lib/brands/types';
import { useRecordsStore } from '../store/records';
import { useBrandsStore } from '../store/brands';
import { launchOAuth } from '../lib/smart/launch';
import ProviderSearch from '../components/ProviderSearch';
import ProviderCard from '../components/ProviderCard';
import StatusMessage from '../components/StatusMessage';

const PAGE_SIZE = 100;

/**
 * ProviderSelectPage - unified for both standalone (/records/add) and
 * session mode (/records/add?session=XYZ).
 */
export default function ProviderSelectPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // Session ID from query param (session mode) or null (standalone)
  const sessionId = searchParams.get('session') || undefined;
  const backUrl = sessionId ? `/connect/${sessionId}` : '/records';

  // Brand data from store (cached in memory across navigations)
  const brands = useBrandsStore();

  const [error, setError] = useState<string | null>(null);
  
  // Pagination
  const [page, setPage] = useState(1);

  // Local search state (ephemeral UI)
  const [query, setQuery] = useState('');

  // Modal state
  const [selectedItem, setSelectedItem] = useState<BrandItem | null>(null);
  const [connecting, setConnecting] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const connectButtonRef = useRef<HTMLButtonElement>(null);

  // Load brands (no-op if already cached in memory)
  useEffect(() => {
    brands.loadBrands();
  }, []);

  // Derived search results (no effect/state syncing needed).
  const searchResults = useMemo(() => {
    const q = query.trim();
    if (!q) return brands.allItems;
    const matches = searchBrands(brands.allItems, q);
    return collapseBrands(brands.allItems, matches, q);
  }, [brands.allItems, query]);

  // Paginated view
  const displayedItems = searchResults.slice(0, page * PAGE_SIZE);

  // Keep keyboard focus in the search box when the page becomes interactive.
  useEffect(() => {
    if (!brands.loaded || selectedItem) return;
    searchInputRef.current?.focus();
  }, [brands.loaded, selectedItem]);

  // Move focus into the primary modal action when opening provider connect dialog.
  useEffect(() => {
    if (!selectedItem || connecting) return;
    const id = window.requestAnimationFrame(() => {
      connectButtonRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [selectedItem, connecting]);

  // Handle search
  const handleSearch = (q: string) => {
    setQuery(q);
    setPage(1); // Reset to first page on new search
  };

  // Handle provider selection
  const handleSelectProvider = (item: BrandItem) => {
    setSelectedItem(item);
  };

  // Handle connect (start OAuth)
  const handleConnect = async () => {
    if (!selectedItem) return;
    const effectiveSessionId = sessionId || 'local_' + crypto.randomUUID();

    const vendorName = (selectedItem as any)._vendor as string;
    const vendorConfig = brands.vendors[vendorName];
    if (!vendorConfig) {
      setError('Vendor configuration not found');
      return;
    }

    const endpoint = selectedItem.endpoints[0];
    if (!endpoint) {
      setError('No FHIR endpoint available for this provider');
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const storeSession = useRecordsStore.getState().session;
      await launchOAuth({
        fhirBaseUrl: endpoint.url,
        clientId: vendorConfig.clientId,
        scopes: vendorConfig.scopes,
        redirectUri: vendorConfig.redirectUrl || `${window.location.origin}/connect/callback`,
        sessionId: effectiveSessionId,
        publicKeyJwk: storeSession?.publicKeyJwk || null,
        providerName: selectedItem.displayName,
      });
    } catch (err) {
      setConnecting(false);
      setError(err instanceof Error ? err.message : 'Failed to start authorization');
    }
  };

  // Format progress message
  const getProgressMessage = () => {
    if (brands.loadProgress.phase === 'fetching') {
      const mb = (brands.loadProgress.bytesLoaded / 1024 / 1024).toFixed(1);
      return `Loading providers... ${mb} MB`;
    }
    if (brands.loadProgress.phase === 'parsing') {
      return 'Processing provider directory...';
    }
    return '';
  };

  const displayError = error || brands.error;

  // Loading / error states
  if (!brands.loaded) {
    return (
      <div className="page-centered">
        <div className="panel">
          <h1 className="page-title">Select a provider</h1>
          {displayError
            ? <StatusMessage status="error" message={displayError} />
            : <StatusMessage status="loading" message={getProgressMessage()} />
          }
          {displayError && (
            <button className="btn btn-secondary" onClick={() => navigate(backUrl)}>
              Back
            </button>
          )}
        </div>
      </div>
    );
  }

  // Standalone error after load (e.g. OAuth setup failure)
  if (displayError) {
    return (
      <div className="page-centered">
        <div className="panel">
          <h1 className="page-title">Select a provider</h1>
          <StatusMessage status="error" message={displayError} />
          <button className="btn btn-secondary" onClick={() => navigate(backUrl)}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="provider-select-container">
      <div className="provider-select-header">
        <button
          className="back-button"
          onClick={() => navigate(backUrl)}
        >
          Back
        </button>
        <h1>Select Your Healthcare Provider</h1>
        <p>
          Search for your hospital, clinic, or healthcare system.
          {brands.allItems.length > 0 && ` ${brands.allItems.length.toLocaleString()} providers available.`}
        </p>
      </div>

      <ProviderSearch
        onSearch={handleSearch}
        placeholder="Search by name, city, or state..."
        inputRef={searchInputRef}
      />

      <div className="provider-results">
        {displayedItems.length === 0 ? (
          <p className="no-results">No providers found matching "{query}"</p>
        ) : (
          <>
            <p className="results-count">
              {query
                ? `Showing ${displayedItems.length} of ${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`
                : `Showing ${displayedItems.length} of ${brands.allItems.length.toLocaleString()} providers`}
            </p>
            <div className="provider-grid">
              {displayedItems.map((item) => (
                <ProviderCard key={item.id} item={item} onClick={handleSelectProvider} />
              ))}
            </div>
            {displayedItems.length < searchResults.length && (
              <button
                className="btn load-more-btn"
                onClick={() => setPage(p => p + 1)}
              >
                Load More ({searchResults.length - displayedItems.length} remaining)
              </button>
            )}
          </>
        )}
      </div>

      {/* Confirmation Modal */}
      {selectedItem && (
        <div className="modal-backdrop" onClick={() => !connecting && setSelectedItem(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Connect to {selectedItem.displayName}?</h2>
            <p>
              You will be redirected to sign in to your patient portal.
              After signing in, your health records will be securely transferred.
            </p>
            {selectedItem.brandName !== selectedItem.displayName && (
              <p className="modal-brand">Part of: {selectedItem.brandName}</p>
            )}
            {displayError && <StatusMessage status="error" message={displayError} />}
            <div className="modal-buttons">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setSelectedItem(null);
                  setConnecting(false);
                }}
              >
                Cancel
              </button>
              <button className="btn" onClick={handleConnect} disabled={connecting} autoFocus ref={connectButtonRef}>
                {connecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
