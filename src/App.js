import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Search, X, LogOut, List, Trash2, Edit3,
  ChevronDown, ChevronRight, Save, Upload, Filter, Tv, Play,
  Settings, Plus, Link
} from 'lucide-react';

// ─── SUPABASE ────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const STORAGE_BUCKET = process.env.REACT_APP_SUPABASE_STORAGE_BUCKET || 'files';

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error('Brak konfiguracji Supabase. Ustaw REACT_APP_SUPABASE_URL oraz REACT_APP_SUPABASE_ANON_KEY.');
}

const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');

// ─── STAŁE ───────────────────────────────────────────────────────────────────
const ACCENT = '#e91e63';
const WATCH_SAVE_INTERVAL_MS = 10000;
const CONTINUE_MIN_SECONDS = 5;
const COMPLETED_FRACTION = 0.92;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function isSupabaseConfigured() {
  const u = (supabaseUrl || '').trim();
  const k = (supabaseAnonKey || '').trim();
  return u.length > 0 && k.length > 0 && /^https?:\/\//i.test(u);
}

function resolveStoragePublicUrl(pathOrUrl) {
  if (!pathOrUrl) return '';
  let s = String(pathOrUrl).trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith(`${STORAGE_BUCKET}/`)) s = s.slice(STORAGE_BUCKET.length + 1);
  s = s.replace(/^\/+/, '');
  try {
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(s);
    return data?.publicUrl ?? '';
  } catch {
    return '';
  }
}

function posterSrcForItem(item) {
  if (!item) return '';
  const direct = item.poster_file || item.poster_url || item.banner_url;
  if (direct) return resolveStoragePublicUrl(direct);
  if (item.poster_path) return resolveStoragePublicUrl(item.poster_path);
  return '';
}

function sanitizeStorageFileName(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
}

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function genreFieldToArray(g) {
  if (Array.isArray(g)) return [...new Set(g.map(x => String(x).trim()).filter(Boolean))];
  return [...new Set(String(g || '').split(/[,;|]/).map(x => x.trim()).filter(Boolean))];
}

function formatAuthError(err) {
  const raw = String(err?.message ?? err ?? '');
  if (/database error saving new user/i.test(raw)) return 'Błąd zapisu użytkownika w bazie Supabase.\n(Szczegóły: ' + raw + ')';
  return raw || 'Nieznany błąd';
}

// ─── GENRE EDITOR ────────────────────────────────────────────────────────────
function GenreEditor({ genres, onChange }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim();
    if (!t || genres.some(x => x.toLowerCase() === t.toLowerCase())) return;
    onChange([...genres, t]);
    setDraft('');
  };
  return (
    <div className="w-full rounded-2xl border border-white/10 bg-black p-4 text-[12px] text-zinc-200">
      <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Gatunki</div>
      <div className="flex min-h-[2rem] flex-wrap gap-2">
        {genres.length === 0
          ? <span className="text-[11px] text-zinc-600">Brak — dodaj przyciskiem +</span>
          : genres.map(g => (
            <span key={g} className="inline-flex items-center gap-1 rounded-full border border-rose-500/35 bg-rose-600/15 px-2.5 py-1 text-[11px] font-bold text-rose-100">
              {g}
              <button type="button" onClick={() => onChange(genres.filter(x => x !== g))} className="rounded-full p-0.5 text-rose-200 hover:bg-white/10">
                <X size={12} strokeWidth={2.5} />
              </button>
            </span>
          ))
        }
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-[11px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-rose-500/50"
          placeholder="Nazwa gatunku…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button type="button" onClick={add} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-600/25 text-rose-100 hover:bg-rose-600 hover:text-white">
          <Plus size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

// ─── MEDIA POSTER ────────────────────────────────────────────────────────────
function MediaPoster({ item, className, imageClassName }) {
  const [failed, setFailed] = useState(false);
  const src = posterSrcForItem(item);
  const title = item?.title || '';
  if (!src || failed) {
    return (
      <div className={`flex h-full w-full flex-col items-center justify-center bg-zinc-900/80 text-center ${className ?? ''}`} aria-hidden>
        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Brak okładki</div>
        <div className="mt-1 max-w-[90%] truncate text-[11px] font-bold uppercase text-zinc-500">{title}</div>
      </div>
    );
  }
  return (
    <img src={src} alt={title} className={`h-full w-full object-cover ${imageClassName ?? ''} ${className ?? ''}`}
      loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  );
}

// ─── SEEK PLAYER (iframe embed) ───────────────────────────────────────────────
// key={url} musi być przekazany przez rodzica — React wtedy niszczy i tworzy iframe od nowa

function SeekPlayer({ url, externalRef, mediaId, episodeId }) {
  const iframeRef = useRef(null);
  const wrapRef = useRef(null);

  // Klucz localStorage dla progresu (per odcinek lub per film)
  const storageKey = episodeId ? `fp_ep_${episodeId}` : `fp_media_${mediaId}`;

  // Expose ref externally
  useEffect(() => {
    if (externalRef) externalRef.current = iframeRef.current;
  }, [externalRef]);

  // Auto-pause gdy zmiana karty
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && iframeRef.current) {
        try { iframeRef.current.contentWindow.postMessage({ action: 'pause' }, '*'); } catch {}
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Nasłuchuj na postMessage z iframea (jeśli SeekStreaming je wysyła)
  useEffect(() => {
    if (!url) return;
    const handleMsg = (e) => {
      if (!e.data) return;
      const { type, currentTime, duration } = e.data;
      if (currentTime != null && currentTime > 0) {
        try { localStorage.setItem(storageKey, JSON.stringify({ t: currentTime, d: duration || 0, ts: Date.now() })); } catch {}
      }
      if (type === 'ended') {
        try { localStorage.removeItem(storageKey); } catch {}
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, [url, storageKey]);

  if (!url) {
    return (
      <div className="flex h-full w-full items-center justify-center text-xs font-black uppercase text-zinc-700">
        Wybierz odcinek
      </div>
    );
  }

  // Dodaj zapisany czas do URL jeśli SeekStreaming go obsługuje (parametr t=)
  let finalUrl = url;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const { t, ts } = JSON.parse(saved);
      // Tylko jeśli zapisany jest < 7 dni temu i > 5s
      if (t > 5 && ts && (Date.now() - ts) < 7 * 24 * 3600 * 1000) {
        const u = new URL(url);
        // SeekStreaming może obsługiwać #t= lub ?t= — próbujemy hash
        if (!u.hash.includes('t=')) {
          u.hash = u.hash + (u.hash ? '&t=' : 't=') + Math.floor(t);
        }
        finalUrl = u.toString();
      }
    }
  } catch {}

  return (
    <div ref={wrapRef} className="relative w-full h-full bg-black">
      <iframe
        ref={iframeRef}
        src={finalUrl}
        className="w-full h-full border-0"
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture"
        title="Filmoza Player"
      />
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [media, setMedia] = useState([]);
  const [history, setHistory] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [episodes, setEpisodes] = useState([]);
  const [activeVideo, setActiveVideo] = useState(null); // SeekStreaming URL
  const [activeEpisodeId, setActiveEpisodeId] = useState(null);
  const iframeRef = useRef(null);
  const pendingSeekRef = useRef(0);
  const lastSaveRef = useRef(0);
  const lastKnownTimeRef = useRef(0);   // ostatni znany czas odtwarzania
  const lastKnownDurRef = useRef(0);    // ostatni znany czas trwania

  const [openSeasons, setOpenSeasons] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [showAddShell, setShowAddShell] = useState(false);

  // Auth
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authView, setAuthView] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Tabs & filter
  const [activeTab, setActiveTab] = useState('home');
  const [genreMenuOpen, setGenreMenuOpen] = useState(false);
  const [activeGenre, setActiveGenre] = useState('WSZYSTKIE');

  // Edit
  const [editData, setEditData] = useState({ title: '', description: '', genres: [], poster_file: '' });
  const [editBannerFile, setEditBannerFile] = useState(null);
  const [editVideoUrl, setEditVideoUrl] = useState(''); // SeekStreaming URL dla filmów

  // New episode (SeekStreaming link zamiast pliku)
  const [newEpisode, setNewEpisode] = useState({ title: '', description: '', season: '1', seekUrl: '' });

  // Seasons
  const [seasonsMeta, setSeasonsMeta] = useState({});
  const [seasonEdits, setSeasonEdits] = useState({});

  // New media (SeekStreaming link zamiast upload pliku)
  const [newMedia, setNewMedia] = useState({
    title: '', description: '', genres: [], type: 'movie',
    bannerFile: null, seekUrl: ''
  });

  // ── Storage helpers ──
  async function uploadFileToStorage(file, path) {
    try {
      const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true });
      if (error) return { publicUrl: null, path: null, error };
      const { data: url } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      return { publicUrl: url?.publicUrl ?? null, path, error: null };
    } catch (e) {
      return { publicUrl: null, path: null, error: e };
    }
  }

  async function deleteFromStorage(path) {
    try { await supabase.storage.from(STORAGE_BUCKET).remove([path]); } catch {}
  }

  // ── Data fetching ──
  const fetchMedia = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    const { data, error } = await supabase.from('media').select('*').order('created_at', { ascending: false });
    if (!error) setMedia(data || []);
  }, []);

  const fetchHistory = useCallback(async (userId) => {
    if (!isSupabaseConfigured() || !userId) return;
    const { data } = await supabase
      .from('watch_history')
      .select('*, media(*), episodeRow:episodes(*)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    setHistory(data || []);
  }, []);

  useEffect(() => {
    fetchMedia();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchHistory(session.user.id);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchHistory(session.user.id);
      else setHistory([]);
    });
    const handleAdminKey = e => {
      if (e.key === 'F2') {
        const pin = prompt('🔐 PIN ADMINA:');
        if (pin === '7821') { setIsAdmin(true); alert('ZALOGOWANO JAKO ADMIN'); }
      }
    };
    window.addEventListener('keydown', handleAdminKey);
    return () => {
      window.removeEventListener('keydown', handleAdminKey);
      authListener?.subscription?.unsubscribe();
    };
  }, [fetchMedia, fetchHistory]);

  // ── Watch history ──
  const saveWatchProgress = useCallback(async (currentTime, duration) => {
    if (!user?.id || !selectedItem?.id || !isSupabaseConfigured()) return;
    const progress = Math.floor(currentTime || 0);
    const completed = duration > 0 && (currentTime / duration) >= COMPLETED_FRACTION;
    const payload = {
      user_id: user.id,
      media_id: selectedItem.id,
      progress_seconds: progress,
      updated_at: new Date().toISOString(),
      completed,
      episode_id: activeEpisodeId || null
    };
    await supabase.from('watch_history').upsert(payload, { onConflict: 'user_id,media_id' });
    if (completed) fetchHistory(user.id);
  }, [user?.id, selectedItem?.id, activeEpisodeId, fetchHistory]);

  const flushWatchProgress = useCallback(async () => {
    if (!user?.id || !selectedItem?.id) return;
    // Próbuj localStorage najpierw (bardziej aktualny)
    const key = activeEpisodeId ? `fp_ep_${activeEpisodeId}` : `fp_media_${selectedItem.id}`;
    let t = lastKnownTimeRef.current;
    let d = lastKnownDurRef.current;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.t > t) { t = parsed.t; d = parsed.d || 0; }
      }
    } catch {}
    if (t > 0) await saveWatchProgress(t, d);
  }, [user?.id, selectedItem?.id, activeEpisodeId, saveWatchProgress]);

  const removeContinueEntry = async (historyId) => {
    await supabase.from('watch_history').delete().eq('id', historyId);
    if (user?.id) fetchHistory(user.id);
  };

  // ── SeekStreaming: śledzenie postępu przez postMessage + timer backup ──
  useEffect(() => {
    const handleMessage = (e) => {
      if (!e.data) return;
      const { type, currentTime, duration } = e.data;
      if (currentTime != null) {
        lastKnownTimeRef.current = currentTime;
        if (duration) lastKnownDurRef.current = duration;
      }
      if (type === 'timeupdate' && currentTime != null) {
        const now = Date.now();
        if (now - lastSaveRef.current >= WATCH_SAVE_INTERVAL_MS) {
          lastSaveRef.current = now;
          saveWatchProgress(currentTime, duration || 0);
        }
      }
      if (type === 'ended') saveWatchProgress(duration || 0, duration || 0);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [saveWatchProgress]);

  // Timer backup co 30s — czyta progres z localStorage (zapisany przez SeekPlayer)
  useEffect(() => {
    if (!user?.id || !selectedItem?.id) return;
    const interval = setInterval(() => {
      // Czytaj z localStorage (zapisany przez SeekPlayer przez postMessage)
      const key = activeEpisodeId ? `fp_ep_${activeEpisodeId}` : `fp_media_${selectedItem.id}`;
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          const { t, d } = JSON.parse(saved);
          if (t > CONTINUE_MIN_SECONDS) {
            lastKnownTimeRef.current = t;
            lastKnownDurRef.current = d || 0;
            saveWatchProgress(t, d || 0);
          }
        }
      } catch {}
      // Fallback: użyj lastKnownTimeRef jeśli postMessage działało
      const t = lastKnownTimeRef.current;
      const d = lastKnownDurRef.current;
      if (t > CONTINUE_MIN_SECONDS) saveWatchProgress(t, d);
    }, 30000);
    return () => clearInterval(interval);
  }, [user?.id, selectedItem?.id, activeEpisodeId, saveWatchProgress]);

  // ── Media modal ──
  const safeSeasonKey = (ep) => String(ep.season_key ?? ep.season_label ?? ep.season ?? ep.season_number ?? 1);

  const closeMediaModal = async () => {
    await flushWatchProgress();
    setSelectedItem(null);
    setActiveVideo(null);
    setActiveEpisodeId(null);
    pendingSeekRef.current = 0;
  };

  const fetchSeasonsMeta = async (mediaId) => {
    try {
      const { data, error } = await supabase.from('seasons').select('*').eq('media_id', mediaId);
      if (error) return;
      const meta = {};
      (data || []).forEach(s => {
        const key = String(s.season_key ?? s.season ?? s.season_number ?? '');
        if (key) meta[key] = { title: s.title ?? `Sezon ${key}` };
      });
      setSeasonsMeta(meta);
    } catch {}
  };

  const openMedia = async (item, preloadedWatch = null) => {
    setSelectedItem(item);
    setEditMode(false);
    setEditData({ title: item.title, description: item.description, genres: genreFieldToArray(item.genre), poster_file: item.poster_file });
    setEditBannerFile(null);
    setEditVideoUrl(item.video_url || '');
    setActiveVideo(null);
    setActiveEpisodeId(null);
    pendingSeekRef.current = 0;

    const { data: eps } = await supabase.from('episodes').select('*').eq('media_id', item.id)
      .order('season_number', { ascending: true }).order('created_at', { ascending: true });
    setEpisodes(eps || []);

    let wh = preloadedWatch;
    if (user && !wh && isSupabaseConfigured()) {
      const { data } = await supabase.from('watch_history').select('*').eq('user_id', user.id).eq('media_id', item.id).maybeSingle();
      wh = data;
    }

    if (wh?.episode_id && (eps?.length ?? 0) > 0) {
      const ep = (eps || []).find(e => Number(e.id) === Number(wh.episode_id));
      if (ep?.video_url) {
        setOpenSeasons({ [safeSeasonKey(ep)]: true });
        setActiveEpisodeId(ep.id);
        setActiveVideo(ep.video_url);
        fetchSeasonsMeta(item.id);
        return;
      }
    }

    if ((eps?.length ?? 0) > 0) setOpenSeasons({ [safeSeasonKey(eps[0])]: true });

    if ((eps?.length ?? 0) === 0 && item.video_url) {
      setActiveEpisodeId(null);
      setActiveVideo(item.video_url);
    }

    fetchSeasonsMeta(item.id);
  };

  // ── Auth ──
  const closeMenus = () => { setGenreMenuOpen(false); setProfileMenuOpen(false); };
  const openAuth = (view) => { closeMenus(); setAuthView(view); setAuthPassword(''); setShowAuthModal(true); };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    const email = authEmail.trim();
    if (!email) return alert('Podaj adres e-mail.');
    if (authPassword.length < 6) return alert('Hasło musi mieć co najmniej 6 znaków.');
    setAuthBusy(true);
    try {
      if (authView === 'register') {
        const { error } = await supabase.auth.signUp({ email, password: authPassword });
        if (error) throw error;
        alert('Rejestracja OK! Sprawdź e-mail (weryfikacja).');
        setShowAuthModal(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: authPassword });
        if (error) throw error;
        setShowAuthModal(false);
      }
    } catch (err) {
      alert(formatAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  // ── Admin: tworzenie mediów ──
  const handleCreateMedia = async (e) => {
    e.preventDefault();
    if (!newMedia.title.trim()) return alert('Podaj tytuł.');
    setIsUploading(true);
    try {
      let posterUrl = null;
      if (newMedia.bannerFile) {
        const path = `p_${Date.now()}_${sanitizeStorageFileName(newMedia.bannerFile.name)}`;
        const up = await uploadFileToStorage(newMedia.bannerFile, path);
        if (up.publicUrl) posterUrl = up.publicUrl;
      }

      const genresArr = (newMedia.genres || []).map(x => String(x).trim()).filter(Boolean);
      const payload = {
        title: newMedia.title.trim(),
        description: newMedia.description.trim(),
        genre: genresArr.join(', '),
        genres: genresArr,
        type: newMedia.type,
        poster_file: posterUrl,
        // SeekStreaming URL (tylko dla filmów)
        video_url: newMedia.type === 'movie' ? (newMedia.seekUrl.trim() || null) : null,
      };

      const { error } = await supabase.from('media').insert([payload]);
      if (error) throw error;
      setNewMedia({ title: '', description: '', genres: [], type: 'movie', bannerFile: null, seekUrl: '' });
      setShowAddShell(false);
      fetchMedia();
    } catch (err) {
      alert('Błąd: ' + (err.message || err));
    }
    setIsUploading(false);
  };

  // ── Admin: aktualizacja mediów ──
  const handleUpdateMedia = async () => {
    if (!selectedItem) return;
    setIsUploading(true);
    try {
      let posterUrl = selectedItem.poster_file;
      if (editBannerFile) {
        const path = `p_${Date.now()}_${sanitizeStorageFileName(editBannerFile.name)}`;
        const up = await uploadFileToStorage(editBannerFile, path);
        if (up.publicUrl) posterUrl = up.publicUrl;
      }
      const genresArr = (editData.genres || []).map(x => String(x).trim()).filter(Boolean);
      const { error } = await supabase.from('media').update({
        title: editData.title,
        description: editData.description,
        genre: genresArr.join(', '),
        genres: genresArr,
        poster_file: posterUrl,
        video_url: editVideoUrl.trim() || null,
      }).eq('id', selectedItem.id);
      if (error) throw error;
      setSelectedItem(prev => ({ ...prev, title: editData.title, description: editData.description, poster_file: posterUrl, video_url: editVideoUrl.trim() || null }));
      setEditMode(false);
      fetchMedia();
    } catch (err) {
      alert('Błąd zapisu: ' + (err.message || err));
    }
    setIsUploading(false);
  };

  // ── Admin: dodawanie odcinka ──
  const handleAddEpisode = async () => {
    if (!selectedItem) return;
    if (!newEpisode.seekUrl.trim()) return alert('Wklej link SeekStreaming do odcinka.');
    setIsUploading(true);
    try {
      const seasonKey = String(newEpisode.season || '1').trim() || '1';
      const payload = {
        media_id: selectedItem.id,
        episode_title: newEpisode.title || 'Bez nazwy',
        episode_description: newEpisode.description || '',
        season_key: seasonKey,
        season_label: seasonKey,
        season_number: Number.isFinite(Number(seasonKey)) ? Number(seasonKey) : null,
        video_url: newEpisode.seekUrl.trim(),
      };
      const { error } = await supabase.from('episodes').insert([payload]);
      if (error) throw error;
      await ensureSeasonExists(selectedItem.id, seasonKey);
      setNewEpisode({ title: '', description: '', season: '1', seekUrl: '' });
      openMedia(selectedItem);
    } catch (err) {
      alert('Błąd: ' + (err.message || err));
    }
    setIsUploading(false);
  };

  const deleteEpisode = async (id) => {
    if (!window.confirm('Usunąć ten odcinek?')) return;
    await supabase.from('episodes').delete().eq('id', id);
    openMedia(selectedItem);
  };

  const deleteMediaWithFiles = async () => {
    if (!window.confirm('Usunąć ten film/serial?')) return;
    setIsUploading(true);
    try {
      await flushWatchProgress();
      if (selectedItem.poster_path) await deleteFromStorage(selectedItem.poster_path);
      await supabase.from('episodes').delete().eq('media_id', selectedItem.id);
      try { await supabase.from('seasons').delete().eq('media_id', selectedItem.id); } catch {}
      await supabase.from('media').delete().eq('id', selectedItem.id);
      setSelectedItem(null);
      setActiveVideo(null);
      setActiveEpisodeId(null);
      fetchMedia();
    } catch {}
    setIsUploading(false);
  };

  // ── Seasons ──
  const ensureSeasonExists = async (mediaId, seasonKey) => {
    try {
      await supabase.from('seasons').insert([{ media_id: mediaId, season_key: String(seasonKey), title: `Sezon ${seasonKey}` }]);
      fetchSeasonsMeta(mediaId);
    } catch {}
  };

  const startEditSeason = (seasonKey) => {
    const key = String(seasonKey);
    setSeasonEdits({ ...seasonEdits, [key]: { editing: true, title: seasonsMeta?.[key]?.title || `Sezon ${key}` } });
  };

  const saveSeasonTitle = async (seasonKey) => {
    const key = String(seasonKey);
    const title = seasonEdits?.[key]?.title ?? `Sezon ${key}`;
    setIsUploading(true);
    try {
      await supabase.from('seasons').update({ title }).eq('media_id', selectedItem.id).eq('season_key', key);
      await fetchSeasonsMeta(selectedItem.id);
      setSeasonEdits({ ...seasonEdits, [key]: { editing: false, title } });
    } catch {}
    setIsUploading(false);
  };

  const deleteSeason = async (seasonKey) => {
    const key = String(seasonKey);
    if (!window.confirm(`Usunąć cały sezon "${key}"?`)) return;
    setIsUploading(true);
    try {
      await supabase.from('episodes').delete().eq('media_id', selectedItem.id)
        .or(`season_key.eq.${key},season_label.eq.${key},season_number.eq.${Number.isFinite(Number(key)) ? Number(key) : -999999}`);
      await supabase.from('seasons').delete().eq('media_id', selectedItem.id).eq('season_key', key);
      openMedia(selectedItem);
    } catch { openMedia(selectedItem); }
    setIsUploading(false);
  };

  // ── Filtered media ──
  const allGenres = useMemo(() => Array.from(new Set(
    (media || []).flatMap(m => genreFieldToArray(m.genre ?? ''))
  )).sort((a, b) => a.localeCompare(b, 'pl')), [media]);

  const filteredMedia = useMemo(() => (media || [])
    .filter(m => (m.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(m => {
      if (activeGenre === 'WSZYSTKIE') return true;
      return genreFieldToArray(m.genre ?? '').includes(activeGenre);
    })
    .filter(m => {
      if (activeTab === 'home') return true;
      const t = m.type ?? m.media_type;
      if (activeTab === 'movies') return t === 'movie';
      if (activeTab === 'series') return t === 'series';
      return true;
    }), [media, searchQuery, activeGenre, activeTab]);

  const continueWatching = useMemo(() => {
    if (!user) return [];
    return (history || []).filter(h => h.media && !h.completed && (h.progress_seconds || 0) >= CONTINUE_MIN_SECONDS);
  }, [history, user]);

  const groupedEpisodes = useMemo(() => episodes.reduce((acc, ep) => {
    const s = safeSeasonKey(ep);
    if (!acc[s]) acc[s] = [];
    acc[s].push(ep);
    return acc;
  }, {}), [episodes]);

  const activeEpisode = useMemo(() => (episodes || []).find(e => Number(e.id) === Number(activeEpisodeId)) || null, [episodes, activeEpisodeId]);

  const authTitle = authView === 'register' ? 'REJESTRACJA' : 'LOGOWANIE';
  const authSubmitLabel = authView === 'register' ? 'ZAREJESTRUJ' : 'ZALOGUJ';

  // ── TAB BUTTON ──
  const TabBtn = ({ id, icon, label }) => (
    <button type="button" onClick={() => { closeMenus(); setActiveTab(id); }}
      className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition lg:px-5 lg:py-3 lg:text-[11px] ${activeTab === id ? 'border-rose-600/40 bg-white/10 text-rose-200' : 'border-white/5 bg-white/5 text-zinc-300 hover:bg-white/10'}`}>
      {icon}{label}
    </button>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans">

      {/* SUPABASE WARNING */}
      {!isSupabaseConfigured() && (
        <div className="fixed left-0 right-0 top-0 z-[200] border-b border-amber-600/40 bg-amber-950/95 px-4 py-2 text-center text-[11px] text-amber-100" role="alert">
          <strong className="font-black uppercase tracking-wide">Brak Supabase</strong> — Ustaw <code className="rounded bg-black/40 px-1">REACT_APP_SUPABASE_URL</code> i <code className="rounded bg-black/40 px-1">REACT_APP_SUPABASE_ANON_KEY</code> w Vercel → Redeploy.
        </div>
      )}

      {/* HEADER */}
      <header className={`fixed left-0 right-0 z-50 flex w-full items-center justify-between gap-3 border-b border-white/[0.06] bg-black px-6 md:px-10 ${!isSupabaseConfigured() ? 'top-[52px]' : 'top-0'} min-h-[72px] py-2`}>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 md:gap-4">
          <h1 className="shrink-0 text-2xl font-black italic tracking-tighter md:text-[1.65rem]" style={{ color: ACCENT, fontWeight: 900 }}>FILMOZA</h1>

          <div className="relative hidden min-w-0 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} strokeWidth={2} />
            <input onChange={e => setSearchQuery(e.target.value)}
              className="w-52 rounded-2xl border border-white/10 bg-zinc-900/90 py-2.5 pl-10 pr-4 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-[#e91e63]/50 lg:w-64"
              placeholder="Szukaj..." />
          </div>

          <div className="hidden md:flex shrink-0 items-center gap-2 lg:gap-3">
            <TabBtn id="home" icon={<Play size={14}/>} label="Główna" />
            <TabBtn id="movies" icon={<Settings size={14}/>} label="Filmy" />
            <TabBtn id="series" icon={<Tv size={14}/>} label="Seriale" />
          </div>

          <div className="relative hidden md:block">
            <button type="button" onClick={() => { setProfileMenuOpen(false); setGenreMenuOpen(v => !v); }}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest hover:border-white/20 lg:px-6 lg:py-3 lg:text-[11px]">
              <Filter size={16} className="shrink-0 text-rose-500" />
              <span className="max-w-[120px] truncate">{activeGenre === 'WSZYSTKIE' ? 'Wszystkie' : activeGenre}</span>
              <ChevronDown size={16} className="shrink-0 text-zinc-400" />
            </button>
            {genreMenuOpen && (
              <div className="absolute left-0 z-[60] mt-3 w-72 rounded-3xl border border-white/10 bg-black/90 shadow-2xl">
                <button type="button" onClick={() => { setActiveGenre('WSZYSTKIE'); setGenreMenuOpen(false); }}
                  className={`w-full px-6 py-4 text-left text-[11px] font-black uppercase tracking-widest hover:bg-white/5 ${activeGenre === 'WSZYSTKIE' ? 'text-rose-400' : 'text-zinc-200'}`}>
                  Wszystkie
                </button>
                <div className="max-h-72 overflow-y-auto">
                  {allGenres.map(g => (
                    <button key={g} type="button" onClick={() => { setActiveGenre(g); setGenreMenuOpen(false); }}
                      className={`w-full px-6 py-4 text-left text-[11px] font-bold hover:bg-white/5 ${activeGenre === g ? 'text-rose-400' : 'text-zinc-200'}`}>
                      {g}
                    </button>
                  ))}
                  {allGenres.length === 0 && <div className="px-6 py-6 text-[11px] text-zinc-500">Brak gatunków.</div>}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 md:gap-4">
          <div className="relative lg:hidden">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} strokeWidth={2} />
            <input onChange={e => setSearchQuery(e.target.value)}
              className="w-40 rounded-2xl border border-white/10 bg-zinc-900/90 py-2 pl-9 pr-3 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-[#e91e63]/50"
              placeholder="Szukaj..." />
          </div>

          {isAdmin && (
            <button onClick={() => { closeMenus(); setShowAddShell(true); }}
              className="bg-rose-600 px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap">
              + Dodaj
            </button>
          )}

          <div className="relative">
            {user ? (
              <>
                <button onClick={() => { setGenreMenuOpen(false); setProfileMenuOpen(v => !v); }}
                  className="flex items-center gap-2 bg-white/5 border border-white/10 hover:border-white/20 px-4 py-2 rounded-2xl" type="button">
                  <div className="w-8 h-8 rounded-full bg-rose-600/20 border border-rose-600/30 flex items-center justify-center text-[12px] font-black text-rose-200">
                    {(user.email || '?').slice(0, 1).toUpperCase()}
                  </div>
                  <span className="hidden xl:block text-[11px] font-black uppercase tracking-widest text-zinc-200 max-w-[160px] truncate">{user.email || 'Profil'}</span>
                  <ChevronDown size={16} className="text-zinc-400" />
                </button>
                {profileMenuOpen && (
                  <div className="absolute right-0 mt-3 w-80 bg-black/90 border border-white/10 rounded-3xl overflow-hidden shadow-2xl z-[60]">
                    <div className="px-5 py-4 border-b border-white/10">
                      <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Zalogowano</div>
                      <div className="text-[12px] font-bold text-zinc-200 break-all">{user.email}</div>
                    </div>
                    <button type="button" onClick={async () => { await supabase.auth.signOut(); setProfileMenuOpen(false); }}
                      className="w-full text-left px-5 py-4 text-[11px] font-black uppercase tracking-widest hover:bg-white/5 flex items-center gap-2">
                      <LogOut size={16}/> Wyloguj
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button type="button" onClick={() => openAuth('login')}
                className="rounded-full px-8 py-2.5 text-[10px] font-black uppercase tracking-widest text-white bg-[#141414] border border-white/10 hover:bg-[#1a1a1a] hover:border-white/20">
                ZALOGUJ SIĘ
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className={`mx-auto max-w-[1900px] px-6 pb-20 sm:px-8 md:px-10 ${!isSupabaseConfigured() ? 'pt-36 md:pt-40' : 'pt-28 md:pt-32'}`}>

        {/* KONTYNUUJ OGLĄDANIE */}
        {user && activeTab === 'home' && continueWatching.length > 0 && (
          <section className="mb-10 md:mb-12" aria-labelledby="continue-heading">
            <h2 id="continue-heading" className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">
              <Play className="text-rose-500" size={14} strokeWidth={2.5} /> Kontynuuj oglądanie
            </h2>
            <div className="-mx-1 flex gap-4 overflow-x-auto pb-2 pt-1 [scrollbar-width:thin] md:gap-5">
              {continueWatching.map(h => (
                <div key={h.id} className="relative w-[132px] shrink-0 sm:w-[152px]">
                  <button type="button" aria-label="Usuń z kontynuacji"
                    onClick={e => { e.stopPropagation(); void removeContinueEntry(h.id); }}
                    className="absolute right-2 top-2 z-10 rounded-full bg-black/75 p-1.5 text-zinc-400 hover:bg-rose-600 hover:text-white">
                    <X size={12} strokeWidth={2.5} />
                  </button>
                  <button type="button" onClick={() => void openMedia(h.media, h)} className="group block w-full text-left">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 shadow-lg transition-all duration-300 group-hover:-translate-y-1 group-hover:border-rose-600/50">
                      <div className="absolute inset-0"><MediaPoster item={h.media} imageClassName="transition-transform duration-500 group-hover:scale-105" /></div>
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
                        <Play className="text-white drop-shadow-md" size={32} fill="currentColor" />
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-[10px] font-black uppercase leading-tight text-white">{h.media?.title}</p>
                    <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-500">
                      {h.episodeRow ? `S${safeSeasonKey(h.episodeRow)} · ${String(h.episodeRow.episode_title || '').slice(0, 20)}` : 'Film'} · {formatTime(h.progress_seconds)}
                    </p>
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* GRID FILMÓW */}
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 sm:gap-7 md:grid-cols-4 md:gap-8 lg:grid-cols-6 2xl:grid-cols-8">
          {filteredMedia.map(item => (
            <div key={item.id} onClick={() => openMedia(item)} className="group relative cursor-pointer">
              <div className="relative aspect-[2/3] overflow-hidden rounded-[2.2rem] border border-white/5 shadow-2xl transition-all duration-500 group-hover:-translate-y-2 group-hover:border-rose-600/50">
                <div className="absolute inset-0"><MediaPoster item={item} imageClassName="transition-transform duration-700 group-hover:scale-110" /></div>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" aria-hidden />
                <div className="absolute inset-x-0 bottom-0 p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100 md:p-6">
                  <h3 className="truncate text-xs font-black uppercase italic text-white md:text-sm">{item.title}</h3>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* MODAL: SZCZEGÓŁY */}
      {selectedItem && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black p-6 md:p-12">
          <button type="button" onClick={() => void closeMediaModal()} className="fixed top-6 right-6 z-[110] bg-white/5 p-4 rounded-full hover:bg-rose-600"><X/></button>

          <div className="max-w-7xl mx-auto grid lg:grid-cols-[1fr_450px] gap-12 mt-10">
            <div className="space-y-6">
              {/* PLAYER */}
              <div className="w-full bg-black rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl" style={{ aspectRatio: '16/9' }}>
                <SeekPlayer key={activeVideo || 'empty'} url={activeVideo} externalRef={iframeRef} mediaId={selectedItem?.id} episodeId={activeEpisodeId} />
              </div>

              {/* INFO */}
              <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5">
                <div className="flex justify-between items-start mb-6">
                  {editMode
                    ? <input className="bg-black border border-rose-600/50 text-3xl font-black w-full p-4 rounded-2xl outline-none" value={editData.title} onChange={e => setEditData({ ...editData, title: e.target.value })} />
                    : <h2 className="text-4xl font-[1000] italic uppercase text-rose-600 tracking-tighter">{selectedItem.title}</h2>
                  }
                  {isAdmin && (
                    <div className="flex gap-3 ml-4">
                      <button type="button" onClick={() => setEditMode(!editMode)} className="p-4 bg-white/5 rounded-2xl hover:bg-white/10">
                        {editMode ? <X size={20}/> : <Edit3 size={20} className="text-rose-500"/>}
                      </button>
                      {editMode && <button type="button" onClick={handleUpdateMedia} className="p-4 bg-rose-600 rounded-2xl hover:bg-rose-500"><Save size={20}/></button>}
                    </div>
                  )}
                </div>

                {editMode ? (
                  <div className="space-y-4">
                    <textarea className="w-full bg-black border border-white/10 p-6 rounded-2xl h-40 text-zinc-400 outline-none" value={editData.description} onChange={e => setEditData({ ...editData, description: e.target.value })} />
                    <div className="grid gap-4 md:grid-cols-2 md:items-start">
                      <GenreEditor genres={editData.genres || []} onChange={g => setEditData({ ...editData, genres: g })} />
                      <div className="w-full bg-black border border-white/10 p-4 rounded-2xl text-[12px] text-zinc-200">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Banner (upload)</div>
                        <input type="file" accept="image/*" className="text-[10px]" onChange={e => setEditBannerFile(e.target.files?.[0] ?? null)} />
                      </div>
                    </div>
                    {selectedItem.type === 'movie' && (
                      <div className="w-full bg-black border border-white/10 p-4 rounded-2xl text-[12px] text-zinc-200">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1"><Link size={12}/> Link SeekStreaming (film)</div>
                        <input type="url" className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-zinc-200 outline-none focus:border-rose-500/50"
                          placeholder="https://filmoza.seekplayer.me/#..." value={editVideoUrl} onChange={e => setEditVideoUrl(e.target.value)} />
                      </div>
                    )}
                    <button type="button" onClick={deleteMediaWithFiles} disabled={isUploading}
                      className="w-full bg-red-950/30 border border-red-600/30 text-red-300 py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-red-600 hover:text-white transition-all">
                      Usuń film/serial
                    </button>
                  </div>
                ) : (
                  <p className="text-zinc-400 text-lg leading-relaxed">{selectedItem.description}</p>
                )}
              </div>
            </div>

            {/* PANEL ODCINKÓW */}
            <div className="space-y-6">
              <h3 className="font-black italic uppercase text-rose-600 flex items-center gap-3 border-b border-white/5 pb-6 text-xs tracking-widest"><List size={18}/> Odcinki</h3>

              <div className="space-y-4">
                {Object.keys(groupedEpisodes).map(season => (
                  <div key={season}>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setOpenSeasons({ ...openSeasons, [season]: !openSeasons[season] })}
                        className="flex-1 flex justify-between items-center bg-white/5 p-4 rounded-2xl font-black text-[10px] uppercase">
                        <span>{seasonsMeta?.[String(season)]?.title || `Sezon ${season}`}</span>
                        {openSeasons[season] ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                      </button>
                      {isAdmin && (
                        <>
                          <button type="button" onClick={() => startEditSeason(season)} className="p-4 bg-white/5 rounded-2xl hover:bg-white/10"><Edit3 size={14} className="text-rose-500"/></button>
                          <button type="button" onClick={() => deleteSeason(season)} className="p-4 bg-red-950/20 text-red-500 rounded-2xl hover:bg-red-600 hover:text-white"><Trash2 size={14}/></button>
                        </>
                      )}
                    </div>

                    {isAdmin && seasonEdits?.[String(season)]?.editing && (
                      <div className="mt-3 bg-white/5 border border-white/5 rounded-2xl p-4 space-y-3">
                        <input className="w-full bg-black border border-white/10 p-4 rounded-xl text-[11px] text-zinc-200 outline-none"
                          value={seasonEdits[String(season)]?.title ?? `Sezon ${season}`}
                          onChange={e => setSeasonEdits({ ...seasonEdits, [String(season)]: { editing: true, title: e.target.value } })}
                          placeholder="Nazwa sezonu" />
                        <button type="button" onClick={() => saveSeasonTitle(season)} disabled={isUploading}
                          className="w-full bg-rose-600 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-rose-500">
                          Zapisz nazwę sezonu
                        </button>
                      </div>
                    )}

                    {openSeasons[season] && (
                      <div className="mt-3 space-y-2 ml-4">
                        {groupedEpisodes[season].map(ep => (
                          <div key={ep.id} className="flex gap-2">
                            <div onClick={() => { pendingSeekRef.current = 0; setActiveEpisodeId(ep.id); setActiveVideo(ep.video_url); }}
                              className={`flex-1 cursor-pointer rounded-xl p-4 text-[11px] font-bold ${activeEpisodeId === ep.id ? 'bg-rose-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}>
                              <div>{ep.episode_title}</div>
                              {(ep.episode_description || ep.description) && (
                                <div className={`${activeEpisodeId === ep.id ? 'text-rose-100' : 'text-zinc-500'} text-[10px] leading-snug mt-1`}>
                                  {ep.episode_description || ep.description}
                                </div>
                              )}
                            </div>
                            {isAdmin && <button type="button" onClick={() => deleteEpisode(ep.id)} className="p-4 bg-red-950/20 text-red-500 rounded-xl hover:bg-red-600 hover:text-white"><Trash2 size={14}/></button>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* NOWY ODCINEK (admin) */}
              {isAdmin && (
                <div className="bg-rose-600/5 p-8 rounded-[2.5rem] border border-rose-600/20 space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-rose-500 flex items-center gap-2"><Upload size={14}/> Nowy Odcinek</h4>
                  <input className="w-full bg-black border border-white/5 text-xs p-4 rounded-xl outline-none" placeholder="Nazwa odcinka..."
                    value={newEpisode.title} onChange={e => setNewEpisode({ ...newEpisode, title: e.target.value })} />
                  <textarea className="w-full bg-black border border-white/5 text-xs p-4 rounded-xl outline-none h-20 text-zinc-300" placeholder="Opis odcinka..."
                    value={newEpisode.description} onChange={e => setNewEpisode({ ...newEpisode, description: e.target.value })} />
                  <input type="text" className="w-full bg-black border border-white/5 text-xs p-4 rounded-xl outline-none" placeholder="Sezon (np. 1 / S1 / Speciale)"
                    value={newEpisode.season} onChange={e => setNewEpisode({ ...newEpisode, season: e.target.value })} />
                  <div className="flex items-center gap-2 bg-black border border-white/5 rounded-xl px-4 py-3">
                    <Link size={14} className="text-rose-400 shrink-0"/>
                    <input type="url" className="flex-1 bg-transparent text-xs text-zinc-200 outline-none" placeholder="Link SeekStreaming: https://filmoza.seekplayer.me/#..."
                      value={newEpisode.seekUrl} onChange={e => setNewEpisode({ ...newEpisode, seekUrl: e.target.value })} />
                  </div>
                  <button type="button" onClick={handleAddEpisode} disabled={isUploading}
                    className="w-full bg-rose-600 py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-rose-500 transition-all">
                    {isUploading ? 'ZAPISYWANIE...' : 'DODAJ ODCINEK'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LOGOWANIE */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6" style={{ backgroundColor: '#000000' }}>
          <div className="w-full max-w-md rounded-[1.75rem] border border-white/10 p-8 shadow-2xl" style={{ backgroundColor: '#1a1a1c' }}>
            <div className="flex items-start justify-between gap-4 mb-8">
              <h2 className="text-xl font-black italic tracking-tight uppercase" style={{ color: ACCENT }}>{authTitle}</h2>
              <button type="button" onClick={() => setShowAuthModal(false)} className="text-zinc-500 hover:text-white p-1 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <input className="w-full rounded-xl border border-white/10 bg-black px-4 py-3.5 text-[13px] text-zinc-200 placeholder:text-zinc-500 outline-none focus:border-white/20"
                placeholder="E-mail" value={authEmail} onChange={e => setAuthEmail(e.target.value)} autoComplete="email" />
              <input className="w-full rounded-xl border border-white/10 bg-black px-4 py-3.5 text-[13px] text-zinc-200 placeholder:text-zinc-500 outline-none focus:border-white/20"
                placeholder="Hasło (min. 6 znaków)" type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)}
                autoComplete={authView === 'register' ? 'new-password' : 'current-password'} />
              <button type="submit" disabled={authBusy}
                className="w-full rounded-xl py-4 font-black text-[11px] uppercase tracking-widest text-white transition-opacity disabled:opacity-60"
                style={{ backgroundColor: ACCENT }}>
                {authBusy ? 'TRWA...' : authSubmitLabel}
              </button>
            </form>
            {authView === 'login'
              ? <p className="mt-6 text-center text-[9px] font-bold uppercase leading-relaxed tracking-[0.12em] text-zinc-500">
                  Nie masz konta? <button type="button" className="text-zinc-300 underline-offset-2 hover:underline" onClick={() => { setAuthView('register'); setAuthPassword(''); }}>Załóż je</button>
                </p>
              : <p className="mt-6 text-center text-[9px] font-bold uppercase leading-relaxed tracking-[0.12em] text-zinc-500">
                  Masz już konto? <button type="button" className="text-zinc-300 underline-offset-2 hover:underline" onClick={() => { setAuthView('login'); setAuthPassword(''); }}>Zaloguj się</button>
                </p>
            }
          </div>
        </div>
      )}

      {/* MODAL: DODAJ FILM/SERIAL (admin) */}
      {showAddShell && isAdmin && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-3xl bg-[#0b0b10] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-rose-500">Admin</div>
                <div className="text-3xl font-[1000] italic text-rose-600">Dodaj pozycję</div>
              </div>
              <button type="button" onClick={() => setShowAddShell(false)} className="bg-white/5 p-3 rounded-2xl hover:bg-rose-600"><X size={18}/></button>
            </div>

            <form onSubmit={handleCreateMedia} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <input className="w-full bg-black border border-white/10 p-4 rounded-2xl text-[12px] text-zinc-200 outline-none"
                  placeholder="Tytuł" value={newMedia.title} onChange={e => setNewMedia({ ...newMedia, title: e.target.value })} />
                <select className="w-full bg-black border border-white/10 p-4 rounded-2xl text-[12px] text-zinc-200 outline-none"
                  value={newMedia.type} onChange={e => setNewMedia({ ...newMedia, type: e.target.value })}>
                  <option value="movie">Film</option>
                  <option value="series">Serial</option>
                </select>
              </div>

              <textarea className="w-full bg-black border border-white/10 p-4 rounded-2xl text-[12px] text-zinc-300 outline-none h-28"
                placeholder="Opis" value={newMedia.description} onChange={e => setNewMedia({ ...newMedia, description: e.target.value })} />

              <GenreEditor genres={newMedia.genres || []} onChange={g => setNewMedia({ ...newMedia, genres: g })} />

              <div className="grid md:grid-cols-2 gap-4">
                <div className="w-full bg-black border border-white/10 p-4 rounded-2xl text-[12px] text-zinc-200">
                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Banner (upload)</div>
                  <input type="file" accept="image/*" className="text-[10px]" onChange={e => setNewMedia({ ...newMedia, bannerFile: e.target.files?.[0] ?? null })} />
                </div>

                {newMedia.type === 'movie' ? (
                  <div className="w-full bg-black border border-white/10 p-4 rounded-2xl text-[12px] text-zinc-200">
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1"><Link size={12}/> Link SeekStreaming</div>
                    <input type="url" className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-zinc-200 outline-none focus:border-rose-500/50"
                      placeholder="https://filmoza.seekplayer.me/#..." value={newMedia.seekUrl}
                      onChange={e => setNewMedia({ ...newMedia, seekUrl: e.target.value })} />
                  </div>
                ) : (
                  <div className="w-full bg-black/40 border border-white/10 p-4 rounded-2xl text-[12px] text-zinc-400">
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Serial</div>
                    Po dodaniu otwórz tytuł i dodaj odcinki z linkami SeekStreaming w panelu po prawej.
                  </div>
                )}
              </div>

              <button type="submit" disabled={isUploading}
                className="w-full bg-rose-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 transition-all">
                {isUploading ? 'ZAPISYWANIE...' : 'UTWÓRZ'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
