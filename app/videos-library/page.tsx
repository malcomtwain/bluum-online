"use client";

import { useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, FolderPlus, Folder, ChevronRight, Upload, Trash2, MoveRight, MoreVertical, Edit2, X, Check, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  getUserFolders,
  createUserFolder,
  renameUserFolder,
  deleteUserFolder,
  getUserClips,
  saveClip,
  moveClipToFolder,
  deleteClip,
  type UserFolder,
  type UserClip
} from '@/lib/supabase';
  import { uploadFile, getFileUrl } from '@/lib/supabase';

export default function VideosLibraryPage() {
  const { user } = useAuth();
  const [folders, setFolders] = useState<UserFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [clips, setClips] = useState<UserClip[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [f, c] = await Promise.all([
        getUserFolders(user.id),
        getUserClips(user.id, currentFolderId),
      ]);
      setFolders(f);
      setClips(c);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load your clips');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [user?.id, currentFolderId]);

  const onDrop = async (acceptedFiles: File[]) => {
    if (!user?.id) return toast.error('Please sign in');
    for (const file of acceptedFiles) {
      try {
        // Upload to Supabase Storage (bucket 'clips')
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${user.id}/${currentFolderId || 'root'}/${Date.now()}_${safeName}`;
        const uploadResult = await uploadFile(file, 'clips', storagePath);
        const publicPath = await getFileUrl('clips', storagePath);

        const saved = await saveClip({
          user_id: user.id,
          title: file.name.replace(/\.[^/.]+$/, ''),
          file_name: file.name,
          path: publicPath,
          storage_provider: 'supabase',
          is_temporary: false,
          expires_at: null,
          folder_id: currentFolderId,
          metadata: {}
        });
        setClips((prev) => [saved, ...prev]);
        toast.success(`Uploaded ${file.name}`);
      } catch (e: any) {
        console.error(e);
        toast.error(`Upload failed: ${file.name}`);
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.mov', '.webm'] },
    multiple: true,
  });

  const rootFolders = useMemo(() => folders.filter(f => !f.parent_id), [folders]);

  const currentFolder = useMemo(() => folders.find(f => f.id === currentFolderId) || null, [folders, currentFolderId]);
  const filteredClips = useMemo(() => {
    if (!searchQuery.trim()) return clips;
    const q = searchQuery.toLowerCase();
    return clips.filter(c => (c.title || c.file_name || '').toLowerCase().includes(q));
  }, [clips, searchQuery]);

  const childrenOf = (parentId: string | null) => folders.filter(f => (f.parent_id || null) === parentId);
  const allFoldersFlat = folders; // flatten already
  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectClip = (id: string) => {
    setSelectedClipIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const clearSelection = () => setSelectedClipIds([]);
  const deleteSelected = async () => {
    if (selectedClipIds.length === 0) return;
    if (!confirm(`Delete ${selectedClipIds.length} clip(s)?`)) return;
    try {
      await Promise.all(selectedClipIds.map(id => deleteClip(id)));
      setClips(prev => prev.filter(c => !selectedClipIds.includes(c.id)));
      clearSelection();
      toast.success('Deleted');
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete selection');
    }
  };
  const moveSelectedTo = async (folderId: string | null) => {
    if (selectedClipIds.length === 0) return;
    try {
      await Promise.all(selectedClipIds.map(id => moveClipToFolder(id, folderId)));
      // If moved away from current folder, remove from view
      setClips(prev => prev.filter(c => !selectedClipIds.includes(c.id)));
      clearSelection();
      toast.success('Moved');
    } catch (e) {
      console.error(e);
      toast.error('Failed to move selection');
    }
  };

  const createFolder = async () => {
    if (!user?.id || !newFolderName.trim()) return;
    try {
      const f = await createUserFolder(user.id, newFolderName.trim(), currentFolderId);
      setFolders((prev) => [...prev, f]);
      setCreatingFolder(false);
      setNewFolderName('');
      toast.success('Folder created');
    } catch (e) {
      console.error(e);
      toast.error('Failed to create folder');
    }
  };

  const moveClip = async (clipId: string, destFolderId: string | null) => {
    try {
      const updated = await moveClipToFolder(clipId, destFolderId);
      setClips((prev) => prev.filter(c => c.id !== clipId));
      toast.success('Clip moved');
    } catch (e) {
      console.error(e);
      toast.error('Failed to move clip');
    }
  };

  const removeClip = async (clipId: string) => {
    try {
      await deleteClip(clipId);
      setClips(prev => prev.filter(c => c.id !== clipId));
      toast.success('Clip deleted');
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete clip');
    }
  };

  return (
    <div className="p-6 xl:p-8 w-full">
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold dark:text-white">Videos Library</h1>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {currentFolder ? (
                <div className="flex items-center gap-1">
                  <button className="hover:underline" onClick={() => setCurrentFolderId(null)}>Root</button>
                  <ChevronRight className="w-3 h-3" />
                  <span className="font-medium">{currentFolder.name}</span>
                </div>
              ) : (
                <span>Root</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
          {!creatingFolder ? (
            <button onClick={() => setCreatingFolder(true)} className="px-3 py-2 bg-[#202123] text-white rounded-lg flex items-center gap-2 text-sm">
              <FolderPlus className="w-4 h-4" /> New Folder
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Folder name" className="px-2 py-1 rounded bg-white/80 dark:bg-[#18181a] border border-gray-300 dark:border-[#0e0f15] text-sm" />
              <button onClick={createFolder} className="px-3 py-2 bg-[#202123] text-white rounded-lg text-sm">Create</button>
              <button onClick={() => { setCreatingFolder(false); setNewFolderName(''); }} className="px-3 py-2 border rounded-lg text-sm">Cancel</button>
            </div>
          )}
          </div>
        </div>
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} placeholder="Search clips" className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-[#0e0f15] bg-white dark:bg-[#18181a] text-sm text-gray-900 dark:text-white" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[240px_1fr] gap-6">
        {/* Folders tree */}
        <div className="bg-[#f3f4ee] dark:bg-[#0e0f15] rounded-xl p-3">
          <div className="font-semibold mb-2 dark:text-white">Folders</div>
          <button onClick={() => setCurrentFolderId(null)} className={`w-full flex items-center justify-between gap-2 px-2 py-1 rounded ${currentFolderId === null ? 'bg-black/10 dark:bg-white/10' : ''}`}>
            <Folder className="w-4 h-4" /> Root
            {currentFolderId === null && (
              <div className="flex items-center gap-1 opacity-60 text-xs">
                <span>{folders.filter(f=>!f.parent_id).length}</span>
              </div>
            )}
          </button>
          <div className="mt-2 space-y-1">
            {rootFolders.map((f) => (
              <div key={f.id} className={`w-full flex items-center justify-between gap-2 px-2 py-1 rounded ${currentFolderId === f.id ? 'bg-black/10 dark:bg-white/10' : ''}`}>
                <button onClick={() => setCurrentFolderId(f.id)} className="flex items-center gap-2 flex-1 text-left">
                  <ChevronRight className="w-4 h-4" /> <span className="truncate">{f.name}</span>
                </button>
                {renamingFolderId === f.id ? (
                  <div className="flex items-center gap-1">
                    <input value={renameValue} onChange={(e)=>setRenameValue(e.target.value)} className="w-28 px-1 py-0.5 rounded border bg-white dark:bg-[#18181a] text-xs" />
                    <button onClick={async()=>{ await renameUserFolder(f.id, renameValue.trim() || f.name); setRenamingFolderId(null); setRenameValue(''); loadData(); }}><Check className="w-4 h-4"/></button>
                    <button onClick={()=>{ setRenamingFolderId(null); setRenameValue(''); }}><X className="w-4 h-4"/></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 opacity-80">
                    <button onClick={()=>{ setRenamingFolderId(f.id); setRenameValue(f.name); }} title="Rename"><Edit2 className="w-4 h-4"/></button>
                    <button onClick={async()=>{ if(confirm('Delete folder?')) { await deleteUserFolder(f.id); loadData(); } }} title="Delete"><Trash2 className="w-4 h-4"/></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Clips panel */}
        <div className="bg-[#f3f4ee] dark:bg-[#0e0f15] rounded-xl p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm dark:text-white">
              <div {...getRootProps()} className="relative cursor-pointer">
                <input {...getInputProps()} />
                <button className="px-3 py-1.5 bg-[#202123] text-white rounded-lg hover:bg-[#202123]/90 transition-colors flex items-center gap-2 text-sm">
                  <Upload className="w-4 h-4" /> Upload Videos
                </button>
                {isDragActive && (
                  <div className="absolute inset-0 -m-2 rounded bg-black/80 text-white flex items-center justify-center">Drop videos here</div>
                )}
              </div>
              <span className="text-xs opacity-70">{clips.length} clips</span>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 opacity-70">Loading…</div>
          ) : clips.length === 0 ? (
            <div className="text-center py-12 opacity-70">No clips in this folder</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredClips.map((clip) => {
                const selected = selectedClipIds.includes(clip.id);
                return (
                  <div key={clip.id} className={`group relative rounded-xl overflow-hidden bg-gradient-to-b from-black/40 to-black/20 dark:from-white/20 dark:to-white/10 border border-white/10 hover:border-white/20 transition transform hover:-translate-y-0.5 hover:shadow-lg` }>
                    <div className="relative aspect-[9/16]">
                      <video src={clip.path} className="w-full h-full object-cover" muted preload="metadata" />
                      <button onClick={()=>toggleSelectClip(clip.id)} className={`absolute top-2 left-2 w-5 h-5 rounded border ${selected ? 'bg-[#3e90fd] border-[#3e90fd]' : 'bg-black/40 border-white/60'} transition`}></button>
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 flex items-center justify-center gap-2">
                        <button onClick={() => removeClip(clip.id)} className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="relative group/move">
                          <button className="w-8 h-8 rounded-full bg-white/30 hover:bg-white/50 text-white flex items-center justify-center">
                            <MoveRight className="w-4 h-4" />
                          </button>
                          <div className="absolute z-10 hidden group-hover/move:block bg-white dark:bg-[#18181a] rounded shadow p-2 mt-2 min-w-[160px]">
                            <button onClick={() => moveClip(clip.id, null)} className="block w-full text-left px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10 rounded">Root</button>
                            {rootFolders.map(f => (
                              <button key={f.id} onClick={() => moveClip(clip.id, f.id)} className="block w-full text-left px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10 rounded">{f.name}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-2">
                      <div className="text-xs truncate dark:text-gray-900 text-[#fafafa]">{clip.title || clip.file_name}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedClipIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0a0a0c] text-white dark:bg-white dark:text-black px-4 py-2 rounded-xl shadow-xl border border-white/10 flex items-center gap-3 z-50">
          <span className="text-sm">{selectedClipIds.length} selected</span>
          <button onClick={deleteSelected} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-sm">Delete</button>
          <div className="relative group">
            <button className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm flex items-center gap-2"><MoveRight className="w-4 h-4"/> Move to</button>
            <div className="absolute hidden group-hover:block bg-white dark:bg-[#18181a] rounded shadow p-2 mt-2 min-w-[180px]">
              <button onClick={() => moveSelectedTo(null)} className="block w-full text-left px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10 rounded">Root</button>
              {rootFolders.map(f => (
                <button key={f.id} onClick={() => moveSelectedTo(f.id)} className="block w-full text-left px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10 rounded">{f.name}</button>
              ))}
            </div>
          </div>
          <button onClick={clearSelection} className="px-3 py-1.5 border rounded-lg text-sm">Clear</button>
        </div>
      )}
    </div>
  );
}


