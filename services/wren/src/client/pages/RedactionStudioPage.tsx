import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFhirData } from '../lib/connections';
import {
  countEnabledTerms,
  createRedactionProfile,
  getActiveProfile,
  getSuggestedTermCategoryLabel,
  loadRedactionState,
  normalizeTermForCompare,
  saveRedactionState,
  SUGGESTED_TERM_CATEGORY_ORDER,
  suggestTermGroupsFromRecords,
  upsertTerm,
  type RedactionProfile,
  type SuggestedTermGroup,
  type RedactionState,
} from '../lib/redaction';
import { useRecordsStore } from '../store/records';
import RecordsHeaderBar from '../components/RecordsHeaderBar';

function nowIso(): string {
  return new Date().toISOString();
}

function updateActiveProfile(state: RedactionState, mutate: (profile: RedactionProfile) => RedactionProfile): RedactionState {
  const active = getActiveProfile(state);
  return {
    ...state,
    profiles: state.profiles.map((profile) =>
      profile.id === active.id ? mutate(profile) : profile
    ),
  };
}

export default function RedactionStudioPage() {
  const nav = useNavigate();
  const [state, setState] = useState<RedactionState>(() => loadRedactionState());
  const [newTerm, setNewTerm] = useState('');
  const [newProfileName, setNewProfileName] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestedTermGroup[]>([]);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanStatus, setScanStatus] = useState('');

  const connections = useRecordsStore((s) => s.connections);
  const loaded = useRecordsStore((s) => s.loaded);
  const loadConnections = useRecordsStore((s) => s.loadConnections);

  useEffect(() => {
    if (!loaded) {
      void loadConnections();
    }
  }, [loaded, loadConnections]);

  const activeProfile = useMemo(() => getActiveProfile(state), [state]);
  const suggestionsByCategory = useMemo(
    () =>
      SUGGESTED_TERM_CATEGORY_ORDER
        .map((category) => ({
          category,
          groups: suggestions.filter((group) => group.primaryCategory === category),
        }))
        .filter((bucket) => bucket.groups.length > 0),
    [suggestions]
  );

  const commitState = (next: RedactionState) => {
    saveRedactionState(next);
    setState(loadRedactionState());
  };

  const handleAddTerm = () => {
    const value = newTerm.trim();
    if (!value) return;

    const next = updateActiveProfile(state, (profile) => upsertTerm(profile, value, 'manual'));
    commitState(next);
    setNewTerm('');

    const key = normalizeTermForCompare(value);
    if (!key) return;
    setSuggestions((prev) => prev.filter((item) => normalizeTermForCompare(item.primary) !== key));
  };

  const handleRemoveTerm = (termId: string) => {
    const next = updateActiveProfile(state, (profile) => ({
      ...profile,
      terms: profile.terms.filter((term) => term.id !== termId),
      updatedAt: nowIso(),
    }));
    commitState(next);
  };

  const handleClearAllTerms = () => {
    if (activeProfile.terms.length === 0) return;

    const next = updateActiveProfile(state, (profile) => ({
      ...profile,
      terms: [],
      updatedAt: nowIso(),
    }));
    commitState(next);
  };

  const handleCreateProfile = () => {
    const profile = createRedactionProfile(newProfileName || `Redaction Profile ${state.profiles.length + 1}`);
    commitState({
      ...state,
      profiles: [...state.profiles, profile],
      settings: {
        ...state.settings,
        activeProfileId: profile.id,
      },
    });
    setNewProfileName('');
    setSuggestions([]);
  };

  const handleDeleteProfile = () => {
    if (state.profiles.length <= 1) return;
    if (!confirm(`Delete profile "${activeProfile.name}"?`)) return;

    const remaining = state.profiles.filter((profile) => profile.id !== activeProfile.id);
    commitState({
      ...state,
      profiles: remaining,
      settings: {
        ...state.settings,
        activeProfileId: remaining[0].id,
        appliedProfileId:
          state.settings.appliedProfileId === activeProfile.id
            ? null
            : state.settings.appliedProfileId,
      },
    });
    setSuggestions([]);
  };

  const runSuggestionScan = async () => {
    setScanBusy(true);
    setScanStatus('Scanning cached records…');

    try {
      const inputs: Array<{ connection: (typeof connections)[number]; data: NonNullable<Awaited<ReturnType<typeof getFhirData>>> }> = [];

      for (const connection of connections) {
        const data = await getFhirData(connection.id);
        if (data) {
          inputs.push({ connection, data });
        }
      }

      const raw = suggestTermGroupsFromRecords(inputs, 80);
      const existing = new Set(activeProfile.terms.map((term) => normalizeTermForCompare(term.value)));
      const filtered = raw.filter((group) =>
        group.variants.some((variant) => {
          const key = normalizeTermForCompare(variant);
          return Boolean(key) && !existing.has(key);
        })
      );

      setSuggestions(filtered);
      setScanStatus(`Found ${filtered.length} suggestion group${filtered.length === 1 ? '' : 's'}.`);
    } catch (err) {
      setScanStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setScanBusy(false);
    }
  };

  useEffect(() => {
    if (!loaded) return;
    void runSuggestionScan();
  }, [loaded, connections, activeProfile.id, activeProfile.terms]);

  return (
    <div className="page-top with-records-nav">
      <RecordsHeaderBar current="redaction" />
      <div className="panel panel-wide">
        <div className="page-title">Privacy Redaction Studio</div>
        <div className="page-subtitle">
          Build reusable redaction profiles. Original records are never modified.
        </div>

        <div className="redaction-studio-row">
          <label className="redaction-label">Active profile</label>
          <select
            className="redaction-select"
            value={activeProfile.id}
            onChange={(e) => {
              commitState({
                ...state,
                settings: {
                  ...state.settings,
                  activeProfileId: e.target.value,
                },
              });
              setSuggestions([]);
            }}
          >
            {state.profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
          <button
            className="btn btn-danger btn-sm"
            onClick={handleDeleteProfile}
            disabled={state.profiles.length <= 1}
          >
            Delete profile
          </button>
        </div>

        <div className="redaction-studio-row">
          <input
            className="provider-search-input"
            placeholder="New profile name"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
          />
          <button className="btn btn-secondary" onClick={handleCreateProfile}>
            Add profile
          </button>
        </div>

        <div className="section-title" style={{ marginTop: 16 }}>Terms</div>
        <div className="redaction-studio-row">
          <input
            className="provider-search-input"
            placeholder="Add a term to redact (name, address, identifier, etc.)"
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTerm();
              }
            }}
          />
          <button className="btn btn-secondary" onClick={handleAddTerm}>Add term</button>
          <button
            className="btn btn-danger btn-sm"
            onClick={handleClearAllTerms}
            disabled={activeProfile.terms.length === 0}
          >
            Clear all
          </button>
        </div>

        <div className="redaction-list">
          {activeProfile.terms.length === 0 && (
            <div className="redaction-empty">No terms yet.</div>
          )}
          {activeProfile.terms.map((term) => (
            <div className="redaction-item" key={term.id}>
              <div className="redaction-check">
                <span>{term.value}</span>
                <span className="redaction-chip">{term.source}</span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => handleRemoveTerm(term.id)}>Remove</button>
            </div>
          ))}
        </div>

        <div className="section-title" style={{ marginTop: 16 }}>Suggestions</div>
        <div className="redaction-studio-row">
          <span className="redaction-note">{scanBusy ? 'Scanning cached records…' : scanStatus || 'Scanning cached records by default.'}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => void runSuggestionScan()} disabled={scanBusy || !loaded}>
            Refresh
          </button>
        </div>
        {suggestionsByCategory.length > 0 && (
          <div className="redaction-suggestions">
            {suggestionsByCategory.map((bucket) => (
              <div key={bucket.category} className="redaction-suggestion-category">
                <div className="redaction-category-title">
                  {getSuggestedTermCategoryLabel(bucket.category)} ({bucket.groups.length})
                </div>
                <div className="redaction-list">
                  {bucket.groups.map((group) => (
                    <div className="redaction-item" key={group.key}>
                      <div>
                        <div>{group.primary}</div>
                        <div className="redaction-checks">
                          <span className="redaction-chip">
                            {getSuggestedTermCategoryLabel(group.primaryCategory)}
                          </span>
                          {group.categories
                            .filter((value) => value !== group.primaryCategory)
                            .slice(0, 2)
                            .map((category) => (
                              <span className="redaction-chip" key={`${group.key}:${category}`}>
                                {getSuggestedTermCategoryLabel(category)}
                              </span>
                            ))}
                        </div>
                        <div className="redaction-note">
                          Seen {group.occurrenceCount.toLocaleString()} time{group.occurrenceCount === 1 ? '' : 's'} in cached records
                        </div>
                        {group.variants.length > 1 && (
                          <div className="redaction-note">
                            Variants: {group.variants.slice(1).join(' · ')}
                          </div>
                        )}
                      </div>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          const next = updateActiveProfile(state, (profile) => {
                            let updated = profile;
                            for (const variant of group.variants) {
                              updated = upsertTerm(updated, variant, 'suggested');
                            }
                            return updated;
                          });
                          commitState(next);
                          setSuggestions((prev) => prev.filter((value) => value.key !== group.key));
                        }}
                      >
                        Add group
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="section-title" style={{ marginTop: 16 }}>Redaction Options</div>
        <div className="redaction-rules-grid">
          <label className="redaction-check">
            <input
              type="checkbox"
              checked={activeProfile.stripAttachmentBase64}
              onChange={(e) => {
                const next = updateActiveProfile(state, (profile) => ({
                  ...profile,
                  stripAttachmentBase64: e.target.checked,
                  updatedAt: nowIso(),
                }));
                commitState(next);
              }}
            />
            Strip attachment base64 when redacting
          </label>
        </div>
        <div className="redaction-note" style={{ marginTop: 8 }}>
          Only terms in this profile are redacted.
        </div>

        <div className="actions-row">
          <button className="btn btn-secondary" onClick={() => nav('/records')}>Back to records</button>
          <span className="redaction-note">
            Active terms: {countEnabledTerms(activeProfile)}
          </span>
        </div>
      </div>
    </div>
  );
}
